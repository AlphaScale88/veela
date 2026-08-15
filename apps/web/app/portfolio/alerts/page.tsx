"use client";

import type { Alert } from "@veela/api/alerts";
import type { Property } from "@veela/db";
import Link from "next/link";
import { useEffect, useState } from "react";

import { AppShell } from "../../../components/app-shell";
import { useAuth } from "../../../components/auth-provider";

/**
 * Property Alerts — **now a working alert feed, not a toggle recording intent.**
 *
 * This page used to say: *"Tracking is real; the alert itself isn't wired up yet. There's no
 * live market feed to compare a tracked property against."* That was true when written and
 * **quietly stopped being true**, because the repo has since ingested RVD's monthly rent and
 * price indices and gained stamp duty rule sets versioned by effective date. Those are exactly
 * the two things a saved snapshot goes stale against: the market moved, or the rules moved.
 * Neither needs a listings feed or a data licence.
 *
 * The engine is `packages/api/src/alerts.ts` and it runs server-side, so the same alerts can
 * be emailed as a digest later without rewriting any of this.
 *
 * **Every alert shows its own evidence** — the series, the two dates, the two values — the same
 * condition the area score and the star rating live under. And **no alerts is the good
 * outcome**, said as such, rather than a reassurance card that would make "nothing changed"
 * look identical to "not working".
 */
export default function AlertsPage(): React.JSX.Element {
  const { user, loading, configured } = useAuth();
  const [properties, setProperties] = useState<Property[] | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<Alert[] | null>(null);

  useEffect(() => {
    if (user === null) return;
    fetch("/api/properties")
      .then((res) => (res.ok ? res.json() : null))
      .then((json: { properties: Property[] } | null) => {
        if (json !== null) setProperties(json.properties);
      });
  }, [user]);

  /* Re-read whenever tracking changes, so turning a property on produces its alerts
     immediately rather than on the next visit. */
  const trackedKey = (properties ?? []).filter((p) => p.monitored).map((p) => p.id).join(",");
  useEffect(() => {
    if (user === null) return;
    let cancelled = false;
    setAlerts(null);
    fetch("/api/alerts")
      .then((res) => (res.ok ? res.json() : null))
      .then((json: { alerts: Alert[] } | null) => {
        if (json !== null && !cancelled) setAlerts(json.alerts);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [user, trackedKey]);

  async function setMonitored(id: string, monitored: boolean): Promise<void> {
    setUpdating(id);
    try {
      const res = await fetch(`/api/properties/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ monitored }),
      });
      if (res.ok) {
        const { property } = (await res.json()) as { property: Property };
        setProperties((rows) => rows?.map((r) => (r.id === id ? property : r)) ?? rows);
      }
    } finally {
      setUpdating(null);
    }
  }

  if (!configured) {
    return (
      <AppShell breadcrumb="My Workspace › Property Alerts">
        <p className="card max-w-prose text-sm text-muted">
          Sign-in isn't configured on this deployment.
        </p>
      </AppShell>
    );
  }

  if (loading) {
    return (
      <AppShell breadcrumb="My Workspace › Property Alerts">
        <p className="text-sm text-muted">Loading…</p>
      </AppShell>
    );
  }

  if (user === null) {
    return (
      <AppShell breadcrumb="My Workspace › Property Alerts">
        <h1 className="font-display text-[26px] font-semibold tracking-[-0.03em] text-mist">
          Property Alerts
        </h1>
        <p className="mt-3 max-w-prose text-sm text-muted">Log in to track saved properties.</p>
        <Link href="/login?next=/portfolio/alerts" className="btn-primary mt-5 inline-flex !px-6 !py-3">
          Log in
        </Link>
      </AppShell>
    );
  }

  const trackedCount = properties?.filter((p) => p.monitored).length ?? 0;

  return (
    <AppShell breadcrumb="My Workspace › Property Alerts">
      <header className="max-w-prose">
        <h1 className="font-display text-[26px] font-semibold tracking-[-0.03em] text-mist">
          Property Alerts
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          A saved report is a dated snapshot. These are the ways one goes out of date: the
          market moved, or the rules did. Checked against the Rating and Valuation
          Department&apos;s published monthly indices and the stamp duty rule set that applies
          to each property&apos;s transaction date.
        </p>
      </header>

      <AlertFeed alerts={alerts} trackedCount={trackedCount} />

      <h2 className="mt-10 font-display text-[18px] font-semibold tracking-[-0.02em] text-mist">
        What&apos;s being tracked
      </h2>
      <p className="mt-1 max-w-prose text-sm text-muted">
        Only tracked properties are checked. Untrack anything you have stopped caring about.
      </p>

      {properties !== null && properties.length === 0 && (
        <p className="card mt-8 max-w-prose text-sm text-muted">
          Nothing saved yet.{" "}
          <Link href="/analyse" className="text-accent hover:underline">
            Analyse a property
          </Link>{" "}
          and save it first.
        </p>
      )}

      <div className="mt-6 space-y-3">
        {properties?.map((p) => (
          <div key={p.id} className="card flex items-center justify-between gap-4">
            <div>
              <p className="text-[15px] font-semibold">{p.label}</p>
              <p className="text-xs text-muted">
                {p.monitored ? "Tracked" : "Not tracked"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void setMonitored(p.id, !p.monitored)}
              disabled={updating === p.id}
              aria-pressed={p.monitored}
              className={`shrink-0 rounded-full border px-4 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                p.monitored
                  ? "border-accent bg-accent text-white"
                  : "border-line text-muted hover:text-mist"
              }`}
            >
              {updating === p.id ? "…" : p.monitored ? "Tracking" : "Track"}
            </button>
          </div>
        ))}
      </div>
    </AppShell>
  );
}

/**
 * The feed.
 *
 * Four states, and the distinction between the last two is the point: **"nothing has changed"
 * and "nothing is being watched" are different answers**, and a page that renders the same
 * empty box for both teaches the reader to distrust it.
 */
function AlertFeed({
  alerts,
  trackedCount,
}: {
  readonly alerts: readonly Alert[] | null;
  readonly trackedCount: number;
}): React.JSX.Element {
  if (trackedCount === 0) {
    return (
      <p className="card mt-6 max-w-prose text-sm leading-relaxed text-muted">
        Nothing is being tracked yet. Turn on tracking for a saved property below and it will be
        checked against the market indices and the stamp duty rules from then on.
      </p>
    );
  }

  if (alerts === null) {
    return (
      <p className="mt-6 text-sm text-muted">
        Checking {trackedCount} {trackedCount === 1 ? "property" : "properties"} against the
        latest published figures…
      </p>
    );
  }

  if (alerts.length === 0) {
    return (
      <div className="card mt-6 max-w-prose">
        <p className="text-sm font-semibold text-mist">Nothing has moved enough to flag.</p>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">
          {trackedCount} {trackedCount === 1 ? "property is" : "properties are"} being watched.
          An alert fires when market rents move 3%, prices move 5%, the stamp duty rules change,
          or a snapshot passes six months old — measured from the day each report was computed.
        </p>
      </div>
    );
  }

  return (
    <ul className="mt-6 space-y-3">
      {alerts.map((a) => {
        const attention = a.severity === "attention";
        return (
          <li
            key={a.id}
            className="card border-l-[3px]"
            style={{ borderLeftColor: attention ? tokensCaution : tokensLine }}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <h3 className="text-[15px] font-medium text-mist">{a.title}</h3>
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted">
                {a.propertyLabel}
              </span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted">{a.detail}</p>
            {/* The working, always. A reader who cannot check the claim cannot trust the next
                one either. */}
            <p className="mt-2.5 border-t border-line pt-2 font-mono text-[10px] leading-relaxed text-muted">
              {a.evidence}
            </p>
            <Link
              href={`/analyse?property=${a.propertyId}`}
              className="btn-secondary mt-3 inline-flex !px-4 !py-1.5 !text-xs"
            >
              Re-run this report
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/* Read straight off the design tokens rather than a Tailwind class, because the border colour
   is set inline to vary per severity — the same approach `verdict-view.tsx` uses for findings. */
const tokensCaution = "#B26B00";
const tokensLine = "#E2E6EE";
