"use client";

import {
  DEFAULT_GROWTH_LOOKBACK_YEARS,
  RVD_CLASS_LABELS,
  RVD_PRICE_INDEX,
  RVD_RENT_INDEX,
  RVD_SOURCE,
  RVD_YIELDS_BY_CLASS,
  RVD_YIELD_PERIODS,
  rvdGrowthWindows,
} from "@veela/fixtures";
import { useEffect, useState } from "react";

/**
 * A market overview for one Hong Kong district, built from the reference product's own structure
 * and only the figures this market actually publishes.
 *
 * ## What the reference shows, and what happens to each row here
 *
 * The Mashvisor panel this follows lists: median sale price, homes sold, median days on market,
 * sale-to-list ratio, share of listings with price drops, active and new listings, months of
 * supply, homes for sale, cap rate, population, an optimal strategy, school/walk/bike/transit
 * scores, a regulatory ranking, and a composite letter grade.
 *
 * **Most of those cannot be built here, and the reason is the same one that shapes the whole
 * product.** Everything about *listings* — days on market, sale-to-list, price drops, active and
 * new counts, homes for sale — needs a listings feed. Hong Kong has no bulk one: the Land Registry
 * sells transactions one at a time at HK$10 with no bulk option, and Centaline's own transaction
 * file sits outside its open-data licence. Median sale price and homes sold *by district* are
 * published only inside annual PDF tables, not as a series.
 *
 * So this panel carries what is real and **names what is missing**, rather than filling the same
 * grid with plausible-looking numbers. The absent list is on screen, not in this comment.
 *
 * ## Two rows are not merely absent — they are inverted
 *
 * The reference reports an *optimal strategy* of "Short-term" and a regulatory ranking of
 * "Friendly: short-term rentals require a license and have reasonable rules". In Hong Kong letting
 * under 28 consecutive days without a guesthouse licence is a **criminal offence** carrying up to
 * HK$500,000 and three years (Cap. 349). A tool that shipped the reference's answer here would be
 * recommending a crime. Both rows appear, with the opposite verdict.
 *
 * ## No composite score
 *
 * No "Mashmeter". Compressing five metrics into one letter grade invents a weighting and presents
 * it with more authority than any of its inputs — the standing decision in this project, and it
 * does not change now that the inputs are real rather than synthetic. The per-metric figures below
 * say everything a grade would, and can be argued with.
 */

interface Observation {
  readonly metric: string;
  readonly value: number;
  readonly periodStart: string;
  readonly periodMonths: number;
  readonly source: string;
}

/** How each real metric is labelled and formatted. Anything not listed is not displayed. */
const SHOWN: Record<string, { readonly label: string; readonly format: (v: number) => string }> = {
  population: { label: "Population", format: (v) => Math.round(v).toLocaleString("en-HK") },
  households: { label: "Households", format: (v) => Math.round(v).toLocaleString("en-HK") },
  stock_units: {
    label: "Private domestic stock",
    format: (v) => `${Math.round(v).toLocaleString("en-HK")} units`,
  },
  completions_units: {
    label: "Completions",
    format: (v) => `${Math.round(v).toLocaleString("en-HK")} units`,
  },
  vacancy_rate: { label: "Vacancy rate", format: (v) => `${v.toFixed(1)}%` },
  /* Census 2021, written to the database on 02/09/2026 and until then held in a fixture no
     screen read. `median_rent` is a *household* rent across all tenures, not a market asking
     rent — which is why the public-rental share sits beside it rather than in a footnote. */
  median_rent: {
    label: "Median household rent",
    format: (v) => `HK$${Math.round(v).toLocaleString("en-HK")}/mo`,
  },
  rent_to_income: {
    label: "Rent as share of income",
    format: (v) => `${(v * 100).toFixed(1)}%`,
  },
  public_rental_share: {
    label: "Households in public rental",
    format: (v) => `${(v * 100).toFixed(1)}%`,
  },
};

/** Named on screen, with the reason. Each of these is a row the reference fills and we cannot. */
const NOT_PUBLISHED: readonly { readonly label: string; readonly why: string }[] = [
  { label: "Median sale price, by district", why: "RVD publishes district figures only inside annual PDF tables, not as a series. The territory-wide index below is real." },
  { label: "Homes sold, by district", why: "Same — the monthly transaction series is territory-wide only." },
  { label: "Median days on market", why: "Not published in Hong Kong by anyone. It needs a listings feed." },
  { label: "Sale-to-list price ratio", why: "Needs asking prices, which means a listings feed." },
  { label: "Listings with price drops", why: "Needs listing history. No bulk source exists here." },
  { label: "Active and new listings, homes for sale", why: "No bulk Hong Kong listings feed exists. The Land Registry sells transactions one at a time at HK$10." },
  { label: "Months of supply", why: "Derived from listings and sales pace, so it inherits both gaps above." },
];

export function DistrictOverview({
  districtId,
  districtName,
}: {
  readonly districtId: string;
  readonly districtName: string;
}): React.JSX.Element {
  const [observations, setObservations] = useState<readonly Observation[] | null>(null);
  const [sources, setSources] = useState<readonly string[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setObservations(null);
    setFailed(false);
    void (async () => {
      try {
        const res = await fetch(`/api/market/district/${districtId}`);
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as { observations: Observation[]; sources: string[] };
        if (cancelled) return;
        setObservations(body.observations);
        setSources(body.sources);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [districtId]);

  const shown = (observations ?? []).filter((o) => o.metric in SHOWN);
  const forecast = (observations ?? [])
    .filter((o) => o.metric === "forecast_completions_units")
    .sort((a, b) => a.periodStart.localeCompare(b.periodStart));

  /* Territory-wide context, straight from the ingested RVD series — real, monthly, and the same
     numbers every report is priced against. Not district-level, and labelled as such. */
  const price = RVD_PRICE_INDEX[RVD_PRICE_INDEX.length - 1];
  const rent = RVD_RENT_INDEX[RVD_RENT_INDEX.length - 1];
  const yieldPeriod = RVD_YIELD_PERIODS[RVD_YIELD_PERIODS.length - 1];
  const window = rvdGrowthWindows().find((w) => w.years === DEFAULT_GROWTH_LOOKBACK_YEARS);

  return (
    <section className="space-y-5">
      <div className="card">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-[17px] font-semibold">{districtName} — market overview</h2>
          <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-muted">
            Official figures only
          </p>
        </div>

        {observations === null && !failed && (
          <p className="mt-3 text-sm text-muted">Loading the district&apos;s figures…</p>
        )}
        {failed && (
          <p className="mt-3 text-sm text-negative">
            Could not load this district&apos;s figures. Nothing is estimated in their place.
          </p>
        )}

        {shown.length > 0 && (
          <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {Object.keys(SHOWN).map((metric) => {
              const o = shown.find((x) => x.metric === metric);
              if (o === undefined) return null;
              const spec = SHOWN[metric];
              if (spec === undefined) return null;
              return (
                <div key={metric} className="rounded-card bg-surfaceMuted px-3 py-2.5">
                  <dt className="text-[11px] leading-tight text-muted">{spec.label}</dt>
                  <dd className="tnum mt-1 font-display text-[17px] font-semibold tracking-[-0.02em] text-mist">
                    {spec.format(o.value)}
                  </dd>
                  {/* The period is part of the figure. A population without a census year is a
                      number pretending to be current. */}
                  <dd className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.06em] text-muted">
                    {o.periodStart.slice(0, 4)}
                  </dd>
                </div>
              );
            })}
          </dl>
        )}

        {/*
          * Supply ahead, given its own block rather than a tile, because it is the one figure
          * here with two periods and the pair is the point: a district taking 900 flats next
          * year and 600 the year after is loosening, and either number alone does not say so.
          * It is also the only forward-looking figure in this panel — everything above is a
          * measurement of something that already happened.
          */}
        {forecast.length > 0 && (
          <div className="mt-4 rounded-card border border-line bg-surfaceMuted px-4 py-3">
            <p className="text-[11px] leading-tight text-muted">
              New private homes expected — the only forward-looking figure published per district
            </p>
            <div className="mt-2 flex flex-wrap items-baseline gap-x-6 gap-y-1">
              {forecast.map((o) => (
                <span key={o.periodStart} className="tnum">
                  <span className="font-display text-[17px] font-semibold tracking-[-0.02em] text-mist">
                    {Math.round(o.value).toLocaleString("en-HK")}
                  </span>
                  <span className="ml-1.5 font-mono text-[10px] uppercase tracking-[0.06em] text-muted">
                    in {o.periodStart.slice(0, 4)}
                  </span>
                </span>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
              A forecast from the Rating and Valuation Department, not a commitment — projects
              slip. Read it against the stock above: the same number of new flats means something
              different in a district of 20,000 than in one of 200,000.
            </p>
          </div>
        )}

        {observations !== null && shown.length === 0 && !failed && (
          <p className="mt-3 text-sm text-muted">
            No official figures are held for this district yet.
          </p>
        )}

        {sources.length > 0 && (
          <p className="mt-3 text-xs leading-relaxed text-muted">
            {sources.join(" · ")}
          </p>
        )}
      </div>

      {/* Territory-wide, and said so twice — in the heading and in the note. Presenting a
          territory figure under a district heading is exactly the precision this product refuses
          to imply. */}
      <div className="card">
        <h3 className="text-[15px] font-semibold">Hong Kong, territory-wide</h3>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          These are not district figures. RVD publishes the monthly price and rent series, and its
          market yields, for the whole territory only — so a flat on the Peak and one in Tuen Mun
          share them.
        </p>

        <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {price !== undefined && (
            <Stat label="Price index" value={price.value.toFixed(1)} note={monthLabel(price.periodStart)} />
          )}
          {rent !== undefined && (
            <Stat label="Rent index" value={rent.value.toFixed(1)} note={monthLabel(rent.periodStart)} />
          )}
          {window !== undefined && window.priceCagr !== null && (
            <Stat
              label={`Price growth, ${window.years}y`}
              value={pct(window.priceCagr)}
              note="compound annual"
            />
          )}
          {window !== undefined && window.rentCagr !== null && (
            <Stat
              label={`Rent growth, ${window.years}y`}
              value={pct(window.rentCagr)}
              note="compound annual"
            />
          )}
        </dl>

        <h4 className="mt-5 text-[13px] font-semibold text-mist">
          Market yield by flat size {yieldPeriod !== undefined && `· ${monthLabel(yieldPeriod)}`}
        </h4>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          The closest honest equivalent of a &ldquo;cap rate&rdquo; here — RVD&apos;s own published
          yields, gross, by Class. Net of the 12% effective property tax, fees, rates and vacancy,
          a buyer keeps materially less.
        </p>
        <dl className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {(Object.keys(RVD_YIELDS_BY_CLASS) as (keyof typeof RVD_YIELDS_BY_CLASS)[]).map((cls) => {
            const series = RVD_YIELDS_BY_CLASS[cls];
            const latest = [...series].reverse().find((v) => v !== null);
            return (
              <div key={cls} className="rounded-card bg-surfaceMuted px-3 py-2">
                <dt className="text-[11px] leading-tight text-muted">{RVD_CLASS_LABELS[cls]}</dt>
                <dd className="tnum mt-1 text-[15px] font-semibold text-mist">
                  {latest === null || latest === undefined ? "—" : `${latest.toFixed(1)}%`}
                </dd>
              </div>
            );
          })}
        </dl>
        <p className="mt-3 text-xs text-muted">{RVD_SOURCE.label}</p>
      </div>

      {/* The two rows the reference gets right for its market and wrong for this one. */}
      <div className="card border-negative/30">
        <h3 className="text-[15px] font-semibold">Letting rules, and the strategy they allow</h3>
        <dl className="mt-3 space-y-3">
          <div>
            <dt className="text-[13px] font-semibold text-mist">Viable strategy</dt>
            <dd className="mt-1 text-sm leading-relaxed text-muted">
              <strong className="text-mist">Long-term letting only.</strong> Not a preference — the
              alternative is unlawful without a licence, so there is no short-term figure to compute
              and none is shown anywhere in this product.
            </dd>
          </div>
          <div>
            <dt className="text-[13px] font-semibold text-mist">Regulatory position</dt>
            <dd className="mt-1 text-sm leading-relaxed text-muted">
              <strong className="text-negative">Restrictive on short lets.</strong> Letting a Hong
              Kong flat for under 28 consecutive days without a guesthouse licence is a criminal
              offence under the Hotel and Guesthouse Accommodation Ordinance (Cap. 349), carrying up
              to HK$500,000 and three years&apos; imprisonment. Tools written for markets where a
              short-let licence is a formality will happily model that income; here it is the one
              number that must never appear.
            </dd>
          </div>
        </dl>
      </div>

      {/* Named, with reasons. The alternative is a reader hunting for a metric that was never
          buildable, or worse, one of us inventing it. */}
      <div className="card">
        <h3 className="text-[15px] font-semibold">Not shown, and why</h3>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          Every one of these appears on comparable American tools. None is published for Hong Kong
          at district level, so none is estimated here.
        </p>
        <dl className="mt-3 divide-y divide-line">
          {NOT_PUBLISHED.map(({ label, why }) => (
            <div key={label} className="py-2.5">
              <dt className="text-[13px] font-medium text-mist">{label}</dt>
              <dd className="mt-0.5 text-xs leading-relaxed text-muted">{why}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-xs leading-relaxed text-muted">
          There is also no single letter grade for this district. Compressing these metrics into one
          score would invent a weighting and give it more authority than any figure behind it — the
          per-metric numbers above say the same thing and can be argued with.
        </p>
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  note,
}: {
  readonly label: string;
  readonly value: string;
  readonly note?: string;
}): React.JSX.Element {
  return (
    <div className="rounded-card bg-surfaceMuted px-3 py-2.5">
      <dt className="text-[11px] leading-tight text-muted">{label}</dt>
      <dd className="tnum mt-1 font-display text-[17px] font-semibold tracking-[-0.02em] text-mist">
        {value}
      </dd>
      {note !== undefined && (
        <dd className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.06em] text-muted">
          {note}
        </dd>
      )}
    </div>
  );
}

function pct(v: number): string {
  return `${v < 0 ? "−" : "+"}${Math.abs(v * 100).toFixed(1)}%`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * `2026-06-01` → `Jun 2026`, without `Date` and without a locale.
 *
 * The first version used `toLocaleDateString`, and that **broke hydration**: this label is rendered
 * from data available at first paint, so Next renders it on the server and React re-renders it in
 * the browser — a server in UTC with a different default locale produces a different string from a
 * browser in Hong Kong, and React reports the whole tree as mismatched. Caught by running the page
 * with the console captured.
 *
 * Slicing the ISO string cannot disagree with itself. It is also the same class of bug the analyse
 * form already avoids by filling today's date in a mount effect rather than at module scope.
 */
function monthLabel(iso: string): string {
  const month = MONTHS[Number(iso.slice(5, 7)) - 1];
  return month === undefined ? iso : `${month} ${iso.slice(0, 4)}`;
}
