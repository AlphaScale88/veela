"use client";

import { HK_HOLDING_DEFAULT, toMajor, yieldRange, type PropertyInput } from "@veela/core";
import { useMemo, useState } from "react";

/**
 * The true cost of holding, and the yield range that falls out of it.
 *
 * ## Why a range, and not one number
 *
 * The report above charges what the reader typed. That is right for a report about their
 * figures, and it flatters anyone who left a box empty: a backtest measured a blank management
 * fee alone moving the net yield from 2.80% to 2.30% on RVD's average Class B flat.
 *
 * This charges what an owner pays whether or not they thought about it — government rent,
 * stamp duty on the tenancy, the letting agent, repairs, the building's next major works —
 * and shows the same flat under optimistic, central and pessimistic assumptions. On that same
 * measured flat the answer is 3.60% gross, 2.27% at best, 1.63% in the middle and 0.13% on a
 * bad run: the product's whole argument in one row.
 *
 * ## The honesty conditions
 *
 * **The range is an assumption band, not a confidence interval**, and the panel says so where
 * the numbers are rather than in a footnote. "Worst" is every convention landing badly at
 * once — unlikely, and the point: it answers *can this survive a bad run*, not *what will
 * happen*.
 *
 * **Statutory and assumed lines are marked differently**, because a reader can check the first
 * against the government and can only argue with the second. That distinction is carried in
 * the engine as `sourced`, not decided here.
 */
export function YieldRangePanel({
  input,
}: {
  readonly input: PropertyInput;
}): React.JSX.Element | null {
  const [scenario, setScenario] = useState<"best" | "base" | "worst">("base");
  const range = useMemo(() => {
    try {
      return yieldRange(input);
    } catch {
      // A transaction date outside the covered rule sets already fails loudly upstream; this
      // panel is an addition to a report and must never be the thing that breaks it.
      return null;
    }
  }, [input]);

  if (range === null || input.monthlyRent.amount <= 0 || input.price.amount <= 0) return null;

  const shown = range[scenario];
  const fmt = (v: number): string => `HK$${Math.round(v).toLocaleString("en-HK")}`;
  const pct = (v: number | null): string => (v === null ? "—" : `${(v * 100).toFixed(2)}%`);

  const SCENARIOS = [
    { id: "best", label: "Best case", hint: "every assumption lands well" },
    { id: "base", label: "Realistic", hint: "the middle of each band" },
    { id: "worst", label: "Bad run", hint: "every assumption lands badly at once" },
  ] as const;

  return (
    <div>
      <h3 className="font-display text-[20px] font-semibold tracking-[-0.02em]">
        What it really yields, once everything is counted
      </h3>
      <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-muted">
        The report above charges what you entered. This charges what a Hong Kong owner pays
        whether or not they thought about it — Government rent, stamp duty on the tenancy, the
        letting agent, repairs, and the building&apos;s next round of major works.
      </p>

      {/* The three figures together, before any breakdown: the spread is the finding. */}
      <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-panel border border-line bg-line shadow-card sm:grid-cols-4">
        <Cell label="Gross yield" value={pct(range.grossYield)} note="what an agent quotes" />
        <Cell label="Best case" value={pct(range.best.netYield)} note="net, on cash to acquire" />
        <Cell
          label="Realistic"
          value={pct(range.base.netYield)}
          note="net, on cash to acquire"
          emphasis
        />
        <Cell label="Bad run" value={pct(range.worst.netYield)} note="net, on cash to acquire" />
      </div>

      <p className="mt-3 max-w-prose text-xs leading-relaxed text-muted">
        <strong className="text-mist">This is a band of assumptions, not a probability.</strong>{" "}
        &ldquo;Bad run&rdquo; means every assumption below lands badly in the same year, which is
        unlikely — and is the point. It answers whether the deal survives a bad run, not what
        will happen. Yields are net income over{" "}
        <strong className="text-mist">cash to acquire</strong> — price plus stamp duty and fees —
        so they are not on the same denominator as the gross figure beside them.
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        {SCENARIOS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setScenario(s.id)}
            aria-pressed={scenario === s.id}
            className={
              scenario === s.id
                ? "rounded-full bg-accent px-3 py-1 text-xs font-medium text-white"
                : "rounded-full border border-line px-3 py-1 text-xs text-muted hover:text-mist"
            }
          >
            {s.label}
          </button>
        ))}
        <span className="self-center text-xs text-muted">
          {SCENARIOS.find((s) => s.id === scenario)?.hint}
        </span>
      </div>

      <div className="card mt-3 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">
            Annual costs of holding this property under the {scenario} scenario
          </caption>
          <thead>
            <tr className="border-b border-line font-mono text-[10px] uppercase tracking-[0.06em] text-muted">
              <th scope="col" className="py-2 pr-4 font-normal">Cost</th>
              <th scope="col" className="py-2 pr-4 text-right font-normal">A year</th>
              <th scope="col" className="py-2 font-normal">Where it comes from</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-line/60">
              <th scope="row" className="py-2 pr-4 font-medium text-mist">Rent collected</th>
              <td className="tnum py-2 pr-4 text-right text-mist">
                {fmt(toMajor(shown.rentCollected))}
              </td>
              <td className="py-2 text-xs text-muted">after empty periods and arrears</td>
            </tr>
            {shown.costs.map((l) => (
              <tr key={l.id} className="border-b border-line/60">
                <th scope="row" className="py-2 pr-4 font-normal">
                  <span className="text-mist">{l.label}</span>
                  {/* Two kinds of number, told apart on screen as they are in the engine: one
                      can be checked against the government, the other can only be argued with. */}
                  <span
                    className={`ml-2 rounded-full px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.06em] ${
                      l.sourced ? "bg-accent/10 text-accent" : "bg-caution/15 text-muted"
                    }`}
                  >
                    {l.sourced ? "published" : "assumed"}
                  </span>
                </th>
                <td className="tnum py-2 pr-4 text-right text-muted">
                  −{fmt(toMajor(l.amount))}
                </td>
                <td className="py-2 text-xs leading-snug text-muted">{l.basis}</td>
              </tr>
            ))}
            <tr>
              <th scope="row" className="py-2 pr-4 font-semibold text-mist">Left over</th>
              <td className="tnum py-2 pr-4 text-right font-semibold text-mist">
                {fmt(toMajor(shown.netIncome))}
              </td>
              <td className="py-2 text-xs text-muted">
                {pct(shown.netYield)} on cash to acquire · {pct(shown.netYieldOnPrice)} on price
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {range.unverified && (
        /* Keyed off the engine's flag, exactly as the mortgage page's caveat is keyed off
           `HK_LENDING_DEFAULT.unverified` — so nobody can clear the flag without also having
           to decide, deliberately, to delete this paragraph. */
        <p className="mt-3 max-w-prose border-l-2 border-caution pl-4 text-xs leading-relaxed text-muted">
          <strong className="text-mist">The assumed lines are market conventions, not
          measurements.</strong>{" "}
          Nobody publishes what a Hong Kong letting agent charges, what repairs cost, or what a
          building&apos;s next major works will come to. The published lines — rates, Government
          rent, the tenancy&apos;s stamp duty and property tax — carry a government rate you can
          check. Enter your own figures in the form above and they replace the assumptions
          wherever you do.
        </p>
      )}
    </div>
  );
}

function Cell({
  label,
  value,
  note,
  emphasis = false,
}: {
  readonly label: string;
  readonly value: string;
  readonly note: string;
  readonly emphasis?: boolean;
}): React.JSX.Element {
  return (
    <div className={`px-4 py-3 ${emphasis ? "bg-accent/[0.05]" : "bg-surface"}`}>
      <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-muted">{label}</p>
      <p
        className={`tnum mt-1 font-display font-semibold tracking-[-0.02em] ${
          emphasis ? "text-[22px] text-accent" : "text-[19px] text-mist"
        }`}
      >
        {value}
      </p>
      <p className="mt-0.5 text-[11px] leading-tight text-muted">{note}</p>
    </div>
  );
}

/** Re-exported so a caller can show what the defaults assume without importing the engine. */
export { HK_HOLDING_DEFAULT };
