"use client";

import type { Verdict as CoreVerdict } from "@veela/core";
import type { Property } from "@veela/db";
import { formatCompactMoney, formatPercent, gradeNetYield, standingColor } from "@veela/ui";

/**
 * Portfolio totals, above the cards.
 *
 * **Why this is the highest-use thing that was missing.** Every landlord tool in the price bracket
 * Veela sits in — Stessa, Landlord Studio, Lendlord — opens on exactly this: total value, total
 * rent, a blended yield, how much is owed. `/portfolio` listed properties one card at a time and
 * never once said what the portfolio as a whole was worth or earned, which is the first question
 * anyone with more than two flats asks.
 *
 * ## The blended yield is weighted, and that is the whole point
 *
 * A mean of each property's yield would be wrong in a way that flatters small flats: a HK$3M studio
 * yielding 4% and a HK$30M house yielding 2% average to 3%, when the portfolio actually earns close
 * to 2.2%. So this sums income and sums value and divides once — the same figure a bank would
 * compute. Averaging percentages is the classic way to overstate a portfolio return and it is
 * avoided deliberately.
 *
 * ## What it refuses to do
 *
 * **It does not recompute anything.** Every figure is summed from the stored snapshots the cards
 * already show, so the totals cannot disagree with the rows beneath them. A property with no
 * snapshot contributes its price and rent but is excluded from the yield, and the count of those is
 * shown — because a blended yield computed over four of seven properties, silently, is a wrong
 * number presented as a right one.
 */

export interface SummaryRow {
  readonly property: Property;
  readonly verdict: { readonly payload: CoreVerdict } | null;
}

export function PortfolioSummary({ rows }: { readonly rows: readonly SummaryRow[] }): React.JSX.Element | null {
  if (rows.length === 0) return null;

  const currency = rows[0]?.property.currency ?? "HKD";

  let totalValue = 0;
  let totalRentMonthly = 0;
  let totalNetIncome = 0;
  let valueWithSnapshot = 0;
  let withoutSnapshot = 0;
  let tracked = 0;

  for (const { property, verdict } of rows) {
    totalValue += property.priceMinor;
    totalRentMonthly += property.monthlyRentMinor;
    if (property.monitored) tracked += 1;

    if (verdict === null) {
      withoutSnapshot += 1;
      continue;
    }
    totalNetIncome += verdict.payload.annual.netIncome.amount;
    valueWithSnapshot += property.priceMinor;
  }

  /* Summed, then divided once — never a mean of percentages. See the file comment. */
  const blendedNetYield = valueWithSnapshot > 0 ? totalNetIncome / valueWithSnapshot : null;
  const standing = gradeNetYield(blendedNetYield);

  return (
    <section className="card">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[15px] font-semibold">
          {rows.length} propert{rows.length === 1 ? "y" : "ies"}
        </h2>
        <p className="text-xs text-muted">
          {tracked} tracked for alerts
          {withoutSnapshot > 0 && ` · ${withoutSnapshot} without a saved report`}
        </p>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Combined price paid" value={formatCompactMoney({ amount: totalValue, currency })} />
        <Stat
          label="Rent, per month"
          value={formatCompactMoney({ amount: totalRentMonthly, currency })}
        />
        <Stat
          label="Net income, per year"
          value={
            valueWithSnapshot > 0
              ? formatCompactMoney({ amount: totalNetIncome, currency })
              : "—"
          }
        />
        <Stat
          label="Blended net yield"
          value={formatPercent(blendedNetYield)}
          color={blendedNetYield === null ? undefined : standingColor[standing]}
        />
      </dl>

      {/* Named rather than hidden: a blended yield over some of the portfolio is not a blended
          yield over the portfolio, and the difference matters to whoever reads it. */}
      {withoutSnapshot > 0 && (
        <p className="mt-2.5 text-xs leading-relaxed text-muted">
          The yield and net income above cover only the{" "}
          {rows.length - withoutSnapshot} propert
          {rows.length - withoutSnapshot === 1 ? "y" : "ies"} with a saved report. Price and rent
          cover all {rows.length}.
        </p>
      )}

      <p className="mt-2.5 text-xs leading-relaxed text-muted">
        Totals are summed from each property&apos;s stored report, not recomputed — so they cannot
        disagree with the cards below. The blended yield divides total net income by total price
        rather than averaging each property&apos;s percentage, which would overstate the portfolio
        whenever the cheaper flats yield more.
      </p>
    </section>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  readonly label: string;
  readonly value: string;
  readonly color?: string | undefined;
}): React.JSX.Element {
  return (
    <div className="rounded-card bg-surfaceMuted px-3 py-2.5">
      <dt className="text-[11px] leading-tight text-muted">{label}</dt>
      <dd
        className="tnum mt-1 font-display text-[18px] font-semibold tracking-[-0.02em] text-mist"
        style={color === undefined ? undefined : { color }}
      >
        {value}
      </dd>
    </div>
  );
}
