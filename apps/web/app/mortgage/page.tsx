"use client";

import {
  assessMortgage,
  HK_LENDING_DEFAULT,
  toMajor,
  type LendingPolicy,
} from "@veela/core";
import { formatCompactMoney, formatPercent } from "@veela/ui";
import Link from "next/link";
import { useMemo, useState } from "react";

import { BankIcon, CalculatorIcon, GaugeIcon } from "../../components/service-icons";
import { BenefitCards, FactBar, Faq, ServiceHero } from "../../components/service-page";

const BENEFITS = [
  {
    title: "The rules as they stand",
    caption: "70% loan-to-value, flat, and a 50% servicing limit — with the source on screen.",
    icon: GaugeIcon,
  },
  {
    title: "Both ceilings",
    caption: "What the loan-to-value cap allows, and what your income allows. The smaller binds.",
    icon: CalculatorIcon,
  },
  {
    title: "Nothing sold to you",
    caption: "No lender recommended, no referral fee, no details passed on. Just the arithmetic.",
    icon: BankIcon,
  },
] as const;

const FAQ = [
  {
    q: "Will you match me with a lender?",
    a: "No. Comparable products run this page as a lead funnel — you fill in a form and a lender calls. Veela has vetted nobody, takes no referral fee and passes your details to no one. Approach banks directly or use a broker you chose yourself, then compare their number against this one.",
  },
  {
    q: "Isn't there a stress test?",
    a: "There was, and for years it was the test that decided Hong Kong applications: banks checked you could still afford the payment if rates rose two percentage points. The HKMA suspended that requirement on 28 February 2024. What binds now is the debt-servicing ratio at your actual rate — 50% of income, every debt counted. This page still shows the +2-point payment, because a rate rise would still cost you that, but it no longer caps what you can borrow.",
  },
  {
    q: "Are the caps here the real HKMA numbers?",
    a: "Yes, as of August 2026, and the source is named on screen: 70% loan-to-value regardless of the property's value or whether you will live in it, and a 50% servicing limit, both from the Government's announcement of 16 October 2024. Two things remain assumptions — the 30-year maximum term, which is market practice rather than a supervisory rule, and more importantly what any particular bank will lend inside those ceilings. Every field stays editable for that second reason.",
  },
  {
    q: "Why does my income cap look so different from the LTV cap?",
    a: "They are unrelated constraints. The LTV cap is a share of the property's value; the income cap is whatever monthly payment your income supports under the servicing limits, converted back into a principal. Whichever is smaller is the one that actually binds, and the page names it.",
  },
  {
    q: "Does other debt really count?",
    a: "Yes, and it is the most commonly forgotten input. Car loans, personal loans and any other mortgage all count against the same servicing ratio, so they reduce what you can borrow pound for pound of monthly payment.",
  },
] as const;

/**
 * How much can you borrow, and would a bank's stress test allow it.
 *
 * ## Why this is a calculator and not a mortgage service
 *
 * Mashvisor's Services section lists lenders. Veela lists none, for the reason this project
 * already gave when it declined to build Services at all: **we have vetted nobody**, and
 * presenting names as trusted is inventing authority the product does not have. Referring a
 * borrower to a lender for a fee is also a different regulated activity from computing a
 * number, and this stays firmly on the computing side.
 *
 * What is genuinely useful and entirely honest is the arithmetic: the LTV cap, the payment, the
 * payment **if rates rose two points**, and whether the resulting debt-servicing ratio clears
 * the limit. That last one is what actually decides a Hong Kong application, and it is what most
 * buyers discover late.
 *
 * ## The stress test is no longer the answer to "would this get through"
 *
 * This page used to lead with the +2-point stress test, because for years that was the test that
 * sank applications. The HKMA suspended it on 28/02/2024, and the copy here said otherwise until
 * 24/08/2026 — asking a headline question about a test that no longer exists, and computing the
 * borrowing limit from it, which understated what a reader could borrow.
 *
 * The stressed payment is still shown. A rate rise would still cost that, and a buyer who can
 * only afford the loan at exactly today's rate should see it. It is presented as a sensitivity,
 * which is what it now is, rather than as a gate.
 *
 * ## Every policy number is still on screen and editable
 *
 * The caps are now transcribed from the Government's own announcements rather than assumed, so
 * `unverified` is clear — but they stay editable, because the HKMA sets a ceiling and a bank
 * lends inside it at its own discretion. A supervisory maximum is not an offer, and that caveat
 * is now unconditional on the page instead of keyed off a flag that could be cleared.
 */

const M = 100;

export default function MortgagePage(): React.JSX.Element {
  const [price, setPrice] = useState(8_000_000);
  const [loan, setLoan] = useState(5_600_000);
  const [rate, setRate] = useState(4);
  const [term, setTerm] = useState(25);
  const [income, setIncome] = useState(80_000);
  const [otherDebt, setOtherDebt] = useState(0);

  // Policy, editable. Kept in state so a reader who knows the current caps can put them in and
  // get a real answer rather than an answer against our assumption.
  const [maxLtvPct, setMaxLtvPct] = useState(70);
  const [maxDsrPct, setMaxDsrPct] = useState(HK_LENDING_DEFAULT.maxDsr * 100);
  const [stressPoints, setStressPoints] = useState(HK_LENDING_DEFAULT.stressPoints);

  const policy: LendingPolicy = useMemo(
    () => ({
      ...HK_LENDING_DEFAULT,
      ltvBands: [{ upToMinor: null, maxLtv: maxLtvPct / 100 }],
      maxDsr: maxDsrPct / 100,
      maxStressedDsr: Math.min(1, maxDsrPct / 100 + 0.1),
      // `stressTestSuspendedSince` is inherited from the default, so editing the margin changes
      // the sensitivity shown and does not quietly reinstate a cap the regulator withdrew.
      stressPoints,
    }),
    [maxLtvPct, maxDsrPct, stressPoints],
  );

  const a = useMemo(
    () =>
      assessMortgage({
        priceMinor: price * M,
        loanMinor: loan * M,
        annualRate: rate / 100,
        termYears: term,
        monthlyIncomeMinor: income * M,
        otherMonthlyDebtMinor: otherDebt * M,
        policy,
      }),
    [price, loan, rate, term, income, otherDebt, policy],
  );

  // The live test. `passesStressTest` is null while the HKMA's requirement is suspended, and
  // rendering null as a verdict would read as a refusal.
  const pass = a.withinDsr;

  return (
    <div className="col py-12 sm:py-16">
      <ServiceHero
        eyebrow="Services · Mortgage"
        icon={BankIcon}
        title="How much would a bank actually lend?"
        subtitle="Two ceilings decide it: 70% of the price, and a monthly payment that fits inside half your income once every other debt is counted. The +2-point stress test that used to sink Hong Kong applications was suspended in February 2024 — still worth knowing, no longer a gate."
      />

      <BenefitCards items={BENEFITS} />

      <FactBar
        facts={[
          "Every assumption on screen and editable",
          "No lender recommended, no referral fee",
          "13 tests pin the arithmetic in the engine",
        ]}
      />

      <div className="mt-12 grid gap-8 lg:grid-cols-[1.1fr_1fr] lg:items-start">
        <div className="space-y-5">
          <Section title="The purchase">
            <Field label="Property price" value={price} onChange={setPrice} money />
            <Field label="Loan wanted" value={loan} onChange={setLoan} money />
            <Field label="Interest rate" value={rate} onChange={setRate} unit="%" step={0.1} />
            <Field label="Term" value={term} onChange={setTerm} unit="years" />
          </Section>

          <Section title="You" hint="Left blank, only the LTV cap is checked.">
            <Field label="Monthly household income" value={income} onChange={setIncome} money />
            <Field
              label="Other monthly debt"
              value={otherDebt}
              onChange={setOtherDebt}
              money
              hint="Car loans, other mortgages, personal loans — banks count them all."
            />
          </Section>

          <Section
            title="The rules"
            hint="The first two are the HKMA's current ceilings. Change them to whatever your bank quotes — it may lend inside them, never outside."
          >
            <Field label="Max loan-to-value" value={maxLtvPct} onChange={setMaxLtvPct} unit="%" />
            <Field label="Max debt-servicing ratio" value={maxDsrPct} onChange={setMaxDsrPct} unit="%" />
            <Field
              label="Rate-rise sensitivity"
              value={stressPoints}
              onChange={setStressPoints}
              unit="points"
              step={0.5}
              hint="Not a cap — the HKMA suspended the stress test in February 2024. Shown so you can see what a rise would cost."
            />
          </Section>
        </div>

        <aside className="lg:sticky lg:top-24">
          <div className="overflow-hidden rounded-panel border border-line bg-surface shadow-lift">
            <div
              className={`px-5 py-4 ${
                pass === null
                  ? "bg-surfaceMuted"
                  : pass
                    ? "bg-positive/10"
                    : "bg-negative/10"
              }`}
            >
              <div className="eyebrow">The servicing limit</div>
              <p className="mt-1 font-display text-[24px] font-semibold tracking-[-0.02em]">
                {pass === null
                  ? "Add an income"
                  : pass
                    ? "Would clear it"
                    : "Would not clear it"}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                {pass === null
                  ? "Without an income only the loan-to-value cap can be checked."
                  : pass
                    ? `At ${rate}% the payment and your other debts stay inside ${maxDsrPct}% of income.`
                    : `At ${rate}% the payment and your other debts breach ${maxDsrPct}% of income. Borrow less, extend the term, or raise the deposit.`}
              </p>
              {!a.stressTestApplied && a.stressedDsr !== null && (
                <p className="mt-1.5 text-xs leading-relaxed text-muted">
                  The +{stressPoints}pt stress test has been suspended since 28/02/2024 and does
                  not cap this. At that rate the ratio would be{" "}
                  {formatPercent(a.stressedDsr, 1)}.
                </p>
              )}
            </div>

            <dl className="grid grid-cols-2 gap-px border-y border-line bg-line">
              <Stat label="Monthly payment" value={formatCompactMoney(a.payment)} />
              <Stat
                label={`If rates +${stressPoints}pt`}
                value={formatCompactMoney(a.stressedPayment)}
              />
              <Stat
                label="Debt-servicing ratio"
                value={a.dsr === null ? "—" : formatPercent(a.dsr, 1)}
              />
              <Stat
                label={a.stressTestApplied ? "Stressed ratio" : "Ratio if rates rose"}
                value={a.stressedDsr === null ? "—" : formatPercent(a.stressedDsr, 1)}
              />
              <Stat label="Deposit needed" value={formatCompactMoney(a.downPayment)} />
              <Stat label="Interest over the term" value={formatCompactMoney(a.totalInterest)} />
            </dl>

            <div className="space-y-2.5 px-5 py-4 text-sm">
              <Row
                label={`Cap at ${formatPercent(a.maxLtv, 0)} LTV`}
                value={formatCompactMoney(a.maxLoanByLtv)}
              />
              {a.maxLoanByIncome !== null && (
                <Row label="Cap from your income" value={formatCompactMoney(a.maxLoanByIncome)} />
              )}
              <Row
                label="Most you could borrow"
                value={formatCompactMoney(a.maxLoan)}
                emphasis
              />
              <p className="pt-1 text-xs leading-relaxed text-muted">
                {a.boundBy === "income"
                  ? "Your income is the binding constraint, not the deposit."
                  : "The loan-to-value cap is the binding constraint, not your income."}{" "}
                {!a.withinLtv && (
                  <strong className="text-negative">
                    The loan you entered exceeds the LTV cap by{" "}
                    {formatCompactMoney({
                      amount: Math.round((toMajor(a.requestedLoan) - toMajor(a.maxLoanByLtv)) * M),
                      currency: a.currency,
                    })}
                    .
                  </strong>
                )}
              </p>
            </div>
          </div>

          {/* Unconditional. This used to be keyed off `unverified`, which meant clearing that
              flag would have silently removed the whole caveat from the page — including the
              half of it that has nothing to do with whether the caps are sourced. */}
          <p className="mt-3 rounded-card border border-caution/40 bg-caution/10 px-4 py-3 text-xs leading-relaxed text-muted">
            <strong className="text-mist">A ceiling is not an offer.</strong> The caps above are
            the HKMA's supervisory maximums — {HK_LENDING_DEFAULT.source}. A bank lends inside
            them at its own discretion, using its own income assessment, and may lend less. This
            is a calculator, not a mortgage offer, and not financial advice.
            {HK_LENDING_DEFAULT.unverified && (
              <>
                {" "}
                <strong className="text-mist">
                  The figures themselves are working assumptions and need confirming.
                </strong>
              </>
            )}
          </p>
        </aside>
      </div>

      <Faq items={FAQ} />

      <section className="card mx-auto mt-12 max-w-2xl">
        <h2 className="text-[15px] font-semibold">What Veela will not do here</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          We do not recommend lenders, take referral fees, or pass your details to a bank. We
          have vetted nobody, and a list of names presented as trusted would be authority this
          product has not earned. For a mortgage, approach banks directly or use a broker you
          chose yourself — and compare their number against this one.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Once you have a real quote, put it into{" "}
          <Link href="/analyse" className="text-accent hover:underline">
            the full report
          </Link>{" "}
          — cash-on-cash return is computed from the financing, and it is the figure that changes
          most when a rate does.
        </p>
      </section>
    </div>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  readonly title: string;
  readonly hint?: string;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return (
    <fieldset className="card">
      <legend className="px-1 text-[15px] font-semibold">{title}</legend>
      {hint !== undefined && <p className="mt-1 text-xs leading-relaxed text-muted">{hint}</p>}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

function Field({
  label,
  value,
  onChange,
  money = false,
  unit,
  step,
  hint,
}: {
  readonly label: string;
  readonly value: number;
  readonly onChange: (v: number) => void;
  readonly money?: boolean;
  readonly unit?: string;
  readonly step?: number;
  readonly hint?: string;
}): React.JSX.Element {
  return (
    <label className={`block ${hint === undefined ? "" : "sm:col-span-2"}`}>
      <span className="flex items-baseline justify-between">
        <span className="text-sm font-medium">{label}</span>
        {unit !== undefined && (
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted">
            {unit}
          </span>
        )}
      </span>
      <span className="relative mt-1 block">
        {money && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm text-muted">
            HK$
          </span>
        )}
        <input
          type="number"
          value={value === 0 ? "" : value}
          step={step}
          onChange={(e) => onChange(Number(e.target.value))}
          className={`w-full rounded-card border border-line bg-surfaceMuted py-2.5 font-mono text-sm outline-none focus:border-accent focus:bg-surface ${
            money ? "pl-12 pr-3.5" : "px-3.5"
          }`}
        />
      </span>
      {hint !== undefined && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

function Stat({ label, value }: { readonly label: string; readonly value: string }): React.JSX.Element {
  return (
    <div className="bg-surface px-5 py-3">
      <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted">{label}</div>
      <div className="tnum mt-1 text-[17px] font-semibold">{value}</div>
    </div>
  );
}

function Row({
  label,
  value,
  emphasis = false,
}: {
  readonly label: string;
  readonly value: string;
  readonly emphasis?: boolean;
}): React.JSX.Element {
  return (
    <div className={`flex items-baseline justify-between gap-4 ${emphasis ? "font-semibold" : ""}`}>
      <span className={emphasis ? "text-mist" : "text-muted"}>{label}</span>
      <span className="tnum">{value}</span>
    </div>
  );
}
