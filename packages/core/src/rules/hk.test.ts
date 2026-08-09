import assert from "node:assert/strict";
import { test } from "node:test";

import { money, toMajor } from "../money.js";
import { HK_RULES_2026 } from "./hk.js";
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

test("Scale 1 Part 1 is a flat 15%", () => {
  const scale1 = HK_RULES_2026.stampDuty.other;
  assert.equal(toMajor(evaluateScale(scale1, money(8_000_000, "HKD"))), 1_200_000);
  assert.equal(toMajor(evaluateScale(scale1, money(3_000_000, "HKD"))), 450_000);
});

test("BSD, SSD and NRSD are recorded as suspended, not deleted", () => {
  const ids = HK_RULES_2026.suspendedDuties.map((d) => d.id);
  assert.deepEqual(ids, ["hk-bsd", "hk-ssd", "hk-nrsd"]);
  for (const d of HK_RULES_2026.suspendedDuties) {
    assert.equal(d.suspended, true);
    assert.equal(d.suspendedSince, "2024-02-28");
  }
});

test("every rule set cites its sources", () => {
  assert.ok(HK_RULES_2026.meta.sources.length > 0);
});
