"use client";

import { money, type PropertyInput } from "@veela/core";
import { estimateMonthlyRent } from "@veela/fixtures";
import type { CreatePropertyInput } from "@veela/types";
import type { ReactNode } from "react";

/**
 * The whole input surface of the product. Kept to one screen on purpose: if evaluating
 * a property takes a long form, nobody does it twice, and the daily-use goal dies.
 *
 * The fields are **controlled** rather than read out of a `FormData` on submit, because
 * the summary rail beside them recomputes on every keystroke. That live feedback is the
 * point — a stamp duty figure that moves the instant you tick "I already own property"
 * teaches the rule far better than a number that only appears after a round trip.
 *
 * Money is entered in major units (dollars) and converted to minor units (cents) at the
 * boundary — the engine and the database only ever see integers.
 */

const HKD_CENTS = 100;

export interface Draft {
  readonly label: string;
  readonly price: number;
  readonly monthlyRent: number;
  readonly saleableAreaSqft: number;
  readonly transactionDate: string;
  readonly isPermanentResident: boolean;
  readonly ownsOtherResidentialProperty: boolean;
  readonly purchasingViaCompany: boolean;
  readonly monthlyManagementFee: number;
  readonly annualOtherCosts: number;
  readonly agencyFee: number;
  readonly legalFees: number;
  readonly vacancyRate: number;
  readonly ownerPaysRates: boolean;
  readonly loanAmount: number;
  readonly annualInterestRate: number;
  readonly termYears: number;
}

/**
 * The form's starting state: **blank, not a worked example.**
 *
 * This used to be `INITIAL_DRAFT` — "Flat in Tai Koo", HK$8,000,000, HK$18,000 rent, 500 sqft,
 * a HK$4,000,000 mortgage — and it was the first thing a reader saw on `/analyse`. Three
 * problems with that, and the third is the one that matters:
 *
 *  1. Every figure was invented, sitting in fields labelled as *your* property's.
 *  2. `transactionDate` was hardcoded to a fixed day and had already gone stale, so the
 *     stamp-duty rule set was picked by a date nobody chose.
 *  3. **A prefilled form produces a complete, plausible report before the reader has typed
 *     anything** — a 1.78% net yield for a flat that does not exist. Everywhere else this
 *     product refuses to show a number it cannot source; the landing state of its main tool
 *     was doing exactly that.
 *
 * ## What is blank and what is not
 *
 * **Blank: facts about the property and the deal** — label, price, rent, area, the loan, and
 * every cash cost. Nobody can guess these, and a guess here is the invented-figure problem
 * again.
 *
 * **Kept: rate assumptions with defensible market defaults** — 4% vacancy, 3% interest, a
 * 25-year term, owner pays rates, buyer is a permanent resident. These are not claims about
 * *this* property; they are the conventions the engine needs to compute anything at all, they
 * are all editable, and the report already names each one in "What to watch" (the
 * "No vacancy assumed" finding exists precisely to flag one of them). Zeroing them would be
 * the opposite failure: a 0% vacancy rate and a 0% interest rate are *wrong*, not empty.
 *
 * `transactionDate` is blank here and filled with today's date on mount — see the effect in
 * `app/analyse/page.tsx`. Deliberately not `new Date()` at module scope: this is a client
 * component that Next.js also renders on the server, and a server in UTC against a browser in
 * Hong Kong can disagree about what day it is, which is a hydration mismatch.
 */
export const EMPTY_DRAFT: Draft = {
  label: "",
  price: 0,
  monthlyRent: 0,
  saleableAreaSqft: 0,
  transactionDate: "",
  isPermanentResident: true,
  ownsOtherResidentialProperty: false,
  purchasingViaCompany: false,
  monthlyManagementFee: 0,
  annualOtherCosts: 0,
  agencyFee: 0,
  legalFees: 0,
  vacancyRate: 4,
  ownerPaysRates: true,
  loanAmount: 0,
  annualInterestRate: 3,
  termYears: 25,
};

/** The API contract: minor units, jurisdiction-tagged, validated by Zod on both ends. */
export function draftToApiInput(d: Draft): CreatePropertyInput {
  const cents = (v: number): number => Math.round(v * HKD_CENTS);

  return {
    label: d.label,
    jurisdiction: "HK",
    currency: "HKD",
    priceMinor: cents(d.price),
    monthlyRentMinor: cents(d.monthlyRent),
    transactionDate: d.transactionDate,
    monitored: false,
    ...(d.saleableAreaSqft > 0 && { saleableAreaSqft: d.saleableAreaSqft }),
    buyer: {
      isPermanentResident: d.isPermanentResident,
      ownsOtherResidentialProperty: d.ownsOtherResidentialProperty,
      purchasingViaCompany: d.purchasingViaCompany,
    },
    costs: {
      ownerPaysRates: d.ownerPaysRates,
      monthlyManagementFeeMinor: cents(d.monthlyManagementFee),
      annualOtherCostsMinor: cents(d.annualOtherCosts),
      agencyFeeMinor: cents(d.agencyFee),
      legalFeesMinor: cents(d.legalFees),
      vacancyRate: d.vacancyRate / 100,
    },
    ...(d.loanAmount > 0 && {
      financing: {
        loanAmountMinor: cents(d.loanAmount),
        annualInterestRate: d.annualInterestRate / 100,
        termYears: d.termYears,
      },
    }),
  };
}

/**
 * The same figures shaped for the engine directly, for the live rail. This is the same
 * `computeVerdict` the API calls, so the preview and the submitted report cannot
 * disagree — only the validation layer differs.
 */
export function draftToCoreInput(d: Draft): PropertyInput {
  return {
    currency: "HKD",
    price: money(d.price, "HKD"),
    monthlyRent: money(d.monthlyRent, "HKD"),
    ...(d.saleableAreaSqft > 0 && { saleableAreaSqft: d.saleableAreaSqft }),
    transactionDate: d.transactionDate,
    buyer: {
      isPermanentResident: d.isPermanentResident,
      ownsOtherResidentialProperty: d.ownsOtherResidentialProperty,
      purchasingViaCompany: d.purchasingViaCompany,
    },
    costs: {
      monthlyManagementFee: money(d.monthlyManagementFee, "HKD"),
      ownerPaysRates: d.ownerPaysRates,
      annualOtherCosts: money(d.annualOtherCosts, "HKD"),
      agencyFee: money(d.agencyFee, "HKD"),
      legalFees: money(d.legalFees, "HKD"),
      vacancyRate: d.vacancyRate / 100,
    },
    ...(d.loanAmount > 0 && {
      financing: {
        loanAmount: money(d.loanAmount, "HKD"),
        annualInterestRate: d.annualInterestRate / 100,
        termYears: d.termYears,
      },
    }),
  };
}

interface Props {
  readonly draft: Draft;
  readonly onChange: (patch: Partial<Draft>) => void;
  readonly onSubmit: () => void;
  readonly pending: boolean;
  readonly error: string | null;
  /** Applying the RVD estimate goes through its own callback rather than `onChange`, so the
   *  page can remember the rent was estimated and label it as such — and can clear that flag
   *  the moment the reader types over it. */
  readonly onUseRentEstimate: (monthlyRent: number) => void;
}

/**
 * Offered only when there is a **price and an area but no rent** — the exact state a for-sale
 * listing import leaves behind, since sale listings publish no rent and the report then shows
 * a 0.00% yield that reads as a verdict rather than a gap.
 *
 * Shows its whole derivation on the face of it: the Class, the yield, the month. That is the
 * condition this codebase attaches to every estimate — a number a reader can check and argue
 * with, not one that appears from nowhere. It fills the field but never submits, and typing
 * over it clears the estimated flag.
 */
function RentEstimateHint({
  draft,
  onUse,
}: {
  readonly draft: Draft;
  readonly onUse: (monthlyRent: number) => void;
}): React.JSX.Element | null {
  if (draft.monthlyRent > 0 || draft.price <= 0) return null;

  const estimate = estimateMonthlyRent(draft.price, draft.saleableAreaSqft);
  if (estimate === null) {
    // Price but no area: RVD's Classes are defined by area, so there is no defensible band to
    // read a yield from. Say what is missing instead of guessing at the middle of the range.
    return (
      <p className="mt-1.5 text-xs leading-relaxed text-muted">
        No rent yet — a yield needs one. Add the <strong className="text-mist">saleable area</strong>{" "}
        and we can estimate it from the government&apos;s own market yields.
      </p>
    );
  }

  return (
    <div className="mt-1.5 rounded-card border border-accent/30 bg-accent/[0.04] px-3 py-2.5">
      <p className="text-xs leading-relaxed text-mist">
        No rent on this listing. The Rating and Valuation Department&apos;s market yield for{" "}
        <strong className="font-medium">{estimate.classLabel}</strong> is{" "}
        <strong className="font-medium">{estimate.grossYieldPct}%</strong> ({estimate.period.slice(0, 7)}),
        which implies about{" "}
        <strong className="font-medium">
          HK${estimate.monthlyRentHkd.toLocaleString("en-HK")}/month
        </strong>
        .
      </p>
      <button
        type="button"
        onClick={() => onUse(estimate.monthlyRentHkd)}
        className="btn-secondary mt-2 !px-3 !py-1.5 !text-xs"
      >
        Use this estimate
      </button>
      <p className="mt-2 text-[11px] leading-relaxed text-muted">
        A territory-wide figure for flats of this size, not a valuation of this one — RVD
        publishes no per-district domestic series. Treat it as a starting point and replace it
        with a real asking rent when you have one.
      </p>
    </div>
  );
}

export function PropertyForm({
  draft,
  onChange,
  onSubmit,
  pending,
  error,
  onUseRentEstimate,
}: Props): React.JSX.Element {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="space-y-5"
    >
      <Section legend="The property" hint="What you are buying">
        <Field
          label="Label"
          value={draft.label}
          onChange={(v) => onChange({ label: v })}
          span
        />
        <Money
          label="Price"
          value={draft.price}
          onChange={(v) => onChange({ price: v })}
        />
        <Money
          label="Monthly rent"
          value={draft.monthlyRent}
          onChange={(v) => onChange({ monthlyRent: v })}
          below={<RentEstimateHint draft={draft} onUse={onUseRentEstimate} />}
        />
        <Num
          label="Saleable area"
          unit="sq ft"
          value={draft.saleableAreaSqft}
          blankWhenZero
          onChange={(v) => onChange({ saleableAreaSqft: v })}
          hint="Saleable, not gross — the two differ by roughly a quarter."
        />
        <Field
          label="Transaction date"
          type="date"
          value={draft.transactionDate}
          onChange={(v) => onChange({ transactionDate: v })}
          hint="Picks the rule set. Stamp duty has changed repeatedly."
        />
      </Section>

      <Section legend="You, the buyer" hint="This is what decides the stamp duty scale">
        <Check
          label="Hong Kong permanent resident"
          checked={draft.isPermanentResident}
          onChange={(v) => onChange({ isPermanentResident: v })}
        />
        <Check
          label="I already own residential property"
          checked={draft.ownsOtherResidentialProperty}
          onChange={(v) => onChange({ ownsOtherResidentialProperty: v })}
          hint="Owning another home moves you to the flat 15% scale — usually the biggest single cost in the deal."
        />
        <Check
          label="Buying through a company"
          checked={draft.purchasingViaCompany}
          onChange={(v) => onChange({ purchasingViaCompany: v })}
        />
      </Section>

      <Section legend="Running costs" hint="Annual unless stated">
        <Money
          label="Management fee"
          unit="per month"
          value={draft.monthlyManagementFee}
          onChange={(v) => onChange({ monthlyManagementFee: v })}
        />
        <Money
          label="Other annual costs"
          value={draft.annualOtherCosts}
          onChange={(v) => onChange({ annualOtherCosts: v })}
        />
        <Money
          label="Agency fee"
          value={draft.agencyFee}
          onChange={(v) => onChange({ agencyFee: v })}
        />
        <Money
          label="Legal fees"
          value={draft.legalFees}
          onChange={(v) => onChange({ legalFees: v })}
        />
        <Num
          label="Vacancy"
          unit="% of year"
          value={draft.vacancyRate}
          onChange={(v) => onChange({ vacancyRate: v })}
          hint="Assuming zero is the most common way to overstate a yield."
        />
        <Check
          label="I pay the government rates, not the tenant"
          checked={draft.ownerPaysRates}
          onChange={(v) => onChange({ ownerPaysRates: v })}
        />
      </Section>

      <Section legend="Financing" hint="Leave the loan at 0 for a cash purchase">
        <Money
          label="Loan amount"
          value={draft.loanAmount}
          onChange={(v) => onChange({ loanAmount: v })}
        />
        <Num
          label="Interest rate"
          unit="%"
          step="0.01"
          value={draft.annualInterestRate}
          onChange={(v) => onChange({ annualInterestRate: v })}
        />
        <Num
          label="Term"
          unit="years"
          value={draft.termYears}
          onChange={(v) => onChange({ termYears: v })}
        />
      </Section>

      {error !== null && (
        <p
          role="alert"
          className="rounded-card border border-negative/40 bg-negative/5 px-4 py-3 text-sm text-negative"
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="btn-primary w-full py-4 font-display text-[17px] disabled:pointer-events-none disabled:opacity-50"
      >
        {pending ? "Computing…" : "See the full report"}
      </button>
    </form>
  );
}

function Section({
  legend,
  hint,
  children,
}: {
  readonly legend: string;
  readonly hint: string;
  readonly children: ReactNode;
}): React.JSX.Element {
  return (
    <fieldset className="card">
      <legend className="float-left mb-3 w-full">
        <span className="font-display text-[17px] font-semibold tracking-[-0.02em]">
          {legend}
        </span>
        <span className="mt-0.5 block text-xs text-muted">{hint}</span>
      </legend>
      <div className="grid gap-4 clear-both sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

function Shell({
  label,
  unit,
  hint,
  span,
  children,
}: {
  readonly label: string;
  // These are forwarded straight from callers that may not set them, and the project
  // runs with `exactOptionalPropertyTypes`, so the `| undefined` is load-bearing.
  readonly unit?: string | undefined;
  readonly hint?: string | undefined;
  readonly span?: boolean | undefined;
  readonly children: ReactNode;
}): React.JSX.Element {
  return (
    <label className={`block ${span === true ? "sm:col-span-2" : ""}`}>
      <span className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium">{label}</span>
        {unit !== undefined && (
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
            {unit}
          </span>
        )}
      </span>
      {children}
      {hint !== undefined && (
        <span className="mt-1.5 block text-xs leading-snug text-muted">{hint}</span>
      )}
    </label>
  );
}

const INPUT =
  "tnum mt-1.5 w-full rounded-card border border-line bg-surfaceMuted px-3 py-2.5 text-[17px] outline-none transition-colors focus:border-accent focus:bg-surface";

function Field({
  label,
  value,
  onChange,
  type = "text",
  hint,
  span,
}: {
  readonly label: string;
  readonly value: string;
  readonly onChange: (v: string) => void;
  readonly type?: string;
  readonly hint?: string;
  readonly span?: boolean;
}): React.JSX.Element {
  return (
    <Shell label={label} hint={hint} span={span}>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={INPUT}
      />
    </Shell>
  );
}

function Num({
  label,
  value,
  onChange,
  unit,
  step,
  hint,
  blankWhenZero = false,
}: {
  readonly label: string;
  readonly value: number;
  readonly onChange: (v: number) => void;
  readonly unit?: string;
  readonly step?: string;
  readonly hint?: string;
  /**
   * Show an empty box instead of `0`. **Opt-in, and not the default, because zero means two
   * different things in this form.** For an area or a fee, `0` means "not entered" and a form
   * that starts blank should look blank rather than making the reader clear a zero. For a
   * *rate*, `0` can be a deliberate choice — a 0% vacancy assumption is a real input, and the
   * engine raises a "No vacancy assumed" finding about it — so blanking it would hide a
   * decision the reader actually made.
   */
  readonly blankWhenZero?: boolean;
}): React.JSX.Element {
  return (
    <Shell label={label} unit={unit} hint={hint}>
      <input
        type="number"
        // `Number("")` is 0, so clearing the box round-trips back to zero without extra work.
        value={blankWhenZero && value === 0 ? "" : value}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`${INPUT} font-mono`}
      />
    </Shell>
  );
}

/** A money field. The currency sits inside the control so the number stays a number. */
function Money({
  label,
  value,
  onChange,
  unit,
  below,
}: {
  readonly label: string;
  readonly value: number;
  readonly onChange: (v: number) => void;
  readonly unit?: string;
  /** Rendered under the control — used by "Monthly rent" for the RVD estimate offer. */
  readonly below?: ReactNode;
}): React.JSX.Element {
  return (
    <Shell label={label} unit={unit}>
      <span className="relative block">
        <span className="pointer-events-none absolute left-3 top-1/2 mt-[3px] -translate-y-1/2 font-mono text-sm text-muted">
          HK$
        </span>
        <input
          type="number"
          /* Money is always "not entered" at zero — no listing costs HK$0 and no rent is
             HK$0 — so an empty box is the honest rendering of an unfilled form. Same
             reasoning as `Num`'s `blankWhenZero`, which is opt-in because rates differ. */
          value={value === 0 ? "" : value}
          onChange={(e) => onChange(Number(e.target.value))}
          className={`${INPUT} pl-12 font-mono`}
        />
      </span>
      {below}
    </Shell>
  );
}

function Check({
  label,
  checked,
  onChange,
  hint,
}: {
  readonly label: string;
  readonly checked: boolean;
  readonly onChange: (v: boolean) => void;
  readonly hint?: string;
}): React.JSX.Element {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 rounded-card bg-surfaceMuted px-3.5 py-3 text-sm sm:col-span-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 shrink-0 accent-accent"
      />
      <span>
        {label}
        {hint !== undefined && (
          <span className="mt-0.5 block text-xs leading-snug text-muted">{hint}</span>
        )}
      </span>
    </label>
  );
}
