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
    "are real; prices, sizes and yields are illustrative shapes, not a market comp. " +
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
  /** Small deterministic offset from the district centroid, degrees — enough to spread
   *  markers on a map without claiming to know a real building's coordinates. */
  readonly latOffset: number;
  readonly lngOffset: number;
}

const PER_DISTRICT = 3;

function bedroomsFor(sqft: number): DemoListing["bedrooms"] {
  if (sqft < 480) return 1;
  if (sqft < 650) return 2;
  if (sqft < 850) return 3;
  return 4;
}

function listingsForDistrict(d: DemoDistrict): DemoListing[] {
  const rand = prng(d.seed + 40000);
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

    return {
      id: `${d.id}-${i + 1}`,
      districtId: d.id,
      bedrooms: bedroomsFor(sqft),
      saleableAreaSqft: sqft,
      floor: 3 + Math.floor(rand() * 34),
      yearBuilt: 1985 + Math.floor(rand() * 40),
      priceHkd: price,
      monthlyRentHkd: monthlyRent,
      monthlyManagementFeeHkd: monthlyManagementFee,
      // ±~0.006° ≈ ±650m — enough to fan pins out around a district centre without
      // implying a precise, real location.
      latOffset: (rand() - 0.5) * 0.012,
      lngOffset: (rand() - 0.5) * 0.012,
    };
  });
}

export const DEMO_LISTINGS: readonly DemoListing[] = DEMO_DISTRICTS.flatMap(
  listingsForDistrict,
);
