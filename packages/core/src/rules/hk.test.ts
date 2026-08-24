import assert from "node:assert/strict";
import { test } from "node:test";

import { money, toMajor } from "../money.js";
import { HK_RULES_2023_02, HK_RULES_2023_10, HK_RULES_2026, HK_RULE_SETS } from "./hk.js";
import { evaluateScale } from "./types.js";

const scale2 = HK_RULES_2026.stampDuty.firstTimeResident;
const duty = (dollars: number): number =>
  toMajor(evaluateScale(scale2, money(dollars, "HKD")));

/**
 * The IRD's marginal-relief bands exist so the duty curve is continuous: at the top
 * of each marginal band, the marginal formula must equal the next band's flat
 * percentage of the same consideration. If a digit was mistyped when transcribing
 * the table, one of these assertions fails. This is the test that makes the tax
 * engine trustworthy.
 */
const BOUNDARIES: readonly { at: number; nextRate: number }[] = [
  { at: 4_323_780, nextRate: 0.015 },
  { at: 4_935_480, nextRate: 0.0225 },
  { at: 6_642_860, nextRate: 0.03 },
  { at: 10_080_000, nextRate: 0.0375 },
  { at: 21_739_120, nextRate: 0.0425 },
  { at: 109_574_470, nextRate: 0.065 },
];

test("marginal relief bands are continuous with the next percentage band", () => {
  for (const { at, nextRate } of BOUNDARIES) {
    const viaMarginal = duty(at);
    const viaPercentage = at * nextRate;
    assert.ok(
      Math.abs(viaMarginal - viaPercentage) <= 1,
      `at HK$${at.toLocaleString()}: marginal gives ${viaMarginal}, ` +
        `${nextRate * 100}% gives ${viaPercentage}`,
    );
  }
});

test("percentage band lower bounds match the preceding marginal base", () => {
  // At exactly HK$4.5M the duty is 1.5% = 67,500, which is the base of the next band.
  assert.equal(duty(4_500_000), 67_500);
  assert.equal(duty(6_000_000), 135_000);
  assert.equal(duty(9_000_000), 270_000);
  assert.equal(duty(20_000_000), 750_000);
  assert.equal(duty(100_000_000), 4_250_000);
});

test("the HK$100 floor applies up to HK$4M", () => {
  assert.equal(duty(1_000_000), 100);
  assert.equal(duty(4_000_000), 100);
  // One dollar over, marginal relief starts from the 100 base.
  assert.ok(duty(4_000_001) > 100);
});

test("duty is monotonically non-decreasing across the whole range", () => {
  let previous = -1;
  for (let dollars = 500_000; dollars <= 130_000_000; dollars += 137_000) {
    const d = duty(dollars);
    assert.ok(
      d >= previous,
      `duty fell at HK$${dollars.toLocaleString()}: ${d} < ${previous}`,
    );
    previous = d;
  }
});

test("the top band is 6.5% after 26/02/2026", () => {
  assert.equal(duty(200_000_000), 13_000_000);
});

test("Scale 1 Part 1 was a flat 15% before the 2023 Policy Address", () => {
  const scale1 = HK_RULES_2023_02.stampDuty.other;
  assert.equal(toMajor(evaluateScale(scale1, money(8_000_000, "HKD"))), 1_200_000);
  assert.equal(toMajor(evaluateScale(scale1, money(3_000_000, "HKD"))), 450_000);
});

test("Scale 1 Part 1 was halved to 7.5% on 25/10/2023", () => {
  const scale1 = HK_RULES_2023_10.stampDuty.other;
  assert.equal(toMajor(evaluateScale(scale1, money(8_000_000, "HKD"))), 600_000);
});

/**
 * The IRD publishes one column headed "Rates at Scale 2 or Part 1 of Scale 1". Once
 * the two scales are the same table, a second-property buyer pays what a first-time
 * buyer pays — this is the assertion that stops the old flat 15% creeping back in.
 */
test("from 28/02/2024 both scales are the same table", () => {
  assert.equal(
    HK_RULES_2026.stampDuty.other.id,
    HK_RULES_2026.stampDuty.firstTimeResident.id,
  );
  const asOther = evaluateScale(HK_RULES_2026.stampDuty.other, money(8_000_000, "HKD"));
  assert.equal(toMajor(asOther), 240_000);
});

test("BSD, SSD and NRSD are recorded as suspended, not deleted", () => {
  const ids = HK_RULES_2026.additionalDuties.map((d) => d.id);
  assert.deepEqual(ids, ["hk-bsd", "hk-ssd", "hk-nrsd"]);
  for (const d of HK_RULES_2026.additionalDuties) {
    assert.equal(d.suspended, true);
    assert.equal(d.suspendedSince, "2024-02-28");
  }
});

test("the three duties were live before 28/02/2024", () => {
  for (const d of HK_RULES_2023_02.additionalDuties) {
    assert.equal(d.suspended, false, `${d.id} should be live in early 2023`);
  }
  const bsd = HK_RULES_2023_02.additionalDuties.find((d) => d.id === "hk-bsd");
  assert.equal(bsd?.rate, 0.15);
  const halved = HK_RULES_2023_10.additionalDuties.find((d) => d.id === "hk-bsd");
  assert.equal(halved?.rate, 0.075);
});

test("SSD holding period shortened from 36 to 24 months on 25/10/2023", () => {
  const before = HK_RULES_2023_02.additionalDuties.find((d) => d.id === "hk-ssd");
  const after = HK_RULES_2023_10.additionalDuties.find((d) => d.id === "hk-ssd");
  assert.equal(before?.holdingPeriodBands?.at(-1)?.upToMonths, 36);
  assert.equal(after?.holdingPeriodBands?.at(-1)?.upToMonths, 24);
});

/**
 * A gap between two rule sets is a date the engine silently cannot answer. An overlap
 * is two answers for one date. Both are bugs, and both are invisible without this.
 */
test("the rule sets tile the timeline with no gap and no overlap", () => {
  const ordered = [...HK_RULE_SETS].sort((a, b) =>
    a.meta.effectiveFrom < b.meta.effectiveFrom ? -1 : 1,
  );
  for (let i = 0; i < ordered.length - 1; i += 1) {
    assert.equal(
      ordered[i]!.meta.effectiveTo,
      ordered[i + 1]!.meta.effectiveFrom,
      `gap or overlap between ${ordered[i]!.meta.effectiveFrom} and ${ordered[i + 1]!.meta.effectiveFrom}`,
    );
  }
  assert.equal(ordered.at(-1)!.meta.effectiveTo, null, "the last rule set must be open-ended");
});

test("every rule set cites its sources", () => {
  for (const rules of HK_RULE_SETS) {
    assert.ok(
      rules.meta.sources.length > 0,
      `${rules.meta.effectiveFrom} cites no source`,
    );
  }
});
