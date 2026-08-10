"use client";

import { formatPeriod, type RvdIndexPoint } from "@veela/fixtures";
import { tokens, viz } from "@veela/ui";
import { useId, useMemo, useRef, useState } from "react";

/**
 * Same visual grammar as `SeriesChart` — same viewBox, gridlines, crosshair, end-label
 * convention — but not built on `DemoMetric`/`DEMO_METRICS`. `SeriesChart` is wired
 * tightly to that per-district, synthetic-by-construction system (its label, unit,
 * colour and formatting all come from `DEMO_METRICS[metric]`), and this chart's data is
 * neither: `RVD_PRICE_INDEX`/`RVD_RENT_INDEX` (`@veela/fixtures/rvd-real.ts`) are real,
 * territory-wide, index values that describe no single district. Rather than force a
 * territory-wide real series through a component whose whole shape assumes
 * per-district synthetic data, this is a small parallel component — label, colour and
 * formatting passed in directly instead of looked up.
 */

const W = 720;
const H = 190;
const PAD = { top: 14, right: 56, bottom: 26, left: 46 };

interface Props {
  readonly label: string;
  readonly points: readonly RvdIndexPoint[];
  readonly color?: string;
}

export function TerritoryIndexChart({ label, points, color = viz.demand }: Props): React.JSX.Element {
  const titleId = useId();
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const geom = useMemo(() => {
    const values = points.map((p) => p.value);
    const rawMin = Math.min(...values);
    const rawMax = Math.max(...values);
    const lo = Math.max(0, rawMin - (rawMax - rawMin) * 0.2);
    const hi = rawMax + (rawMax - lo) * 0.12;

    const plotW = W - PAD.left - PAD.right;
    const plotH = H - PAD.top - PAD.bottom;
    const x = (i: number): number =>
      PAD.left + (points.length <= 1 ? 0 : (i / (points.length - 1)) * plotW);
    const y = (v: number): number => PAD.top + plotH - ((v - lo) / (hi - lo)) * plotH;

    const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.value)}`).join("");
    const ticks = Array.from({ length: 4 }, (_, i) => lo + ((hi - lo) * i) / 3);

    return { lo, hi, x, y, path, ticks, plotW, plotH };
  }, [points]);

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
          {label}
          <span className="ml-1.5 font-normal text-muted">· territory-wide · real</span>
        </h3>
      </figcaption>

      {/* Scroll rather than shrink on a phone — a 720-unit viewBox squeezed to 330px
          renders its axis labels at about 5px. See class-yield-chart.tsx. */}
      <div className="-mx-1 overflow-x-auto px-1">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-labelledby={titleId}
        className="h-auto w-full min-w-[560px] touch-pan-x"
        onPointerMove={handleMove}
        onPointerLeave={() => setHoverIndex(null)}
      >
        <title id={titleId}>
          {label}, {formatPeriod(points[0]?.periodStart ?? "")} to {formatPeriod(last?.periodStart ?? "")}
        </title>

        {geom.ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={geom.y(t)} y2={geom.y(t)} stroke={viz.grid} strokeWidth={1} />
            <text
              x={PAD.left - 8}
              y={geom.y(t)}
              textAnchor="end"
              dominantBaseline="middle"
              fill={tokens.color.textMuted}
              style={{ fontSize: 10, fontVariantNumeric: "tabular-nums" }}
            >
              {t.toFixed(0)}
            </text>
          </g>
        ))}

        <path
          d={`${geom.path}L${geom.x(points.length - 1)},${H - PAD.bottom}L${PAD.left},${H - PAD.bottom}Z`}
          fill={color}
          opacity={0.1}
        />
        <path d={geom.path} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

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

        {hovered !== undefined && hoverIndex !== null && (
          <>
            <line x1={geom.x(hoverIndex)} x2={geom.x(hoverIndex)} y1={PAD.top} y2={H - PAD.bottom} stroke={tokens.color.textMuted} strokeWidth={1} />
            <circle cx={geom.x(hoverIndex)} cy={geom.y(hovered.value)} r={4.5} fill={color} stroke={viz.surface} strokeWidth={2} />
          </>
        )}

        {last !== undefined && (
          <>
            <circle cx={geom.x(points.length - 1)} cy={geom.y(last.value)} r={4} fill={color} stroke={viz.surface} strokeWidth={2} />
            <text
              x={geom.x(points.length - 1) + 10}
              y={geom.y(last.value)}
              dominantBaseline="middle"
              fill={tokens.color.text}
              style={{ fontSize: 11, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}
            >
              {last.value.toFixed(1)}
            </text>
          </>
        )}
      </svg>
      </div>

      {hovered !== undefined && (
        <div role="status" className="mt-1 flex items-baseline gap-2 text-xs">
          <span className="tnum font-semibold text-mist">{hovered.value.toFixed(1)}</span>
          <span className="text-muted">{formatPeriod(hovered.periodStart)}</span>
        </div>
      )}
    </figure>
  );
}
