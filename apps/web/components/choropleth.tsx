"use client";

import {
  DEMO_DISTRICTS,
  DEMO_METRICS,
  districtPath,
  formatDemoValue,
  type DemoMetric,
} from "@veela/fixtures";
import { sequentialBin, tokens, viz } from "@veela/ui";
import { useState } from "react";

/**
 * Choropleth — magnitude across geography, so the colour job is **sequential**: one
 * hue, six bins, dark→light because on a dark surface it is the *low* end that should
 * recede toward the surface.
 *
 * On cells the mark is the hit target — no crosshair. Each district carries its own
 * pointer and focus handler, and the hovered one lifts. Every value is also in the
 * table below the map, so the tooltip enhances and never gates.
 */

interface Props {
  readonly metric: DemoMetric;
  readonly values: ReadonlyMap<string, number>;
  readonly selectedId: string | null;
  readonly onSelect: (districtId: string) => void;
}

export function Choropleth({
  metric,
  values,
  selectedId,
  onSelect,
}: Props): React.JSX.Element {
  const [hovered, setHovered] = useState<string | null>(null);
  const meta = DEMO_METRICS[metric];

  const numbers = [...values.values()];
  const min = Math.min(...numbers);
  const max = Math.max(...numbers);

  const active = hovered ?? selectedId;
  const activeDistrict = DEMO_DISTRICTS.find((d) => d.id === active);
  const activeValue = active === undefined ? undefined : values.get(active ?? "");

  return (
    <figure className="m-0">
      <figcaption className="mb-3">
        <h3 className="text-sm font-medium text-mist">
          {meta.label} by district
          <span className="ml-2 font-normal text-muted">
            {meta.unit === "%" ? "percent" : meta.unit}
          </span>
        </h3>
        <p className="mt-0.5 text-[11px] text-muted">
          Tap or focus a district to see its history. Outlines are schematic.
        </p>
      </figcaption>

      <div className="relative overflow-hidden rounded-hero border border-line shadow-card">
        {/* `aria-label` rather than an `<svg><title>`: React 19 hoists `<title>` as
            document metadata and server and client disagree inside an `<svg>`, which is a
            hydration failure. Full reasoning in `series-chart.tsx`. */}
        <svg
          viewBox="0 0 100 100"
          role="img"
          aria-label={`${meta.label} across Hong Kong's 18 districts, schematic layout`}
          className="h-auto w-full"
          style={{ background: viz.surface }}
        >

          {DEMO_DISTRICTS.map((d) => {
            const value = values.get(d.id);
            if (value === undefined) return null;
            const fill = sequentialBin(value, min, max);
            const isActive = active === d.id;
            const isSelected = selectedId === d.id;

            return (
              <g key={d.id}>
                <path
                  d={districtPath(d)}
                  fill={fill}
                  /* The 2px surface stroke IS the gap between neighbours — surface
                     showing through, not a border adding data-weight ink. */
                  stroke={viz.surface}
                  strokeWidth={0.7}
                  tabIndex={0}
                  role="button"
                  aria-label={`${d.nameEn}: ${formatDemoValue(metric, value)}`}
                  aria-pressed={isSelected}
                  onPointerEnter={() => setHovered(d.id)}
                  onPointerLeave={() => setHovered(null)}
                  onFocus={() => setHovered(d.id)}
                  onBlur={() => setHovered(null)}
                  onClick={() => onSelect(d.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelect(d.id);
                    }
                  }}
                  className="cursor-pointer outline-none transition-opacity"
                  style={{
                    opacity: active === null || isActive ? 1 : 0.55,
                    filter: isActive ? "brightness(1.28)" : undefined,
                  }}
                />
                {isSelected && (
                  <path
                    d={districtPath(d)}
                    fill="none"
                    stroke={tokens.color.text}
                    strokeWidth={0.8}
                    pointerEvents="none"
                  />
                )}
              </g>
            );
          })}

          {/* Region labels, not district labels: 18 names cannot fit without
              colliding, and a clipped label is worse than none. Districts are
              named in the tooltip and the table. */}
          {(
            [
              { text: "New Territories", x: 50, y: 4 },
              { text: "Kowloon", x: 58, y: 44 },
              { text: "Hong Kong Island", x: 55, y: 70 },
            ] as const
          ).map((l) => (
            <text
              key={l.text}
              x={l.x}
              y={l.y}
              textAnchor="middle"
              fill={tokens.color.textMuted}
              style={{ fontSize: 2.6, letterSpacing: 0.1 }}
              pointerEvents="none"
            >
              {l.text}
            </text>
          ))}
        </svg>

        {activeDistrict !== undefined && activeValue !== undefined && (
          <div
            role="status"
            className="pointer-events-none absolute left-3 top-3 rounded-lg border border-line bg-ink/95 px-3 py-2 shadow-lg"
          >
            {/* Value leads, label follows — the reader has the district and wants
                the number. */}
            <div className="tnum text-lg font-semibold leading-none text-mist">
              {formatDemoValue(metric, activeValue)}
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted">
              <span
                aria-hidden
                className="inline-block h-0.5 w-3 rounded-full"
                style={{ background: sequentialBin(activeValue, min, max) }}
              />
              {activeDistrict.nameEn} · {activeDistrict.nameZh}
            </div>
          </div>
        )}
      </div>

      <ScaleLegend metric={metric} min={min} max={max} />
    </figure>
  );
}

/** Sequential encoding needs a scale legend — the bins mean nothing without it. */
function ScaleLegend({
  metric,
  min,
  max,
}: {
  readonly metric: DemoMetric;
  readonly min: number;
  readonly max: number;
}): React.JSX.Element {
  const bins = viz.sequential;
  const step = (max - min) / bins.length;

  return (
    <div className="mt-3 flex items-center gap-2">
      <span className="tnum text-[11px] text-muted">{formatDemoValue(metric, min)}</span>
      <div className="flex flex-1 gap-[2px]">
        {bins.map((c, i) => {
          const from = min + step * i;
          const to = min + step * (i + 1);
          return (
            <div
              key={c}
              className="h-2.5 flex-1 rounded-[2px]"
              style={{ background: c }}
              title={`${formatDemoValue(metric, from)} – ${formatDemoValue(metric, to)}`}
            >
              <span className="sr-only">
                {formatDemoValue(metric, from)} to {formatDemoValue(metric, to)}
              </span>
            </div>
          );
        })}
      </div>
      <span className="tnum text-[11px] text-muted">{formatDemoValue(metric, max)}</span>
    </div>
  );
}
