import { z } from "zod";

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
});

export const updatePropertySchema = createPropertySchema.partial();

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
