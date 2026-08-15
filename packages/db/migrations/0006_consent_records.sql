-- ═══════════════════════════════════════════════════════════════════════════
-- Consent records — evidence of what a user agreed to, and when.
--
-- The PDPO's DPP1 wants notice at or before collection, and this repo's own
-- notes have warned from the start that retrofitting consent is impossible.
-- Until now signup linked to /privacy in passing; nothing was presented for
-- acceptance and nothing was recorded. This is the record.
--
-- ## Append-only, one row per (user, document, version)
--
-- Never updated, never deleted except by the cascade when an account goes. The
-- question this table answers is historical — "what did they agree to, when" —
-- and a row that gets overwritten when the terms change destroys exactly the
-- evidence it exists to hold. A user who accepts v1 and later v2 has two rows,
-- which is the truth.
--
-- The unique constraint makes re-acceptance idempotent: a double-submitted form
-- or a page refresh cannot manufacture a second record of the same event.
--
-- ## Deliberately no IP address or user agent
--
-- Both are commonly stored as "consent evidence". Neither is stored here.
-- user_id + document + version + timestamp already identifies the person, the
-- exact wording and the moment — the evidentiary value of adding an IP is
-- marginal, while the cost is concrete: an IP address is itself personal data,
-- so collecting it creates a new disclosure obligation on the very page whose
-- acceptance is being recorded. Under DPP1's own minimisation principle,
-- collecting less to prove the same thing is the better answer.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists consent_records (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users (id) on delete cascade,
  -- 'terms' | 'privacy' — mirrored in packages/types/src/legal.ts, which is the
  -- source of truth for which versions are currently in force.
  document    text        not null,
  version     text        not null,
  accepted_at timestamptz not null default now(),
  constraint consent_records_unique unique (user_id, document, version)
);

create index if not exists consent_records_user_idx on consent_records (user_id);

alter table consent_records enable row level security;

-- A user may read their own record — "what did I agree to" is a DPP6 access
-- question and should not require an email to us.
drop policy if exists consent_records_owner_select on consent_records;
create policy consent_records_owner_select on consent_records
  for select using (user_id = auth.uid());

-- No insert/update/delete policy on purpose: writes go through the service-side
-- connection, which bypasses RLS. A client that could write its own consent
-- record could also forge one, and the whole point of this table is that it is
-- evidence rather than a preference.
