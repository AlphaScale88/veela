-- ═══════════════════════════════════════════════════════════════════════════
-- PostGIS geometry columns + Row-Level Security on EVERY table.
--
-- Drizzle generates the tables; this migration adds what it can't express:
--   1. real PostGIS geometry types and GiST indexes
--   2. RLS policies
--
-- The workspace rule is "enforce RLS on EVERY table, never rely on client-side
-- checks". Reference tables get a permissive read policy rather than no policy at
-- all, so that enabling RLS everywhere is verifiable: a table with RLS disabled is
-- a bug, whereas a table with an explicit public-read policy is a decision.
-- ═══════════════════════════════════════════════════════════════════════════

create extension if not exists postgis;

-- ── 1. Geometry columns ────────────────────────────────────────────────────
-- Drizzle models these as text; swap them for real geometry so PostGIS operators
-- and GiST indexes work.

alter table districts
  alter column boundary type geometry(MultiPolygon, 4326)
  using boundary::geometry(MultiPolygon, 4326);

alter table buildings
  alter column footprint type geometry(Polygon, 4326)
  using footprint::geometry(Polygon, 4326);

alter table buildings
  alter column centroid type geometry(Point, 4326)
  using centroid::geometry(Point, 4326);

create index districts_boundary_gix on districts using gist (boundary);
create index buildings_footprint_gix on buildings using gist (footprint);
create index buildings_centroid_gix  on buildings using gist (centroid);

-- Keep the centroid in step with the footprint automatically; the map queries it.
create or replace function buildings_set_centroid() returns trigger
language plpgsql as $$
begin
  if new.footprint is not null then
    new.centroid := st_centroid(new.footprint);
  end if;
  return new;
end;
$$;

create trigger buildings_centroid_trg
  before insert or update of footprint on buildings
  for each row execute function buildings_set_centroid();

-- ── 2. Profile provisioning ────────────────────────────────────────────────
-- Supabase owns auth.users; mirror new signups into profiles.

create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'display_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ── 3. RLS: user-owned data ────────────────────────────────────────────────

alter table profiles   enable row level security;
alter table properties enable row level security;
alter table verdicts   enable row level security;

create policy profiles_select_own on profiles
  for select using (id = auth.uid());
create policy profiles_update_own on profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- A property is readable, writable and deletable only by its owner. `with check`
-- on insert prevents a client from creating rows owned by someone else.
create policy properties_select_own on properties
  for select using (owner_id = auth.uid());
create policy properties_insert_own on properties
  for insert with check (owner_id = auth.uid());
create policy properties_update_own on properties
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy properties_delete_own on properties
  for delete using (owner_id = auth.uid());

create policy verdicts_select_own on verdicts
  for select using (owner_id = auth.uid());
create policy verdicts_insert_own on verdicts
  for insert with check (owner_id = auth.uid());
create policy verdicts_delete_own on verdicts
  for delete using (owner_id = auth.uid());

-- ── 4. RLS: public reference data ──────────────────────────────────────────
-- Readable by anyone, including anonymous visitors browsing the map. Writable only
-- by the service role, which bypasses RLS — so no write policy is defined at all.

alter table districts            enable row level security;
alter table buildings            enable row level security;
alter table estates              enable row level security;
alter table market_observations  enable row level security;

create policy districts_public_read           on districts           for select using (true);
create policy buildings_public_read           on buildings           for select using (true);
create policy estates_public_read             on estates             for select using (true);
create policy market_observations_public_read on market_observations for select using (true);

-- ── 5. Guard: fail loudly if a table ever ships without RLS ────────────────
-- Run this in CI. It is cheaper than discovering an open table in production.

create or replace function assert_rls_everywhere() returns void
language plpgsql as $$
declare
  offenders text;
begin
  select string_agg(c.relname, ', ')
    into offenders
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and not c.relrowsecurity;

  if offenders is not null then
    raise exception 'Tables without RLS: %', offenders;
  end if;
end;
$$;
