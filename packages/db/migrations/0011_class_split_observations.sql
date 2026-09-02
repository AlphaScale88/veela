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
-- existing row.
--
-- `NULLS NOT DISTINCT` is the feature that makes this a one-line change instead: it tells the
-- index to treat two null classes as equal, which is exactly the existing semantics — "the
-- figure for the whole district" is one row, not many. Postgres 15 and later; this project
-- runs 17.6, checked rather than assumed.
--
-- **The first attempt was `(coalesce(rvd_class::text, '*'))` and it does not work.** Postgres
-- refuses it: `functions in index expression must be marked IMMUTABLE`, because an enum-to-text
-- cast is only STABLE — enum labels can be renamed, so the cast's output is not fixed for all
-- time. That failure left the table with no unique key at all for as long as it took to
-- replace, which is the argument for `--dry-run` and for reading a runner's output rather than
-- its exit code. Recorded because the coalesce form is the obvious first idea and it is wrong.
--
-- The consequence to know about: the table now has a unique key and no PRIMARY KEY. Nothing
-- here depends on one — this table is read through Drizzle and hand-written SQL, never through
-- PostgREST's row identity — and RLS is unaffected.

alter table market_observations drop constraint market_observations_pk;

create unique index market_observations_key
  on market_observations (district_id, metric, kind, period_start, rvd_class)
  nulls not distinct;

-- An upsert names the plain column list, no expression:
--
--   on conflict (district_id, metric, kind, period_start, rvd_class)
--
-- Verified against the live table rather than reasoned about: re-inserting an existing
-- population row, whose `rvd_class` is null, is refused. With the default NULLS DISTINCT it
-- would have succeeded and quietly duplicated every all-classes figure in the table.

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
