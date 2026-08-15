/**
 * Fixed-window rate limiting, backed by the Postgres that is already here.
 *
 * `/chat` spends real model tokens and `/verdict/preview` runs the engine — both public,
 * unauthenticated and, until now, unlimited. That was the first item on this project's own
 * "not production-ready" list, and it is a hard prerequisite for charging anyone: **a quota
 * you do not enforce is not a quota.**
 *
 * ## The design, and what it deliberately is not
 *
 * One row per (bucket, window), incremented atomically by the insert itself:
 *
 *     insert … values (bucket, window, 1)
 *     on conflict (bucket, window) do update set count = rate_limits.count + 1
 *     returning count
 *
 * The count comes back from the same statement that wrote it, so there is no read-then-write
 * race between concurrent serverless invocations — which is exactly the race an in-memory
 * counter cannot avoid, and why in-memory was not an option: every Vercel lambda would keep
 * its own private tally and the real limit would be `N × instances`.
 *
 * **Fixed windows, not a sliding log.** A sliding log needs a row per request; a fixed window
 * needs one row per caller per minute. The cost is a burst straddling a boundary being able to
 * spend two windows' allowance — which for a product protecting a token bill, rather than a
 * trading API, is not worth an order of magnitude more writes.
 *
 * ## Failing open, on purpose
 *
 * If the database is unreachable the limiter **allows** the request. A rate limiter that takes
 * the whole product down when its own storage blips has caused more damage than the abuse it
 * was guarding against. The failure is logged; the reader still gets their report. The one
 * thing this must never do is fail *closed* on the free tier and make the app look broken.
 */

import { sql } from "drizzle-orm";

import type { Database } from "@veela/db";

export interface RateVerdict {
  readonly allowed: boolean;
  /** Calls used in the current window, after counting this one. */
  readonly used: number;
  readonly limit: number;
  /** Seconds until the window rolls over — sent as `Retry-After`. */
  readonly resetSeconds: number;
}

/**
 * Count one call against `bucket` and say whether it is allowed.
 *
 * `bucket` is a caller identity, prefixed by kind so an IP can never collide with a user id
 * or an API key: `ip:203.0.113.7`, `user:<uuid>`, `key:<uuid>`. Callers should scope it per
 * route family too when limits differ — see `AI_RATE_PER_MINUTE`, which is far tighter than
 * the engine's because those calls cost money rather than CPU.
 */
export async function consume(
  db: Database,
  bucket: string,
  limitPerMinute: number,
): Promise<RateVerdict> {
  const now = Date.now();
  const windowMs = 60_000;
  const windowStart = new Date(Math.floor(now / windowMs) * windowMs);
  const resetSeconds = Math.ceil((windowStart.getTime() + windowMs - now) / 1000);

  try {
    const rows = (await db.execute(sql`
      insert into rate_limits (bucket, window_start, count)
      values (${bucket}, ${windowStart.toISOString()}, 1)
      on conflict (bucket, window_start)
      do update set count = rate_limits.count + 1
      returning count
    `)) as unknown as { count: number }[];

    const used = Number(rows[0]?.count ?? 1);
    return { allowed: used <= limitPerMinute, used, limit: limitPerMinute, resetSeconds };
  } catch (cause) {
    // Fail open — see the header. Logged so a persistent outage is visible rather than a
    // silent removal of every limit in the product.
    console.warn(
      `[rate-limit] storage unavailable, allowing request: ${
        cause instanceof Error ? cause.message : "unknown"
      }`,
    );
    return { allowed: true, used: 0, limit: limitPerMinute, resetSeconds };
  }
}

/**
 * Best-effort identity for an unauthenticated caller.
 *
 * Behind Vercel the client address is in `x-forwarded-for`, whose **first** entry is the
 * original client and the rest are proxies — taking the last would bucket every visitor onto
 * one edge node and rate-limit the whole world together.
 *
 * An IP is a weak identity: shared office NAT puts colleagues in one bucket, and mobile
 * networks rotate. That is tolerable here because the limits protect a bill, not a security
 * boundary, and because anything genuinely valuable sits behind either a session or an API
 * key, both of which produce a far better bucket than this.
 */
export function callerIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded !== null && forwarded.trim() !== "") {
    const first = forwarded.split(",")[0]?.trim();
    if (first !== undefined && first !== "") return first;
  }
  return headers.get("x-real-ip") ?? "unknown";
}

/** Deletes windows nobody can still be inside. Cheap, and called opportunistically rather
 *  than on a schedule this project does not have — a cron for a table of minute-old counters
 *  would be more infrastructure than the problem deserves. */
export async function sweepRateLimits(db: Database): Promise<void> {
  try {
    await db.execute(sql`delete from rate_limits where window_start < now() - interval '10 minutes'`);
  } catch {
    // Housekeeping. Never worth failing a request over.
  }
}
