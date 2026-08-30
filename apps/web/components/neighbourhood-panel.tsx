"use client";

import { useEffect, useMemo, useState } from "react";

import {
  BusIcon,
  ConstructionIcon,
  DiamondIcon,
  HealthIcon,
  MapPinIcon,
  SchoolIcon,
  ShopIcon,
  TrainIcon,
  TreeIcon,
} from "./icons";
import { KIND_PIN, NeighbourhoodMap } from "./neighbourhood-map";

/**
 * What's within walking distance — schools, stations, shops, health, green space.
 *
 * **Prefetched when it can be, on demand when it can't.**
 *
 * This used to say "loads on demand, not with the report" and render a *Check the area*
 * button, because Overpass takes seconds and blocking the report on a community API made the
 * whole page feel broken. That constraint is real and unchanged — what changed is *when* the
 * work can start. `/analyse` now fires the lookup as soon as a location is known, while the
 * reader is still filling in figures, and hands the result down as `initialData`. By the time
 * the report is asked for, the section is simply there.
 *
 * The button is still the fallback for the case the prefetch cannot cover: no location known
 * until the report exists, or a prefetch that failed. So the slow path is unchanged rather
 * than replaced — it just stopped being the common one.
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
  | "bus"
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
  /** Payload v3, and **required rather than optional**: the server's version check turns a
   *  pre-v3 cached row into a miss, so a response carrying `items` without coordinates
   *  cannot reach this component. Typing them optional would mean writing fallbacks for a
   *  state that cannot occur, and hiding the guarantee that makes the map safe. */
  readonly latitude: number;
  readonly longitude: number;
}

export interface NeighbourhoodData {
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
  bus: 500,
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
  transport: "Rail, tram, ferry",
  bus: "Bus stops",
  shop: "Shops",
  health: "Health",
  park: "Green space",
  premium: "Premium retail",
  construction: "Building work",
};

/** One mark per category, so the seven tiles are told apart at a glance rather than by
 *  reading seven labels. Shown *with* the label, never instead of it — a pictogram for
 *  "premium retail" that a reader has to decode is worse than the words. */
const KIND_ICON: Readonly<
  Record<
    AmenityKind,
    (p: { readonly className?: string; readonly style?: React.CSSProperties }) => React.JSX.Element
  >
> = {
  school: SchoolIcon,
  transport: TrainIcon,
  bus: BusIcon,
  shop: ShopIcon,
  health: HealthIcon,
  park: TreeIcon,
  premium: DiamondIcon,
  construction: ConstructionIcon,
};

const KIND_LABEL: Readonly<Record<AmenityKind, string>> = {
  school: "Schools",
  bus: "Bus stops",
  transport: "Rail, tram and ferry",
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
  "bus",
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
 * **Transport was recalibrated a second time (13/08/2026), because the input changed.** The
 * old query found only heavy-rail stations, subway entrances and bus *termini* — about 5% of
 * the transport nodes OSM actually holds — so a target of 10 was set against a badly
 * undercounted number and saturated for most of urban Hong Kong. With trams, ferries, minor
 * halts and ordinary bus stops now included and split into two kinds, measured again with
 * the app's own radii and dedupe rule:
 *
 * | Area | transport (900m) | bus stops (500m) |
 * |---|---|---|
 * | Central | 27 | 48 |
 * | Causeway Bay | 22 | 37 |
 * | Taikoo Shing | 14 | 15 |
 * | Tuen Mun | 12 | 19 |
 * | Mong Kok | 10 | 47 |
 * | Ap Lei Chau | 7 | 16 |
 *
 * The old 25 points for transport are **split 18 / 7** rather than added to, so the weights
 * still sum to 100 and no other category was silently re-weighted. Buses get the smaller
 * share deliberately: bus coverage is near-universal here, so it tracks *density* more than
 * connectivity, while the presence or absence of a rail station is the thing that actually
 * separates two Hong Kong addresses.
 *
 * Resulting transport component across those areas: **Central 25, Causeway Bay 23, Mong Kok
 * 14, Taikoo 13, Tuen Mun 12, Ap Lei Chau 8** — a real spread where the previous version gave
 * Mong Kok, Central and Tuen Mun full marks alike.
 *
 * **A known artifact, not hidden:** Tuen Mun's count is inflated by Light Rail, which OSM
 * tags as `railway=station` and `railway=tram_stop` — tram-like stops scoring like heavy
 * rail. Defensible for a metric called *convenience* (it genuinely is well served), but it is
 * why this is not called a quality or desirability score.
 */
const WEIGHTS: readonly { kind: AmenityKind; weight: number; target: number }[] = [
  { kind: "transport", weight: 18, target: 25 },
  { kind: "bus", weight: 7, target: 40 },
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

/**
 * What a tile needs to answer "is 31 good?" — the question this panel could not answer.
 *
 * Reported by a reader looking at BUS STOPS 31: the tile showed a bare count, and the target it
 * is judged against sat in the formula line above it in mono capitals. A count with no
 * denominator is not information, it is trivia. `undefined` for building work, which is counted
 * and deliberately not scored.
 */
const SCORED_BY_KIND: Partial<Record<AmenityKind, { weight: number; target: number }>> =
  Object.fromEntries(WEIGHTS.map((w) => [w.kind, { weight: w.weight, target: w.target }]));

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
  /**
   * Already-fetched area data, handed down by `/analyse` when it prefetched while the reader
   * was still filling the form.
   *
   * **This is what removes the "Check the area" button.** The button existed because Overpass
   * takes seconds and blocking the report on it made the whole page feel broken — a real
   * constraint, but the wrong fix once the work can start *before* the report is asked for. If
   * the prefetch has landed, the section is simply there, complete, on arrival. If it hasn't
   * (no location known, or the prefetch failed), the button is still the fallback, so nothing
   * about the unprefetched path changed.
   */
  readonly initialData?: NeighbourhoodData | null;
  /** Set while the page's prefetch is still in flight, so the section can say it is coming
   *  instead of showing a button that would fire a second, duplicate request. */
  readonly prefetching?: boolean;
}

/**
 * A failure a reader can act on, rather than the exception that caused it.
 *
 * **Reported from the running app: a building lookup showed the single line "Failed to fetch".**
 * That is the browser's own `TypeError` when a request never reaches the server at all — the dev
 * server was down at the time — and printing it raw has three problems. It names no cause, it
 * suggests nothing to do, and sitting under the reader's own address it reads as a defect in
 * *their* property rather than a dropped connection.
 *
 * The same defect was already fixed once on the report's submit path, where a dropped connection
 * surfaced as the identical string. It was never fixed here, which is the argument for having a
 * named function rather than a `catch` block per call site.
 *
 * The distinction that matters is **transport versus upstream**. A `TypeError` from `fetch` means
 * the request did not arrive: the reader's connection, or the server being down, and retrying is
 * the sensible move. Anything else came *back* from our own handler — Overpass refusing, a bad
 * coordinate — and those messages are already written for a reader and are passed through
 * unchanged, because the handler knows things this function does not.
 */
function describeFetchFailure(cause: unknown): string {
  /* `TypeError` is what every browser throws when the request cannot be made at all. The message
     text differs by browser ("Failed to fetch", "NetworkError…", "Load failed"), so the type is
     what to key on, never the string. */
  if (cause instanceof TypeError) {
    return "Could not reach Veela to look this up — that is usually the connection rather than the address. Nothing you have entered has been lost; try again in a moment.";
  }
  if (cause instanceof Error && cause.message.trim() !== "") return cause.message;
  return "Could not load the neighbourhood for this building.";
}

export function NeighbourhoodPanel({
  latitude,
  longitude,
  label,
  initialData,
  prefetching = false,
}: Props): React.JSX.Element {
  const [data, setData] = useState<NeighbourhoodData | null>(initialData ?? null);
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

  /** Hovered list row, so the matching pin can lift. Keyed exactly like the list's React
   *  key, so the two cannot drift apart. */
  const [hovered, setHovered] = useState<string | null>(null);

  /* The prefetch usually resolves before this section mounts, but not always — a slow cold
     Overpass call can land after the reader has already clicked through to the report. Adopt
     it when it arrives, without clobbering a result this component fetched itself. */
  useEffect(() => {
    if (initialData !== undefined && initialData !== null) setData((d) => d ?? initialData);
  }, [initialData]);

  /**
   * What the map draws: **the same rows the list is showing**, never a different slice.
   * With a category expanded that is all of it; otherwise the closest ten, matching the
   * preview beside it. Feeding the map a fuller set than the list would put pins on screen
   * with nothing to click back to.
   */
  /**
   * The default preview: **the nearest of each kind**, not the ten nearest overall.
   *
   * It was `items.slice(0, 10)` — which broke the moment ordinary bus stops were added. Hong
   * Kong puts a bus stop on almost every block, so the ten closest things to any urban
   * address became nine bus stops and a 7-Eleven, burying the station and the school that are
   * the point. One row per category always answers the more useful question ("what is my
   * nearest school, and how far?") and cannot be crowded out by whichever category happens to
   * be densest.
   */
  const nearestPerKind =
    data === null
      ? []
      : KIND_ORDER.map((k) => data.items.find((a) => a.kind === k)).filter(
          (a): a is Amenity => a !== undefined,
        );

  /* Memoised because it is a prop on the map, and a new array on every render used to re-fit
     the camera — see `FitToItems`. The effect no longer depends on identity, so this is belt as
     well as braces; it also stops the marker list rebuilding on every hover. */
  const mapItems = useMemo(
    () => (data === null ? [] : open === null ? nearestPerKind : openItems),
    [data, open, nearestPerKind, openItems],
  );

  /** The map is optional infrastructure, like every other map in this app: no key, no map,
   *  and the list alone still answers the question it was built to answer. */
  const mapsKey = process.env["NEXT_PUBLIC_GOOGLE_MAPS_API_KEY"];

  async function load(): Promise<void> {
    setPending(true);
    setError(null);
    // A list expanded against the previous point must not survive into a new one.
    setOpen(null);
    try {
      const res = await fetch(`/api/neighbourhood?lat=${latitude}&lng=${longitude}`);
      const body = await res.text();
      if (!res.ok) throw new Error(body || `Request failed (${res.status})`);
      setData(JSON.parse(body) as NeighbourhoodData);
    } catch (cause) {
      setError(describeFetchFailure(cause));
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
        {data === null && !prefetching && (
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

      {prefetching && data === null && (
        <p className="mt-3 text-xs leading-relaxed text-muted" aria-live="polite">
          Gathering the area data — schools, transport, shops and the rest — so it is ready with
          the report.
        </p>
      )}

      {error !== null && (
        /* A retry button beside the message, because "try again in a moment" with nothing to
           press is an instruction to reload the page and lose the form. */
        <div role="alert" className="mt-3 flex flex-wrap items-start gap-x-3 gap-y-1.5">
          <p className="flex-1 text-xs leading-relaxed text-negative">{error}</p>
          <button
            type="button"
            onClick={() => void load()}
            disabled={pending}
            className="btn-secondary shrink-0 !py-1 !text-[12px]"
          >
            {pending ? "Trying…" : "Try again"}
          </button>
        </div>
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
                {/* "BUS STOPS 5/7 (31 OF 40)" read as two unexplained fractions. Same numbers
                    below, in the order the sentence actually goes: what was found, what full
                    marks needs, what it therefore earned. */}
                <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] uppercase tracking-[0.06em] text-muted">
                  {rows.map((r) => (
                    <li key={r.kind}>
                      {KIND_LABEL[r.kind]}{" "}
                      <span className="text-mist">
                        {r.counted} of {r.target}
                      </span>{" "}
                      &rarr; {r.points}/{r.weight} pts
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
          {/* Four across, not seven: splitting transport into rail/tram/ferry and bus stops
              made eight tiles, and eight in a seven-column grid orphans the last one on a row
              of its own. Two rows of four also give the longer labels ("Rail, tram, ferry")
              room to sit on one or two lines instead of three. */}
          <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {KIND_ORDER.map((k) => {
              const count = data.counts[k];
              const isOpen = open === k;
              const Icon = KIND_ICON[k];
              const scored = SCORED_BY_KIND[k];
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
                      {scored !== undefined && (
                        <span className="text-[11px] font-normal text-muted">
                          / {scored.target}
                        </span>
                      )}
                      <span
                        aria-hidden="true"
                        className={`ml-auto text-[10px] font-normal text-muted transition-transform ${
                          isOpen ? "rotate-180" : ""
                        }`}
                      >
                        ▾
                      </span>
                    </dd>

                    {/* The bar is the whole answer to "is 31 good?": it fills to the target,
                        so three-quarters full reads as three-quarters served without anyone
                        having to find the formula. Capped, because the score caps too — 30
                        parks against a target of 22 is full marks, not 136%. */}
                    {scored !== undefined ? (
                      <>
                        <div
                          className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-line"
                          role="img"
                          aria-label={`${count} of ${scored.target} for full marks`}
                        >
                          <div
                            className={`h-full rounded-full ${
                              count >= scored.target ? "bg-positive" : "bg-accent"
                            }`}
                            style={{ width: `${Math.min(100, (count / scored.target) * 100)}%` }}
                          />
                        </div>
                        <span className="mt-1 block text-[10px] text-muted">
                          {count >= scored.target
                            ? `Full marks — ${scored.weight}/${scored.weight} pts`
                            : `${Math.round(
                                Math.min(1, count / scored.target) * scored.weight,
                              )}/${scored.weight} pts`}
                        </span>
                      </>
                    ) : (
                      /* Building work: counted, shown, and deliberately not scored, so it gets
                         no bar and says why rather than looking like a tile that lost one. */
                      <span className="mt-1.5 block text-[10px] text-muted">Not scored</span>
                    )}
                    <span className="mt-0.5 block text-[10px] text-muted">
                      {isOpen ? "Hide the list" : "See the list"}
                    </span>
                  </button>
                </div>
              );
            })}
          </dl>

          {/* Between the counts and the list, because it belongs to whichever of the two is
              currently in view: it re-frames itself when a category is expanded, and shows
              the closest ten otherwise. */}
          {mapsKey !== undefined && mapsKey !== "" && (
            <div className="mt-4">
              <NeighbourhoodMap
                latitude={latitude}
                longitude={longitude}
                label={label}
                items={mapItems}
                radiusKind={open ?? undefined}
                highlightKey={hovered}
              />
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                {(open === null ? KIND_ORDER : [open]).map((k) => (
                  <span
                    key={k}
                    className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.06em] text-muted"
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: KIND_PIN[k] }}
                    />
                    {KIND_TILE_LABEL[k]}
                  </span>
                ))}
                <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.06em] text-muted">
                  <span className="h-2.5 w-2.5 rounded-full border-2 border-white bg-accent" />
                  This property
                </span>
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
                {open === null
                  ? "The nearest of each kind. Open a count above to map that category on its own."
                  : `The shaded circle is the actual ${RADIUS_M[open]} m search radius for ${KIND_LABEL[open].toLowerCase()}.`}{" "}
                Pins are straight-line positions — a pin 300 m away can still be a longer
                walk around a block.
              </p>
            </div>
          )}

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
                    onMouseEnter={() => setHovered(`${a.kind}-${a.name}-${a.metres}`)}
                    onMouseLeave={() => setHovered(null)}
                    className="flex items-baseline justify-between gap-3 rounded-card px-1 py-2 hover:bg-accent/[0.05]"
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
                Nearest of each kind
              </p>
              {/* The closest-ten list mixes all seven categories, so each row carries its
                  own mark — without one, "Mong Kok" and "Wing Shing Dispensary" are two
                  names with no visible clue which is the station and which the pharmacy
                  until the subtype text is read. */}
              <ul className="mt-1 divide-y divide-line">
                {nearestPerKind.map((a) => {
                  const RowIcon = KIND_ICON[a.kind];
                  return (
                  <li
                    key={`${a.kind}-${a.name}-${a.metres}`}
                    onMouseEnter={() => setHovered(`${a.kind}-${a.name}-${a.metres}`)}
                    onMouseLeave={() => setHovered(null)}
                    className="flex items-baseline justify-between gap-3 rounded-card px-1 py-2 hover:bg-accent/[0.05]"
                  >
                    <span className="flex min-w-0 items-baseline gap-2">
                      <RowIcon
                        className="h-3.5 w-3.5 shrink-0 translate-y-0.5"
                        style={{ color: KIND_PIN[a.kind] }}
                      />
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
