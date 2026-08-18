"use client";

import { projectHold, type Verdict } from "@veela/core";
import {
  DEFAULT_GROWTH_LOOKBACK_YEARS,
  rvdGrowthWindows,
  RVD_SOURCE,
} from "@veela/fixtures";
import { formatCompactMoney, formatPercent } from "@veela/ui";
import { useMemo, useState } from "react";

/**
 * "What if I hold it?" — the fourth of the four outputs this product set out to produce, and the
 * one that had never been built.
 *
 * ## The whole design problem is the growth rate
 *
 * A projection is the easiest place in a property tool to mislead somebody, because one invisible
 * assumption decides the answer. So this component refuses to hide it:
 *
 * - **The window is a control, not a constant.** The reader picks the look-back and watches the
 *   conclusion change. On the RVD series a five-year look-back gives a price CAGR of about −3.9%
 *   and a twenty-year one about +6.5% — the same market, opposite answers — and seeing that
 *   happen is more educational than any caveat.
 * - **The default is the longest available (30 years)**, because it is the one nobody can accuse
 *   of having been chosen to flatter. Not the 20-year figure, which is the most attractive.
 * - **Every rate is derived from the series, never typed in** (`rvdGrowthWindows`), so none of
 *   them can go stale, and each is labelled with the exact months it was measured between.
 *
 * ## What it does not claim
 *
 * No capital gains tax, because Hong Kong has none on investment property. No rate path, no
 * refinancing, no capex — each would be a second invisible assumption stacked on the first. The
 * closing note says so on screen rather than leaving it to be discovered.
 */
export interface HoldFinancing {
  readonly loanAmountMinor: number;
  readonly annualInterestRate: number;
  readonly termYears: number;
}

export function HoldProjectionPanel({
  verdict,
  financing,
}: {
  readonly verdict: Verdict;
  /**
   * Passed in rather than read off the verdict, because `Verdict` does not carry it — financing is
   * an *input* (`PropertyInput`), and the verdict only exposes the first-year interest it produced.
   * The caller holds the draft, so the caller supplies it.
   */
  readonly financing?: HoldFinancing | undefined;
}): React.JSX.Element {
  const windows = useMemo(() => rvdGrowthWindows(), []);
  const [lookback, setLookback] = useState<number>(DEFAULT_GROWTH_LOOKBACK_YEARS);
  const [years, setYears] = useState(10);

  const chosen = windows.find((w) => w.years === lookback) ?? windows[windows.length - 1];

  const projection = useMemo(() => {
    if (chosen === undefined || chosen.priceCagr === null || chosen.rentCagr === null) return null;
    return projectHold(
      {
        currency: verdict.currency,
        priceMinor: verdict.acquisition.price.amount,
        acquisitionTotalMinor: verdict.acquisition.total.amount,
        annualGrossRentMinor: verdict.annual.grossRent.amount,
        annualNetIncomeMinor: verdict.annual.netIncome.amount,
        ...(financing !== undefined && financing.loanAmountMinor > 0 ? { financing } : {}),
      },
      { years, annualPriceGrowth: chosen.priceCagr, annualRentGrowth: chosen.rentCagr },
    );
  }, [verdict, chosen, years, financing]);

  if (projection === null || chosen === undefined) {
    return (
      <section className="card">
        <h3 className="text-[15px] font-semibold">If you hold it</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          The RVD series does not cover a long enough period to derive a growth rate, so no
          projection is shown. It is not estimated.
        </p>
      </section>
    );
  }

  const gain = projection.totalGain.amount;

  return (
    <section className="card">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-[15px] font-semibold">If you hold it</h3>
        <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-muted">
          Projection, not a forecast
        </p>
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-4">
        <label className="text-xs">
          <span className="block text-muted">Hold for</span>
          <select
            value={years}
            onChange={(e) => setYears(Number(e.target.value))}
            className="mt-1 rounded-card border border-line bg-surfaceMuted px-2.5 py-1.5 text-sm text-mist outline-none focus:border-accent focus:bg-surface"
          >
            {[5, 10, 15, 20, 25, 30].map((y) => (
              <option key={y} value={y}>
                {y} years
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs">
          <span className="block text-muted">Growth measured over the past</span>
          <select
            value={lookback}
            onChange={(e) => setLookback(Number(e.target.value))}
            className="mt-1 rounded-card border border-line bg-surfaceMuted px-2.5 py-1.5 text-sm text-mist outline-none focus:border-accent focus:bg-surface"
          >
            {windows.map((w) => (
              <option key={w.years} value={w.years}>
                {w.years} years — prices {w.priceCagr === null ? "n/a" : fmtPct(w.priceCagr)}/yr,
                rents {w.rentCagr === null ? "n/a" : fmtPct(w.rentCagr)}/yr
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* The point of the whole component, said in one line: the answer is a function of the
          window, and the reader is choosing it. */}
      <p className="mt-2 text-xs leading-relaxed text-muted">
        Prices <strong className="text-mist">{fmtPct(chosen.priceCagr ?? 0)} a year</strong> and
        rents <strong className="text-mist">{fmtPct(chosen.rentCagr ?? 0)} a year</strong>, measured
        from {monthLabel(chosen.from)} to {monthLabel(chosen.to)}. Change the look-back and the
        answer changes — over five years Hong Kong prices fell, over twenty they compounded at
        6.5%. Both are this market.
      </p>

      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label={`Equity after ${projection.assumptions.years}y`} value={formatCompactMoney(projection.finalEquity)} />
        <Stat label="Price change" value={formatCompactMoney(projection.capitalGain)} />
        <Stat label="Cumulative cash flow" value={formatCompactMoney(projection.cumulativeCashFlow)} />
        <Stat
          label="Total gain on cash in"
          value={formatCompactMoney(projection.totalGain)}
          tone={gain < 0 ? "negative" : "positive"}
        />
      </dl>

      <p className="mt-3 text-sm leading-relaxed text-muted">
        {projection.annualisedReturn === null ? (
          <>No cash was put in on these figures, so an annualised return cannot be computed.</>
        ) : (
          <>
            That is{" "}
            <strong className="text-mist">
              {formatPercent(projection.annualisedReturn)} a year
            </strong>{" "}
            on the cash you put in, ignoring the time value of money.
          </>
        )}{" "}
        {projection.cashFlowBreakEvenYear === null ? (
          <>
            <strong className="text-mist">Cash flow never turns positive</strong> inside{" "}
            {projection.assumptions.years} years — the rent does not cover the mortgage.
          </>
        ) : (
          <>
            Cash flow is cumulatively positive from{" "}
            <strong className="text-mist">year {projection.cashFlowBreakEvenYear}</strong>.
          </>
        )}
      </p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[34rem] text-sm">
          <thead>
            <tr className="border-y border-line bg-surfaceMuted text-left text-xs text-muted">
              <th scope="col" className="px-3 py-2 font-medium">Year</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Rent</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Cash flow</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Cumulative</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Value</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Owed</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Equity</th>
            </tr>
          </thead>
          <tbody>
            {projection.years.map((y) => (
              <tr key={y.year} className="border-b border-line/60">
                <th scope="row" className="px-3 py-2 text-left font-normal text-mist">{y.year}</th>
                <td className="tnum px-3 py-2 text-right text-muted">{formatCompactMoney(y.grossRent)}</td>
                <td
                  className="tnum px-3 py-2 text-right"
                  style={{ color: y.cashFlow.amount < 0 ? "var(--negative, #B4232A)" : undefined }}
                >
                  {formatCompactMoney(y.cashFlow)}
                </td>
                <td className="tnum px-3 py-2 text-right text-muted">{formatCompactMoney(y.cumulativeCashFlow)}</td>
                <td className="tnum px-3 py-2 text-right text-mist">{formatCompactMoney(y.propertyValue)}</td>
                <td className="tnum px-3 py-2 text-right text-muted">{formatCompactMoney(y.loanBalance)}</td>
                <td className="tnum px-3 py-2 text-right font-medium text-mist">{formatCompactMoney(y.equity)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Said here rather than left to be discovered. Each of these would be a second invisible
          assumption stacked on the growth rate. */}
      <p className="mt-3 text-xs leading-relaxed text-muted">
        Growth rates are the compound annual change in the {RVD_SOURCE.label}&apos;s own price and
        rental indices over the window you chose — not a forecast, and past growth is not a
        prediction. Hong Kong charges <strong className="text-mist">no capital gains tax</strong> on
        investment property, so the price change above is not taxed here. Not modelled: interest
        rate changes, refinancing, refurbishment, or a rent that moves differently from the market.
        Year one is deliberately identical to the report above.
      </p>
    </section>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  readonly label: string;
  readonly value: string;
  readonly tone?: "positive" | "negative";
}): React.JSX.Element {
  return (
    <div className="rounded-card bg-surfaceMuted px-3 py-2.5">
      <dt className="text-[11px] leading-tight text-muted">{label}</dt>
      <dd
        className={`tnum mt-1 font-display text-[17px] font-semibold tracking-[-0.02em] ${
          tone === "negative" ? "text-negative" : tone === "positive" ? "text-positive" : "text-mist"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

/** One decimal, and a sign on negatives — the five-year price figure is negative and must read
 *  as such rather than as a small positive. */
function fmtPct(v: number): string {
  return `${v < 0 ? "−" : "+"}${Math.abs(v * 100).toFixed(1)}%`;
}

function monthLabel(iso: string): string {
  if (iso === "") return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}
