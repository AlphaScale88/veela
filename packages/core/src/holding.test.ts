import assert from "node:assert/strict";
import test from "node:test";

import {
  HK_GOVERNMENT_RENT,
  HK_HOLDING_DEFAULT,
  HK_LEASE_STAMP_DUTY,
  leaseStampDuty,
  yieldRange,
  type HoldingAssumptions,
} from "./holding.js";
import { money, toMajor } from "./money.js";
import { HK_RULE_SETS } from "./rules/hk.js";
import { computeVerdict, type PropertyInput } from "./verdict.js";

/**
 * These pin **arithmetic and ordering**, never the assumption bands themselves.
 *
 * A test asserting "vacancy at worst is 9%" would fail for the right reason the day somebody
 * sources a better figure, and be deleted for the wrong one. Where a band matters to a test,
 * it is passed in.
 */
function baseInput(overrides: Partial<PropertyInput> = {}): PropertyInput {
  return {
    currency: "HKD",
    price: money(8_000_000, "HKD"),
    monthlyRent: money(18_000, "HKD"),
    saleableAreaSqft: 500,
    transactionDate: "2026-07-30",
    buyer: {
      isPermanentResident: true,
      ownsOtherResidentialProperty: false,
      purchasingViaCompany: false,
    },
    costs: { ownerPaysRates: true },
    ...overrides,
  };
}

test("the three scenarios are ordered, and the spread is real", () => {
  const r = yieldRange(baseInput());
  assert.ok(r.best.netYield !== null && r.base.netYield !== null && r.worst.netYield !== null);
  assert.ok(r.best.netYield > r.base.netYield, "best must beat base");
  assert.ok(r.base.netYield > r.worst.netYield, "base must beat worst");
  assert.ok(
    r.best.netYield - r.worst.netYield > 0.002,
    "a range that collapses to a point is not telling anyone anything",
  );
});

test("the gross yield is the report's, not a second opinion", () => {
  const input = baseInput();
  const r = yieldRange(input);
  const v = computeVerdict(input, HK_RULE_SETS);
  assert.equal(r.grossYield, v.returns.grossYield);
  assert.deepEqual(r.acquisitionTotal, v.acquisition.total);
});

test("net yield on acquisition is below net yield on price, always", () => {
  // Cash to acquire is price plus duty and fees, so the same income over a bigger denominator.
  for (const s of [yieldRange(baseInput()).best, yieldRange(baseInput()).worst]) {
    assert.ok(s.netYield !== null && s.netYieldOnPrice !== null);
    assert.ok(s.netYield < s.netYieldOnPrice);
  }
});

test("every statutory line is marked sourced and every convention is not", () => {
  const { base } = yieldRange(baseInput());
  const byId = new Map(base.costs.map((l) => [l.id, l]));
  for (const id of ["rates", "governmentRent", "leaseDuty", "rentalIncomeTax"]) {
    assert.equal(byId.get(id)?.sourced, true, `${id} has a published rate and must say so`);
  }
  for (const id of ["vacancy", "repairs", "majorWorks", "lettingCommission"]) {
    assert.equal(byId.get(id)?.sourced, false, `${id} is a convention and must not claim a source`);
  }
});

test("a fee the reader entered wins over the assumed band, and is marked as theirs", () => {
  const entered = yieldRange(
    baseInput({ costs: { ownerPaysRates: true, monthlyManagementFee: money(1_000, "HKD") } }),
  );
  const assumed = yieldRange(baseInput());
  const line = (r: typeof entered, s: "best" | "worst") =>
    r[s].costs.find((l) => l.id === "management");

  assert.equal(toMajor(line(entered, "best")!.amount), 12_000);
  assert.equal(toMajor(line(entered, "worst")!.amount), 12_000, "their figure cannot vary by scenario");
  assert.equal(line(entered, "best")!.sourced, true);
  assert.notEqual(
    toMajor(line(assumed, "best")!.amount),
    toMajor(line(assumed, "worst")!.amount),
    "with no figure entered the band must actually move",
  );
});

test("government rent is 3% of rateable value, and disappears when the lease does not pay it", () => {
  const withRent = yieldRange(baseInput());
  const govLine = withRent.base.costs.find((l) => l.id === "governmentRent");
  // Rateable value falls back to annual rent, as the engine does: 18,000 x 12 = 216,000.
  assert.equal(toMajor(govLine!.amount), 216_000 * HK_GOVERNMENT_RENT.rate);

  const noRent: HoldingAssumptions = { ...HK_HOLDING_DEFAULT, governmentRentApplies: false };
  const without = yieldRange(baseInput(), noRent);
  assert.equal(
    without.base.costs.find((l) => l.id === "governmentRent"),
    undefined,
    "a line charging nothing should not be on the bill at all",
  );
  assert.ok(without.base.netYield! > withRent.base.netYield!);
});

test("lease stamp duty follows the IRD's tiers", () => {
  const rent = 18_000;
  const yearly = rent * 12; // 216,000 — already a multiple of 100, so rounding is a no-op here
  const fee = HK_LEASE_STAMP_DUTY.counterpartFee;

  // One year or less is charged on the TOTAL rent over the term, not the yearly rate.
  assert.equal(leaseStampDuty(rent, 1), yearly * HK_LEASE_STAMP_DUTY.upToOneYear + fee);
  // The Hong Kong norm: two years, in the 1-to-3 tier, on the yearly rent.
  assert.equal(leaseStampDuty(rent, 2), yearly * HK_LEASE_STAMP_DUTY.overOneToThreeYears + fee);
  assert.equal(leaseStampDuty(rent, 3), yearly * HK_LEASE_STAMP_DUTY.overOneToThreeYears + fee);
  assert.equal(leaseStampDuty(rent, 4), yearly * HK_LEASE_STAMP_DUTY.overThreeYears + fee);

  // Rent is rounded UP to the nearest hundred before the rate applies.
  assert.equal(
    leaseStampDuty(1_000.5, 2),
    12_100 * HK_LEASE_STAMP_DUTY.overOneToThreeYears + fee,
    "12,006 must round up to 12,100",
  );
  assert.equal(leaseStampDuty(0, 2), 0);
  assert.equal(leaseStampDuty(rent, 0), 0);
});

test("once-per-tenancy costs are amortised, not charged every year", () => {
  const two = yieldRange(baseInput());
  const four = yieldRange(baseInput(), { ...HK_HOLDING_DEFAULT, tenancyYears: 4 });
  const commission = (r: typeof two) =>
    toMajor(r.base.costs.find((l) => l.id === "lettingCommission")!.amount);

  // Same commission spread over twice the term is half the annual charge. The lease duty is
  // not asserted alongside it because its tier changes at three years — that is the point of
  // the tier test above, and conflating the two would hide a real behaviour.
  assert.ok(
    Math.abs(commission(two) / 2 - commission(four)) < 1,
    `${commission(two)} over two years should halve over four, got ${commission(four)}`,
  );
});

test("the defaults stay flagged unverified, and the range says so", () => {
  // Same guard as `HK_LENDING_DEFAULT`: clearing the flag without sourcing every convention
  // would silently delete the caveat the UI keys off it.
  assert.equal(HK_HOLDING_DEFAULT.unverified, true);
  assert.equal(yieldRange(baseInput()).unverified, true);
});

test("no rent means no yield, rather than a confident zero", () => {
  const r = yieldRange(baseInput({ monthlyRent: money(0, "HKD") }));
  assert.ok(r.base.netYield !== null);
  assert.ok(r.base.netYield < 0, "with no income and real costs the return is negative, not zero");
  assert.equal(toMajor(r.base.rentCollected), 0);
});
