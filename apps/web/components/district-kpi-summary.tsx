"use client";

import { DEMO_METRICS, demoSeries, formatDemoValue, type DemoMetric } from "@veela/fixtures";
import { useState } from "react";

import { SeriesChart } from "./series-chart";

/**
 * Every metric's latest reading for one district, at a glance — the Mashvisor "Market
 * Overview" panel pattern (Mashmeter score, median sale price, days on market, …, all
 * in one stat-tile block) rather than the map's own one-metric-at-a-time selector.
 * Shared between Market Explorer (the district picked on the map there) and Finder (the
 * district matched from the search box), so the two can't quietly show a different
 * number for the same district through two separate implementations — both read
 * straight off `demoSeries`/`DEMO_METRICS`, the same source `SeriesChart` and the
 * choropleth already use.
 *
 * **A tile does two things when clicked, and they're independent.** It always expands
 * its own five-year `SeriesChart` right underneath the grid — that's local state, so
 * it works identically in Finder, which has no metric selector of its own to hook into.
 * On top of that, if the caller passed `onSelectMetric` (Market Explorer does, wired to
 * its own metric dropdown), the click also re-colours the map — a bonus for the one
 * page that has a map, not a requirement for the feature to work at all. Skipping the
 * inline chart and only re-colouring the map — the first version of this — left
 * "Average price" a click that changed a colour with no number attached to point at;
 * every KPI here exists specifically so a reader can see it move.
 */
interface Props {
  readonly districtId: string;
  readonly districtName: string;
  readonly onSelectMetric?: (metric: DemoMetric) => void;
}

export function DistrictKpiSummary({ districtId, districtName, onSelectMetric }: Props): React.JSX.Element {
  const metrics = Object.keys(DEMO_METRICS) as DemoMetric[];
  const [expanded, setExpanded] = useState<DemoMetric | null>(null);

  function handleClick(metric: DemoMetric): void {
    setExpanded((current) => (current === metric ? null : metric));
    onSelectMetric?.(metric);
  }

  const expandedPoints = expanded === null ? undefined : demoSeries(districtId, expanded).points;

  return (
    <div className="card">
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
        Market snapshot — {districtName}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {metrics.map((metric) => {
          const points = demoSeries(districtId, metric).points;
          const latest = points[points.length - 1];
          const formatted = latest !== undefined ? formatDemoValue(metric, latest.value) : "—";
          const active = expanded === metric;

          return (
            <button
              key={metric}
              type="button"
              onClick={() => handleClick(metric)}
              aria-pressed={active}
              className={`block w-full rounded-card border px-3 py-2.5 text-left transition-colors ${
                active ? "border-accent bg-surface" : "border-line bg-surfaceMuted hover:border-mist"
              }`}
            >
              <div className="font-mono text-[10px] uppercase leading-tight tracking-[0.08em] text-muted">
                {DEMO_METRICS[metric].label}
              </div>
              <div className="tnum mt-1 text-lg font-semibold text-mist">{formatted}</div>
            </button>
          );
        })}
      </div>

      {expanded !== null && expandedPoints !== undefined && (
        <div className="mt-4 border-t border-line pt-4">
          <SeriesChart metric={expanded} points={expandedPoints} districtName={districtName} />
        </div>
      )}

      <p className="mt-3 text-[11px] leading-relaxed text-muted">
        Generated values, not measurements — these eight metrics have no free per-district
        monthly source. Click a tile to see its evolution over the last five years.
      </p>
    </div>
  );
}
