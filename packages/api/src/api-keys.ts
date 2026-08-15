/**
 * API keys: issue, verify, meter, revoke.
 *
 * The tax engine is the thing a competitor cannot scrape — the AVD table transcribed verbatim
 * from the IRD, versioned by transaction date, tested at every marginal-relief boundary. This
 * file is how that gets sold to the banks, brokers, agencies and developers who need correct
 * Hong Kong stamp duty far more often than any one investor does, and who are worth roughly a
 * hundred times more each.
 *
 * ## Only a hash is stored, and the plaintext is shown exactly once
 *
 * `api_keys.key_hash` holds sha256 of the key; the key itself is returned by `createKey` and
 * then unrecoverable. A leaked database must not hand an attacker working credentials to a
 * paid API — the same reasoning as a password, and worth the small support cost of "I lost my
 * key" being answered with "revoke it and take a new one".
 *
 * `key_prefix` (the first 12 characters) is stored in clear so a customer with four keys can
 * tell which is which in a list, without either side holding the secret.
 *
 * ## Why sha256 and not bcrypt
 *
 * A password is low-entropy and human-chosen, so it needs a deliberately slow hash to survive
 * an offline guessing attack. **An API key is 32 bytes from a CSPRNG.** There is nothing to
 * guess, and a slow KDF on every single API call would be a self-inflicted latency tax on the
 * hot path of the product being sold. Fast hash, high entropy — the standard trade for
 * machine credentials, and the opposite of the right answer for passwords.
 */

import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import { sql } from "drizzle-orm";

import type { Database } from "@veela/db";
import { planFor, type Plan } from "./plans.js";

/** `vk` for Veela key; `live` leaves room for a `test` mode when payments arrive. */
const KEY_PREFIX = "vk_live_";

export interface IssuedKey {
  readonly id: string;
  /** Shown once. Never retrievable again. */
  readonly key: string;
  readonly prefix: string;
}

export interface KeyRecord {
  readonly id: string;
  readonly ownerId: string;
  readonly name: string;
  readonly plan: Plan;
  readonly monthlyQuota: number;
}

function hash(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export async function createKey(
  db: Database,
  ownerId: string,
  name: string,
  planId: string,
): Promise<IssuedKey> {
  // 32 bytes of CSPRNG, base64url — no padding or `+/` to be mangled by a shell, a header or
  // a copy-paste out of a dashboard.
  const secret = randomBytes(32).toString("base64url");
  const key = `${KEY_PREFIX}${secret}`;
  const plan = planFor(planId);

  const rows = (await db.execute(sql`
    insert into api_keys (owner_id, key_hash, key_prefix, name, plan, monthly_quota)
    values (${ownerId}, ${hash(key)}, ${key.slice(0, 12)}, ${name}, ${plan.id}, ${plan.monthlyQuota})
    returning id
  `)) as unknown as { id: string }[];

  const id = rows[0]?.id;
  if (id === undefined) throw new Error("Key insert returned no row");
  return { id, key, prefix: key.slice(0, 12) };
}

/**
 * Resolve a bearer token to a key record, or `null`.
 *
 * The lookup is by hash, which is an indexed unique probe — the `timingSafeEqual` below is
 * belt-and-braces on top of that, comparing the digest we looked up against the digest we
 * computed so that even the final comparison does not leak via timing. It cannot leak much
 * (the index probe already happened) but it costs nothing.
 */
export async function verifyKey(db: Database, presented: string): Promise<KeyRecord | null> {
  if (!presented.startsWith(KEY_PREFIX)) return null;
  const digest = hash(presented);

  const rows = (await db.execute(sql`
    select id, owner_id, name, plan, monthly_quota, key_hash
    from api_keys
    where key_hash = ${digest} and revoked_at is null
    limit 1
  `)) as unknown as {
    id: string;
    owner_id: string;
    name: string;
    plan: string;
    monthly_quota: number;
    key_hash: string;
  }[];

  const row = rows[0];
  if (row === undefined) return null;

  const a = Buffer.from(row.key_hash, "hex");
  const b = Buffer.from(digest, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  // Fire-and-forget: "when was this key last seen" is worth having in a dashboard and is
  // never worth failing an API call over.
  void db
    .execute(sql`update api_keys set last_used_at = now() where id = ${row.id}`)
    .catch(() => undefined);

  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    plan: planFor(row.plan),
    monthlyQuota: row.monthly_quota,
  };
}

export interface QuotaVerdict {
  readonly withinQuota: boolean;
  readonly usedThisMonth: number;
  readonly quota: number;
}

/**
 * Record one call and report the month's usage.
 *
 * Aggregated per key per day per route rather than a row per call: an invoice is built from
 * counts, and a per-call log is an unbounded table plus a privacy question nobody asked for.
 * The daily grain is what lets a customer see "which endpoint am I actually spending on".
 */
export async function meter(
  db: Database,
  keyId: string,
  route: string,
  quota: number,
): Promise<QuotaVerdict> {
  try {
    await db.execute(sql`
      insert into api_usage (key_id, day, route, calls)
      values (${keyId}, current_date, ${route}, 1)
      on conflict (key_id, day, route) do update set calls = api_usage.calls + 1
    `);

    const rows = (await db.execute(sql`
      select coalesce(sum(calls), 0)::int as used
      from api_usage
      where key_id = ${keyId} and day >= date_trunc('month', current_date)
    `)) as unknown as { used: number }[];

    const used = Number(rows[0]?.used ?? 0);
    return { withinQuota: used <= quota, usedThisMonth: used, quota };
  } catch (cause) {
    // Same call as the rate limiter: never take a paying customer's integration down because
    // the meter had a bad moment. Under-billing is recoverable; an outage is not.
    console.warn(
      `[meter] usage write failed, allowing call: ${
        cause instanceof Error ? cause.message : "unknown"
      }`,
    );
    return { withinQuota: true, usedThisMonth: 0, quota };
  }
}

export async function listKeys(
  db: Database,
  ownerId: string,
): Promise<
  readonly {
    id: string;
    prefix: string;
    name: string;
    plan: string;
    createdAt: string;
    lastUsedAt: string | null;
    revokedAt: string | null;
    usedThisMonth: number;
  }[]
> {
  const rows = (await db.execute(sql`
    select k.id, k.key_prefix, k.name, k.plan, k.created_at, k.last_used_at, k.revoked_at,
           coalesce((
             select sum(u.calls)::int from api_usage u
             where u.key_id = k.id and u.day >= date_trunc('month', current_date)
           ), 0) as used_this_month
    from api_keys k
    where k.owner_id = ${ownerId}
    order by k.created_at desc
  `)) as unknown as Record<string, unknown>[];

  return rows.map((r) => ({
    id: String(r["id"]),
    prefix: String(r["key_prefix"]),
    name: String(r["name"]),
    plan: String(r["plan"]),
    createdAt: String(r["created_at"]),
    lastUsedAt: r["last_used_at"] === null ? null : String(r["last_used_at"]),
    revokedAt: r["revoked_at"] === null ? null : String(r["revoked_at"]),
    usedThisMonth: Number(r["used_this_month"] ?? 0),
  }));
}

/** Revocation is a timestamp, not a delete: the usage rows behind an invoice must survive the
 *  key being turned off, and "when did this stop working" is the first question asked when an
 *  integration breaks. */
export async function revokeKey(db: Database, ownerId: string, keyId: string): Promise<boolean> {
  const rows = (await db.execute(sql`
    update api_keys set revoked_at = now()
    where id = ${keyId} and owner_id = ${ownerId} and revoked_at is null
    returning id
  `)) as unknown as { id: string }[];
  return rows.length > 0;
}
