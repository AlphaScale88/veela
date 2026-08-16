import assert from "node:assert/strict";
import { test } from "node:test";

import { toMajor } from "./money.js";
import {
  assessMortgage,
  HK_LENDING_DEFAULT,
  maxLtvFor,
  monthlyPayment,
} from "./mortgage.js";

/**
 * Tests for the mortgage arithmetic.
 *
 * They pin the **maths**, never the policy. `HK_LENDING_DEFAULT` is explicitly marked
 * unverified and is expected to change whenever the HKMA moves; a test asserting "the cap is
 * 70%" would fail for the right reason and be deleted for the wrong one. So the policy-shaped
 * tests pass a policy in and check the calculator honours it.
 */

const M = 100; // minor units per dollar

test("monthly payment matches the standard amortisation formula", () => {
  // HK$4,000,000 at 4% over 25 years — the textbook case, ~HK$21,113/month.
  const p = monthlyPayment(4_000_000 * M, 0.04, 25);
  assert.ok(Math.abs(p / M - 21_113) < 5, `expected ~21,113, got ${(p / M).toFixed(0)}`);
});

test("a zero rate amortises linearly instead of dividing by zero", () => {
  const p = monthlyPayment(1_200_000 * M, 0, 10);
  assert.equal(p / M, 10_000); // 1.2M over 120 months
  assert.ok(Number.isFinite(p));
});

test("zero principal and zero term are payment-free rather than NaN", () => {
  assert.equal(monthlyPayment(0, 0.04, 25), 0);
  assert.equal(monthlyPayment(1_000_000 * M, 0.04, 0), 0);
});

test("LTV bands are applied by price, first match winning", () => {
  const policy = {
    ...HK_LENDING_DEFAULT,
    ltvBands: [
      { upToMinor: 10_000_000 * M, maxLtv: 0.8 },
      { upToMinor: 30_000_000 * M, maxLtv: 0.7 },
      { upToMinor: null, maxLtv: 0.5 },
    ],
  };
  assert.equal(maxLtvFor(policy, 8_000_000 * M), 0.8);
  assert.equal(maxLtvFor(policy, 10_000_000 * M), 0.8, "boundary is inclusive");
  assert.equal(maxLtvFor(policy, 20_000_000 * M), 0.7);
  assert.equal(maxLtvFor(policy, 50_000_000 * M), 0.5, "above the last band");
});

test("the LTV cap binds when no income is supplied", () => {
  const a = assessMortgage({
    priceMinor: 10_000_000 * M,
    loanMinor: 8_000_000 * M,
    annualRate: 0.04,
    termYears: 25,
  });
  assert.equal(a.maxLoanByIncome, null, "no income means no income-based limit");
  assert.equal(a.boundBy, "ltv");
  assert.equal(toMajor(a.maxLoanByLtv), 7_000_000, "70% of 10M under the default band");
  assert.equal(a.withinLtv, false, "8M exceeds the 7M cap");
});

test("income binds when it is tighter than the LTV cap", () => {
  const a = assessMortgage({
    priceMinor: 10_000_000 * M,
    loanMinor: 7_000_000 * M,
    annualRate: 0.04,
    termYears: 25,
    monthlyIncomeMinor: 40_000 * M, // modest against a 10M flat
  });
  assert.equal(a.boundBy, "income");
  assert.ok(a.maxLoanByIncome !== null);
  assert.ok(
    toMajor(a.maxLoan) < toMajor(a.maxLoanByLtv),
    "the binding limit is the smaller of the two",
  );
});

test("the stress test uses the raised rate, so it is always the harder test", () => {
  const a = assessMortgage({
    priceMinor: 10_000_000 * M,
    loanMinor: 6_000_000 * M,
    annualRate: 0.04,
    termYears: 25,
    monthlyIncomeMinor: 80_000 * M,
  });
  assert.ok(toMajor(a.stressedPayment) > toMajor(a.payment), "+2 points costs more");
  assert.ok(a.stressedDsr !== null && a.dsr !== null && a.stressedDsr > a.dsr);
});

test("a comfortable borrower passes and a stretched one fails", () => {
  const comfortable = assessMortgage({
    priceMinor: 8_000_000 * M,
    loanMinor: 4_000_000 * M,
    annualRate: 0.04,
    termYears: 25,
    monthlyIncomeMinor: 120_000 * M,
  });
  assert.equal(comfortable.passesStressTest, true);

  const stretched = assessMortgage({
    priceMinor: 8_000_000 * M,
    loanMinor: 5_600_000 * M,
    annualRate: 0.04,
    termYears: 25,
    monthlyIncomeMinor: 45_000 * M,
  });
  assert.equal(stretched.passesStressTest, false);
});

test("existing debt reduces borrowing capacity", () => {
  const base = {
    priceMinor: 10_000_000 * M,
    loanMinor: 5_000_000 * M,
    annualRate: 0.04,
    termYears: 25,
    monthlyIncomeMinor: 70_000 * M,
  };
  const clean = assessMortgage(base);
  const encumbered = assessMortgage({ ...base, otherMonthlyDebtMinor: 15_000 * M });
  assert.ok(clean.maxLoanByIncome !== null && encumbered.maxLoanByIncome !== null);
  assert.ok(
    toMajor(encumbered.maxLoanByIncome) < toMajor(clean.maxLoanByIncome),
    "a car loan eats into the mortgage",
  );
  assert.ok(encumbered.dsr !== null && clean.dsr !== null && encumbered.dsr > clean.dsr);
});

test("the income cap is the exact inverse of the payment formula", () => {
  // Borrow precisely the maximum the income allows, and the DSR should land on the ceiling
  // rather than near it — this is what makes the answer reproducible instead of searched for.
  const income = 100_000 * M;
  const a = assessMortgage({
    priceMinor: 100_000_000 * M, // deliberately huge so LTV cannot bind
    loanMinor: 1_000 * M,
    annualRate: 0.04,
    termYears: 25,
    monthlyIncomeMinor: income,
  });
  assert.ok(a.maxLoanByIncome !== null);
  const atMax = assessMortgage({
    priceMinor: 100_000_000 * M,
    loanMinor: Math.round(toMajor(a.maxLoanByIncome) * M),
    annualRate: 0.04,
    termYears: 25,
    monthlyIncomeMinor: income,
  });
  assert.ok(atMax.stressedDsr !== null);
  assert.ok(
    Math.abs(atMax.stressedDsr - HK_LENDING_DEFAULT.maxStressedDsr) < 0.005,
    `stressed DSR should sit on the ceiling, got ${atMax.stressedDsr}`,
  );
  assert.equal(atMax.passesStressTest, true, "exactly at the limit still passes");
});

test("the term is capped at the policy maximum rather than accepted blindly", () => {
  const long = assessMortgage({
    priceMinor: 8_000_000 * M,
    loanMinor: 4_000_000 * M,
    annualRate: 0.04,
    termYears: 60, // nobody writes this
  });
  const capped = assessMortgage({
    priceMinor: 8_000_000 * M,
    loanMinor: 4_000_000 * M,
    annualRate: 0.04,
    termYears: HK_LENDING_DEFAULT.maxTermYears,
  });
  assert.equal(toMajor(long.payment), toMajor(capped.payment));
});

test("down payment and total interest are consistent with the loan", () => {
  const a = assessMortgage({
    priceMinor: 8_000_000 * M,
    loanMinor: 5_000_000 * M,
    annualRate: 0.04,
    termYears: 25,
  });
  assert.equal(toMajor(a.downPayment), 3_000_000);
  assert.ok(toMajor(a.totalInterest) > 0);
  assert.ok(
    toMajor(a.totalInterest) < 5_000_000,
    "interest over 25y at 4% is less than the principal",
  );
});

test("the shipped default policy is flagged unverified", () => {
  // Not a style check. The UI keys its "confirm these with a bank" caveat off this flag, so
  // silently clearing it would remove the warning from the page.
  assert.equal(HK_LENDING_DEFAULT.unverified, true);
  assert.ok(HK_LENDING_DEFAULT.source.length > 0);
  assert.ok(/^\d{4}-\d{2}$/.test(HK_LENDING_DEFAULT.asOf));
});
