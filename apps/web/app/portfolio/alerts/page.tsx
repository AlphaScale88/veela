"use client";

import type { Property } from "@veela/db";
import Link from "next/link";
import { useEffect, useState } from "react";

import { AppShell } from "../../../components/app-shell";
import { useAuth } from "../../../components/auth-provider";

/**
 * Property Alerts — scoped honestly to what actually exists. Mashvisor's version
 * watches live market data and pushes a notification when something changes. Veela
 * has neither piece yet: no ingestion job (`.claude/CLAUDE.md`'s "Deliberately not
 * built yet" list) and no notification pipeline — that's Tier 4 (an always-on
 * service), which the workspace's own boilerplate taxonomy says not to scaffold until
 * a live feed actually forces it.
 *
 * What's real: `properties.monitored` already exists as a column (`true once the user
 * asks us to track it against the market`). This page is the toggle for that intent,
 * said plainly rather than dressed up as a working alert feed.
 */
export default function AlertsPage(): React.JSX.Element {
  const { user, loading, configured } = useAuth();
  const [properties, setProperties] = useState<Property[] | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    if (user === null) return;
    fetch("/api/properties")
      .then((res) => (res.ok ? res.json() : null))
      .then((json: { properties: Property[] } | null) => {
        if (json !== null) setProperties(json.properties);
      });
  }, [user]);

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
          Tracking is real; the alert itself isn't wired up yet. There's no live market
          feed to compare a tracked property against — see Market Performance and
          Market Regulations for what's already real. This is where that connects once
          the ingestion job exists.
        </p>
      </header>

      <div className="mt-6 max-w-prose rounded-panel border border-caution/40 bg-caution/10 px-4 py-3 shadow-card">
        <p className="text-xs leading-relaxed text-muted">
          <strong className="text-mist">
            {trackedCount} {trackedCount === 1 ? "property" : "properties"} tracked.
          </strong>{" "}
          No notification will be sent — toggling this records intent, not a working
          alert.
        </p>
      </div>

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
