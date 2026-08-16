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

import { AppShell } from "../../../components/app-shell";

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
 * What is genuinely useful and entirely honest is the arithmetic: the LTV cap for the price
 * band, the payment, the payment **if rates rose two points**, and whether the resulting
 * debt-servicing ratio would clear. That is what actually decides a Hong Kong application, and
 * it is what most buyers discover late.
 *
 * ## Every policy number is on screen and editable
 *
 * The HKMA has revised loan-to-value caps and servicing limits repeatedly. Hardcoding a cap we
 * cannot cite would be exactly the "unsourced rate is a bug" failure this codebase refuses —
 * with a worse consequence than usual, since the wrong answer tells someone they qualify when
 * they do not. So the policy is `HK_LENDING_DEFAULT`, it is flagged `unverified`, the UI shows
 * every value, and the reader can change any of them. The maths is certain; the policy is
 * declared.
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

  const pass = a.passesStressTest;

  return (
    <AppShell breadcrumb="Services › Mortgage">
      <header className="max-w-prose">
        <p className="eyebrow">Services · Mortgage</p>
        <h1 className="mt-3 font-display text-[30px] font-extrabold leading-tight tracking-[-0.03em]">
          Would the stress test let this through?
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">
          Hong Kong banks do not just check you can afford today&apos;s payment. They check you
          could still afford it if rates rose — and that test, not the headline rate, is what
          most applications actually turn on.
        </p>
      </header>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.1fr_1fr] lg:items-start">
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
            title="The bank's rules"
            hint="Shown because they are assumptions, not facts. Change them to whatever your bank quotes."
          >
            <Field label="Max loan-to-value" value={maxLtvPct} onChange={setMaxLtvPct} unit="%" />
            <Field label="Max debt-servicing ratio" value={maxDsrPct} onChange={setMaxDsrPct} unit="%" />
            <Field
              label="Stress test adds"
              value={stressPoints}
              onChange={setStressPoints}
              unit="points"
              step={0.5}
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
              <div className="eyebrow">The stress test</div>
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
                    ? `At ${rate}% and again at ${(rate + stressPoints).toFixed(1)}%, the payment stays inside the servicing limits.`
                    : `At ${(rate + stressPoints).toFixed(1)}% the payment breaches the servicing limit. Borrow less, extend the term, or raise the deposit.`}
              </p>
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
                label="Stressed ratio"
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

          {/* Obligatory, and keyed off the policy's own `unverified` flag rather than being a
              sentence someone might tidy away later. */}
          {HK_LENDING_DEFAULT.unverified && (
            <p className="mt-3 rounded-card border border-caution/40 bg-caution/10 px-4 py-3 text-xs leading-relaxed text-muted">
              <strong className="text-mist">Confirm the rules before relying on this.</strong> The
              caps above are working assumptions, not a transcription of current HKMA guidance —
              they have been revised repeatedly, and banks apply their own income assessment on
              top. Source given as {HK_LENDING_DEFAULT.source} ({HK_LENDING_DEFAULT.asOf}). This is
              a calculator, not a mortgage offer, and not financial advice.
            </p>
          )}
        </aside>
      </div>

      <section className="card mt-10 max-w-prose">
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
    </AppShell>
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
