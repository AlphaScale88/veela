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
  propertyNotes,
  propertyPhotos,
  verdicts,
  withUser,
  type Database,
} from "@veela/db";
import {
  chatRequestSchema,
  recordConsentSchema,
  LEGAL_VERSIONS,
  LEGAL_DOCUMENTS,
  createApiKeySchema,
  reportBriefSchema,
  createPropertySchema,
  propertyNoteSchema,
  registerPhotoSchema,
  reorderPhotosSchema,
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

/**
 * Photos per property. Not a storage-cost limit — twenty-four 10 MB images is a rounding
 * error — but a limit on what the UI can show and a reader can absorb. It also bounds the
 * reorder payload, which has to list every photo at once.
 */
const MAX_PHOTOS_PER_PROPERTY = 24;

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

  /**
   * ═══════════════════════════════════════════════════════════════════════
   * CONSENT — what the user agreed to, and when
   * ═══════════════════════════════════════════════════════════════════════
   *
   * `GET` answers the only question the UI needs: **is anything outstanding?** That covers two
   * cases with one mechanism — a brand-new account that has accepted nothing, and an existing
   * account created before this existed or before the wording changed. Both show up as an
   * `outstanding` list, so there is no separate "legacy user" path to get wrong.
   */
  .get("/consent", async (c) => {
    const userId = requireUser(c.get("userId"));
    const db = c.get("db");

    const rows = (await db.execute(sql`
      select document, version, accepted_at
      from consent_records
      where user_id = ${userId}
      order by accepted_at desc
    `)) as unknown as { document: string; version: string; accepted_at: string }[];

    const accepted = rows.map((r) => ({
      document: r.document,
      version: r.version,
      acceptedAt: r.accepted_at,
    }));

    const outstanding = LEGAL_DOCUMENTS.filter(
      (doc) => !accepted.some((a) => a.document === doc && a.version === LEGAL_VERSIONS[doc]),
    );

    return c.json({ current: LEGAL_VERSIONS, accepted, outstanding });
  })

  /**
   * `POST` records acceptance.
   *
   * **The version is checked against the one in force, not trusted from the client.** A tab
   * left open across a deployment would otherwise record agreement to wording that is no longer
   * being shown to anyone — the precise failure this table exists to make impossible. A stale
   * submission is rejected with a 409 so the client can reload and present the current text.
   *
   * Idempotent by the table's unique constraint: a double-submit or a refresh cannot
   * manufacture a second record of one event, and re-accepting the same version is a no-op
   * rather than an error.
   */
  .post("/consent", zValidator("json", recordConsentSchema), async (c) => {
    const userId = requireUser(c.get("userId"));
    const db = c.get("db");
    const { documents } = c.req.valid("json");

    for (const d of documents) {
      const inForce = LEGAL_VERSIONS[d.document];
      if (d.version !== inForce) {
        throw new HTTPException(409, {
          message:
            `The ${d.document} document has changed since this page loaded ` +
            `(you sent ${d.version}, current is ${inForce}). Reload and read the current version.`,
        });
      }
    }

    for (const d of documents) {
      await db.execute(sql`
        insert into consent_records (user_id, document, version)
        values (${userId}, ${d.document}, ${d.version})
        on conflict (user_id, document, version) do nothing
      `);
    }

    return c.json({ recorded: documents.length, current: LEGAL_VERSIONS }, 201);
  })

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
          demoListingId: body.demoListingId ?? null,
          sourceUrl: body.sourceUrl ?? null,
          address: body.address ?? null,
          latitude: body.latitude ?? null,
          longitude: body.longitude ?? null,
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

  /**
   * Deleting a property now returns the storage keys of its photos, so the caller can delete
   * the objects too.
   *
   * `property_photos` cascades on the foreign key, so the *rows* go by themselves — and that
   * is precisely what makes this necessary rather than tidy. Without it the images survive in
   * the bucket with nothing pointing at them: invisible to the product, unreachable through
   * it, and still photographs of somebody's home after they asked for it to be deleted. That
   * is a retention problem. **Found by inspecting the bucket after a test deleted a property
   * — two orphaned objects, exactly as described.**
   *
   * The API cannot remove them itself: that needs either the user's session (which lives in
   * the browser) or a service-role key, which must never sit in a request path keyed by a
   * user-supplied id. So it reports what to remove and the browser does it — the same
   * division of labour as `DELETE .../photos/:photoId`.
   *
   * This changes a 204 into a 200 with a body. The only caller is `/portfolio`, which is
   * updated with it; anything else treating 2xx as success is unaffected.
   */
  .delete("/properties/:id", async (c) => {
    const userId = requireUser(c.get("userId"));
    const db = c.get("db");
    const id = c.req.param("id");

    const storagePaths = await withUser(db, userId, async (tx) => {
      // Read before the delete: afterwards the cascade has already taken the rows.
      const photos = await tx
        .select({ path: propertyPhotos.storagePath })
        .from(propertyPhotos)
        .where(eq(propertyPhotos.propertyId, id));
      await tx.delete(properties).where(eq(properties.id, id));
      return photos.map((p) => p.path);
    });

    return c.json({ storagePaths });
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

  /**
   * ── Photos ──────────────────────────────────────────────────────────────
   *
   * **No image bytes pass through this API, by design.** The browser uploads straight to a
   * private Supabase Storage bucket under its own session, and these routes only maintain the
   * rows that say which objects belong to which property. Two reasons, and the second is the
   * one that would have bitten: a Vercel function's request body is capped below a modern
   * phone photo, and proxying megabytes through a serverless function to re-upload them is
   * latency and cost spent to gain nothing the browser could not do directly.
   *
   * The consequence to keep in mind: **an object can exist in the bucket with no row here** —
   * if a browser uploads and then fails to register, or the tab closes in between. That
   * orphan is invisible to the product and costs only storage. The reverse (a row with no
   * object) is the harmful one, so registration always happens *after* a successful upload,
   * and deletion removes the row first and the object second.
   */
  .get("/properties/:id/photos", async (c) => {
    const userId = requireUser(c.get("userId"));
    const db = c.get("db");
    const id = c.req.param("id");

    const rows = await withUser(db, userId, (tx) =>
      tx
        .select()
        .from(propertyPhotos)
        .where(eq(propertyPhotos.propertyId, id))
        .orderBy(asc(propertyPhotos.sortOrder), asc(propertyPhotos.createdAt)),
    );
    return c.json({ photos: rows });
  })

  .post("/properties/:id/photos", zValidator("json", registerPhotoSchema), async (c) => {
    const userId = requireUser(c.get("userId"));
    const db = c.get("db");
    const id = c.req.param("id");
    const body = c.req.valid("json");

    /**
     * The path is checked against *this* caller and *this* property, not merely against the
     * regex the schema already applied. Storage's own RLS refuses an upload outside the
     * caller's folder, so a mismatch here cannot be an attack that succeeded — but it can be
     * a row pointing at an object its owner will never be able to read, which shows up much
     * later as a photo that silently fails to load. Rejecting it now names the bug.
     */
    const [folder, propertyFolder] = body.storagePath.split("/");
    if (folder !== userId || propertyFolder !== id) {
      throw new HTTPException(400, {
        message: "storagePath must be {ownerId}/{propertyId}/{filename} for this property",
      });
    }

    const created = await withUser(db, userId, async (tx) => {
      // Confirms the property exists *and* is the caller's — RLS makes those one question.
      const [property] = await tx.select().from(properties).where(eq(properties.id, id));
      if (property === undefined) return null;

      const existing = await tx
        .select({ id: propertyPhotos.id })
        .from(propertyPhotos)
        .where(eq(propertyPhotos.propertyId, id));
      if (existing.length >= MAX_PHOTOS_PER_PROPERTY) {
        throw new HTTPException(409, {
          message: `A property can hold ${MAX_PHOTOS_PER_PROPERTY} photos; delete one first`,
        });
      }

      const [row] = await tx
        .insert(propertyPhotos)
        .values({
          propertyId: id,
          ownerId: userId,
          storagePath: body.storagePath,
          contentType: body.contentType,
          bytes: body.bytes,
          // Appended to the end. The first photo uploaded therefore becomes the cover,
          // which is what someone who uploads one photo expects and never has to ask for.
          sortOrder: existing.length,
        })
        .returning();
      return row ?? null;
    });

    if (created === null) throw new HTTPException(404, { message: "Property not found" });
    return c.json({ photo: created }, 201);
  })

  /** Reorder, which is also how a photo is promoted to cover — position 0 is the cover, so
   *  "make this the cover" and "reorder" are one operation rather than two that can disagree. */
  .patch("/properties/:id/photos", zValidator("json", reorderPhotosSchema), async (c) => {
    const userId = requireUser(c.get("userId"));
    const db = c.get("db");
    const id = c.req.param("id");
    const { photoIds } = c.req.valid("json");

    const rows = await withUser(db, userId, async (tx) => {
      const owned = await tx
        .select({ id: propertyPhotos.id })
        .from(propertyPhotos)
        .where(eq(propertyPhotos.propertyId, id));
      const ownedIds = new Set(owned.map((r) => r.id));

      /* Every id must belong to this property, and every photo must be listed. A partial
         order would leave the unlisted rows sharing a `sortOrder` with the reordered ones,
         and "the lowest sortOrder is the cover" stops being a single answer. */
      if (photoIds.length !== owned.length || photoIds.some((p) => !ownedIds.has(p))) {
        throw new HTTPException(400, {
          message: "photoIds must list every photo of this property exactly once",
        });
      }

      for (const [i, photoId] of photoIds.entries()) {
        await tx
          .update(propertyPhotos)
          .set({ sortOrder: i })
          .where(eq(propertyPhotos.id, photoId));
      }

      return tx
        .select()
        .from(propertyPhotos)
        .where(eq(propertyPhotos.propertyId, id))
        .orderBy(asc(propertyPhotos.sortOrder));
    });

    return c.json({ photos: rows });
  })

  /**
   * Removes the row and returns the object key, so the caller can delete the object itself.
   *
   * The API cannot do that second step: deleting from a private bucket needs either the
   * user's own session (which lives in the browser) or a service-role key (which this request
   * path must never hold — `.env.example` says so, and a key that bypasses RLS in a route
   * that takes a user-supplied id is exactly the wrong place for it). Row first, object
   * second: if the object delete fails the product is already consistent and what is left is
   * an orphan nobody can see.
   */
  .delete("/properties/:id/photos/:photoId", async (c) => {
    const userId = requireUser(c.get("userId"));
    const db = c.get("db");
    const photoId = c.req.param("photoId");

    const removed = await withUser(db, userId, async (tx) => {
      const [row] = await tx
        .delete(propertyPhotos)
        .where(eq(propertyPhotos.id, photoId))
        .returning();
      if (row === undefined) return null;

      // Close the gap left in the ordering, so the cover is always sortOrder 0 rather than
      // "whatever the lowest surviving number happens to be".
      const rest = await tx
        .select()
        .from(propertyPhotos)
        .where(eq(propertyPhotos.propertyId, row.propertyId))
        .orderBy(asc(propertyPhotos.sortOrder));
      for (const [i, r] of rest.entries()) {
        if (r.sortOrder !== i) {
          await tx.update(propertyPhotos).set({ sortOrder: i }).where(eq(propertyPhotos.id, r.id));
        }
      }
      return row;
    });

    if (removed === null) throw new HTTPException(404, { message: "Photo not found" });
    return c.json({ storagePath: removed.storagePath });
  })

  /**
   * ── Notes ───────────────────────────────────────────────────────────────
   *
   * Dated rows rather than one editable field, because the sequence is the point — see the table's
   * own comment in `@veela/db`. Newest first everywhere, since that is the only order either the
   * property page or the comparison ever wants.
   */
  .get("/properties/:id/notes", async (c) => {
    const userId = requireUser(c.get("userId"));
    const db = c.get("db");
    const id = c.req.param("id");

    const rows = await withUser(db, userId, (tx) =>
      tx
        .select()
        .from(propertyNotes)
        .where(eq(propertyNotes.propertyId, id))
        .orderBy(desc(propertyNotes.createdAt)),
    );
    return c.json({ notes: rows });
  })

  .post("/properties/:id/notes", zValidator("json", propertyNoteSchema), async (c) => {
    const userId = requireUser(c.get("userId"));
    const db = c.get("db");
    const id = c.req.param("id");
    const { body } = c.req.valid("json");

    const created = await withUser(db, userId, async (tx) => {
      /* Confirms the property exists *and* is the caller's — RLS makes those one question — before
         writing a note whose `ownerId` this route sets itself. Without it, a note could be created
         against somebody else's property id and then be invisible to everyone including its
         author. */
      const [property] = await tx.select().from(properties).where(eq(properties.id, id));
      if (property === undefined) return null;

      const [row] = await tx
        .insert(propertyNotes)
        .values({ propertyId: id, ownerId: userId, body })
        .returning();
      return row ?? null;
    });

    if (created === null) throw new HTTPException(404, { message: "Property not found" });
    return c.json({ note: created }, 201);
  })

  .patch("/notes/:noteId", zValidator("json", propertyNoteSchema), async (c) => {
    const userId = requireUser(c.get("userId"));
    const db = c.get("db");
    const noteId = c.req.param("noteId");
    const { body } = c.req.valid("json");

    const updated = await withUser(db, userId, async (tx) => {
      const [row] = await tx
        .update(propertyNotes)
        .set({ body, updatedAt: new Date() })
        .where(eq(propertyNotes.id, noteId))
        .returning();
      return row ?? null;
    });

    if (updated === null) throw new HTTPException(404, { message: "Note not found" });
    return c.json({ note: updated });
  })

  .delete("/notes/:noteId", async (c) => {
    const userId = requireUser(c.get("userId"));
    const db = c.get("db");
    const noteId = c.req.param("noteId");

    const removed = await withUser(db, userId, async (tx) => {
      const [row] = await tx
        .delete(propertyNotes)
        .where(eq(propertyNotes.id, noteId))
        .returning({ id: propertyNotes.id });
      return row ?? null;
    });

    if (removed === null) throw new HTTPException(404, { message: "Note not found" });
    return c.body(null, 204);
  })

  /**
   * The latest note per property, plus how many there are — what the comparison needs.
   *
   * One request rather than one per column, and it returns a *summary* rather than every note:
   * a comparison row has space for one line, and shipping a property's entire note history to
   * render its most recent line is waste that grows with use.
   *
   * `distinct on` is Postgres-specific and is the reason this is raw SQL: it takes the first row
   * of each `property_id` group under the given ordering, which is exactly "newest note per
   * property" in one pass and without a window function or a self-join.
   */
  .get("/notes/latest", async (c) => {
    const userId = requireUser(c.get("userId"));
    const db = c.get("db");

    const rows = await withUser(db, userId, (tx) =>
      tx.execute(sql`
        select distinct on (n.property_id)
          n.property_id  as "propertyId",
          n.body         as "body",
          n.created_at   as "createdAt",
          count(*) over (partition by n.property_id)::int as "total"
        from property_notes n
        where n.owner_id = ${userId}
        order by n.property_id, n.created_at desc
      `),
    );
    return c.json({ latest: rows });
  })

  /**
   * Cover photos for a whole list, in one request.
   *
   * `/portfolio` and `/portfolio/compare` both render many properties at once, and asking for
   * each one's photos separately would add an N+1 on top of the N+1 the compare page already
   * makes for verdicts. This returns only the cover of each — a list needs one image per card,
   * and fetching all twenty-four of a property's photos to show the first is waste.
   */
  .get("/photos/covers", async (c) => {
    const userId = requireUser(c.get("userId"));
    const db = c.get("db");

    const rows = await withUser(db, userId, (tx) =>
      tx
        .select()
        .from(propertyPhotos)
        .where(and(eq(propertyPhotos.ownerId, userId), eq(propertyPhotos.sortOrder, 0)))
        .orderBy(asc(propertyPhotos.createdAt)),
    );
    return c.json({ covers: rows });
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
