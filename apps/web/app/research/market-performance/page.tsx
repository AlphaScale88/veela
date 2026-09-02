"use client";

import {
  DEMO_DISTRICTS,
  DEMO_PERIODS,
  POPULAR_DEV_LABELS,
  RVD_CLASS_INDEX_PERIODS,
  RVD_CLASS_LABELS,
  RVD_CLASS_SERIES_SOURCE,
  RVD_COMPLETIONS_BY_CLASS,
  RVD_POPULAR_DEV_PERIODS,
  RVD_POPULAR_DEV_PRICE_INDEX,
  RVD_PRICE_INDEX,
  RVD_PRICE_INDEX_BY_CLASS,
  RVD_PRIMARY_SALES_COUNT,
  RVD_RENT_INDEX,
  RVD_RENT_INDEX_BY_CLASS,
  RVD_SECONDARY_SALES_COUNT,
  RVD_SOURCE,
  RVD_STOCK_BY_CLASS,
  RVD_SUPPLY_SOURCE,
  RVD_SUPPLY_YEARS,
  RVD_TAKEUP,
  RVD_TRANSACTION_PERIODS,
  RVD_VACANCY_RATE_BY_CLASS,
  demoSeries,
  latestReported,
} from "@veela/fixtures";
import type { RvdClassKey } from "@veela/fixtures";
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

  /*
   * Which size band the two index charts show.
   *
   * "all" keeps the series this page has always drawn. The five Classes are new, and they
   * are the point: this product sorts every flat into an RVD Class — `rvdClassForAreaSqft`
   * does it, and the rent estimator already reads a per-Class yield — while this page showed
   * one all-classes line to everybody. A Class E owner reading it was being told about
   * somebody else's flat. Rents have diverged further than prices: Class A stands at 223.4
   * against Class E at 147.8, and the single line sits between them describing neither.
   */
  const [band, setBand] = useState<"all" | RvdClassKey>("all");

  const realPrice = useMemo(
    () =>
      band === "all"
        ? RVD_PRICE_INDEX.slice(-months)
        : classPoints(RVD_PRICE_INDEX_BY_CLASS[band]).slice(-months),
    [band, months],
  );
  const realRent = useMemo(
    () =>
      band === "all"
        ? RVD_RENT_INDEX.slice(-months)
        : classPoints(RVD_RENT_INDEX_BY_CLASS[band]).slice(-months),
    [band, months],
  );

  /*
   * Urban against New Territories — the only geographic split RVD publishes in a price
   * series, from its selected-popular-developments index. Two regions, not eighteen
   * districts: the same argument this codebase already makes for rents, that a real coarse
   * geography beats an invented fine one.
   */
  const urban = useMemo(
    () => classPoints(RVD_POPULAR_DEV_PRICE_INDEX.urbanOverall, RVD_POPULAR_DEV_PERIODS).slice(-months),
    [months],
  );
  const newTerritories = useMemo(
    () => classPoints(RVD_POPULAR_DEV_PRICE_INDEX.ntOverall, RVD_POPULAR_DEV_PERIODS).slice(-months),
    [months],
  );

  /* Supply by size band, at the latest year each series actually reported. */
  const supplyRows = useMemo(
    () =>
      (Object.keys(RVD_CLASS_LABELS) as RvdClassKey[]).map((key) => ({
        key,
        label: RVD_CLASS_LABELS[key],
        stock: latestAnnual(RVD_STOCK_BY_CLASS[key]),
        vacancy: latestAnnual(RVD_VACANCY_RATE_BY_CLASS[key]),
        completions: latestAnnual(RVD_COMPLETIONS_BY_CLASS[key]),
      })),
    [],
  );
  const takeUp = latestAnnual(RVD_TAKEUP.total);

  /*
   * Sale-and-purchase agreements — the demand side, and until now the largest thing this
   * repository held and never showed. `RVD_TRANSACTION_PERIODS` and the four count/value arrays
   * were parsed, committed and referenced by **no component at all**.
   *
   * It matters next to the price index above it rather than on its own page: an index says what
   * the market charged, this says how many people actually transacted. A price holding up on
   * collapsing volume is a different market from the same price on rising volume, and only one
   * of the two charts can tell you which.
   *
   * Counts, not values. The value series is held too, but HK$M and a count share no scale and
   * the value is mostly the count times the price index this page already draws — a third line
   * restating the other two is noise, not information.
   */
  const salesPoints = (counts: readonly (number | null)[]) =>
    RVD_TRANSACTION_PERIODS.map((periodStart, i) => ({ periodStart, value: counts[i] ?? 0 }))
      .filter((pt) => pt.value > 0)
      .slice(-months);

  const resale = useMemo(() => salesPoints(RVD_SECONDARY_SALES_COUNT), [months]);
  const newBuild = useMemo(() => salesPoints(RVD_PRIMARY_SALES_COUNT), [months]);

  const latestResale = resale[resale.length - 1]?.value ?? 0;
  const latestNew = newBuild[newBuild.length - 1]?.value ?? 0;
  const newBuildShare =
    latestResale + latestNew === 0 ? 0 : (latestNew / (latestResale + latestNew)) * 100;

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
          Hong Kong&apos;s private domestic price and rental indices, rebased to 100 at
          January 1999 — downloaded directly from the{" "}
          <a
            href={RVD_SOURCE.url}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-accent hover:underline"
          >
            {RVD_SOURCE.label}
          </a>
          , not generated. <strong className="text-mist">Pick your flat size.</strong> RVD
          publishes these by Class as well as all together, and the bands have genuinely
          parted company: rents for the smallest flats stand at{" "}
          {latestOf(RVD_RENT_INDEX_BY_CLASS.A, RVD_CLASS_INDEX_PERIODS)} against{" "}
          {latestOf(RVD_RENT_INDEX_BY_CLASS.E, RVD_CLASS_INDEX_PERIODS)} for the largest, and
          the all-classes line sits between them describing neither. If you know which Class
          your flat is, the all-classes line is not the one you want. Still territory-wide —
          RVD publishes no monthly domestic index per district, and the nearest thing to a
          geographic split is the Urban / New Territories series further down.
        </p>
        {/*
          * A letter per pill, not the full label. `RVD_CLASS_LABELS` reads "Class B — 40 to
          * 69.9 m²", and six of those is a wrapped block of text rather than a control. The
          * full label is the accessible name of each button and is printed under the row for
          * whichever band is selected, so the size range is always on screen — "Class B" on
          * its own tells a reader nothing, and that is the half worth keeping visible.
          */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted">
            Flat size
          </span>
          {(["all", "A", "B", "C", "D", "E"] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setBand(key)}
              aria-pressed={band === key}
              aria-label={key === "all" ? "All classes" : RVD_CLASS_LABELS[key]}
              className={
                band === key
                  ? "rounded-full bg-accent px-3 py-1 text-xs font-medium text-white"
                  : "rounded-full border border-line px-3 py-1 text-xs text-muted hover:text-mist"
              }
            >
              {key === "all" ? "All classes" : key}
            </button>
          ))}
        </div>
        <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.06em] text-muted">
          {band === "all"
            ? "All classes — every private domestic flat"
            : RVD_CLASS_LABELS[band]}
        </p>
        <div className="card mt-3 max-w-3xl space-y-6">
          <TerritoryIndexChart label="Price index" points={realPrice} color={viz.demand} />
          <div className="h-px bg-line" />
          <TerritoryIndexChart label="Rent index" points={realRent} color={viz.supply} />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-semibold text-mist">
          Supply and absorption, by flat size — measured
        </h2>
        <p className="mt-1 max-w-prose text-xs leading-relaxed text-muted">
          What physically exists underneath the indices above, at{" "}
          {RVD_SUPPLY_SOURCE.latestStockYear} year end. Vacancy is not evenly spread:{" "}
          <strong className="text-mist">
            the largest flats stand empty at roughly three times the rate of the smallest
          </strong>
          , which the single territory-wide figure of about 4% hides completely. Take-up is
          the year&apos;s absorption and is not derivable from vacancy — vacancy counts flats
          empty at one instant, take-up counts flats taken up across the year, and rising
          vacancy means opposite things depending on which way take-up is moving.
        </p>
        <div className="card mt-4 max-w-3xl overflow-x-auto">
          <table className="w-full text-left text-xs">
            <caption className="sr-only">
              Private domestic stock, vacancy rate and completions by RVD Class
            </caption>
            <thead>
              <tr className="border-b border-line font-mono text-[10px] uppercase tracking-[0.06em] text-muted">
                <th scope="col" className="py-2 pr-4 font-normal">Class</th>
                <th scope="col" className="py-2 pr-4 text-right font-normal">Stock</th>
                <th scope="col" className="py-2 pr-4 text-right font-normal">Vacant</th>
                <th scope="col" className="py-2 text-right font-normal">Completed</th>
              </tr>
            </thead>
            <tbody className="tnum">
              {supplyRows.map((r) => (
                <tr key={r.key} className="border-b border-line/60 last:border-0">
                  <th scope="row" className="py-2 pr-4 font-normal text-mist">{r.label}</th>
                  <td className="py-2 pr-4 text-right text-mist">
                    {r.stock === null ? "—" : Math.round(r.stock).toLocaleString("en-HK")}
                  </td>
                  <td className="py-2 pr-4 text-right text-mist">
                    {r.vacancy === null ? "—" : `${r.vacancy.toFixed(1)}%`}
                  </td>
                  <td className="py-2 text-right text-muted">
                    {r.completions === null ? "—" : Math.round(r.completions).toLocaleString("en-HK")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.06em] text-muted">
            Take-up {takeUp === null ? "—" : Math.round(takeUp).toLocaleString("en-HK")} flats
            absorbed · {RVD_SUPPLY_SOURCE.name}
          </p>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-semibold text-mist">
          Urban against New Territories — measured
        </h2>
        <p className="mt-1 max-w-prose text-xs leading-relaxed text-muted">
          The only price series RVD publishes with any geographic split, from its index of
          selected popular developments, monthly since 1992.{" "}
          <strong className="text-mist">Two regions, not eighteen districts</strong> — a real
          coarse geography rather than an invented fine one, the same reason the rent figures
          on a report are given for three regions and not spread across every district.{" "}
          <strong className="text-mist">
            The two lines almost coincide, and that is the finding:
          </strong>{" "}
          across all sizes the New Territories has tracked urban Hong Kong closely, so
          &ldquo;buy out of town, it moves differently&rdquo; is not supported by this series.
          Where the regions do part company is by flat size within them — large urban flats
          stand at {latestOf(RVD_POPULAR_DEV_PRICE_INDEX.urbanLarge, RVD_POPULAR_DEV_PERIODS)}{" "}
          against {latestOf(RVD_POPULAR_DEV_PRICE_INDEX.ntLarge, RVD_POPULAR_DEV_PERIODS)} in
          the New Territories, a gap the overall lines average away.{" "}
          <a
            href={RVD_CLASS_SERIES_SOURCE.url}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-accent hover:underline"
          >
            {RVD_CLASS_SERIES_SOURCE.name}
          </a>
        </p>
        <div className="card mt-4 max-w-3xl space-y-6">
          <TerritoryIndexChart label={POPULAR_DEV_LABELS.urbanOverall} points={urban} color={viz.demand} />
          <div className="h-px bg-line" />
          <TerritoryIndexChart
            label={POPULAR_DEV_LABELS.ntOverall}
            points={newTerritories}
            color={viz.supply}
          />
        </div>
      </section>

      <div className="mt-10 border-t border-line pt-8">
        <h2 className="text-sm font-semibold text-mist">Transactions — measured</h2>
        <p className="mt-1 max-w-prose text-xs leading-relaxed text-muted">
          Sale-and-purchase agreements per month, from the Land Registry via RVD — new-build and
          resale counted separately, because they behave differently and a developer&apos;s launch
          month can swamp the total. Hong Kong overall. This is the demand side: a price holding
          up on falling volume is a different market from the same price on rising volume.
        </p>
        <div className="mt-3 flex flex-wrap gap-6 font-mono text-xs text-muted">
          <span>
            Latest month <span className="text-mist">{(latestResale + latestNew).toLocaleString("en-HK")}</span> agreements
          </span>
          <span>
            New build <span className="text-mist">{newBuildShare.toFixed(0)}%</span> of them
          </span>
        </div>
      </div>

      <div className="card mt-4 max-w-3xl space-y-6">
        <TerritoryIndexChart label="Resale agreements" points={resale} color={viz.demand} />
        <div className="h-px bg-line" />
        <TerritoryIndexChart label="New-build agreements" points={newBuild} color={viz.supply} />
      </div>

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

/**
 * Turn one of the parallel Class arrays into the `{periodStart, value}` points the charts
 * take, dropping RVD's holes rather than plotting them as zeroes.
 *
 * The arrays are stored parallel to a shared axis rather than as objects because 403 months
 * times five Classes times two series is 4,030 numbers, and objects would quadruple the
 * bundle for data that is only ever read positionally.
 */
function classPoints(
  values: readonly (number | null)[],
  periods: readonly string[] = RVD_CLASS_INDEX_PERIODS,
): { readonly periodStart: string; readonly value: number }[] {
  const out: { periodStart: string; value: number }[] = [];
  for (let i = 0; i < values.length; i += 1) {
    const v = values[i];
    const p = periods[i];
    if (v !== null && v !== undefined && p !== undefined) out.push({ periodStart: p, value: v });
  }
  return out;
}

/**
 * The latest published value of a series, formatted for use inside a sentence.
 *
 * Read from the data rather than typed into the paragraph. This codebase has shipped a
 * hardcoded figure in prose twice — the landing page's engine-test count went stale on the
 * one tile whose whole purpose was being checkable — and a number written into a sentence is
 * one nobody re-checks when the source updates. These update whenever RVD does.
 */
function latestOf(
  series: readonly (number | null)[],
  periods: readonly string[],
): string {
  const latest = latestReported(series, periods);
  return latest === null ? "—" : latest.value.toFixed(1);
}

/** The last year a supply series reported. Walks back past the trailing nulls RVD leaves. */
function latestAnnual(values: readonly (number | null)[]): number | null {
  return latestReported(values, RVD_SUPPLY_YEARS.map(String))?.value ?? null;
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
