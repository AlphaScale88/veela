"use client";

import type { Verdict as CoreVerdict } from "@veela/core";
import type { Property } from "@veela/db";
import { formatCompactMoney, formatPercent, gradeNetYield, rateVerdict, standingColor } from "@veela/ui";
import Link from "next/link";
import { useEffect, useState } from "react";

import { AppShell } from "../../components/app-shell";
import { useAuth } from "../../components/auth-provider";

/**
 * The thing logging in actually buys you: properties saved from `/analyse` persist
 * here across visits, each with its report exactly as it was when saved (verdicts are
 * snapshots, not a cache — see `packages/db/src/schema.ts`). Nothing on `/analyse`
 * itself is gated; this page is the addition, not a paywall on the existing report.
 */
interface Row {
  readonly property: Property;
  readonly verdict: { readonly payload: CoreVerdict } | null;
}

export default function PortfolioPage(): React.JSX.Element {
  const { user, loading, configured } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    if (user === null) return;

    let cancelled = false;
    (async () => {
      try {
        const listRes = await fetch("/api/properties");
        if (!listRes.ok) throw new Error(`Could not load your properties (${listRes.status}).`);
        const { properties } = (await listRes.json()) as { properties: Property[] };

        // One request per property to get its latest verdict — fine at portfolio scale
        // (a personal list, not a market feed), and it keeps GET /properties itself
        // cheap for callers that only need the list.
        const detailed = await Promise.all(
          properties.map(async (property) => {
            const detailRes = await fetch(`/api/properties/${property.id}`);
            if (!detailRes.ok) return { property, verdict: null };
            const detail = (await detailRes.json()) as {
              verdict: { payload: CoreVerdict } | null;
            };
            return { property, verdict: detail.verdict };
          }),
        );
        if (!cancelled) setRows(detailed);
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "Something went wrong.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  async function remove(id: string): Promise<void> {
    setDeleting(id);
    try {
      const res = await fetch(`/api/properties/${id}`, { method: "DELETE" });
      if (res.ok || res.status === 404) {
        setRows((r) => r?.filter((row) => row.property.id !== id) ?? r);
      }
    } finally {
      setDeleting(null);
    }
  }

  if (!configured) {
    return (
      <AppShell breadcrumb="My Workspace">
        <p className="card max-w-prose text-sm text-muted">
          Sign-in isn't configured on this deployment, so there's no portfolio to show.
        </p>
      </AppShell>
    );
  }

  if (loading) {
    return (
      <AppShell breadcrumb="My Workspace">
        <p className="text-sm text-muted">Loading…</p>
      </AppShell>
    );
  }

  if (user === null) {
    return (
      <AppShell breadcrumb="My Workspace">
        <h1 className="font-display text-[26px] font-semibold tracking-[-0.03em] text-mist">
          My properties
        </h1>
        <p className="mt-3 max-w-prose text-sm text-muted">
          Log in to see properties you've saved from a report, or to start saving them.
        </p>
        <Link href="/login?next=/portfolio" className="btn-primary mt-5 inline-flex !px-6 !py-3">
          Log in
        </Link>
      </AppShell>
    );
  }

  return (
    <AppShell breadcrumb="My Workspace">
      <header className="max-w-prose">
        <h1 className="font-display text-[26px] font-semibold tracking-[-0.03em] text-mist">
          My properties
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">
          Every one of these was saved from a full report on{" "}
          <Link href="/analyse" className="underline decoration-line underline-offset-4 hover:text-mist">
            /analyse
          </Link>
          . The figures are the snapshot from when you saved it — tax rules and rents
          move, so re-run the report if it's been a while.
        </p>
      </header>

      {error !== null && (
        <p className="card mt-6 max-w-prose text-sm text-negative">{error}</p>
      )}

      {rows !== null && rows.length === 0 && (
        <p className="card mt-8 max-w-prose text-sm text-muted">
          Nothing saved yet.{" "}
          <Link href="/analyse" className="text-accent hover:underline">
            Analyse a property
          </Link>{" "}
          and use "Save to my portfolio" on its report.
        </p>
      )}

      <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {rows?.map((row) => (
          <PropertyCard
            key={row.property.id}
            row={row}
            deleting={deleting === row.property.id}
            onDelete={() => void remove(row.property.id)}
          />
        ))}
      </div>
    </AppShell>
  );
}

function PropertyCard({
  row,
  deleting,
  onDelete,
}: {
  readonly row: Row;
  readonly deleting: boolean;
  readonly onDelete: () => void;
}): React.JSX.Element {
  const { property, verdict } = row;
  const netYield = verdict?.payload.returns.netYield ?? null;
  const standing = gradeNetYield(netYield);
  const rating = verdict !== null ? rateVerdict(verdict.payload) : null;

  return (
    <article className="card">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[15px] font-semibold leading-snug">{property.label}</p>
        <span
          className="shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.08em]"
          style={{ color: standingColor[standing], backgroundColor: `${standingColor[standing]}1A` }}
        >
          {formatPercent(netYield)}
        </span>
      </div>

      <p className="tnum mt-2 font-display text-[20px] font-semibold tracking-[-0.02em]">
        {formatCompactMoney({ amount: property.priceMinor, currency: property.currency })}
      </p>

      {rating !== null && (
        <p className="mt-1 text-xs text-muted">{rating.stars.toFixed(1)}/5 · {rating.explanation}</p>
      )}

      <div className="mt-4 flex items-center gap-3">
        <Link
          href={`/analyse?property=${property.id}`}
          className="btn-secondary flex-1 !py-2 !text-[13px]"
        >
          Open
        </Link>
        <button
          type="button"
          onClick={onDelete}
          disabled={deleting}
          className="text-xs text-muted hover:text-negative disabled:opacity-50"
        >
          {deleting ? "Removing…" : "Remove"}
        </button>
      </div>
    </article>
  );
}
