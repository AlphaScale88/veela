import { minor, type Currency, type Money } from "./money.js";
import { monthlyPayment } from "./mortgage.js";

/**
 * What holding the flat looks like year by year.
 *
 * This is the fourth of the four outputs the product set out to produce — *capital gain or loss
 * scenarios* — and the only one that had never been built. The report answers "is this worth
 * buying **today**"; nothing answered "what does year seven look like", which is the question an
 * investor with a ten-year horizon is actually asking and the one every landlord tool in Veela's
 * price bracket puts at its centre.
 *
 * ## Why a projection is dangerous, and what is done about it
 *
 * A projection is the easiest place in a property tool to mislead somebody, because the answer is
 * dominated by one assumption the reader never sees: the growth rate. Pick a window and you pick
 * the conclusion. Measured on the RVD private domestic price index, which this repo holds monthly
 * back to 1993:
 *
 * | Look-back | Price CAGR | Rent CAGR |
 * |---|---|---|
 * | 5 years  | **−3.9%** | +2.8% |
 * | 10 years | +1.6% | +2.2% |
 * | 15 years | +3.7% | +2.8% |
 * | 20 years | **+6.5%** | +4.2% |
 * | 30 years | +3.5% | +1.9% |
 *
 * A five-year window says prices fall. A twenty-year window, measured from the 2006 trough, says
 * they compound at 6.5%. **Those are the same market.** So this function takes the growth rates as
 * required arguments with no defaults — a caller cannot get a projection without stating what it
 * assumed — and `rvdGrowthRates` in `@veela/fixtures` derives the whole table from the real series
 * so the UI can show the reader every window rather than one flattering one.
 *
 * ## Deliberately not modelled
 *
 * **No capital gains tax**, because Hong Kong has none on investment property. That is a *named
 * Hong Kong rule*, not an assumption baked into the shared model — see the rules package. It is
 * also why this function is simpler here than the same feature would be in France, and why the
 * gain line is a pure price projection rather than a tax computation.
 *
 * **No refinancing, no rate changes, no capex.** A level payment on the contracted rate for the
 * whole term. Modelling a rate path would add a second invisible assumption on top of the growth
 * rate, and this project's standard is that an unsourced number is a bug. The report already says
 * the interest rate is an input.
 */

export interface HoldAssumptions {
  /** Whole years held. */
  readonly years: number;
  /** Annual property price growth, as a decimal (0.035 = 3.5%). Required — see the file comment. */
  readonly annualPriceGrowth: number;
  /** Annual market rent growth, as a decimal. Required. */
  readonly annualRentGrowth: number;
}

export interface HoldInput {
  readonly currency?: Currency;
  readonly priceMinor: number;
  /** What it costs to get in: price + stamp duty + fees. The cash-on-cash denominator. */
  readonly acquisitionTotalMinor: number;
  readonly annualNetIncomeMinor: number;
  readonly annualGrossRentMinor: number;
  readonly financing?: {
    readonly loanAmountMinor: number;
    readonly annualInterestRate: number;
    readonly termYears: number;
  };
}

export interface HoldYear {
  readonly year: number;
  /** Rent for the year, grown from the report's own figure. */
  readonly grossRent: Money;
  /** Net operating income, grown with rent. */
  readonly netIncome: Money;
  readonly mortgagePaid: Money;
  /** Net income less mortgage payments — what actually lands in the bank that year. */
  readonly cashFlow: Money;
  readonly cumulativeCashFlow: Money;
  readonly propertyValue: Money;
  readonly loanBalance: Money;
  /** Value less debt. */
  readonly equity: Money;
}

export interface HoldProjection {
  readonly currency: Currency;
  readonly assumptions: HoldAssumptions;
  readonly years: readonly HoldYear[];
  /** Value at the end, less what is still owed. */
  readonly finalEquity: Money;
  /** Price growth alone, over the whole period. */
  readonly capitalGain: Money;
  readonly cumulativeCashFlow: Money;
  /**
   * Equity at the end **plus** all the cash taken out, less the cash put in.
   *
   * Not "profit": it ignores the time value of money, which is why `annualisedReturn` exists
   * beside it and why neither is called a return on investment.
   */
  readonly totalGain: Money;
  /**
   * Compound annual growth in (equity + cumulative cash) over cash invested. `null` when nothing
   * was invested, rather than a division by zero dressed up as a percentage.
   */
  readonly annualisedReturn: number | null;
  /** True once cumulative cash flow crosses zero; `null` if it never does in the period. */
  readonly cashFlowBreakEvenYear: number | null;
}

/**
 * Outstanding balance after `monthsPaid` months of a level-payment loan.
 *
 * Closed form rather than a month-by-month loop: the loop is the obvious implementation and
 * accumulates rounding error across 360 iterations, which shows up as a loan that never quite
 * reaches zero at the end of its term.
 */
export function loanBalanceAfter(
  principalMinor: number,
  annualRate: number,
  termYears: number,
  monthsPaid: number,
): number {
  const n = Math.round(termYears * 12);
  if (n <= 0 || principalMinor <= 0) return 0;
  if (monthsPaid >= n) return 0;

  const i = annualRate / 12;
  if (i === 0) return Math.max(0, principalMinor * (1 - monthsPaid / n));

  const growth = (1 + i) ** monthsPaid;
  const balance = principalMinor * growth - monthlyPayment(principalMinor, annualRate, termYears) * ((growth - 1) / i);
  return Math.max(0, balance);
}

export function projectHold(input: HoldInput, assumptions: HoldAssumptions): HoldProjection {
  const currency = input.currency ?? "HKD";
  const cur = (v: number): Money => minor(Math.round(v), currency);
  const years = Math.max(1, Math.trunc(assumptions.years));

  const loan = input.financing?.loanAmountMinor ?? 0;
  const rate = input.financing?.annualInterestRate ?? 0;
  const term = input.financing?.termYears ?? 0;
  const annualMortgage = loan > 0 ? monthlyPayment(loan, rate, term) * 12 : 0;

  /* Cash actually put in: the total cost to acquire, less whatever the bank lent. This is the
     denominator, and it is the acquisition total rather than the price so that stamp duty and
     fees count as money invested — which they are. */
  const cashInvested = Math.max(0, input.acquisitionTotalMinor - loan);

  const rows: HoldYear[] = [];
  let cumulative = 0;
  let breakEven: number | null = null;

  for (let y = 1; y <= years; y += 1) {
    /* Growth compounds from the *end* of year one, so year one is the report's own figures. A
       projection whose first year already differs from the report it sits under reads as a
       contradiction rather than a forecast. */
    const rentFactor = (1 + assumptions.annualRentGrowth) ** (y - 1);
    const grossRent = input.annualGrossRentMinor * rentFactor;
    const netIncome = input.annualNetIncomeMinor * rentFactor;

    /* Payments stop when the loan is repaid, including the part-year in which it finishes. */
    const monthsElapsed = y * 12;
    const monthsOfTerm = Math.round(term * 12);
    const payingMonths = loan > 0 ? Math.max(0, Math.min(12, monthsOfTerm - (monthsElapsed - 12))) : 0;
    const mortgagePaid = loan > 0 ? (annualMortgage / 12) * payingMonths : 0;

    const cashFlow = netIncome - mortgagePaid;
    cumulative += cashFlow;
    if (breakEven === null && cumulative >= 0) breakEven = y;

    /* Rounded first, then subtracted. Rounding the difference instead lets equity come out a cent
       away from `value - balance` as displayed, so a reader checking the row's arithmetic finds it
       does not add up. Caught by a test asserting exactly that. */
    const value = Math.round(input.priceMinor * (1 + assumptions.annualPriceGrowth) ** y);
    const balance = Math.round(loanBalanceAfter(loan, rate, term, monthsElapsed));

    rows.push({
      year: y,
      grossRent: cur(grossRent),
      netIncome: cur(netIncome),
      mortgagePaid: cur(mortgagePaid),
      cashFlow: cur(cashFlow),
      cumulativeCashFlow: cur(cumulative),
      propertyValue: cur(value),
      loanBalance: cur(balance),
      equity: cur(value - balance),
    });
  }

  const last = rows[rows.length - 1];
  const finalValue = Math.round(input.priceMinor * (1 + assumptions.annualPriceGrowth) ** years);
  const finalBalance = Math.round(loanBalanceAfter(loan, rate, term, years * 12));
  const finalEquityMinor = finalValue - finalBalance;
  const totalGainMinor = finalEquityMinor + cumulative - cashInvested;

  const annualisedReturn =
    cashInvested > 0 && finalEquityMinor + cumulative > 0
      ? ((finalEquityMinor + cumulative) / cashInvested) ** (1 / years) - 1
      : null;

  return {
    currency,
    assumptions: { ...assumptions, years },
    years: rows,
    finalEquity: cur(finalEquityMinor),
    capitalGain: cur(finalValue - input.priceMinor),
    cumulativeCashFlow: last?.cumulativeCashFlow ?? cur(0),
    totalGain: cur(totalGainMinor),
    annualisedReturn,
    cashFlowBreakEvenYear: breakEven,
  };
}
