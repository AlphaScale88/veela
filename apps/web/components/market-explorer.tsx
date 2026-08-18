"use client";

import {
  DEMO_DISTRICTS,
  DEMO_METRICS,
  DEMO_NOTICE,
  DEMO_PERIODS,
  demoLatest,
  demoSeries,
  formatDemoValue,
  formatPeriod,
  type DemoMetric,
} from "@veela/fixtures";
import { sequentialBin } from "@veela/ui";
import { useEffect, useMemo, useState } from "react";

import { Choropleth } from "./choropleth";
import { DistrictKpiSummary } from "./district-kpi-summary";
import { DistrictOverview } from "./district-overview";
import { DistrictMap, normaliseDistrictValues } from "./district-map";
import { SeriesChart } from "./series-chart";

const RANGES = [
  { id: "12", label: "Last 12 months", months: 12 },
  { id: "36", label: "Last 3 years", months: 36 },
  { id: "60", label: "All 5 years", months: 60 },
] as const;

type RangeId = (typeof RANGES)[number]["id"];

/**
 * The metrics that are **actually measured**, served from `market_observations` via
 * `GET /api/market/latest`. Everything else on this page is still generated — see
 * `DEMO_METRICS`.
 *
 * **All five are a single annual observation, not a series**, which is the whole reason
 * they get different treatment below rather than being folded into the metric dropdown
 * as if they were interchangeable with the synthetic ones: RVD publishes district stock,
 * completions and vacancy once a year in the Property Review, and the Census runs every
 * ten years. There is no monthly district-level history to plot, so selecting one of
 * these colours the map and shows the observation with its source — it does not draw a
 * five-year trend line that would have to be invented.
 */
const REAL_METRICS = {
  vacancy_rate: { label: "Vacancy rate", unit: "%", decimals: 1, highIsHot: false },
  stock_units: { label: "Stock", unit: "units", decimals: 0, highIsHot: true },
  completions_units: { label: "Completions", unit: "units", decimals: 0, highIsHot: true },
  population: { label: "Population", unit: "people", decimals: 0, highIsHot: true },
  households: { label: "Households", unit: "households", decimals: 0, highIsHot: true },
} as const;

type RealMetric = keyof typeof REAL_METRICS;

function isRealMetric(m: string): m is RealMetric {
  return m in REAL_METRICS;
}

function formatRealValue(metric: RealMetric, value: number): string {
  const meta = REAL_METRICS[metric];
  const n = value.toLocaleString("en-HK", {
    minimumFractionDigits: meta.decimals,
    maximumFractionDigits: meta.decimals,
  });
  return meta.unit === "%" ? `${n}%` : n;
}

interface RealObservation {
  readonly districtId: string;
  readonly value: number;
  readonly periodStart: string;
  readonly source: string;
}

/**
 * The map view. Filters sit in **one row above everything they scope**, so the map,
 * both charts and the table always agree about which slice is on screen.
 */
export function MarketExplorer(): React.JSX.Element {
  // One selector covers both families; `isRealMetric` decides which path renders. The
  // default is the real one — showing measured data first is the point.
  const [selected, setSelected] = useState<string>("stock_units");
  const [rangeId, setRangeId] = useState<RangeId>("60");
  const [districtId, setDistrictId] = useState<string>("HK-WCH");
  const [showTable, setShowTable] = useState(false);
  const [real, setReal] = useState<readonly RealObservation[] | null>(null);
  const [realFailed, setRealFailed] = useState(false);

  const realMetric = isRealMetric(selected) ? selected : null;
  // The synthetic metric to fall back on for the charts below, which only ever have
  // synthetic data to draw.
  const metric: DemoMetric = isRealMetric(selected) ? "vacancy_rate" : (selected as DemoMetric);

  const months = RANGES.find((r) => r.id === rangeId)?.months ?? 60;
  const periodStart = DEMO_PERIODS[DEMO_PERIODS.length - 1];

  // Refetched per metric. `DATABASE_URL` may be unset (the zero-configuration rule), so a
  // failure here is expected, not exceptional — it falls back to the synthetic map and
  // says so, rather than rendering an empty one.
  useEffect(() => {
    if (realMetric === null) return;
    let cancelled = false;
    setReal(null);
    setRealFailed(false);
    fetch(`/api/market/latest?metric=${realMetric}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((json: { values: readonly RealObservation[] }) => {
        if (!cancelled) setReal(json.values);
      })
      .catch(() => {
        if (!cancelled) setRealFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [realMetric]);

  const demoValues = useMemo(() => demoLatest(metric, periodStart), [metric, periodStart]);

  const values = useMemo(() => {
    if (realMetric === null || real === null) return demoValues;
    return new Map(real.map((r) => [r.districtId, r.value]));
  }, [realMetric, real, demoValues]);

  const realSource = real?.[0]?.source;
  const realPeriod = real?.[0]?.periodStart;

  /**
   * Public by necessity — a browser map key is visible to anyone with dev tools, which
   * is why Google's own guidance is to restrict it by HTTP referrer rather than to hide
   * it. Absent means "render the schematic map", not "crash".
   */
  const mapsKey = process.env["NEXT_PUBLIC_GOOGLE_MAPS_API_KEY"];

  // Shared with the landing-page preview — see district-map.tsx — so the two cannot
  // disagree about what a colour or a circle size means.
  const mapData = useMemo(
    () =>
      normaliseDistrictValues(
        values,
        metric,
        realMetric === null ? undefined : (v) => formatRealValue(realMetric, v),
      ),
    [values, metric, realMetric],
  );

  const district = DEMO_DISTRICTS.find((d) => d.id === districtId) ?? DEMO_DISTRICTS[0];
  const districtName = district?.nameEn ?? "—";

  const vacancy = useMemo(
    () => demoSeries(districtId, "vacancy_rate").points.slice(-months),
    [districtId, months],
  );
  const transactions = useMemo(
    () => demoSeries(districtId, "transaction_count").points.slice(-months),
    [districtId, months],
  );

  const numbers = [...values.values()];
  const min = Math.min(...numbers);
  const max = Math.max(...numbers);

  const ranked = [...DEMO_DISTRICTS]
    .map((d) => ({ d, value: values.get(d.id) ?? 0 }))
    .sort((a, b) => b.value - a.value);

  return (
    <div className="space-y-6">
      <MetricProvenanceBanner
        realMetric={realMetric}
        source={realSource}
        period={realPeriod}
        failed={realFailed}
        loading={realMetric !== null && real === null && !realFailed}
      />

      {/* One filter row, above everything it scopes, in its own card — the floating
          toolbar shape a marketplace filter bar takes, rather than a bare row sitting
          directly on the page. */}
      <div className="card flex flex-wrap items-end gap-4 py-4">
        {/* Two optgroups, because the difference between them is the single most
            important thing about a number on this page. Measured first. */}
        <label className="text-xs">
          <span className="block text-muted">Metric</span>
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="mt-1 rounded-card border border-line bg-surfaceMuted px-2.5 py-1.5 text-sm text-mist outline-none focus:border-accent focus:bg-surface"
          >
            <optgroup label="Measured — RVD &amp; Census">
              {(Object.keys(REAL_METRICS) as RealMetric[]).map((m) => (
                <option key={m} value={m}>
                  {REAL_METRICS[m].label}
                </option>
              ))}
            </optgroup>
            <optgroup label="Generated — demo only">
              {(Object.keys(DEMO_METRICS) as DemoMetric[]).map((m) => (
                <option key={m} value={m}>
                  {DEMO_METRICS[m].label} ({DEMO_METRICS[m].side})
                </option>
              ))}
            </optgroup>
          </select>
        </label>

        <label className="text-xs">
          <span className="block text-muted">Range</span>
          <select
            value={rangeId}
            onChange={(e) => setRangeId(e.target.value as RangeId)}
            className="mt-1 rounded-card border border-line bg-surfaceMuted px-2.5 py-1.5 text-sm text-mist outline-none focus:border-accent focus:bg-surface"
          >
            {RANGES.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs">
          <span className="block text-muted">District</span>
          <select
            value={districtId}
            onChange={(e) => setDistrictId(e.target.value)}
            className="mt-1 rounded-card border border-line bg-surfaceMuted px-2.5 py-1.5 text-sm text-mist outline-none focus:border-accent focus:bg-surface"
          >
            {DEMO_DISTRICTS.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nameEn}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={() => setShowTable((s) => !s)}
          className="btn-secondary ml-auto !px-4 !py-2 !text-xs"
          aria-expanded={showTable}
        >
          {showTable ? "Hide table" : "Table view"}
        </button>
      </div>

      {/* The KPI tiles are all synthetic, so clicking one selects a synthetic metric —
          which correctly flips the banner above back to "Generated figures". */}
      {/* The real figures first, then the demo series. The order is the disclosure: everything in
          `DistrictOverview` is published by the RVD or the Census and carries its own period, while
          `DistrictKpiSummary` below it drives the map from generated series and says so. Putting
          the synthetic block first would have let it borrow the credibility of the real one. */}
      <DistrictOverview districtId={districtId} districtName={districtName} />

      <DistrictKpiSummary districtId={districtId} districtName={districtName} onSelectMetric={setSelected} />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div>
          {mapsKey === undefined || mapsKey === "" ? (
            /* No key, no Google Maps — and the app still has to work. The schematic
               map is the fallback rather than an empty box, and it says outright that
               it is not a coastline so nobody mistakes it for one. */
            <>
              <Choropleth
                metric={metric}
                values={values}
                selectedId={districtId}
                onSelect={setDistrictId}
              />
              <p className="mt-3 border-l-2 border-caution pl-4 text-xs leading-relaxed text-muted">
                <strong className="text-mist">Schematic outlines.</strong> Set{" "}
                <code className="font-mono">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> for the
                real basemap. These shapes are generated blobs, not a coastline — the
                relative positions are roughly right and nothing else is.
              </p>
            </>
          ) : (
            <>
              <DistrictMap
                data={mapData}
                selectedId={districtId}
                onSelect={setDistrictId}
                metricLabel={DEMO_METRICS[metric].label}
              />
              <p className="mt-3 text-xs leading-relaxed text-muted">
                Circle <strong className="text-mist">area</strong> carries the value, not
                its radius — area is what the eye compares. Districts are drawn at their
                centres because we have no boundary geometry yet; a symbol sits near a
                district, never on its edge.
              </p>
            </>
          )}
        </div>

        {/* Small multiples: same x, own y. Never two y-scales on one plot. */}
        <div className="card space-y-6">
          <SeriesChart metric="vacancy_rate" points={vacancy} districtName={districtName} />
          <div className="h-px bg-line" />
          <SeriesChart
            metric="transaction_count"
            points={transactions}
            districtName={districtName}
          />
          <p className="text-[11px] leading-relaxed text-muted">
            Two panels rather than one chart with two axes: a percentage and a count
            share no scale, so overlaying them would invent a correlation. Read them
            together — vacancy rising while transactions fall is the supply/demand
            signal worth acting on.
          </p>
        </div>
      </div>

      {showTable && (
        <div className="card overflow-x-auto p-0">
          <table className="w-full min-w-[32rem] text-sm">
            <caption className="px-4 py-2.5 text-left text-xs text-muted">
              {realMetric === null ? (
                <>
                  {DEMO_METRICS[metric].label} by district,{" "}
                  {formatPeriod(periodStart ?? "")}. Synthetic values.
                </>
              ) : (
                <>
                  {REAL_METRICS[realMetric].label} by district
                  {realPeriod === undefined ? "" : `, ${realPeriod.slice(0, 4)}`}.{" "}
                  <strong className="text-mist">Measured</strong> — {realSource}.
                </>
              )}
            </caption>
            <thead>
              <tr className="border-y border-line bg-surfaceMuted text-left text-xs text-muted">
                <th scope="col" className="px-4 py-2 font-medium">District</th>
                <th scope="col" className="px-4 py-2 font-medium">Region</th>
                <th scope="col" className="px-4 py-2 text-right font-medium">
                  {realMetric === null
                    ? DEMO_METRICS[metric].label
                    : REAL_METRICS[realMetric].label}
                </th>
              </tr>
            </thead>
            <tbody>
              {ranked.map(({ d, value }) => (
                <tr
                  key={d.id}
                  className={`border-b border-line/60 ${d.id === districtId ? "bg-surfaceMuted" : ""}`}
                >
                  <th scope="row" className="px-4 py-2 text-left font-normal text-mist">
                    <button
                      type="button"
                      onClick={() => setDistrictId(d.id)}
                      className="flex items-center gap-2 text-left hover:underline"
                    >
                      <span
                        aria-hidden
                        className="inline-block size-2.5 shrink-0 rounded-[2px]"
                        style={{ background: sequentialBin(value, min, max) }}
                      />
                      {d.nameEn}
                    </button>
                  </th>
                  <td className="px-4 py-2 text-muted">{d.region}</td>
                  <td className="tnum px-4 py-2 text-right text-mist">
                    {realMetric === null
                      ? formatDemoValue(metric, value)
                      : formatRealValue(realMetric, value)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/**
 * Replaces the old blanket `DEMO_NOTICE` ("none of it is wired up yet"), which stopped
 * being true on 09/08/2026 when RVD and Census figures were ingested. A banner that
 * over-disclaims is its own kind of wrong: it trains the reader to discount everything,
 * including the measured numbers. So this states which family is on screen right now
 * rather than making one claim about the whole page.
 */
function MetricProvenanceBanner({
  realMetric,
  source,
  period,
  failed,
  loading,
}: {
  readonly realMetric: RealMetric | null;
  readonly source: string | undefined;
  readonly period: string | undefined;
  readonly failed: boolean;
  readonly loading: boolean;
}): React.JSX.Element {
  if (realMetric === null) {
    return (
      <div className="rounded-panel border border-caution/40 bg-caution/10 px-4 py-3 shadow-card">
        <p className="text-sm font-semibold text-mist">Generated figures</p>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          District names are real; the values for this metric are generated with a
          plausible shape. No free source publishes it monthly by district — switch the
          metric to one under <strong className="text-mist">Measured</strong> for real RVD
          and Census figures.
        </p>
      </div>
    );
  }

  if (failed) {
    return (
      <div className="rounded-panel border border-caution/40 bg-caution/10 px-4 py-3 shadow-card">
        <p className="text-sm font-semibold text-mist">Measured figures unavailable</p>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          This metric is real, but the database didn&apos;t answer — the map below is
          showing generated values instead. Nothing here is a measurement right now.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-panel border border-positive/40 bg-positive/10 px-4 py-3 shadow-card">
      <p className="text-sm font-semibold text-mist">
        Measured — {REAL_METRICS[realMetric].label}
        {loading ? " (loading…)" : ""}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-muted">
        {source ?? "Rating and Valuation Department / Census and Statistics Department"}
        {period === undefined ? "" : `, ${period.slice(0, 4)}`}. A single annual
        observation per district, not a monthly series — the charts further down are still
        generated, and say so.
      </p>
    </div>
  );
}
