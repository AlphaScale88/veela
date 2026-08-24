import assert from "node:assert/strict";
import { test } from "node:test";

import { money, toMajor } from "./money.js";
import { HK_RULE_SETS } from "./rules/hk.js";
import { computeVerdict, type PropertyInput } from "./verdict.js";

/** A realistic Hong Kong flat: HK$8M, HK$18,000/month. */
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
    costs: {
      monthlyManagementFee: money(1_200, "HKD"),
      ownerPaysRates: true,
      annualOtherCosts: money(10_000, "HKD"),
      agencyFee: money(80_000, "HKD"),
      legalFees: money(15_000, "HKD"),
      vacancyRate: 0.04,
    },
    ...overrides,
  };
}

/** The same flat bought before the cooling measures went, when the buyer's profile still mattered. */
const IN_2023 = { transactionDate: "2023-06-15" } as const;

test("HK$8M sits in the 3.00% band, whoever the buyer is today", () => {
  const v = computeVerdict(baseInput(), HK_RULE_SETS);
  assert.equal(toMajor(v.acquisition.stampDuty), 240_000);
  assert.match(v.acquisition.stampDutyScale, /Scale 2/);
});

/**
 * Since 28/02/2024 residency and existing holdings stop changing the duty: the IRD
 * publishes one column for "Scale 2 or Part 1 of Scale 1". Charging the old flat 15%
 * to a second-property buyer would overstate the duty fivefold, so all three buyer
 * profiles are pinned to the same number.
 */
test("today, owning another property or buying via a company costs the same duty", () => {
  const profiles = [
    { isPermanentResident: true, ownsOtherResidentialProperty: true, purchasingViaCompany: false },
    { isPermanentResident: false, ownsOtherResidentialProperty: false, purchasingViaCompany: false },
    { isPermanentResident: true, ownsOtherResidentialProperty: false, purchasingViaCompany: true },
  ];
  for (const buyer of profiles) {
    const v = computeVerdict(baseInput({ buyer }), HK_RULE_SETS);
    assert.equal(toMajor(v.acquisition.stampDuty), 240_000, JSON.stringify(buyer));
    assert.equal(toMajor(v.acquisition.buyerStampDuty), 0, "BSD was abolished on 28/02/2024");
    assert.equal(
      v.findings.find((f) => f.id === "stamp-duty-full-rate"),
      undefined,
      "there is no concession to lose, so nothing should claim there is",
    );
  }
});

test("in 2023, owning another property triggered the flat 15% and a critical finding", () => {
  const v = computeVerdict(
    baseInput({
      ...IN_2023,
      buyer: {
        isPermanentResident: true,
        ownsOtherResidentialProperty: true,
        purchasingViaCompany: false,
      },
    }),
    HK_RULE_SETS,
  );
  assert.equal(toMajor(v.acquisition.stampDuty), 1_200_000);
  const finding = v.findings.find((f) => f.id === "stamp-duty-full-rate");
  assert.ok(finding, "expected a stamp duty finding");
  assert.equal(finding.severity, "critical");
});

/**
 * A non-permanent resident buying in 2023 paid AVD at the flat 15% *and* 15% BSD on
 * top — HK$2.4M on an HK$8M flat, against HK$240k for the same purchase today. Getting
 * this wrong is the reason the historical rule sets exist at all.
 */
test("in 2023 a non-permanent resident also paid 15% Buyer's Stamp Duty", () => {
  const v = computeVerdict(
    baseInput({
      ...IN_2023,
      buyer: {
        isPermanentResident: false,
        ownsOtherResidentialProperty: false,
        purchasingViaCompany: false,
      },
    }),
    HK_RULE_SETS,
  );
  assert.equal(toMajor(v.acquisition.stampDuty), 1_200_000);
  assert.equal(toMajor(v.acquisition.buyerStampDuty), 1_200_000);
  assert.ok(v.findings.some((f) => f.id === "buyer-stamp-duty"));
});

test("BSD halved to 7.5% between 25/10/2023 and 28/02/2024", () => {
  const v = computeVerdict(
    baseInput({
      transactionDate: "2023-12-01",
      buyer: {
        isPermanentResident: false,
        ownsOtherResidentialProperty: false,
        purchasingViaCompany: false,
      },
    }),
    HK_RULE_SETS,
  );
  assert.equal(toMajor(v.acquisition.buyerStampDuty), 600_000);
  assert.equal(toMajor(v.acquisition.stampDuty), 600_000, "AVD Part 1 of Scale 1 halved too");
});

/** The 2025 Budget raised the fixed HK$100 band, and only that. */
test("an HK$3.5M flat pays HK$100 in 2025 but not in 2024", () => {
  const cheap = { price: money(3_500_000, "HKD") } as const;
  const in2024 = computeVerdict(
    baseInput({ ...cheap, transactionDate: "2024-06-01" }),
    HK_RULE_SETS,
  );
  const in2025 = computeVerdict(
    baseInput({ ...cheap, transactionDate: "2025-06-01" }),
    HK_RULE_SETS,
  );
  assert.ok(toMajor(in2024.acquisition.stampDuty) > 100);
  assert.equal(toMajor(in2025.acquisition.stampDuty), 100);
});

test("gross yield is rent over price, ignoring costs", () => {
  const v = computeVerdict(baseInput(), HK_RULE_SETS);
  // 18,000 × 12 / 8,000,000 = 2.7%
  assert.ok(v.returns.grossYield !== null);
  assert.ok(Math.abs(v.returns.grossYield - 0.027) < 1e-9);
});

test("property tax follows NAV = (rent − rates) × 80% × 15%", () => {
  const v = computeVerdict(baseInput({ costs: { ...baseInput().costs, vacancyRate: 0 } }), HK_RULE_SETS);
  const grossRent = 18_000 * 12; // 216,000
  const rates = grossRent * 0.05; // rateable value proxied by rent → 10,800
  const expected = (grossRent - rates) * 0.8 * 0.15;
  assert.equal(toMajor(v.annual.rentalIncomeTax), Math.round(expected));
});

test("acquisition total is price plus duty plus fees", () => {
  const v = computeVerdict(baseInput(), HK_RULE_SETS);
  assert.equal(
    toMajor(v.acquisition.total),
    8_000_000 + 240_000 + 80_000 + 15_000,
  );
});

test("a cash purchase has no mortgage interest and no cash-on-cash gap", () => {
  const v = computeVerdict(baseInput(), HK_RULE_SETS);
  assert.equal(toMajor(v.annual.mortgageInterest), 0);
  assert.ok(v.returns.netYield !== null);
  assert.ok(v.returns.cashOnCash !== null);
  // With no debt, cash-on-cash equals net yield.
  assert.ok(Math.abs(v.returns.netYield - v.returns.cashOnCash) < 1e-9);
});

test("leverage raises cash-on-cash above net yield when rent covers interest", () => {
  const v = computeVerdict(
    baseInput({
      financing: {
        loanAmount: money(4_000_000, "HKD"),
        annualInterestRate: 0.03,
        termYears: 25,
      },
    }),
    HK_RULE_SETS,
  );
  assert.equal(toMajor(v.annual.mortgageInterest), 120_000);
  assert.ok(v.returns.cashOnCash !== null && v.returns.netYield !== null);
});

test("debt service exceeding rent is flagged as critical", () => {
  const v = computeVerdict(
    baseInput({
      financing: {
        loanAmount: money(7_000_000, "HKD"),
        annualInterestRate: 0.08,
        termYears: 10,
      },
    }),
    HK_RULE_SETS,
  );
  const finding = v.findings.find((f) => f.id === "debt-service-exceeds-rent");
  assert.ok(finding, "expected debt service finding");
  assert.equal(finding.severity, "critical");
});

test("assuming zero vacancy is flagged", () => {
  const v = computeVerdict(
    baseInput({ costs: { ...baseInput().costs, vacancyRate: 0 } }),
    HK_RULE_SETS,
  );
  assert.ok(v.findings.some((f) => f.id === "no-vacancy-assumed"));
});

test("missing transaction costs are flagged", () => {
  const v = computeVerdict(
    baseInput({ costs: { ownerPaysRates: true, vacancyRate: 0.04 } }),
    HK_RULE_SETS,
  );
  assert.ok(v.findings.some((f) => f.id === "no-transaction-costs"));
});

test("findings are ordered with critical first", () => {
  const v = computeVerdict(
    baseInput({
      buyer: {
        isPermanentResident: false,
        ownsOtherResidentialProperty: true,
        purchasingViaCompany: false,
      },
    }),
    HK_RULE_SETS,
  );
  const rank = { critical: 0, warning: 1, info: 2 } as const;
  for (let i = 1; i < v.findings.length; i += 1) {
    const prev = v.findings[i - 1];
    const cur = v.findings[i];
    assert.ok(prev !== undefined && cur !== undefined);
    assert.ok(rank[prev.severity] <= rank[cur.severity]);
  }
});

test("Hong Kong reports no capital gains tax but flags the trading test", () => {
  const v = computeVerdict(baseInput(), HK_RULE_SETS);
  assert.equal(v.capitalGains.taxed, false);
  assert.ok(v.findings.some((f) => f.id === "cgt-trading-risk"));
});

test("a transaction dated before any rule set is rejected loudly", () => {
  assert.throws(
    () => computeVerdict(baseInput({ transactionDate: "2019-01-01" }), HK_RULE_SETS),
    /No rule set covers/,
  );
});

test("the verdict cites the rules and sources it used", () => {
  const v = computeVerdict(baseInput(), HK_RULE_SETS);
  assert.match(v.rulesUsed, /HK rules effective 2026-02-26/);
  assert.ok(v.sources.length > 0);
});
