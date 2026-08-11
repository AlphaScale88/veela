"use client";

import type { Profile } from "@veela/db";
import Link from "next/link";
import { useEffect, useState } from "react";

import { AppShell } from "../../components/app-shell";
import { useAuth } from "../../components/auth-provider";

/**
 * Settings. Was a two-field page (display name, aggregate consent) called "Manage"; it is
 * now the one place an account is administered, which is where a reader looks for these
 * things by convention.
 *
 * **Sign out lives here, not in the sidebar.** It was in the sidebar footer, one stray
 * click away from every page — a destructive-ish action sitting permanently beside the
 * navigation. Asked to move it inside settings, which is also where it belongs: the
 * sidebar now shows who you are and links here.
 *
 * Each section saves independently. One page-wide Save would mean a password change and a
 * consent toggle share a success state, and a failure in either would leave the reader
 * unsure which half landed.
 */
export default function SettingsPage(): React.JSX.Element {
  const { user, loading, configured, signOut, updateEmail, updatePassword, hasPasswordIdentity } =
    useAuth();

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
      <header className="max-w-prose">
        <h1 className="font-display text-[26px] font-semibold tracking-[-0.03em] text-mist">
          Settings
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Signed in as <span className="font-medium text-mist">{user.email}</span>.
        </p>
      </header>

      <div className="mt-6 max-w-lg space-y-5">
        <ProfileSection />
        <EmailSection currentEmail={user.email ?? ""} onSave={updateEmail} />
        {hasPasswordIdentity ? (
          <PasswordSection onSave={updatePassword} />
        ) : (
          <Section title="Password">
            <p className="text-sm leading-relaxed text-muted">
              This account signs in with Google, so it has no Veela password to change.
              Manage it in your Google account instead.
            </p>
          </Section>
        )}
        <DataSection />

        <Section title="Sign out">
          <p className="text-sm leading-relaxed text-muted">
            Ends this session on this device. Your saved properties stay where they are.
          </p>
          <button
            type="button"
            onClick={() => void signOut()}
            className="btn-secondary mt-3 !px-5 !py-2.5 !text-sm"
          >
            Sign out
          </button>
        </Section>
      </div>
    </AppShell>
  );
}

function Section({
  title,
  children,
}: {
  readonly title: string;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return (
    <section className="card">
      <h2 className="text-[15px] font-semibold">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

/** Display name and the aggregate-data consent — the two fields this page already had,
 *  unchanged in behaviour, now just one section among several. */
function ProfileSection(): React.JSX.Element {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [aggregateConsent, setAggregateConsent] = useState(false);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");

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
    setState("saving");
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ displayName: displayName.trim() || null, aggregateConsent }),
      });
      setState(res.ok ? "saved" : "error");
    } catch {
      setState("error");
    }
  }

  return (
    <Section title="Profile">
      <label className="block">
        <span className="text-xs text-muted">Display name</span>
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Optional"
          className="mt-1 w-full rounded-card border border-line bg-surfaceMuted px-3 py-2.5 text-[15px] outline-none focus:border-accent focus:bg-surface"
        />
      </label>

      <label className="mt-4 flex cursor-pointer items-start gap-2.5 rounded-card bg-surfaceMuted px-3.5 py-3 text-sm">
        <input
          type="checkbox"
          checked={aggregateConsent}
          onChange={(e) => setAggregateConsent(e.target.checked)}
          className="mt-0.5 size-4 shrink-0 accent-accent"
        />
        <span>
          Let the properties I save feed Veela&apos;s aggregate market data
          <span className="mt-0.5 block text-xs leading-snug text-muted">
            Off by default.{" "}
            {profile?.aggregateConsentAt !== null && profile?.aggregateConsentAt !== undefined
              ? `Last granted ${new Date(profile.aggregateConsentAt).toLocaleDateString("en-HK")}.`
              : "Never granted."}{" "}
            <Link href="/privacy" className="text-accent hover:underline">
              What this means
            </Link>
            .
          </span>
        </span>
      </label>

      <SaveRow state={state} onSave={() => void save()} />
    </Section>
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
    <Section title="Email">
      <label className="block">
        <span className="text-xs text-muted">Address you sign in with</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          className="mt-1 w-full rounded-card border border-line bg-surfaceMuted px-3 py-2.5 text-[15px] outline-none focus:border-accent focus:bg-surface"
        />
      </label>

      {/* The important part: nothing has changed yet. Supabase mails a confirmation link
          to the new address and the change lands only when it is clicked, so reporting
          "saved" here would be a lie the user finds out about at their next login. */}
      {state === "sent" ? (
        <p className="mt-3 text-sm leading-relaxed text-positive">
          Confirmation sent to <strong>{email.trim()}</strong>. Your address changes when
          you open that link — until then, keep signing in with {currentEmail}.
        </p>
      ) : (
        <>
          {error !== null && (
            <p role="alert" className="mt-3 text-xs text-negative">
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={() => void save()}
            disabled={!changed || state === "saving"}
            className="btn-secondary mt-3 !px-5 !py-2.5 !text-sm disabled:pointer-events-none disabled:opacity-50"
          >
            {state === "saving" ? "Sending…" : "Change email"}
          </button>
          <p className="mt-2 text-xs text-muted">
            We send a confirmation link to the new address before anything changes.
          </p>
        </>
      )}
    </Section>
  );
}

const MIN_PASSWORD = 8;

function PasswordSection({
  onSave,
}: {
  readonly onSave: (password: string) => Promise<string | null>;
}): React.JSX.Element {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const longEnough = password.length >= MIN_PASSWORD;
  const matches = confirm === password;
  const canSave = longEnough && matches && state !== "saving";

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
    <Section title="Password">
      <label className="block">
        <span className="text-xs text-muted">New password</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          className="mt-1 w-full rounded-card border border-line bg-surfaceMuted px-3 py-2.5 text-[15px] outline-none focus:border-accent focus:bg-surface"
        />
      </label>
      <label className="mt-3 block">
        <span className="text-xs text-muted">Repeat it</span>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          className="mt-1 w-full rounded-card border border-line bg-surfaceMuted px-3 py-2.5 text-[15px] outline-none focus:border-accent focus:bg-surface"
        />
      </label>

      {/* Say which rule is unmet rather than disabling the button silently. */}
      {password.length > 0 && !longEnough && (
        <p className="mt-2 text-xs text-negative">
          {MIN_PASSWORD - password.length} more character
          {MIN_PASSWORD - password.length === 1 ? "" : "s"} needed.
        </p>
      )}
      {confirm.length > 0 && !matches && (
        <p className="mt-2 text-xs text-negative">The two don&apos;t match.</p>
      )}
      {error !== null && (
        <p role="alert" className="mt-2 text-xs text-negative">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={() => void save()}
        disabled={!canSave}
        className="btn-secondary mt-3 !px-5 !py-2.5 !text-sm disabled:pointer-events-none disabled:opacity-50"
      >
        {state === "saving" ? "Changing…" : "Change password"}
      </button>
      {state === "saved" && (
        <p className="mt-2 text-sm text-positive">
          Password changed. You stay signed in here; other devices will need the new one.
        </p>
      )}
    </Section>
  );
}

/**
 * Export and deletion. Neither is self-serve yet, and `/privacy` already promises a
 * by-hand route under DPP6 — so this states the real position rather than showing a button
 * that does nothing.
 */
function DataSection(): React.JSX.Element {
  return (
    <Section title="Your data">
      <p className="text-sm leading-relaxed text-muted">
        Exporting everything we hold, or deleting your account entirely, is handled by hand
        for now — there&apos;s no self-serve button yet.{" "}
        <Link href="/privacy" className="text-accent hover:underline">
          How to ask, and what we hold
        </Link>
        .
      </p>
    </Section>
  );
}

function SaveRow({
  state,
  onSave,
}: {
  readonly state: "idle" | "saving" | "saved" | "error";
  readonly onSave: () => void;
}): React.JSX.Element {
  return (
    <div className="mt-4 flex items-center gap-3">
      <button
        type="button"
        onClick={onSave}
        disabled={state === "saving"}
        className="btn-secondary !px-5 !py-2.5 !text-sm disabled:pointer-events-none disabled:opacity-50"
      >
        {state === "saving" ? "Saving…" : "Save"}
      </button>
      {state === "saved" && <span className="text-sm text-positive">Saved.</span>}
      {state === "error" && <span className="text-sm text-negative">Something went wrong.</span>}
    </div>
  );
}
