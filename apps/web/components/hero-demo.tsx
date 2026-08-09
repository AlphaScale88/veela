"use client";

import { computeVerdict, HK_RULE_SETS, money, scale, type Verdict } from "@veela/core";
import {
  formatCompactMoney,
  formatPercent,
  formatYears,
  gradeNetYield,
  severityColor,
  severityLabel,
  standingColor,
} from "@veela/ui";
import Link from "next/link";
import { useMemo, useState } from "react";

/**
 * The hero, and the one place this page spends its boldness.
 *
 * It is not a screenshot or a mocked-up panel — it runs `computeVerdict` from
 * `@veela/core` in the browser, against the same dated Hong Kong rule sets the API
 * uses. `packages/core` has no runtime dependencies, which is what makes that possible
 * and is the reason the engine was built that way.
 *
 * That matters more than it looks: the claim this product makes is "the arithmetic is
 * real and the rules are sourced", and a hero that actually computes is the only
 * version of that claim a visitor can check in the first ten seconds.
 *
 * The transaction date is a fixed constant rather than today's date, so the server and
 * client render identical markup and the rule set on show can never silently change
 * underneath the copy that names it.
 */

const DEMO_DATE = "2026-08-01";

/** The rest of the flat, held still so the two sliders are the only variables. */
const FIXED = {
  saleableAreaSqft: 500,
  managementFee: 1_200,
  otherCosts: 10_000,
  agencyFee: 80_000,
  legalFees: 15_000,
  vacancyRate: 0.04,
} as const;

export function HeroDemo(): React.JSX.Element {
  const [price, setPrice] = useState(8_000_000);
  const [rent, setRent] = useState(18_000);
  const [ownsOther, setOwnsOther] = useState(false);

  const verdict = useMemo<Verdict | null>(() => {
    try {
      return computeVerdict(
        {
          currency: "HKD",
          price: money(price, "HKD"),
          monthlyRent: money(rent, "HKD"),
          saleableAreaSqft: FIXED.saleableAreaSqft,
          transactionDate: DEMO_DATE,
          buyer: {
            isPermanentResident: true,
            ownsOtherResidentialProperty: ownsOther,
            purchasingViaCompany: false,
          },
          costs: {
            monthlyManagementFee: money(FIXED.managementFee, "HKD"),
            ownerPaysRates: true,
            annualOtherCosts: money(FIXED.otherCosts, "HKD"),
            agencyFee: money(FIXED.agencyFee, "HKD"),
            legalFees: money(FIXED.legalFees, "HKD"),
            vacancyRate: FIXED.vacancyRate,
          },
        },
        HK_RULE_SETS,
      );
    } catch {
      return null;
    }
  }, [price, rent, ownsOther]);

  if (verdict === null) {
    return (
      <div className="rounded-panel border border-line bg-surface p-6 text-sm text-muted">
        Those figures fall outside the modelled rules. Move the sliders back.
      </div>
    );
  }

  const standing = gradeNetYield(verdict.returns.netYield);
  const worst =
    verdict.findings.find((f) => f.severity === "critical") ??
    verdict.findings.find((f) => f.severity === "warning") ??
    verdict.findings[0];

  return (
    <div className="settle overflow-hidden rounded-panel border border-line bg-surface shadow-lift">
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
        <span className="eyebrow">Computed in your browser</span>
        <span className="font-mono text-[11px] text-muted">{verdict.rulesUsed}</span>
      </div>

      <div className="space-y-5 px-5 py-5">
        <Slider
          label="Purchase price"
          value={price}
          min={2_000_000}
          max={30_000_000}
          step={100_000}
          onChange={setPrice}
          display={formatCompactMoney(money(price, "HKD"))}
        />
        <Slider
          label="Monthly rent"
          value={rent}
          min={6_000}
          max={90_000}
          step={500}
          onChange={setRent}
          display={formatCompactMoney(money(rent, "HKD"))}
        />

        <label className="flex cursor-pointer items-start gap-2.5 rounded-card bg-surfaceMuted px-3.5 py-2.5 text-sm">
          <input
            type="checkbox"
            checked={ownsOther}
            onChange={(e) => setOwnsOther(e.target.checked)}
            className="mt-0.5 size-4 accent-accent"
          />
          <span>
            I already own residential property
            <span className="mt-0.5 block text-xs leading-snug text-muted">
              Moves you off the concessionary stamp duty scale. Watch what it does to the
              cash you need.
            </span>
          </span>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-px border-y border-line bg-line sm:grid-cols-4">
        <Figure
          label="Net yield"
          value={formatPercent(verdict.returns.netYield)}
          color={standingColor[standing]}
          emphasis
        />
        <Figure label="Gross yield" value={formatPercent(verdict.returns.grossYield)} />
        <Figure
          label="Stamp duty"
          value={formatCompactMoney(verdict.acquisition.stampDuty)}
        />
        <Figure label="Payback" value={formatYears(verdict.returns.paybackYears)} />
        <Figure label="Cash to acquire" value={formatCompactMoney(verdict.acquisition.total)} />
        <Figure label="Net income / yr" value={formatCompactMoney(verdict.annual.netIncome)} />
        <Figure
          label="Price / sqft"
          value={formatCompactMoney(scale(verdict.acquisition.price, 1 / FIXED.saleableAreaSqft))}
        />
        <Figure label="Rental tax / yr" value={formatCompactMoney(verdict.annual.rentalIncomeTax)} />
      </div>

      {worst !== undefined && (
        <div className="flex items-start gap-3 px-5 py-4">
          <span
            className="mt-0.5 shrink-0 rounded border px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.08em]"
            style={{
              color: severityColor[worst.severity],
              borderColor: severityColor[worst.severity],
            }}
          >
            {severityLabel[worst.severity]}
          </span>
          <p className="text-sm leading-relaxed">
            <span className="font-medium">{worst.title}.</span>{" "}
            <span className="text-muted">{worst.detail}</span>
          </p>
        </div>
      )}

      <div className="border-t border-line bg-surfaceMuted px-5 py-3.5">
        <Link
          href="/analyse"
          className="text-sm font-medium text-accent hover:underline"
        >
          Analyse your own figures →
        </Link>
      </div>
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  display,
}: {
  readonly label: string;
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly onChange: (v: number) => void;
  readonly display: string;
}): React.JSX.Element {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between gap-3">
        <span className="text-sm text-muted">{label}</span>
        <span className="tnum font-mono text-sm font-medium">{display}</span>
      </span>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full accent-accent"
        aria-label={label}
      />
    </label>
  );
}

function Figure({
  label,
  value,
  color,
  emphasis = false,
}: {
  readonly label: string;
  readonly value: string;
  readonly color?: string;
  readonly emphasis?: boolean;
}): React.JSX.Element {
  return (
    <div className="bg-surface px-4 py-3.5">
      <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
        {label}
      </div>
      <div
        className={`tnum mt-1 font-display font-semibold tracking-[-0.02em] ${
          emphasis ? "text-[26px]" : "text-[20px]"
        }`}
        style={color !== undefined ? { color } : undefined}
      >
        {value}
      </div>
    </div>
  );
}
