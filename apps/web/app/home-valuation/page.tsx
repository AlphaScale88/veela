"use client";

import { RVD_PRICE_INDEX, estimateMonthlyRent } from "@veela/fixtures";
import { useMemo, useState } from "react";

import { CalculatorIcon, ScaleIcon, TrendIcon } from "../../components/service-icons";
import { BenefitCards, ClosingNote, FactBar, Faq, ServiceHero } from "../../components/service-page";

const BENEFITS = [
  {
    title: "Published data, not a guess",
    caption: "The Rating and Valuation Department's own monthly index, running back to 1993.",
    icon: TrendIcon,
  },
  {
    title: "Shows its working",
    caption: "Both index values, both dates, and the arithmetic between them — on screen.",
    icon: CalculatorIcon,
  },
  {
    title: "Says what it isn't",
    caption: "Territory-wide, so it cannot know your floor, view or block. Not a valuation.",
    icon: ScaleIcon,
  },
] as const;

const FAQ = [
  {
    q: "Why won't you just tell me what my flat is worth?",
    a: "Because we cannot honestly. A valuation is a professional opinion from a surveyor who has inspected the property, and the finest price series the government publishes for private domestic property is territory-wide — there is no per-district domestic index. A number presented as your flat's value would be a territory-wide figure wearing a specific address, which is exactly the false precision this product refuses elsewhere.",
  },
  {
    q: "So what is this number?",
    a: "One piece of arithmetic: the market index moved X% between the month you bought and the latest published month, and that movement applied to the price you actually paid gives the figure shown. Nothing about your particular flat enters it.",
  },
  {
    q: "How wrong could it be?",
    a: "For an individual property, easily by a wide margin over short periods. Floor, view, condition, block and estate all move prices more than the territory-wide index does. Use it to know roughly which direction you are facing, never as a figure to lend, sell or negotiate against.",
  },
  {
    q: "When do I need a real valuation?",
    a: "A mortgage, probate, a divorce or any dispute. Banks also run their own valuation and will lend against theirs, not yours or ours. The Hong Kong Institute of Surveyors maintains the list of members qualified to give one.",
  },
  {
    q: "Where does the rent figure come from?",
    a: "RVD publishes market yields by size class — the same source the rent estimate on the analysis form uses. It is applied to the index-adjusted price above, so it inherits every limitation of that figure and adds the size band's own.",
  },
] as const;

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
    <div className="col py-12 sm:py-16">
      <ServiceHero
        eyebrow="Services · Home valuation"
        icon={TrendIcon}
        title="Where the market has moved since you bought"
        subtitle="Not a valuation, and it cannot be — nobody here has seen the flat, and the government publishes no price series finer than territory-wide. What it does is apply the RVD's published index to the price you actually paid, and show every step."
      />

      <BenefitCards items={BENEFITS} />

      <FactBar
        facts={[
          "RVD price index, monthly since 1993",
          "Every figure traceable to its source month",
          "Free — no valuation fee, because this is not one",
        ]}
      />

      <div className="mx-auto mt-12 grid max-w-4xl gap-8 lg:grid-cols-[1fr_1fr] lg:items-start">
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

      <Faq items={FAQ} />

      <section className="mx-auto mt-12 max-w-2xl text-center">
        <a
          href="https://www.hkis.org.hk/en/"
          target="_blank"
          rel="noreferrer"
          className="btn-secondary inline-flex !px-6 !py-2.5 !text-[14px]"
        >
          Find a surveyor — Hong Kong Institute of Surveyors
        </a>
      </section>

      <ClosingNote
        title="A number you can act on"
        body="If you are deciding rather than curious, the full report prices the actual transaction — stamp duty on the scale that applies to you, the tax, and the real cash to acquire. All from published rules, all checkable."
        cta={{ href: "/analyse", label: "Open the report" }}
      />
    </div>
  );
}
