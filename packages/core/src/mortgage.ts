/**
 * Mortgage arithmetic for a Hong Kong purchase: what you can borrow, what it costs, and
 * whether a bank's stress test would let it through.
 *
 * ## The parameters are inputs, not constants, and that is the whole design
 *
 * Hong Kong's loan-to-value caps, debt-servicing ratio limits and the stress-test margin are
 * set by the HKMA and **have been revised repeatedly** — the caps were relaxed in 2024 and
 * again since. This codebase treats an unsourced rate as a bug, and hardcoding a cap I cannot
 * cite would be exactly that, with a worse failure mode than usual: a borrower told they
 * qualify when they do not.
 *
 * So every policy number is a **parameter with a stated default that the UI shows and lets you
 * change**, and `LendingPolicy` carries the date and source of whatever it was set from. The
 * arithmetic below is certain; the policy is declared. That split is the same one the verdict
 * engine already makes between `computeVerdict` (arithmetic) and `HK_RULE_SETS` (dated rules) —
 * the difference is that stamp duty is published as a table we transcribed, while lending
 * policy is a supervisory guideline a bank applies with discretion, so it can never be more
 * than an indication here.
 *
 * **This is a calculator, not a mortgage offer, and not advice.** Banks price individually, use
 * their own income assessment, and are not bound by anything computed here.
 */

import { minor, toMajor, type Money } from "./money.js";

export interface LendingPolicy {
  /**
   * Maximum loan as a share of property value, by price band. Ordered, first match wins.
   * `upToMinor` of `null` means "and above".
   */
  readonly ltvBands: readonly { readonly upToMinor: number | null; readonly maxLtv: number }[];
  /** Debt-servicing ratio ceiling at the contractual rate — all monthly debt ÷ monthly income. */
  readonly maxDsr: number;
  /** DSR ceiling under the stress scenario. Higher, because the payment is larger. */
  readonly maxStressedDsr: number;
  /** Rate increase the stress test applies, in percentage points. */
  readonly stressPoints: number;
  /** Longest term banks will normally write. */
  readonly maxTermYears: number;
  /** Where these came from, and when — shown on screen next to the result. */
  readonly source: string;
  readonly asOf: string;
  /** True when a value is a working assumption rather than something we can cite precisely.
   *  Drives the caveat the UI is obliged to show. */
  readonly unverified: boolean;
}

/**
 * Defaults, **explicitly marked unverified**.
 *
 * These are plausible working numbers for a Hong Kong residential mortgage, not transcriptions
 * of a current HKMA circular. They exist so the calculator has somewhere to start; the UI shows
 * every one of them, lets the reader change it, and says plainly that they must be confirmed
 * with a bank or against the HKMA's current guidelines. Do not remove `unverified` without
 * actually checking the source.
 */
export const HK_LENDING_DEFAULT: LendingPolicy = {
  ltvBands: [
    { upToMinor: 3_000_000_000, maxLtv: 0.7 },
    { upToMinor: null, maxLtv: 0.6 },
  ],
  maxDsr: 0.5,
  maxStressedDsr: 0.6,
  stressPoints: 2,
  maxTermYears: 30,
  source: "HKMA supervisory guidance on residential mortgage lending",
  asOf: "2026-08",
  unverified: true,
};

/** The LTV cap that applies at this price. */
export function maxLtvFor(policy: LendingPolicy, priceMinor: number): number {
  for (const band of policy.ltvBands) {
    if (band.upToMinor === null || priceMinor <= band.upToMinor) return band.maxLtv;
  }
  return policy.ltvBands[policy.ltvBands.length - 1]?.maxLtv ?? 0.5;
}

/**
 * Level monthly payment on an amortising loan.
 *
 * The zero-rate case is separated rather than left to the general formula, which divides by
 * `1 - (1+0)^-n` — zero. An interest-free mortgage is not realistic, but a reader clearing the
 * rate field to see what happens is, and a page that shows `Infinity` because of it looks
 * broken rather than empty.
 */
export function monthlyPayment(
  principalMinor: number,
  annualRate: number,
  termYears: number,
): number {
  const n = Math.round(termYears * 12);
  if (n <= 0 || principalMinor <= 0) return 0;
  if (annualRate === 0) return principalMinor / n;
  const r = annualRate / 12;
  return (principalMinor * r) / (1 - Math.pow(1 + r, -n));
}

export interface MortgageAssessment {
  readonly currency: Money["currency"];
  /** The cap the price band imposes. */
  readonly maxLtv: number;
  /** Largest loan the LTV cap allows. */
  readonly maxLoanByLtv: Money;
  /** Largest loan the income allows once the stress test is applied — `null` when no income
   *  was given, because a limit computed from an income of zero is not a finding. */
  readonly maxLoanByIncome: Money | null;
  /** The binding constraint: the smaller of the two. */
  readonly maxLoan: Money;
  /** Which one bound, so the reader knows what to change. */
  readonly boundBy: "ltv" | "income";
  readonly requestedLoan: Money;
  readonly withinLtv: boolean;
  readonly payment: Money;
  /** Payment if the rate rose by `stressPoints`. */
  readonly stressedPayment: Money;
  readonly dsr: number | null;
  readonly stressedDsr: number | null;
  readonly passesStressTest: boolean | null;
  /** Deposit implied by the requested loan. */
  readonly downPayment: Money;
  readonly totalInterest: Money;
}

/**
 * Assess a requested loan against a policy.
 *
 * The income-based cap is derived from the **stressed** payment, not the contractual one,
 * because that is the binding test in practice: a loan that passes at today's rate and fails at
 * +2 points is not approved. Solving the payment formula backwards for principal is exact —
 * no search loop — so the answer is reproducible rather than approximately right.
 */
export function assessMortgage(input: {
  readonly priceMinor: number;
  readonly loanMinor: number;
  readonly annualRate: number;
  readonly termYears: number;
  /** Gross monthly household income. `0` or absent means "not supplied". */
  readonly monthlyIncomeMinor?: number;
  /** Existing monthly commitments — other loans, other mortgages. Counted against the DSR. */
  readonly otherMonthlyDebtMinor?: number;
  readonly policy?: LendingPolicy;
  readonly currency?: Money["currency"];
}): MortgageAssessment {
  const policy = input.policy ?? HK_LENDING_DEFAULT;
  const currency = input.currency ?? "HKD";
  const cur = (v: number): Money => minor(Math.round(v), currency);

  const maxLtv = maxLtvFor(policy, input.priceMinor);
  const maxLoanByLtvMinor = input.priceMinor * maxLtv;

  const term = Math.min(input.termYears, policy.maxTermYears);
  const payment = monthlyPayment(input.loanMinor, input.annualRate, term);
  const stressedPayment = monthlyPayment(
    input.loanMinor,
    input.annualRate + policy.stressPoints / 100,
    term,
  );

  const income = input.monthlyIncomeMinor ?? 0;
  const otherDebt = input.otherMonthlyDebtMinor ?? 0;

  let dsr: number | null = null;
  let stressedDsr: number | null = null;
  let passesStressTest: boolean | null = null;
  let maxLoanByIncomeMinor: number | null = null;

  if (income > 0) {
    dsr = (payment + otherDebt) / income;
    stressedDsr = (stressedPayment + otherDebt) / income;
    passesStressTest = dsr <= policy.maxDsr && stressedDsr <= policy.maxStressedDsr;

    // Room left for a mortgage payment under each ceiling, then the principal that produces it.
    const roomNormal = income * policy.maxDsr - otherDebt;
    const roomStressed = income * policy.maxStressedDsr - otherDebt;
    const byNormal = principalFor(roomNormal, input.annualRate, term);
    const byStressed = principalFor(roomStressed, input.annualRate + policy.stressPoints / 100, term);
    maxLoanByIncomeMinor = Math.max(0, Math.min(byNormal, byStressed));
  }

  const maxLoanMinor =
    maxLoanByIncomeMinor === null
      ? maxLoanByLtvMinor
      : Math.min(maxLoanByLtvMinor, maxLoanByIncomeMinor);

  return {
    currency,
    maxLtv,
    maxLoanByLtv: cur(maxLoanByLtvMinor),
    maxLoanByIncome: maxLoanByIncomeMinor === null ? null : cur(maxLoanByIncomeMinor),
    maxLoan: cur(maxLoanMinor),
    boundBy:
      maxLoanByIncomeMinor !== null && maxLoanByIncomeMinor < maxLoanByLtvMinor ? "income" : "ltv",
    requestedLoan: cur(input.loanMinor),
    withinLtv: input.loanMinor <= maxLoanByLtvMinor + 1,
    payment: cur(payment),
    stressedPayment: cur(stressedPayment),
    dsr,
    stressedDsr,
    passesStressTest,
    downPayment: cur(Math.max(0, input.priceMinor - input.loanMinor)),
    totalInterest: cur(Math.max(0, payment * Math.round(term * 12) - input.loanMinor)),
  };
}

/** The payment formula solved for principal — the exact inverse of `monthlyPayment`. */
function principalFor(paymentMinor: number, annualRate: number, termYears: number): number {
  const n = Math.round(termYears * 12);
  if (n <= 0 || paymentMinor <= 0) return 0;
  if (annualRate === 0) return paymentMinor * n;
  const r = annualRate / 12;
  return (paymentMinor * (1 - Math.pow(1 + r, -n))) / r;
}

/** Convenience for display: major units, rounded to whole dollars. */
export function toWholeDollars(m: Money): number {
  return Math.round(toMajor(m));
}
