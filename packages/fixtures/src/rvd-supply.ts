/**
 * RVD supply and absorption, by Class -- generated, never typed.
 *
 *     python scripts/gen-rvd-supply.py
 *
 * Genuine data. Nothing in this file is synthetic.
 *
 * **Read this beside `rvd-class-series.ts`.** That module holds the price and rent indices per
 * Class; this one holds the physical market underneath them. Together they answer one question
 * per size band: for a Class B flat, what is the price doing, what is the rent doing, how many
 * exist, how many sit empty, how many are being built, and how many are being absorbed. The
 * Class is the only resolution Hong Kong publishes this at, and it is the same band
 * `rvdClassForAreaSqft` already sorts a reader's flat into.
 *
 * **Take-up is not derivable from vacancy, and that is why both are here.** Vacancy counts
 * flats empty at one instant; take-up counts flats absorbed across a year. Rising vacancy with
 * rising take-up is a market building faster than it absorbs; rising vacancy with falling
 * take-up is a market losing demand. One number cannot separate those.
 *
 * **One axis, padded with nulls.** The series end in different years -- completions runs ahead
 * on provisional figures, take-up behind -- so they share `RVD_SUPPLY_YEARS` and carry null
 * where a source has not reported. A null is a hole, never a zero.
 *
 * **Vacancy rates are stored as percentages.** RVD publishes them as fractions (0.043); they
 * are multiplied by 100 here so they match `vacancy_rate` everywhere else in this product,
 * which is a percentage. That conversion is the one transformation this file performs.
 */

import type { RvdClassKey } from "./rvd-real.js";

export const RVD_SUPPLY_SOURCE = {
  name: "Rating and Valuation Department",
  detail:
    "Private Domestic \u2014 Stock, Vacancy, Completions, Take-up, Demolition and Stock by Age",
  url: "https://www.rvd.gov.hk/en/publications/property_market_statistics.html",
  latestStockYear: 2025,
} as const;

/** Shared annual axis, oldest first. Every array below is this length. */
export const RVD_SUPPLY_YEARS: readonly number[] = [1985,1986,1987,1988,1989,1990,1991,1992,1993,1994,1995,1996,1997,1998,1999,2000,2001,2002,2003,2004,2005,2006,2007,2008,2009,2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024,2025,2026];

/** Flats in existence at year end, by Class. */
export const RVD_STOCK_BY_CLASS: Readonly<Record<RvdClassKey, readonly (number | null)[]>> = {
  A: [247055,263945,274725,285635,291975,298450,304490,312293,320003,331410,335008,340594,347926,348187,354000,358723,361243,367870,343639,346005,348951,350455,351595,352064,351751,351879,352056,353023,354077,354926,355969,359725,366520,372678,378819,387593,392356,401220,409171,419027,427993,null],
  B: [242030,253355,270935,287215,308350,324440,342830,354346,368856,387931,399768,412440,428911,446920,468513,483877,501137,526741,478438,497599,509066,519498,526540,529797,532083,538439,542381,545791,548666,555833,560064,566338,572769,580630,584309,591556,596779,603284,608039,617894,624325,null],
  C: [55605,57965,60700,64240,68265,70670,75380,77419,80073,81977,85802,91144,93496,96750,102180,107699,110624,118417,112931,115963,118903,121404,122717,124651,125256,129921,132600,133563,134494,138437,140300,141559,142878,146108,147520,149969,151871,153769,154138,155088,156182,null],
  D: [30920,32435,33650,35995,37510,38710,39795,40339,40824,42543,44200,45623,47646,48573,49586,52082,53646,55351,51185,53336,53813,54778,55336,56142,57514,58521,59156,60658,61218,61975,63370,64719,65640,67343,68265,68959,69040,70016,69973,70982,71551,null],
  E: [16555,17375,17835,18740,19540,19900,20550,20676,20811,20782,20899,21439,22149,22826,23354,23724,24112,25068,21782,22068,22513,22763,23055,23268,24010,24149,24368,24897,25178,25259,25751,26424,26821,27212,27531,27771,27949,28433,28510,28965,29214,null],
};

/** All Classes together -- published by RVD, not summed here. */
export const RVD_STOCK_TOTAL: readonly (number | null)[] = [592165,625075,657845,691825,725640,752170,783045,805073,830567,864643,885677,911240,940128,963256,997633,1026105,1050762,1093447,1007975,1034971,1053246,1068898,1079243,1085922,1090614,1102909,1110561,1117932,1123633,1136430,1145454,1158765,1174628,1193971,1206444,1225848,1237995,1256722,1269831,1291956,1309265,null];

/** Flats standing empty at year end, by Class. */
export const RVD_VACANCY_UNITS_BY_CLASS: Readonly<
  Record<RvdClassKey, readonly (number | null)[]>
> = {
  A: [9085,10175,7220,5870,6135,5860,5860,8611,8303,10009,8143,8280,8186,8353,14837,13454,14181,17347,15391,12445,10661,11117,10228,9412,8718,9592,8067,8083,12426,8599,8331,9319,11761,14206,13819,15639,15023,18070,14727,18789,18997,null],
  B: [7845,9170,10560,7845,17620,13405,19660,18457,18060,22786,19970,16926,18934,23812,31624,26574,30786,36154,37319,34631,34677,36201,27857,27740,21843,24389,21739,22587,19707,20159,17784,20389,18764,20642,17791,21503,20917,21758,17701,23609,22378,null],
  C: [2420,2035,2255,3055,3450,3265,3955,4264,3490,4694,4625,5620,5477,6259,8287,9273,9798,13188,10269,9320,10666,8875,7838,8795,8206,9977,10188,8187,6076,7612,8711,5526,4789,7488,5481,8118,6920,7253,9851,7543,6960,null],
  D: [1930,2100,1515,2200,1840,2330,1895,1809,1296,2710,2776,2314,2296,3484,2974,4202,3819,4937,3480,5504,4865,3499,4144,4407,5541,4467,5443,5629,5457,4515,4771,4732,5627,5657,3991,4341,5121,5092,5617,4310,4776,null],
  E: [810,1185,780,1255,1250,1290,1635,928,1098,513,688,909,1090,1920,1417,1447,1823,2574,2322,2348,2670,2978,2402,2584,3039,3109,2478,3511,2901,2378,2438,3691,2001,3433,3810,2765,2183,2794,4250,3649,2970,null],
};

/** The same, as a percentage of that Class's stock. Converted from RVD's fractions. */
export const RVD_VACANCY_RATE_BY_CLASS: Readonly<
  Record<RvdClassKey, readonly (number | null)[]>
> = {
  A: [3.7,3.9,2.6,2.1,2.1,2,1.9,2.8,2.6,3,2.4,2.4,2.4,2.4,4.2,3.8,3.9,4.7,4.5,3.6,3.1,3.2,2.9,2.7,2.5,2.7,2.3,2.3,3.5,2.4,2.3,2.6,3.2,3.8,3.6,4,3.8,4.5,3.6,4.5,4.4,null],
  B: [3.2,3.6,3.9,2.7,5.7,4.1,5.7,5.2,4.9,5.9,5,4.1,4.4,5.3,6.7,5.5,6.1,6.9,7.8,7,6.8,7,5.3,5.2,4.1,4.5,4,4.1,3.6,3.6,3.2,3.6,3.3,3.6,3,3.6,3.5,3.6,2.9,3.8,3.6,null],
  C: [4.4,3.5,3.7,4.8,5.1,4.6,5.3,5.5,4.4,5.7,5.4,6.2,5.9,6.5,8.1,8.6,8.9,11.1,9.1,8,9,7.3,6.4,7.1,6.6,7.7,7.7,6.1,4.5,5.5,6.2,3.9,3.4,5.1,3.7,5.4,4.6,4.7,6.4,4.9,4.5,null],
  D: [6.2,6.5,4.5,6.1,4.9,6,4.8,4.5,3.2,6.4,6.3,5.1,4.8,7.2,6,8.1,7.1,8.9,6.8,10.3,9,6.4,7.5,7.8,9.6,7.6,9.2,9.3,8.9,7.3,7.5,7.3,8.6,8.4,5.8,6.3,7.4,7.3,8,6.1,6.7,null],
  E: [4.9,6.8,4.4,6.7,6.4,6.5,8,4.5,5.3,2.5,3.3,4.2,4.9,8.4,6.1,6.1,7.6,10.3,10.7,10.6,11.9,13.1,10.4,11.1,12.7,12.9,10.2,14.1,11.5,9.4,9.5,14,7.5,12.6,13.8,10,7.8,9.8,14.9,12.6,10.2,null],
};

/** Flats completed during the year, by Class. The newest year is provisional. */
export const RVD_COMPLETIONS_BY_CLASS: Readonly<
  Record<RvdClassKey, readonly (number | null)[]>
> = {
  A: [19930,17185,10990,10880,6930,7200,4665,8557,8056,9493,4096,2552,1278,1249,7271,2683,3257,4733,4738,2122,2408,1601,1029,871,373,689,636,1511,1423,2160,2135,3937,6891,7212,6622,9230,5251,9881,7806,10794,9859,3643],
  B: [6325,11875,18230,16630,22315,17525,23600,14267,15663,18649,12690,10500,13692,15987,20982,14753,16475,19984,17908,18225,10754,10664,7188,4897,2998,6742,4586,4496,4688,8446,5047,7162,7665,8237,4174,7742,6624,7668,4667,10705,6565,3295],
  C: [1660,2495,3140,3805,4565,2695,3380,2318,2975,4033,3877,5112,2449,3037,5451,6025,4320,7251,2349,3110,3091,2867,1516,1825,1369,4534,3101,1720,1207,4207,2190,1413,1794,3414,1506,2779,2141,2046,1060,1284,1245,698],
  D: [1440,1645,1465,2375,1790,1425,1155,713,737,1719,1589,1194,488,1454,1188,1998,1810,1289,1043,2112,582,1072,480,723,1530,1182,919,1827,573,666,1471,1325,1058,1541,1025,759,249,1052,157,913,614,246],
  E: [520,905,550,780,885,555,580,367,242,279,369,517,295,551,430,331,400,778,359,467,486,375,258,460,887,258,207,595,363,240,453,758,383,564,316,378,121,521,162,565,165,32],
};

/**
 * Take-up -- flats absorbed during the year. Split at 100 m\u00b2 saleable, which is the
 * Class C/D boundary, so "small" is Classes A-C and "large" is D-E.
 *
 * RVD did not publish the split before 1997; those years carry null on the two halves and a
 * real figure on the total.
 */
export const RVD_TAKEUP = {
  small: [null,null,null,null,null,29650,21900,21300,26360,22430,23490,18810,14760,13220,17070,28240,17220,19830,20080,30890,16150,14040,19300,6290,10420,5790,10770,6680,6390,14210,8970,11040,14867,11083,16751,10787,14101,13100,17507,13953,18433,null],
  large: [2000,1800,2650,1700,2700,1050,1450,1380,960,820,1220,1670,330,-170,2490,940,2100,100,2410,510,1300,2360,550,600,670,2240,630,870,1670,2310,1560,841,2087,540,2527,1758,10,912,-1837,3352,932,null],
  total: [29500,30300,35100,33900,23700,30700,23350,22680,27320,23250,24710,20480,15090,13050,19560,29180,19320,19930,22490,31400,17450,16400,19850,6890,11090,8030,11400,7550,8060,16520,10530,11881,16954,11623,19278,12545,14111,14012,15670,17305,19365,null],
} as const;

export interface RvdDemolitionRow {
  readonly year: number;
  /** "Hong Kong", "Kowloon", "New Territories" or "Overall" -- RVD's own regions. */
  readonly region: string;
  readonly byClass: Readonly<Record<RvdClassKey, number | null>>;
  readonly total: number | null;
}

/**
 * Units demolished, by Class and region. Supply removed, which nothing else here records --
 * completions minus demolition is the real change in stock, and in an ageing urban market the
 * second term is not negligible.
 *
 * Flat records rather than a padded matrix: two dozen rows on a short, irregular axis.
 * Rows include RVD's own "Overall" region; it is a published total, not a sum computed here.
 */
export const RVD_DEMOLITION: readonly RvdDemolitionRow[] = [
  { year: 2020, region: "Hong Kong", byClass: { A: 55, B: 148, C: 49, D: 10, E: 46 }, total: 308 },
  { year: 2020, region: "Kowloon", byClass: { A: 136, B: 288, C: 95, D: 10, E: 8 }, total: 537 },
  { year: 2020, region: "New Territories", byClass: { A: null, B: null, C: 24, D: null, E: null }, total: 24 },
  { year: 2020, region: "Overall", byClass: { A: 191, B: 436, C: 168, D: 20, E: 54 }, total: 869 },
  { year: 2021, region: "Hong Kong", byClass: { A: 234, B: 394, C: 54, D: 82, E: 25 }, total: 789 },
  { year: 2021, region: "Kowloon", byClass: { A: 472, B: 1076, C: 85, D: 26, E: 3 }, total: 1662 },
  { year: 2021, region: "New Territories", byClass: { A: null, B: null, C: null, D: 25, E: 1 }, total: 26 },
  { year: 2021, region: "Overall", byClass: { A: 706, B: 1470, C: 139, D: 133, E: 29 }, total: 2477 },
  { year: 2022, region: "Hong Kong", byClass: { A: 297, B: 164, C: null, D: 18, E: 33 }, total: 512 },
  { year: 2022, region: "Kowloon", byClass: { A: 857, B: 880, C: 76, D: 16, E: 8 }, total: 1837 },
  { year: 2022, region: "New Territories", byClass: { A: null, B: null, C: null, D: null, E: 4 }, total: 4 },
  { year: 2022, region: "Overall", byClass: { A: 1154, B: 1044, C: 76, D: 34, E: 45 }, total: 2353 },
  { year: 2023, region: "Hong Kong", byClass: { A: 58, B: 43, C: 61, D: 40, E: 15 }, total: 217 },
  { year: 2023, region: "Kowloon", byClass: { A: 127, B: 269, C: 270, D: 74, E: 44 }, total: 784 },
  { year: 2023, region: "New Territories", byClass: { A: null, B: null, C: null, D: null, E: 2 }, total: 2 },
  { year: 2023, region: "Overall", byClass: { A: 185, B: 312, C: 331, D: 114, E: 61 }, total: 1003 },
  { year: 2024, region: "Hong Kong", byClass: { A: 145, B: 361, C: 61, D: 2, E: 24 }, total: 593 },
  { year: 2024, region: "Kowloon", byClass: { A: 164, B: 390, C: 47, D: null, E: 8 }, total: 609 },
  { year: 2024, region: "New Territories", byClass: { A: null, B: null, C: null, D: null, E: null }, total: null },
  { year: 2024, region: "Overall", byClass: { A: 309, B: 751, C: 108, D: 2, E: 32 }, total: 1202 },
];

export const RVD_STOCK_AGE_BANDS: readonly string[] = ["Pre 1960", "1960-69", "1970-79", "1980-89", "1990-99", "2000-09", "Post 2009"];

export interface RvdStockAgeRow {
  readonly year: number;
  /** "Overall", "Small/Medium" (Classes A-C) or "Large" (D-E) -- RVD's own segments. */
  readonly segment: string;
  /** Percentage of that segment's stock completed in each band of `RVD_STOCK_AGE_BANDS`. */
  readonly sharePct: readonly (number | null)[];
  readonly totalUnits: number | null;
}

/**
 * The age profile of the private domestic stock.
 *
 * An investor signal the rest of this data cannot give: a district or segment whose stock is
 * mostly pre-1980 is one where maintenance, redevelopment and lease renewal are live
 * questions. Published territory-wide by segment only -- there is no per-district age
 * breakdown, which is why this is not in `market_observations`.
 */
export const RVD_STOCK_BY_AGE: readonly RvdStockAgeRow[] = [
  { year: 2016, segment: "Overall", sharePct: [2.7,12.6,16.5,23.8,20.9,16.4,7.1], totalUnits: 1158765 },
  { year: 2016, segment: "Small/Medium", sharePct: [2.5,12.7,16.6,24.1,21.2,16.2,6.7], totalUnits: 1067622 },
  { year: 2016, segment: "Large", sharePct: [4.4,11.5,14.8,22.2,16.8,18.3,12], totalUnits: 91143 },
  { year: 2017, segment: "Overall", sharePct: [2.6,12.4,16.2,23.4,20.6,16.2,8.6], totalUnits: 1174628 },
  { year: 2017, segment: "Small/Medium", sharePct: [2.5,12.5,16.4,23.6,20.9,16,8.1], totalUnits: 1082167 },
  { year: 2017, segment: "Large", sharePct: [4.3,11.2,14.6,21.8,16.6,18.1,13.4], totalUnits: 92461 },
  { year: 2018, segment: "Overall", sharePct: [2.6,12.1,16,23,20.2,15.9,10.2], totalUnits: 1193971 },
  { year: 2018, segment: "Small/Medium", sharePct: [2.4,12.2,16.1,23.4,20.5,15.7,9.7], totalUnits: 1099416 },
  { year: 2018, segment: "Large", sharePct: [4.2,11,14.3,21.3,16.2,17.7,15.3], totalUnits: 94555 },
  { year: 2019, segment: "Overall", sharePct: [2.5,12,15.8,22.8,20,15.7,11.2], totalUnits: 1206444 },
  { year: 2019, segment: "Small/Medium", sharePct: [2.3,12.1,15.9,23.1,20.3,15.6,10.7], totalUnits: 1110648 },
  { year: 2019, segment: "Large", sharePct: [4.1,10.8,14.1,21,16,17.5,16.5], totalUnits: 95796 },
  { year: 2020, segment: "Overall", sharePct: [2.4,11.8,15.5,22.5,19.6,15.5,12.7], totalUnits: 1225848 },
  { year: 2020, segment: "Small/Medium", sharePct: [2.3,11.9,15.7,22.5,20,15.3,12.3], totalUnits: 1129118 },
  { year: 2020, segment: "Large", sharePct: [4,10.7,13.9,20.8,15.8,17.3,17.5], totalUnits: 96730 },
  { year: 2021, segment: "Overall", sharePct: [2.3,11.6,15.4,22.3,19.4,15.3,13.7], totalUnits: 1237995 },
  { year: 2021, segment: "Small/Medium", sharePct: [2.1,11.7,15.5,22.4,19.8,15.1,13.4], totalUnits: 1141006 },
  { year: 2021, segment: "Large", sharePct: [3.9,10.6,13.9,20.7,15.8,17.3,17.8], totalUnits: 96989 },
  { year: 2022, segment: "Overall", sharePct: [2.1,11.3,15.1,22,19.2,15.1,15.2], totalUnits: 1256722 },
  { year: 2022, segment: "Small/Medium", sharePct: [2,11.4,15.3,22,19.5,14.9,14.9], totalUnits: 1158273 },
  { year: 2022, segment: "Large", sharePct: [3.9,10.4,13.6,20.5,15.5,17,19.1], totalUnits: 98449 },
  { year: 2023, segment: "Overall", sharePct: [2.1,11.2,15,21.6,19,14.9,16.2], totalUnits: 1269831 },
  { year: 2023, segment: "Small/Medium", sharePct: [2,11.2,15.1,21.9,19.2,14.7,15.9], totalUnits: 1171348 },
  { year: 2023, segment: "Large", sharePct: [3.8,10.2,13.6,20.5,15.5,17,19.4], totalUnits: 98483 },
  { year: 2024, segment: "Overall", sharePct: [2,10.9,14.7,21.3,18.6,14.7,17.8], totalUnits: 1291956 },
  { year: 2024, segment: "Small/Medium", sharePct: [1.8,11,14.8,21.4,18.9,14.5,17.6], totalUnits: 1192009 },
  { year: 2024, segment: "Large", sharePct: [3.7,10,13.4,20.3,15.3,16.8,20.5], totalUnits: 99947 },
];
