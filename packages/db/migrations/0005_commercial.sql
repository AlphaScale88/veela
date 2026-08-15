-- ═══════════════════════════════════════════════════════════════════════════
-- The commercial layer: rate limits, API keys, and metering.
--
-- Three things this product needs before it can charge anyone, and the first
-- two were already named in CLAUDE.md's "Not production-ready yet" list:
--
--   1. Rate limiting. `/chat` spends real tokens and `/verdict/preview` runs the
--      engine, both public and unauthenticated and unlimited. That is a bill and
--      a denial-of-service waiting to happen, and it must exist before anything
--      is metered — you cannot sell a quota you do not enforce.
--   2. API keys. The tax engine is the asset ("the part a competitor can't
--      scrape"); an API is how it gets sold to the banks, brokers and agencies
--      that need correct stamp duty far more often than any individual investor.
--   3. Usage records, because a B2B contract is priced on calls and nobody pays
--      an invoice they cannot audit.
--
-- ## Why Postgres and not Redis
--
-- The obvious tool is Upstash/Redis, and it would be faster. It would also add a
-- second stateful dependency, a second account, and a second thing to configure
-- before the app runs — against a project rule that everything degrades
-- gracefully with zero configuration. Postgres is already here, already has RLS,
-- and at the volumes this product will see for a long while (tens of thousands of
-- transactions a year in the entire Hong Kong market) a counter row per window is
-- not the bottleneck. Revisit when it is.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Rate limiting ──────────────────────────────────────────────────────────
-- One row per (bucket, window). `bucket` is a caller identity: "ip:1.2.3.4",
-- "user:<uuid>", or "key:<id>". Fixed windows rather than a sliding log: a
-- sliding window needs a row per request, which is the expensive design, and the
-- edge case it fixes (a burst straddling a boundary) is not worth that here.
create table if not exists rate_limits (
  bucket        text        not null,
  window_start  timestamptz not null,
  count         integer     not null default 0,
  constraint rate_limits_pk primary key (bucket, window_start)
);

-- Lets the sweep drop expired windows without scanning buckets.
create index if not exists rate_limits_window_idx on rate_limits (window_start);

-- Counters are written by the service connection only; nothing client-side has
-- any business reading another caller's usage.
alter table rate_limits enable row level security;

-- ── API keys ───────────────────────────────────────────────────────────────
-- **Only a hash is stored.** The plaintext key is shown once, at creation, and is
-- unrecoverable afterwards — the same discipline as a password. A leaked database
-- must not hand over working credentials to a paid API.
create table if not exists api_keys (
  id            uuid        primary key default gen_random_uuid(),
  owner_id      uuid        not null references auth.users (id) on delete cascade,
  -- sha256 of the plaintext key, hex. Unique so a lookup is one indexed probe.
  key_hash      text        not null unique,
  -- First 12 chars ("vk_live_ab12"), so a customer can tell their keys apart in a
  -- list without either party holding the secret.
  key_prefix    text        not null,
  name          text        not null,
  -- free | starter | pro — mirrored in `packages/api/src/plans.ts`, which is the
  -- source of truth for what each tier actually allows.
  plan          text        not null default 'free',
  monthly_quota integer     not null default 1000,
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz,
  revoked_at    timestamptz
);

create index if not exists api_keys_owner_idx on api_keys (owner_id);

alter table api_keys enable row level security;

-- A customer may see and revoke their own keys — never the hash of anyone else's.
drop policy if exists api_keys_owner_select on api_keys;
create policy api_keys_owner_select on api_keys
  for select using (owner_id = auth.uid());

drop policy if exists api_keys_owner_update on api_keys;
create policy api_keys_owner_update on api_keys
  for update using (owner_id = auth.uid());

-- ── Metering ───────────────────────────────────────────────────────────────
-- Aggregated per key per day rather than one row per call. A per-call log is an
-- audit trail nobody asked for and a table that grows without bound; a daily
-- counter is what an invoice is actually built from.
create table if not exists api_usage (
  key_id  uuid    not null references api_keys (id) on delete cascade,
  day     date    not null,
  route   text    not null,
  calls   integer not null default 0,
  constraint api_usage_pk primary key (key_id, day, route)
);

create index if not exists api_usage_day_idx on api_usage (day);

alter table api_usage enable row level security;

drop policy if exists api_usage_owner_select on api_usage;
create policy api_usage_owner_select on api_usage
  for select using (
    exists (select 1 from api_keys k where k.id = api_usage.key_id and k.owner_id = auth.uid())
  );
