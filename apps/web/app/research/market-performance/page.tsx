"use client";

import { DEMO_DISTRICTS, DEMO_PERIODS, RVD_PRICE_INDEX, RVD_RENT_INDEX, RVD_SOURCE, demoSeries } from "@veela/fixtures";
import { viz } from "@veela/ui";
import { useMemo, useState } from "react";

import { AppShell, StarIcon } from "../../../components/app-shell";
import { useAuth } from "../../../components/auth-provider";
import { SeriesChart } from "../../../components/series-chart";
import { TerritoryIndexChart } from "../../../components/territory-index-chart";
import { useFavoriteDistricts } from "../../../components/use-favorite-districts";

/**
 * "How has the market moved" — price and rent index trends, as distinct from `/map`'s
 * "where is supply loosening" (vacancy against transaction volume). Same underlying
 * fixture package, same synthetic-data discipline, different question: this is Mashvisor's
 * "Market Performance" concept, not a relabelling of the supply/demand map.
 */
const RANGES = [
  { id: "12", label: "Last 12 months", months: 12 },
  { id: "36", label: "Last 3 years", months: 36 },
  { id: "60", label: "All 5 years", months: 60 },
] as const;
type RangeId = (typeof RANGES)[number]["id"];

export default function MarketPerformancePage(): React.JSX.Element {
  // Lazy initialiser reads the query string once, on mount — a deep link from
  // /portfolio/favorites ("View performance →") should open on that district, not
  // reset it every time the URL happens to re-render.
  const [districtId, setDistrictId] = useState<string>(() => {
    if (typeof window === "undefined") return "HK-WCH";
    const requested = new URLSearchParams(window.location.search).get("district");
    return requested !== null && DEMO_DISTRICTS.some((d) => d.id === requested) ? requested : "HK-WCH";
  });
  const [rangeId, setRangeId] = useState<RangeId>("60");
  const { configured, user } = useAuth();
  const { favorites, toggle } = useFavoriteDistricts();
  const isFavorite = favorites.includes(districtId);

  const months = RANGES.find((r) => r.id === rangeId)?.months ?? 60;
  const district = DEMO_DISTRICTS.find((d) => d.id === districtId) ?? DEMO_DISTRICTS[0];
  const districtName = district?.nameEn ?? "—";

  const price = useMemo(
    () => demoSeries(districtId, "price_index").points.slice(-months),
    [districtId, months],
  );
  const rent = useMemo(
    () => demoSeries(districtId, "rent_index").points.slice(-months),
    [districtId, months],
  );

  const priceChange = pctChange(price);
  const rentChange = pctChange(rent);

  const realPrice = useMemo(() => RVD_PRICE_INDEX.slice(-months), [months]);
  const realRent = useMemo(() => RVD_RENT_INDEX.slice(-months), [months]);

  return (
    <AppShell breadcrumb={`Research & Analyse › Market Performance › ${districtName}`}>
      <header className="max-w-prose">
        <h1 className="font-display text-[26px] font-semibold tracking-[-0.03em] text-mist">
          Market Performance
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Price and rent indices, both real and district-level.
        </p>
      </header>

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-mist">Territory-wide — real</h2>
        <p className="mt-1 max-w-prose text-xs leading-relaxed text-muted">
          Hong Kong&apos;s private domestic price and rental indices, All Classes, rebased
          to 100 at January 1999 — downloaded directly from the{" "}
          <a
            href={RVD_SOURCE.url}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-accent hover:underline"
          >
            {RVD_SOURCE.label}
          </a>
          , not generated. Territory-wide is the finest grain RVD publishes as a clean
          monthly series — a district-level breakdown only exists inside the annual
          Property Review&apos;s PDF tables, which is why the charts below this one are
          still synthetic.
        </p>
        <div className="card mt-4 max-w-3xl space-y-6">
          <TerritoryIndexChart label="Price index" points={realPrice} color={viz.demand} />
          <div className="h-px bg-line" />
          <TerritoryIndexChart label="Rent index" points={realRent} color={viz.supply} />
        </div>
      </section>

      <div className="mt-10 border-t border-line pt-8">
        <h2 className="text-sm font-semibold text-mist">By district — synthetic</h2>
        <p className="mt-1 max-w-prose text-xs leading-relaxed text-muted">
          Price and rent indices, rebased to 100 at {DEMO_PERIODS[0] !== undefined ? formatMonth(DEMO_PERIODS[0]) : "the start of the series"}.
          Synthetic — see the banner below — standing in for a real per-district series,
          which no free Hong Kong source publishes monthly.
        </p>
      </div>

      <div className="mt-4 max-w-prose rounded-panel border border-caution/40 bg-caution/10 px-4 py-3 shadow-card">
        <p className="text-xs leading-relaxed text-muted">
          <strong className="text-mist">Demo data.</strong> District names are real; the
          index values are generated with a plausible shape (slow drift, small monthly
          noise) — not a published per-district series.
        </p>
      </div>

      <div className="card mt-6 flex flex-wrap items-end gap-4 py-4">
        <label className="text-xs">
          <span className="block text-muted">District</span>
          <select
            value={districtId}
            onChange={(e) => setDistrictId(e.target.value)}
            className="mt-1 rounded-card border border-line bg-surfaceMuted px-2.5 py-1.5 text-sm text-mist outline-none focus:border-accent focus:bg-surface"
          >
            {DEMO_DISTRICTS.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nameEn}
              </option>
            ))}
          </select>
        </label>

        {configured && user !== null && (
          <button
            type="button"
            onClick={() => toggle(districtId)}
            aria-pressed={isFavorite}
            title={isFavorite ? "Remove from My Favorite Markets" : "Add to My Favorite Markets"}
            className={`mt-4 flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              isFavorite
                ? "border-caution bg-caution/10 text-caution"
                : "border-line text-muted hover:text-mist"
            }`}
          >
            <StarIcon className="h-3.5 w-3.5" />
            {isFavorite ? "Favorited" : "Favorite"}
          </button>
        )}

        <label className="text-xs">
          <span className="block text-muted">Range</span>
          <select
            value={rangeId}
            onChange={(e) => setRangeId(e.target.value as RangeId)}
            className="mt-1 rounded-card border border-line bg-surfaceMuted px-2.5 py-1.5 text-sm text-mist outline-none focus:border-accent focus:bg-surface"
          >
            {RANGES.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </label>

        <div className="ml-auto flex gap-6 font-mono text-xs">
          <span>
            Price <span className={priceChange >= 0 ? "text-positive" : "text-negative"}>{formatPct(priceChange)}</span>
          </span>
          <span>
            Rent <span className={rentChange >= 0 ? "text-positive" : "text-negative"}>{formatPct(rentChange)}</span>
          </span>
        </div>
      </div>

      <div className="card mt-6 max-w-3xl space-y-6">
        <SeriesChart metric="price_index" points={price} districtName={districtName} />
        <div className="h-px bg-line" />
        <SeriesChart metric="rent_index" points={rent} districtName={districtName} />
      </div>
    </AppShell>
  );
}

function pctChange(points: readonly { readonly value: number }[]): number {
  const first = points[0]?.value;
  const last = points[points.length - 1]?.value;
  if (first === undefined || last === undefined || first === 0) return 0;
  return (last - first) / first;
}

function formatPct(v: number): string {
  const pct = (v * 100).toFixed(1);
  return v >= 0 ? `+${pct}%` : `${pct}%`;
}

function formatMonth(periodStart: string): string {
  const [year, month] = periodStart.split("-");
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const idx = Number(month) - 1;
  return `${names[idx] ?? month} ${year}`;
}
