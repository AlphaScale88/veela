import { z } from "zod";

export * from "./legal.js";

/**
 * The shared contract. Web, mobile and the API all import these schemas, so a change
 * to the shape is a compile error on every surface rather than a runtime surprise.
 * Types are **inferred** from the schemas — never hand-written alongside them.
 */

export const currencySchema = z.enum(["HKD", "VND", "EUR"]);
export const jurisdictionSchema = z.enum(["HK", "VN", "FR"]);
export const rvdClassSchema = z.enum(["A", "B", "C", "D", "E"]);

/** An amount in minor units. Integer, because money is never a float. */
export const minorAmountSchema = z
  .number()
  .int("Amounts must be whole minor units (cents)")
  .nonnegative();

export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

export const buyerSchema = z.object({
  isPermanentResident: z.boolean(),
  ownsOtherResidentialProperty: z.boolean(),
  purchasingViaCompany: z.boolean(),
});

export const costsSchema = z.object({
  monthlyManagementFeeMinor: minorAmountSchema.optional(),
  rateableValueMinor: minorAmountSchema.optional(),
  ownerPaysRates: z.boolean(),
  annualOtherCostsMinor: minorAmountSchema.optional(),
  agencyFeeMinor: minorAmountSchema.optional(),
  legalFeesMinor: minorAmountSchema.optional(),
  vacancyRate: z.number().min(0).max(1).optional(),
});

export const financingSchema = z.object({
  loanAmountMinor: minorAmountSchema,
  annualInterestRate: z.number().min(0).max(1),
  termYears: z.number().int().positive().max(50),
});

export const createPropertySchema = z.object({
  label: z.string().min(1).max(120),
  jurisdiction: jurisdictionSchema,
  currency: currencySchema,
  districtId: z.string().optional(),
  buildingId: z.string().uuid().optional(),
  estateId: z.string().uuid().optional(),
  priceMinor: minorAmountSchema.positive(),
  monthlyRentMinor: minorAmountSchema,
  saleableAreaSqft: z.number().positive().max(100_000).optional(),
  transactionDate: isoDateSchema,
  buyer: buyerSchema,
  costs: costsSchema,
  financing: financingSchema.optional(),
  monitored: z.boolean().default(false),

  /**
   * Provenance, when the figures came from a listing rather than a keyboard.
   *
   * The importer has always read all four and dropped every one at the form boundary, so a
   * saved property could not say which listing produced its numbers — the one thing you want
   * when a price is six months old. `sourceUrl` is `.url()`-validated because it is rendered
   * as a link, and a stored string that is not a URL becomes a broken anchor on the page.
   * Coordinates are bounded to the real world so a parsing bug cannot put a pin in the sea.
   */
  sourceUrl: z.string().url().max(2048).optional(),
  address: z.string().max(500).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),

  /**
   * Set only by the Search page's heart, and only when the thing being saved is a fabricated
   * sample listing. Not a URL and not user-facing: it is the fixture's own id, which is what
   * lets the heart render filled before anything is clicked and lets un-hearting delete the row
   * *this* listing produced rather than one that merely shares its label.
   */
  demoListingId: z.string().max(64).optional(),
});

export const updatePropertySchema = createPropertySchema.partial();

/**
 * Registering a photo *after* the browser has uploaded it.
 *
 * The bytes never reach this API — the browser writes straight to a private Supabase Storage
 * bucket under its own session, and this only records that the object exists. So the schema
 * validates a *claim about* a file rather than a file, and each field is checked because a
 * claim can be wrong or hostile:
 *
 * - `storagePath` must match `{uuid}/{uuid}/{name}` exactly. The bucket's RLS already refuses
 *   an upload outside the caller's own folder, but this API also writes `ownerId` itself, and
 *   a path pointing at somebody else's folder would produce a row claiming an object the
 *   owner cannot read. Two checks for one invariant, because the failure is silent.
 * - `bytes` is capped at the bucket's own 10 MB limit rather than trusted.
 * - `contentType` is an allow-list, not `image/*`: SVG is an image and also a script host.
 */
export const registerPhotoSchema = z.object({
  storagePath: z
    .string()
    .max(512)
    .regex(
      /^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[A-Za-z0-9._-]+$/,
      "storagePath must be {ownerId}/{propertyId}/{filename}",
    ),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp", "image/avif"]),
  bytes: z.number().int().positive().max(10 * 1024 * 1024),
});

export const reorderPhotosSchema = z.object({
  /** Photo ids, in the order they should appear. The first is the cover. */
  photoIds: z.array(z.string().uuid()).min(1).max(24),
});

export type RegisterPhotoInput = z.infer<typeof registerPhotoSchema>;
export type ReorderPhotosInput = z.infer<typeof reorderPhotosSchema>;

export type CreatePropertyInput = z.infer<typeof createPropertySchema>;
export type UpdatePropertyInput = z.infer<typeof updatePropertySchema>;
export type Buyer = z.infer<typeof buyerSchema>;
export type Costs = z.infer<typeof costsSchema>;
export type Financing = z.infer<typeof financingSchema>;

// ── Map & market queries ───────────────────────────────────────────────────

export const marketMetricSchema = z.enum([
  "stock_units",
  "completions_units",
  "vacancy_rate",
  "takeup_units",
  "turnover_rate",
  "transaction_count",
  "transaction_value",
  "price_index",
  "rent_index",
  "yield_pct",
  "population",
  "households",
]);

export type MarketMetric = z.infer<typeof marketMetricSchema>;

/** Which side of the supply/demand question a metric answers. */
export const METRIC_SIDE: Record<MarketMetric, "supply" | "demand" | "fundamental"> = {
  stock_units: "supply",
  completions_units: "supply",
  vacancy_rate: "supply",
  takeup_units: "supply",
  turnover_rate: "supply",
  transaction_count: "demand",
  transaction_value: "demand",
  price_index: "demand",
  rent_index: "demand",
  yield_pct: "demand",
  population: "fundamental",
  households: "fundamental",
};

/** west,south,east,north in WGS84 degrees. */
export const bboxSchema = z
  .string()
  .regex(/^-?\d+(\.\d+)?(,-?\d+(\.\d+)?){3}$/, "Expected west,south,east,north")
  .transform((s) => {
    const parts = s.split(",").map(Number) as [number, number, number, number];
    const [west, south, east, north] = parts;
    if (west >= east || south >= north) {
      throw new Error("bbox must be west<east and south<north");
    }
    return { west, south, east, north };
  });

export const mapQuerySchema = z.object({
  bbox: bboxSchema,
  metric: marketMetricSchema.default("vacancy_rate"),
  /** Period to colour the choropleth by; defaults to the latest available. */
  periodStart: isoDateSchema.optional(),
});

export const seriesQuerySchema = z.object({
  districtId: z.string().min(1),
  metric: marketMetricSchema,
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
  rvdClass: rvdClassSchema.optional(),
});

/**
 * Latest observation of one metric for **every** district — what a choropleth or a
 * symbol map needs, and deliberately not `GET /map/districts`, which answers the same
 * question but joins district geometry and filters on `boundary && envelope`. Boundaries
 * are not ingested yet (see "Real data" in `.claude/CLAUDE.md`), so `boundary` is NULL,
 * `NULL && envelope` is NULL, and that endpoint returns zero rows for every viewport.
 * This one carries no geometry and no viewport, so it works on the data we actually have.
 */
export const latestByDistrictQuerySchema = z.object({
  metric: marketMetricSchema,
});

/**
 * Free-text building/estate search, resolved against the Government's Address Lookup
 * Service. Two characters minimum: ALS scores fuzzily and a single letter returns
 * essentially arbitrary high-scoring matches, which reads as a broken search rather than
 * a broad one.
 */
export const buildingSearchQuerySchema = z.object({
  q: z.string().trim().min(2).max(120),
  limit: z.coerce.number().int().min(1).max(20).default(8),
});

/**
 * What's near a point. Bounds are Hong Kong's, deliberately: this product covers one
 * territory, the amenity radii are tuned for its density, and accepting a coordinate in
 * another country would return a confidently empty neighbourhood rather than an error.
 */
export const neighbourhoodQuerySchema = z.object({
  lat: z.coerce.number().min(22.1).max(22.6),
  lng: z.coerce.number().min(113.8).max(114.5),
});

/**
 * How confident we are that a number shown at one geographic level actually applies
 * at the level the user is looking at. The UI must surface this: putting a district
 * vacancy rate on a single building implies precision we do not have, and that is
 * how a data product loses credibility with investors.
 */
export const granularitySchema = z.enum(["district", "estate", "building", "unit"]);
export type Granularity = z.infer<typeof granularitySchema>;

export const attributedValueSchema = z.object({
  value: z.number(),
  /** The level the figure was actually measured at. */
  measuredAt: granularitySchema,
  /** The level it is being displayed at. */
  shownAt: granularitySchema,
  source: z.string(),
  periodStart: isoDateSchema,
});

export type AttributedValue = z.infer<typeof attributedValueSchema>;

export function isExtrapolated(v: AttributedValue): boolean {
  const rank: Record<Granularity, number> = {
    district: 0,
    estate: 1,
    building: 2,
    unit: 3,
  };
  return rank[v.shownAt] > rank[v.measuredAt];
}

// ── Chat ─────────────────────────────────────────────────────────────────────
// The assistant is stateless on the server: the whole conversation rides in every
// request, same as any Anthropic Messages API call. Nothing is persisted server-side —
// consistent with the rest of the product ("no account, nothing saved").

export const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4_000),
});
export type ChatMessage = z.infer<typeof chatMessageSchema>;

export const chatRequestSchema = z.object({
  messages: z.array(chatMessageSchema).min(1).max(40),
  /**
   * A plain-text summary of the property currently on screen, built client-side from
   * whatever `Verdict` is live on `/analyse`. A string, not the `Verdict` shape itself
   * — the assistant reads prose, and coupling this schema to the engine's output type
   * would mean every change to `Verdict` risks becoming a chat-endpoint break too.
   */
  context: z.string().max(2_000).optional(),
});
export type ChatRequest = z.infer<typeof chatRequestSchema>;

// ── Listing import ───────────────────────────────────────────────────────────
// "Paste a link, see the numbers" — but this product's whole standard is that an
// unsourced rate is a bug, so importing never invents a figure a listing page didn't
// actually publish. Every field below is optional for exactly that reason: the server
// reads Open Graph tags and JSON-LD structured data (what a page publishes *for search
// engines and social previews*, not its rendered layout), which most listing sites do
// not populate as fully as their own page design. Whatever isn't found is left for the
// person to fill in themselves — see `warnings`.

export const importListingRequestSchema = z.object({
  url: z.string().url().max(2_000),
});
export type ImportListingRequest = z.infer<typeof importListingRequestSchema>;

export const importedListingSchema = z.object({
  sourceUrl: z.string().url(),
  fetchedAt: z.string(),
  /** The page's own title/description — always captured when present, since even a
   *  listing with no structured price data usually has a human-readable og:title. */
  title: z.string().optional(),
  description: z.string().optional(),
  priceMinor: minorAmountSchema.optional(),
  /** Set instead of `priceMinor` when the listing is a rental, not a sale — a rental's
   *  own headline figure is a monthly rent, and putting it in `priceMinor` would read as
   *  a purchase price a hundred-odd times too low. The two are mutually exclusive except
   *  on a source that lists a unit for both sale and rent at once, where both are real. */
  monthlyRentMinor: minorAmountSchema.optional(),
  currency: currencySchema.optional(),
  saleableAreaSqft: z.number().positive().optional(),
  bedrooms: z.number().int().positive().optional(),
  address: z.string().optional(),
  /** Present only as a pair — a latitude with no longitude describes nowhere. Checked
   *  against Hong Kong's own bounding box before this is ever set, so a value here is
   *  never a stray office address or a parsing slip. */
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  /** What was searched for but not found, or found and worth distrusting — shown next
   *  to the import, never silently dropped. */
  warnings: z.array(z.string()),
});
export type ImportedListing = z.infer<typeof importedListingSchema>;

// ── Profile ───────────────────────────────────────────────────────────────────
// A row is created automatically on signup (see the `handle_new_user` trigger in
// `packages/db/migrations/0001_postgis_and_rls.sql`) — this is only ever an update to
// an existing row, never a create. `homeJurisdiction` is left out on purpose: the
// product is Hong Kong only right now, so there is nothing else to set it to.

export const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(120).nullable().optional(),
  /** Consent to feed this account's own property data into Veela's aggregate
   *  dataset — the PDPO consent flagged as needed in `.claude/CLAUDE.md`'s open
   *  questions. Off by default; this is the only way it turns on. */
  aggregateConsent: z.boolean().optional(),
  /** "My Favorite Markets" — district ids, sent as a full replacement array rather
   *  than an add/remove delta. The client always has the current list in hand (it
   *  just fetched it to render the star toggle), so there's no lost-update risk, and
   *  one shape covers star and un-star instead of two endpoints. */
  favoriteDistricts: z.array(z.string()).optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

/**
 * `POST /report/brief` — an AI-written commentary on a report the engine already computed.
 *
 * **Prose in, prose out, and no `Verdict` in sight.** Same reasoning as `chatRequestSchema`'s
 * `context`: coupling this contract to the engine's output shape would make every change to
 * `Verdict` a breaking change here. It also enforces the division of labour — the model is
 * handed figures as *text*, so it has nothing to recompute even if it wanted to.
 */
export const reportBriefSchema = z.object({
  /** The computed report, rendered as plain lines. Capped because this is a summary of one
   *  property, not a document; a larger body means a caller is sending the wrong thing. */
  summary: z.string().min(1).max(4_000),
  /** Nearby amenity counts and the closest few, as text. Optional: a report with no location
   *  attached has none, and the prompt is told to say so rather than invent a neighbourhood. */
  area: z.string().max(4_000).optional(),
});

export type ReportBriefInput = z.infer<typeof reportBriefSchema>;

/** Creating an API key. `plan` is validated against the same ids `PLANS` defines, so a
 *  request cannot mint a key on a tier that does not exist. */
export const createApiKeySchema = z.object({
  name: z.string().min(1).max(60),
  plan: z.enum(["free", "pro"]),
});
export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;

/** Recording acceptance. The client says which documents it presented and at which version;
 *  the server refuses anything that is not the version currently in force, so a stale cached
 *  page cannot record consent to wording nobody is being shown. */
export const recordConsentSchema = z.object({
  documents: z
    .array(z.object({ document: z.enum(["terms", "privacy"]), version: z.string().min(1) }))
    .min(1),
});
export type RecordConsentInput = z.infer<typeof recordConsentSchema>;
