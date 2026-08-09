import type { JurisdictionRules, StampDutyScale } from "./types.js";

/** HK dollars → cents. The IRD table is transcribed in dollars for reviewability. */
const $ = (dollars: number): number => Math.round(dollars * 100);

/**
 * Ad Valorem Stamp Duty, Scale 2 — a Hong Kong permanent resident acquiring their
 * first residential property, acting in their own capacity.
 *
 * Transcribed verbatim from the IRD table effective **26 February 2026**, when the
 * top band was raised from 4.25% to 6.5% for properties above HK$100 M.
 *
 * The alternating "marginal" bands are the IRD's own marginal relief: they smooth
 * the step between percentage bands. Each marginal band's upper bound coincides
 * exactly with the next percentage band's value — `hk.test.ts` asserts that
 * continuity at every boundary, which is how we know the transcription is right.
 */
const AVD_SCALE_2: StampDutyScale = {
  id: "hk-avd-scale2-2026-02-26",
  label: "AVD Scale 2 — HKPR first-time buyer",
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
 * Part 1 of Scale 1 — a flat 15% on the whole consideration. Applies to residential
 * acquisitions since 5 November 2016 unless an exemption applies: in practice, any
 * buyer who already owns residential property, buys through a company, or otherwise
 * fails the first-time-HKPR test.
 */
const AVD_SCALE_1_PART_1: StampDutyScale = {
  id: "hk-avd-scale1-part1",
  label: "AVD Scale 1 Part 1 — flat 15%",
  bands: [{ kind: "percentage", upTo: null, rate: 0.15 }],
};

export const HK_RULES_2026: JurisdictionRules = {
  meta: {
    jurisdiction: "HK",
    currency: "HKD",
    effectiveFrom: "2026-02-26",
    effectiveTo: null,
    sources: [
      "https://www.ird.gov.hk/eng/faq/avd.htm",
      "https://www.gov.hk/en/residents/taxes/property/propertycompute.htm",
    ],
    caveats: [
      "Annual Government Rates are charged on rateable value, not purchase price, and the Budget often grants a temporary concession. The default here is an estimate — confirm against the current Rating and Valuation Department charge before presenting it as fact.",
      "Stamp duty on a property already owned by a company, or on a transfer between related parties, can differ. This engine models an arm's-length purchase.",
    ],
  },

  stampDuty: {
    firstTimeResident: AVD_SCALE_2,
    other: AVD_SCALE_1_PART_1,
  },

  /**
   * These exist in law but are currently suspended. Modelling them explicitly —
   * rather than deleting them — is the whole point of dated rules: they can be
   * reinstated, and a user comparing scenarios across years needs them.
   */
  suspendedDuties: [
    {
      id: "hk-bsd",
      label: "Buyer's Stamp Duty",
      rate: 0.075,
      suspended: true,
      suspendedSince: "2024-02-28",
      note: "Suspended 28/02/2024. Previously applied to buyers who were not Hong Kong permanent residents, including companies.",
    },
    {
      id: "hk-ssd",
      label: "Special Stamp Duty",
      rate: 0.1,
      suspended: true,
      suspendedSince: "2024-02-28",
      note: "Suspended 28/02/2024. Previously applied on resale within a holding period, at a rate that decreased with time held.",
    },
    {
      id: "hk-nrsd",
      label: "New Residential Stamp Duty",
      rate: 0.15,
      suspended: true,
      suspendedSince: "2024-02-28",
      note: "Suspended 28/02/2024.",
    },
  ],

  /**
   * Property Tax: 15% of the net assessable value.
   * NAV = rent receivable − irrecoverable rent − rates paid by the owner − 20%
   * notional allowance for repairs and outgoings.
   */
  rentalIncomeTax: {
    standardRate: 0.15,
    notionalAllowance: 0.2,
    ratesDeductibleBeforeAllowance: true,
  },

  /**
   * Hong Kong does not tax capital gains on property held as an investment. A gain
   * can still be taxed as profits if the activity amounts to trading — that is a
   * facts-and-circumstances test the engine flags rather than computes.
   */
  capitalGains: {
    applies: false,
    note: "No capital gains tax on investment property. Frequent buying and selling may be assessed as a trade under Profits Tax — flagged as a risk, not computed.",
  },

  annualRates: {
    rate: 0.05,
    note: "Government Rates, charged quarterly at 5% of rateable value per annum. Budget concessions frequently reduce this — verify the current year.",
  },
};

export const HK_RULE_SETS: readonly JurisdictionRules[] = [HK_RULES_2026];
