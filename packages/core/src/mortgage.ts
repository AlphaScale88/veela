/**
 * Mortgage arithmetic for a Hong Kong purchase: what you can borrow, what it costs, and
 * whether a bank's stress test would let it through.
 *
 * ## The parameters are inputs, not constants, and that is the whole design
 *
 * Hong Kong's loan-to-value caps, debt-servicing ratio limits and the stress-test margin are
 * set by the HKMA and **have been revised repeatedly** — twice in 2024 alone.
 *
 * The defaults below are now transcribed from the Government's own announcements rather than
 * assumed (see `HK_LENDING_DEFAULT`), but they stay **parameters the UI shows and lets you
 * change**, for a reason that survives being able to cite them: the HKMA sets a ceiling, and a
 * bank lends inside it at its own discretion, using its own income assessment. A supervisory
 * maximum is not an offer. So `LendingPolicy` carries the source and date of whatever it was
 * set from, the arithmetic below is certain, and the policy is declared.
 *
 * That split is the same one the verdict engine makes between `computeVerdict` (arithmetic) and
 * `HK_RULE_SETS` (dated rules), with one deliberate difference: the rule sets are **dated and
 * versioned** because stamp duty is a fact about a transaction that already happened, so an
 * analysis of a 2023 purchase needs 2023's table. Lending policy is a *forward-looking*
 * constraint — the question is always "what could I borrow now" — so there is one current
 * policy rather than a timeline of them. A borrower analysing a mortgage they already hold
 * enters its actual terms instead.
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
  /** DSR ceiling under the stress scenario. Higher, because the payment is larger.
   *  Retained while the test is suspended so reinstating it is a one-field change. */
  readonly maxStressedDsr: number;
  /** Rate increase the stress test applies, in percentage points. */
  readonly stressPoints: number;
  /**
   * The date the HKMA suspended the interest-rate stress test, or `null` while it is in force.
   *
   * Recorded rather than expressed as `stressPoints: 0`, for the same reason the tax engine
   * records BSD and SSD as suspended instead of deleting them: "there is no test" and "the test
   * adds nothing" are different statements, and only the first is true. The stressed payment is
   * still computed and still worth showing as a sensitivity — a borrower should know what +2
   * points costs — but while this is set it must not cap the loan, because denying someone
   * credit on a test the regulator withdrew is the failure this field exists to prevent.
   */
  readonly stressTestSuspendedSince: string | null;
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
 * The current HKMA position, transcribed from the Government's own announcements.
 *
 * Both figures below were **stale until 24/08/2026** and wrong in the direction that talks a
 * borrower out of a loan they would in fact be granted:
 *
 * - The LTV cap was value-banded, 70% up to HK$30M and 60% above. That was the position from
 *   28/02/2024 until 16/10/2024, when banding was removed altogether.
 * - The stress test was applied, and capped the income-based loan. It has been suspended since
 *   28/02/2024.
 *
 * `maxTermYears` is the one number here still not from a circular — 30 years is market practice
 * across HK lenders, not a supervisory limit — which is why `unverified` is a per-policy flag
 * and the UI keeps every field editable.
 *
 * Sources (the HKMA's own pages do not render to an automated fetch; these are the Government
 * Information Services releases carrying the same announcements verbatim):
 * - LTV 70% flat and DSR 50%, in force 16/10/2024: *"The maximum loan-to-value (LTV) ratio for
 *   all residential properties will be set at 70 per cent, regardless of the value of the
 *   property and whether it is for self-occupation."*
 *   https://www.info.gov.hk/gia/general/202410/16/P2024101600258.htm
 * - Stress test suspended, in force 28/02/2024: *"The HKMA therefore considers it appropriate to
 *   suspend the interest rate stress testing requirement for property mortgage lending that
 *   assumes a 200-basis-point rise."*
 *   https://www.info.gov.hk/gia/general/202402/28/P2024022800267.htm
 */
export const HK_LENDING_DEFAULT: LendingPolicy = {
  // One band, no threshold: "regardless of the value of the property".
  ltvBands: [{ upToMinor: null, maxLtv: 0.7 }],
  maxDsr: 0.5,
  maxStressedDsr: 0.6,
  stressPoints: 2,
  stressTestSuspendedSince: "2024-02-28",
  maxTermYears: 30,
  source:
    "HKMA countercyclical macroprudential measures, 16/10/2024 (LTV 70% flat, DSR 50%) and 28/02/2024 (stress test suspended)",
  asOf: "2026-08",
  // The caps are cited. What a bank will actually lend inside them is not, and the UI says so
  // unconditionally rather than keying that sentence off this flag.
  unverified: false,
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
  /** Payment if the rate rose by `stressPoints`. Computed whether or not the test applies. */
  readonly stressedPayment: Money;
  readonly dsr: number | null;
  readonly stressedDsr: number | null;
  /** Whether the contractual DSR clears the limit. **This is the live test.** */
  readonly withinDsr: boolean | null;
  /**
   * The regulatory stress test's result, or `null` when it does not apply — either because no
   * income was supplied or because the HKMA has suspended it. `null` means "not asked", never
   * "failed", and the UI must not render it as a verdict.
   */
  readonly passesStressTest: boolean | null;
  /** False while `policy.stressTestSuspendedSince` is set. Lets the UI label the +2pt figures
   *  as a sensitivity rather than as a gate. */
  readonly stressTestApplied: boolean;
  /** Deposit implied by the requested loan. */
  readonly downPayment: Money;
  readonly totalInterest: Money;
}

/**
 * Assess a requested loan against a policy.
 *
 * The income-based cap is derived from whichever tests actually apply. While the stress test is
 * in force that means the **stressed** payment, because a loan that passes at today's rate and
 * fails at +2 points is not approved; while it is suspended the contractual payment is the only
 * ceiling, and using the stressed one anyway would understate what a borrower can have.
 *
 * Solving the payment formula backwards for principal is exact — no search loop — so the answer
 * is reproducible rather than approximately right.
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
  const stressTestApplied = policy.stressTestSuspendedSince === null;

  let dsr: number | null = null;
  let stressedDsr: number | null = null;
  let withinDsr: boolean | null = null;
  let passesStressTest: boolean | null = null;
  let maxLoanByIncomeMinor: number | null = null;

  if (income > 0) {
    dsr = (payment + otherDebt) / income;
    stressedDsr = (stressedPayment + otherDebt) / income;

    // Room left for a mortgage payment under each ceiling, then the principal that produces it.
    const roomNormal = income * policy.maxDsr - otherDebt;
    const roomStressed = income * policy.maxStressedDsr - otherDebt;
    const byNormal = principalFor(roomNormal, input.annualRate, term);

    /*
     * Compared in cents against the room, not as a ratio against the ceiling, and with the same
     * one-minor-unit tolerance `withinLtv` uses.
     *
     * Borrowing exactly `maxLoanByIncome` puts the payment precisely on the ceiling, so a strict
     * float comparison there is a coin toss decided by a half-cent of rounding in the loan
     * amount — and it lands on "no" often enough to tell a borrower at their computed maximum
     * that their computed maximum is refused.
     */
    withinDsr = payment <= roomNormal + 1;

    if (stressTestApplied) {
      passesStressTest = withinDsr && stressedPayment <= roomStressed + 1;
      const byStressed = principalFor(
        roomStressed,
        input.annualRate + policy.stressPoints / 100,
        term,
      );
      maxLoanByIncomeMinor = Math.max(0, Math.min(byNormal, byStressed));
    } else {
      // Suspended. The stressed figures above stay as a sensitivity; they do not bind.
      maxLoanByIncomeMinor = Math.max(0, byNormal);
    }
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
    withinDsr,
    passesStressTest,
    stressTestApplied,
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
