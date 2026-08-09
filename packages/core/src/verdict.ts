import {
  add,
  compare,
  isZero,
  minor,
  money,
  ratio,
  scale,
  sub,
  sum,
  zero,
  type Currency,
  type Money,
} from "./money.js";
import { evaluateScale, type IsoDate, type JurisdictionRules } from "./rules/types.js";

/**
 * What the user tells us about the property. This is the whole input surface — the
 * product is user-fed by design, so nothing here requires a proprietary dataset.
 */
export interface PropertyInput {
  readonly currency: Currency;
  /** Purchase price / consideration. */
  readonly price: Money;
  /** Expected gross monthly rent. */
  readonly monthlyRent: Money;
  /** Saleable area, square feet. Optional — used for per-sqft comparisons. */
  readonly saleableAreaSqft?: number;
  /** Date of acquisition, used to pick the applicable rule set. */
  readonly transactionDate: IsoDate;

  // --- buyer situation, drives which stamp duty scale applies ---
  readonly buyer: {
    readonly isPermanentResident: boolean;
    readonly ownsOtherResidentialProperty: boolean;
    readonly purchasingViaCompany: boolean;
  };

  // --- recurring costs, annual unless stated ---
  readonly costs: {
    /** Management fee / service charge, monthly. */
    readonly monthlyManagementFee?: Money;
    /** Rateable value for government rates. Falls back to a rent-based estimate. */
    readonly rateableValue?: Money;
    /** Whether the owner (not the tenant) pays government rates. */
    readonly ownerPaysRates: boolean;
    /** Annual insurance, repairs budget, and anything else recurring. */
    readonly annualOtherCosts?: Money;
    /** Agency fee on purchase, typically ~1% in Hong Kong. */
    readonly agencyFee?: Money;
    /** Legal fees on purchase. */
    readonly legalFees?: Money;
    /** Expected vacancy as a fraction of the year, e.g. 0.04 for two weeks. */
    readonly vacancyRate?: number;
  };

  // --- financing, optional: a cash purchase is valid ---
  readonly financing?: {
    readonly loanAmount: Money;
    readonly annualInterestRate: number;
    readonly termYears: number;
  };
}

export type Severity = "info" | "warning" | "critical";

export interface Finding {
  readonly id: string;
  readonly severity: Severity;
  readonly title: string;
  readonly detail: string;
}

export interface Verdict {
  readonly currency: Currency;
  readonly rulesUsed: string;
  readonly sources: readonly string[];

  /** One-off costs to acquire. */
  readonly acquisition: {
    readonly price: Money;
    readonly stampDuty: Money;
    readonly stampDutyScale: string;
    readonly agencyFee: Money;
    readonly legalFees: Money;
    readonly total: Money;
  };

  /** Annual operating picture. */
  readonly annual: {
    readonly grossRent: Money;
    readonly vacancyLoss: Money;
    readonly effectiveRent: Money;
    readonly managementFees: Money;
    readonly governmentRates: Money;
    readonly otherCosts: Money;
    readonly rentalIncomeTax: Money;
    readonly mortgageInterest: Money;
    readonly netIncome: Money;
  };

  readonly returns: {
    /** Gross rent ÷ price. */
    readonly grossYield: number | null;
    /** Net income before financing ÷ total cash to acquire. */
    readonly netYield: number | null;
    /** Net income after financing ÷ cash actually invested. */
    readonly cashOnCash: number | null;
    /** Years of net income to recover the cash invested. */
    readonly paybackYears: number | null;
  };

  readonly capitalGains: {
    readonly taxed: boolean;
    readonly note: string;
  };

  readonly findings: readonly Finding[];
}

function pickRules(
  ruleSets: readonly JurisdictionRules[],
  date: IsoDate,
): JurisdictionRules {
  // Latest rule set whose effectiveFrom is on or before the transaction date.
  const applicable = ruleSets
    .filter((r) => date >= r.meta.effectiveFrom)
    .filter((r) => r.meta.effectiveTo === null || date < r.meta.effectiveTo)
    .sort((a, b) => (a.meta.effectiveFrom < b.meta.effectiveFrom ? 1 : -1));

  const chosen = applicable[0];
  if (chosen === undefined) {
    throw new Error(`No rule set covers transaction date ${date}`);
  }
  return chosen;
}

/** Level payment on an amortising loan, per year. */
function annualMortgagePayment(
  principal: Money,
  annualRate: number,
  termYears: number,
): Money {
  if (termYears <= 0) throw new Error("Mortgage term must be positive");
  if (annualRate === 0) {
    return scale(principal, 1 / termYears);
  }
  const r = annualRate / 12;
  const n = termYears * 12;
  const monthly = (principal.amount * r) / (1 - Math.pow(1 + r, -n));
  return minor(Math.round(monthly * 12), principal.currency);
}

/** First-year interest, which is what a yield calculation should charge. */
function firstYearInterest(principal: Money, annualRate: number): Money {
  return scale(principal, annualRate);
}

export function computeVerdict(
  input: PropertyInput,
  ruleSets: readonly JurisdictionRules[],
): Verdict {
  const cur = input.currency;
  const rules = pickRules(ruleSets, input.transactionDate);

  if (rules.meta.currency !== cur) {
    throw new Error(
      `Rule set is denominated in ${rules.meta.currency} but the property is in ${cur}`,
    );
  }

  // ---- stamp duty: which scale applies ----
  const qualifiesForConcession =
    input.buyer.isPermanentResident &&
    !input.buyer.ownsOtherResidentialProperty &&
    !input.buyer.purchasingViaCompany;

  const scaleUsed = qualifiesForConcession
    ? rules.stampDuty.firstTimeResident
    : rules.stampDuty.other;
  const stampDuty = evaluateScale(scaleUsed, input.price);

  const agencyFee = input.costs.agencyFee ?? zero(cur);
  const legalFees = input.costs.legalFees ?? zero(cur);
  const acquisitionTotal = sum([input.price, stampDuty, agencyFee, legalFees], cur);

  // ---- annual operating ----
  const grossRent = scale(input.monthlyRent, 12);
  const vacancyRate = input.costs.vacancyRate ?? 0;
  const vacancyLoss = scale(grossRent, vacancyRate);
  const effectiveRent = sub(grossRent, vacancyLoss);

  const managementFees = input.costs.monthlyManagementFee
    ? scale(input.costs.monthlyManagementFee, 12)
    : zero(cur);

  // Government rates are charged on rateable value. If the user hasn't supplied one,
  // fall back to annual rent as a proxy — that is what rateable value approximates —
  // and say so in the findings rather than hiding the assumption.
  const rateableValue = input.costs.rateableValue ?? grossRent;
  const governmentRates =
    rules.annualRates && input.costs.ownerPaysRates
      ? scale(rateableValue, rules.annualRates.rate)
      : zero(cur);

  const otherCosts = input.costs.annualOtherCosts ?? zero(cur);

  // ---- rental income tax ----
  // NAV = effective rent − rates paid by owner − notional allowance on the remainder.
  const tax = rules.rentalIncomeTax;
  const beforeAllowance = tax.ratesDeductibleBeforeAllowance
    ? sub(effectiveRent, governmentRates)
    : effectiveRent;
  const netAssessableValue = scale(beforeAllowance, 1 - tax.notionalAllowance);
  const rentalIncomeTax = scale(netAssessableValue, tax.standardRate);

  const mortgageInterest = input.financing
    ? firstYearInterest(input.financing.loanAmount, input.financing.annualInterestRate)
    : zero(cur);

  const operatingCosts = sum(
    [managementFees, governmentRates, otherCosts, rentalIncomeTax],
    cur,
  );
  const netBeforeFinancing = sub(effectiveRent, operatingCosts);
  const netIncome = sub(netBeforeFinancing, mortgageInterest);

  // ---- returns ----
  const cashInvested = input.financing
    ? sub(acquisitionTotal, input.financing.loanAmount)
    : acquisitionTotal;

  const grossYield = ratio(grossRent, input.price);
  const netYield = ratio(netBeforeFinancing, acquisitionTotal);
  const cashOnCash = cashInvested.amount > 0 ? ratio(netIncome, cashInvested) : null;
  const paybackYears =
    netIncome.amount > 0 && cashInvested.amount > 0
      ? cashInvested.amount / netIncome.amount
      : null;

  // ---- findings: the "potential problems" half of the verdict ----
  const findings: Finding[] = [];

  if (!qualifiesForConcession) {
    findings.push({
      id: "stamp-duty-full-rate",
      severity: "critical",
      title: `Stamp duty at the full rate: ${scaleUsed.label}`,
      detail:
        "You do not qualify for the first-time-buyer concession, so duty is charged on the whole consideration rather than the concessionary scale. This is often the single largest avoidable cost in the transaction — check whether the purchase can be structured to qualify before committing.",
    });
  }

  if (netIncome.amount < 0) {
    findings.push({
      id: "negative-cashflow",
      severity: "critical",
      title: "The property loses money every year",
      detail:
        "After costs, tax and financing, net income is negative. The investment only works if capital appreciation covers the shortfall — which is a bet on the market, not a yield.",
    });
  }

  if (grossYield !== null && grossYield < 0.025) {
    findings.push({
      id: "low-gross-yield",
      severity: "warning",
      title: "Gross yield is very low",
      detail:
        "Below roughly 2.5% gross, rental income barely covers holding costs. Hong Kong yields are structurally low, so this may be normal for the district — compare against the RVD yield series for the same Class before concluding.",
    });
  }

  if (input.financing) {
    const payment = annualMortgagePayment(
      input.financing.loanAmount,
      input.financing.annualInterestRate,
      input.financing.termYears,
    );
    if (compare(payment, effectiveRent) > 0) {
      findings.push({
        id: "debt-service-exceeds-rent",
        severity: "critical",
        title: "Mortgage payments exceed the rent",
        detail:
          "The full mortgage payment is larger than the effective rent, so the property cannot service its own debt. You will fund the gap from other income every month.",
      });
    }
    const ltv = ratio(input.financing.loanAmount, input.price);
    if (ltv !== null && ltv > 0.7) {
      findings.push({
        id: "high-ltv",
        severity: "warning",
        title: `Loan-to-value is ${(ltv * 100).toFixed(0)}%`,
        detail:
          "High leverage magnifies both return and loss. Hong Kong LTV caps depend on property value and whether it is owner-occupied — confirm the mortgage is actually available at this level.",
      });
    }
  }

  if (vacancyRate === 0) {
    findings.push({
      id: "no-vacancy-assumed",
      severity: "warning",
      title: "No vacancy assumed",
      detail:
        "The calculation assumes the property is let every day of the year. Even a strong market turns over tenants; a few weeks empty changes the yield materially.",
    });
  }

  if (input.costs.rateableValue === undefined && input.costs.ownerPaysRates) {
    findings.push({
      id: "rateable-value-estimated",
      severity: "info",
      title: "Government rates estimated from rent",
      detail:
        "You did not supply a rateable value, so annual rent was used as a proxy. The real figure comes from the Rating and Valuation Department and will differ.",
    });
  }

  if (isZero(agencyFee) && isZero(legalFees)) {
    findings.push({
      id: "no-transaction-costs",
      severity: "warning",
      title: "No agency or legal fees included",
      detail:
        "Transaction costs are missing, so the cash needed to acquire is understated. In Hong Kong, budget roughly 1% agency commission plus solicitor's fees.",
    });
  }

  if (!rules.capitalGains.applies) {
    findings.push({
      id: "cgt-trading-risk",
      severity: "info",
      title: "No capital gains tax — but watch the trading test",
      detail: rules.capitalGains.note ?? "",
    });
  }

  for (const caveat of rules.meta.caveats ?? []) {
    findings.push({
      id: "rule-caveat",
      severity: "info",
      title: "Rule caveat",
      detail: caveat,
    });
  }

  const severityRank: Record<Severity, number> = { critical: 0, warning: 1, info: 2 };
  findings.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);

  return {
    currency: cur,
    rulesUsed: `${rules.meta.jurisdiction} rules effective ${rules.meta.effectiveFrom}`,
    sources: rules.meta.sources,
    acquisition: {
      price: input.price,
      stampDuty,
      stampDutyScale: scaleUsed.label,
      agencyFee,
      legalFees,
      total: acquisitionTotal,
    },
    annual: {
      grossRent,
      vacancyLoss,
      effectiveRent,
      managementFees,
      governmentRates,
      otherCosts,
      rentalIncomeTax,
      mortgageInterest,
      netIncome,
    },
    returns: { grossYield, netYield, cashOnCash, paybackYears },
    capitalGains: {
      taxed: rules.capitalGains.applies,
      note: rules.capitalGains.note ?? "",
    },
    findings,
  };
}

export { add, money, minor, sub, scale, sum, zero };
