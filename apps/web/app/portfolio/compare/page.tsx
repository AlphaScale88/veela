"use client";

import type { Verdict as CoreVerdict } from "@veela/core";
import type { Property } from "@veela/db";
import {
  criticalCount,
  formatCompactMoney,
  formatPercent,
  formatYears,
  gradeNetYield,
  rateVerdict,
  standingColor,
} from "@veela/ui";
import Link from "next/link";
import { useEffect, useState } from "react";

import { AppShell } from "../../../components/app-shell";
import { useAuth } from "../../../components/auth-provider";
import { MAX_COMPARE } from "../../../components/listing-actions";
import { signedUrls, type PropertyPhoto } from "../../../lib/property-photos";


interface Row {
  readonly property: Property;
  readonly verdict: CoreVerdict | null;
}

/**
 * Property Compare — side by side, from what's already saved. No new computation:
 * every figure here is the stored snapshot from when each property was saved (or the
 * live report, for whichever one was analysed most recently), same as `/portfolio`.
 */
export default function ComparePage(): React.JSX.Element {
  const { user, loading, configured } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [selected, setSelected] = useState<readonly string[]>([]);
  const [error, setError] = useState<string | null>(null);
  /**
   * `?ids=a,b,c` — what the finder's Compare button sends.
   *
   * Read from `location` inside the load effect rather than via `useSearchParams`, for two
   * reasons. The practical one: `useSearchParams` opts a page out of static prerendering unless
   * it sits inside a `Suspense` boundary, and **this broke the production build** rather than
   * failing quietly. The honest one: these ids are a *seed*, not state. A reader who lands here
   * and unticks a column must not have it reinstated because the URL still names it, so reading
   * once is the behaviour actually wanted — the hook's reactivity would have been a bug.
   *
   * Ids that are not the caller's never match a loaded row, so a hand-edited URL smuggles
   * nothing in: the rows come from `GET /properties`, which RLS has already scoped.
   */

  useEffect(() => {
    if (user === null) return;
    let cancelled = false;
    (async () => {
      try {
      const listRes = await fetch("/api/properties");
      if (!listRes.ok) throw new Error(`Could not load your properties (${listRes.status}).`);
      const { properties } = (await listRes.json()) as { properties: Property[] };
      const detailed = await Promise.all(
        properties.map(async (property) => {
          const res = await fetch(`/api/properties/${property.id}`);
          if (!res.ok) return { property, verdict: null };
          const detail = (await res.json()) as { verdict: { payload: CoreVerdict } | null };
          return { property, verdict: detail.verdict?.payload ?? null };
        }),
      );
      if (!cancelled) {
        setRows(detailed);
        const own = new Set(detailed.map((r) => r.property.id));
        const asked = (new URLSearchParams(window.location.search).get("ids") ?? "")
          .split(",")
          .map((id) => id.trim())
          .filter((id) => id !== "" && own.has(id))
          .slice(0, MAX_COMPARE);
        /* Fall back to the two most recent, which is what this page did before it could be
           linked into — landing on an empty comparison would be a worse default than a guess. */
        setSelected(asked.length > 0 ? asked : detailed.slice(0, 2).map((r) => r.property.id));
      }
      } catch (cause) {
        /* Previously a rejected fetch left `rows` null for ever, and the page rendered its
           heading over an empty space — indistinguishable from "still loading" and from
           "nothing saved". Silence is the worst of the three. */
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Something went wrong.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  /** Cover photo per property, so a column is recognisable at a glance rather than by
   *  reading its label. One batch fetch and one batch signing call for the whole list. */
  const [covers, setCovers] = useState<ReadonlyMap<string, string>>(new Map());
  /**
   * The most recent note per property, plus how many there are.
   *
   * A summary rather than every note, from one request rather than one per column: a comparison
   * row has space for a line or two, and fetching a property's whole note history to render its
   * latest line is waste that grows with use. The count is shown so a single line never implies it
   * is everything written.
   */
  const [latestNotes, setLatestNotes] = useState<
    ReadonlyMap<string, { readonly body: string; readonly total: number }>
  >(new Map());

  useEffect(() => {
    if (user === null) return;
    let cancelled = false;
    void (async () => {
      const res = await fetch("/api/notes/latest");
      if (!res.ok || cancelled) return;
      const { latest } = (await res.json()) as {
        latest: { propertyId: string; body: string; total: number }[];
      };
      if (cancelled) return;
      setLatestNotes(new Map(latest.map((n) => [n.propertyId, { body: n.body, total: n.total }])));
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);
  useEffect(() => {
    if (user === null) return;
    let cancelled = false;
    void (async () => {
      const res = await fetch("/api/photos/covers");
      if (!res.ok || cancelled) return;
      const { covers: photos } = (await res.json()) as { covers: PropertyPhoto[] };
      const urls = await signedUrls(photos.map((p) => p.storagePath));
      if (cancelled) return;
      const byProperty = new Map<string, string>();
      for (const photo of photos) {
        const url = urls.get(photo.storagePath);
        if (url !== undefined) byProperty.set(photo.propertyId, url);
      }
      setCovers(byProperty);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  function toggle(id: string): void {
    setSelected((s) =>
      s.includes(id) ? s.filter((x) => x !== id) : s.length >= MAX_COMPARE ? s : [...s, id],
    );
  }

  if (!configured) {
    return (
      <AppShell breadcrumb="My Workspace › Property Compare">
        <p className="card max-w-prose text-sm text-muted">
          Sign-in isn't configured on this deployment.
        </p>
      </AppShell>
    );
  }

  if (loading) {
    return (
      <AppShell breadcrumb="My Workspace › Property Compare">
        <p className="text-sm text-muted">Loading…</p>
      </AppShell>
    );
  }

  if (user === null) {
    return (
      <AppShell breadcrumb="My Workspace › Property Compare">
        <h1 className="font-display text-[26px] font-semibold tracking-[-0.03em] text-mist">
          Property Compare
        </h1>
        <p className="mt-3 max-w-prose text-sm text-muted">
          Log in and save a couple of properties from a report to compare them here.
        </p>
        <Link href="/login?next=/portfolio/compare" className="btn-primary mt-5 inline-flex !px-6 !py-3">
          Log in
        </Link>
      </AppShell>
    );
  }

  const compared = rows?.filter((r) => selected.includes(r.property.id)) ?? [];

  return (
    <AppShell breadcrumb="My Workspace › Property Compare">
      <header className="max-w-prose">
        <h1 className="font-display text-[26px] font-semibold tracking-[-0.03em] text-mist">
          Property Compare
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Pick up to {MAX_COMPARE} saved properties. Figures are each one's saved
          snapshot, not recomputed — re-run a report on{" "}
          <Link href="/analyse" className="text-accent hover:underline">
            /analyse
          </Link>{" "}
          if it's been a while.
        </p>
      </header>

      {error !== null && <p className="card mt-6 max-w-prose text-sm text-negative">{error}</p>}

      {/* An explicit loading line. The page used to render its heading and then nothing at all
          while the two fetches were in flight, which reads as a broken page rather than a busy
          one — and looked identical to having saved nothing. */}
      {error === null && rows === null && (
        <p className="card mt-6 max-w-prose text-sm text-muted">Loading your properties…</p>
      )}

      {rows !== null && rows.length === 0 && (
        <p className="card mt-8 max-w-prose text-sm text-muted">
          Nothing saved yet — there's nothing to compare.{" "}
          <Link href="/analyse" className="text-accent hover:underline">
            Analyse a property
          </Link>{" "}
          first.
        </p>
      )}

      {rows !== null && rows.length > 0 && (
        <>
          <div className="mt-6 flex flex-wrap gap-2">
            {rows.map((r) => (
              <button
                key={r.property.id}
                type="button"
                onClick={() => toggle(r.property.id)}
                aria-pressed={selected.includes(r.property.id)}
                disabled={!selected.includes(r.property.id) && selected.length >= MAX_COMPARE}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                  selected.includes(r.property.id)
                    ? "border-accent bg-accent text-white"
                    : "border-line text-muted hover:text-mist"
                }`}
              >
                {/* The thumbnail is in the *selector*, not only the table: picking which
                    three of twelve saved flats to compare is the step where recognising one
                    by sight actually helps. */}
                {covers.get(r.property.id) !== undefined && (
                  /* eslint-disable-next-line @next/next/no-img-element -- expiring signed URL */
                  <img
                    src={covers.get(r.property.id)}
                    alt=""
                    className="mr-2 inline-block h-5 w-7 rounded object-cover align-middle"
                  />
                )}
                {r.property.label}
              </button>
            ))}
          </div>

          {compared.length === 0 ? (
            <p className="card mt-6 max-w-prose text-sm text-muted">Pick at least one.</p>
          ) : (
            <div className="card mt-6 overflow-x-auto p-0">
              <table className="w-full min-w-[36rem] text-sm">
                <thead>
                  <tr className="border-b border-line bg-surfaceMuted text-left text-xs text-muted">
                    <th scope="col" className="px-4 py-2.5 font-medium">—</th>
                    {compared.map((r) => (
                      <th key={r.property.id} scope="col" className="px-4 py-2.5 text-left font-medium text-mist">
                        {covers.get(r.property.id) !== undefined && (
                          /* eslint-disable-next-line @next/next/no-img-element -- expiring signed URL */
                          <img
                            src={covers.get(r.property.id)}
                            alt=""
                            className="mb-1.5 aspect-[16/9] w-28 rounded-card object-cover"
                          />
                        )}
                        {r.property.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <CompareRow label="Price" rows={compared} render={(v, p) => formatCompactMoney({ amount: p.priceMinor, currency: p.currency })} />
                  {/* Directly under the price, because that is the pair the eye compares: a
                      cheaper flat is not cheaper if it is half the size. Saleable area, which
                      is what the report collects and what Hong Kong listings quote — gross
                      area is a different and larger number, so the label says which. */}
                  <CompareRow
                    label="Saleable area"
                    rows={compared}
                    render={(v, p) =>
                      p.saleableAreaSqft === null
                        ? "—"
                        : `${Math.round(p.saleableAreaSqft).toLocaleString("en-HK")} sqft`
                    }
                  />
                  <CompareRow label="Net yield" rows={compared} render={(v) => (v !== null ? formatPercent(v.returns.netYield) : "—")} color={(v) => (v !== null ? standingColor[gradeNetYield(v.returns.netYield)] : undefined)} />
                  <CompareRow label="Cash-on-cash" rows={compared} render={(v) => (v !== null ? formatPercent(v.returns.cashOnCash) : "—")} />
                  <CompareRow label="Payback" rows={compared} render={(v) => (v !== null ? formatYears(v.returns.paybackYears) : "—")} />
                  <CompareRow label="Stamp duty" rows={compared} render={(v) => (v !== null ? formatCompactMoney(v.acquisition.stampDuty) : "—")} />
                  <CompareRow label="Critical findings" rows={compared} render={(v) => (v !== null ? String(criticalCount(v)) : "—")} />
                  <CompareRow label="Veela rating" rows={compared} render={(v) => (v !== null ? `${rateVerdict(v).stars.toFixed(1)}/5` : "—")} />

                  {/* Notes are the one row that comes from the reader rather than the engine, so
                      it sits last — after everything Veela computed, which is the order the page
                      reads in. `whitespace-pre-wrap`, not markdown: the same rule the note editor
                      itself follows. */}
                  <tr className="border-b border-line/60 align-top last:border-b-0">
                    <th scope="row" className="px-4 py-2.5 text-left font-normal text-muted">
                      Your notes
                    </th>
                    {compared.map((r) => {
                      const note = latestNotes.get(r.property.id);
                      return (
                        <td key={r.property.id} className="px-4 py-2.5 text-sm">
                          {note === undefined ? (
                            <span className="text-muted">—</span>
                          ) : (
                            <>
                              <span className="line-clamp-4 whitespace-pre-wrap text-mist">
                                {note.body}
                              </span>
                              <span className="mt-1 block font-mono text-[10px] uppercase tracking-[0.06em] text-muted">
                                latest of {note.total}
                              </span>
                            </>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}

function CompareRow({
  label,
  rows,
  render,
  color,
}: {
  readonly label: string;
  readonly rows: readonly Row[];
  readonly render: (v: CoreVerdict | null, p: Property) => string;
  readonly color?: (v: CoreVerdict | null) => string | undefined;
}): React.JSX.Element {
  return (
    <tr className="border-b border-line/60 last:border-0">
      <th scope="row" className="px-4 py-2.5 text-left font-normal text-muted">{label}</th>
      {rows.map((r) => (
        <td
          key={r.property.id}
          className="tnum px-4 py-2.5 font-medium"
          style={color !== undefined ? { color: color(r.verdict) } : undefined}
        >
          {render(r.verdict, r.property)}
        </td>
      ))}
    </tr>
  );
}
