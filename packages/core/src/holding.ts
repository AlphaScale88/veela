/**
 * The full cost of holding a Hong Kong flat, and the yield range that falls out of it.
 *
 * ## Why this exists beside `computeVerdict`
 *
 * The verdict charges what the reader typed: a management fee, a vacancy rate, a catch-all
 * "other annual costs". That is correct for a report about *their* figures, and it quietly
 * flatters every reader who leaves a box empty — a backtest on 03/09/2026 measured a blank
 * management fee alone moving the net yield from 2.80% to 2.30% on RVD's average Class B
 * flat, an 18% overstatement of the return from one unfilled field.
 *
 * This module charges the things an owner pays whether or not they were thought about, and
 * returns **three** numbers rather than one: the same property under optimistic, central and
 * pessimistic assumptions.
 *
 * ## The range is an assumption band, not a confidence interval
 *
 * Say this wherever the range is shown. Nothing here is a probability. "Worst" means every
 * convention below lands at its pessimistic end at once, which is unlikely and is exactly
 * what makes it useful: it is the question *can this deal survive a bad run*, not *what will
 * happen*. Presenting it as a forecast would be the invented-precision failure this codebase
 * refuses everywhere else.
 *
 * ## Two kinds of number, kept apart on purpose
 *
 * **Statutory** items have a published rate, a date and a citation, and are `sourced: true`:
 * government rates, government rent, property tax, and the stamp duty on the tenancy itself.
 * A reader can check every one against the government.
 *
 * **Conventions** have no published source and are `sourced: false`: what a letting agent
 * charges, what repairs cost, how often a flat sits empty. These are the assumption band, they
 * are all overridable, and `HK_HOLDING_DEFAULT.unverified` is set for the same reason
 * `HK_LENDING_DEFAULT.unverified` is — so that a caveat keyed off the flag cannot be deleted
 * by someone clearing it without doing the sourcing.
 *
 * ## What is deliberately not modelled
 *
 * No capital growth, no rate path, no refinancing, no sale costs. Each would stack a second
 * invisible assumption on the first, and `projectHold()` already owns the forward-looking
 * half with its own required, caller-supplied growth rates.
 */

import {
  add,
  money,
  ratio,
  scale,
  sub,
  sum,
  zero,
  type Money,
} from "./money.js";
import { HK_RULE_SETS } from "./rules/hk.js";
import type { JurisdictionRules } from "./rules/types.js";
import { computeVerdict, type PropertyInput } from "./verdict.js";

/** Three points on one assumption. Not percentiles — see the note on the range above. */
export interface Band {
  readonly best: number;
  readonly base: number;
  readonly worst: number;
}

export type Scenario = "best" | "base" | "worst";

const pick = (b: Band, s: Scenario): number => b[s];

// ────────────────────────────────────────────────────────────────────────────
// Statutory — published rates, dated and cited
// ────────────────────────────────────────────────────────────────────────────

/**
 * Government rent: 3% of rateable value a year, charged alongside rates.
 *
 * **Not the same thing as rates, and routinely confused with them.** Rates are a tax on
 * occupation charged on every property; Government rent is the rent owed under the land
 * lease. It is payable on land leases granted after 27 May 1985, and on the non-renewable
 * leases extended to 2047 — which between them is most of the New Territories and a large
 * share of everything built since. Older urban leases pay a nominal rent instead.
 *
 * That is why `governmentRentApplies` is an input rather than an assumption: whether a
 * particular flat pays it is a fact about its lease, knowable from the demand note, and
 * guessing would put 3% of rateable value on or off the bill for the wrong reason.
 */
export const HK_GOVERNMENT_RENT = {
  rate: 0.03,
  note:
    "3% of rateable value a year, collected with rates. Payable on leases granted after 27 May 1985 and on leases extended to 2047 — most of the New Territories and most post-1985 development. Older urban leases pay a nominal rent instead.",
  source: "https://www.landsd.gov.hk/en/dev-control-compliance/gov-rent.html",
} as const;

/**
 * Stamp duty on the tenancy agreement — the cost almost nobody counts.
 *
 * Rates from the Inland Revenue Department, on the yearly or average yearly rent (on the
 * *total* rent for a term of a year or less), rounded up to the nearest HK$100, plus HK$5 a
 * counterpart.
 *
 * **Landlord and tenant are jointly liable in law**; splitting it evenly is convention, not
 * statute, which is why the split is a `Band` below rather than a constant here. A two-year
 * tenancy — the Hong Kong norm — falls in the 0.5% tier.
 */
export const HK_LEASE_STAMP_DUTY = {
  upToOneYear: 0.0025,
  overOneToThreeYears: 0.005,
  overThreeYears: 0.01,
  counterpartFee: 5,
  roundRentUpTo: 100,
  note:
    "Charged on the yearly or average yearly rent — on the total rent for a term of one year or less. Landlord and tenant are jointly liable; an even split is convention rather than law.",
  source: "https://www.gov.hk/en/residents/taxes/stamp/stamp_duty_rates.htm",
} as const;

/**
 * The duty on one tenancy agreement, in major units.
 *
 * Returns the **whole** duty; the landlord's share is applied by the caller, because who pays
 * what is negotiated and the statute makes both parties liable for all of it.
 */
export function leaseStampDuty(monthlyRentMajor: number, termYears: number): number {
  if (!(monthlyRentMajor > 0) || !(termYears > 0)) return 0;
  const yearly = monthlyRentMajor * 12;
  const base =
    termYears <= 1
      ? yearly * termYears // a short term is charged on the total rent, not the yearly rate
      : yearly;
  const rounded =
    Math.ceil(base / HK_LEASE_STAMP_DUTY.roundRentUpTo) * HK_LEASE_STAMP_DUTY.roundRentUpTo;
  const rate =
    termYears <= 1
      ? HK_LEASE_STAMP_DUTY.upToOneYear
      : termYears <= 3
        ? HK_LEASE_STAMP_DUTY.overOneToThreeYears
        : HK_LEASE_STAMP_DUTY.overThreeYears;
  return rounded * rate + HK_LEASE_STAMP_DUTY.counterpartFee;
}

// ────────────────────────────────────────────────────────────────────────────
// Conventions — no published source, and flagged as such
// ────────────────────────────────────────────────────────────────────────────

export interface HoldingAssumptions {
  /** Share of the year empty. Override with RVD's measured vacancy for the flat's Class. */
  readonly vacancyRate: Band;
  /** Management fee, HK$ per saleable square foot per month. Used only if none was entered. */
  readonly managementFeePerSqftMonth: Band;
  /** Annual repairs and replacement, as a share of one year's gross rent. */
  readonly repairsShareOfRent: Band;
  /** Major building works, annualised, as a share of the purchase price. */
  readonly majorWorksShareOfValue: Band;
  /** Letting agent's commission, in months of rent, once per tenancy. */
  readonly lettingCommissionMonths: Band;
  /** The landlord's share of the tenancy's stamp duty. Convention is half. */
  readonly leaseDutyShare: Band;
  /** Rent not collected: arrears, disputes, a tenant who leaves early. */
  readonly arrearsShareOfRent: Band;
  /** Years per tenancy — amortises the commission and the lease duty. */
  readonly tenancyYears: number;
  /** Whether this lease pays Government rent. A fact about the lease, not an assumption. */
  readonly governmentRentApplies: boolean;
  /** Cleared only by sourcing every convention above. Caveats are keyed off it. */
  readonly unverified: boolean;
}

/**
 * Hong Kong defaults. **Every band here is a market convention, not a measurement** — hence
 * `unverified: true`, and hence the basis written against each one below.
 *
 * The bases, so a reader can argue with them rather than take them:
 *
 *  - **Vacancy.** A fortnight between tenants is the optimistic case; RVD's own measured
 *    vacancy across all private domestic stock has run around 4% for years, and the largest
 *    flats run past 10%. Pass the measured figure for the flat's Class where it is known —
 *    `@veela/core` cannot read it, by the dependency rule, so the caller supplies it.
 *  - **Management fee.** HK$2 to HK$6+ per square foot a month depending on the building's
 *    age and facilities. Only used when the reader left the field blank.
 *  - **Repairs.** Half a month's rent a year at best, a month and a half at worst — painting
 *    between tenancies, appliances, plumbing.
 *  - **Major works.** The one that catches people. Buildings of 30 years and over fall under
 *    the Mandatory Building Inspection Scheme, and a common-parts overhaul is billed to
 *    owners as a special assessment that can run to six figures a flat. Annualised here as a
 *    share of value: nothing at best, and a bill worth 0.4% of the flat a year at worst.
 *  - **Letting commission.** Half a month's rent per tenancy is the Hong Kong norm; a full
 *    month happens.
 *  - **Lease duty share.** Half is convention. Both parties are liable for all of it, so a
 *    landlord who concedes the point pays the lot.
 *  - **Arrears.** Nothing at best; a month lost at worst.
 */
export const HK_HOLDING_DEFAULT: HoldingAssumptions = {
  vacancyRate: { best: 0.02, base: 0.04, worst: 0.09 },
  managementFeePerSqftMonth: { best: 2, base: 3.5, worst: 6 },
  repairsShareOfRent: { best: 0.04, base: 0.08, worst: 0.125 },
  majorWorksShareOfValue: { best: 0, base: 0.0015, worst: 0.004 },
  lettingCommissionMonths: { best: 0.5, base: 0.5, worst: 1 },
  leaseDutyShare: { best: 0.5, base: 0.5, worst: 1 },
  arrearsShareOfRent: { best: 0, base: 0.01, worst: 0.085 },
  tenancyYears: 2,
  governmentRentApplies: true,
  unverified: true,
};

// ────────────────────────────────────────────────────────────────────────────
// The model
// ────────────────────────────────────────────────────────────────────────────

export interface CostLine {
  readonly id: string;
  readonly label: string;
  readonly amount: Money;
  /** True when the figure comes from a published rate or the reader's own input. */
  readonly sourced: boolean;
  /** Where the number came from, in one line, for display beside it. */
  readonly basis: string;
}

export interface HoldingScenario {
  readonly scenario: Scenario;
  readonly grossRent: Money;
  readonly rentCollected: Money;
  readonly costs: readonly CostLine[];
  readonly totalCosts: Money;
  readonly netIncome: Money;
  /** Net income over cash to acquire — the same denominator `computeVerdict` uses. */
  readonly netYield: number | null;
  /** Net income over the purchase price alone, for comparison with a quoted gross yield. */
  readonly netYieldOnPrice: number | null;
}

export interface YieldRange {
  readonly grossYield: number | null;
  readonly acquisitionTotal: Money;
  readonly best: HoldingScenario;
  readonly base: HoldingScenario;
  readonly worst: HoldingScenario;
  /** True while any convention in the assumptions is unsourced. Keep the caveat keyed to it. */
  readonly unverified: boolean;
}

/**
 * The same property under three sets of assumptions.
 *
 * The acquisition total and the gross yield come from `computeVerdict`, deliberately: the
 * range must sit on the same denominator as the report it appears beside, or the two disagree
 * about the same flat and the reader has no way to tell which is wrong.
 */
export function yieldRange(
  input: PropertyInput,
  assumptions: HoldingAssumptions = HK_HOLDING_DEFAULT,
  ruleSets: readonly JurisdictionRules[] = HK_RULE_SETS,
): YieldRange {
  const verdict = computeVerdict(input, ruleSets);
  const rules = ruleSets
    .filter((r) => input.transactionDate >= r.meta.effectiveFrom)
    .filter((r) => r.meta.effectiveTo === null || input.transactionDate < r.meta.effectiveTo)
    .sort((a, b) => (a.meta.effectiveFrom < b.meta.effectiveFrom ? 1 : -1))[0];
  if (rules === undefined) throw new Error(`No rule set covers ${input.transactionDate}`);

  const acquisitionTotal = verdict.acquisition.total;
  const run = (s: Scenario): HoldingScenario =>
    scenarioFor(input, assumptions, rules, acquisitionTotal, s);

  return {
    grossYield: verdict.returns.grossYield,
    acquisitionTotal,
    best: run("best"),
    base: run("base"),
    worst: run("worst"),
    unverified: assumptions.unverified,
  };
}

function scenarioFor(
  input: PropertyInput,
  a: HoldingAssumptions,
  rules: JurisdictionRules,
  acquisitionTotal: Money,
  s: Scenario,
): HoldingScenario {
  const cur = input.currency;
  const monthlyRentMajor = input.monthlyRent.amount / 100;
  const grossRent = scale(input.monthlyRent, 12);

  const vacancyLoss = scale(grossRent, pick(a.vacancyRate, s));
  const afterVacancy = sub(grossRent, vacancyLoss);
  const arrears = scale(afterVacancy, pick(a.arrearsShareOfRent, s));
  const rentCollected = sub(afterVacancy, arrears);

  /* Rateable value falls back to annual rent, the same proxy `computeVerdict` uses and for the
     same reason — the real figure comes from the RVD and the report says so. Using a different
     proxy here would make two numbers on one screen disagree about the same flat. */
  const rateableValue = input.costs.rateableValue ?? grossRent;

  const rates =
    rules.annualRates && input.costs.ownerPaysRates
      ? scale(rateableValue, rules.annualRates.rate)
      : zero(cur);
  const governmentRent = a.governmentRentApplies
    ? scale(rateableValue, HK_GOVERNMENT_RENT.rate)
    : zero(cur);

  /* The reader's own figure wins whenever they gave one. The band is a stand-in for a blank
     field, not a correction of an entered one. */
  const enteredFee = input.costs.monthlyManagementFee;
  const managementEntered = enteredFee !== undefined && enteredFee.amount > 0;
  const management = managementEntered
    ? scale(enteredFee, 12)
    : input.saleableAreaSqft !== undefined && input.saleableAreaSqft > 0
      ? money(
          input.saleableAreaSqft * pick(a.managementFeePerSqftMonth, s) * 12,
          cur,
        )
      : zero(cur);

  const repairs = scale(grossRent, pick(a.repairsShareOfRent, s));
  const majorWorks = scale(input.price, pick(a.majorWorksShareOfValue, s));

  /* Once per tenancy, spread over the tenancy. A two-year lease pays the agent once and the
     Stamp Office once, and charging either in full every year would overstate both. */
  const perTenancy = Math.max(a.tenancyYears, 1 / 12);
  const lettingCommission = scale(
    input.monthlyRent,
    pick(a.lettingCommissionMonths, s) / perTenancy,
  );
  const leaseDuty = money(
    (leaseStampDuty(monthlyRentMajor, a.tenancyYears) * pick(a.leaseDutyShare, s)) / perTenancy,
    cur,
  );

  const other = input.costs.annualOtherCosts ?? zero(cur);

  /* Property tax on the same basis the engine uses, so the two cannot diverge: net assessable
     value is rent less rates borne by the owner, less the statutory notional allowance. */
  const tax = rules.rentalIncomeTax;
  const beforeAllowance = tax.ratesDeductibleBeforeAllowance
    ? sub(rentCollected, rates)
    : rentCollected;
  const rentalIncomeTax = scale(
    scale(beforeAllowance, 1 - tax.notionalAllowance),
    tax.standardRate,
  );

  const costs: CostLine[] = [
    line("vacancy", "Empty between tenants", vacancyLoss, false,
      `${(pick(a.vacancyRate, s) * 100).toFixed(1)}% of the year`),
    line("arrears", "Rent not collected", arrears, false,
      `${(pick(a.arrearsShareOfRent, s) * 100).toFixed(1)}% of rent`),
    line("management", "Management fee", management, managementEntered,
      managementEntered
        ? "your figure"
        : `HK$${pick(a.managementFeePerSqftMonth, s)}/sq ft/month, assumed`),
    line("rates", "Government rates", rates, true,
      rules.annualRates ? rules.annualRates.note : "not charged"),
    line("governmentRent", "Government rent", governmentRent, true, HK_GOVERNMENT_RENT.note),
    line("repairs", "Repairs and replacement", repairs, false,
      `${(pick(a.repairsShareOfRent, s) * 100).toFixed(1)}% of rent`),
    line("majorWorks", "Major building works, annualised", majorWorks, false,
      `${(pick(a.majorWorksShareOfValue, s) * 100).toFixed(2)}% of price a year`),
    line("lettingCommission", "Letting agent", lettingCommission, false,
      `${pick(a.lettingCommissionMonths, s)} month per tenancy, over ${a.tenancyYears} years`),
    line("leaseDuty", "Stamp duty on the tenancy", leaseDuty, true,
      HK_LEASE_STAMP_DUTY.note),
    line("other", "Other costs you entered", other, true, "your figure"),
    /* Described from the rule's own numbers rather than a hardcoded sentence, so a change to
       the rate or the allowance cannot leave the explanation behind. */
    line(
      "rentalIncomeTax",
      "Property tax",
      rentalIncomeTax,
      true,
      `${(tax.standardRate * 100).toFixed(0)}% on ${((1 - tax.notionalAllowance) * 100).toFixed(0)}% of rent` +
        (tax.ratesDeductibleBeforeAllowance ? ", after rates" : ""),
    ),
  ].filter((l) => l.amount.amount !== 0);

  const totalCosts = sum(costs.map((l) => l.amount), cur);
  const netIncome = sub(rentCollected, totalCosts);

  return {
    scenario: s,
    grossRent,
    rentCollected,
    costs,
    totalCosts,
    netIncome,
    netYield: ratio(netIncome, acquisitionTotal),
    netYieldOnPrice: ratio(netIncome, input.price),
  };
}

function line(
  id: string,
  label: string,
  amount: Money,
  sourced: boolean,
  basis: string,
): CostLine {
  return { id, label, amount, sourced, basis };
}

/** Convenience for the UI: the spread between the optimistic and pessimistic net yields. */
export function yieldSpread(range: YieldRange): number | null {
  const { best, worst } = range;
  return best.netYield === null || worst.netYield === null ? null : best.netYield - worst.netYield;
}

/** Re-exported so a caller can build a modified assumption set without reaching for `add`. */
export { add };
