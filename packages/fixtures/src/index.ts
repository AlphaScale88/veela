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
