import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Money is stored as bigint minor units + a currency code, never as float or numeric
 * with an implied scale. `@veela/core` computes on the same representation, so a
 * value round-trips through the database without a rounding step.
 */

export const currencyEnum = pgEnum("currency", ["HKD", "VND", "EUR"]);
export const jurisdictionEnum = pgEnum("jurisdiction", ["HK", "VN", "FR"]);

/** RVD domestic classes A–E, the granularity its statistics are published at. */
export const rvdClassEnum = pgEnum("rvd_class", ["A", "B", "C", "D", "E"]);

export const propertyKindEnum = pgEnum("property_kind", [
  "domestic",
  "office",
  "retail",
  "industrial",
]);

// ────────────────────────────────────────────────────────────────────────────
// Users
// ────────────────────────────────────────────────────────────────────────────

/**
 * Mirrors `auth.users`, which Supabase owns. We never write to auth.users; this
 * table holds what the product needs and is created by a trigger on signup.
 */
export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(), // == auth.users.id
  displayName: text("display_name"),
  /** Drives which rule set and currency the UI defaults to. */
  homeJurisdiction: jurisdictionEnum("home_jurisdiction").notNull().default("HK"),
  /** Whether the user has consented to their property data feeding aggregates. */
  aggregateConsent: boolean("aggregate_consent").notNull().default(false),
  aggregateConsentAt: timestamp("aggregate_consent_at", { withTimezone: true }),
  /** District ids ("HK-WCH", …) the user has starred — "My Favorite Markets". A plain
   *  array on the profile, not a join table: there's no per-favourite metadata (no
   *  date, no note), so a table would only exist to hold a list this already is. */
  favoriteDistricts: jsonb("favorite_districts").notNull().default([]).$type<string[]>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ────────────────────────────────────────────────────────────────────────────
// Geography — public reference data from the Lands Department and RVD
// ────────────────────────────────────────────────────────────────────────────

export const districts = pgTable(
  "districts",
  {
    id: text("id").primaryKey(), // e.g. "HK-WCH" Wan Chai
    jurisdiction: jurisdictionEnum("jurisdiction").notNull(),
    nameEn: text("name_en").notNull(),
    nameZh: text("name_zh"),
    /** PostGIS polygon, SRID 4326. Declared via raw SQL — see 0001_postgis.sql. */
    boundary: text("boundary"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("districts_jurisdiction_idx").on(t.jurisdiction)],
);

/**
 * Building footprints from the Lands Department open data. Free to re-use, and the
 * reason the map can render individual buildings rather than only district polygons.
 */
export const buildings = pgTable(
  "buildings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    districtId: text("district_id")
      .notNull()
      .references(() => districts.id),
    nameEn: text("name_en"),
    nameZh: text("name_zh"),
    /** Estate this building belongs to, when known. The join that hurts — see below. */
    estateId: uuid("estate_id").references(() => estates.id),
    storeys: integer("storeys"),
    completionYear: integer("completion_year"),
    /** PostGIS geometry(Polygon, 4326). */
    footprint: text("footprint"),
    /** Centroid, for cheap map queries that don't need the polygon. */
    centroid: text("centroid"),
    source: text("source").notNull().default("landsd-openmap"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("buildings_district_idx").on(t.districtId),
    index("buildings_estate_idx").on(t.estateId),
  ],
);

/**
 * Estates are the level Centaline and Midland publish at, and the level users
 * actually think in ("Taikoo Shing"). One estate spans many buildings.
 *
 * `nameConfidence` is deliberate: matching a Lands Department building name to a
 * Centaline estate name is fuzzy (Chinese/English variants, redevelopments, towers).
 * We record how sure we are so the UI can refuse to show estate-level figures on a
 * building when the link is weak.
 */
export const estates = pgTable(
  "estates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    districtId: text("district_id")
      .notNull()
      .references(() => districts.id),
    nameEn: text("name_en").notNull(),
    nameZh: text("name_zh"),
    rvdClass: rvdClassEnum("rvd_class"),
    nameConfidence: real("name_confidence").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("estates_district_name_uq").on(t.districtId, t.nameEn),
    check("estates_confidence_range", sql`${t.nameConfidence} between 0 and 1`),
  ],
);

// ────────────────────────────────────────────────────────────────────────────
// Supply & demand series — the map's substance, all from free public sources
// ────────────────────────────────────────────────────────────────────────────

export const marketMetricEnum = pgEnum("market_metric", [
  // supply
  "stock_units",
  "completions_units",
  "vacancy_rate",
  "takeup_units",
  "turnover_rate",
  // demand
  "transaction_count",
  "transaction_value",
  "price_index",
  "rent_index",
  "yield_pct",
  // fundamentals
  "population",
  "households",
]);

export const marketObservations = pgTable(
  "market_observations",
  {
    districtId: text("district_id")
      .notNull()
      .references(() => districts.id),
    /** Null means the metric is published for the whole district, all classes. */
    rvdClass: rvdClassEnum("rvd_class"),
    kind: propertyKindEnum("kind").notNull().default("domestic"),
    metric: marketMetricEnum("metric").notNull(),
    /** First day of the period the observation covers. */
    periodStart: date("period_start").notNull(),
    periodMonths: integer("period_months").notNull().default(1),
    value: numeric("value", { precision: 18, scale: 4 }).notNull(),
    /** Attribution is a licence condition for several of these sources. */
    source: text("source").notNull(),
    ingestedAt: timestamp("ingested_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({
      columns: [t.districtId, t.metric, t.kind, t.periodStart],
      name: "market_observations_pk",
    }),
    index("market_obs_metric_period_idx").on(t.metric, t.periodStart),
  ],
);

// ────────────────────────────────────────────────────────────────────────────
// The user's own properties — the product's actual input
// ────────────────────────────────────────────────────────────────────────────

export const properties = pgTable(
  "properties",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    jurisdiction: jurisdictionEnum("jurisdiction").notNull(),
    currency: currencyEnum("currency").notNull(),

    /** Optional links into the reference layer; a property is valid without them. */
    districtId: text("district_id").references(() => districts.id),
    buildingId: uuid("building_id").references(() => buildings.id),
    estateId: uuid("estate_id").references(() => estates.id),

    priceMinor: bigint("price_minor", { mode: "number" }).notNull(),
    monthlyRentMinor: bigint("monthly_rent_minor", { mode: "number" }).notNull(),
    saleableAreaSqft: real("saleable_area_sqft"),
    transactionDate: date("transaction_date").notNull(),

    /** Buyer situation and cost/financing inputs, validated by Zod at the boundary. */
    buyer: jsonb("buyer").notNull(),
    costs: jsonb("costs").notNull(),
    financing: jsonb("financing"),

    /**
     * Where this came from, when it came from a listing rather than a keyboard.
     *
     * The importer has always read all four of these and thrown every one away at the form
     * boundary, so a saved property could not say which listing produced its figures — the
     * one thing you want when a price is six months old. All nullable: a property typed in
     * by hand has no source, and most Hong Kong portals publish no coordinates.
     */
    sourceUrl: text("source_url"),
    address: text("address"),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),

    /**
     * Set when this row came from the Search page's fabricated sample catalogue.
     *
     * The heart on a sample card saves it, which puts invented figures in the same table as
     * somebody's real flat. The label already says "sample flat", but a label is editable text
     * and cannot answer *is this listing already saved* — the heart has to render filled before
     * anything is clicked, and un-hearting must delete the row this listing produced and no
     * other. Three listings share a district and can share a bedroom count, so the label
     * collides by construction. Not a foreign key: the catalogue is a TypeScript fixture, and
     * seeding fabricated rows into the database to point at is the thing this project refuses.
     */
    demoListingId: text("demo_listing_id"),

    /** True once the user asks us to track it against the market. */
    monitored: boolean("monitored").notNull().default(false),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("properties_owner_idx").on(t.ownerId),
    index("properties_monitored_idx").on(t.monitored),
    check("properties_price_positive", sql`${t.priceMinor} > 0`),
    check("properties_rent_non_negative", sql`${t.monthlyRentMinor} >= 0`),
  ],
);

/**
 * A stored verdict is a **snapshot**, not a cache. Tax rules change; a user needs to
 * see what the numbers were when they made the decision. `rulesVersion` records
 * which dated rule set produced it.
 */
export const verdicts = pgTable(
  "verdicts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    rulesVersion: text("rules_version").notNull(),
    grossYield: real("gross_yield"),
    netYield: real("net_yield"),
    cashOnCash: real("cash_on_cash"),
    /** The full computed Verdict, for display and audit. */
    payload: jsonb("payload").notNull(),
    computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("verdicts_property_idx").on(t.propertyId),
    index("verdicts_owner_idx").on(t.ownerId),
  ],
);

/**
 * Photographs of a user's own property.
 *
 * **The bytes are not here.** The row records an object key in a *private* Supabase Storage
 * bucket; the image itself never passes through this database or through our API, because the
 * browser uploads to Storage directly. That is not only a size argument — a `bytea` column
 * would push multi-megabyte images through the same pooled connection that serves every
 * report, and through a Vercel function whose body limit is below a modern phone photo.
 *
 * `storagePath` follows `{ownerId}/{propertyId}/{uuid}.{ext}`, and that shape is a contract:
 * the bucket's own RLS policies authorise a read by checking the first path segment against
 * `auth.uid()`. Change the convention and every existing object becomes unreadable.
 *
 * Ordering is an explicit `sortOrder` rather than `createdAt`, so a photo can be promoted to
 * the cover without being re-uploaded, and there is no separate `isCover` flag to drift out of
 * step with it — the lowest `sortOrder` is the cover, by definition.
 */
export const propertyPhotos = pgTable(
  "property_photos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    /** Denormalised from `properties`: every RLS policy filters on it, and a policy that has
     *  to join another table to decide is both slower and easier to get wrong. */
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    storagePath: text("storage_path").notNull().unique(),
    contentType: text("content_type").notNull(),
    bytes: integer("bytes").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("property_photos_property_idx").on(t.propertyId, t.sortOrder),
    index("property_photos_owner_idx").on(t.ownerId),
    check("property_photos_bytes_positive", sql`${t.bytes} > 0`),
    check("property_photos_type_is_image", sql`${t.contentType} like 'image/%'`),
  ],
);

export type Profile = typeof profiles.$inferSelect;
export type PropertyPhoto = typeof propertyPhotos.$inferSelect;
export type NewPropertyPhoto = typeof propertyPhotos.$inferInsert;
export type Property = typeof properties.$inferSelect;
export type NewProperty = typeof properties.$inferInsert;
export type Verdict = typeof verdicts.$inferSelect;
export type District = typeof districts.$inferSelect;
export type Building = typeof buildings.$inferSelect;
export type Estate = typeof estates.$inferSelect;
export type MarketObservation = typeof marketObservations.$inferSelect;
