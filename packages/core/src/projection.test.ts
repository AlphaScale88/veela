import assert from "node:assert/strict";
import { test } from "node:test";

import { toMajor } from "./money.js";
import { loanBalanceAfter, projectHold, type HoldInput } from "./projection.js";

/**
 * Tests for the hold projection.
 *
 * They pin the **arithmetic and the invariants**, never a growth assumption. A test asserting
 * "prices grow 3.5%" would encode the very thing this feature refuses to decide for the reader —
 * so every test passes its own rates in, and the ones that matter most check that the projection
 * cannot contradict the report it sits under.
 */

const M = 100; // minor units per dollar

const BASE: HoldInput = {
  priceMinor: 8_000_000 * M,
  acquisitionTotalMinor: 8_300_000 * M, // price + duty + fees
  annualGrossRentMinor: 240_000 * M,
  annualNetIncomeMinor: 160_000 * M,
};

const FLAT = { years: 10, annualPriceGrowth: 0, annualRentGrowth: 0 };

test("year one matches the report it sits under", () => {
  // The single most important property: growth compounds from the end of year one, so a
  // projection's first row must equal the figures the report already showed. Anything else reads
  // as the report contradicting itself.
  const p = projectHold(BASE, { years: 5, annualPriceGrowth: 0.05, annualRentGrowth: 0.03 });
  const first = p.years[0];
  assert.ok(first !== undefined);
  assert.equal(toMajor(first.grossRent), 240_000);
  assert.equal(toMajor(first.netIncome), 160_000);
});

test("with no growth, value never moves and there is no capital gain", () => {
  const p = projectHold(BASE, FLAT);
  assert.equal(toMajor(p.capitalGain), 0);
  for (const y of p.years) assert.equal(toMajor(y.propertyValue), 8_000_000);
});

test("cash flow accumulates, and cumulative is the running total", () => {
  const p = projectHold(BASE, FLAT);
  let running = 0;
  for (const y of p.years) {
    running += toMajor(y.cashFlow);
    assert.equal(toMajor(y.cumulativeCashFlow), running, `year ${y.year}`);
  }
  assert.equal(toMajor(p.cumulativeCashFlow), running);
});

test("an unlevered hold breaks even in year one and needs no mortgage row", () => {
  const p = projectHold(BASE, FLAT);
  assert.equal(p.cashFlowBreakEvenYear, 1);
  for (const y of p.years) assert.equal(toMajor(y.mortgagePaid), 0);
});

test("a mortgage reduces cash flow and can push break-even out or off the table", () => {
  const levered = projectHold(
    { ...BASE, financing: { loanAmountMinor: 5_600_000 * M, annualInterestRate: 0.04, termYears: 25 } },
    FLAT,
  );
  const unlevered = projectHold(BASE, FLAT);
  assert.ok(
    toMajor(levered.cumulativeCashFlow) < toMajor(unlevered.cumulativeCashFlow),
    "paying a bank cannot improve cash flow",
  );
  // At 160k net against ~355k of payments this never turns positive inside ten years.
  assert.equal(levered.cashFlowBreakEvenYear, null);
});

test("equity is value less the outstanding balance, and the balance only falls", () => {
  const p = projectHold(
    { ...BASE, financing: { loanAmountMinor: 5_600_000 * M, annualInterestRate: 0.04, termYears: 25 } },
    { years: 10, annualPriceGrowth: 0.03, annualRentGrowth: 0.02 },
  );
  let previous = Infinity;
  for (const y of p.years) {
    /* Asserted in **minor units**, which is where money actually lives in this project. In
       majors the comparison is a/100 - b/100 against (a-b)/100, which float division makes
       unequal in the last bit — a property of the test, not of the projection. */
    assert.equal(
      y.equity.amount,
      y.propertyValue.amount - y.loanBalance.amount,
      `year ${y.year}`,
    );
    assert.ok(toMajor(y.loanBalance) < previous, `balance must fall in year ${y.year}`);
    previous = toMajor(y.loanBalance);
  }
});

test("the loan is exactly repaid at the end of its term, not nearly", () => {
  // The reason `loanBalanceAfter` is closed-form rather than a 360-iteration loop.
  assert.equal(loanBalanceAfter(4_000_000 * M, 0.04, 25, 25 * 12), 0);
  assert.equal(loanBalanceAfter(4_000_000 * M, 0.04, 25, 25 * 12 + 1), 0, "and stays there");
  assert.ok(loanBalanceAfter(4_000_000 * M, 0.04, 25, 24 * 12) > 0, "but not a year early");
});

test("a zero-rate loan amortises linearly rather than dividing by zero", () => {
  // Minor units, so this is exact: half the term paid, half the principal left.
  assert.equal(loanBalanceAfter(1_200_000 * M, 0, 10, 60), 600_000 * M);
});

test("mortgage payments stop once the loan is repaid mid-projection", () => {
  const p = projectHold(
    { ...BASE, financing: { loanAmountMinor: 1_000_000 * M, annualInterestRate: 0.03, termYears: 5 } },
    { years: 8, annualPriceGrowth: 0, annualRentGrowth: 0 },
  );
  assert.ok(toMajor(p.years[4]!.mortgagePaid) > 0, "still paying in year 5");
  assert.equal(toMajor(p.years[5]!.mortgagePaid), 0, "nothing in year 6");
  assert.equal(toMajor(p.years[7]!.loanBalance), 0);
});

test("falling prices produce a negative capital gain rather than a floor at zero", () => {
  // The five-year RVD look-back is negative, so this is the realistic case, not an edge case.
  const p = projectHold(BASE, { years: 5, annualPriceGrowth: -0.039, annualRentGrowth: 0.028 });
  assert.ok(toMajor(p.capitalGain) < 0, "prices fell, so the gain is a loss");
  assert.ok(toMajor(p.years[4]!.propertyValue) < 8_000_000);
});

test("annualised return is null when no cash was invested, not Infinity", () => {
  const p = projectHold(
    {
      ...BASE,
      acquisitionTotalMinor: 5_600_000 * M,
      financing: { loanAmountMinor: 5_600_000 * M, annualInterestRate: 0.04, termYears: 25 },
    },
    FLAT,
  );
  assert.equal(p.annualisedReturn, null);
});

test("total gain nets off the cash actually put in", () => {
  const p = projectHold(BASE, FLAT);
  // No growth, no loan: gain is ten years of net income, less the duty and fees on entry.
  const expected = 160_000 * 10 + 8_000_000 - 8_300_000;
  assert.equal(toMajor(p.totalGain), expected);
});

test("a fractional or zero year count is coerced to at least one year", () => {
  assert.equal(projectHold(BASE, { ...FLAT, years: 0 }).years.length, 1);
  assert.equal(projectHold(BASE, { ...FLAT, years: 7.8 }).years.length, 7);
});
