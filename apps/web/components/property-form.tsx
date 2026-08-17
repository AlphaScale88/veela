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

/**
 * Where a set of figures came from, when it came from a listing rather than a keyboard.
 *
 * Kept **out of `Draft`** deliberately. `Draft` is what the form edits and what the live
 * preview recomputes from; provenance is not editable, not a number, and changes nothing the
 * engine does. Threading it through the form would put a field in `Draft` that every
 * `EMPTY_DRAFT`, every restore and every equality check would have to carry for no benefit.
 * It rides alongside, at the one moment it matters — the save.
 */
export interface ListingProvenance {
  readonly sourceUrl?: string | undefined;
  readonly address?: string | undefined;
  readonly latitude?: number | undefined;
  readonly longitude?: number | undefined;
}

/** The API contract: minor units, jurisdiction-tagged, validated by Zod on both ends. */
export function draftToApiInput(d: Draft, source?: ListingProvenance): CreatePropertyInput {
  const cents = (v: number): number => Math.round(v * HKD_CENTS);

  return {
    /* Spread conditionally rather than assigning `undefined`: `exactOptionalPropertyTypes` is
       on, so `{ sourceUrl: undefined }` is not the same type as an absent key. */
    ...(source?.sourceUrl !== undefined && { sourceUrl: source.sourceUrl }),
    ...(source?.address !== undefined && { address: source.address }),
    ...(source?.latitude !== undefined && { latitude: source.latitude }),
    ...(source?.longitude !== undefined && { longitude: source.longitude }),
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

/**
 * Turning a Zod failure into something a reader can act on.
 *
 * The form used to print `parsed.error.issues` verbatim, which produced
 * *"label: String must contain at least 1 character(s); priceMinor: Number must be greater than
 * 0"*. Three separate problems with that, and only the last is cosmetic:
 *
 * 1. **`priceMinor` is not a field anyone can see.** It is the API's name for the money the form
 *    calls *Price*, in cents. Naming it tells a reader to look for something that is not there.
 * 2. **It says what failed, never what to do.** "Number must be greater than 0" is a predicate,
 *    not an instruction.
 * 3. It is written for whoever wrote the schema.
 *
 * So each issue is mapped to the field's **visible label**, a sentence about what is wrong, and
 * the fix. This lives directly beneath `draftToApiInput` on purpose: that function decides which
 * `Draft` field becomes which API path, and this is its inverse. Split across two files they
 * would drift the first time a field was renamed.
 *
 * An unmapped path still produces something usable rather than nothing — see `FALLBACK`.
 */
export interface FormProblem {
  /** The field as the form labels it, so the reader knows where to look. */
  readonly field: string;
  readonly what: string;
  readonly fix: string;
}

interface Rule {
  readonly field: string;
  readonly what: string;
  readonly fix: string;
}

const PROBLEMS: Record<string, Rule> = {
  label: {
    field: "Label",
    what: "This report has no name.",
    fix: "Type anything that will help you recognise it later — “Flat 12B, Tai Koo” is plenty.",
  },
  priceMinor: {
    field: "Price",
    what: "The purchase price is missing or zero.",
    fix: "Enter what you would pay for the flat. Every figure in the report — stamp duty, yield, payback — is derived from it.",
  },
  monthlyRentMinor: {
    field: "Monthly rent",
    what: "The rent is not a valid amount.",
    fix: "Enter the monthly rent you expect, or leave it at zero — the report will show the costs and say the yield needs a rent.",
  },
  saleableAreaSqft: {
    field: "Saleable area",
    what: "The area is not a usable figure.",
    fix: "Enter the saleable area in square feet, between 1 and 100,000. Saleable, not gross — the two differ by roughly a quarter.",
  },
  transactionDate: {
    field: "Transaction date",
    what: "The purchase date is missing or malformed.",
    fix: "Pick the date you expect to complete. It decides which stamp duty scale applies, so it changes the answer.",
  },
  "costs.vacancyRate": {
    field: "Vacancy",
    what: "Vacancy is outside the range a percentage can take.",
    fix: "Enter a figure between 0 and 100. It is the share of the year you expect the flat to sit empty — 4 is a common assumption.",
  },
  "costs.monthlyManagementFeeMinor": {
    field: "Management fee",
    what: "The management fee is not a valid amount.",
    fix: "Enter the monthly fee, or zero if there is none. It comes straight off the yield, so it is worth getting right.",
  },
  "costs.annualOtherCostsMinor": {
    field: "Other annual costs",
    what: "That is not a valid amount.",
    fix: "Enter the yearly total of anything else you pay, or zero.",
  },
  "costs.agencyFeeMinor": {
    field: "Agency fee",
    what: "That is not a valid amount.",
    fix: "Enter the agency fee, or zero. In Hong Kong this is typically about 1% of the price.",
  },
  "costs.legalFeesMinor": {
    field: "Legal fees",
    what: "That is not a valid amount.",
    fix: "Enter your solicitor’s fee, or zero if you do not know it yet.",
  },
  "financing.loanAmountMinor": {
    field: "Loan amount",
    what: "The loan is not a valid amount.",
    fix: "Enter how much you intend to borrow, or zero for a cash purchase.",
  },
  "financing.annualInterestRate": {
    field: "Interest rate",
    what: "The interest rate is outside the range a percentage can take.",
    fix: "Enter a figure between 0 and 100 — for example 3 for 3% a year.",
  },
  "financing.termYears": {
    field: "Term",
    what: "The mortgage term is not a whole number of years between 1 and 50.",
    fix: "Enter the length of the loan in years. Hong Kong lenders rarely write beyond 30.",
  },
};

/** Used when a schema grows a field this map has not caught up with. Naming the raw path is a
 *  poor experience but a far better one than a silent failure, and it stays diagnosable. */
function fallbackFor(path: string, message: string): FormProblem {
  return {
    field: path === "" ? "One of the figures" : path,
    what: message,
    fix: "Check that field and try again. If it looks right, this is a bug worth reporting.",
  };
}

/**
 * `ZodError["issues"]`, structurally — taken as a plain shape rather than importing Zod's type,
 * so this file does not gain a dependency on the validator to describe its own form.
 */
export function describeProblems(
  issues: readonly { readonly path: readonly (string | number)[]; readonly message: string }[],
): readonly FormProblem[] {
  const seen = new Set<string>();
  const out: FormProblem[] = [];
  for (const issue of issues) {
    const path = issue.path.join(".");
    // One line per field: three failing rules on one number is still one thing to fix.
    if (seen.has(path)) continue;
    seen.add(path);
    out.push(PROBLEMS[path] ?? fallbackFor(path, issue.message));
  }
  return out;
}

/**
 * The panel a reader meets when the report cannot be produced.
 *
 * Three deliberate choices, all of them about it being read by somebody who is stuck:
 *
 * - **The heading says what happened in plain terms**, not "Validation failed". The reader does
 *   not care that a schema rejected something; they care that the report did not appear and that
 *   it is fixable.
 * - **Every item names the field as the form labels it**, then what is wrong, then the fix. The
 *   old version printed the API's internal path (`priceMinor`) and Zod's predicate ("Number must
 *   be greater than 0"), which told a reader to look for a field that does not exist and gave
 *   them no instruction.
 * - **`role="alert"`** so a screen reader announces it the moment it appears — this replaces the
 *   report somebody just asked for, and silently swapping one for the other is the worst case.
 *
 * The single-sentence `error` covers failures that are not about a field at all (the network, the
 * server). It renders in the same frame so there is one place to look either way.
 */
function FormProblems({
  problems,
  error,
}: {
  readonly problems: readonly FormProblem[];
  readonly error: string | null;
}): React.JSX.Element | null {
  if (problems.length === 0 && error === null) return null;

  return (
    <div
      role="alert"
      className="rounded-panel border border-negative/35 bg-negative/[0.04] px-4 py-3.5"
    >
      <div className="flex items-start gap-2.5">
        <span className="mt-px grid size-5 shrink-0 place-items-center rounded-full bg-negative/15 text-negative">
          <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" aria-hidden="true">
            <path
              d="M12 8v5m0 3.5h.01"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
            />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-mist">
            {/* "Needs fixing", not "missing": a vacancy rate of 400 is present and wrong, and
                telling somebody it is missing sends them looking for an empty box. */}
            {problems.length === 0
              ? "The report could not be produced"
              : problems.length === 1
                ? "One thing needs fixing before the report can be produced"
                : `${problems.length} things need fixing before the report can be produced`}
          </p>

          {problems.length > 0 && (
            <ul className="mt-2 space-y-2">
              {problems.map((p) => (
                <li key={p.field} className="text-sm leading-relaxed">
                  <span className="font-medium text-mist">{p.field}</span>
                  <span className="text-muted"> — {p.what} </span>
                  <span className="text-muted">{p.fix}</span>
                </li>
              ))}
            </ul>
          )}

          {error !== null && (
            <p className="mt-2 text-sm leading-relaxed text-muted">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}

interface Props {
  readonly draft: Draft;
  readonly onChange: (patch: Partial<Draft>) => void;
  readonly onSubmit: () => void;
  readonly pending: boolean;
  /** A single sentence — used for failures that are not about a particular field (the network
   *  died, the server refused). Field-level failures come through `problems` instead. */
  readonly error: string | null;
  readonly problems: readonly FormProblem[];
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
  problems,
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

      <FormProblems problems={problems} error={error} />

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
