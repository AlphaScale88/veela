"use client";

import type { Verdict as CoreVerdict } from "@veela/core";
import type { Property } from "@veela/db";
import { formatCompactMoney, formatPercent, gradeNetYield, standingColor } from "@veela/ui";
import { useEffect, useState } from "react";

import { BookmarkIcon, BuildingIcon } from "./icons";

/**
 * The reader's own saved reports, on `/analyse`, above the blank form.
 *
 * **This replaces a single line of text.** What used to be here was "Welcome back —
 * continue with <most recent>, or start a new one below": one property, no figures, and
 * nothing at all if you had never saved anything. Asked to show the user's data on this page
 * and to show an empty state when there is no previous search, which is a different feature
 * rather than a restyling of that sentence — the point of the old line was to offer *one*
 * shortcut, the point of this is to show *what you have*.
 *
 * **Still offered, never auto-loaded.** The reasoning behind the old line survives and is
 * the reason nothing here loads on its own: silently swapping a blank form for one of these
 * properties' numbers is a bigger surprise than a form that stays blank. Every row is a link
 * the reader chooses.
 *
 * **Not a second portfolio page.** `/portfolio` remains the place to manage these (delete,
 * compare, monitor); this is a launcher, so it shows the few most recent and links out for
 * the rest. Both read the same two endpoints, so neither can show a figure the other
 * disagrees with.
 */

interface Row {
  readonly property: Property;
  readonly verdict: { readonly payload: CoreVerdict } | null;
}

/** Enough to recognise your recent work without turning the top of the form into a list.
 *  The "and N more" link covers the rest rather than paginating here. */
const VISIBLE = 4;

interface Props {
  /** `null` while auth is still resolving, or when nobody is signed in. */
  readonly userId: string | null;
  /** False when Supabase isn't configured — then there is no account system to have data
   *  in, and this renders nothing at all rather than an empty state that blames the
   *  reader for it. Same zero-configuration rule as the rest of the app. */
  readonly configured: boolean;
  /** A plain anchor is used deliberately (see the render) — this tells the parent which
   *  property was picked only for analytics-free prefetch decisions; it is not required. */
  readonly onCount?: (count: number) => void;
}

export function SavedReports({ userId, configured, onCount }: Props): React.JSX.Element | null {
  const [rows, setRows] = useState<readonly Row[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (userId === null) {
      setRows(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const listRes = await fetch("/api/properties");
        if (!listRes.ok) throw new Error(String(listRes.status));
        const { properties } = (await listRes.json()) as { properties: Property[] };

        /* One detail request per property for its stored verdict — the same approach
           /portfolio takes, and for the same reason: GET /properties stays cheap for
           callers that only need labels. Capped at what is actually displayed, so a large
           portfolio doesn't fire twenty requests to render four rows. */
        const shown = properties.slice(0, VISIBLE);
        const detailed = await Promise.all(
          shown.map(async (property) => {
            try {
              const res = await fetch(`/api/properties/${property.id}`);
              if (!res.ok) return { property, verdict: null };
              const detail = (await res.json()) as { verdict: { payload: CoreVerdict } | null };
              return { property, verdict: detail.verdict };
            } catch {
              // A missing verdict is a row without a yield, not a broken section.
              return { property, verdict: null };
            }
          }),
        );
        if (cancelled) return;
        setRows(detailed);
        onCount?.(properties.length);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onCount is a stable callback
  }, [userId]);

  // Nothing to say to a visitor with no account system or no session: the page's own header
  // already explains that the full report needs a login.
  if (!configured || userId === null) return null;

  // A failed fetch is silent here on purpose. This is a convenience shelf above a form that
  // works perfectly without it; an error banner would make a working page look broken.
  if (failed) return null;

  if (rows === null) {
    return (
      <section className="mt-6 max-w-prose rounded-panel border border-line bg-surfaceMuted px-4 py-3 shadow-card">
        <p className="text-sm text-muted">Looking up your saved reports…</p>
      </section>
    );
  }

  if (rows.length === 0) {
    return (
      <section className="mt-6 flex max-w-prose gap-3 rounded-panel border border-dashed border-line bg-surfaceMuted px-4 py-4 shadow-card">
        {/* An empty state is the one place an icon earns real estate: there is no content to
            look at, and a bare paragraph reads like an error rather than a starting point. */}
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
          <BookmarkIcon className="h-4.5 w-4.5" />
        </span>
        <div>
        <h2 className="text-sm font-semibold">No saved reports yet</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">
          Fill in the figures below and open the full report — there&apos;s a{" "}
          <strong className="font-medium text-mist">Save to my portfolio</strong> button on
          it. Anything you save shows up here, and in{" "}
          <a href="/portfolio" className="font-medium text-accent hover:underline">
            My Workspace
          </a>
          , with the figures it was computed from.
        </p>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-6 rounded-panel border border-line bg-surfaceMuted px-4 py-4 shadow-card">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">Your saved reports</h2>
        <a href="/portfolio" className="text-xs font-medium text-accent hover:underline">
          Manage all
        </a>
      </div>
      <p className="mt-1 text-xs text-muted">
        Open one to load its figures into the form below, or start fresh.
      </p>

      <ul className="mt-3 divide-y divide-line">
        {rows.map(({ property, verdict }) => {
          const netYield = verdict?.payload.returns.netYield ?? null;
          return (
            <li key={property.id}>
              {/* A plain anchor, not next/link: /analyse → /analyse?property=… is a
                  same-route navigation, and the page's load effect runs on mount only, so a
                  soft client-side transition would change the URL and load nothing. This is
                  the same reason the line this section replaced used an anchor. */}
              <a
                href={`/analyse?property=${property.id}`}
                className="-mx-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 rounded-card px-2 py-2.5 hover:bg-accent/[0.04]"
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-card bg-accent/10 text-accent">
                    <BuildingIcon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-mist">
                    {property.label}
                  </span>
                  <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-[0.06em] text-muted">
                    {formatCompactMoney({
                      amount: property.priceMinor,
                      currency: property.currency,
                    })}
                    {property.saleableAreaSqft !== null && (
                      <> · {property.saleableAreaSqft} sqft</>
                    )}
                    {" · saved "}
                    {new Date(property.updatedAt).toLocaleDateString("en-GB")}
                  </span>
                  </span>
                </span>
                <span className="tnum shrink-0 text-right">
                  {netYield === null ? (
                    <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-muted">
                      No yield stored
                    </span>
                  ) : (
                    <>
                      {/* The same bands the report rail, the finder chips and the map pins
                          use — a colour here has to mean what it means everywhere else. */}
                      <span
                        className="block text-sm font-semibold"
                        style={{ color: standingColor[gradeNetYield(netYield)] }}
                      >
                        {formatPercent(netYield)}
                      </span>
                      <span className="block font-mono text-[10px] uppercase tracking-[0.06em] text-muted">
                        net yield
                      </span>
                    </>
                  )}
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
