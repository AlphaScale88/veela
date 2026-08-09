/**
 * Money is stored and computed in **minor units** (HK cents, euro cents, VND dong)
 * as integers. Never use floats for money: 0.1 + 0.2 !== 0.3, and a tax engine that
 * is off by a cent loses credibility faster than one that is slow.
 */

export type Currency = "HKD" | "VND" | "EUR";

/** An amount in minor units, tagged with its currency. */
export interface Money {
  readonly amount: number; // integer, minor units
  readonly currency: Currency;
}

export const MINOR_UNITS_PER_MAJOR: Record<Currency, number> = {
  HKD: 100,
  EUR: 100,
  VND: 1, // the dong has no subunit in practice
};

export function money(major: number, currency: Currency): Money {
  const factor = MINOR_UNITS_PER_MAJOR[currency];
  return { amount: Math.round(major * factor), currency };
}

export function minor(amount: number, currency: Currency): Money {
  if (!Number.isInteger(amount)) {
    throw new Error(`Money must be an integer in minor units, got ${amount}`);
  }
  return { amount, currency };
}

export const zero = (currency: Currency): Money => ({ amount: 0, currency });

function assertSame(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new Error(`Currency mismatch: ${a.currency} vs ${b.currency}`);
  }
}

export function add(a: Money, b: Money): Money {
  assertSame(a, b);
  return { amount: a.amount + b.amount, currency: a.currency };
}

export function sub(a: Money, b: Money): Money {
  assertSame(a, b);
  return { amount: a.amount - b.amount, currency: a.currency };
}

export function sum(items: readonly Money[], currency: Currency): Money {
  return items.reduce(add, zero(currency));
}

/** Multiply by a rate, rounding half-up to the nearest minor unit. */
export function scale(m: Money, rate: number): Money {
  return { amount: Math.round(m.amount * rate), currency: m.currency };
}

export function negate(m: Money): Money {
  return { amount: -m.amount, currency: m.currency };
}

export function isZero(m: Money): boolean {
  return m.amount === 0;
}

export function compare(a: Money, b: Money): number {
  assertSame(a, b);
  return a.amount - b.amount;
}

export function toMajor(m: Money): number {
  return m.amount / MINOR_UNITS_PER_MAJOR[m.currency];
}

/** Ratio of two amounts as a plain number. Returns null when the base is zero. */
export function ratio(numerator: Money, denominator: Money): number | null {
  assertSame(numerator, denominator);
  if (denominator.amount === 0) return null;
  return numerator.amount / denominator.amount;
}

export function formatMoney(m: Money, locale = "en-HK"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: m.currency,
    maximumFractionDigits: m.currency === "VND" ? 0 : 0,
  }).format(toMajor(m));
}
