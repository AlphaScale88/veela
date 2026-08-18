import { api, type Env } from "@veela/api";
import { createClient, type Database } from "@veela/db";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { Hono } from "hono";
import { handle } from "hono/vercel";
import { cookies } from "next/headers";

export const runtime = "nodejs";

/**
 * **Vercel functions default to a 10-second ceiling, and that was a real bug.**
 *
 * `GET /neighbourhood` calls Overpass, a shared community service that takes seconds when
 * healthy and needs a retry against a mirror when not. Under the default limit the function
 * was killed mid-flight and the user saw "Could not reach OpenStreetMap" — an error about
 * *our* timeout wearing OpenStreetMap's name. The listing importer has the same shape: an
 * SSRF-safe fetch of somebody else's slow page, and `spacious-stealth-fetch` launches a
 * whole browser to do it.
 *
 * 60s is the ceiling this plan allows. Nothing is *expected* to take that long — the
 * neighbourhood path budgets 3 × 8s of Overpass attempts — it is headroom so a slow
 * upstream fails on its own terms with a real message instead of being guillotined.
 */
export const maxDuration = 60;

/**
 * The Hono app is mounted inside a Next.js catch-all route handler, so ordinary CRUD
 * runs inside the Next deployment on Vercel. No standalone server is needed: the
 * boilerplate reserves that for Tier 4, when something must stay alive 24/7.
 *
 * Server Components must NOT fetch these routes over HTTP — that's a pointless network
 * hop to our own process. They call the query functions directly. Hono is the door for
 * outside callers: the mobile app and the browser.
 */

/**
 * Created on first *use*, not at module scope and not per request.
 *
 * Two reasons it has to be this lazy. `next build` imports route modules to collect
 * metadata, so throwing at module scope would break the build on any machine without a
 * database — CI has no business needing one to compile. And `POST /verdict/preview`
 * computes a verdict from the request body alone: it must work with **zero
 * configuration**, because it's the first thing anyone tries. Eagerly connecting in the
 * middleware would have made the whole app require Supabase before it could show
 * anything.
 */
let cached: Database | undefined;

function realDb(): Database {
  if (cached === undefined) {
    const connectionString = process.env["DATABASE_URL"];
    if (connectionString === undefined || connectionString === "") {
      throw new Error(
        "DATABASE_URL is not set. Copy .env.example to .env.local and fill in your " +
          "Supabase connection string. Routes that only compute (POST /verdict/preview) " +
          "work without it.",
      );
    }
    cached = createClient(connectionString);
  }
  return cached;
}

/**
 * A stand-in that only connects when a route actually touches it. Routes that never
 * read the database never trip the missing-config error.
 */
const lazyDb = new Proxy({} as Database, {
  get: (_target, prop, receiver) => Reflect.get(realDb(), prop, receiver),
  has: (_target, prop) => Reflect.has(realDb(), prop),
});

/**
 * Resolve the caller from an `Authorization: Bearer <jwt>` header.
 *
 * **The mobile app has no cookies.** `currentUserId` below reads the Supabase session out of the
 * cookie jar, which is exactly right for the browser and useless for React Native — so every
 * `/properties` call from the app was resolving to "anonymous" and 401ing. This is the other half
 * of the door: same API, same RLS, a different way of presenting the same session.
 *
 * **The token is verified, never decoded and trusted.** `getUser(token)` asks Supabase whether the
 * JWT is genuine and unexpired; reading its claims locally would accept anything shaped like a JWT,
 * which is the difference between authentication and decoration. That costs a network round trip
 * per request, and it is the correct cost.
 */
async function userIdFromBearer(
  authorization: string | undefined,
  url: string,
  key: string,
): Promise<string | null> {
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (token === undefined || token === "") return null;

  /* A plain client, not the SSR one: there is no cookie jar involved and nothing to persist —
     the token arrived in the request and dies with it. */
  const supabase = createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
  } = await supabase.auth.getUser(token);
  return user?.id ?? null;
}

async function currentUserId(authorization: string | undefined): Promise<string | null> {
  const url = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const key = process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"];
  // Unconfigured Supabase means nobody is signed in — not a crash. The anonymous
  // Analyse flow has to keep working.
  if (url === undefined || url === "" || key === undefined || key === "") return null;

  /* Bearer first, because only a non-browser caller sends one: if a header is present it is a
     deliberate act by the mobile app, whereas a stale cookie can be sitting in a jar unnoticed.
     Falling through on a *failed* bearer would also silently downgrade a bad token to whatever
     cookie happened to be there, which is worse than a clean 401. */
  if (authorization !== undefined) {
    return await userIdFromBearer(authorization, url, key);
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      // Route handlers can't always set cookies; token refresh happens in middleware.
      setAll: () => undefined,
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

const app = new Hono<Env>().basePath("/api");

app.use("*", async (c, next) => {
  c.set("db", lazyDb);
  c.set("userId", await currentUserId(c.req.header("authorization")));
  await next();
});

app.route("/", api);

export const GET = handle(app);
export const POST = handle(app);
export const PATCH = handle(app);
export const DELETE = handle(app);
