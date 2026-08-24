import type { StampDutyScale } from "./types.js";

/** HK dollars → cents. The IRD tables are transcribed in dollars for reviewability. */
const $ = (dollars: number): number => Math.round(dollars * 100);

/**
 * Hong Kong's AVD rate tables, transcribed verbatim from the IRD's own published
 * tables. Three versions are in play for any transaction since 2023, because the
 * value bands moved twice and the top rate once:
 *
 * | In force | Fixed $100 up to | Top rate |
 * |---|---|---|
 * | 22/02/2023 11:00 → 25/02/2025 | $3,000,000 | 4.25% |
 * | 26/02/2025 → 25/02/2026 | $4,000,000 | 4.25% |
 * | 26/02/2026 → | $4,000,000 | 6.5% above $109,574,470 |
 *
 * The alternating "marginal" bands are the IRD's own marginal relief, which smooths
 * the step between percentage bands. Each marginal band's upper bound is the IRD's
 * published figure, **not** the algebraic crossing point — the IRD rounds it, and
 * `hk-scales.test.ts` pins the published number rather than recomputing it.
 *
 * Sources:
 * - Rates of Stamp Duty – Sale or Transfer of Immovable Property, From 01 April 1988
 *   to 25 February 2026 (IRD), tables (8) and (9):
 *   https://www.ird.gov.hk/eng/pdf/sd_pty_rates.pdf
 * - Stamp Duty Rates Table IRSD123 (5/2026), "Rates at Scale 2 or Part 1 of Scale 1":
 *   https://www.gov.hk/en/residents/taxes/docs/IRSD123(E).pdf
 */

/** IRD table (8): in force from 11am on 22 February 2023 to 25 February 2025. */
export const AVD_SCALE_2_2023_02_22: StampDutyScale = {
  id: "hk-avd-scale2-2023-02-22",
  label: "AVD Scale 2 — value bands from 22/02/2023",
  bands: [
    { kind: "flat", upTo: $(3_000_000), fixed: $(100) },
    { kind: "marginal", upTo: $(3_528_240), base: $(100), marginalRate: 0.1, over: $(3_000_000) },
    { kind: "percentage", upTo: $(4_500_000), rate: 0.015 },
    { kind: "marginal", upTo: $(4_935_480), base: $(67_500), marginalRate: 0.1, over: $(4_500_000) },
    { kind: "percentage", upTo: $(6_000_000), rate: 0.0225 },
    { kind: "marginal", upTo: $(6_642_860), base: $(135_000), marginalRate: 0.1, over: $(6_000_000) },
    { kind: "percentage", upTo: $(9_000_000), rate: 0.03 },
    { kind: "marginal", upTo: $(10_080_000), base: $(270_000), marginalRate: 0.1, over: $(9_000_000) },
    { kind: "percentage", upTo: $(20_000_000), rate: 0.0375 },
    { kind: "marginal", upTo: $(21_739_120), base: $(750_000), marginalRate: 0.1, over: $(20_000_000) },
    { kind: "percentage", upTo: null, rate: 0.0425 },
  ],
};

/**
 * IRD table (9): in force from 26 February 2025 to 25 February 2026. The 2025-26
 * Budget raised the maximum value chargeable at the fixed $100 from $3M to $4M and
 * changed nothing else — every band from 1.5% upwards is identical to table (8).
 */
export const AVD_SCALE_2_2025_02_26: StampDutyScale = {
  id: "hk-avd-scale2-2025-02-26",
  label: "AVD Scale 2 — value bands from 26/02/2025",
  bands: [
    { kind: "flat", upTo: $(4_000_000), fixed: $(100) },
    { kind: "marginal", upTo: $(4_323_780), base: $(100), marginalRate: 0.2, over: $(4_000_000) },
    { kind: "percentage", upTo: $(4_500_000), rate: 0.015 },
    { kind: "marginal", upTo: $(4_935_480), base: $(67_500), marginalRate: 0.1, over: $(4_500_000) },
    { kind: "percentage", upTo: $(6_000_000), rate: 0.0225 },
    { kind: "marginal", upTo: $(6_642_860), base: $(135_000), marginalRate: 0.1, over: $(6_000_000) },
    { kind: "percentage", upTo: $(9_000_000), rate: 0.03 },
    { kind: "marginal", upTo: $(10_080_000), base: $(270_000), marginalRate: 0.1, over: $(9_000_000) },
    { kind: "percentage", upTo: $(20_000_000), rate: 0.0375 },
    { kind: "marginal", upTo: $(21_739_120), base: $(750_000), marginalRate: 0.1, over: $(20_000_000) },
    { kind: "percentage", upTo: null, rate: 0.0425 },
  ],
};

/**
 * In force from 26 February 2026. Same bands as table (9) up to $21,739,120, then
 * the 4.25% band is capped at $100M and a new top rate of 6.5% applies above
 * $109,574,470 (Stamp Duty (Amendment) Ordinance 2026).
 */
export const AVD_SCALE_2_2026_02_26: StampDutyScale = {
  id: "hk-avd-scale2-2026-02-26",
  label: "AVD Scale 2 — value bands from 26/02/2026",
  bands: [
    { kind: "flat", upTo: $(4_000_000), fixed: $(100) },
    { kind: "marginal", upTo: $(4_323_780), base: $(100), marginalRate: 0.2, over: $(4_000_000) },
    { kind: "percentage", upTo: $(4_500_000), rate: 0.015 },
    { kind: "marginal", upTo: $(4_935_480), base: $(67_500), marginalRate: 0.1, over: $(4_500_000) },
    { kind: "percentage", upTo: $(6_000_000), rate: 0.0225 },
    { kind: "marginal", upTo: $(6_642_860), base: $(135_000), marginalRate: 0.1, over: $(6_000_000) },
    { kind: "percentage", upTo: $(9_000_000), rate: 0.03 },
    { kind: "marginal", upTo: $(10_080_000), base: $(270_000), marginalRate: 0.1, over: $(9_000_000) },
    { kind: "percentage", upTo: $(20_000_000), rate: 0.0375 },
    { kind: "marginal", upTo: $(21_739_120), base: $(750_000), marginalRate: 0.1, over: $(20_000_000) },
    { kind: "percentage", upTo: $(100_000_000), rate: 0.0425 },
    {
      kind: "marginal",
      upTo: $(109_574_470),
      base: $(4_250_000),
      marginalRate: 0.3,
      over: $(100_000_000),
    },
    { kind: "percentage", upTo: null, rate: 0.065 },
  ],
};

/**
 * AVD Part 1 of Scale 1 — the flat rate charged to a buyer who fails the
 * first-time-HKPR test, commonly called New Residential Stamp Duty. 15% from
 * 05/11/2016, halved to 7.5% by the 2023 Policy Address, then aligned to Scale 2 on
 * 28/02/2024. It is therefore a **flat** scale only for transactions before that date;
 * from 28/02/2024 the rule sets point `other` at the Scale 2 table itself.
 */
export const AVD_SCALE_1_PART_1_15: StampDutyScale = {
  id: "hk-avd-scale1-part1-15",
  label: "AVD Scale 1 Part 1 — flat 15%",
  bands: [{ kind: "percentage", upTo: null, rate: 0.15 }],
};

/** Part 1 of Scale 1 as halved on 25/10/2023, in force until 27/02/2024. */
export const AVD_SCALE_1_PART_1_7_5: StampDutyScale = {
  id: "hk-avd-scale1-part1-7.5",
  label: "AVD Scale 1 Part 1 — flat 7.5%",
  bands: [{ kind: "percentage", upTo: null, rate: 0.075 }],
};
