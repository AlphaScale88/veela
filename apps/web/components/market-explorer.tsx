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
import { useMemo, useState } from "react";

import { Choropleth } from "./choropleth";
import { DistrictKpiSummary } from "./district-kpi-summary";
import { DistrictMap, normaliseDistrictValues } from "./district-map";
import { SeriesChart } from "./series-chart";

const RANGES = [
  { id: "12", label: "Last 12 months", months: 12 },
  { id: "36", label: "Last 3 years", months: 36 },
  { id: "60", label: "All 5 years", months: 60 },
] as const;

type RangeId = (typeof RANGES)[number]["id"];

/**
 * The map view. Filters sit in **one row above everything they scope**, so the map,
 * both charts and the table always agree about which slice is on screen.
 */
export function MarketExplorer(): React.JSX.Element {
  const [metric, setMetric] = useState<DemoMetric>("vacancy_rate");
  const [rangeId, setRangeId] = useState<RangeId>("60");
  const [districtId, setDistrictId] = useState<string>("HK-WCH");
  const [showTable, setShowTable] = useState(false);

  const months = RANGES.find((r) => r.id === rangeId)?.months ?? 60;
  const periodStart = DEMO_PERIODS[DEMO_PERIODS.length - 1];

  const values = useMemo(() => demoLatest(metric, periodStart), [metric, periodStart]);

  /**
   * Public by necessity — a browser map key is visible to anyone with dev tools, which
   * is why Google's own guidance is to restrict it by HTTP referrer rather than to hide
   * it. Absent means "render the schematic map", not "crash".
   */
  const mapsKey = process.env["NEXT_PUBLIC_GOOGLE_MAPS_API_KEY"];

  // Shared with the landing-page preview — see district-map.tsx — so the two cannot
  // disagree about what a colour or a circle size means.
  const mapData = useMemo(() => normaliseDistrictValues(values, metric), [values, metric]);

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
      <DemoBanner />

      {/* One filter row, above everything it scopes, in its own card — the floating
          toolbar shape a marketplace filter bar takes, rather than a bare row sitting
          directly on the page. */}
      <div className="card flex flex-wrap items-end gap-4 py-4">
        <label className="text-xs">
          <span className="block text-muted">Metric</span>
          <select
            value={metric}
            onChange={(e) => setMetric(e.target.value as DemoMetric)}
            className="mt-1 rounded-card border border-line bg-surfaceMuted px-2.5 py-1.5 text-sm text-mist outline-none focus:border-accent focus:bg-surface"
          >
            {(Object.keys(DEMO_METRICS) as DemoMetric[]).map((m) => (
              <option key={m} value={m}>
                {DEMO_METRICS[m].label} ({DEMO_METRICS[m].side})
              </option>
            ))}
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

      <DistrictKpiSummary districtId={districtId} districtName={districtName} onSelectMetric={setMetric} />

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
              {DEMO_METRICS[metric].label} by district, {formatPeriod(periodStart ?? "")}.
              Synthetic values.
            </caption>
            <thead>
              <tr className="border-y border-line bg-surfaceMuted text-left text-xs text-muted">
                <th scope="col" className="px-4 py-2 font-medium">District</th>
                <th scope="col" className="px-4 py-2 font-medium">Region</th>
                <th scope="col" className="px-4 py-2 text-right font-medium">
                  {DEMO_METRICS[metric].label}
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
                    {formatDemoValue(metric, value)}
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

function DemoBanner(): React.JSX.Element {
  return (
    <div className="rounded-panel border border-caution/40 bg-caution/10 px-4 py-3 shadow-card">
      <p className="text-sm font-semibold text-mist">{DEMO_NOTICE.title}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted">{DEMO_NOTICE.detail}</p>
    </div>
  );
}
