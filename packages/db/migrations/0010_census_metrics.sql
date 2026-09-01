-- 0010 — the Census metrics the collector already parses and could not store
--
-- `market_observations.metric` had no value for the three district figures the 2021 Census
-- publishes and this repository has held, parsed, since 21/08/2026: median household rent,
-- rent as a share of income, and the public-rental share of households.
--
-- The last of those is not decoration. Wong Tai Sin's median rent is HK$2,430 against Central
-- and Western's HK$15,070, and almost none of that gap is the market — half of Wong Tai Sin's
-- households are in public rental housing. Storing the rent without the share that explains it
-- would put the most misleading number in this dataset into the database on its own.
--
-- `ALTER TYPE ... ADD VALUE` is additive and cannot invalidate an existing row. It is also
-- **irreversible**: Postgres has no DROP VALUE, so a name added here is permanent. Named in
-- the singular present tense to match the values already there.

ALTER TYPE market_metric ADD VALUE IF NOT EXISTS 'median_rent';
ALTER TYPE market_metric ADD VALUE IF NOT EXISTS 'rent_to_income';
ALTER TYPE market_metric ADD VALUE IF NOT EXISTS 'public_rental_share';

-- RVD's forecast completions, which is the only forward-looking supply figure Hong Kong
-- publishes per district and which nothing in this codebase had ever stored or drawn. Existing
-- `completions_units` records what was built; this records what is coming, so the two cannot be
-- confused by sharing a name.
ALTER TYPE market_metric ADD VALUE IF NOT EXISTS 'forecast_completions_units';
