import { DEMO_DISTRICTS, type DemoDistrict, type Region } from "./districts.js";

/**
 * ⚠️ FABRICATED INDIVIDUAL LISTINGS — not a database, not real inventory, no address
 * refers to an actual building.
 *
 * This file exists to demonstrate a Mashvisor-style "Property Finder" — screen
 * individual units against investment criteria — **without** the thing that feature
 * actually requires: a bulk Hong Kong listings feed. There isn't one to build on. The
 * Land Registry sells transaction records one at a time at HK$10 each with no bulk
 * option (see the "Hong Kong data landscape" section of `.claude/CLAUDE.md`), and
 * licensing Centaline or Midland's transaction databases is a deferred decision, not a
 * made one.
 *
 * So rather than pretend a real address into a demo — which would misrepresent a
 * specific building as having a specific unit for sale at a specific price, exactly the
 * kind of unsourced claim the rest of this product refuses to make — every listing here
 * is generated, and deliberately labelled by what it is ("sample flat") rather than
 * given a plausible-sounding building name. **No building name, no street, no unit
 * number.** Only the district is real.
 *
 * The *shapes* are plausible so the screening UI can be judged: price per square foot
 * scales roughly by region (Hong Kong Island priciest, New Territories cheapest), gross
 * yields sit in the low single digits, which is the real shape of Hong Kong's rental
 * market even though these specific numbers are invented. It is not a valuation, a
 * comp, or a substitute for RVD's Price Indices for Selected Popular Developments.
 *
 * Anything rendering this must show `LISTINGS_NOTICE`, and it needs a **stronger**
 * disclosure than `DEMO_NOTICE` carries elsewhere in this package — that one discloses
 * fabricated *statistics*; this discloses fabricated *properties*, which is a bigger
 * claim to get wrong.
 */

export const LISTINGS_NOTICE = {
  title: "Demo listings — not real properties",
  detail:
    "Every listing below is generated for this demo. There is no bulk Hong Kong " +
    "listings feed behind it, and no address here names a real building. Districts " +
    "are real; prices, sizes, yields and every feature shown — renovation, view, " +
    "facilities, tenancy — are illustrative shapes, not a market comp. " +
    "Click through to see how the full report treats a set of figures like these.",
} as const;

/** mulberry32 — same generator as `observations.ts`, so a district's demo listings and
 *  its demo series are both reproducible from the same seed convention. */
function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Coarse, illustrative regional price tiers — not RVD figures, just enough spread that
 *  Hong Kong Island reads as pricier than the New Territories, which is the one shape
 *  worth preserving from the real market. */
const REGION_TIER: Record<Region, number> = {
  "Hong Kong Island": 2.15,
  Kowloon: 1.45,
  "New Territories": 1,
};

/**
 * The qualitative attributes, added 16/08/2026 so the finder can offer the criteria a Hong
 * Kong portal actually offers.
 *
 * These were previously refused on the grounds that generating them would "deepen the
 * fabrication". **That reasoning was inconsistent and is withdrawn** — `floor`, `yearBuilt`
 * and `monthlyManagementFeeHkd` are every bit as invented as a renovation state, and all
 * three were already generated here and already filtered on. Either the whole file is
 * defensible because it is disclosed, or none of it is; there was never a principled line
 * between an invented number and an invented category. `LISTINGS_NOTICE` is what makes this
 * honest, and it covers these exactly as it covers the prices.
 */
export type Renovation = "none" | "simple" | "refined";
export type Furnishing = "unfurnished" | "partly" | "full";
export type OutdoorSpace = "none" | "balcony" | "rooftop" | "garden";
export type ListingView = "none" | "city" | "open" | "mountain" | "sea";
export type CarPark = "none" | "rentable" | "included";
export type Facility = "clubhouse" | "gym" | "pool";
export type Tenancy = "vacant" | "tenanted";

export interface DemoListing {
  readonly id: string;
  readonly districtId: string;
  readonly bedrooms: 1 | 2 | 3 | 4;
  readonly saleableAreaSqft: number;
  readonly floor: number;
  readonly yearBuilt: number;
  readonly priceHkd: number;
  readonly monthlyRentHkd: number;
  readonly monthlyManagementFeeHkd: number;
  readonly renovation: Renovation;
  readonly furnishing: Furnishing;
  readonly outdoor: OutdoorSpace;
  readonly view: ListingView;
  readonly carPark: CarPark;
  readonly facilities: readonly Facility[];
  readonly petsAllowed: boolean;
  /** Vacant, or sold with a tenant already in place — the one attribute here that changes
   *  an investment decision outright rather than shading it: a tenanted flat comes with an
   *  income stream and a contract you cannot vary until it expires. */
  readonly tenancy: Tenancy;
  /** Small deterministic offset from the district centroid, degrees — enough to spread
   *  markers on a map without claiming to know a real building's coordinates. */
  readonly latOffset: number;
  readonly lngOffset: number;
}

/**
 * Facilities come as a **tier, not three coin flips.** A building with a pool essentially
 * always has a clubhouse, and one with neither rarely has a gym on its own — three
 * independent booleans would generate combinations that do not exist in the real housing
 * stock, which makes the filter behave strangely for a reader who knows the market.
 */
const FACILITY_TIERS: readonly (readonly Facility[])[] = [
  [],
  ["clubhouse"],
  ["clubhouse", "gym"],
  ["clubhouse", "gym", "pool"],
];

const PER_DISTRICT = 3;

/** Weighted choice from parallel options/weights. Weights are relative, not probabilities —
 *  they read better as "twice as likely as" than as decimals that have to sum to one. */
function weighted<T>(r: number, options: readonly T[], weights: readonly number[]): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let acc = r * total;
  for (let i = 0; i < options.length; i += 1) {
    acc -= weights[i] ?? 0;
    if (acc <= 0) return options[i] as T;
  }
  return options[options.length - 1] as T;
}

function bedroomsFor(sqft: number): DemoListing["bedrooms"] {
  if (sqft < 480) return 1;
  if (sqft < 650) return 2;
  if (sqft < 850) return 3;
  return 4;
}

function listingsForDistrict(d: DemoDistrict): DemoListing[] {
  const rand = prng(d.seed + 40000);
  /**
   * A **second, independent stream** for the qualitative attributes, and the separation is
   * load-bearing rather than tidiness.
   *
   * mulberry32 is a sequence shared by all three listings in a district, so drawing the new
   * attributes from `rand` would shift every subsequent draw — silently changing the prices,
   * sizes and coordinates of listings 2 and 3 everywhere, and with them every count this page
   * has been verified against. Measured while writing this: it moved "under 500 sq ft" from
   * 10 listings to 13. Two streams means either group can gain a field later without
   * disturbing the other.
   */
  const attrRand = prng(d.seed + 90000);
  const basePsf = 7_500 * REGION_TIER[d.region] + rand() * 3_000;

  return Array.from({ length: PER_DISTRICT }, (_, i) => {
    const psf = basePsf * (0.82 + rand() * 0.4);
    const sqft = Math.round(360 + rand() * 760);
    const price = Math.round((psf * sqft) / 10_000) * 10_000;
    // Hong Kong gross rental yields run low-single-digit; spread a plausible band
    // rather than assert one figure.
    const grossYield = 0.021 + rand() * 0.019;
    const monthlyRent = Math.round((price * grossYield) / 12 / 100) * 100;
    const monthlyManagementFee = Math.round(sqft * (3.4 + rand() * 2.2));
    const floor = 3 + Math.floor(rand() * 34);
    const yearBuilt = 1985 + Math.floor(rand() * 40);
    // ±~0.006° ≈ ±650m — enough to fan pins out around a district centre without
    // implying a precise, real location.
    const latOffset = (rand() - 0.5) * 0.012;
    const lngOffset = (rand() - 0.5) * 0.012;

    /* ---- Qualitative attributes ----------------------------------------------------
       Drawn from `attrRand`, the separate stream declared above, so every figure in the
       block above is byte-identical to what this file generated before these existed.

       The odds below lean on the figures already drawn (age, floor, size, region) rather
       than being uniform. That is not extra realism for its own sake: a filter for "sea
       view, high floor" that returns a ground-floor flat, or a building with a pool and
       no clubhouse, makes the *screening tool* look broken to anyone who knows the
       market — and judging the screening tool is the entire reason this data exists. */
    const modern = yearBuilt >= 2005;
    const midEra = yearBuilt >= 1995;

    const renovation = weighted<Renovation>(
      attrRand(),
      ["refined", "simple", "none"],
      modern ? [5, 3.5, 1.5] : midEra ? [3, 4, 3] : [1.5, 4, 4.5],
    );

    // Furnishing follows the fit-out: a flat stripped back to bare walls is rarely sold
    // with the sofa still in it.
    const furnishing = weighted<Furnishing>(
      attrRand(),
      ["full", "partly", "unfurnished"],
      renovation === "refined" ? [3, 4, 3] : renovation === "simple" ? [1.5, 3.5, 5] : [0.5, 2, 7.5],
    );

    // Rooftops belong to top floors and gardens to the bottom. Generating either at the
    // wrong height would produce a listing nobody would believe.
    const outdoorOptions: readonly OutdoorSpace[] =
      floor >= 30 ? ["rooftop", "balcony", "none"] : floor <= 4 ? ["garden", "balcony", "none"] : ["balcony", "none"];
    const outdoor = weighted<OutdoorSpace>(
      attrRand(),
      outdoorOptions,
      outdoorOptions.length === 3 ? [2, 3, 5] : [3, 7],
    );

    // Height buys a view; a *sea* view also needs water nearby, so the region shifts the
    // odds rather than the floor deciding alone.
    const seaBias = d.region === "Hong Kong Island" ? 2.5 : d.region === "New Territories" ? 1.5 : 1;
    const view = weighted<ListingView>(
      attrRand(),
      ["sea", "mountain", "city", "open", "none"],
      floor >= 26
        ? [2 * seaBias, 2, 3, 2, 1]
        : floor >= 11
          ? [1 * seaBias, 2, 4, 2, 3]
          : [0.3 * seaBias, 1.5, 3, 1.5, 6],
    );

    const carPark = weighted<CarPark>(
      attrRand(),
      ["included", "rentable", "none"],
      sqft >= 900 ? [4, 4, 2] : sqft >= 600 ? [1.5, 4.5, 4] : [0.5, 3.5, 6],
    );

    const facilities =
      FACILITY_TIERS[
        weighted(attrRand(), [0, 1, 2, 3], modern ? [1, 2, 3, 4] : midEra ? [3, 3, 3, 1] : [6, 3, 1, 0.5])
      ] ?? [];

    const petsAllowed = attrRand() < (d.region === "New Territories" ? 0.55 : 0.35);
    const tenancy: Tenancy = attrRand() < 0.32 ? "tenanted" : "vacant";

    return {
      id: `${d.id}-${i + 1}`,
      districtId: d.id,
      bedrooms: bedroomsFor(sqft),
      saleableAreaSqft: sqft,
      floor,
      yearBuilt,
      priceHkd: price,
      monthlyRentHkd: monthlyRent,
      monthlyManagementFeeHkd: monthlyManagementFee,
      renovation,
      furnishing,
      outdoor,
      view,
      carPark,
      facilities,
      petsAllowed,
      tenancy,
      latOffset,
      lngOffset,
    };
  });
}

export const DEMO_LISTINGS: readonly DemoListing[] = DEMO_DISTRICTS.flatMap(
  listingsForDistrict,
);
