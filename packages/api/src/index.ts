import { zValidator } from "@hono/zod-validator";
import { computeVerdict, minor, type PropertyInput } from "@veela/core";
import { HK_RULE_SETS } from "@veela/core";
import {
  buildings,
  districts,
  estates,
  marketObservations,
  profiles,
  properties,
  verdicts,
  withUser,
  type Database,
} from "@veela/db";
import {
  chatRequestSchema,
  createApiKeySchema,
  reportBriefSchema,
  createPropertySchema,
  buildingSearchQuerySchema,
  importListingRequestSchema,
  latestByDistrictQuerySchema,
  mapQuerySchema,
  neighbourhoodQuerySchema,
  seriesQuerySchema,
  updatePropertySchema,
  updateProfileSchema,
  type CreatePropertyInput,
} from "@veela/types";
import { and, asc, desc, eq, gte, lte, sql } from "drizzle-orm";
import { Hono, type MiddlewareHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import { stream as honoStream } from "hono/streaming";

import { ADDRESS_LOOKUP_SOURCE, searchAddresses, type AddressMatch } from "./address-lookup.js";
import { alertsForAll, type MonitoredProperty } from "./alerts.js";
import { streamCompletion, unavailableMessage } from "./ai.js";
import { createKey, listKeys, meter, revokeKey, verifyKey, type KeyRecord } from "./api-keys.js";
import { AI_RATE_PER_MINUTE, ANONYMOUS_RATE_PER_MINUTE, PLANS } from "./plans.js";
import { callerIp, consume } from "./rate-limit.js";
import { toEngineInput } from "./engine-input.js";
import { fetchNeighbourhood, NEIGHBOURHOOD_PAYLOAD_VERSION } from "./neighbourhood.js";
import { extractListing } from "./listing-extract.js";
import { fetchSpaciousHtmlStealthily } from "./spacious-stealth-fetch.js";
import { fetchHtmlSafely, FetchFailedError, UnsafeUrlError } from "./ssrf-safe-fetch.js";

const SPACIOUS_HOSTS = new Set(["spacious.hk", "www.spacious.hk"]);

/** spacious.hk 403s the honest fetcher below — verified against a real listing, not
 *  assumed — via an active Cloudflare challenge, not a header check. Every other host
 *  keeps using the same SSRF-safe, self-identifying fetch as always; only this one named
 *  domain is routed to the browser-based fetcher. See spacious-stealth-fetch.ts for what
 *  that trade-off actually is. */
function isSpaciousUrl(rawUrl: string): boolean {
  try {
    return SPACIOUS_HOSTS.has(new URL(rawUrl).hostname.toLowerCase());
  } catch {
    return false;
  }
}

export interface Env {
  Variables: {
    db: Database;
    userId: string | null;
    /** Set by `requireApiKey` for `/v1/*` routes only. */
    apiKey: KeyRecord;
  };
}

/** Rule sets by jurisdiction. Only Hong Kong is modelled so far. */
const RULE_SETS = {
  HK: HK_RULE_SETS,
} as const;

function requireUser(userId: string | null): string {
  if (userId === null) {
    throw new HTTPException(401, { message: "Authentication required" });
  }
  return userId;
}

function rulesFor(jurisdiction: keyof typeof RULE_SETS | string) {
  const set = RULE_SETS[jurisdiction as keyof typeof RULE_SETS];
  if (set === undefined) {
    throw new HTTPException(400, {
      message: `No tax rules are modelled for ${jurisdiction} yet. Hong Kong is supported; Vietnam and France are not.`,
    });
  }
  return set;
}

/* The lazy single-provider Anthropic client that used to live here is gone: `ai.ts` owns
   provider selection now, reads its keys per request (so a key added in the dashboard takes
   effect without a redeploy), and keeps the same "never construct a client at module scope"
   property that let `next build` succeed on a machine with nothing configured. */

/**
 * Grounded in what the product itself claims, not a generic "helpful real-estate
 * assistant" prompt: the same jurisdiction, the same rules, the same refusal to invent
 * a number it wasn't given. `context`, when present, is a plain-text summary of the
 * property currently on screen — built client-side from the live `Verdict`, see
 * `apps/web/components/ai-chat-provider.tsx`.
 */
function systemPrompt(context: string | undefined): string {
  const base = `You are the Veela assistant — you help an investor evaluate long-term \
residential property in Hong Kong. Veela's own rules apply to you too:

- Ground answers in real Hong Kong mechanics: ad valorem stamp duty (scales vary by \
buyer situation — permanent resident, second property, company purchase), property tax \
(15% on 80% of gross rent — an effective 12%), no capital gains tax on investment \
property (but frequent buying and selling can be assessed as a trade under Profits Tax), \
and the Cap. 349 rule that letting under 28 consecutive days without a guesthouse \
licence is a criminal offence.
- Never invent a rate, a district figure or a number you were not given. If a precise \
answer needs the Inland Revenue Department or the Rating and Valuation Department, say \
so and name which one, rather than guessing.
- You are not a licensed financial or legal adviser, and Veela is not a substitute for \
one. Say so plainly if someone asks for advice that requires a licence to give.
- Be concise. This is a chat panel, not a report — a paragraph beats an essay.`;

  if (context === undefined || context === "") return base;
  return `${base}\n\nThe investor currently has this property open in Veela:\n${context}`;
}

/**
 * Turn a rate-limit refusal into the response every HTTP client already understands.
 *
 * 429 with `Retry-After` rather than a bespoke error shape: an integration written against
 * this API should back off correctly without reading our documentation, and every HTTP
 * library on earth already knows how.
 */
function tooManyRequests(resetSeconds: number, detail: string): HTTPException {
  return new HTTPException(429, {
    res: new Response(
      JSON.stringify({ error: "rate_limited", message: detail, retryAfterSeconds: resetSeconds }),
      {
        status: 429,
        headers: { "content-type": "application/json", "retry-after": String(resetSeconds) },
      },
    ),
  });
}

/**
 * Limit an anonymous caller by IP, or a signed-in one by user id.
 *
 * A session is a much better bucket than an address — shared office NAT puts colleagues
 * behind one IP, and a mobile network rotates them — so whenever there is a user, use it.
 */
async function limitPublic(
  db: Database,
  userId: string | null,
  headers: Headers,
  perMinute: number,
  what: string,
): Promise<void> {
  const bucket = userId === null ? `ip:${callerIp(headers)}` : `user:${userId}`;
  const verdict = await consume(db, `${what}|${bucket}`, perMinute);
  if (!verdict.allowed) {
    throw tooManyRequests(
      verdict.resetSeconds,
      `Too many requests. This endpoint allows ${perMinute} a minute; try again in ${verdict.resetSeconds}s.`,
    );
  }
}

/**
 * Verify the key, the burst limit and the monthly quota — **before** anything parses the
 * request body.
 *
 * This is middleware rather than the first lines of the handler because `zValidator` runs at
 * the point it is chained: with the check inside the handler, an unauthenticated caller got a
 * **400 describing our schema** instead of a 401, which both leaks the shape of the API and
 * spends parsing on a request that was never going to be served. Caught by curling the
 * endpoint with no key and reading the status code.
 */
const requireApiKey: MiddlewareHandler<Env> = async (c, next) => {
  const db = c.get("db");

  const auth = c.req.header("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (token === "") {
    throw new HTTPException(401, {
      message: "Send your key as `Authorization: Bearer vk_live_…`. Create one at /account/api.",
    });
  }

  const key = await verifyKey(db, token);
  if (key === null) {
    throw new HTTPException(401, { message: "That API key is not valid, or has been revoked." });
  }

  // Burst guard binds independently of the monthly quota: a month's allowance spent in one
  // minute is an outage for everyone else on the instance.
  const burst = await consume(db, `v1|key:${key.id}`, key.plan.ratePerMinute);
  if (!burst.allowed) {
    throw tooManyRequests(
      burst.resetSeconds,
      `Your plan (${key.plan.name}) allows ${key.plan.ratePerMinute} requests a minute.`,
    );
  }

  const usage = await meter(db, key.id, c.req.path, key.monthlyQuota);
  if (!usage.withinQuota) {
    throw new HTTPException(402, {
      message:
        `Monthly quota reached: ${usage.usedThisMonth} of ${usage.quota} calls on the ` +
        `${key.plan.name} plan. It resets on the 1st.`,
    });
  }

  // On every response, so a customer can watch the meter without polling another endpoint.
  c.header("x-veela-quota-limit", String(usage.quota));
  c.header("x-veela-quota-used", String(usage.usedThisMonth));
  c.set("apiKey", key);
  await next();
};

export const api = new Hono<Env>()

  // ── The verdict, without persisting anything ─────────────────────────────
  // Lets someone try a property before signing up. No auth, no storage.
  .post("/verdict/preview", zValidator("json", createPropertySchema), async (c) => {
    await limitPublic(
      c.get("db"), c.get("userId"), c.req.raw.headers, ANONYMOUS_RATE_PER_MINUTE, "verdict",
    );
    const body = c.req.valid("json");
    const verdict = computeVerdict(toEngineInput(body), rulesFor(body.jurisdiction));
    return c.json({ verdict });
  })

  // ── The assistant — streamed, nothing stored ─────────────────────────────
  // No auth: the same "try it before you sign up" reasoning as /verdict/preview. The
  // conversation lives entirely in the request body; the server holds no history.
  //
  // Provider selection, failover and the "nothing configured" sentence all live in `ai.ts`;
  // this route only supplies the prompt. An unavailable model still arrives as readable body
  // text rather than a status code, because headers are committed the moment a stream opens —
  // the client already knows how to render that as a chat bubble.
  .post("/chat", zValidator("json", chatRequestSchema), async (c) => {
    // Far tighter than the engine: these calls spend real money per request, and this is the
    // limit that stops one visitor becoming an unbounded bill.
    await limitPublic(c.get("db"), c.get("userId"), c.req.raw.headers, AI_RATE_PER_MINUTE, "chat");
    const { messages, context } = c.req.valid("json");

    return honoStream(c, async (stream) => {
      const result = await streamCompletion(
        {
          system: systemPrompt(context),
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
          maxTokens: 1_024,
        },
        async (text) => {
          await stream.write(text);
        },
      );

      if (result.provider === null) {
        await stream.write(unavailableMessage(result.failures));
      } else if (result.failures.length > 0) {
        console.warn(`[chat] answered by ${result.provider} after: ${result.failures.join("; ")}`);
      }
    });
  })


  /**
   * A written brief on a report that has **already been computed**.
   *
   * ## The line this route does not cross
   *
   * Asked to "use AI to compute all the financials". It does not, and that is deliberate
   * rather than unfinished. The yield, the stamp duty and the tax come from `computeVerdict` —
   * a deterministic engine with the AVD table transcribed verbatim from the IRD, rule sets
   * versioned by transaction date, and 23 tests asserting continuity at every marginal-relief
   * boundary. Substituting a language model for that would trade an auditable, reproducible,
   * *sourced* figure for a plausible one, break the invariant this app leans on everywhere
   * ("the rail and the report call the same function, so they cannot disagree"), and put an
   * unsourceable number on the screen a reader acts on. This codebase treats an unsourced rate
   * as a bug.
   *
   * So the division of labour is: **the engine computes, the model explains.** Everything in
   * the prompt below is a figure the engine already produced or a count OSM already returned;
   * the model's only job is to say what they mean together, which is judgement over public
   * rules — exactly the use this project's own open question 2 identified as the natural fit.
   *
   * The request carries **prose, not the `Verdict` shape** — same reasoning as the chat
   * endpoint's `context` field: coupling this contract to the engine's output type would make
   * every `Verdict` change a break here too.
   *
   * Streamed as plain text, and a missing `ANTHROPIC_API_KEY` arrives as readable body text
   * rather than a status code, for the same reason as `/chat`: headers are already committed.
   */
  .post("/report/brief", zValidator("json", reportBriefSchema), async (c) => {
    await limitPublic(c.get("db"), c.get("userId"), c.req.raw.headers, AI_RATE_PER_MINUTE, "brief");
    const { summary, area } = c.req.valid("json");

    return honoStream(c, async (stream) => {
      const system = `You are writing a short brief for an investor on a Hong Kong \
residential property, inside Veela's own report.

**Every number you are given was computed by Veela's rules engine. Treat them as given and \
never recompute, adjust or contradict them.** If a figure you would want is absent, say it is \
not in the report rather than estimating it.

Write 3 short paragraphs, no headings, no bullet lists:
1. What the numbers say about this as an investment — lead with the net yield and what the \
cash actually buys.
2. The findings that matter most and what they would mean in practice.
3. What is nearby, if area data is given, and what it implies for letting the flat.

Rules:
- Plain English, no jargon without explaining it, no filler, no restating the whole table.
- Hong Kong mechanics only: ad valorem stamp duty, property tax at 15% on 80% of gross rent, \
no capital gains tax on investment property (but frequent trading risks Profits Tax), and \
Cap. 349's 28-day rule making unlicensed short lets a criminal offence.
- Never invent a rate, a rent, a district figure or a comparable. You have no data beyond what \
is below.
- You are not a licensed adviser. Do not tell them to buy or not buy; give them what to weigh.
- If the rent is described as estimated, say plainly that every yield rests on that estimate.`;

      const result = await streamCompletion(
        {
          system,
          messages: [
            {
              role: "user",
              content:
                area === undefined || area === ""
                  ? `${summary}

No area data is available for this property.`
                  : `${summary}

What is nearby (OpenStreetMap, straight-line distances):
${area}`,
            },
          ],
          maxTokens: 900,
        },
        async (text) => {
          await stream.write(text);
        },
      );

      if (result.provider === null) {
        await stream.write(unavailableMessage(result.failures));
        return;
      }
      if (result.failures.length > 0) {
        console.warn(`[brief] answered by ${result.provider} after: ${result.failures.join("; ")}`);
      }
    });
  })

  // ── Listing import — reads published metadata, never invents a figure ───
  // No auth, same reasoning as /verdict/preview. SSRF protection lives entirely in
  // fetchHtmlSafely; this handler's job is just to turn its result (or its refusal)
  // into a response the paste-a-link UI can show.
  .post("/listing/import", zValidator("json", importListingRequestSchema), async (c) => {
    const { url } = c.req.valid("json");

    try {
      const { html, finalUrl } = isSpaciousUrl(url) ? await fetchSpaciousHtmlStealthily(url) : await fetchHtmlSafely(url);
      const listing = extractListing(html, finalUrl);
      return c.json({ listing });
    } catch (cause) {
      if (cause instanceof UnsafeUrlError) {
        throw new HTTPException(400, { message: `That URL can't be fetched: ${cause.message}` });
      }
      if (cause instanceof FetchFailedError) {
        throw new HTTPException(422, { message: `Couldn't read that page: ${cause.message}` });
      }
      throw new HTTPException(502, { message: "Something went wrong fetching that page." });
    }
  })

  /**
   * ═══════════════════════════════════════════════════════════════════════
   * THE COMMERCIAL API — `/v1/verdict`
   * ═══════════════════════════════════════════════════════════════════════
   *
   * **This is the thing Veela actually sells.** The business review that led here found the
   * consumer ceiling to be low — roughly 63,000 residential transactions a year in the whole
   * of Hong Kong, of which only some fraction are investors — while the same engine sold to
   * the banks, brokers, agencies and developers who need correct stamp duty *daily* reaches a
   * comparable number from about twenty relationships instead of two thousand customers.
   *
   * What a buyer is paying for is not arithmetic they could write themselves. It is that
   * **Hong Kong's ad valorem scales change, repeatedly, and this is versioned by transaction
   * date** — BSD, SSD and NRSD are modelled rather than deleted, so a 2023 transaction still
   * prices under 2023's rules. Every integration that hard-codes a stamp duty table is wrong
   * the morning after a Budget; this one is dated and tested at every marginal-relief
   * boundary.
   *
   * Deliberately versioned `/v1` from the first day it exists. The consumer routes above can
   * change with the UI that calls them; a customer's integration cannot, and retrofitting a
   * version prefix after someone has shipped against it is a breaking change disguised as
   * housekeeping.
   */
  .post("/v1/verdict", requireApiKey, zValidator("json", createPropertySchema), (c) => {
    const body = c.req.valid("json");
    const verdict = computeVerdict(toEngineInput(body), rulesFor(body.jurisdiction));
    return c.json({ verdict, plan: c.get("apiKey").plan.id });
  })

  // ── Key management, for the customer's own dashboard ─────────────────────
  // Session-authenticated, not key-authenticated: a key must never be able to mint another
  // key, or a single leak escalates into permanent access.
  .get("/api-keys", async (c) => {
    const userId = requireUser(c.get("userId"));
    return c.json({ keys: await listKeys(c.get("db"), userId) });
  })

  .post("/api-keys", zValidator("json", createApiKeySchema), async (c) => {
    const userId = requireUser(c.get("userId"));
    const { name, plan } = c.req.valid("json");
    const issued = await createKey(c.get("db"), userId, name, plan);
    // The only time the plaintext exists outside the caller's machine. Said plainly in the
    // response so a client cannot treat it as retrievable later.
    return c.json(
      {
        id: issued.id,
        key: issued.key,
        prefix: issued.prefix,
        notice: "Copy this now — it is hashed on save and cannot be shown again.",
      },
      201,
    );
  })

  .delete("/api-keys/:id", async (c) => {
    const userId = requireUser(c.get("userId"));
    const ok = await revokeKey(c.get("db"), userId, c.req.param("id"));
    if (!ok) throw new HTTPException(404, { message: "No such key, or it is already revoked." });
    return c.json({ revoked: true });
  })

  // What the pricing page renders, from the same object the quotas are enforced against —
  // so a price on a marketing page can never disagree with what the limiter actually allows.
  .get("/plans", (c) => c.json({ plans: Object.values(PLANS) }))

  // ── Profile — "Manage" ───────────────────────────────────────────────────
  // The row always exists by the time this runs: `handle_new_user` (see
  // packages/db/migrations/0001_postgis_and_rls.sql) creates it on signup, before any
  // client ever calls this route. So GET here is a lookup, never a create-on-read.
  .get("/profile", async (c) => {
    const userId = requireUser(c.get("userId"));
    const db = c.get("db");
    const [profile] = await withUser(db, userId, (tx) =>
      tx.select().from(profiles).where(eq(profiles.id, userId)),
    );
    if (profile === undefined) throw new HTTPException(404, { message: "Profile not found" });
    return c.json({ profile });
  })

  .patch("/profile", zValidator("json", updateProfileSchema), async (c) => {
    const userId = requireUser(c.get("userId"));
    const db = c.get("db");
    const patch = c.req.valid("json");

    const updated = await withUser(db, userId, async (tx) => {
      const [row] = await tx
        .update(profiles)
        .set({
          ...patch,
          // Only stamped when consent is actually being turned on — flipping it off
          // shouldn't look like a fresh grant if it's ever turned back on later.
          ...(patch.aggregateConsent === true && { aggregateConsentAt: new Date() }),
        })
        .where(eq(profiles.id, userId))
        .returning();
      return row ?? null;
    });

    if (updated === null) throw new HTTPException(404, { message: "Profile not found" });
    return c.json({ profile: updated });
  })

  /**
   * Live alerts across every property the reader has asked us to track.
   *
   * Computed on read rather than stored. The inputs — RVD's published indices and the dated
   * rule sets — are the same for everyone and change monthly at most, so a materialised alert
   * table would be a cache that can go stale in the one place staleness is the entire subject.
   * At portfolio scale (single digits of saved properties) recomputing costs nothing.
   */
  .get("/alerts", async (c) => {
    const userId = requireUser(c.get("userId"));
    const db = c.get("db");

    const rows = await withUser(db, userId, (tx) =>
      tx
        .select()
        .from(properties)
        .where(and(eq(properties.ownerId, userId), eq(properties.monitored, true))),
    );

    // The latest snapshot per property, so an alert compares against what the reader last saw
    // rather than the first thing they ever saved.
    const monitored: MonitoredProperty[] = [];
    for (const row of rows) {
      const [latest] = await withUser(db, userId, (tx) =>
        tx
          .select()
          .from(verdicts)
          .where(eq(verdicts.propertyId, row.id))
          .orderBy(desc(verdicts.computedAt))
          .limit(1),
      );
      monitored.push({
        id: row.id,
        label: row.label,
        jurisdiction: row.jurisdiction,
        currency: row.currency,
        priceMinor: row.priceMinor,
        monthlyRentMinor: row.monthlyRentMinor,
        saleableAreaSqft: row.saleableAreaSqft,
        transactionDate: row.transactionDate,
        buyer: row.buyer,
        costs: row.costs,
        financing: row.financing,
        verdict: latest === undefined ? null : (latest.payload as never),
        verdictComputedAt:
          latest === undefined ? null : new Date(latest.computedAt).toISOString().slice(0, 10),
      });
    }

    return c.json({
      alerts: alertsForAll(monitored),
      trackedCount: monitored.length,
    });
  })

  // ── Properties ───────────────────────────────────────────────────────────
  .get("/properties", async (c) => {
    const userId = requireUser(c.get("userId"));
    const db = c.get("db");
    const rows = await withUser(db, userId, (tx) =>
      tx
        .select()
        .from(properties)
        .where(eq(properties.ownerId, userId))
        .orderBy(desc(properties.updatedAt)),
    );
    return c.json({ properties: rows });
  })

  .post("/properties", zValidator("json", createPropertySchema), async (c) => {
    const userId = requireUser(c.get("userId"));
    const db = c.get("db");
    const body = c.req.valid("json");

    const engineInput = toEngineInput(body);
    const computed = computeVerdict(engineInput, rulesFor(body.jurisdiction));

    const created = await withUser(db, userId, async (tx) => {
      const [property] = await tx
        .insert(properties)
        .values({
          ownerId: userId,
          label: body.label,
          jurisdiction: body.jurisdiction,
          currency: body.currency,
          districtId: body.districtId ?? null,
          buildingId: body.buildingId ?? null,
          estateId: body.estateId ?? null,
          priceMinor: body.priceMinor,
          monthlyRentMinor: body.monthlyRentMinor,
          saleableAreaSqft: body.saleableAreaSqft ?? null,
          transactionDate: body.transactionDate,
          buyer: body.buyer,
          costs: body.costs,
          financing: body.financing ?? null,
          monitored: body.monitored,
        })
        .returning();

      if (property === undefined) {
        throw new HTTPException(500, { message: "Insert returned no row" });
      }

      const [snapshot] = await tx
        .insert(verdicts)
        .values({
          propertyId: property.id,
          ownerId: userId,
          rulesVersion: computed.rulesUsed,
          grossYield: computed.returns.grossYield,
          netYield: computed.returns.netYield,
          cashOnCash: computed.returns.cashOnCash,
          payload: computed,
        })
        .returning();

      return { property, verdict: snapshot };
    });

    return c.json(created, 201);
  })

  .get("/properties/:id", async (c) => {
    const userId = requireUser(c.get("userId"));
    const db = c.get("db");
    const id = c.req.param("id");

    const result = await withUser(db, userId, async (tx) => {
      const [property] = await tx.select().from(properties).where(eq(properties.id, id));
      if (property === undefined) return null;
      const [latest] = await tx
        .select()
        .from(verdicts)
        .where(eq(verdicts.propertyId, id))
        .orderBy(desc(verdicts.computedAt))
        .limit(1);
      return { property, verdict: latest ?? null };
    });

    // RLS already scoped the read to the owner, so "not visible" and "not found"
    // are the same thing — and we must not leak which.
    if (result === null) throw new HTTPException(404, { message: "Property not found" });
    return c.json(result);
  })

  .patch("/properties/:id", zValidator("json", updatePropertySchema), async (c) => {
    const userId = requireUser(c.get("userId"));
    const db = c.get("db");
    const id = c.req.param("id");
    const patch = c.req.valid("json");

    const updated = await withUser(db, userId, async (tx) => {
      const [row] = await tx
        .update(properties)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(properties.id, id))
        .returning();
      return row ?? null;
    });

    if (updated === null) throw new HTTPException(404, { message: "Property not found" });
    return c.json({ property: updated });
  })

  .delete("/properties/:id", async (c) => {
    const userId = requireUser(c.get("userId"));
    const db = c.get("db");
    await withUser(db, userId, (tx) =>
      tx.delete(properties).where(eq(properties.id, c.req.param("id"))),
    );
    return c.body(null, 204);
  })

  /**
   * Recompute against today's rules. Verdicts are snapshots, so this appends rather
   * than overwriting — the user can see what changed and why.
   */
  .post("/properties/:id/verdict", async (c) => {
    const userId = requireUser(c.get("userId"));
    const db = c.get("db");
    const id = c.req.param("id");

    const snapshot = await withUser(db, userId, async (tx) => {
      const [property] = await tx.select().from(properties).where(eq(properties.id, id));
      if (property === undefined) return null;

      const computed = computeVerdict(
        toEngineInput({
          label: property.label,
          jurisdiction: property.jurisdiction,
          currency: property.currency,
          priceMinor: property.priceMinor,
          monthlyRentMinor: property.monthlyRentMinor,
          transactionDate: property.transactionDate,
          buyer: property.buyer as CreatePropertyInput["buyer"],
          costs: property.costs as CreatePropertyInput["costs"],
          financing: (property.financing ?? undefined) as CreatePropertyInput["financing"],
          monitored: property.monitored,
          ...(property.saleableAreaSqft !== null && {
            saleableAreaSqft: property.saleableAreaSqft,
          }),
        }),
        rulesFor(property.jurisdiction),
      );

      const [row] = await tx
        .insert(verdicts)
        .values({
          propertyId: id,
          ownerId: userId,
          rulesVersion: computed.rulesUsed,
          grossYield: computed.returns.grossYield,
          netYield: computed.returns.netYield,
          cashOnCash: computed.returns.cashOnCash,
          payload: computed,
        })
        .returning();
      return row ?? null;
    });

    if (snapshot === null) throw new HTTPException(404, { message: "Property not found" });
    return c.json({ verdict: snapshot }, 201);
  })

  // ── Map: districts as GeoJSON, coloured by one metric ────────────────────
  .get("/map/districts", zValidator("query", mapQuerySchema), async (c) => {
    const { bbox, metric, periodStart } = c.req.valid("query");
    const db = c.get("db");

    const envelope = sql`st_makeenvelope(${bbox.west}, ${bbox.south}, ${bbox.east}, ${bbox.north}, 4326)`;

    // Latest observation per district for the chosen metric, restricted to the viewport.
    const rows = await db.execute(sql`
      with latest as (
        select distinct on (o.district_id)
          o.district_id, o.value, o.period_start, o.source
        from market_observations o
        where o.metric = ${metric}
          ${periodStart ? sql`and o.period_start = ${periodStart}` : sql``}
        order by o.district_id, o.period_start desc
      )
      select
        d.id,
        d.name_en,
        d.name_zh,
        st_asgeojson(d.boundary)::json as geometry,
        l.value,
        l.period_start,
        l.source
      from districts d
      left join latest l on l.district_id = d.id
      where d.boundary && ${envelope}
    `);

    return c.json({
      type: "FeatureCollection",
      metric,
      features: (rows as unknown as Record<string, unknown>[]).map((r) => ({
        type: "Feature",
        id: r["id"],
        geometry: r["geometry"],
        properties: {
          nameEn: r["name_en"],
          nameZh: r["name_zh"],
          value: r["value"] === null ? null : Number(r["value"]),
          periodStart: r["period_start"],
          source: r["source"],
          measuredAt: "district",
          shownAt: "district",
        },
      })),
    });
  })

  /**
   * Buildings in the viewport. Capped, and the cap is reported — a silently
   * truncated map reads as "this is all there is".
   */
  .get("/map/buildings", zValidator("query", mapQuerySchema), async (c) => {
    const { bbox } = c.req.valid("query");
    const db = c.get("db");
    const LIMIT = 2000;

    const rows = await db
      .select({
        id: buildings.id,
        nameEn: buildings.nameEn,
        nameZh: buildings.nameZh,
        estateId: buildings.estateId,
        storeys: buildings.storeys,
        completionYear: buildings.completionYear,
        centroid: sql<string>`st_asgeojson(${buildings.centroid})::json`,
      })
      .from(buildings)
      .where(
        sql`${buildings.centroid} && st_makeenvelope(${bbox.west}, ${bbox.south}, ${bbox.east}, ${bbox.north}, 4326)`,
      )
      .limit(LIMIT + 1);

    const truncated = rows.length > LIMIT;
    return c.json({
      buildings: rows.slice(0, LIMIT),
      truncated,
      ...(truncated && {
        notice: `More than ${LIMIT} buildings in view — zoom in for a complete picture.`,
      }),
    });
  })

  // ── Supply & demand history for a district ──────────────────────────────
  .get("/market/series", zValidator("query", seriesQuerySchema), async (c) => {
    const { districtId, metric, from, to, rvdClass } = c.req.valid("query");
    const db = c.get("db");

    const conditions = [
      eq(marketObservations.districtId, districtId),
      eq(marketObservations.metric, metric),
    ];
    if (from !== undefined) conditions.push(gte(marketObservations.periodStart, from));
    if (to !== undefined) conditions.push(lte(marketObservations.periodStart, to));
    if (rvdClass !== undefined) conditions.push(eq(marketObservations.rvdClass, rvdClass));

    const rows = await db
      .select({
        periodStart: marketObservations.periodStart,
        periodMonths: marketObservations.periodMonths,
        value: marketObservations.value,
        source: marketObservations.source,
      })
      .from(marketObservations)
      .where(and(...conditions))
      .orderBy(asc(marketObservations.periodStart));

    return c.json({
      districtId,
      metric,
      points: rows.map((r) => ({ ...r, value: Number(r.value) })),
      sources: [...new Set(rows.map((r) => r.source))],
    });
  })

  /**
   * Latest value of one metric for every district that has one. Public, like the rest of
   * the reference layer — `market_observations` carries a public-read RLS policy.
   *
   * Returns `[]` rather than erroring when a metric has no rows, because most metrics
   * still have none: only what has actually been ingested is here, and the UI's job is
   * to fall back to its labelled synthetic series rather than to show a blank map.
   */
  .get("/market/latest", zValidator("query", latestByDistrictQuerySchema), async (c) => {
    const { metric } = c.req.valid("query");
    const db = c.get("db");

    // DISTINCT ON needs its leading ORDER BY columns to match the distinct key; the
    // period_start DESC that follows is what makes it "latest".
    const rows = await db.execute(sql`
      select distinct on (o.district_id)
        o.district_id, o.value, o.period_start, o.period_months, o.source
      from market_observations o
      where o.metric = ${metric}
      order by o.district_id, o.period_start desc
    `);

    const list = (rows as unknown as Record<string, unknown>[]).map((r) => ({
      districtId: String(r["district_id"]),
      value: Number(r["value"]),
      periodStart: String(r["period_start"]),
      periodMonths: Number(r["period_months"]),
      source: String(r["source"]),
    }));

    return c.json({
      metric,
      values: list,
      sources: [...new Set(list.map((r) => r.source))],
    });
  })

  /**
   * Free-text building search, and the one place this product acquires **real
   * per-building data**. Resolved live against the Government's Address Lookup Service
   * (see `address-lookup.ts` for why ALS rather than Lands Department footprints), then
   * persisted: every distinct estate and building a search resolves is upserted, so the
   * database fills with real buildings as a by-product of use rather than needing a bulk
   * ingestion first. That is the same "user-fed, not aggregation-first" bet the whole
   * product is built on, applied to geography.
   *
   * **Persistence never blocks the response.** ALS is the authority; our table is a
   * cache of what people have looked at. If the write fails — no `DATABASE_URL`, RLS,
   * a race between two identical searches — the search still returns, and `persisted`
   * says so rather than the caller silently believing a lie about what was stored.
   */
  .get("/buildings/search", zValidator("query", buildingSearchQuerySchema), async (c) => {
    const { q, limit } = c.req.valid("query");

    let matches: readonly AddressMatch[];
    try {
      matches = await searchAddresses(q, limit);
    } catch (cause) {
      throw new HTTPException(502, {
        message: `Address Lookup Service is unavailable: ${
          cause instanceof Error ? cause.message : "unknown error"
        }`,
      });
    }

    let persisted = 0;
    try {
      const db = c.get("db");

      /**
       * **Two statements, not two per result.** The first version awaited an estate
       * upsert and a building upsert inside the loop — 2N sequential round-trips to a
       * Singapore-region database, which measured **12 seconds for 8 results** and made
       * search-as-you-type unusable. Latency, not query cost: the work is trivial, there
       * was just a lot of waiting. Batched into one multi-row upsert per table it is two
       * round-trips regardless of how many results come back.
       */
      const uniqueEstates = new Map<string, { districtId: string; nameEn: string; nameZh: string | null }>();
      for (const m of matches) {
        if (m.estateNameEn === undefined) continue;
        uniqueEstates.set(`${m.districtId}|${m.estateNameEn}`, {
          districtId: m.districtId,
          nameEn: m.estateNameEn,
          nameZh: m.estateNameZh ?? null,
        });
      }

      const estateIdByKey = new Map<string, string>();
      if (uniqueEstates.size > 0) {
        const rows = await db
          .insert(estates)
          .values([...uniqueEstates.values()])
          .onConflictDoUpdate({
            target: [estates.districtId, estates.nameEn],
            // Only fill a blank — never overwrite a curated Chinese name with a null.
            set: { nameZh: sql`coalesce(excluded.name_zh, ${estates.nameZh})` },
          })
          .returning({ id: estates.id, districtId: estates.districtId, nameEn: estates.nameEn });
        for (const r of rows) estateIdByKey.set(`${r.districtId}|${r.nameEn}`, r.id);
      }

      // `centroid` is a PostGIS point; `footprint` stays null because ALS returns a
      // point, not a polygon. Raw SQL because the column is text in the Drizzle schema
      // and cast to geometry by migration 0001.
      const values = matches.map((m) => {
        const estateId =
          m.estateNameEn === undefined
            ? null
            : estateIdByKey.get(`${m.districtId}|${m.estateNameEn}`) ?? null;
        return sql`(
          ${m.districtId}, ${m.label}, ${m.estateNameZh ?? null},
          ${estateId}::uuid,
          st_setsrid(st_makepoint(${m.longitude}, ${m.latitude}), 4326),
          ${ADDRESS_LOOKUP_SOURCE}
        )`;
      });

      if (values.length > 0) {
        await db.execute(sql`
          insert into buildings (district_id, name_en, name_zh, estate_id, centroid, source)
          values ${sql.join(values, sql`, `)}
          on conflict (district_id, name_en) where name_en is not null
          do update set
            centroid = excluded.centroid,
            estate_id = coalesce(excluded.estate_id, buildings.estate_id)
        `);
        persisted = values.length;
      }
    } catch {
      // Deliberately swallowed — see the doc comment. `persisted` carries the truth.
    }

    return c.json({
      query: q,
      source: "Address Lookup Service, Government of Hong Kong (als.gov.hk)",
      /** How many of the results made it into our own tables. Less than `results.length`
       *  means the search worked and the cache didn't — not that the data is wrong. */
      persisted,
      results: matches,
    });
  })

  /**
   * Schools, stations, shops, health and green space near a point — see
   * `neighbourhood.ts` for why this is OpenStreetMap rather than a government dataset,
   * and what ODbL requires of the caller.
   *
   * Public and unauthenticated, like the rest of the reference layer.
   *
   * **This used to say "nothing is persisted… a stale cached amenity list would be worse
   * than a slow fresh one," and production disproved it.** Users saw "Could not reach
   * OpenStreetMap" where a neighbourhood should be, because every view re-queried a busy
   * shared service — and a month-old school list is plainly worth more than a red
   * sentence. The old reasoning wasn't wrong about staleness being a cost; it was wrong
   * that the cost was higher than unavailability. So the cache exists now, and the
   * staleness it admits is *shown to the reader* rather than hidden, which is what makes
   * the trade acceptable.
   *
   * Three outcomes, and the distinction between them is the point:
   *   - fresh cache hit → instant, `cache.hit` true
   *   - miss or expired → fetch Overpass, store, `cache.hit` false
   *   - Overpass down **and** we have an older copy → serve it with `stale: true` and its
   *     age, so the panel can say so. Silently presenting old data as current would be
   *     the worse failure, not the safer one.
   *
   * With nothing cached, a failure is still reported as a failure. An empty neighbourhood
   * and an unreachable Overpass look identical in a `200 {counts: all zero}`, and "no
   * schools nearby" is a claim about a place that a timeout has no business making.
   */
  .get("/neighbourhood", zValidator("query", neighbourhoodQuerySchema), async (c) => {
    const { lat, lng } = c.req.valid("query");
    const db = c.get("db");

    /* Rounded to ~110m — see migration 0004. Collapses every flat in a building, and
       usually every building on a street, onto one cache row, which is what makes the
       cache actually hit rather than storing one row per requested coordinate. */
    const latKey = lat.toFixed(3);
    const lngKey = lng.toFixed(3);

    /** Amenities within walking distance change on the timescale of construction
     *  projects, not days. A month is long enough to make the cache worth having and
     *  short enough that a new station or mall shows up in reasonable time. */
    const FRESH_DAYS = 30;

    type CacheRow = { payload: unknown; fetched_at: string };
    let cached: CacheRow | undefined;
    try {
      const rows = (await db.execute(sql`
        select payload, fetched_at
        from neighbourhood_cache
        where lat_key = ${latKey} and lng_key = ${lngKey}
      `)) as unknown as CacheRow[];
      cached = rows[0];
    } catch {
      // No DATABASE_URL, or the table isn't migrated — the lookup still works, just
      // without a cache. Same "zero configuration" rule as everywhere else.
    }

    /**
     * A row whose payload predates the current shape is **not usable**, however fresh it
     * is. Rows cached before `items` existed carry only a capped `nearest` list, and
     * serving one to a UI whose counts are clickable would show an empty drill-down beside
     * a non-zero count — a number contradicting itself, which is worse than a slow fetch.
     * Old-shape rows are therefore treated as a miss and overwritten on refetch, including
     * for the stale-fallback path below.
     */
    const usable =
      cached !== undefined &&
      (cached.payload as { version?: number } | null)?.version === NEIGHBOURHOOD_PAYLOAD_VERSION;

    const ageDays =
      cached === undefined
        ? Infinity
        : (Date.now() - new Date(cached.fetched_at).getTime()) / 86_400_000;

    if (usable && ageDays < FRESH_DAYS) {
      return c.json({
        ...(cached?.payload as object),
        cache: { hit: true, ageDays: Math.floor(ageDays) },
      });
    }

    try {
      const fresh = await fetchNeighbourhood(lat, lng);
      try {
        await db.execute(sql`
          insert into neighbourhood_cache (lat_key, lng_key, payload, fetched_at)
          values (${latKey}, ${lngKey}, ${JSON.stringify(fresh)}::jsonb, now())
          on conflict (lat_key, lng_key)
          do update set payload = excluded.payload, fetched_at = excluded.fetched_at
        `);
      } catch {
        // A failed write must not fail a successful lookup.
      }
      return c.json({ ...fresh, cache: { hit: false, ageDays: 0 } });
    } catch (cause) {
      /**
       * **Stale beats an error.** If Overpass is unreachable but we hold an older answer
       * for this point, serve it and say how old it is. A month-old school list is worth
       * far more to a reader than a red sentence about a service they have never heard of
       * — and the previous behaviour showed that sentence to roughly half of them.
       */
      // `usable`, not `cached`: an old-shape row cannot stand in for a fresh one here
      // either, for the same reason it can't be served as a hit above.
      if (usable) {
        return c.json({
          ...(cached?.payload as object),
          cache: { hit: true, ageDays: Math.floor(ageDays), stale: true },
        });
      }
      throw new HTTPException(502, {
        message: `Could not reach OpenStreetMap: ${
          cause instanceof Error ? cause.message : "unknown error"
        }. This is a shared community service and is sometimes busy — try again shortly.`,
      });
    }
  })

  .get("/districts", async (c) => {
    const db = c.get("db");
    const rows = await db
      .select({ id: districts.id, nameEn: districts.nameEn, nameZh: districts.nameZh })
      .from(districts)
      .orderBy(asc(districts.nameEn));
    return c.json({ districts: rows });
  });

export type ApiRoutes = typeof api;
