import type { Currency, Money } from "../money.js";

/**
 * Every tax rule is **versioned and dated**. Hong Kong has changed its property
 * cooling measures repeatedly (BSD/SSD/NRSD suspended 28/02/2024; the top AVD band
 * raised to 6.5% on 26/02/2026), and France revises plus-value abatements. A rule
 * set is therefore selected by transaction date, never hardcoded as a constant.
 *
 * This is the core IP of the product: it is the part a competitor cannot scrape.
 */

export type Jurisdiction = "HK" | "FR" | "VN";

/** ISO date, `YYYY-MM-DD`. */
export type IsoDate = string;

export interface RuleSetMeta {
  readonly jurisdiction: Jurisdiction;
  readonly currency: Currency;
  /** Inclusive date from which this rule set applies. */
  readonly effectiveFrom: IsoDate;
  /** Exclusive date on which it stops applying; null means "current". */
  readonly effectiveTo: IsoDate | null;
  /** Where the numbers came from. Required — an unsourced rate is a bug. */
  readonly sources: readonly string[];
  /** Anything the engine should warn the user about when using this rule set. */
  readonly caveats?: readonly string[];
}

/**
 * A progressive band. `upTo` is the inclusive upper bound of the band in minor
 * units, or null for the final open-ended band.
 *
 * Hong Kong's AVD is unusual: bands alternate between a flat percentage of the
 * whole consideration and a "marginal relief" form (fixed base + a high marginal
 * rate on the excess) that smooths the jump between percentage bands. Both forms
 * are represented here so the table can be transcribed verbatim from the IRD.
 */
export type DutyBand =
  | { readonly kind: "flat"; readonly upTo: number | null; readonly fixed: number }
  | { readonly kind: "percentage"; readonly upTo: number | null; readonly rate: number }
  | {
      readonly kind: "marginal";
      readonly upTo: number | null;
      readonly base: number;
      readonly marginalRate: number;
      readonly over: number;
    };

export interface StampDutyScale {
  readonly id: string;
  readonly label: string;
  readonly bands: readonly DutyBand[];
}

export interface RentalIncomeTaxRule {
  /** Flat rate applied to the net assessable value. */
  readonly standardRate: number;
  /** Notional allowance for repairs and outgoings, e.g. 0.20 in Hong Kong. */
  readonly notionalAllowance: number;
  /** Whether rates paid by the owner are deductible before the allowance. */
  readonly ratesDeductibleBeforeAllowance: boolean;
}

export interface CapitalGainsRule {
  /** Hong Kong has no CGT on property held as an investment. */
  readonly applies: boolean;
  readonly rate?: number;
  readonly note?: string;
}

/**
 * A duty charged **on top of** AVD: BSD, SSD, NRSD. Each was live for part of the
 * period the engine now covers and abolished on 28/02/2024, so the same structure has
 * to express both states — a rule set for a 2023 purchase carries them live, one for
 * today carries them suspended. Deleting them would make historical dates unanswerable.
 */
export interface AdditionalDuty {
  readonly id: string;
  readonly label: string;
  /** Flat rate on the consideration. For a duty with holding-period bands, the headline rate. */
  readonly rate: number;
  readonly suspended: boolean;
  readonly suspendedSince?: IsoDate;
  /**
   * Special Stamp Duty is charged on the **seller** at a rate that falls with how long
   * they held. Present only for duties that work that way.
   */
  readonly holdingPeriodBands?: readonly HoldingPeriodBand[];
  readonly note: string;
}

/** `upToMonths` is the inclusive upper bound of the holding period; null means "and beyond". */
export interface HoldingPeriodBand {
  readonly upToMonths: number | null;
  readonly rate: number;
}

export interface JurisdictionRules {
  readonly meta: RuleSetMeta;
  readonly stampDuty: {
    /** Scale for a first-time buyer who is a permanent resident, own capacity. */
    readonly firstTimeResident: StampDutyScale;
    /** Scale for everyone else — additional property, non-resident, corporate. */
    readonly other: StampDutyScale;
  };
  /**
   * BSD, SSD and NRSD, live or suspended. Read `suspended` before charging anything —
   * the list is present in every rule set precisely so that the state is explicit.
   */
  readonly additionalDuties: readonly AdditionalDuty[];
  readonly rentalIncomeTax: RentalIncomeTaxRule;
  readonly capitalGains: CapitalGainsRule;
  /** Annual government rates as a fraction of rateable value, if applicable. */
  readonly annualRates: { readonly rate: number; readonly note: string } | null;
}

export function isEffectiveOn(meta: RuleSetMeta, date: IsoDate): boolean {
  if (date < meta.effectiveFrom) return false;
  if (meta.effectiveTo !== null && date >= meta.effectiveTo) return false;
  return true;
}

/**
 * Evaluate a banded duty scale against a consideration.
 * Throws if the scale has no band covering the amount — a gap in the table is a
 * bug we want to hear about loudly, not silently treat as zero duty.
 */
export function evaluateScale(scale: StampDutyScale, consideration: Money): Money {
  for (const band of scale.bands) {
    if (band.upTo === null || consideration.amount <= band.upTo) {
      switch (band.kind) {
        case "flat":
          return { amount: band.fixed, currency: consideration.currency };
        case "percentage":
          return {
            amount: Math.round(consideration.amount * band.rate),
            currency: consideration.currency,
          };
        case "marginal":
          return {
            amount: Math.round(
              band.base + (consideration.amount - band.over) * band.marginalRate,
            ),
            currency: consideration.currency,
          };
      }
    }
  }
  throw new Error(
    `Stamp duty scale "${scale.id}" has no band covering ${consideration.amount} ${consideration.currency}`,
  );
}
