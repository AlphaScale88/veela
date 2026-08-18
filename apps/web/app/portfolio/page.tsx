"use client";

import type { Verdict as CoreVerdict } from "@veela/core";
import type { Property } from "@veela/db";
import { formatCompactMoney, formatPercent, gradeNetYield, rateVerdict, standingColor } from "@veela/ui";
import Link from "next/link";
import { useEffect, useState } from "react";

import { AppShell } from "../../components/app-shell";
import { useAuth } from "../../components/auth-provider";
import { BuildingIcon } from "../../components/icons";
import { PortfolioSummary } from "../../components/portfolio-summary";
import { PropertyNotes } from "../../components/property-notes";
import { PropertyPhotos } from "../../components/property-photos";
import { removeStoredPhotos, signedUrls, type PropertyPhoto } from "../../lib/property-photos";

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
  /** Cover photo per property, as a signed URL. Fetched once for the whole list rather than
   *  per card — a portfolio of twenty would otherwise mint twenty signatures in twenty round
   *  trips just to draw its thumbnails. */
  const [covers, setCovers] = useState<ReadonlyMap<string, string>>(new Map());
  /** Which card has its photo manager open. One at a time: the grid is the overview, and two
   *  expanded managers side by side stop it being one. */
  const [managing, setManaging] = useState<string | null>(null);
  /** Which card has its notes open. Separate from `managing` so photos and notes can be open at
   *  once on one card — they are read together when deciding about a flat. */
  const [noting, setNoting] = useState<string | null>(null);

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

  /* Covers come from one batch endpoint, then one batch signing call. Signatures expire, so
     they are never persisted — this re-runs whenever the list does. */
  useEffect(() => {
    if (user === null) return;
    let cancelled = false;
    void (async () => {
      const res = await fetch("/api/photos/covers");
      if (!res.ok || cancelled) return;
      const { covers: rows } = (await res.json()) as { covers: PropertyPhoto[] };
      const urls = await signedUrls(rows.map((r) => r.storagePath));
      if (cancelled) return;
      const byProperty = new Map<string, string>();
      for (const row of rows) {
        const url = urls.get(row.storagePath);
        if (url !== undefined) byProperty.set(row.propertyId, url);
      }
      setCovers(byProperty);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, rows]);

  async function remove(id: string): Promise<void> {
    setDeleting(id);
    try {
      const res = await fetch(`/api/properties/${id}`, { method: "DELETE" });
      if (res.ok || res.status === 404) {
        /* The photo *rows* cascade in Postgres, but the image objects do not — they would
           survive in the bucket with nothing pointing at them, which is a retention problem
           rather than a tidiness one: photographs of somebody's home outliving their request
           to delete it. The API hands back the keys precisely so this can finish the job. */
        if (res.ok) {
          const { storagePaths } = (await res.json()) as { storagePaths?: string[] };
          if (storagePaths !== undefined && storagePaths.length > 0) {
            await removeStoredPhotos(storagePaths);
          }
        }
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

      {/* Totals first. Every landlord tool in this price bracket opens on the portfolio rather
          than on a list of individual properties, and /portfolio never once said what the whole
          thing was worth or earned. Summed from the same stored snapshots the cards show, so the
          two cannot disagree. */}
      {rows !== null && rows.length > 0 && (
        <div className="mt-8">
          <PortfolioSummary rows={rows} />
        </div>
      )}

      <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {rows?.map((row) => (
          <PropertyCard
            key={row.property.id}
            row={row}
            coverUrl={covers.get(row.property.id)}
            ownerId={user?.id ?? ""}
            managing={managing === row.property.id}
            onToggleManage={() =>
              setManaging((cur) => (cur === row.property.id ? null : row.property.id))
            }
            noting={noting === row.property.id}
            onToggleNotes={() =>
              setNoting((cur) => (cur === row.property.id ? null : row.property.id))
            }
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
  coverUrl,
  ownerId,
  managing,
  onToggleManage,
  noting,
  onToggleNotes,
  deleting,
  onDelete,
}: {
  readonly row: Row;
  readonly coverUrl: string | undefined;
  readonly ownerId: string;
  readonly managing: boolean;
  readonly onToggleManage: () => void;
  readonly noting: boolean;
  readonly onToggleNotes: () => void;
  readonly deleting: boolean;
  readonly onDelete: () => void;
}): React.JSX.Element {
  const { property, verdict } = row;
  const netYield = verdict?.payload.returns.netYield ?? null;
  const standing = gradeNetYield(netYield);
  const rating = verdict !== null ? rateVerdict(verdict.payload) : null;

  return (
    <article className="card">
      {/* The cover, when there is one. **No placeholder image when there is not** — a stock
          interior standing in for a reader's own flat is exactly the false claim this product
          refuses to make with a number, and it would be worse here than on the demo listings,
          because this card is about a real property they own. An absent photo is absent. */}
      {coverUrl !== undefined && (
        /* eslint-disable-next-line @next/next/no-img-element -- signed URL from a private
           bucket, expiring hourly; next/image would need the host allow-listed and would
           cache a URL built to expire. */
        <img
          src={coverUrl}
          alt=""
          className="mb-3 aspect-[16/9] w-full rounded-card object-cover"
        />
      )}

      <div className="flex items-start justify-between gap-2">
        {/* The same building mark the /analyse saved-reports shelf uses, so a saved property
            looks like the same object in both places. */}
        <p className="flex min-w-0 items-start gap-2.5 text-[15px] font-semibold leading-snug">
          <span className="mt-px flex h-8 w-8 shrink-0 items-center justify-center rounded-card bg-accent/10 text-accent">
            <BuildingIcon className="h-4 w-4" />
          </span>
          <span className="min-w-0">{property.label}</span>
        </p>
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
          onClick={onToggleManage}
          aria-expanded={managing}
          className="text-xs text-muted hover:text-mist"
        >
          {managing ? "Hide photos" : "Photos"}
        </button>
        <button
          type="button"
          onClick={onToggleNotes}
          aria-expanded={noting}
          className="text-xs text-muted hover:text-mist"
        >
          {noting ? "Hide notes" : "Notes"}
        </button>
        {/* "Delete property", not "Remove". The photo manager below this row has a Remove
            button on every tile, and two destructive controls a few pixels apart reading the
            same word is how somebody deletes a property while meaning to drop a photo. Caught
            by a test doing exactly that. */}
        <button
          type="button"
          onClick={onDelete}
          disabled={deleting}
          className="text-xs text-muted hover:text-negative disabled:opacity-50"
        >
          {deleting ? "Deleting…" : "Delete property"}
        </button>
      </div>

      {managing && (
        <div className="mt-4 border-t border-line pt-4">
          <PropertyPhotos propertyId={property.id} ownerId={ownerId} />
        </div>
      )}

      {noting && (
        <div className="mt-4 border-t border-line pt-4">
          <PropertyNotes propertyId={property.id} />
        </div>
      )}

      {property.sourceUrl !== null && (
        /* Where the figures came from. `rel="noreferrer"` because this is a URL the reader
           supplied and we never verified — it should not carry our page as a referrer. */
        <p className="mt-3 truncate text-[11px] text-muted">
          Imported from{" "}
          <a
            href={property.sourceUrl}
            target="_blank"
            rel="noreferrer nofollow"
            className="text-accent hover:underline"
          >
            {hostOf(property.sourceUrl)}
          </a>
          {property.address !== null && ` · ${property.address}`}
        </p>
      )}
    </article>
  );
}

/** The host alone, not the whole URL: a portal permalink is long, opaque and would wrap over
 *  three lines to say less than its domain does. */
function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "the listing";
  }
}
