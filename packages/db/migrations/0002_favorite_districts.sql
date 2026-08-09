-- ═══════════════════════════════════════════════════════════════════════════
-- Adds profiles.favorite_districts — "My Favorite Markets".
--
-- Hand-written rather than `drizzle-kit generate`: this project has no migration
-- journal checked in (only 0001_postgis_and_rls.sql, itself hand-written for the
-- PostGIS/RLS pieces Drizzle can't express), so `generate` has no baseline to diff
-- against and would try to recreate every table from scratch. A single, surgical
-- `ALTER TABLE` is the safe move until the journal gap is fixed deliberately, not
-- as a side effect of adding one column.
-- ═══════════════════════════════════════════════════════════════════════════

alter table profiles
  add column if not exists favorite_districts jsonb not null default '[]'::jsonb;
