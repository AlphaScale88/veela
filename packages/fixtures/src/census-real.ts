/**
 * **Real Census figures, per district — the third non-synthetic file in this package**, after
 * `geo.ts` (coordinates) and `rvd-real.ts` (RVD indices). Everything else here is invented and
 * carries a demo banner. These are not.
 *
 * Source: Census and Statistics Department, **2021 Population Census — Statistics by District
 * Council District** (`DC_21C.xlsx`), columns `dm_r`, `dmr_ir`, `dhm_loan` and the housing-type
 * household counts `dh_pub` / `dh_s` / `dh_pri` / `dh_non` / `dh_tem`.
 *
 * **Generated from the workbook by a script, not typed in.** Eighteen districts times six figures
 * is exactly the size at which a transcription error is both likely and invisible — the same
 * reasoning that made `rvdGrowthWindows()` derive its rates from the series instead of hardcoding
 * them.
 *
 * ## The one thing that must always be shown with `medianMonthlyRentHkd`
 *
 * **This is the median rent paid by every renting household in the district, including public
 * rental housing — so it is emphatically not a private market rent.** The numbers prove it
 * themselves: Wong Tai Sin, half of whose households are in public rental housing, has a median
 * rent of HK$2,430, while Central and Western at 3.2% public has HK$15,070. A sixfold gap that is
 * mostly a housing-policy artefact, not a market signal.
 *
 * That is why `publicRentalShare` sits in the same record and is not optional: presenting
 * HK$2,430 to an investor as "the rent in Wong Tai Sin" would be one of the most misleading
 * things this product could do, and the share is what stops it. Any UI showing the rent must show
 * the share, and `rentContext()` below returns them together so it is awkward not to.
 *
 * **For what a private flat actually rents for**, use `estimateMonthlyRent()` in `rvd-real.ts` —
 * RVD market yields by size Class, which is a private-market measure. It is territory-wide, so the
 * two are complements: RVD says what a flat of this size rents for, this says what renting
 * households in this district actually pay and how much of the district is subsidised.
 *
 * ## Why 2021, and why that is acceptable here
 *
 * It is a census: the next one is 2031, with a by-census in 2026 whose district tables are not out
 * yet. So this is a **structural** picture that ages slowly — the public-housing share of a
 * district does not move much in five years — rather than a market rate, which is exactly the
 * kind of figure a five-year-old source can still carry. RVD's monthly indices are what move.
 * `CENSUS_SOURCE.asOf` is on screen wherever these appear.
 */

export interface CensusDistrictProfile {
  readonly districtId: string;
  readonly name: string;
  /** Median monthly rent across ALL renting households, public rental housing included. */
  readonly medianMonthlyRentHkd: number;
  /** Median rent as a share of household income, 0–1. */
  readonly rentToIncomeRatio: number;
  /** Median monthly mortgage payment and loan repayment, for households that have one. */
  readonly medianMonthlyMortgageHkd: number;
  readonly households: number;
  /** Share of households in public rental housing, 0–1. The caveat on the rent figure. */
  readonly publicRentalShare: number;
  /** Share in private permanent housing, 0–1 — the part of the district an investor can buy. */
  readonly privateHousingShare: number;
}

export const CENSUS_SOURCE = {
  name: "Census and Statistics Department, 2021 Population Census",
  table: "Statistics by District Council District (DC_21C)",
  url: "https://www.census2021.gov.hk/en/district_profiles.html",
  asOf: "2021-06",
} as const;

/** Sorted by median rent, highest first — the order a reader comparing districts wants. */
export const CENSUS_DISTRICTS: readonly CensusDistrictProfile[] = [
  {
    districtId: "HK-WCH",
    name: "Wan Chai",
    medianMonthlyRentHkd: 16300,
    rentToIncomeRatio: 0.281,
    medianMonthlyMortgageHkd: 20000,
    households: 63128,
    publicRentalShare: 0.0398,
    privateHousingShare: 0.9537,
  },
  {
    districtId: "HK-CW",
    name: "Central and Western",
    medianMonthlyRentHkd: 15070,
    rentToIncomeRatio: 0.28,
    medianMonthlyMortgageHkd: 18000,
    households: 88922,
    publicRentalShare: 0.0322,
    privateHousingShare: 0.9486,
  },
  {
    districtId: "HK-YTM",
    name: "Yau Tsim Mong",
    medianMonthlyRentHkd: 7000,
    rentToIncomeRatio: 0.32,
    medianMonthlyMortgageHkd: 13530,
    households: 123707,
    publicRentalShare: 0.0272,
    privateHousingShare: 0.8968,
  },
  {
    districtId: "HK-TP",
    name: "Tai Po",
    medianMonthlyRentHkd: 4700,
    rentToIncomeRatio: 0.196,
    medianMonthlyMortgageHkd: 13000,
    households: 110747,
    publicRentalShare: 0.1399,
    privateHousingShare: 0.5978,
  },
  {
    districtId: "HK-KC",
    name: "Kowloon City",
    medianMonthlyRentHkd: 4000,
    rentToIncomeRatio: 0.218,
    medianMonthlyMortgageHkd: 15000,
    households: 147023,
    publicRentalShare: 0.2369,
    privateHousingShare: 0.7293,
  },
  {
    districtId: "HK-TW",
    name: "Tsuen Wan",
    medianMonthlyRentHkd: 3930,
    rentToIncomeRatio: 0.201,
    medianMonthlyMortgageHkd: 13000,
    households: 114009,
    publicRentalShare: 0.1995,
    privateHousingShare: 0.769,
  },
  {
    districtId: "HK-SK",
    name: "Sai Kung",
    medianMonthlyRentHkd: 3540,
    rentToIncomeRatio: 0.177,
    medianMonthlyMortgageHkd: 13500,
    households: 167771,
    publicRentalShare: 0.1749,
    privateHousingShare: 0.5428,
  },
  {
    districtId: "HK-E",
    name: "Eastern",
    medianMonthlyRentHkd: 3520,
    rentToIncomeRatio: 0.193,
    medianMonthlyMortgageHkd: 14000,
    households: 188706,
    publicRentalShare: 0.2009,
    privateHousingShare: 0.6442,
  },
  {
    districtId: "HK-IS",
    name: "Islands",
    medianMonthlyRentHkd: 3340,
    rentToIncomeRatio: 0.153,
    medianMonthlyMortgageHkd: 13100,
    households: 67104,
    publicRentalShare: 0.3359,
    privateHousingShare: 0.5903,
  },
  {
    districtId: "HK-SSP",
    name: "Sham Shui Po",
    medianMonthlyRentHkd: 3240,
    rentToIncomeRatio: 0.196,
    medianMonthlyMortgageHkd: 12500,
    households: 165439,
    publicRentalShare: 0.3757,
    privateHousingShare: 0.5322,
  },
  {
    districtId: "HK-S",
    name: "Southern",
    medianMonthlyRentHkd: 2850,
    rentToIncomeRatio: 0.157,
    medianMonthlyMortgageHkd: 13750,
    households: 86479,
    publicRentalShare: 0.2975,
    privateHousingShare: 0.5083,
  },
  {
    districtId: "HK-KwT",
    name: "Kwun Tong",
    medianMonthlyRentHkd: 2720,
    rentToIncomeRatio: 0.141,
    medianMonthlyMortgageHkd: 11000,
    households: 247592,
    publicRentalShare: 0.5928,
    privateHousingShare: 0.2654,
  },
  {
    districtId: "HK-N",
    name: "North",
    medianMonthlyRentHkd: 2640,
    rentToIncomeRatio: 0.168,
    medianMonthlyMortgageHkd: 9000,
    households: 111433,
    publicRentalShare: 0.2135,
    privateHousingShare: 0.4722,
  },
  {
    districtId: "HK-YL",
    name: "Yuen Long",
    medianMonthlyRentHkd: 2620,
    rentToIncomeRatio: 0.146,
    medianMonthlyMortgageHkd: 11000,
    households: 234338,
    publicRentalShare: 0.2812,
    privateHousingShare: 0.5726,
  },
  {
    districtId: "HK-WTS",
    name: "Wong Tai Sin",
    medianMonthlyRentHkd: 2430,
    rentToIncomeRatio: 0.132,
    medianMonthlyMortgageHkd: 8500,
    households: 147085,
    publicRentalShare: 0.4977,
    privateHousingShare: 0.1864,
  },
  {
    districtId: "HK-KT2",
    name: "Kwai Tsing",
    medianMonthlyRentHkd: 2430,
    rentToIncomeRatio: 0.126,
    medianMonthlyMortgageHkd: 10500,
    households: 176604,
    publicRentalShare: 0.5716,
    privateHousingShare: 0.2559,
  },
  {
    districtId: "HK-ST",
    name: "Sha Tin",
    medianMonthlyRentHkd: 2430,
    rentToIncomeRatio: 0.146,
    medianMonthlyMortgageHkd: 12000,
    households: 246425,
    publicRentalShare: 0.322,
    privateHousingShare: 0.4223,
  },
  {
    districtId: "HK-TM",
    name: "Tuen Mun",
    medianMonthlyRentHkd: 1610,
    rentToIncomeRatio: 0.114,
    medianMonthlyMortgageHkd: 9570,
    households: 187202,
    publicRentalShare: 0.309,
    privateHousingShare: 0.4579,
  },
];

export function censusDistrict(districtId: string): CensusDistrictProfile | null {
  return CENSUS_DISTRICTS.find((d) => d.districtId === districtId) ?? null;
}

/** Territory-wide median of the district medians, for "is this district dear or cheap". */
export function censusRentRange(): {
  readonly lowest: CensusDistrictProfile;
  readonly highest: CensusDistrictProfile;
  readonly median: number;
} {
  const sorted = [...CENSUS_DISTRICTS].sort(
    (a, b) => a.medianMonthlyRentHkd - b.medianMonthlyRentHkd,
  );
  const mid = sorted.length / 2;
  const a = sorted[mid - 1];
  const b = sorted[mid];
  return {
    lowest: sorted[0]!,
    highest: sorted[sorted.length - 1]!,
    /* An even count, so the median is the mean of the two middle districts. Stated rather than
       silently taking one of them, because eighteen is even and someone will check. */
    median: a !== undefined && b !== undefined
      ? Math.round((a.medianMonthlyRentHkd + b.medianMonthlyRentHkd) / 2)
      : (sorted[0]?.medianMonthlyRentHkd ?? 0),
  };
}

/**
 * The rent figure **and the fact that qualifies it**, returned together on purpose.
 *
 * A caller cannot get the median without also getting the public-housing share and a
 * ready-made sentence saying what it means — see the file comment for why that is the
 * whole design of this module rather than a nicety.
 */
export function rentContext(districtId: string): {
  readonly profile: CensusDistrictProfile;
  readonly caveat: string;
} | null {
  const profile = censusDistrict(districtId);
  if (profile === null) return null;
  const pct = Math.round(profile.publicRentalShare * 100);
  return {
    profile,
    caveat:
      pct >= 25
        ? `${pct}% of households here are in public rental housing, so this median is far below what a private flat lets for.`
        : `${pct}% of households here are in public rental housing, so this median is close to — but still below — private market rent.`,
  };
}
