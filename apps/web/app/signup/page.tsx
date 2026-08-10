"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useAuth } from "../../components/auth-provider";
import { GoogleIcon } from "../../components/login-form";

/**
 * A real page, not the mode-toggle that used to live inside `LoginForm`.
 *
 * The toggle was cheap and cost two things worth having: a URL you can send someone
 * ("sign up here" had to be "go to /login and click the small grey text"), and any room
 * to say what an account is *for*. This product gives its whole report away without one —
 * the live preview on `/analyse` needs nothing — so "why sign up" is a real question and
 * the answer belongs next to the form.
 *
 * Validation is live and specific rather than a single failure at submit. Supabase's own
 * errors arrive only after a round trip and are written for developers ("Password should
 * be at least 6 characters"), so the two rules we know up front — a plausible address and
 * the 8-character minimum this form has always claimed — are checked here and the button
 * says which one is unmet.
 */

const MIN_PASSWORD = 8;

export default function SignupPage(): React.JSX.Element {
  const { user, configured, signUpWithPassword, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmSent, setConfirmSent] = useState(false);
  const [next, setNext] = useState("/dashboard");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setNext(params.get("next") ?? "/dashboard");
  }, []);

  // Someone already signed in has no business on a signup page — send them on. Also
  // covers the case where email confirmation is disabled and sign-up logs you straight
  // in, which would otherwise leave the "check your email" screen up over a live session.
  useEffect(() => {
    if (user !== null) window.location.assign(next);
  }, [user, next]);

  const emailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const passwordLongEnough = password.length >= MIN_PASSWORD;
  const canSubmit = emailLooksValid && passwordLongEnough && !pending;

  async function submit(): Promise<void> {
    setTouched(true);
    if (!emailLooksValid || !passwordLongEnough) return;
    setPending(true);
    setError(null);
    try {
      const message = await signUpWithPassword(email.trim(), password);
      if (message !== null) setError(message);
      else setConfirmSent(true);
    } finally {
      setPending(false);
    }
  }

  if (!configured) {
    return (
      <div className="col max-w-md py-20">
        <p className="card text-sm text-muted">
          Sign-up isn&apos;t configured on this deployment —{" "}
          <code className="font-mono">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
          <code className="font-mono">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> aren&apos;t set.
          Everything that doesn&apos;t need an account still works.
        </p>
      </div>
    );
  }

  if (confirmSent) {
    return (
      <div className="col max-w-md py-20">
        <div className="card">
          <h1 className="font-display text-[22px] font-semibold tracking-[-0.02em]">
            Check your email
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            We sent a confirmation link to{" "}
            <strong className="text-mist">{email.trim()}</strong>. Open it and your account
            is ready — nothing else to fill in.
          </p>
          <p className="mt-4 text-xs leading-relaxed text-muted">
            Nothing arrived? It can take a minute, and it may be in spam. The link is
            single-use; asking for another one replaces it.
          </p>
          <Link href="/login" className="btn-secondary mt-5 w-full !py-2.5">
            Back to log in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="col grid max-w-4xl gap-10 py-16 md:grid-cols-[1fr_1fr] md:items-start md:py-20">
      {/* The form first on mobile, the pitch first on desktop — someone who came here
          having already decided shouldn't have to scroll past the reasons. */}
      <div className="order-2 md:order-1">
        <h1 className="font-display text-[26px] font-extrabold leading-tight tracking-[-0.03em]">
          Create your Veela account
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          The yield preview on{" "}
          <Link href="/analyse" className="text-accent hover:underline">
            Analyse
          </Link>{" "}
          is free and needs no account. An account adds the parts that only make sense if
          we remember you:
        </p>

        <ul className="mt-5 space-y-3.5">
          <Benefit title="The full report">
            Stamp duty on your own buyer situation, the tax, cash to acquire, payback, and
            the findings that flag a bad deal.
          </Benefit>
          <Benefit title="A portfolio of dated snapshots">
            Every saved report keeps the tax rules that produced it — so a figure from last
            year still reproduces when the rules change.
          </Benefit>
          <Benefit title="Compare and track">
            Put saved properties side by side, star the districts you care about, and mark
            what you want monitored.
          </Benefit>
        </ul>

        <p className="mt-6 text-xs leading-relaxed text-muted">
          We hold your email and whatever you choose to save, nothing else — see{" "}
          <Link href="/privacy" className="text-accent hover:underline">
            what we collect and your rights
          </Link>
          . Aggregate use of your data is off unless you turn it on.
        </p>
      </div>

      <div className="order-1 md:order-2">
        <div className="card">
          <button
            type="button"
            onClick={() => void signInWithGoogle(next)}
            className="btn-secondary w-full !py-3"
          >
            <GoogleIcon className="h-4 w-4" /> Continue with Google
          </button>

          <div className="my-4 flex items-center gap-3 text-xs text-muted">
            <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
            className="space-y-3"
            noValidate
          >
            <label className="block">
              <span className="text-xs text-muted">Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => setTouched(true)}
                placeholder="you@example.com"
                autoComplete="email"
                aria-invalid={touched && !emailLooksValid}
                className="mt-1 w-full rounded-card border border-line bg-surfaceMuted px-3.5 py-2.5 text-sm outline-none focus:border-accent focus:bg-surface aria-[invalid=true]:border-negative"
              />
              {touched && !emailLooksValid && (
                <span className="mt-1 block text-xs text-negative">
                  That doesn&apos;t look like an email address.
                </span>
              )}
            </label>

            <label className="block">
              <span className="text-xs text-muted">Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onBlur={() => setTouched(true)}
                placeholder={`At least ${MIN_PASSWORD} characters`}
                autoComplete="new-password"
                aria-invalid={touched && !passwordLongEnough}
                aria-describedby="pw-hint"
                className="mt-1 w-full rounded-card border border-line bg-surfaceMuted px-3.5 py-2.5 text-sm outline-none focus:border-accent focus:bg-surface aria-[invalid=true]:border-negative"
              />
              <span
                id="pw-hint"
                className={`mt-1 block text-xs ${
                  password.length === 0
                    ? "text-muted"
                    : passwordLongEnough
                      ? "text-positive"
                      : "text-negative"
                }`}
              >
                {password.length === 0
                  ? `${MIN_PASSWORD} characters minimum.`
                  : passwordLongEnough
                    ? "Long enough."
                    : `${MIN_PASSWORD - password.length} more character${
                        MIN_PASSWORD - password.length === 1 ? "" : "s"
                      } needed.`}
              </span>
            </label>

            {error !== null && (
              <p role="alert" className="text-xs text-negative">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={!canSubmit}
              className="btn-primary w-full !py-3 disabled:pointer-events-none disabled:opacity-50"
            >
              {pending ? "Creating your account…" : "Create account"}
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-muted">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-accent hover:underline">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function Benefit({
  title,
  children,
}: {
  readonly title: string;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return (
    <li className="flex gap-3">
      <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-positive" />
      <span>
        <span className="text-[15px] font-medium">{title}</span>
        <span className="mt-0.5 block text-sm leading-relaxed text-muted">{children}</span>
      </span>
    </li>
  );
}

function CheckIcon({ className }: { readonly className?: string }): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M4 12.5l5 5L20 6.5"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
