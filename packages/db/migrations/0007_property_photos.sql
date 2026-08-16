-- Photographs of a user's own property, and the link a property was imported from.
--
-- ## Why a table and not a `jsonb` column on `properties`
--
-- `favorite_districts` is a plain `jsonb` array on `profiles` precisely because there is no
-- per-favourite metadata to justify a join table. A photo is the opposite case: it has a
-- storage path, a content type, a byte count, an ordering and its own lifetime — it can be
-- deleted while the property stays. That is a row.
--
-- ## Why Supabase Storage rather than bytes in Postgres
--
-- A `bytea` column would put multi-megabyte images through the same pooled connection that
-- serves every report, and through a Vercel function whose request body is capped well below
-- a modern phone photo. Storage also gives the browser a direct upload path, so image bytes
-- never touch our API at all.
--
-- ## Why the bucket is PRIVATE
--
-- These are photographs of where somebody lives, uploaded to a product that already collects
-- their price, their mortgage and their address. That is personal data under the PDPO, and a
-- public bucket protects it only by the unguessability of a URL — which survives exactly
-- until one is pasted somewhere. Reads go through short-lived signed URLs instead. The cost
-- is that a URL expires, which is the correct trade for this content.

create table if not exists property_photos (
  id            uuid primary key default gen_random_uuid(),
  property_id   uuid not null references properties (id) on delete cascade,
  -- Denormalised from `properties` on purpose: every RLS policy below filters on it, and a
  -- policy that has to join to another table to decide is both slower and easier to get
  -- wrong. It is enforced against the parent by the API, which sets both from one row.
  owner_id      uuid not null references profiles (id) on delete cascade,
  -- The object key inside the bucket: `{owner_id}/{property_id}/{uuid}.{ext}`. The storage
  -- policies below depend on that first segment being the owner, so it is not free-form.
  storage_path  text not null unique,
  content_type  text not null,
  bytes         integer not null,
  -- Explicit ordering rather than relying on `created_at`, so a photo can be promoted to the
  -- cover without being re-uploaded. The lowest `sort_order` is the cover; there is no
  -- separate `is_cover` flag to fall out of step with it.
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),

  constraint property_photos_bytes_positive check (bytes > 0),
  constraint property_photos_type_is_image check (content_type like 'image/%')
);

create index if not exists property_photos_property_idx on property_photos (property_id, sort_order);
create index if not exists property_photos_owner_idx on property_photos (owner_id);

alter table property_photos enable row level security;

-- Same shape as every other owner-scoped policy in 0001: the row is yours or it does not
-- exist as far as Postgres is concerned.
drop policy if exists property_photos_select_own on property_photos;
create policy property_photos_select_own on property_photos
  for select using (owner_id = auth.uid());

drop policy if exists property_photos_insert_own on property_photos;
create policy property_photos_insert_own on property_photos
  for insert with check (owner_id = auth.uid());

drop policy if exists property_photos_update_own on property_photos;
create policy property_photos_update_own on property_photos
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists property_photos_delete_own on property_photos;
create policy property_photos_delete_own on property_photos
  for delete using (owner_id = auth.uid());

-- ────────────────────────────────────────────────────────────────────────────
-- Where a property came from
-- ────────────────────────────────────────────────────────────────────────────
--
-- The listing importer already reads a source URL, an address and coordinates, and every one
-- of them was thrown away at the form boundary — a property imported from a link was
-- indistinguishable, once saved, from one typed in by hand. These three columns are what let
-- a saved property say "this came from that listing, on that day", which is also the only way
-- to go back and check a figure that is now months old.
--
-- Nullable, all of them: a property typed in by hand has no source, and most Hong Kong
-- portals publish no coordinates.

alter table properties add column if not exists source_url text;
alter table properties add column if not exists address text;
alter table properties add column if not exists latitude double precision;
alter table properties add column if not exists longitude double precision;

-- ────────────────────────────────────────────────────────────────────────────
-- The storage bucket
-- ────────────────────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'property-photos',
  'property-photos',
  false,
  10485760, -- 10 MB; a phone photo fits, a raw file does not
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Object-level RLS. The bucket is private, so *every* read is a signed URL and every signature
-- is issued against these policies — the check is `the first folder is your own user id`,
-- which is why the path convention above is a contract and not a naming preference.
drop policy if exists property_photos_objects_select on storage.objects;
create policy property_photos_objects_select on storage.objects
  for select using (
    bucket_id = 'property-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists property_photos_objects_insert on storage.objects;
create policy property_photos_objects_insert on storage.objects
  for insert with check (
    bucket_id = 'property-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists property_photos_objects_delete on storage.objects;
create policy property_photos_objects_delete on storage.objects
  for delete using (
    bucket_id = 'property-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
