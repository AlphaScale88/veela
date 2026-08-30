"use client";

import { DEMO_DISTRICTS, DEMO_PERIODS, RVD_PRICE_INDEX, RVD_RENT_INDEX, RVD_SOURCE, demoSeries } from "@veela/fixtures";
import { viz } from "@veela/ui";
import { useMemo, useState } from "react";

import { AppShell, StarIcon } from "../../../components/app-shell";
import { useAuth } from "../../../components/auth-provider";
import { ClassYieldChart } from "../../../components/class-yield-chart";
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

  const realPrice = useMemo(() => RVD_PRICE_INDEX.slice(-months), [months]);
  const realRent = useMemo(() => RVD_RENT_INDEX.slice(-months), [months]);

  /*
   * Measured, territory-wide — not the generated per-district series these replaced.
   *
   * Those charts drew a *fabricated* index per district and the header printed its five-year
   * change. For Central and Western that read **+42.9% price, +23.0% rent**. The real RVD
   * series in this repository says **-18.0% and +14.8%** over the same window: the generated
   * line was not merely invented, it pointed the opposite way on the single number a reader
   * takes from this page, under a real district's name, in green.
   *
   * A "generated values" banner is honest about provenance and does nothing about direction.
   * Someone reading for ten seconds left believing Hong Kong property rose 43% in five years.
   *
   * The fix is the one `area-rent.tsx` already applies to rents: show the real figure at the
   * resolution it exists and say what that resolution is. Hong Kong publishes no monthly
   * per-district domestic index, so there is no district line to draw honestly -- three real
   * regions beat eighteen invented ones, and one real territory beats eighteen invented
   * districts for exactly the same reason.
   */
  const priceChange = pctChange(realPrice);
  const rentChange = pctChange(realRent);

  return (
    <AppShell breadcrumb={`Research & Analyse › Market Performance › ${districtName}`}>
      <header className="max-w-prose">
        <h1 className="font-display text-[26px] font-semibold tracking-[-0.03em] text-mist">
          Market Performance
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Measured yields, prices and rents from the Rating and Valuation Department —
          followed by the per-district charts, which are still generated because no free
          source publishes a monthly domestic series at district level. Every panel says
          which it is.
        </p>
      </header>

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-mist">
          Gross rental yield by flat class — measured
        </h2>
        <p className="mt-1 max-w-prose text-xs leading-relaxed text-muted">
          RVD&apos;s own published yields, monthly since 1999. This is the market&apos;s
          answer rather than ours — every other yield in this product is either computed
          from figures you typed or, on the pages that say so, generated. Small flats have
          out-yielded large ones by more than a point for twenty-seven years, and the whole
          market has roughly halved since 1999.
        </p>
        <div className="card mt-4 max-w-3xl">
          <ClassYieldChart />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-semibold text-mist">Price and rent indices — measured</h2>
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
        <h2 className="text-sm font-semibold text-mist">Over your chosen window — measured</h2>
        <p className="mt-1 max-w-prose text-xs leading-relaxed text-muted">
          The same RVD series as above, cut to the range you pick.{" "}
          <strong className="text-mist">Hong Kong overall, not by district</strong> — no free
          source publishes a monthly domestic index per district, so there is no district line
          that could be drawn honestly. Generated ones used to sit here and have been removed:
          they showed prices rising over five years when the measured series shows them falling.
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
        <TerritoryIndexChart label="Price index" points={realPrice} color={viz.demand} />
        <div className="h-px bg-line" />
        <TerritoryIndexChart label="Rent index" points={realRent} color={viz.supply} />
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
