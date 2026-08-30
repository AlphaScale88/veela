"use client";

import {
  DEMO_METRICS,
  formatDemoValue,
  formatPeriod,
  type DemoMetric,
  type DemoPoint,
} from "@veela/fixtures";
import { tokens, viz } from "@veela/ui";
import { useMemo, useRef, useState } from "react";

/**
 * One metric, one series, over time — so no legend box: the title says what is
 * plotted, and a single swatch would just restate it.
 *
 * Deliberately NOT a dual-axis chart. Vacancy (percent) and transactions (count) live
 * on scales that share nothing, so pairing them on one plot with two y-axes would
 * invent a correlation. They ship as small multiples instead: same x, own y, stacked.
 *
 * The crosshair finds the X. Readers aim at a month, never at a 2px line.
 */

const W = 720;
const H = 190;
const PAD = { top: 14, right: 56, bottom: 26, left: 46 };

interface Props {
  readonly metric: DemoMetric;
  readonly points: readonly DemoPoint[];
  readonly districtName: string;
}

export function SeriesChart({ metric, points, districtName }: Props): React.JSX.Element {
  const meta = DEMO_METRICS[metric];
  const color = meta.side === "supply" ? viz.supply : viz.demand;
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const geom = useMemo(() => {
    const values = points.map((p) => p.value);
    const rawMin = Math.min(...values);
    const rawMax = Math.max(...values);
    // Pad the domain so the line never grazes the frame, and include 0 for counts
    // (a count axis that starts at 200 exaggerates every wiggle). Percentages and
    // index series share the same reasoning: an index rebased to 100 that floors at 0
    // would compress five years of real movement into a flat line near the top.
    // `allowNegative` metrics (year-over-year change) skip the floor-at-0 clamp
    // entirely — a cooling district's negative readings are the point, not noise to
    // hide below the frame.
    const padded = rawMin - (rawMax - rawMin) * 0.2;
    const lo = meta.zeroAnchored ? 0 : meta.allowNegative ? padded : Math.max(0, padded);
    const hi = rawMax + (rawMax - lo) * 0.12;

    const plotW = W - PAD.left - PAD.right;
    const plotH = H - PAD.top - PAD.bottom;
    const x = (i: number): number =>
      PAD.left + (points.length <= 1 ? 0 : (i / (points.length - 1)) * plotW);
    const y = (v: number): number => PAD.top + plotH - ((v - lo) / (hi - lo)) * plotH;

    const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.value)}`).join("");

    // Four clean ticks. Round numbers, because they carry the values not labelled.
    const ticks = Array.from({ length: 4 }, (_, i) => lo + ((hi - lo) * i) / 3);

    return { lo, hi, x, y, path, ticks, plotW, plotH };
  }, [points, meta.zeroAnchored, meta.allowNegative]);

  const last = points[points.length - 1];
  const hovered = hoverIndex === null ? undefined : points[hoverIndex];

  function handleMove(e: React.PointerEvent<SVGSVGElement>): void {
    const svg = svgRef.current;
    if (svg === null || points.length === 0) return;
    const rect = svg.getBoundingClientRect();
    const localX = ((e.clientX - rect.left) / rect.width) * W;
    const t = (localX - PAD.left) / geom.plotW;
    const idx = Math.round(t * (points.length - 1));
    setHoverIndex(Math.min(points.length - 1, Math.max(0, idx)));
  }

  return (
    <figure className="m-0">
      <figcaption className="mb-1.5 flex items-baseline gap-2">
        <span aria-hidden className="h-0.5 w-4 rounded-full" style={{ background: color }} />
        <h3 className="text-sm font-medium text-mist">
          {meta.label}
          <span className="ml-1.5 font-normal text-muted">
            · {meta.side} · {districtName}
          </span>
        </h3>
      </figcaption>

      {/* Scroll rather than shrink on a phone — a 720-unit viewBox squeezed to 330px
          renders its axis labels at about 5px. See class-yield-chart.tsx. */}
      <div className="-mx-1 overflow-x-auto px-1">
      {/* `aria-label`, not an `<svg><title>` — and this is a real hydration bug, not a style
          preference. React 19 treats `<title>` as document metadata and hoists it into `<head>`;
          inside an `<svg>` the server pass and the client pass disagree about whether to do that,
          which threw **"Hydration failed because the server rendered HTML didn't match the
          client"** on every page carrying this chart. Found by crawling the app with the console
          captured, not by reading the markup.

          Exactly the same shape as the stray `<caption>` bug on Market Regulations, and the same
          fix: `role="img"` plus `aria-label` is the recommended pattern for a graphic anyway, it
          needs no generated id, and it cannot be hoisted anywhere. */}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${meta.label} for ${districtName}, ${formatPeriod(points[0]?.periodStart ?? "")} to ${formatPeriod(last?.periodStart ?? "")}`}
        className="h-auto w-full min-w-[560px] touch-pan-x"
        onPointerMove={handleMove}
        onPointerLeave={() => setHoverIndex(null)}
      >

        {/* Gridlines: hairline, solid, one step off surface, recessive. */}
        {geom.ticks.map((t) => (
          <g key={t}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={geom.y(t)}
              y2={geom.y(t)}
              stroke={viz.grid}
              strokeWidth={1}
            />
            <text
              x={PAD.left - 8}
              y={geom.y(t)}
              textAnchor="end"
              dominantBaseline="middle"
              fill={tokens.color.textMuted}
              style={{ fontSize: 10, fontVariantNumeric: "tabular-nums" }}
            >
              {formatDemoValue(metric, t)}
            </text>
          </g>
        ))}

        {/* Area wash at ~10% — never a saturated block. */}
        <path
          d={`${geom.path}L${geom.x(points.length - 1)},${H - PAD.bottom}L${PAD.left},${H - PAD.bottom}Z`}
          fill={color}
          opacity={0.1}
        />

        <path
          d={geom.path}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* X labels: first, middle, last only. A label per month would be a wall. */}
        {[0, Math.floor(points.length / 2), points.length - 1].map((i) => {
          const p = points[i];
          if (p === undefined) return null;
          return (
            <text
              key={p.periodStart}
              x={geom.x(i)}
              y={H - 8}
              textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"}
              fill={tokens.color.textMuted}
              style={{ fontSize: 10 }}
            >
              {formatPeriod(p.periodStart)}
            </text>
          );
        })}

        {/* Crosshair snapped to the nearest month. */}
        {hovered !== undefined && hoverIndex !== null && (
          <>
            <line
              x1={geom.x(hoverIndex)}
              x2={geom.x(hoverIndex)}
              y1={PAD.top}
              y2={H - PAD.bottom}
              stroke={tokens.color.textMuted}
              strokeWidth={1}
            />
            <circle
              cx={geom.x(hoverIndex)}
              cy={geom.y(hovered.value)}
              r={4.5}
              fill={color}
              stroke={viz.surface}
              strokeWidth={2}
            />
          </>
        )}

        {/* End marker + the one direct label: the latest value is the point of the
            chart, so it is labelled and nothing else is. */}
        {last !== undefined && (
          <>
            <circle
              cx={geom.x(points.length - 1)}
              cy={geom.y(last.value)}
              r={4}
              fill={color}
              stroke={viz.surface}
              strokeWidth={2}
            />
            <text
              x={geom.x(points.length - 1) + 10}
              y={geom.y(last.value)}
              dominantBaseline="middle"
              fill={tokens.color.text}
              style={{ fontSize: 11, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}
            >
              {formatDemoValue(metric, last.value)}
            </text>
          </>
        )}
      </svg>
      </div>

      {/*
        * Always rendered, never mounted on hover, and the difference is not cosmetic.
        *
        * This row used to appear only while hovering, which grew the figure by its own height.
        * That pushed the chart out from under the pointer, firing `pointerleave`, which removed
        * the row, which moved the chart back under the pointer, which fired `pointermove` — an
        * infinite oscillation that shook the whole row, the map beside it included. Reserving
        * the space means hovering can never change the layout, which fixes the cause rather
        * than damping the symptom.
        *
        * `min-h` matches one line of `text-xs`, so the reserved strip is exactly the height the
        * readout occupies. Empty when nothing is hovered, and `aria-hidden` then, because an
        * empty live region is noise to a screen reader.
        */}
      <div
        role="status"
        aria-hidden={hovered === undefined}
        className="mt-1 flex min-h-4 items-baseline gap-2 text-xs"
      >
        {hovered !== undefined && (
          <>
            <span className="tnum font-semibold text-mist">
              {formatDemoValue(metric, hovered.value)}
            </span>
            <span className="text-muted">{formatPeriod(hovered.periodStart)}</span>
          </>
        )}
      </div>
    </figure>
  );
}
