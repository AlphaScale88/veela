"use client";

import type { Profile } from "@veela/db";
import Link from "next/link";
import { useEffect, useState } from "react";

import { AppShell } from "../../components/app-shell";
import { useAuth } from "../../components/auth-provider";

/**
 * Mashvisor's "Manage" — the real, buildable equivalent here isn't property/tenant
 * management (this product doesn't do that), it's the account settings the `profiles`
 * table already had columns for but no page: a display name, and the aggregate-data
 * consent flagged as an open PDPO question in `.claude/CLAUDE.md`. `homeJurisdiction`
 * is deliberately not editable here — there's only one jurisdiction to set it to.
 */
export default function AccountPage(): React.JSX.Element {
  const { user, loading, configured, signOut } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [aggregateConsent, setAggregateConsent] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    if (user === null) return;
    fetch("/api/profile")
      .then((res) => (res.ok ? res.json() : null))
      .then((json: { profile: Profile } | null) => {
        if (json === null) return;
        setProfile(json.profile);
        setDisplayName(json.profile.displayName ?? "");
        setAggregateConsent(json.profile.aggregateConsent);
      })
      .catch(() => undefined);
  }, [user]);

  async function save(): Promise<void> {
    setSaveState("saving");
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ displayName: displayName.trim() || null, aggregateConsent }),
      });
      setSaveState(res.ok ? "saved" : "error");
    } catch {
      setSaveState("error");
    }
  }

  if (!configured) {
    return (
      <AppShell breadcrumb="Manage">
        <p className="card max-w-prose text-sm text-muted">
          Sign-in isn't configured on this deployment, so there's no account to manage.
        </p>
      </AppShell>
    );
  }

  if (loading) {
    return (
      <AppShell breadcrumb="Manage">
        <p className="text-sm text-muted">Loading…</p>
      </AppShell>
    );
  }

  if (user === null) {
    return (
      <AppShell breadcrumb="Manage">
        <h1 className="font-display text-[26px] font-semibold tracking-[-0.03em] text-mist">
          Manage
        </h1>
        <p className="mt-3 max-w-prose text-sm text-muted">Log in to manage your account.</p>
        <Link href="/login?next=/account" className="btn-primary mt-5 inline-flex !px-6 !py-3">
          Log in
        </Link>
      </AppShell>
    );
  }

  return (
    <AppShell breadcrumb="Manage">
      <header className="max-w-prose">
        <h1 className="font-display text-[26px] font-semibold tracking-[-0.03em] text-mist">
          Manage
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Signed in as <span className="font-medium text-mist">{user.email}</span>.
        </p>
      </header>

      <div className="card mt-6 max-w-lg space-y-5">
        <label className="block">
          <span className="text-sm font-medium">Display name</span>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Optional"
            className="tnum mt-1.5 w-full rounded-card border border-line bg-surfaceMuted px-3 py-2.5 text-[15px] outline-none focus:border-accent focus:bg-surface"
          />
        </label>

        <label className="flex cursor-pointer items-start gap-2.5 rounded-card bg-surfaceMuted px-3.5 py-3 text-sm">
          <input
            type="checkbox"
            checked={aggregateConsent}
            onChange={(e) => setAggregateConsent(e.target.checked)}
            className="mt-0.5 size-4 shrink-0 accent-accent"
          />
          <span>
            Let the properties I save feed Veela's aggregate market data
            <span className="mt-0.5 block text-xs leading-snug text-muted">
              Off by default. {profile?.aggregateConsentAt !== null && profile?.aggregateConsentAt !== undefined
                ? `Last granted ${new Date(profile.aggregateConsentAt).toLocaleDateString("en-HK")}.`
                : "Never granted."}
            </span>
          </span>
        </label>

        <div>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saveState === "saving"}
            className="btn-primary !px-6 !py-2.5 disabled:pointer-events-none disabled:opacity-50"
          >
            {saveState === "saving" ? "Saving…" : "Save"}
          </button>
          {saveState === "saved" && <span className="ml-3 text-sm text-positive">Saved.</span>}
          {saveState === "error" && (
            <span className="ml-3 text-sm text-negative">Something went wrong.</span>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={() => void signOut()}
        className="mt-6 text-sm text-muted hover:text-negative"
      >
        Sign out
      </button>
    </AppShell>
  );
}
