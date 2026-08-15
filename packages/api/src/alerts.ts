/**
 * Property alerts — **real ones, computed, not a toggle that records intent.**
 *
 * ## The stated blocker no longer exists
 *
 * `/portfolio/alerts` has carried this admission since it was built: *"Tracking is real; the
 * alert itself isn't wired up yet. There's no live market feed to compare a tracked property
 * against."* That was true when written. It stopped being true and nobody noticed, because the
 * repo has since gained:
 *
 *   - `RVD_RENT_INDEX` and `RVD_PRICE_INDEX` — monthly, official, back to 1993
 *   - `HK_RULE_SETS` — stamp duty rule sets **versioned by effective date**
 *
 * Those are exactly the two things a saved snapshot can go stale against: **the market moved**,
 * or **the rules moved**. Neither needs a listings feed, a scraper, or a data licence. The
 * alert engine below is built entirely on data already ingested and already trusted elsewhere
 * in the product.
 *
 * ## What it will not do
 *
 * It does not estimate what *this* flat is now worth. RVD publishes no per-district domestic
 * series, so "your flat is up 4%" would be a territory-wide number wearing a specific
 * property's name — the same false precision this codebase refuses when it declines to spread
 * territory-wide figures across 18 districts. Every alert here says what **the market index**
 * did and leaves the inference to the reader.
 *
 * ## Every alert carries its own arithmetic
 *
 * `evidence` is a plain sentence naming the series, the two dates and the two values. That is
 * the same condition the area score and the star rating live under: a number a reader can
 * check and argue with, never one that appears from nowhere.
 */

import { computeVerdict, HK_RULE_SETS, type Verdict } from "@veela/core";
import { RVD_PRICE_INDEX, RVD_RENT_INDEX } from "@veela/fixtures";
import type { CreatePropertyInput } from "@veela/types";

import { toEngineInput } from "./engine-input.js";

export type AlertKind = "rent-index" | "price-index" | "rules-changed" | "stale-snapshot";

export interface Alert {
  /** Stable for a given property and kind, so a future "dismiss" has something to key on. */
  readonly id: string;
  readonly propertyId: string;
  readonly propertyLabel: string;
  readonly kind: AlertKind;
  /** `attention` means a figure in the saved report is probably now wrong; `info` is context. */
  readonly severity: "attention" | "info";
  readonly title: string;
  readonly detail: string;
  /** The working: series, dates, values. Shown on screen, always. */
  readonly evidence: string;
}

/** A saved property in the shape the alert engine needs. Deliberately not the Drizzle row
 *  type — this keeps the engine testable from a plain object and independent of the schema. */
export interface MonitoredProperty {
  readonly id: string;
  readonly label: string;
  readonly jurisdiction: string;
  readonly currency: string;
  readonly priceMinor: number;
  readonly monthlyRentMinor: number;
  readonly saleableAreaSqft: number | null;
  readonly transactionDate: string;
  readonly buyer: unknown;
  readonly costs: unknown;
  readonly financing: unknown;
  /** The stored snapshot and when it was taken. `null` if a property was saved without one. */
  readonly verdict: Verdict | null;
  readonly verdictComputedAt: string | null;
}

/**
 * Thresholds, stated rather than buried.
 *
 * Set so an alert means "a figure you are relying on has probably moved", not "an index
 * twitched". Hong Kong rents moved ~5% in the last year and prices ~13%, so a 3% rent move is
 * roughly a quarter's drift and worth a look; anything tighter would fire constantly and train
 * the reader to ignore the page — which is the actual failure mode of alerting products.
 */
const RENT_MOVE_PCT = 3;
const PRICE_MOVE_PCT = 5;
const STALE_MONTHS = 6;

interface IndexPoint {
  readonly periodStart: string;
  readonly value: number;
}

/** The last published point at or before `iso`. Walks backwards rather than interpolating:
 *  RVD publishes monthly, and inventing a value between two months to make a comparison
 *  tidier is the kind of number this codebase refuses. */
function indexAt(series: readonly IndexPoint[], iso: string): IndexPoint | null {
  let found: IndexPoint | null = null;
  for (const p of series) {
    if (p.periodStart <= iso) found = p;
    else break;
  }
  return found;
}

function pctChange(from: number, to: number): number {
  return ((to - from) / from) * 100;
}

function monthsBetween(fromIso: string, toIso: string): number {
  const a = new Date(fromIso);
  const b = new Date(toIso);
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}

function fmtMonth(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

/**
 * Alerts for one property. Returns `[]` when nothing has meaningfully changed — **an empty
 * result is the good outcome and the page says so**, rather than manufacturing a reassurance
 * card that would make "no news" indistinguishable from "not working".
 */
export function alertsFor(p: MonitoredProperty, now = new Date()): readonly Alert[] {
  const out: Alert[] = [];
  const since = p.verdictComputedAt ?? p.transactionDate;
  const nowIso = now.toISOString().slice(0, 10);

  // ── The market moved ─────────────────────────────────────────────────────
  const rentThen = indexAt(RVD_RENT_INDEX, since);
  const rentNow = RVD_RENT_INDEX[RVD_RENT_INDEX.length - 1];
  if (rentThen !== null && rentNow !== undefined && rentThen.periodStart !== rentNow.periodStart) {
    const move = pctChange(rentThen.value, rentNow.value);
    if (Math.abs(move) >= RENT_MOVE_PCT) {
      const up = move > 0;
      out.push({
        id: `${p.id}:rent-index`,
        propertyId: p.id,
        propertyLabel: p.label,
        kind: "rent-index",
        severity: "attention",
        title: `Market rents are ${up ? "up" : "down"} ${Math.abs(move).toFixed(1)}% since you saved this`,
        detail: up
          ? "The rent in your saved report may now be low, which would understate the yield. Check what comparable units are actually asking before you rely on it."
          : "The rent in your saved report may now be optimistic, which would overstate the yield. Worth re-checking against current asking rents.",
        evidence: `RVD private domestic rental index: ${rentThen.value} (${fmtMonth(rentThen.periodStart)}) → ${rentNow.value} (${fmtMonth(rentNow.periodStart)}). Territory-wide, all classes.`,
      });
    }
  }

  const priceThen = indexAt(RVD_PRICE_INDEX, since);
  const priceNow = RVD_PRICE_INDEX[RVD_PRICE_INDEX.length - 1];
  if (
    priceThen !== null &&
    priceNow !== undefined &&
    priceThen.periodStart !== priceNow.periodStart
  ) {
    const move = pctChange(priceThen.value, priceNow.value);
    if (Math.abs(move) >= PRICE_MOVE_PCT) {
      const up = move > 0;
      out.push({
        id: `${p.id}:price-index`,
        propertyId: p.id,
        propertyLabel: p.label,
        kind: "price-index",
        severity: "info",
        title: `The market is ${up ? "up" : "down"} ${Math.abs(move).toFixed(1)}% since you saved this`,
        detail: up
          ? "Prices across Hong Kong have risen. This says nothing about your specific flat — RVD publishes no per-district series — but a purchase decision priced against an older market is worth revisiting."
          : "Prices across Hong Kong have fallen. If you are still deciding, the asking price may have room in it; if you already own, this is context rather than a valuation.",
        evidence: `RVD private domestic price index: ${priceThen.value} (${fmtMonth(priceThen.periodStart)}) → ${priceNow.value} (${fmtMonth(priceNow.periodStart)}). Territory-wide, all classes — not a valuation of this property.`,
      });
    }
  }

  // ── The rules moved ──────────────────────────────────────────────────────
  // Recomputed with the *same inputs* through the *same engine*, so a difference can only come
  // from the rule set. That is the whole point: it is not an estimate of drift, it is the drift.
  if (p.verdict !== null && p.jurisdiction === "HK") {
    try {
      const input = toEngineInput({
        label: p.label,
        jurisdiction: "HK",
        currency: p.currency,
        priceMinor: p.priceMinor,
        monthlyRentMinor: p.monthlyRentMinor,
        transactionDate: p.transactionDate,
        monitored: true,
        ...(p.saleableAreaSqft !== null && { saleableAreaSqft: p.saleableAreaSqft }),
        buyer: p.buyer,
        costs: p.costs,
        ...(p.financing !== null && { financing: p.financing }),
      } as CreatePropertyInput);

      const fresh = computeVerdict(input, HK_RULE_SETS);

      if (fresh.rulesUsed !== p.verdict.rulesUsed) {
        const before = p.verdict.acquisition.stampDuty.amount;
        const after = fresh.acquisition.stampDuty.amount;
        const delta = (after - before) / 100;
        out.push({
          id: `${p.id}:rules-changed`,
          propertyId: p.id,
          propertyLabel: p.label,
          kind: "rules-changed",
          severity: "attention",
          title: "The stamp duty rules changed after you saved this",
          detail:
            delta === 0
              ? "Your saved report was computed under an earlier rule set. The duty happens to be unchanged, but re-run the report so the snapshot cites the rules that now apply."
              : `Recomputed with the same figures, stamp duty is now HK$${Math.abs(delta).toLocaleString("en-HK")} ${delta > 0 ? "higher" : "lower"}. Your saved cash-to-acquire is out of date.`,
          evidence: `Saved under "${p.verdict.rulesUsed}"; the same transaction date now resolves to "${fresh.rulesUsed}".`,
        });
      }
    } catch {
      // A stored row that will not rebuild into engine input is a data problem, not an alert.
      // Silently skipping is right: the alerts page must not become an error console.
    }
  }

  // ── The snapshot is simply old ───────────────────────────────────────────
  if (p.verdictComputedAt !== null) {
    const age = monthsBetween(p.verdictComputedAt, nowIso);
    if (age >= STALE_MONTHS) {
      out.push({
        id: `${p.id}:stale`,
        propertyId: p.id,
        propertyLabel: p.label,
        kind: "stale-snapshot",
        severity: "info",
        title: `This report is ${age} months old`,
        detail:
          "Saved reports are dated snapshots on purpose — they are not silently rewritten. Re-run it to price the property against today's rules and today's market.",
        evidence: `Computed ${fmtMonth(p.verdictComputedAt)}; today is ${fmtMonth(nowIso)}.`,
      });
    }
  }

  return out;
}

/** Severity-ordered across a whole portfolio, so the thing most likely to be wrong is first. */
export function alertsForAll(
  properties: readonly MonitoredProperty[],
  now = new Date(),
): readonly Alert[] {
  const all = properties.flatMap((p) => alertsFor(p, now));
  return all.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "attention" ? -1 : 1));
}
