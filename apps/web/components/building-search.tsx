"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Search a **real** Hong Kong building by name, against the Government's Address Lookup
 * Service via `GET /api/buildings/search`.
 *
 * This is the first thing on this site that searches real inventory rather than the
 * fabricated `DEMO_LISTINGS` — so it carries no demo banner, and deliberately does not
 * pretend to be more than it is: ALS returns an *address*, not a listing. There is no
 * price, no rent and no yield here, because no free source publishes those per building.
 * What it does give is the thing `/analyse` most needs and previously had to be typed by
 * hand: a real building, its estate, its district and its coordinates.
 *
 * **It also indexes non-residential addresses** — fire stations, substations, government
 * complexes come back for plausible queries. Rather than filter by guesswork on the name
 * (a "substation" might be a residential block called that, and the service exposes no
 * usage field), results are shown as-is and the caveat is printed once beneath them.
 */

interface Match {
  readonly label: string;
  readonly estateNameEn?: string;
  readonly estateNameZh?: string;
  readonly streetEn?: string;
  readonly buildingNo?: string;
  readonly districtId: string;
  readonly districtNameAls: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly score: number;
}

interface Props {
  /** Called with a chosen building, if the caller wants to do something with it. */
  readonly onSelect?: (match: Match) => void;
}

export function BuildingSearch({ onSelect }: Props): React.JSX.Element {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<readonly Match[] | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<string | null>(null);
  // Guards against an older, slower response overwriting a newer one — the classic
  // async-search bug, where typing fast leaves the results of an abandoned query on screen.
  const seq = useRef(0);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults(null);
      setError(null);
      return;
    }

    const mine = ++seq.current;
    const timer = setTimeout(() => {
      setPending(true);
      setError(null);
      fetch(`/api/buildings/search?q=${encodeURIComponent(q)}&limit=8`)
        .then(async (res) => {
          const body = await res.text();
          if (!res.ok) throw new Error(body || `Search failed (${res.status})`);
          return JSON.parse(body) as { results: readonly Match[]; source: string };
        })
        .then((json) => {
          if (mine !== seq.current) return;
          setResults(json.results);
          setSource(json.source);
        })
        .catch((cause: unknown) => {
          if (mine !== seq.current) return;
          setResults(null);
          setError(cause instanceof Error ? cause.message : "Search failed.");
        })
        .finally(() => {
          if (mine === seq.current) setPending(false);
        });
      // Debounced: ALS is a government service and every keystroke is a real request to it.
    }, 350);

    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className="card">
      <label className="block">
        <span className="text-sm font-medium">Find a real building</span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Estate or building name — e.g. Taikoo Shing, Mei Foo Sun Chuen"
          className="mt-1.5 w-full rounded-card border border-line bg-surfaceMuted px-3.5 py-2.5 text-[15px] outline-none focus:border-accent focus:bg-surface"
        />
      </label>

      <p className="mt-2 text-xs leading-relaxed text-muted">
        Real addresses from the Government&apos;s Address Lookup Service — not listings.
        No price or yield here: no free source publishes those per building.
      </p>

      {pending && <p className="mt-3 text-sm text-muted">Searching…</p>}

      {error !== null && (
        <p role="alert" className="mt-3 text-sm text-negative">
          {error}
        </p>
      )}

      {results !== null && results.length === 0 && !pending && (
        <p className="mt-3 text-sm text-muted">
          No address matched. Try the estate name rather than a block or a flat.
        </p>
      )}

      {results !== null && results.length > 0 && (
        <>
          <ul className="mt-3 divide-y divide-line">
            {results.map((m) => (
              <li key={`${m.districtId}-${m.label}`}>
                <button
                  type="button"
                  onClick={() => onSelect?.(m)}
                  disabled={onSelect === undefined}
                  className="flex w-full items-baseline justify-between gap-3 py-2.5 text-left enabled:hover:text-accent disabled:cursor-default"
                >
                  <span>
                    <span className="text-[15px] font-medium">{m.label}</span>
                    <span className="mt-0.5 block text-xs text-muted">
                      {[m.estateNameEn, m.districtNameAls].filter(Boolean).join(" · ")}
                      {m.estateNameZh === undefined ? "" : ` · ${m.estateNameZh}`}
                    </span>
                  </span>
                  <span className="tnum shrink-0 font-mono text-[10px] text-muted">
                    {m.latitude.toFixed(4)}, {m.longitude.toFixed(4)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] leading-relaxed text-muted">
            {source}. The register covers every address, not only homes — a result may be a
            substation or a government building.
          </p>
        </>
      )}
    </div>
  );
}
