-- 0011 — make `rvd_class` usable, and stop the Census sitting on two dates
--
-- Two independent corrections, both found by reading what the table actually holds rather
-- than what the ingest script reports having written.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. The key could not tell two Classes apart
-- ─────────────────────────────────────────────────────────────────────────────
--
-- `rvd_class` has carried the comment "null means the metric is published for the whole
-- district, all classes" since the first migration, and it is **not in the primary key**.
-- So two rows differing only by Class collide, and every class-split figure RVD publishes
-- per district has been unstorable since the column was created. All 198 existing rows
-- carry null, which is why nothing has failed yet.
--
-- What that has been costing: `Private_Dom_Stock_by_District_Eng.csv` is stock by district
-- **and Class** — Wan Chai is 24,819 Class A and 3,552 Class E, not one number — and the
-- collector has been fetching that file and keeping only the total. Same for forecast
-- completions, which RVD also publishes per Class.
--
-- A primary key cannot contain a nullable column. Making `rvd_class` NOT NULL with an 'ALL'
-- sentinel would work and would change what null means for every existing reader and every
-- existing row. A unique index over the same four columns plus the coalesced class keeps
-- null meaning exactly what it has always meant, and touches no data.
--
-- The consequence to know about: the table now has a unique key and no PRIMARY KEY. Nothing
-- here depends on one — this table is read through Drizzle and hand-written SQL, never
-- through PostgREST's row identity — and RLS is unaffected.

alter table market_observations drop constraint market_observations_pk;

create unique index market_observations_key
  on market_observations (
    district_id, metric, kind, period_start, (coalesce(rvd_class::text, '*'))
  );

-- An upsert must name this expression exactly as written above, or Postgres cannot infer the
-- index and the insert fails at runtime rather than at deploy time:
--
--   on conflict (district_id, metric, kind, period_start, (coalesce(rvd_class::text, '*')))

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Houses are not flats, and RVD counts them separately
-- ─────────────────────────────────────────────────────────────────────────────
--
-- `Dom_Stock_and_Completions_of_Houses_by_District_Eng.csv` is a genuine per-district series
-- and cannot reuse `stock_units`: that metric already holds the flat count for the same
-- district, period and kind, so the two would collide on the key above and, worse, would
-- silently overwrite each other. 19,741 houses against 1.29 million flats — small, real, and
-- concentrated almost entirely in the New Territories, which is itself the useful fact.
--
-- `ALTER TYPE ... ADD VALUE` is irreversible: Postgres has no DROP VALUE.

alter type market_metric add value if not exists 'house_stock_units';
alter type market_metric add value if not exists 'house_completions_units';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. One census, two dates
-- ─────────────────────────────────────────────────────────────────────────────
--
-- `households` exists 36 times across 18 districts: once at 2021-01-01 from an early ingest
-- and once at 2021-06-30 from the collector, with identical values. The API's
-- `distinct on (metric)` picks the later one, so the screen has been right and the table has
-- been carrying eighteen redundant rows.
--
-- 2021-06-30 is kept because it is the Census reference moment and because the other three
-- census metrics already sit there. `population` is moved onto the same date for the same
-- reason: two figures from one survey should not appear to have been measured six months
-- apart. Both render as "2021" either way, so nothing on screen changes — this is about the
-- table telling the truth about when the observation was made.

delete from market_observations
where metric = 'households' and period_start = date '2021-01-01';

update market_observations
set period_start = date '2021-06-30'
where metric = 'population' and period_start = date '2021-01-01';
