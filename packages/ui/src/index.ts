import type { Severity, Verdict } from "@veela/core";
import { formatMoney, toMajor, type Money } from "@veela/core";
import { isExtrapolated, type AttributedValue } from "@veela/types";

/**
 * Shared **presentation logic and design tokens** — not components. Web renders with
 * shadcn/Tailwind and mobile with NativeWind, so the components themselves can't be
 * shared, but the decisions about what a number means and what colour it gets must be
 * identical on both surfaces. Anything that could drift and cause the two apps to
 * disagree about a verdict belongs here.
 */

// ── Tokens ─────────────────────────────────────────────────────────────────
// Plain values so Tailwind (web) and NativeWind (mobile) consume the same source.

export const tokens = {
  color: {
    /**
     * **Tinted page, white cards — the marketplace default, deliberately reinstated.**
     * An earlier pass here read "paper, not chrome": page and card the same white,
     * separation by rule and space alone. That suited an editorial reading experience.
     * It does not suit a product asking to look like Zillow or Airbnb, where a card
     * has to visibly sit *on* something — the whole vocabulary of "listing card",
     * "hover lift", "photo tile" depends on a page the card contrasts against.
     *
     * `bg` carries a soft blue-grey tint for exactly that contrast. `surface` stays
     * pure white so cards read as the foreground object. `surfaceMuted` is now the
     * bg tint reused for insets that need to look sunken rather than raised.
     */
    bg: "#F4F6FA",
    surface: "#FFFFFF",
    surfaceMuted: "#F4F6FA",
    /** Hairline. Mostly a hover/definition edge now that shadows carry separation. */
    border: "#E3E8EE",
    text: "#0C1A2B",
    textMuted: "#5A6B7D",
    accent: "#0B5BD3",
    positive: "#0F7A52",
    caution: "#8A5A00",
    negative: "#B3261E",
    /** The one dark surface. Used full-bleed for the sections that must land hard. */
    inverse: "#0C1A2B",
    inverseText: "#E7EDF4",
    inverseMuted: "#93A6BA",
    inverseBorder: "#1E3145",
  },
  radius: { sm: 8, md: 12, lg: 20, xl: 28 },
  space: { xs: 4, sm: 8, md: 16, lg: 24, xl: 40 },
} as const;

/**
 * Chart palette. Validated against **this app's** white card surface (`#FFFFFF`), not a
 * default one — contrast and CVD results are only meaningful against the surface the
 * chart actually renders on.
 *
 *   node scripts/validate_palette.js "#3987e5,#d95926" --mode light --surface "#FFFFFF"
 *   → all checks pass · CVD ΔE 26.8 (protan) · normal-vision ΔE 31.8 · both ≥ 3:1
 *
 * The categorical pair survived the move from the old dark surface unchanged; the
 * sequential ramp did not. `sequential` is one hue, light→dark: on a white surface the
 * *low* end is what recedes toward the surface, which is the opposite of the dark-mode
 * form this replaced. Six bins — past about seven, adjacent classes blur and a table is
 * the honest answer.
 *
 * Bin 0 sits at 1.18:1 against white, which is by design (it must recede) and is why
 * every filled mark carries a hairline `grid` stroke — without it the lowest class is
 * indistinguishable from empty space, and "no data" and "lowest value" must never look
 * the same.
 */
export const viz = {
  /** Categorical — identity. Which side of the market a series describes. */
  demand: "#3987e5",
  supply: "#d95926",
  /** Sequential — magnitude. Index 0 = lowest. */
  sequential: ["#E4EDFB", "#C2D8F5", "#96BAEC", "#6497DD", "#3A73C4", "#1D4E93"] as const,
  /** Chrome. Hairline, solid, one step off the surface — never dashed. */
  grid: tokens.color.border,
  axis: tokens.color.border,
  /** Marks sit on this; also the colour of the 2px gaps and rings. */
  surface: tokens.color.surface,
} as const;

/** Which sequential bin a value falls in. Equal-width bins over [min, max]. */
export function sequentialBin(value: number, min: number, max: number): string {
  const bins = viz.sequential;
  if (max <= min) return bins[0];
  const t = (value - min) / (max - min);
  const idx = Math.min(bins.length - 1, Math.max(0, Math.floor(t * bins.length)));
  return bins[idx] ?? bins[0];
}

/**
 * Ink or paper for a label sitting *inside* a filled mark, by the fill's luminance.
 * Both arms are theme tokens: on a light theme the bright fills take dark ink and only
 * the deep end of the ramp takes paper, which is the reverse of the dark-theme case.
 */
export function inkOn(fill: string): string {
  const hex = fill.replace("#", "");
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;
  const lin = (c: number): number =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return L > 0.35 ? tokens.color.text : tokens.color.inverseText;
}

export const severityColor: Record<Severity, string> = {
  critical: tokens.color.negative,
  warning: tokens.color.caution,
  info: tokens.color.textMuted,
};

export const severityLabel: Record<Severity, string> = {
  critical: "Deal risk",
  warning: "Check this",
  info: "Note",
};

// ── Formatting ─────────────────────────────────────────────────────────────

export function formatPercent(value: number | null, digits = 2): string {
  if (value === null) return "—";
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatYears(value: number | null): string {
  if (value === null) return "—";
  if (!Number.isFinite(value)) return "never";
  return `${value.toFixed(1)} yrs`;
}

export function formatCompactMoney(m: Money, locale = "en-HK"): string {
  const major = toMajor(m);
  const abs = Math.abs(major);
  if (abs >= 1_000_000) {
    return `${m.currency} ${(major / 1_000_000).toFixed(2)}M`;
  }
  if (abs >= 1_000) {
    return `${m.currency} ${(major / 1_000).toFixed(0)}k`;
  }
  return formatMoney(m, locale);
}

export { formatMoney };

// ── Interpretation ─────────────────────────────────────────────────────────

export type Standing = "strong" | "fair" | "weak" | "unknown";

/**
 * How a yield reads. The bands are deliberately Hong Kong-calibrated: yields there
 * are structurally low, so 3% is respectable where it would be poor elsewhere. When
 * we add France and Vietnam these must become per-jurisdiction — a single global
 * band would mislabel every market but one.
 */
export function gradeNetYield(value: number | null): Standing {
  if (value === null) return "unknown";
  if (value >= 0.035) return "strong";
  if (value >= 0.02) return "fair";
  return "weak";
}

export const standingColor: Record<Standing, string> = {
  strong: tokens.color.positive,
  fair: tokens.color.caution,
  weak: tokens.color.negative,
  unknown: tokens.color.textMuted,
};

export interface StarRating {
  /** 0–5, in half-star steps. */
  readonly stars: number;
  /** What produced the number, in one sentence — this is a rating this product
   *  computed from its own verdict, not an opaque proprietary score, so the formula
   *  is always visible next to the number rather than hidden behind it. */
  readonly explanation: string;
}

/**
 * A 0–5 star reading of a verdict, deliberately built from numbers already on screen
 * rather than a new composite metric. Net yield sets the base — mapped onto a
 * continuum, not `gradeNetYield`'s three bands, so two "strong" yields can still be
 * told apart — and each finding pulls it down: a critical finding costs a full star, a
 * warning half of one, because a finding that could sink the deal should visibly sink
 * the rating too. Floors at 0, never goes below it, never exceeds 5.
 */
export function rateVerdict(v: Verdict): StarRating {
  const netYield = v.returns.netYield;
  const base =
    netYield === null
      ? 0
      : netYield <= 0
        ? 0.5
        : Math.min(5, 1 + (netYield / 0.035) * 4);

  const critical = v.findings.filter((f) => f.severity === "critical").length;
  const warning = v.findings.filter((f) => f.severity === "warning").length;
  const deducted = Math.max(0, base - critical - warning * 0.5);
  const stars = Math.round(deducted * 2) / 2;

  const parts = [`${formatPercent(netYield)} net yield`];
  if (critical > 0) {
    parts.push(`${critical} critical finding${critical === 1 ? "" : "s"} (−1★ each)`);
  }
  if (warning > 0) {
    parts.push(`${warning} warning${warning === 1 ? "" : "s"} (−0.5★ each)`);
  }

  return {
    stars,
    explanation: `${stars.toFixed(1)}/5 — from ${parts.join(", ")}.`,
  };
}

export interface HeadlineStat {
  readonly label: string;
  readonly value: string;
  readonly hint?: string;
  readonly color?: string;
}

/** The four numbers that go at the top of the verdict, in priority order. */
export function headlineStats(v: Verdict): readonly HeadlineStat[] {
  return [
    {
      label: "Net yield",
      value: formatPercent(v.returns.netYield),
      hint: "After costs and tax, before financing",
      color: standingColor[gradeNetYield(v.returns.netYield)],
    },
    {
      label: "Gross yield",
      value: formatPercent(v.returns.grossYield),
      hint: "Rent ÷ price",
    },
    {
      label: "Cash-on-cash",
      value: formatPercent(v.returns.cashOnCash),
      hint: "Net income ÷ cash actually invested",
    },
    {
      label: "Payback",
      value: formatYears(v.returns.paybackYears),
      hint: "Years of net income to recover your cash",
    },
  ];
}

export interface CostLine {
  readonly label: string;
  readonly amount: Money;
  readonly emphasis?: boolean;
}

export function acquisitionLines(v: Verdict): readonly CostLine[] {
  return [
    { label: "Purchase price", amount: v.acquisition.price },
    { label: `Stamp duty — ${v.acquisition.stampDutyScale}`, amount: v.acquisition.stampDuty },
    { label: "Agency fee", amount: v.acquisition.agencyFee },
    { label: "Legal fees", amount: v.acquisition.legalFees },
    { label: "Total to acquire", amount: v.acquisition.total, emphasis: true },
  ];
}

export function annualLines(v: Verdict): readonly CostLine[] {
  return [
    { label: "Gross rent", amount: v.annual.grossRent },
    { label: "Vacancy loss", amount: v.annual.vacancyLoss },
    { label: "Management fees", amount: v.annual.managementFees },
    { label: "Government rates", amount: v.annual.governmentRates },
    { label: "Other costs", amount: v.annual.otherCosts },
    { label: "Rental income tax", amount: v.annual.rentalIncomeTax },
    { label: "Mortgage interest", amount: v.annual.mortgageInterest },
    { label: "Net income", amount: v.annual.netIncome, emphasis: true },
  ];
}

export function criticalCount(v: Verdict): number {
  return v.findings.filter((f) => f.severity === "critical").length;
}

/**
 * The disclosure the map must always show. Displaying a district figure on a single
 * building implies precision we do not have; saying so plainly is what keeps an
 * investor's trust when they check us against the source.
 */
export function granularityNotice(v: AttributedValue): string | null {
  if (!isExtrapolated(v)) return null;
  return `Measured at ${v.measuredAt} level, shown here at ${v.shownAt} level — treat as indicative, not specific to this ${v.shownAt}.`;
}

export { isExtrapolated };
