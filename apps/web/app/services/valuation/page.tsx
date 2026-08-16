"use client";

import { RVD_PRICE_INDEX, estimateMonthlyRent } from "@veela/fixtures";
import { useMemo, useState } from "react";

import { AppShell } from "../../../components/app-shell";

/**
 * An index-adjusted estimate of what a flat might be worth now — and a page that spends most of
 * its words explaining why that is not a valuation.
 *
 * ## What this can and cannot honestly do
 *
 * A **valuation** is a professional opinion given by a qualified surveyor who has considered the
 * specific property. Veela has not seen the flat, does not know its floor, view, condition or
 * orientation, and — the part that matters most — **RVD publishes no per-district domestic
 * series**. The only price series that exists here is territory-wide.
 *
 * So the honest computation is exactly one thing: *the market index has moved X% since the date
 * you paid, and applying that movement to what you paid gives Y.* That is arithmetic on a
 * published series, it shows its own working, and it is emphatically not a claim about this
 * flat. A property on the Peak and one in Tuen Mun bought the same month share this number,
 * which is precisely why it must not be called a valuation.
 *
 * The page says so three times, and points at the surveyors who can actually do the job.
 */

const fmt = (n: number): string => `HK$${Math.round(n).toLocaleString("en-HK")}`;

function indexAt(iso: string): { periodStart: string; value: number } | null {
  let found: { periodStart: string; value: number } | null = null;
  for (const p of RVD_PRICE_INDEX) {
    if (p.periodStart <= iso) found = p;
    else break;
  }
  return found;
}

export default function ValuationPage(): React.JSX.Element {
  const latest = RVD_PRICE_INDEX[RVD_PRICE_INDEX.length - 1];
  const [paid, setPaid] = useState(8_000_000);
  const [when, setWhen] = useState("2021-06");
  const [area, setArea] = useState(500);

  const result = useMemo(() => {
    const then = indexAt(`${when}-01`);
    if (then === null || latest === undefined || paid <= 0) return null;
    const movePct = ((latest.value - then.value) / then.value) * 100;
    const implied = paid * (latest.value / then.value);
    return { then, movePct, implied };
  }, [paid, when, latest]);

  const rentEstimate = useMemo(
    () => (result === null ? null : estimateMonthlyRent(result.implied, area)),
    [result, area],
  );

  return (
    <AppShell breadcrumb="Services › Home Valuation">
      <header className="max-w-prose">
        <p className="eyebrow">Services · Home valuation</p>
        <h1 className="mt-3 font-display text-[30px] font-extrabold leading-tight tracking-[-0.03em]">
          Where the market has moved since you bought
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">
          This is not a valuation, and cannot be — nobody here has seen the flat, and the
          government publishes no price series finer than territory-wide. What it does is apply
          the Rating and Valuation Department&apos;s published index to the price you actually
          paid, and show every step.
        </p>
      </header>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_1fr] lg:items-start">
        <div className="card">
          <h2 className="text-[15px] font-semibold">What you paid</h2>
          <div className="mt-4 space-y-4">
            <label className="block">
              <span className="text-sm font-medium">Purchase price</span>
              <span className="relative mt-1 block">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm text-muted">
                  HK$
                </span>
                <input
                  type="number"
                  value={paid === 0 ? "" : paid}
                  onChange={(e) => setPaid(Number(e.target.value))}
                  className="w-full rounded-card border border-line bg-surfaceMuted py-2.5 pl-12 pr-3.5 font-mono text-sm outline-none focus:border-accent focus:bg-surface"
                />
              </span>
            </label>

            <label className="block">
              <span className="text-sm font-medium">When you bought</span>
              <input
                type="month"
                value={when}
                min="1993-01"
                max={latest?.periodStart.slice(0, 7)}
                onChange={(e) => setWhen(e.target.value)}
                className="mt-1 w-full rounded-card border border-line bg-surfaceMuted px-3.5 py-2.5 font-mono text-sm outline-none focus:border-accent focus:bg-surface"
              />
              <span className="mt-1 block text-xs text-muted">
                The index runs monthly from 1993 to {latest?.periodStart.slice(0, 7)}.
              </span>
            </label>

            <label className="block">
              <span className="flex items-baseline justify-between">
                <span className="text-sm font-medium">Saleable area</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted">
                  sq ft
                </span>
              </span>
              <input
                type="number"
                value={area === 0 ? "" : area}
                onChange={(e) => setArea(Number(e.target.value))}
                className="mt-1 w-full rounded-card border border-line bg-surfaceMuted px-3.5 py-2.5 font-mono text-sm outline-none focus:border-accent focus:bg-surface"
              />
              <span className="mt-1 block text-xs text-muted">
                Only used to pick the RVD size class for the rent figure below.
              </span>
            </label>
          </div>
        </div>

        <div className="space-y-4">
          {result === null ? (
            <p className="card text-sm text-muted">Enter a price and a date.</p>
          ) : (
            <>
              <div className="card">
                <div className="eyebrow">Index-adjusted, not valued</div>
                <p className="tnum mt-2 font-display text-[34px] font-semibold leading-none tracking-[-0.03em]">
                  {fmt(result.implied)}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  The market {result.movePct >= 0 ? "rose" : "fell"}{" "}
                  <strong className="text-mist">
                    {Math.abs(result.movePct).toFixed(1)}%
                  </strong>{" "}
                  between {when} and {latest?.periodStart.slice(0, 7)}. Applied to {fmt(paid)},
                  that gives the figure above.
                </p>
                {/* The working, on screen, as everywhere else in this product. */}
                <p className="mt-3 border-t border-line pt-2.5 font-mono text-[10px] leading-relaxed text-muted">
                  RVD private domestic price index: {result.then.value} (
                  {result.then.periodStart.slice(0, 7)}) → {latest?.value} (
                  {latest?.periodStart.slice(0, 7)}). Territory-wide, all classes.
                </p>
              </div>

              {rentEstimate !== null && (
                <div className="card">
                  <div className="eyebrow">What it might let for</div>
                  <p className="tnum mt-2 font-display text-[24px] font-semibold tracking-[-0.02em]">
                    {fmt(rentEstimate.monthlyRentHkd)}
                    <span className="ml-1 text-sm font-normal text-muted">/month</span>
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-muted">
                    From RVD&apos;s published market yield for {rentEstimate.classLabel} —{" "}
                    {rentEstimate.grossYieldPct}% as at {rentEstimate.period.slice(0, 7)} — applied
                    to the figure above. A size band, territory-wide, not this building.
                  </p>
                </div>
              )}

              <div className="rounded-panel border border-caution/40 bg-caution/10 px-4 py-3">
                <p className="text-sm font-semibold text-mist">This is not a valuation.</p>
                <p className="mt-1.5 text-xs leading-relaxed text-muted">
                  It assumes your flat tracked the whole Hong Kong market exactly, which no
                  individual property does. Floor, view, condition, block and estate all move
                  prices more than the index does over short periods, and RVD publishes nothing
                  finer than territory-wide. Use it to know roughly which direction you are
                  facing — never as a figure to lend, sell or negotiate against.
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      <section className="card mt-10 max-w-prose">
        <h2 className="text-[15px] font-semibold">When you need a real valuation</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          For a mortgage, a probate, a divorce or a dispute, you need a professional valuation
          from a qualified surveyor who has inspected the property. Banks also run their own
          valuation and will lend against theirs, not yours. The Hong Kong Institute of Surveyors
          maintains the list of members qualified to give one.
        </p>
        <a
          href="https://www.hkis.org.hk/en/"
          target="_blank"
          rel="noreferrer"
          className="btn-secondary mt-4 inline-flex !px-5 !py-2 !text-[13px]"
        >
          Hong Kong Institute of Surveyors
        </a>
      </section>
    </AppShell>
  );
}
