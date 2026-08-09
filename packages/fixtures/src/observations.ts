import { DEMO_DISTRICTS, SYNTHETIC, type DemoDistrict } from "./districts.js";

/**
 * ⚠️ SYNTHETIC DEMO DATA — every number below is generated, not measured.
 *
 * The *shapes* are plausible so the UI can be judged: vacancy hovers in the low
 * single digits and drifts slowly, transaction counts are seasonal and far noisier.
 * That is the point of the fixture — to exercise the chart with realistic dynamics.
 * It is not a forecast, a benchmark, or a substitute for the RVD Property Review and
 * the Land Registry monthly statistics.
 */

/** mulberry32 — small, fast, deterministic. Same seed, same series, forever. */
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

export type DemoMetric =
  | "vacancy_rate"
  | "transaction_count"
  | "price_index"
  | "rent_index"
  | "avg_price_psf"
  | "avg_rent_psf"
  | "price_yoy_change"
  | "turnover_rate";

export const DEMO_METRICS: Record<
  DemoMetric,
  {
    readonly label: string;
    readonly side: "supply" | "demand";
    readonly unit: string;
    readonly realSource: string;
    /** Fewer is better for vacancy; more is better for transactions. */
    readonly highIsHot: boolean;
    readonly decimals: number;
    /** The chart's y-axis floors at 0 for every metric here except this one — right for
     *  a count or a level, which can't go negative, but `price_yoy_change` genuinely
     *  can (a cooling district reads negative some months), and clamping its axis at 0
     *  would clip exactly the readings that make the metric worth having. Explicit per
     *  metric rather than inferred from `unit`, the way `series-chart.tsx` used to
     *  single out `"per month"` — that string-match was already one metric away from
     *  breaking; this is the metric that broke it. */
    readonly allowNegative: boolean;
    /** Whether the axis *starts* exactly at 0, rather than padding around whatever
     *  range the data actually covers — right for a small count, where an axis
     *  starting at 200 would exaggerate every wiggle; wrong for everything else here,
     *  where the real range sits far from 0 and starting there would flatten five
     *  years of movement against the top of the chart. Also now an explicit field
     *  rather than a `unit === "per month"` string-match. */
    readonly zeroAnchored: boolean;
  }
> = {
  vacancy_rate: {
    label: "Vacancy rate",
    side: "supply",
    unit: "%",
    realSource: "RVD Hong Kong Property Review",
    highIsHot: false,
    decimals: 1,
    allowNegative: false,
    zeroAnchored: false,
  },
  transaction_count: {
    label: "Transactions",
    side: "demand",
    unit: "per month",
    realSource: "Land Registry monthly statistics",
    highIsHot: true,
    decimals: 0,
    allowNegative: false,
    zeroAnchored: true,
  },
  price_index: {
    label: "Price index",
    side: "demand",
    unit: "index (Aug 2021=100)",
    realSource: "RVD Property Review — Price Indices for Selected Popular Developments",
    highIsHot: true,
    decimals: 1,
    allowNegative: false,
    zeroAnchored: false,
  },
  rent_index: {
    label: "Rent index",
    side: "demand",
    unit: "index (Aug 2021=100)",
    realSource: "RVD Property Review — rental index",
    highIsHot: true,
    decimals: 1,
    allowNegative: false,
    zeroAnchored: false,
  },
  // Three more, added against the standard real-estate KPI list (insightsoftware's
  // "Real Estate KPIs and Metrics"), checked one by one against whether a Hong Kong
  // government body actually publishes it *by district* — most of that list didn't
  // survive the check: agent-productivity metrics (commission per sale, calls made,
  // listing-to-meeting ratio), per-project figures (ROI, IRR, payback period,
  // construction cost/sqft) and territory-wide banking figures (average mortgage
  // rate, LTV) either have no district-level public source or aren't a market
  // reading at all — adding them here would mean inventing a number this file's own
  // header rule ("not a forecast, a benchmark, or a substitute for the RVD... and
  // Land Registry") exists to prevent. These three are the ones that survived: an
  // absolute price level and rent level (the KPI list's "Average Rent Price", given a
  // Hong Kong unit — everyone here quotes $/ft², not a lump sum) alongside the two
  // existing indices, which show *shape* but not the actual number a reader would
  // recognise; and year-over-year price change, the list's own "Year-over-Year
  // Variance of Average Sold Price", the standard momentum reading derived from
  // exactly the index series already here.
  avg_price_psf: {
    label: "Average price",
    side: "demand",
    unit: "HK$/ft²",
    realSource: "RVD Property Market Statistics — average prices by Class and district",
    highIsHot: true,
    decimals: 0,
    allowNegative: false,
    zeroAnchored: false,
  },
  avg_rent_psf: {
    label: "Average rent",
    side: "demand",
    unit: "HK$/ft²/month",
    realSource: "RVD Property Market Statistics — average rents by Class and district",
    highIsHot: true,
    decimals: 1,
    allowNegative: false,
    zeroAnchored: false,
  },
  price_yoy_change: {
    label: "Price change, YoY",
    side: "demand",
    unit: "%",
    realSource: "RVD Property Review price index, compared to the same month a year earlier",
    highIsHot: true,
    allowNegative: true,
    zeroAnchored: false,
    decimals: 1,
  },
  // An eighth metric, added after being asked directly whether every KPI on the
  // insightsoftware list had actually been checked — it hadn't. This one, "Sold Homes
  // per Available Inventory" on that list, was flagged as plausible and then not
  // followed through on; checked properly this time, against RVD's own Hong Kong
  // Property Review, which publishes stock, completions and take-up by district every
  // year (HKPR2025: 19,370 units taken up against total stock, by district). The real
  // metric is annual; this reads it monthly as a trailing-12-month rate to match every
  // other series here, same as `price_yoy_change` reads the price index over a rolling
  // window rather than the index's own single snapshots.
  turnover_rate: {
    label: "Turnover rate",
    side: "demand",
    unit: "%",
    realSource: "RVD Hong Kong Property Review — stock, completions and take-up by district",
    highIsHot: true,
    decimals: 2,
    allowNegative: false,
    zeroAnchored: false,
  },
};

export interface DemoPoint {
  readonly periodStart: string; // YYYY-MM-01
  readonly value: number;
}

export interface DemoSeries {
  readonly districtId: string;
  readonly metric: DemoMetric;
  readonly points: readonly DemoPoint[];
  readonly source: typeof SYNTHETIC;
}

const MONTHS = 60; // five years, monthly — matches RVD's real publication cadence
const START_YEAR = 2021;
const START_MONTH = 8; // August 2021 → July 2026

function periodAt(index: number): string {
  const raw = START_MONTH - 1 + index;
  const year = START_YEAR + Math.floor(raw / 12);
  const month = (raw % 12) + 1;
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

export const DEMO_PERIODS: readonly string[] = Array.from({ length: MONTHS }, (_, i) =>
  periodAt(i),
);

function vacancySeries(d: DemoDistrict): DemoPoint[] {
  const rand = prng(d.seed);
  // Each district gets its own baseline so the choropleth has spread to show.
  let level = 2.4 + rand() * 4.2;
  const drift = (rand() - 0.5) * 0.045;

  return DEMO_PERIODS.map((periodStart) => {
    level += drift + (rand() - 0.5) * 0.22;
    level = Math.min(9.5, Math.max(0.6, level));
    return { periodStart, value: Number(level.toFixed(2)) };
  });
}

/** The monthly transaction counts `transactionSeries` plots, exposed on their own for
 *  the same reason `indexLevels` is: `turnover_rate` needs a trailing-12-month sum of
 *  take-up, and the first visible month can't have one without months before the window
 *  `DEMO_PERIODS` covers. `warmupMonths` extra draws from the same seed supply them. */
function transactionLevels(d: DemoDistrict, warmupMonths: number): number[] {
  const rand = prng(d.seed + 5000);
  const base = 90 + rand() * 520;
  const levels: number[] = [];
  for (let i = 0; i < warmupMonths + MONTHS; i += 1) {
    // Seasonality: spring and autumn are the active seasons in HK residential.
    const month = i % 12;
    const seasonal = 1 + 0.22 * Math.sin(((month - 2) / 12) * Math.PI * 2);
    // A slow cycle so five years shows a real up-and-down, not a straight line.
    const cycle = 1 + 0.28 * Math.sin((i / MONTHS) * Math.PI * 2.2);
    const noise = 0.82 + rand() * 0.36;
    levels.push(Math.max(8, Math.round(base * seasonal * cycle * noise)));
  }
  return levels;
}

function transactionSeries(d: DemoDistrict): DemoPoint[] {
  const levels = transactionLevels(d, 0);
  return DEMO_PERIODS.map((periodStart, i) => ({ periodStart, value: levels[i]! }));
}

/** Trailing-12-month take-up over that month's stock — the standard turnover/absorption
 *  reading, "Sold Homes per Available Inventory" on the KPI list this batch of metrics
 *  was checked against. The transaction side draws from the same seed offset as
 *  `transactionSeries` (`+5000`) — the same underlying monthly-activity shape, read two
 *  different ways, rather than an independent random walk that happens to share a
 *  chart.
 *
 *  **Stock is anchored to a plausible turnover rate, not drawn independently — a real
 *  bug caught before this shipped.** Housing stock (total private domestic units
 *  standing in a district) moves nothing like transactions: completions add a few
 *  hundred to a few thousand units a year against tens of thousands already standing.
 *  The first version picked stock at random too, in a plausible-looking district-size
 *  range — and Hong Kong's *real* housing turnover is a low single-digit percentage
 *  (stamp duties and long holding periods keep it there), but two independently random
 *  ranges don't know that about each other: a small-stock, high-transaction-volume
 *  district combination implied turnover above 25% in testing, nothing like the real
 *  market. Anchoring stock to a target rate (1.2%–4.5%, applied to the district's own
 *  annual take-up) keeps every district's ratio inside a realistic band by
 *  construction, and still lets it drift over the five years as transactions swing
 *  seasonally and stock grows slowly underneath it. */
function turnoverRateSeries(d: DemoDistrict): DemoPoint[] {
  const WARMUP = 12;
  const monthlyTransactions = transactionLevels(d, WARMUP);
  const rand = prng(d.seed + 30_000);

  const annualTakeUpAtStart = monthlyTransactions.slice(0, 12).reduce((sum, v) => sum + v, 0);
  const targetAnnualRate = (1.2 + rand() * 3.3) / 100; // 1.2%–4.5%, roughly today's real spread
  let stock = annualTakeUpAtStart / targetAnnualRate;
  const monthlyGrowth = rand() * 0.001;

  const stockAtIndex: number[] = [];
  for (let i = 0; i < WARMUP + MONTHS; i += 1) {
    stock *= 1 + monthlyGrowth;
    stockAtIndex.push(stock);
  }

  return DEMO_PERIODS.map((periodStart, i) => {
    const idx = WARMUP + i;
    let trailingSum = 0;
    for (let k = idx - 11; k <= idx; k += 1) trailingSum += monthlyTransactions[k]!;
    const rate = (trailingSum / stockAtIndex[idx]!) * 100;
    return { periodStart, value: Number(rate.toFixed(2)) };
  });
}

/** The compounding random-walk levels an index series is built from, exposed on its own
 *  so a *derived* reading (year-over-year change) can share the exact same underlying
 *  path instead of drawing a second, unrelated walk from the same seed offset.
 *  `warmupMonths` extra steps run before the window `DEMO_PERIODS` actually covers —
 *  the only way a "12 months ago" comparison has anything to compare the first visible
 *  month against. */
function indexLevels(
  d: DemoDistrict,
  seedOffset: number,
  monthlyDrift: number,
  noise: number,
  warmupMonths: number,
): number[] {
  const rand = prng(d.seed + seedOffset);
  let level = 100;
  const drift = monthlyDrift + rand() * monthlyDrift;
  const levels: number[] = [];
  for (let i = 0; i < warmupMonths + MONTHS; i += 1) {
    level *= 1 + drift + (rand() - 0.5) * noise;
    levels.push(level);
  }
  return levels;
}

/** An index series, rebased to 100 at the start of the window — the shape RVD's own
 *  price and rent indices take. Slow compounding drift plus small monthly noise, not a
 *  straight line, so five years reads as a real market rather than a ruler. */
function indexSeries(d: DemoDistrict, seedOffset: number, monthlyDrift: number, noise: number): DemoPoint[] {
  const levels = indexLevels(d, seedOffset, monthlyDrift, noise, 0);
  return DEMO_PERIODS.map((periodStart, i) => ({ periodStart, value: Number(levels[i]!.toFixed(1)) }));
}

function priceIndexSeries(d: DemoDistrict): DemoPoint[] {
  return indexSeries(d, 9_000, 0.004, 0.011);
}

function rentIndexSeries(d: DemoDistrict): DemoPoint[] {
  // Rents move with less amplitude than prices in Hong Kong's real series — asset
  // prices swing on sentiment and rates in a way rents, tied to income, mostly don't.
  return indexSeries(d, 14_000, 0.0025, 0.007);
}

/** HK$/ft² is the unit Hong Kong actually quotes in — the index series above show
 *  *shape*, not a number a reader would recognise. Same random-walk family as
 *  `priceIndexSeries` (a fresh seed offset, not a shared one — a real per-district price
 *  level and a rebased-to-100 index aren't the same walk, just siblings), scaled onto a
 *  plausible Hong Kong range instead of starting at 100. */
function avgPricePsfSeries(d: DemoDistrict): DemoPoint[] {
  const rand = prng(d.seed + 20_000);
  let level = 8_000 + rand() * 17_000; // HK$8,000–25,000/ft², roughly today's real spread
  const drift = (rand() - 0.5) * 0.003;
  return DEMO_PERIODS.map((periodStart) => {
    level = Math.max(3_000, level * (1 + drift + (rand() - 0.5) * 0.01));
    return { periodStart, value: Math.round(level) };
  });
}

function avgRentPsfSeries(d: DemoDistrict): DemoPoint[] {
  const rand = prng(d.seed + 25_000);
  let level = 25 + rand() * 45; // HK$25–70/ft²/month
  const drift = (rand() - 0.5) * 0.002;
  return DEMO_PERIODS.map((periodStart) => {
    level = Math.max(10, level * (1 + drift + (rand() - 0.5) * 0.008));
    return { periodStart, value: Number(level.toFixed(1)) };
  });
}

/** The article this batch of metrics was checked against calls this "Year-over-Year
 *  Variance of Average Sold Price" — the standard momentum reading, and the one new
 *  metric here that isn't a fresh series at all, just a different way of reading the
 *  one `priceIndexSeries` already draws. Same seed offset as that series on purpose:
 *  this is "the price index's own 12-month change," not an independently random figure
 *  that happens to share a chart. */
function priceYoyChangeSeries(d: DemoDistrict): DemoPoint[] {
  const WARMUP = 12;
  const levels = indexLevels(d, 9_000, 0.004, 0.011, WARMUP);
  return DEMO_PERIODS.map((periodStart, i) => {
    const current = levels[WARMUP + i]!;
    const yearAgo = levels[i]!;
    return { periodStart, value: Number((((current - yearAgo) / yearAgo) * 100).toFixed(1)) };
  });
}

const SERIES_BUILDERS: Record<DemoMetric, (d: DemoDistrict) => DemoPoint[]> = {
  vacancy_rate: vacancySeries,
  transaction_count: transactionSeries,
  price_index: priceIndexSeries,
  rent_index: rentIndexSeries,
  avg_price_psf: avgPricePsfSeries,
  avg_rent_psf: avgRentPsfSeries,
  price_yoy_change: priceYoyChangeSeries,
  turnover_rate: turnoverRateSeries,
};

const CACHE = new Map<string, DemoSeries>();

export function demoSeries(districtId: string, metric: DemoMetric): DemoSeries {
  const key = `${districtId}:${metric}`;
  const hit = CACHE.get(key);
  if (hit !== undefined) return hit;

  const district = DEMO_DISTRICTS.find((d) => d.id === districtId);
  if (district === undefined) {
    throw new Error(`Unknown demo district: ${districtId}`);
  }

  const built: DemoSeries = {
    districtId,
    metric,
    points: SERIES_BUILDERS[metric](district),
    source: SYNTHETIC,
  };
  CACHE.set(key, built);
  return built;
}

/** Latest value per district, for colouring the choropleth. */
export function demoLatest(
  metric: DemoMetric,
  periodStart?: string,
): ReadonlyMap<string, number> {
  const out = new Map<string, number>();
  for (const d of DEMO_DISTRICTS) {
    const series = demoSeries(d.id, metric);
    const point =
      periodStart === undefined
        ? series.points[series.points.length - 1]
        : series.points.find((p) => p.periodStart === periodStart);
    if (point !== undefined) out.set(d.id, point.value);
  }
  return out;
}

export function formatDemoValue(metric: DemoMetric, value: number): string {
  const meta = DEMO_METRICS[metric];
  const n = value.toLocaleString("en-HK", {
    minimumFractionDigits: meta.decimals,
    maximumFractionDigits: meta.decimals,
  });
  return meta.unit === "%" ? `${n}%` : n;
}

export function formatPeriod(periodStart: string): string {
  const [year, month] = periodStart.split("-");
  const names = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const idx = Number(month) - 1;
  return `${names[idx] ?? month} ${year}`;
}
