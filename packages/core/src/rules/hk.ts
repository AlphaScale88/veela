import {
  AVD_SCALE_1_PART_1_15,
  AVD_SCALE_1_PART_1_7_5,
  AVD_SCALE_2_2023_02_22,
  AVD_SCALE_2_2025_02_26,
  AVD_SCALE_2_2026_02_26,
} from "./hk-scales.js";
import type { AdditionalDuty, JurisdictionRules } from "./types.js";

/**
 * Hong Kong's residential duty regimes since February 2023.
 *
 * Five rule sets, because five things happened:
 *
 * | From | What changed |
 * |---|---|
 * | 22/02/2023 | AVD Scale 2 value bands adjusted; fixed $100 up to $3M |
 * | 25/10/2023 | BSD and NRSD halved 15% to 7.5%; SSD holding period 3 years to 2 |
 * | 28/02/2024 | BSD, SSD and NRSD abolished; Part 1 of Scale 1 aligned to Scale 2 |
 * | 26/02/2025 | Fixed $100 raised to $4M |
 * | 26/02/2026 | Top rate 6.5% above $109,574,470 |
 *
 * The dates are the dates of the *instrument*, which is what `pickRules` matches on.
 * Two of the changes took effect at 11am on the day; the engine works in whole days
 * and treats the whole day as the new regime — recorded as a caveat on those sets
 * rather than silently rounded away.
 *
 * Sources are per rule set, and all of them are IRD or GovHK primary documents.
 */

const IRD_HISTORICAL_RATES = "https://www.ird.gov.hk/eng/pdf/sd_pty_rates.pdf";
const IRD_RATES_TABLE = "https://www.gov.hk/en/residents/taxes/docs/IRSD123(E).pdf";
const IRD_AVD_FAQ = "https://www.ird.gov.hk/eng/faq/avd.htm";
const IRD_2023_POLICY = "https://www.ird.gov.hk/eng/ppr/archives/23102507.htm";
const GOVHK_RATES = "https://www.gov.hk/en/residents/taxes/stamp/stamp_duty_rates.htm";

/** The 11am caveat, shared by the two rule sets whose change took effect mid-day. */
const MIDDAY_CAVEAT =
  "The change took effect at 11am on this date. The engine matches on the date of the instrument, not the hour, so an instrument executed that morning before 11am would be charged under the new bands here when it should be charged under the old. Check the hour for a transaction dated exactly on the boundary.";

const RATES_CAVEAT =
  "Annual Government Rates are charged on rateable value, not purchase price, and the Budget often grants a temporary concession. The default here is an estimate — confirm against the current Rating and Valuation Department charge before presenting it as fact.";

const ARMS_LENGTH_CAVEAT =
  "Stamp duty on a property already owned by a company, or on a transfer between related parties, can differ. This engine models an arm's-length purchase.";

/** Shared across every Hong Kong rule set: Property Tax at 15% of net assessable value. */
const HK_RENTAL_INCOME_TAX = {
  standardRate: 0.15,
  notionalAllowance: 0.2,
  ratesDeductibleBeforeAllowance: true,
} as const;

const HK_CAPITAL_GAINS = {
  applies: false,
  note: "No capital gains tax on investment property. Frequent buying and selling may be assessed as a trade under Profits Tax — flagged as a risk, not computed.",
} as const;

const HK_ANNUAL_RATES = {
  rate: 0.05,
  note: "Government Rates, charged quarterly at 5% of rateable value per annum. Budget concessions frequently reduce this — verify the current year.",
} as const;

/**
 * SSD rate bands. The rates never changed; the *holding period* did — 36 months for a
 * disposal before 25/10/2023, 24 months on or after it. SSD is charged on the seller,
 * so it never enters an acquisition total. It is carried so that the exit side of a
 * historical scenario can be stated rather than guessed at.
 */
const SSD_BANDS_36_MONTHS = [
  { upToMonths: 6, rate: 0.2 },
  { upToMonths: 12, rate: 0.15 },
  { upToMonths: 24, rate: 0.1 },
  { upToMonths: 36, rate: 0.1 },
] as const;

const SSD_BANDS_24_MONTHS = [
  { upToMonths: 6, rate: 0.2 },
  { upToMonths: 12, rate: 0.15 },
  { upToMonths: 24, rate: 0.1 },
] as const;

/** The three duties as they stood before 25/10/2023. */
const DUTIES_PRE_OCT_2023: readonly AdditionalDuty[] = [
  {
    id: "hk-bsd",
    label: "Buyer's Stamp Duty",
    rate: 0.15,
    suspended: false,
    note: "15% on top of AVD for any buyer who is not a Hong Kong permanent resident, including companies. In force from 27/10/2012 to 24/10/2023.",
  },
  {
    id: "hk-ssd",
    label: "Special Stamp Duty",
    rate: 0.2,
    suspended: false,
    holdingPeriodBands: SSD_BANDS_36_MONTHS,
    note: "Charged on the seller when residential property is resold within 36 months of acquisition. The rate falls with the holding period.",
  },
  {
    id: "hk-nrsd",
    label: "New Residential Stamp Duty",
    rate: 0.15,
    suspended: false,
    note: "The flat 15% AVD at Part 1 of Scale 1, charged to a buyer who is not a first-time HKPR. Applied through the `other` scale, not added separately.",
  },
];

/** The same three after the 2023 Policy Address halved two of them. */
const DUTIES_OCT_2023: readonly AdditionalDuty[] = [
  {
    id: "hk-bsd",
    label: "Buyer's Stamp Duty",
    rate: 0.075,
    suspended: false,
    note: "Halved from 15% to 7.5% on 25/10/2023. Charged on top of AVD for any buyer who is not a Hong Kong permanent resident, including companies.",
  },
  {
    id: "hk-ssd",
    label: "Special Stamp Duty",
    rate: 0.2,
    suspended: false,
    holdingPeriodBands: SSD_BANDS_24_MONTHS,
    note: "Holding period shortened from 36 to 24 months on 25/10/2023. Charged on the seller; the rate falls with the holding period.",
  },
  {
    id: "hk-nrsd",
    label: "New Residential Stamp Duty",
    rate: 0.075,
    suspended: false,
    note: "Halved from 15% to 7.5% on 25/10/2023. Applied through the `other` scale, not added separately.",
  },
];

/** All three abolished for instruments executed on or after 28/02/2024. */
const DUTIES_SUSPENDED: readonly AdditionalDuty[] = [
  {
    id: "hk-bsd",
    label: "Buyer's Stamp Duty",
    rate: 0.075,
    suspended: true,
    suspendedSince: "2024-02-28",
    note: "Abolished 28/02/2024. Previously applied to buyers who were not Hong Kong permanent residents, including companies. Last rate before abolition: 7.5%.",
  },
  {
    id: "hk-ssd",
    label: "Special Stamp Duty",
    rate: 0.2,
    suspended: true,
    suspendedSince: "2024-02-28",
    holdingPeriodBands: SSD_BANDS_24_MONTHS,
    note: "Abolished 28/02/2024. Previously charged on the seller on resale within 24 months, at a rate that fell with the holding period.",
  },
  {
    id: "hk-nrsd",
    label: "New Residential Stamp Duty",
    rate: 0.075,
    suspended: true,
    suspendedSince: "2024-02-28",
    note: "Abolished 28/02/2024. Part 1 of Scale 1 was aligned to the Scale 2 rates on the same date, so a buyer who already owns residential property now pays the same duty as a first-time buyer.",
  },
];

/**
 * 22/02/2023 to 25/10/2023. The full cooling-measure regime: a buyer who is not a
 * first-time HKPR pays a flat 15%, and a non-HKPR pays a further 15% BSD on top.
 */
export const HK_RULES_2023_02: JurisdictionRules = {
  meta: {
    jurisdiction: "HK",
    currency: "HKD",
    effectiveFrom: "2023-02-22",
    effectiveTo: "2023-10-25",
    sources: [IRD_HISTORICAL_RATES, GOVHK_RATES],
    caveats: [MIDDAY_CAVEAT, RATES_CAVEAT, ARMS_LENGTH_CAVEAT],
  },
  stampDuty: { firstTimeResident: AVD_SCALE_2_2023_02_22, other: AVD_SCALE_1_PART_1_15 },
  additionalDuties: DUTIES_PRE_OCT_2023,
  rentalIncomeTax: HK_RENTAL_INCOME_TAX,
  capitalGains: HK_CAPITAL_GAINS,
  annualRates: HK_ANNUAL_RATES,
};

/** 25/10/2023 to 28/02/2024. BSD and NRSD halved; SSD holding period cut to 24 months. */
export const HK_RULES_2023_10: JurisdictionRules = {
  meta: {
    jurisdiction: "HK",
    currency: "HKD",
    effectiveFrom: "2023-10-25",
    effectiveTo: "2024-02-28",
    sources: [IRD_HISTORICAL_RATES, IRD_2023_POLICY],
    caveats: [RATES_CAVEAT, ARMS_LENGTH_CAVEAT],
  },
  stampDuty: { firstTimeResident: AVD_SCALE_2_2023_02_22, other: AVD_SCALE_1_PART_1_7_5 },
  additionalDuties: DUTIES_OCT_2023,
  rentalIncomeTax: HK_RENTAL_INCOME_TAX,
  capitalGains: HK_CAPITAL_GAINS,
  annualRates: HK_ANNUAL_RATES,
};

/**
 * 28/02/2024 to 26/02/2025. Every cooling measure gone. From here on
 * `firstTimeResident` and `other` are the **same table**: the IRD publishes one column
 * headed "Rates at Scale 2 or Part 1 of Scale 1", and a buyer's residency and existing
 * holdings stop affecting the duty.
 */
export const HK_RULES_2024_02: JurisdictionRules = {
  meta: {
    jurisdiction: "HK",
    currency: "HKD",
    effectiveFrom: "2024-02-28",
    effectiveTo: "2025-02-26",
    sources: [IRD_HISTORICAL_RATES, IRD_AVD_FAQ],
    caveats: [RATES_CAVEAT, ARMS_LENGTH_CAVEAT],
  },
  stampDuty: { firstTimeResident: AVD_SCALE_2_2023_02_22, other: AVD_SCALE_2_2023_02_22 },
  additionalDuties: DUTIES_SUSPENDED,
  rentalIncomeTax: HK_RENTAL_INCOME_TAX,
  capitalGains: HK_CAPITAL_GAINS,
  annualRates: HK_ANNUAL_RATES,
};

/** 26/02/2025 to 26/02/2026. The fixed $100 band raised from $3M to $4M; nothing else moved. */
export const HK_RULES_2025_02: JurisdictionRules = {
  meta: {
    jurisdiction: "HK",
    currency: "HKD",
    effectiveFrom: "2025-02-26",
    effectiveTo: "2026-02-26",
    sources: [IRD_HISTORICAL_RATES, IRD_AVD_FAQ],
    caveats: [RATES_CAVEAT, ARMS_LENGTH_CAVEAT],
  },
  stampDuty: { firstTimeResident: AVD_SCALE_2_2025_02_26, other: AVD_SCALE_2_2025_02_26 },
  additionalDuties: DUTIES_SUSPENDED,
  rentalIncomeTax: HK_RENTAL_INCOME_TAX,
  capitalGains: HK_CAPITAL_GAINS,
  annualRates: HK_ANNUAL_RATES,
};

/** 26/02/2026 to current. Top rate 6.5% above $109,574,470. */
export const HK_RULES_2026: JurisdictionRules = {
  meta: {
    jurisdiction: "HK",
    currency: "HKD",
    effectiveFrom: "2026-02-26",
    effectiveTo: null,
    sources: [IRD_RATES_TABLE, IRD_AVD_FAQ],
    caveats: [RATES_CAVEAT, ARMS_LENGTH_CAVEAT],
  },
  stampDuty: { firstTimeResident: AVD_SCALE_2_2026_02_26, other: AVD_SCALE_2_2026_02_26 },
  additionalDuties: DUTIES_SUSPENDED,
  rentalIncomeTax: HK_RENTAL_INCOME_TAX,
  capitalGains: HK_CAPITAL_GAINS,
  annualRates: HK_ANNUAL_RATES,
};

/**
 * Oldest first. `pickRules` sorts for itself, but keeping the array in chronological
 * order is how a reader checks that the periods are contiguous with no gap.
 */
export const HK_RULE_SETS: readonly JurisdictionRules[] = [
  HK_RULES_2023_02,
  HK_RULES_2023_10,
  HK_RULES_2024_02,
  HK_RULES_2025_02,
  HK_RULES_2026,
];

/** The earliest transaction date the engine can answer for Hong Kong. */
export const HK_EARLIEST_COVERED_DATE = HK_RULES_2023_02.meta.effectiveFrom;
