"use client";

import type { Profile } from "@veela/db";
import Link from "next/link";
import { useEffect, useState } from "react";

import { AppShell } from "../../components/app-shell";
import { useAuth } from "../../components/auth-provider";
import {
  SettingRow,
  SettingsFooter,
  SettingsSection,
  Tabs,
  Toggle,
} from "../../components/settings-ui";

/**
 * Settings, laid out to a supplied reference design: tabs across the top, collapsible
 * sections with tinted headers, controls pushed right between Off/On labels, and a footer
 * bar with a secondary action left and Save right.
 *
 * **What was deliberately not copied from that reference.** Its General tab is six email
 * preference toggles — property alerts, marketing, blog, newsletter, product updates. This
 * product has no email pipeline at all: `/portfolio/alerts` already says outright that
 * tracking is real and alerting isn't wired up, and the shell's own rule is that every
 * control does something or it isn't there. Six switches that persist a preference nothing
 * reads would be exactly the dead chrome that rule exists to prevent. The Notifications
 * section says so instead, and links to the page where the real half lives.
 *
 * The reference's second tab, "Data Management", turned out to be the right home for work
 * that already existed and had nowhere obvious to sit: the PDPO aggregate-data consent and
 * the export/delete route promised in `/privacy`.
 */

const TABS = [
  { id: "general", label: "General Settings" },
  { id: "data", label: "Data Management" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function SettingsPage(): React.JSX.Element {
  const { user, loading, configured, signOut, updateEmail, updatePassword, hasPasswordIdentity } =
    useAuth();
  const [tab, setTab] = useState<TabId>("general");

  /* `?tab=data` so `/privacy` and the consent prompt can link straight to the section they
     are talking about, rather than to a page where the reader has to hunt for it. */
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("tab");
    if (requested === "data" || requested === "general") setTab(requested);
  }, []);

  function selectTab(id: string): void {
    const next = id as TabId;
    setTab(next);
    // Keeps the URL shareable without a navigation — replaceState, so Back still leaves
    // the page rather than cycling tabs.
    const url = new URL(window.location.href);
    url.searchParams.set("tab", next);
    window.history.replaceState(null, "", url);
  }

  if (!configured) {
    return (
      <AppShell breadcrumb="Settings">
        <p className="card max-w-prose text-sm text-muted">
          Sign-in isn&apos;t configured on this deployment, so there&apos;s no account to
          manage.
        </p>
      </AppShell>
    );
  }

  if (loading) {
    return (
      <AppShell breadcrumb="Settings">
        <p className="text-sm text-muted">Loading…</p>
      </AppShell>
    );
  }

  if (user === null) {
    return (
      <AppShell breadcrumb="Settings">
        <h1 className="font-display text-[26px] font-semibold tracking-[-0.03em] text-mist">
          Settings
        </h1>
        <p className="mt-3 max-w-prose text-sm text-muted">Log in to manage your account.</p>
        <Link href="/login?next=/account" className="btn-primary mt-5 inline-flex !px-6 !py-3">
          Log in
        </Link>
      </AppShell>
    );
  }

  return (
    <AppShell breadcrumb="Settings">
      <header>
        <h1 className="font-display text-[26px] font-semibold tracking-[-0.03em] text-mist">
          Settings
        </h1>
        <p className="mt-1.5 text-sm text-muted">
          Signed in as <span className="font-medium text-mist">{user.email}</span>
        </p>
      </header>

      <div className="mt-5">
        <Tabs tabs={TABS} active={tab} onChange={selectTab} />
      </div>

      <div className="mt-6 max-w-3xl space-y-5">
        {tab === "general" ? (
          <>
            <ProfileSection />
            <EmailSection currentEmail={user.email ?? ""} onSave={updateEmail} />
            <PasswordSection onSave={updatePassword} available={hasPasswordIdentity} />
            <NotificationsSection />
            <SessionSection onSignOut={() => void signOut()} />
          </>
        ) : (
          <DataManagementTab />
        )}
      </div>
    </AppShell>
  );
}

function ProfileSection(): React.JSX.Element {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    if (user === null) return;
    fetch("/api/profile")
      .then((res) => (res.ok ? res.json() : null))
      .then((json: { profile: Profile } | null) => {
        if (json !== null) setDisplayName(json.profile.displayName ?? "");
      })
      .catch(() => undefined);
  }, [user]);

  async function save(): Promise<void> {
    setState("saving");
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ displayName: displayName.trim() || null }),
      });
      setState(res.ok ? "saved" : "error");
    } catch {
      setState("error");
    }
  }

  return (
    <SettingsSection title="Profile">
      <SettingRow
        label="Display name"
        hint="Optional. Only you see it for now."
        htmlFor="account-display-name"
      >
        <input
          id="account-display-name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Optional"
          className="w-56 rounded-card border border-line bg-surfaceMuted px-3 py-2 text-sm outline-none focus:border-accent focus:bg-surface"
        />
      </SettingRow>
      <SettingsFooter>
        <StateNote state={state} savedLabel="Saved." />
        <button
          type="button"
          onClick={() => void save()}
          disabled={state === "saving"}
          className="btn-primary !px-6 !py-2.5 !text-sm disabled:pointer-events-none disabled:opacity-50"
        >
          {state === "saving" ? "Saving…" : "Save"}
        </button>
      </SettingsFooter>
    </SettingsSection>
  );
}

function EmailSection({
  currentEmail,
  onSave,
}: {
  readonly currentEmail: string;
  readonly onSave: (email: string) => Promise<string | null>;
}): React.JSX.Element {
  const [email, setEmail] = useState(currentEmail);
  const [state, setState] = useState<"idle" | "saving" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const changed = email.trim() !== "" && email.trim() !== currentEmail;

  async function save(): Promise<void> {
    setState("saving");
    setError(null);
    const message = await onSave(email.trim());
    if (message === null) setState("sent");
    else {
      setError(message);
      setState("error");
    }
  }

  return (
    <SettingsSection title="Email">
      <SettingRow
        label="Address you sign in with"
        hint="A confirmation link goes to the new address — nothing changes until you open it."
        htmlFor="account-email"
      >
        <input
          id="account-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          className="w-64 rounded-card border border-line bg-surfaceMuted px-3 py-2 text-sm outline-none focus:border-accent focus:bg-surface"
        />
      </SettingRow>
      <SettingsFooter>
        {state === "sent" ? (
          <span className="text-sm text-positive">
            Link sent to {email.trim()} — keep using {currentEmail} until you open it.
          </span>
        ) : (
          <>
            {error !== null && <span className="text-sm text-negative">{error}</span>}
            <button
              type="button"
              onClick={() => void save()}
              disabled={!changed || state === "saving"}
              className="btn-primary !px-6 !py-2.5 !text-sm disabled:pointer-events-none disabled:opacity-50"
            >
              {state === "saving" ? "Sending…" : "Save"}
            </button>
          </>
        )}
      </SettingsFooter>
    </SettingsSection>
  );
}

const MIN_PASSWORD = 8;

function PasswordSection({
  onSave,
  available,
}: {
  readonly onSave: (password: string) => Promise<string | null>;
  readonly available: boolean;
}): React.JSX.Element {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  if (!available) {
    return (
      <SettingsSection title="Password">
        <SettingRow label="This account signs in with Google">
          <span className="text-xs text-muted">Managed by Google</span>
        </SettingRow>
        <div className="pb-4 text-xs leading-relaxed text-muted">
          There is no Veela password on this account, so there is nothing to change here.
        </div>
      </SettingsSection>
    );
  }

  const longEnough = password.length >= MIN_PASSWORD;
  const matches = confirm === password;

  async function save(): Promise<void> {
    setState("saving");
    setError(null);
    const message = await onSave(password);
    if (message === null) {
      setState("saved");
      setPassword("");
      setConfirm("");
    } else {
      setError(message);
      setState("error");
    }
  }

  return (
    <SettingsSection title="Password">
      <SettingRow
        label="New password"
        hint={`${MIN_PASSWORD} characters minimum.`}
        htmlFor="account-new-password"
      >
        <input
          id="account-new-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          className="w-56 rounded-card border border-line bg-surfaceMuted px-3 py-2 text-sm outline-none focus:border-accent focus:bg-surface"
        />
      </SettingRow>
      <SettingRow label="Repeat it" htmlFor="account-repeat-password">
        <input
          id="account-repeat-password"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          className="w-56 rounded-card border border-line bg-surfaceMuted px-3 py-2 text-sm outline-none focus:border-accent focus:bg-surface"
        />
      </SettingRow>
      <SettingsFooter
        secondary={
          /* Say which rule is unmet rather than only disabling the button. */
          password.length > 0 && !longEnough ? (
            <span className="text-xs text-negative">
              {MIN_PASSWORD - password.length} more character
              {MIN_PASSWORD - password.length === 1 ? "" : "s"} needed.
            </span>
          ) : confirm.length > 0 && !matches ? (
            <span className="text-xs text-negative">The two don&apos;t match.</span>
          ) : error !== null ? (
            <span className="text-xs text-negative">{error}</span>
          ) : state === "saved" ? (
            <span className="text-xs text-positive">
              Changed. Other devices will need the new one.
            </span>
          ) : null
        }
      >
        <button
          type="button"
          onClick={() => void save()}
          disabled={!longEnough || !matches || state === "saving"}
          className="btn-primary !px-6 !py-2.5 !text-sm disabled:pointer-events-none disabled:opacity-50"
        >
          {state === "saving" ? "Changing…" : "Save"}
        </button>
      </SettingsFooter>
    </SettingsSection>
  );
}

/**
 * Where the reference had six email toggles. They are not here because nothing sends
 * email: there is no notification pipeline, and a preference nothing reads is a control
 * that lies about what it does.
 */
function NotificationsSection(): React.JSX.Element {
  return (
    <SettingsSection title="Notifications">
      <SettingRow
        label="Email alerts"
        hint="Not available yet — Veela sends no email beyond sign-in and confirmation links."
      >
        <Toggle checked={false} onChange={() => undefined} disabled label="Email alerts" />
      </SettingRow>
      <div className="pb-4 text-xs leading-relaxed text-muted">
        Marking a property as monitored already works and is stored —{" "}
        <Link href="/portfolio/alerts" className="text-accent hover:underline">
          Property Alerts
        </Link>{" "}
        — but nothing is delivered from it. When sending exists, the preferences will appear
        here rather than being switched on silently.
      </div>
    </SettingsSection>
  );
}

function SessionSection({ onSignOut }: { readonly onSignOut: () => void }): React.JSX.Element {
  return (
    <SettingsSection title="Session">
      <SettingRow
        label="Sign out of this device"
        hint="Your saved properties stay exactly where they are."
      >
        <button type="button" onClick={onSignOut} className="btn-secondary !px-5 !py-2 !text-sm">
          Sign out
        </button>
      </SettingRow>
    </SettingsSection>
  );
}

/** The reference's second tab, filled with the data questions that genuinely exist here. */
function DataManagementTab(): React.JSX.Element {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [aggregateConsent, setAggregateConsent] = useState(false);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    if (user === null) return;
    fetch("/api/profile")
      .then((res) => (res.ok ? res.json() : null))
      .then((json: { profile: Profile } | null) => {
        if (json === null) return;
        setProfile(json.profile);
        setAggregateConsent(json.profile.aggregateConsent);
      })
      .catch(() => undefined);
  }, [user]);

  async function save(consent: boolean): Promise<void> {
    setState("saving");
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ aggregateConsent: consent }),
      });
      setState(res.ok ? "saved" : "error");
    } catch {
      setState("error");
    }
  }

  const granted =
    profile?.aggregateConsentAt !== null && profile?.aggregateConsentAt !== undefined
      ? `Last granted ${new Date(profile.aggregateConsentAt).toLocaleDateString("en-HK")}.`
      : "Never granted.";

  return (
    <>
      <SettingsSection title="How your data is used">
        <SettingRow
          label="Let the properties I save feed Veela's aggregate market data"
          hint={
            <>
              Off by default. {granted}{" "}
              <Link href="/privacy" className="text-accent hover:underline">
                What this means
              </Link>
              .
            </>
          }
        >
          <Toggle
            checked={aggregateConsent}
            onChange={setAggregateConsent}
            label="Aggregate market data consent"
          />
        </SettingRow>
        <SettingsFooter
          secondary={
            aggregateConsent ? null : (
              <span className="text-xs text-muted">Nothing you save is used in aggregates.</span>
            )
          }
        >
          <StateNote state={state} savedLabel="Saved." />
          <button
            type="button"
            onClick={() => void save(aggregateConsent)}
            disabled={state === "saving"}
            className="btn-primary !px-6 !py-2.5 !text-sm disabled:pointer-events-none disabled:opacity-50"
          >
            {state === "saving" ? "Saving…" : "Save"}
          </button>
        </SettingsFooter>
      </SettingsSection>

      <SettingsSection title="Export and deletion">
        <SettingRow
          label="A copy of everything we hold, or delete the account"
          hint="Handled by hand for now — there is no self-serve button yet."
        >
          <Link href="/privacy" className="btn-secondary !px-5 !py-2 !text-sm">
            How to ask
          </Link>
        </SettingRow>
        <div className="pb-4 text-xs leading-relaxed text-muted">
          Under the PDPO you can see and correct what we hold about you. What that is, and
          who it is shared with, is listed on the{" "}
          <Link href="/privacy" className="text-accent hover:underline">
            privacy page
          </Link>
          .
        </div>
      </SettingsSection>
    </>
  );
}

function StateNote({
  state,
  savedLabel,
}: {
  readonly state: "idle" | "saving" | "saved" | "error";
  readonly savedLabel: string;
}): React.JSX.Element | null {
  if (state === "saved") return <span className="text-sm text-positive">{savedLabel}</span>;
  if (state === "error") return <span className="text-sm text-negative">Something went wrong.</span>;
  return null;
}
