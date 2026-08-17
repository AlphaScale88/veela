-- Notes a user writes on their own property.
--
-- ## Why a table of dated notes rather than one `notes` column
--
-- A single text column would be simpler and would satisfy "show it on the comparison". It was
-- rejected because it destroys the thing that makes notes worth having: **when you thought it.**
-- An investor's notes on a flat accumulate across a viewing, a second viewing, a conversation
-- with the agent and a mortgage quote, and the sequence is the substance. One column turns that
-- into a blob somebody has to hand-date, and an edit silently overwrites what was there before.
--
-- The comparison shows the **most recent** note per property plus a count, which is what a single
-- column would have given anyway — so the table costs nothing there and keeps the history.
--
-- ## Deliberately not a comment thread
--
-- No author column, no replies, no visibility flag. A property belongs to exactly one owner in
-- this schema and nothing is shared with anyone, so an author field could only ever hold the one
-- value `owner_id` already holds. If sharing ever exists, that is when the column earns its place.

create table if not exists property_notes (
  id          uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties (id) on delete cascade,
  -- Denormalised from `properties` for the same reason `property_photos.owner_id` is: every RLS
  -- policy below filters on it, and a policy that has to join another table to decide is both
  -- slower and easier to get wrong.
  owner_id    uuid not null references profiles (id) on delete cascade,
  body        text not null,
  created_at  timestamptz not null default now(),
  -- Set on edit. Distinct from `created_at` so a note can say "written then, revised since"
  -- rather than quietly appearing to have always said what it now says.
  updated_at  timestamptz not null default now(),

  -- A note has to have content; an empty note is a row nobody meant to create. Length bounded
  -- because this is rendered on a comparison table, and because unbounded user text in a column
  -- is how a page becomes unusable rather than expressive.
  constraint property_notes_body_not_blank check (length(btrim(body)) > 0),
  constraint property_notes_body_bounded check (length(body) <= 4000)
);

-- Newest first is the only order this is ever read in, on both the property page and the
-- comparison's "latest note" lookup.
create index if not exists property_notes_property_idx
  on property_notes (property_id, created_at desc);
create index if not exists property_notes_owner_idx on property_notes (owner_id);

alter table property_notes enable row level security;

drop policy if exists property_notes_select_own on property_notes;
create policy property_notes_select_own on property_notes
  for select using (owner_id = auth.uid());

drop policy if exists property_notes_insert_own on property_notes;
create policy property_notes_insert_own on property_notes
  for insert with check (owner_id = auth.uid());

drop policy if exists property_notes_update_own on property_notes;
create policy property_notes_update_own on property_notes
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists property_notes_delete_own on property_notes;
create policy property_notes_delete_own on property_notes
  for delete using (owner_id = auth.uid());
