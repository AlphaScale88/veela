-- Where a saved property came from, when it came from the demo catalogue.
--
-- The Search page's sample listings are fabricated (`packages/fixtures/src/listings.ts`). Adding a
-- Zillow-style heart to them means one can now be saved with a click, which puts invented figures
-- into the same `properties` table as somebody's real flat — the table alerts run against and the
-- compare page reads.
--
-- ## Why a column rather than relying on the label
--
-- `listingToDraft` already labels these "2-bed sample flat — Central and Western", so a saved
-- sample is self-identifying to a reader. Two things that string cannot do:
--
-- 1. **Answer "is this listing already saved?"** The heart has to render filled or empty before
--    anything is clicked, and un-hearting has to delete *the row this listing produced* and no
--    other. Matching on a label is not an identity: three listings share a district and can share
--    a bedroom count, so the label collides by construction.
-- 2. **Survive being edited.** A label is user-editable text; the fact that a row originated in the
--    demo catalogue is not something a rename should be able to erase.
--
-- Nullable, and null is the overwhelming majority: a property typed in or imported from a real
-- listing has no demo origin. Not a foreign key — the catalogue lives in a TypeScript fixture, not
-- a table, and inventing a `demo_listings` table to point at would mean seeding fabricated data
-- into the database, which is the one thing this project has consistently refused.

alter table properties add column if not exists demo_listing_id text;

-- Partial index: the only query is "which demo listings has this owner saved", which never wants
-- the null rows and would otherwise scan past all of them.
create index if not exists properties_demo_listing_idx
  on properties (owner_id, demo_listing_id)
  where demo_listing_id is not null;
