import assert from "node:assert/strict";
import { test } from "node:test";

import { money, toMajor } from "../money.js";
import {
  AVD_SCALE_2_2023_02_22,
  AVD_SCALE_2_2025_02_26,
  AVD_SCALE_2_2026_02_26,
} from "./hk-scales.js";
import { evaluateScale, type StampDutyScale } from "./types.js";

/**
 * The IRD's marginal-relief bands exist so that the duty curve is continuous: at the
 * top of each marginal band, the marginal formula must equal the next band's flat
 * percentage of the same consideration. A mistyped digit anywhere in a transcribed
 * table breaks that identity, which is what makes this the test that makes three
 * hand-copied tax tables trustworthy.
 *
 * The IRD rounds its published upper bounds, so the two figures agree to within a
 * dollar or so rather than exactly — the tolerance scales with the consideration
 * because a $10 rounding at the top band is worth more than at the bottom.
 */
function assertContinuous(
  scale: StampDutyScale,
  boundaries: readonly { at: number; nextRate: number }[],
): void {
  for (const { at, nextRate } of boundaries) {
    const viaMarginal = toMajor(evaluateScale(scale, money(at, "HKD")));
    const viaPercentage = at * nextRate;
    const tolerance = Math.max(1, at * 0.00001);
    assert.ok(
      Math.abs(viaMarginal - viaPercentage) <= tolerance,
      `${scale.id} at HK$${at.toLocaleString()}: marginal gives ${viaMarginal}, ` +
        `${nextRate * 100}% gives ${viaPercentage}`,
    );
  }
}

/** Shared by all three tables: every band from 1.5% upwards is identical. */
const SHARED_BOUNDARIES = [
  { at: 4_935_480, nextRate: 0.0225 },
  { at: 6_642_860, nextRate: 0.03 },
  { at: 10_080_000, nextRate: 0.0375 },
  { at: 21_739_120, nextRate: 0.0425 },
] as const;

test("the 22/02/2023 table is continuous at every boundary", () => {
  assertContinuous(AVD_SCALE_2_2023_02_22, [
    { at: 3_528_240, nextRate: 0.015 },
    ...SHARED_BOUNDARIES,
  ]);
});

test("the 26/02/2025 table is continuous at every boundary", () => {
  assertContinuous(AVD_SCALE_2_2025_02_26, [
    { at: 4_323_780, nextRate: 0.015 },
    ...SHARED_BOUNDARIES,
  ]);
});

test("the 26/02/2026 table is continuous at every boundary", () => {
  assertContinuous(AVD_SCALE_2_2026_02_26, [
    { at: 4_323_780, nextRate: 0.015 },
    ...SHARED_BOUNDARIES,
    { at: 109_574_470, nextRate: 0.065 },
  ]);
});

test("the fixed HK$100 band moved from HK$3M to HK$4M on 26/02/2025", () => {
  const at = (scale: StampDutyScale, dollars: number): number =>
    toMajor(evaluateScale(scale, money(dollars, "HKD")));

  assert.equal(at(AVD_SCALE_2_2023_02_22, 3_000_000), 100);
  assert.ok(at(AVD_SCALE_2_2023_02_22, 3_500_000) > 100, "above HK$3M duty starts climbing");

  assert.equal(at(AVD_SCALE_2_2025_02_26, 3_500_000), 100, "still HK$100 under the 2025 bands");
  assert.equal(at(AVD_SCALE_2_2025_02_26, 4_000_000), 100);
  assert.ok(at(AVD_SCALE_2_2025_02_26, 4_100_000) > 100);
});

/**
 * The 2026 amendment only touched the top. Below HK$100M the 2025 and 2026 tables must
 * agree everywhere — if they diverge, one of the two was transcribed wrong.
 */
test("2025 and 2026 agree on every consideration below HK$100M", () => {
  for (let dollars = 500_000; dollars <= 99_000_000; dollars += 331_000) {
    const a = toMajor(evaluateScale(AVD_SCALE_2_2025_02_26, money(dollars, "HKD")));
    const b = toMajor(evaluateScale(AVD_SCALE_2_2026_02_26, money(dollars, "HKD")));
    assert.equal(a, b, `tables diverge at HK$${dollars.toLocaleString()}`);
  }
});

test("only the 2026 table charges more than 4.25% at the very top", () => {
  const at200m = (scale: StampDutyScale): number =>
    toMajor(evaluateScale(scale, money(200_000_000, "HKD")));

  assert.equal(at200m(AVD_SCALE_2_2023_02_22), 8_500_000); // 4.25%
  assert.equal(at200m(AVD_SCALE_2_2025_02_26), 8_500_000); // 4.25%
  assert.equal(at200m(AVD_SCALE_2_2026_02_26), 13_000_000); // 6.5%
});

test("duty never falls as the consideration rises, on any table", () => {
  for (const scale of [
    AVD_SCALE_2_2023_02_22,
    AVD_SCALE_2_2025_02_26,
    AVD_SCALE_2_2026_02_26,
  ]) {
    let previous = -1;
    for (let dollars = 500_000; dollars <= 130_000_000; dollars += 137_000) {
      const d = toMajor(evaluateScale(scale, money(dollars, "HKD")));
      assert.ok(d >= previous, `${scale.id} fell at HK$${dollars.toLocaleString()}`);
      previous = d;
    }
  }
});
