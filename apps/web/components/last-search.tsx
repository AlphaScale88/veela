"use client";

import { computeVerdict, HK_RULE_SETS } from "@veela/core";
import { formatCompactMoney, formatPercent, gradeNetYield, standingColor } from "@veela/ui";

import { ClockIcon } from "./icons";
import { draftToCoreInput, type Draft } from "./property-form";

/**
 * "Pick up where you left off" — the last set of figures actually analysed on this device.
 *
 * ## Why this is not the saved-reports shelf
 *
 * `SavedReports` lists properties **deliberately saved** to a portfolio: it needs an account,
 * a database round trip, and an explicit click on "Save to my portfolio". This is the other
 * half — the search someone ran and *didn't* save, which until now was simply lost the moment
 * they navigated away. That is the common case, not the exception: the form has no account
 * requirement for the live preview, so most figures typed into it were never persisted
 * anywhere.
 *
 * ## localStorage, and why not the database
 *
 * It has to work for a visitor with no account, which rules out `properties`. It has to
 * survive a page reload, which rules out React state and `sessionStorage`. That leaves
 * `localStorage`, and it happens to be the honest place for it: this is a convenience for one
 * browser, not a record of anything, and it never leaves the device — consistent with
 * `/privacy` and with the product's own "nothing is saved unless you save it" line, which
 * this does not break because nothing here reaches a server.
 *
 * **Never auto-loaded.** Restoring is a button. The same rule the saved-reports shelf follows,
 * for the same reason: silently repopulating a form a reader believes is blank is a worse
 * surprise than an empty form, and it is precisely the behaviour the prefilled
 * `INITIAL_DRAFT` was removed for.
 */

export const LAST_SEARCH_KEY = "veela:last-search:v1";

export interface LastSearch {
  readonly draft: Draft;
  /** ISO instant the report was run. */
  readonly at: string;
}

/**
 * Written after a report is successfully computed, not on every keystroke — a half-typed
 * price is not a search, and `localStorage` writes on each character would be both wasteful
 * and wrong about what "last search" means.
 */
export function rememberLastSearch(draft: Draft): void {
  try {
    const payload: LastSearch = { draft, at: new Date().toISOString() };
    localStorage.setItem(LAST_SEARCH_KEY, JSON.stringify(payload));
  } catch {
    // Private browsing, a full quota, or storage disabled by policy. A convenience shelf is
    // not worth an error path — the report itself is unaffected.
  }
}

/** Returns `null` for anything that isn't a usable record, rather than trusting whatever is
 *  under the key: it is user-writable storage, and an old or hand-edited shape must not reach
 *  `computeVerdict`. */
export function readLastSearch(): LastSearch | null {
  try {
    const raw = localStorage.getItem(LAST_SEARCH_KEY);
    if (raw === null) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null) return null;
    const { draft, at } = parsed as { draft?: unknown; at?: unknown };
    if (typeof at !== "string" || typeof draft !== "object" || draft === null) return null;
    const d = draft as Partial<Draft>;
    // Price is the one field the whole report is unusable without, and the one the preview
    // already refuses to compute around when it is zero.
    if (typeof d.price !== "number" || d.price <= 0) return null;
    return { draft: draft as Draft, at };
  } catch {
    return null;
  }
}

export function forgetLastSearch(): void {
  try {
    localStorage.removeItem(LAST_SEARCH_KEY);
  } catch {
    /* see rememberLastSearch */
  }
}

function whenLabel(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "earlier";
  const mins = Math.round((Date.now() - then) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

interface Props {
  readonly search: LastSearch;
  readonly onRestore: () => void;
  readonly onDismiss: () => void;
}

export function LastSearchCard({ search, onRestore, onDismiss }: Props): React.JSX.Element {
  const { draft, at } = search;

  /**
   * The yield is recomputed from the stored draft through the **same** `computeVerdict` the
   * rail and the report use, not stored alongside it. Two reasons: a cached number could
   * disagree with what restoring the draft actually produces, and tax rules are versioned by
   * transaction date — a figure computed weeks ago under a different rule set would be quietly
   * wrong. Recomputing costs nothing and cannot drift.
   */
  let netYield: number | null = null;
  try {
    netYield = computeVerdict(draftToCoreInput(draft), HK_RULE_SETS).returns.netYield;
  } catch {
    netYield = null;
  }

  return (
    <section className="mt-6 rounded-panel border border-line bg-surfaceMuted px-4 py-4 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-card bg-accent/10 text-accent">
            <ClockIcon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">
              Your last search{" "}
              <span className="font-normal text-muted">— {whenLabel(at)}</span>
            </h2>
            <p className="mt-0.5 truncate text-sm text-mist">
              {draft.label.trim() === "" ? "Untitled property" : draft.label}
            </p>
            <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.06em] text-muted">
              {formatCompactMoney({ amount: Math.round(draft.price * 100), currency: "HKD" })}
              {draft.monthlyRent > 0 && (
                <>
                  {" · "}
                  {formatCompactMoney({
                    amount: Math.round(draft.monthlyRent * 100),
                    currency: "HKD",
                  })}
                  /mo
                </>
              )}
              {draft.saleableAreaSqft > 0 && <> · {draft.saleableAreaSqft} sqft</>}
              {netYield !== null && (
                <>
                  {" · "}
                  <span style={{ color: standingColor[gradeNetYield(netYield)] }}>
                    {formatPercent(netYield)} net
                  </span>
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <button type="button" onClick={onRestore} className="btn-secondary !px-4 !py-2 !text-xs">
            Restore these figures
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="text-xs text-muted hover:text-mist"
          >
            Discard
          </button>
        </div>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-muted">
        Kept in this browser only — never sent to us, and cleared by Discard. Restoring fills
        the form below; it doesn&apos;t submit anything on its own.
      </p>
    </section>
  );
}
