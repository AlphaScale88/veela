/**
 * ⚠️ `@veela/fixtures` contains ONLY synthetic demo data.
 *
 * It exists so the UI can be designed and reviewed before the real ingestion job
 * exists. Two rules:
 *
 * 1. **Never import this from `packages/api`, `packages/db` or `packages/core`.** It
 *    is a presentation-layer fixture, not a data source. Keeping the dependency
 *    one-directional is what stops demo numbers leaking into a real code path.
 * 2. **Anything rendering it must show the demo banner.** `DEMO_NOTICE` is exported
 *    for exactly that, so the disclosure lives next to the data.
 */

export * from "./districts.js";
export * from "./observations.js";
export * from "./listings.js";

export const DEMO_NOTICE = {
  title: "Demo data",
  detail:
    "District names are real; every figure and outline on this page is generated. " +
    "The real series come from the RVD Property Review, Land Registry monthly " +
    "statistics and Lands Department open geometry — none of it is wired up yet.",
} as const;

/**
 * Real geography. Kept in its own module and re-exported here, so that the one file in
 * this package containing genuine coordinates is easy to find among the invented ones.
 */
export * from "./geo.js";

/**
 * Real RVD price/rental indices, territory-wide. Same reasoning as `geo.ts` — kept in
 * its own module so the genuine series is easy to find among the invented ones.
 */
export * from "./rvd-real.js";

/**
 * Real Census 2021 figures **per district** — median rent, rent-to-income, and the
 * housing-type shares. Third of the three genuine modules here.
 *
 * This is the one that closes the gap the `DEMO_NOTICE` above complains about for rents:
 * RVD publishes domestic rents only by size **Class**, territory-wide, and its
 * district-level open data is stock, completions and vacancy only — verified against
 * data.gov.hk's own resource list, not assumed. The Census is where a real *per-district*
 * rent figure actually exists.
 *
 * **Read `census-real.ts`'s own comment before displaying `medianMonthlyRentHkd`.** It is
 * every renting household including public rental housing, so in a district that is half
 * subsidised it is nowhere near a private market rent, and it must never appear without
 * `publicRentalShare` beside it.
 */
export * from "./census-real.js";

/**
 * Real RVD **average rents per square metre, by Class and by region** — the only official rent
 * figure with any geographic breakdown that this project has found. See its own comment for why
 * three regions is the finest real geography available for rents, and why inventing eighteen
 * would have been the wrong answer.
 */
export * from "./rvd-rents.js";
/**
 * Real RVD price and rental indices **by Class**, plus the only price series RVD publishes
 * with a geographic split (Urban against New Territories). Fifth genuine module.
 *
 * This is the one that closes a gap `rvd-real.ts` leaves open: that module's indices are
 * "All Classes", and this product sorts every flat into a Class. Showing one reader's Class E
 * flat the all-classes line is telling them about somebody else's property.
 */
export * from "./rvd-class-series.js";

/**
 * Real RVD stock, vacancy, completions, take-up, demolition and the age profile of the stock
 * -- all by Class, annual, from 1985. The physical market underneath the indices above.
 *
 * Read the module's own comment on why take-up is here as well as vacancy: they separate a
 * market building faster than it absorbs from one losing demand, and one number cannot.
 */
export * from "./rvd-supply.js";

