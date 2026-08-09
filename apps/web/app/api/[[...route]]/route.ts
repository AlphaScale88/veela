import { api, type Env } from "@veela/api";
import { createClient, type Database } from "@veela/db";
import { createServerClient } from "@supabase/ssr";
import { Hono } from "hono";
import { handle } from "hono/vercel";
import { cookies } from "next/headers";

export const runtime = "nodejs";

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

async function currentUserId(): Promise<string | null> {
  const url = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const key = process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"];
  // Unconfigured Supabase means nobody is signed in — not a crash. The anonymous
  // Analyse flow has to keep working.
  if (url === undefined || url === "" || key === undefined || key === "") return null;

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
  c.set("userId", await currentUserId());
  await next();
});

app.route("/", api);

export const GET = handle(app);
export const POST = handle(app);
export const PATCH = handle(app);
export const DELETE = handle(app);
