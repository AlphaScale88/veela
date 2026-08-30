"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useAuth } from "../../components/auth-provider";

const MIN_PASSWORD = 10;

/**
 * One route, two jobs, chosen by whether a session exists.
 *
 * - **No session** → the request form. You forgot your password, so by definition you are not
 *   signed in when you arrive here.
 * - **Session** → the "choose a new password" form. Supabase's recovery link goes through
 *   `/auth/callback`, which exchanges the token for a real session and then sends you here, so
 *   arriving *with* one is exactly the signal that the link was followed.
 *
 * Two routes would have been tidier to describe and worse to use: the second one is reachable
 * only through an email link, so a reader who lands on it with no session has nothing to do
 * there and no way to explain why.
 *
 * **The request form never says whether the address has an account.** Supabase answers the same
 * way either way on purpose, and repeating that here would turn the form into an
 * account-enumeration oracle — type an address, learn whether that person is a customer. The
 * copy is written to be true whichever it was.
 */
export default function ResetPasswordPage(): React.JSX.Element {
  const { user, loading, configured, sendPasswordReset, updatePassword, hasPasswordIdentity } =
    useAuth();

  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A finished reset leaves you signed in; there is nothing left on this page to do.
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => window.location.assign("/portfolio"), 1200);
    return () => clearTimeout(t);
  }, [done]);

  if (!configured) {
    return (
      <AuthShell title="Reset your password">
        <p className="text-sm text-muted">
          Password reset isn&apos;t configured on this deployment. Everything that doesn&apos;t
          need an account still works.
        </p>
      </AuthShell>
    );
  }

  if (loading) {
    return (
      <AuthShell title="Reset your password">
        <p className="text-sm text-muted">Checking your link…</p>
      </AuthShell>
    );
  }

  // ── Arrived from the recovery link: set the new password.
  if (user !== null) {
    if (done) {
      return (
        <AuthShell title="Password changed">
          <p className="text-sm text-muted">
            You&apos;re signed in. Taking you to your properties…
          </p>
        </AuthShell>
      );
    }

    const longEnough = password.length >= MIN_PASSWORD;
    const matches = password === confirm;

    return (
      <AuthShell title="Choose a new password">
        <p className="mb-4 text-sm text-muted">
          Signed in as <strong className="text-mist">{user.email}</strong>. Pick something you
          have not used here before.
        </p>
        {/* A Google-only account has no password to reset. Saying so beats letting someone set
            one they will never be asked for, then wondering why the Google button is still the
            only way in. */}
        {!hasPasswordIdentity && (
          <p className="mb-4 rounded-card border border-caution/40 bg-caution/10 px-3 py-2.5 text-xs leading-relaxed text-muted">
            This account signs in with Google. Setting a password here adds a second way in; it
            does not replace Google.
          </p>
        )}
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!longEnough || !matches || pending) return;
            setPending(true);
            setError(null);
            void updatePassword(password)
              .then((message) => {
                if (message !== null) setError(message);
                else setDone(true);
              })
              .finally(() => setPending(false));
          }}
        >
          <label className="block">
            <span className="text-sm font-medium">New password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              className="mt-1 w-full rounded-card border border-line bg-surfaceMuted px-3 py-2.5 text-sm outline-none focus:border-accent focus:bg-surface"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Repeat it</span>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              className="mt-1 w-full rounded-card border border-line bg-surfaceMuted px-3 py-2.5 text-sm outline-none focus:border-accent focus:bg-surface"
            />
          </label>

          <p className="text-xs text-muted">
            {password.length > 0 && !longEnough
              ? `At least ${MIN_PASSWORD} characters — that one is ${password.length}.`
              : confirm.length > 0 && !matches
                ? "The two do not match."
                : `At least ${MIN_PASSWORD} characters.`}
          </p>

          {error !== null && (
            <p role="alert" className="text-sm text-negative">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={!longEnough || !matches || pending}
            className="btn-primary w-full !py-3 disabled:pointer-events-none disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save the new password"}
          </button>
        </form>
      </AuthShell>
    );
  }

  // ── No session: ask where to send the link.
  if (sent) {
    return (
      <AuthShell title="Check your email">
        <p className="text-sm leading-relaxed text-muted">
          If <strong className="text-mist">{email.trim()}</strong> has an account, a reset link is
          on its way. It can take a minute, and it may be in spam.
        </p>
        <p className="mt-3 text-xs leading-relaxed text-muted">
          Open it in this browser if you can. The link signs you in and brings you straight back
          here to set a new password.
        </p>
        <Link href="/login" className="btn-secondary mt-5 w-full !py-2.5">
          Back to log in
        </Link>
      </AuthShell>
    );
  }

  const emailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  return (
    <AuthShell title="Reset your password">
      <p className="mb-4 text-sm leading-relaxed text-muted">
        Tell us the address on the account and we will send a link that signs you in long enough
        to choose a new password.
      </p>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!emailLooksValid || pending) return;
          setPending(true);
          setError(null);
          void sendPasswordReset(email.trim())
            .then((message) => {
              // Only a transport-level failure is shown. "No such account" is deliberately not
              // distinguishable — see the note at the top of this file.
              if (message !== null) setError(message);
              else setSent(true);
            })
            .finally(() => setPending(false));
        }}
      >
        <label className="block">
          <span className="text-sm font-medium">Email address</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            placeholder="you@example.com"
            className="mt-1 w-full rounded-card border border-line bg-surfaceMuted px-3 py-2.5 text-sm outline-none focus:border-accent focus:bg-surface"
          />
        </label>

        {error !== null && (
          <p role="alert" className="text-sm text-negative">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={!emailLooksValid || pending}
          className="btn-primary w-full !py-3 disabled:pointer-events-none disabled:opacity-50"
        >
          {pending ? "Sending…" : "Send the reset link"}
        </button>
      </form>

      <p className="mt-4 text-sm text-muted">
        Remembered it?{" "}
        <Link href="/login" className="font-medium text-accent hover:underline">
          Log in
        </Link>
      </p>
    </AuthShell>
  );
}

/** The narrow centred card `/login` and `/signup` both use, local to this route. */
function AuthShell({
  title,
  children,
}: {
  readonly title: string;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="col max-w-sm py-20">
      <h1 className="font-display text-[26px] font-semibold tracking-[-0.03em] text-mist">
        {title}
      </h1>
      <div className="mt-5">{children}</div>
    </div>
  );
}
