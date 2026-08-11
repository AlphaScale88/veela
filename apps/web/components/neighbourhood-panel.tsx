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

          <p className="mt-3 text-[11px] leading-relaxed text-muted">
            Straight-line distance, not walking distance. {data.attribution} — coverage is
            contributor-maintained, so a missing school means nobody has mapped it, not
            that there isn&apos;t one. Treat this as a prompt to look, not an inventory.
          </p>
          <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
            <strong className="text-mist">No area score, on purpose.</strong>{" "}
            &ldquo;Premium retail&rdquo; counts a named list of brands kept in the codebase,
            and &ldquo;under construction&rdquo; counts sites tagged as such — both are
            proxies we chose, not measurements. Rolling them into one number would make a
            judgement look like a fact; you can disagree with any single row above.
          </p>
        </>
      )}
    </section>
  );
}
