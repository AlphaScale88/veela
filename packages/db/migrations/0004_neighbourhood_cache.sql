-- ═══════════════════════════════════════════════════════════════════════════
-- Cache for the neighbourhood lookup.
--
-- Overpass is a shared community service: slow when it works (2-10s measured),
-- and it returns 429/504 or a plain HTML error page when busy. In production that
-- surfaced to users as "Could not reach OpenStreetMap" roughly half the time.
--
-- Two things this fixes, not one:
--   1. Latency. A repeat lookup for a point already seen is a single indexed read.
--   2. Availability. When Overpass is down we can serve what we already have, and
--      say how old it is, instead of showing an error where a neighbourhood should
--      be. A month-old school list is worth far more than a red sentence.
--
-- Keyed on coordinates rounded to 3 decimal places (~110m in latitude). Amenities
-- within an 800-900m radius barely differ across 110m, so this collapses every
-- flat in a building — and usually every building on a street — onto one row,
-- which is what makes the cache actually hit. Storing full precision would make
-- each of the 54 flats in an estate its own miss.
--
-- `payload` is the whole response body as returned. Denormalised on purpose: this
-- is a cache of an external service's answer, not a model of amenities, and
-- normalising it would create a second schema to keep in step with OSM's tags.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists neighbourhood_cache (
  -- The rounded key, stored explicitly rather than computed, so the primary key is
  -- stable regardless of how any future caller rounds.
  lat_key   numeric(6, 3) not null,
  lng_key   numeric(7, 3) not null,
  payload   jsonb         not null,
  fetched_at timestamptz  not null default now(),
  constraint neighbourhood_cache_pk primary key (lat_key, lng_key)
);

-- Lets a sweep find stale rows without scanning the payloads.
create index if not exists neighbourhood_cache_fetched_idx
  on neighbourhood_cache (fetched_at);

-- Public read, like the rest of the reference layer: the data is public, the lookup
-- is unauthenticated, and RLS is enabled on every table in this schema by rule
-- (see 0001). Writes go through the service-side connection, which bypasses RLS.
alter table neighbourhood_cache enable row level security;

drop policy if exists neighbourhood_cache_public_read on neighbourhood_cache;
create policy neighbourhood_cache_public_read on neighbourhood_cache
  for select using (true);
