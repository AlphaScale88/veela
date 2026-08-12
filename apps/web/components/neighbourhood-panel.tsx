"use client";

import { useState } from "react";

/**
 * What's within walking distance — schools, stations, shops, health, green space.
 *
 * **Loads on demand, not with the report.** Overpass takes seconds (ten, in testing), and
 * the report itself is instant; blocking it on a community API would make the whole page
 * feel broken to buy a section most readers will not scroll to. So this renders a button
 * and fetches when asked.
 *
 * Counts and a nearest-few list, not a directory: the counts answer "how well served is
 * this area", the list answers "by what". Distances are straight-line and say so —
 * walking distance would need a routing service and is a different promise.
 */

type AmenityKind =
  | "school"
  | "transport"
  | "shop"
  | "health"
  | "park"
  | "premium"
  | "construction";

interface Amenity {
  readonly kind: AmenityKind;
  readonly name: string;
  readonly subtype: string;
  readonly metres: number;
}

interface Data {
  readonly counts: Readonly<Record<AmenityKind, number>>;
  readonly nearest: readonly Amenity[];
  readonly attribution: string;
  /** Present once the server started caching. `stale` means Overpass was unreachable and
   *  this is an older answer served deliberately rather than an error — which the reader
   *  is told, because silently presenting old data as current is the worse failure. */
  readonly cache?: { readonly hit: boolean; readonly ageDays: number; readonly stale?: boolean };
}

const KIND_LABEL: Readonly<Record<AmenityKind, string>> = {
  school: "Schools",
  transport: "Transport",
  shop: "Shops",
  health: "Health",
  park: "Green space",
  premium: "Premium retail",
  construction: "Under construction",
};

/**
 * Each signal on its own line with its own count — deliberately **not** combined into an
 * area score. This product has twice declined to build a composite (see
 * `.claude/CLAUDE.md` on the Mashmeter-style score), for the reason that applies doubly
 * here: "premium retail" and "under construction" are *proxies chosen by us*, and folding
 * proxies into a single authoritative-looking number makes a judgement look like a
 * measurement. A reader can argue with any one row here. They could not argue with a 78.
 */
const KIND_ORDER: readonly AmenityKind[] = [
  "transport",
  "school",
  "shop",
  "premium",
  "health",
  "park",
  "construction",
];

/**
 * The score, and the terms it comes with.
 *
 * A single 0–100 was declined twice in this project's history, and then asked for
 * directly. Built on the one condition that made the star rating acceptable: **it shows
 * its own arithmetic every time it is displayed.** Every row below is visible on screen,
 * with its weight, its target and what it actually counted — so the number is a
 * restatement of the table above it, not a verdict replacing it.
 *
 * `target` is "enough to score full marks", and these were **recalibrated against real
 * measurements after the first version proved useless**: guessing plausible-looking round
 * numbers gave Queen's Road Central 100/100 with every category saturated, and Taikoo
 * Shing 95 — a score that returns "full marks" for most of urban Hong Kong discriminates
 * nothing. Sampled five contrasting areas and set each target near the top of the observed
 * range instead:
 *
 * | Area (900m radius) | transport | school | shop | premium | health | park |
 * |---|---|---|---|---|---|---|
 * | Mong Kok | 10 | 29 | 39 | 31 | 29 | 38 |
 * | Central | 13 | 10 | 22 | 28 | 18 | 23 |
 * | Southern | 8 | 22 | 7 | 3 | 9 | 13 |
 * | Tuen Mun | 12 | 26 | 18 | 0 | 7 | 12 |
 * | Taikoo Shing | 4 | 14 | 15 | 4 | 19 | 14 |
 *
 * Saturating rather than scaling without limit is deliberate: a fortieth shop should not
 * outweigh a first railway station.
 *
 * **A known artifact, not hidden:** Tuen Mun's transport count is inflated by Light Rail,
 * which OSM tags as `railway=station` — a dozen tram-like stops score like a dozen heavy
 * rail stations. Defensible for a metric called *convenience* (it genuinely is well
 * served), but it is why this is not called a quality or desirability score.
 */
const WEIGHTS: readonly { kind: AmenityKind; weight: number; target: number }[] = [
  { kind: "transport", weight: 25, target: 10 },
  { kind: "school", weight: 20, target: 22 },
  { kind: "shop", weight: 15, target: 25 },
  { kind: "premium", weight: 15, target: 18 },
  { kind: "health", weight: 15, target: 20 },
  { kind: "park", weight: 10, target: 22 },
];

interface ScoreRow {
  readonly kind: AmenityKind;
  readonly counted: number;
  readonly target: number;
  readonly weight: number;
  readonly points: number;
}

function scoreOf(counts: Readonly<Record<AmenityKind, number>>): {
  total: number;
  rows: readonly ScoreRow[];
} {
  const rows = WEIGHTS.map((w) => {
    const counted = counts[w.kind];
    const points = Math.round(Math.min(1, counted / w.target) * w.weight);
    return { kind: w.kind, counted, target: w.target, weight: w.weight, points };
  });
  return { total: rows.reduce((sum, r) => sum + r.points, 0), rows };
}

interface Props {
  readonly latitude: number;
  readonly longitude: number;
  /** Shown in the heading so it's clear which property the area belongs to. */
  readonly label?: string;
}

export function NeighbourhoodPanel({ latitude, longitude, label }: Props): React.JSX.Element {
  const [data, setData] = useState<Data | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(): Promise<void> {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/neighbourhood?lat=${latitude}&lng=${longitude}`);
      const body = await res.text();
      if (!res.ok) throw new Error(body || `Request failed (${res.status})`);
      setData(JSON.parse(body) as Data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load the neighbourhood.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="card">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-semibold">
            The neighbourhood{label === undefined ? "" : ` — ${label}`}
          </h3>
          <p className="mt-0.5 text-xs text-muted">
            Schools, transport, shops, health and green space within walking distance.
          </p>
        </div>
        {data === null && (
          <button
            type="button"
            onClick={() => void load()}
            disabled={pending}
            className="btn-secondary !px-4 !py-2 !text-xs disabled:pointer-events-none disabled:opacity-50"
          >
            {pending ? "Checking…" : "Check the area"}
          </button>
        )}
      </div>

      {error !== null && (
        <p role="alert" className="mt-3 text-xs leading-relaxed text-negative">
          {error}
        </p>
      )}

      {data !== null && (
        <>
          {(() => {
            const { total, rows } = scoreOf(data.counts);
            return (
              <div className="mt-4 rounded-panel border border-line bg-surfaceMuted px-4 py-3">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="tnum font-display text-[30px] font-bold leading-none tracking-[-0.02em]">
                    {total}
                    <span className="ml-1 text-[15px] font-medium text-muted">/ 100</span>
                  </span>
                  <span className="text-sm font-medium text-mist">Area convenience</span>
                </div>

                {/* The formula, in full, every time. This is the condition the number is
                    allowed to exist under — see WEIGHTS above. */}
                <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] uppercase tracking-[0.06em] text-muted">
                  {rows.map((r) => (
                    <li key={r.kind}>
                      {KIND_LABEL[r.kind]}{" "}
                      <span className="text-mist">
                        {r.points}/{r.weight}
                      </span>{" "}
                      ({r.counted} of {r.target})
                    </li>
                  ))}
                </ul>

                <p className="mt-2 text-[11px] leading-relaxed text-muted">
                  Every row is the count in the table below, capped at the target shown and
                  scaled by its weight — add them and you get {total}. The weights and
                  targets are <strong className="text-mist">our judgement, not a
                  measurement</strong>: they are printed here so you can disagree with them.
                  It says how <em className="not-italic">conveniently served</em> a spot is;
                  it is not a rating of the property, the building, or whether the price is
                  fair. Construction sites are counted below but deliberately excluded from
                  the score — nearby building work is information, not a good or a bad thing.
                </p>
              </div>
            );
          })()}

          <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {KIND_ORDER.map((k) => (
              <div key={k} className="rounded-card border border-line bg-surfaceMuted px-3 py-2.5">
                <dt className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted">
                  {KIND_LABEL[k]}
                </dt>
                <dd className="tnum mt-1 text-lg font-semibold text-mist">{data.counts[k]}</dd>
              </div>
            ))}
          </dl>

          <ul className="mt-4 divide-y divide-line">
            {data.nearest.map((a) => (
              <li key={`${a.kind}-${a.name}`} className="flex items-baseline justify-between gap-3 py-2">
                <span className="min-w-0">
                  <span className="text-sm text-mist">{a.name}</span>
                  <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.06em] text-muted">
                    {a.subtype.replace(/_/g, " ")}
                  </span>
                </span>
                <span className="tnum shrink-0 font-mono text-xs text-muted">{a.metres} m</span>
              </li>
            ))}
          </ul>

          {data.cache?.stale === true && (
            <p className="mt-3 rounded-card border border-caution/40 bg-caution/10 px-3 py-2 text-[11px] leading-relaxed text-muted">
              <strong className="text-mist">Showing a saved copy.</strong> OpenStreetMap
              didn&apos;t answer just now, so this is the last result we have for this spot
              — {data.cache.ageDays === 0 ? "from earlier today" : `about ${data.cache.ageDays} day${data.cache.ageDays === 1 ? "" : "s"} old`}.
              Amenities rarely change that fast, but it isn&apos;t live.
            </p>
          )}

          <p className="mt-3 text-[11px] leading-relaxed text-muted">
            Straight-line distance, not walking distance. {data.attribution} — coverage is
            contributor-maintained, so a missing school means nobody has mapped it, not
            that there isn&apos;t one. Treat this as a prompt to look, not an inventory.
          </p>
          <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
            &ldquo;Premium retail&rdquo; counts a named list of brands kept in the codebase,
            and &ldquo;under construction&rdquo; counts sites tagged as such — both are
            proxies we chose rather than measurements, which is why the score above prints
            its own weights and why every count is shown separately here.
          </p>
        </>
      )}
    </section>
  );
}
