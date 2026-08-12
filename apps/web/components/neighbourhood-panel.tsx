"use client";

import { useState } from "react";

import {
  ConstructionIcon,
  DiamondIcon,
  HealthIcon,
  MapPinIcon,
  SchoolIcon,
  ShopIcon,
  TrainIcon,
  TreeIcon,
} from "./icons";

/**
 * What's within walking distance — schools, stations, shops, health, green space.
 *
 * **Loads on demand, not with the report.** Overpass takes seconds (ten, in testing), and
 * the report itself is instant; blocking it on a community API would make the whole page
 * feel broken to buy a section most readers will not scroll to. So this renders a button
 * and fetches when asked.
 *
 * ## Every count opens the list behind it
 *
 * The counts used to sit beside a fixed preview of the nearest 18 places overall, which
 * meant a reader could see "34 shops" and had no way to find out *which* 34 — and the two
 * were computed from different slices of the same data, so a dense area showed a shop count
 * the visible list could not account for.
 *
 * Each count is now a button that expands the full itemised list for that category, sorted
 * nearest first. **The count is literally `items.filter(kind).length`, so the number and
 * the list it opens cannot disagree** — the same "one function, not two guesses" rule the
 * Property Finder's yield follows, applied to a count. That property is the whole reason
 * this is safe to make clickable: a drill-down that showed fewer rows than its own badge
 * would undermine every other number in the report.
 *
 * Distances are straight-line and say so — walking distance would need a routing service
 * and is a different promise.
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
  /** Every match, nearest first — not a capped preview, because the counts are clickable
   *  and open exactly this list filtered by kind. See the header comment. */
  readonly items: readonly Amenity[];
  readonly attribution: string;
  /** Present once the server started caching. `stale` means Overpass was unreachable and
   *  this is an older answer served deliberately rather than an error — which the reader
   *  is told, because silently presenting old data as current is the worse failure. */
  readonly cache?: { readonly hit: boolean; readonly ageDays: number; readonly stale?: boolean };
}

/**
 * The search radius per category, mirrored from `RADIUS` in `packages/api/src/neighbourhood.ts`
 * so the drill-down can say *"Schools within 800 m"* rather than leaving the reader to
 * assume one distance applies to everything — it doesn't; a station at 800m is still near,
 * a supermarket at 800m is not the local shop.
 *
 * **A deliberate duplication, with a cost worth naming**: the API package is compiled to
 * `dist/` and this is display copy, not logic, so importing it would couple a client
 * component to the server bundle to render seven numbers. The risk is that a radius changes
 * server-side and this label keeps quoting the old one — so if `RADIUS` is edited, edit
 * this too.
 */
const RADIUS_M: Readonly<Record<AmenityKind, number>> = {
  school: 800,
  transport: 900,
  shop: 600,
  health: 800,
  park: 700,
  premium: 900,
  construction: 900,
};

/**
 * Shorter labels for the seven tiles specifically.
 *
 * Not a style preference — at seven columns a tile is ~84px wide, and "UNDER CONSTRUCTION"
 * set in tracked 10px mono overflowed its own border (measured in a browser, not guessed).
 * The full `KIND_LABEL` is still used everywhere there is room for it: the score formula and
 * the drill-down heading. Every word here wraps to at most two short lines.
 */
const KIND_TILE_LABEL: Readonly<Record<AmenityKind, string>> = {
  school: "Schools",
  transport: "Transport",
  shop: "Shops",
  health: "Health",
  park: "Green space",
  premium: "Premium retail",
  construction: "Building work",
};

/** One mark per category, so the seven tiles are told apart at a glance rather than by
 *  reading seven labels. Shown *with* the label, never instead of it — a pictogram for
 *  "premium retail" that a reader has to decode is worse than the words. */
const KIND_ICON: Readonly<Record<AmenityKind, (p: { readonly className?: string }) => React.JSX.Element>> = {
  school: SchoolIcon,
  transport: TrainIcon,
  shop: ShopIcon,
  health: HealthIcon,
  park: TreeIcon,
  premium: DiamondIcon,
  construction: ConstructionIcon,
};

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
  /** Which category's list is expanded. One at a time — seven simultaneously open lists is
   *  a directory, and this is a report. */
  const [open, setOpen] = useState<AmenityKind | null>(null);

  /**
   * The list behind the clicked count, derived from the same array the counts summarise.
   * **Not a second fetch and not a second slice** — if this filtered a different source
   * than the tile's number came from, the drill-down could disagree with the badge that
   * opened it, which is the failure this feature exists to avoid.
   */
  const openItems =
    open === null || data === null ? [] : data.items.filter((a) => a.kind === open);

  async function load(): Promise<void> {
    setPending(true);
    setError(null);
    // A list expanded against the previous point must not survive into a new one.
    setOpen(null);
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
          <h3 className="flex items-center gap-2 text-[15px] font-semibold">
            <MapPinIcon className="h-4 w-4 shrink-0 text-muted" />
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

      {/* Overpass is a busy shared service and a first lookup for an area can take tens of
          seconds (the timeout is deliberately generous — see `neighbourhood.ts` — because
          the result is then cached and nobody waits for that spot again). A bare "Checking…"
          for that long reads as a hung page, so the wait is named rather than left to be
          guessed at. */}
      {pending && (
        <p className="mt-3 text-xs leading-relaxed text-muted" aria-live="polite">
          Asking OpenStreetMap what&apos;s nearby. The first check of an area can take up to
          half a minute — it&apos;s a shared community service, and the answer is saved
          afterwards so this spot loads instantly next time.
        </p>
      )}

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

          {/* Each tile is a real <button> with aria-expanded, not a clickable div: this is a
              disclosure control, and a keyboard or screen-reader user has to be able to
              reach it and be told what it does. `aria-controls` points at the panel it
              opens. A count of zero is deliberately not clickable — there is nothing to
              show, and a button that opens an empty list is a dead end dressed as a
              control. */}
          <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {KIND_ORDER.map((k) => {
              const count = data.counts[k];
              const isOpen = open === k;
              const Icon = KIND_ICON[k];
              if (count === 0) {
                return (
                  <div
                    key={k}
                    className="h-full rounded-card border border-line bg-surfaceMuted px-3 py-2.5 opacity-60"
                  >
                    {/* `min-h` on the label, not the tile: a one-line and a two-line label
                        must reserve the same space, or the numbers below them sit at
                        different heights across the row. */}
                    <Icon className="h-4 w-4 text-muted" />
                    <dt className="mt-1.5 min-h-[2.4em] font-mono text-[10px] uppercase leading-tight tracking-[0.06em] text-muted">
                      {KIND_TILE_LABEL[k]}
                    </dt>
                    <dd className="tnum mt-1 text-lg font-semibold text-muted">0</dd>
                    <span className="mt-0.5 block text-[10px] text-muted">None nearby</span>
                  </div>
                );
              }
              return (
                <div key={k} className="h-full">
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : k)}
                    aria-expanded={isOpen}
                    aria-controls={`nb-list-${k}`}
                    className={`h-full w-full rounded-card border px-3 py-2.5 text-left transition-colors ${
                      isOpen
                        ? "border-accent bg-accent/5"
                        : "border-line bg-surfaceMuted hover:border-accent/40 hover:bg-accent/[0.03]"
                    }`}
                  >
                    <Icon
                      className={`h-4 w-4 ${isOpen ? "text-accent" : "text-muted"}`}
                    />
                    <dt className="mt-1.5 min-h-[2.4em] font-mono text-[10px] uppercase leading-tight tracking-[0.06em] text-muted">
                      {KIND_TILE_LABEL[k]}
                    </dt>
                    <dd className="tnum mt-1 flex items-baseline gap-1.5 text-lg font-semibold text-mist">
                      {count}
                      <span
                        aria-hidden="true"
                        className={`text-[10px] font-normal text-muted transition-transform ${
                          isOpen ? "rotate-180" : ""
                        }`}
                      >
                        ▾
                      </span>
                    </dd>
                    <span className="mt-0.5 block text-[10px] text-muted">
                      {isOpen ? "Hide the list" : "See the list"}
                    </span>
                  </button>
                </div>
              );
            })}
          </dl>

          {open !== null && (
            <div
              id={`nb-list-${open}`}
              className="mt-4 rounded-panel border border-line bg-surfaceMuted px-4 py-3"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h4 className="flex items-center gap-2 text-sm font-semibold text-mist">
                  {(() => {
                    const OpenIcon = KIND_ICON[open];
                    return <OpenIcon className="h-4 w-4 shrink-0 text-accent" />;
                  })()}
                  {KIND_LABEL[open]} within {RADIUS_M[open]} m
                  <span className="font-normal text-muted">
                    ({openItems.length} {openItems.length === 1 ? "place" : "places"})
                  </span>
                </h4>
                <button
                  type="button"
                  onClick={() => setOpen(null)}
                  className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted underline hover:text-mist"
                >
                  Close
                </button>
              </div>

              {/* Long in a dense district — 30+ shops is normal on Hong Kong Island — so it
                  scrolls in its own box rather than pushing the rest of the report off
                  screen. */}
              <ol className="mt-2 max-h-80 divide-y divide-line overflow-y-auto">
                {openItems.map((a, i) => (
                  <li
                    key={`${a.kind}-${a.name}-${a.metres}`}
                    className="flex items-baseline justify-between gap-3 py-2"
                  >
                    <span className="flex min-w-0 items-baseline gap-2">
                      <span className="tnum shrink-0 font-mono text-[10px] text-muted">
                        {i + 1}.
                      </span>
                      <span className="min-w-0">
                        <span className="text-sm text-mist">{a.name}</span>
                        <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.06em] text-muted">
                          {a.subtype.replace(/_/g, " ")}
                        </span>
                      </span>
                    </span>
                    <span className="tnum shrink-0 font-mono text-xs text-muted">
                      {a.metres} m
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {open === null && (
            <>
              <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.08em] text-muted">
                Closest ten, all categories
              </p>
              {/* The closest-ten list mixes all seven categories, so each row carries its
                  own mark — without one, "Mong Kok" and "Wing Shing Dispensary" are two
                  names with no visible clue which is the station and which the pharmacy
                  until the subtype text is read. */}
              <ul className="mt-1 divide-y divide-line">
                {data.items.slice(0, 10).map((a) => {
                  const RowIcon = KIND_ICON[a.kind];
                  return (
                  <li
                    key={`${a.kind}-${a.name}-${a.metres}`}
                    className="flex items-baseline justify-between gap-3 py-2"
                  >
                    <span className="flex min-w-0 items-baseline gap-2">
                      <RowIcon className="h-3.5 w-3.5 shrink-0 translate-y-0.5 text-muted" />
                      <span className="min-w-0">
                        <span className="text-sm text-mist">{a.name}</span>
                        <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.06em] text-muted">
                          {a.subtype.replace(/_/g, " ")}
                        </span>
                      </span>
                    </span>
                    <span className="tnum shrink-0 font-mono text-xs text-muted">
                      {a.metres} m
                    </span>
                  </li>
                  );
                })}
              </ul>
            </>
          )}

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
