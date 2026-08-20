/**
 * **Real average rents, per square metre per month — RVD's own published figures.** Fourth
 * genuine module in this package, after `geo.ts`, `rvd-real.ts` and `census-real.ts`.
 *
 * Source: Rating and Valuation Department, *Private Domestic — Average Rents by Class*, annual
 * from 1999, published on data.gov.hk as `1.1A(from_99).csv`. Generated from that file by a
 * script rather than typed in, for the same reason `census-real.ts` is.
 *
 * ## Why this matters more than it looks
 *
 * It is the **only official rent figure with a geographic breakdown** that this project has
 * found. RVD's district-level open data is stock, completions and vacancy — no rents; its rent
 * *index* is territory-wide. This is by Class **and by region**: Hong Kong Island, Kowloon, New
 * Territories. Three areas is coarser than eighteen districts, and it is real, which the
 * alternative was not: spreading a territory-wide number across districts to look precise is
 * exactly what this codebase refused to do when the same gap appeared for price indices.
 *
 * The repo's districts already carry a `region`, so a flat maps to one of these three without
 * inventing anything.
 *
 * ## It is a rent per square metre, and it is an average
 *
 * Multiply by saleable area to get a monthly rent — `averageRentForFlat()` does it, converting
 * from square feet, because every other area figure in this product is in square feet and RVD's
 * is not. Two honest limits, both stated wherever it renders: **an average is not this flat**
 * (RVD's own Remarks columns exist because thin sampling makes some cells unreliable), and the
 * **latest row is annual**, so it lags the monthly rent index in `rvd-real.ts`.
 *
 * The two are complements rather than rivals. `estimateMonthlyRent()` in `rvd-real.ts` derives a
 * rent from RVD's monthly *yield* by Class and is more current; this gives the actual average
 * rent per square metre and is the only one that knows about regions. Where they disagree, they
 * disagree for a reason a reader can see: one is territory-wide and monthly, the other is
 * regional and annual.
 */

export type RvdRegionKey = "hongKong" | "kowloon" | "newTerritories";

export const RVD_RENT_SOURCE = {
  name: "Rating and Valuation Department — Private Domestic, Average Rents by Class",
  file: "1.1A(from_99).csv",
  url: "https://www.rvd.gov.hk/en/publications/property_market_statistics.html",
  unit: "HK$ per square metre of saleable area, per month",
} as const;

/** Region label as it appears in `districts.ts`, mapped to this table's keys. */
export const RVD_REGION_BY_LABEL: Readonly<Record<string, RvdRegionKey>> = {
  "Hong Kong Island": "hongKong",
  Kowloon: "kowloon",
  "New Territories": "newTerritories",
};

export const RVD_RENT_YEARS: readonly number[] = [1999,2000,2001,2002,2003,2004,2005,2006,2007,2008,2009,2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024,2025];

/** `null` where RVD published nothing — never interpolated. */
export const RVD_AVG_RENT_PER_SQM: Readonly<
  Record<"A" | "B" | "C" | "D" | "E", Readonly<Record<RvdRegionKey, readonly (number | null)[]>>>
> = {
  A: {
    hongKong: [193,192,187,165,152,167,188,216,246,278,236,285,331,325,377,397,435,415,452,488,507,445,446,445,456,481,497],
    kowloon: [173,166,153,134,122,125,140,154,170,198,181,204,241,237,293,311,345,329,354,391,391,370,377,376,398,429,441],
    newTerritories: [133,130,120,105,93,99,106,113,127,146,137,166,184,193,240,253,272,266,296,314,316,299,307,307,313,329,345],
  },
  B: {
    hongKong: [197,198,191,168,147,168,184,207,237,271,226,275,314,304,347,358,392,372,403,428,432,394,392,382,380,396,411],
    kowloon: [157,149,146,132,120,134,145,155,170,202,174,217,240,232,278,300,324,302,327,353,350,330,331,323,337,363,371],
    newTerritories: [116,117,112,101,88,95,101,107,118,139,126,152,168,175,205,218,238,226,251,267,266,254,260,255,257,271,281],
  },
  C: {
    hongKong: [248,252,254,225,191,213,243,258,289,336,272,327,359,346,383,391,421,395,433,455,450,409,408,400,413,426,435],
    kowloon: [183,172,184,164,157,171,193,198,220,264,230,278,288,281,306,321,355,329,356,376,371,347,350,340,349,369,387],
    newTerritories: [140,144,141,122,103,114,122,124,144,170,142,174,190,190,225,227,249,233,259,270,271,256,263,257,256,269,279],
  },
  D: {
    hongKong: [274,276,282,247,216,234,263,298,335,397,304,358,399,391,419,412,438,422,444,452,458,417,418,413,424,436,439],
    kowloon: [187,195,233,196,172,188,205,220,240,291,236,287,299,269,310,322,349,326,349,381,363,340,349,331,353,358,373],
    newTerritories: [177,184,177,156,133,151,161,171,195,238,182,223,242,249,244,250,256,247,256,269,268,254,259,253,249,253,245],
  },
  E: {
    hongKong: [307,316,328,305,261,275,318,355,396,473,362,409,469,465,477,466,466,433,454,474,468,423,422,427,435,445,458],
    kowloon: [186,197,207,190,182,159,201,197,228,273,244,269,294,293,341,329,342,349,368,370,382,351,381,340,378,381,395],
    newTerritories: [175,174,186,169,146,165,176,189,225,261,209,233,253,287,256,247,256,235,240,252,244,230,241,227,224,221,219],
  },
};

const SQFT_PER_SQM = 10.7639;

export interface AverageRentResult {
  readonly year: number;
  readonly rentPerSqm: number;
  readonly monthlyRentHkd: number;
  readonly rvdClass: "A" | "B" | "C" | "D" | "E";
  readonly region: RvdRegionKey;
}

/**
 * The latest published average rent for a flat of this Class in this region, and what that
 * implies for a flat of this size.
 *
 * Walks the series **backwards to the last year RVD actually published**, rather than assuming
 * the final element is present — the same guard `estimateMonthlyRent()` needs, because these
 * arrays carry `null` holes where a cell was too thinly sampled to report.
 */
export function averageRentForFlat(
  rvdClass: "A" | "B" | "C" | "D" | "E",
  region: RvdRegionKey,
  saleableAreaSqft: number,
): AverageRentResult | null {
  if (!(saleableAreaSqft > 0)) return null;
  const series = RVD_AVG_RENT_PER_SQM[rvdClass][region];
  for (let i = series.length - 1; i >= 0; i -= 1) {
    const rentPerSqm = series[i];
    const year = RVD_RENT_YEARS[i];
    if (rentPerSqm === null || rentPerSqm === undefined || year === undefined) continue;
    const sqm = saleableAreaSqft / SQFT_PER_SQM;
    return {
      year,
      rentPerSqm,
      monthlyRentHkd: Math.round(rentPerSqm * sqm),
      rvdClass,
      region,
    };
  }
  return null;
}

/** The same figure for all three regions, for "is this area dear or cheap" comparisons. */
export function averageRentAcrossRegions(
  rvdClass: "A" | "B" | "C" | "D" | "E",
  saleableAreaSqft: number,
): readonly { readonly region: RvdRegionKey; readonly result: AverageRentResult | null }[] {
  return (["hongKong", "kowloon", "newTerritories"] as const).map((region) => ({
    region,
    result: averageRentForFlat(rvdClass, region, saleableAreaSqft),
  }));
}

export const RVD_REGION_LABEL: Readonly<Record<RvdRegionKey, string>> = {
  hongKong: "Hong Kong Island",
  kowloon: "Kowloon",
  newTerritories: "New Territories",
};
