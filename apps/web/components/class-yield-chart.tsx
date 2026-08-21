"use client";

import {
  RVD_CLASS_LABELS,
  RVD_SOURCE,
  RVD_YIELD_PERIODS,
  RVD_YIELDS_BY_CLASS,
  formatPeriod,
  type RvdClassKey,
} from "@veela/fixtures";
import { tokens, viz } from "@veela/ui";
import { useMemo, useRef, useState } from "react";

/**
 * Real gross rental yields by RVD Class, on one plot.
 *
 * **Five series on one axis, unlike `SeriesChart`'s deliberate small-multiples.** That
 * rule exists to stop a percentage and a count sharing an axis they have no business
 * sharing — here all five series are the same unit and the same magnitude, and the entire
 * point is the *spread between them*: small flats out-yield large ones by more than a
 * point, consistently, for twenty-seven years. Separate panels would hide the one finding
 * worth showing.
 *
 * `null` months (RVD published nothing) break the path rather than interpolating across.
 */

const W = 760;
const H = 260;
const PAD = { top: 14, right: 96, bottom: 26, left: 44 };

const CLASS_KEYS = ["A", "B", "C", "D", "E"] as const;

/** Sequential, not categorical: Class is an *ordered* variable (flat size), so the ramp
 *  should read as an order. `viz.sequential` is the same ramp the price-per-sqft choropleth
 *  uses, for the same reason. */
const CLASS_COLOR: Readonly<Record<RvdClassKey, string>> = {
  A: viz.sequential[5],
  B: viz.sequential[4],
  C: viz.sequential[3],
  D: viz.sequential[2],
  E: viz.sequential[1],
};

const RANGES = [
  { id: "60", label: "5 years", months: 60 },
  { id: "120", label: "10 years", months: 120 },
  { id: "all", label: "All since 1999", months: RVD_YIELD_PERIODS.length },
] as const;

export function ClassYieldChart(): React.JSX.Element {
  const [rangeId, setRangeId] = useState<(typeof RANGES)[number]["id"]>("120");
  const [hidden, setHidden] = useState<ReadonlySet<RvdClassKey>>(new Set());
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const months = RANGES.find((r) => r.id === rangeId)?.months ?? 120;
  const periods = useMemo(() => RVD_YIELD_PERIODS.slice(-months), [months]);
  const series = useMemo(
    () =>
      CLASS_KEYS.map((k) => ({ key: k, values: RVD_YIELDS_BY_CLASS[k].slice(-months) })),
    [months],
  );

  const geom = useMemo(() => {
    const shown = series.filter((s) => !hidden.has(s.key));
    const all = shown.flatMap((s) => s.values).filter((v): v is number => v !== null);
    const lo = all.length === 0 ? 0 : Math.max(0, Math.min(...all) - 0.4);
    const hi = all.length === 0 ? 1 : Math.max(...all) + 0.4;
    const plotW = W - PAD.left - PAD.right;
    const plotH = H - PAD.top - PAD.bottom;
    const x = (i: number): number =>
      PAD.left + (periods.length <= 1 ? 0 : (i / (periods.length - 1)) * plotW);
    const y = (v: number): number => PAD.top + plotH - ((v - lo) / (hi - lo)) * plotH;
    const ticks = Array.from({ length: 4 }, (_, i) => lo + ((hi - lo) * i) / 3);
    return { lo, hi, x, y, ticks, plotW, plotH };
  }, [series, hidden, periods.length]);

  /** A `null` starts a new subpath — `M` after a gap — so a month RVD didn't publish
   *  leaves a visible break instead of a straight line across missing data. */
  function pathFor(values: readonly (number | null)[]): string {
    let d = "";
    let penDown = false;
    values.forEach((v, i) => {
      if (v === null) { penDown = false; return; }
      d += `${penDown ? "L" : "M"}${geom.x(i)},${geom.y(v)}`;
      penDown = true;
    });
    return d;
  }

  function handleMove(e: React.PointerEvent<SVGSVGElement>): void {
    const svg = svgRef.current;
    if (svg === null || periods.length === 0) return;
    const rect = svg.getBoundingClientRect();
    const localX = ((e.clientX - rect.left) / rect.width) * W;
    const t = (localX - PAD.left) / geom.plotW;
    setHoverIndex(Math.min(periods.length - 1, Math.max(0, Math.round(t * (periods.length - 1)))));
  }

  function toggle(k: RvdClassKey): void {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      // Never let the last visible series be hidden — an empty chart reads as broken.
      else if (prev.size < CLASS_KEYS.length - 1) next.add(k);
      return next;
    });
  }

  return (
    <figure className="m-0">
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex flex-wrap gap-x-3 gap-y-1.5">
          {CLASS_KEYS.map((k) => {
            const off = hidden.has(k);
            return (
              <button
                key={k}
                type="button"
                onClick={() => toggle(k)}
                aria-pressed={!off}
                title={RVD_CLASS_LABELS[k]}
                className={`flex items-center gap-1.5 text-xs transition-opacity ${off ? "opacity-35" : ""}`}
              >
                <span
                  aria-hidden
                  className="h-0.5 w-4 rounded-full"
                  style={{ background: CLASS_COLOR[k] }}
                />
                <span className="font-medium">Class {k}</span>
              </button>
            );
          })}
        </div>

        <select
          value={rangeId}
          onChange={(e) => setRangeId(e.target.value as typeof rangeId)}
          className="ml-auto rounded-card border border-line bg-surfaceMuted px-2 py-1 text-xs text-mist outline-none focus:border-accent focus:bg-surface"
          aria-label="Time range"
        >
          {RANGES.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      {/* **Scroll, don't shrink.** An SVG with `w-full` and a 760-unit viewBox is fine on a
          desktop and unreadable on a phone: at 330px the axis labels render around 5px
          and five converging series become one smear. A minimum width plus horizontal
          scroll keeps the chart at a legible scale and lets the reader pan — the same
          treatment the data tables already get. `touch-pan-x` so a horizontal drag scrolls
          the container while the crosshair still tracks a tap. */}
      <div className="-mx-1 overflow-x-auto px-1">
      {/* `aria-label` rather than an `<svg><title>`: React 19 hoists `<title>` as
          document metadata and server and client disagree inside an `<svg>`, which is a
          hydration failure. Full reasoning in `series-chart.tsx`. */}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Gross rental yield by flat class, ${formatPeriod(periods[0] ?? "")} to ${formatPeriod(periods[periods.length - 1] ?? "")}`}
        className="h-auto w-full min-w-[560px] touch-pan-x"
        onPointerMove={handleMove}
        onPointerLeave={() => setHoverIndex(null)}
      >

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
              {t.toFixed(1)}%
            </text>
          </g>
        ))}

        {series.map((s) =>
          hidden.has(s.key) ? null : (
            <path
              key={s.key}
              d={pathFor(s.values)}
              fill="none"
              stroke={CLASS_COLOR[s.key]}
              strokeWidth={1.8}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ),
        )}

        {[0, Math.floor(periods.length / 2), periods.length - 1].map((i) => {
          const p = periods[i];
          if (p === undefined) return null;
          return (
            <text
              key={p}
              x={geom.x(i)}
              y={H - 8}
              textAnchor={i === 0 ? "start" : i === periods.length - 1 ? "end" : "middle"}
              fill={tokens.color.textMuted}
              style={{ fontSize: 10 }}
            >
              {formatPeriod(p)}
            </text>
          );
        })}

        {hoverIndex !== null && (
          <line
            x1={geom.x(hoverIndex)}
            x2={geom.x(hoverIndex)}
            y1={PAD.top}
            y2={H - PAD.bottom}
            stroke={tokens.color.textMuted}
            strokeWidth={1}
          />
        )}

        {/* Direct labels at the right edge instead of a legend box — with five series the
            eye should not have to travel to a key and back.
            De-collided: the classes converge (C, D and E sit within 0.4 points of each
            other today), so at their true y the labels overlapped into an unreadable
            smear. Each is nudged down until it clears the one above by `MIN_GAP`; the
            marker dot stays on the real value, so only the text moves. */}
        {(() => {
          const MIN_GAP = 13;
          const labels = series
            .filter((s) => !hidden.has(s.key))
            .map((s) => {
              const idx = hoverIndex ?? s.values.length - 1;
              const v = s.values[idx] ?? [...s.values].reverse().find((x) => x !== null) ?? null;
              return v === null ? null : { key: s.key, idx, v, y: geom.y(v) };
            })
            .filter((l): l is { key: RvdClassKey; idx: number; v: number; y: number } => l !== null)
            .sort((a, b) => a.y - b.y);

          let lastY = -Infinity;
          const placed = labels.map((l) => {
            const y = Math.max(l.y, lastY + MIN_GAP);
            lastY = y;
            return { ...l, labelY: y };
          });

          return placed.map((l) => (
            <g key={`lbl-${l.key}`}>
              <circle cx={geom.x(l.idx)} cy={geom.y(l.v)} r={3} fill={CLASS_COLOR[l.key]} stroke={viz.surface} strokeWidth={1.5} />
              {/* A leader line only when the label had to move, so it stays traceable. */}
              {Math.abs(l.labelY - l.y) > 1 && (
                <line
                  x1={geom.x(l.idx) + 4}
                  y1={l.y}
                  x2={W - PAD.right + 6}
                  y2={l.labelY}
                  stroke={CLASS_COLOR[l.key]}
                  strokeWidth={0.75}
                  opacity={0.5}
                />
              )}
              <text
                x={W - PAD.right + 10}
                y={l.labelY}
                dominantBaseline="middle"
                fill={CLASS_COLOR[l.key]}
                style={{ fontSize: 11, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}
              >
                {l.v.toFixed(1)}% · {l.key}
              </text>
            </g>
          ));
        })()}
      </svg>
      </div>

      <figcaption className="mt-2 text-[11px] leading-relaxed text-muted">
        {hoverIndex === null
          ? "Latest published month. Hover to read any month."
          : formatPeriod(periods[hoverIndex] ?? "")}
        {" — "}
        gross rental yield, {" "}
        <a href={RVD_SOURCE.url} target="_blank" rel="noreferrer" className="text-accent hover:underline">
          {RVD_SOURCE.label}
        </a>
        . Measured, not modelled. Class is flat size, and it is the finest grain RVD
        publishes for domestic yields — there is no free per-district series.
      </figcaption>
    </figure>
  );
}
