-- ═══════════════════════════════════════════════════════════════════════════
-- Building identity, so the address-lookup search can upsert instead of
-- accumulating a duplicate row per search.
--
-- `estates` already has UNIQUE (district_id, name_en). `buildings` had no
-- uniqueness at all, which was fine while nothing wrote to it — the table was
-- reserved for a bulk Lands Department ingestion that has not happened. It is now
-- written to live, once per address returned by the Address Lookup Service, so it
-- needs a key.
--
-- (district_id, name_en) rather than name alone: building and street names repeat
-- across Hong Kong ("Fire Station", "Block A"), and the district is the coarsest
-- thing the lookup service always returns. Partial index because `name_en` is
-- nullable — a footprint ingested later with no name must still be insertable, and
-- NULLs are not equal to each other in a unique index anyway.
-- ═══════════════════════════════════════════════════════════════════════════

create unique index if not exists buildings_district_name_uq
  on buildings (district_id, name_en)
  where name_en is not null;

-- Where a row came from now matters, because two very different pipelines write
-- here: 'landsd-openmap' (the bulk footprint ingestion, still unbuilt) and
-- 'als.gov.hk' (live, per search). The column already exists with the former as
-- its default; this only documents that the default is no longer the only value.
comment on column buildings.source is
  'Provenance. landsd-openmap = bulk footprint ingestion; als.gov.hk = Address Lookup Service, resolved live during a building search.';
