"use client";

import { useState } from "react";

import { useAuth } from "./auth-provider";

type Mode = "signin" | "signup";

/**
 * The actual sign-in/sign-up UI, extracted from `/login` so a second call site could
 * embed it without duplicating the form — currently just `/login` itself, which redirects
 * on success (`window.location.assign`, in the page wrapper) once `useAuth()`'s `user`
 * turns non-null. Every login-gated action on the site (saving a property, seeing the
 * full `/analyse` report, `/finder`) sends the reader to `/login?next=…` rather than
 * embedding this inline, so there is exactly one place a session gets established.
 */
interface Props {
  readonly next: string;
  /** Overrides the default "Log in" / "Create an account" heading that otherwise
   *  tracks the internal sign-in/sign-up toggle. */
  readonly heading?: string;
  readonly description: string;
}

export function LoginForm({ next, heading, description }: Props): React.JSX.Element {
  const { configured, signInWithGoogle, signInWithPassword, signUpWithPassword } = useAuth();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmSent, setConfirmSent] = useState(false);

  if (!configured) {
    return (
      <p className="text-sm text-muted">
        Sign-in isn't configured on this deployment —{" "}
        <code className="font-mono">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
        <code className="font-mono">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> aren't set.
      </p>
    );
  }

  async function submit(): Promise<void> {
    setError(null);
    setPending(true);
    try {
      const message =
        mode === "signin"
          ? await signInWithPassword(email, password)
          : await signUpWithPassword(email, password);

      if (message !== null) {
        setError(message);
      } else if (mode === "signup") {
        setConfirmSent(true);
      }
      // signin success needs no explicit handling here — `/login`'s own effect redirects
      // the moment `useAuth()`'s `user` turns non-null.
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <h2 className="font-display text-[20px] font-semibold tracking-[-0.02em]">
        {heading ?? (mode === "signin" ? "Log in" : "Create an account")}
      </h2>
      <p className="mt-1.5 text-sm text-muted">{description}</p>

      <button
        type="button"
        onClick={() => void signInWithGoogle(next)}
        className="btn-secondary mt-5 w-full !py-3"
      >
        <GoogleIcon className="h-4 w-4" /> Continue with Google
      </button>

      <div className="my-4 flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
      </div>

      {confirmSent ? (
        <p className="text-sm">
          Check <strong>{email}</strong> for a confirmation link to finish creating your account.
        </p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          className="space-y-3"
        >
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            className="w-full rounded-card border border-line bg-surfaceMuted px-3.5 py-2.5 text-sm outline-none focus:border-accent focus:bg-surface"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            required
            minLength={8}
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            className="w-full rounded-card border border-line bg-surfaceMuted px-3.5 py-2.5 text-sm outline-none focus:border-accent focus:bg-surface"
          />

          {error !== null && (
            <p role="alert" className="text-xs text-negative">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="btn-primary w-full !py-3 disabled:pointer-events-none disabled:opacity-50"
          >
            {pending ? "Working…" : mode === "signin" ? "Log in" : "Create account"}
          </button>
        </form>
      )}

      <button
        type="button"
        onClick={() => {
          setMode((m) => (m === "signin" ? "signup" : "signin"));
          setError(null);
          setConfirmSent(false);
        }}
        className="mt-4 text-sm text-muted hover:text-mist"
      >
        {mode === "signin" ? "No account yet? Sign up" : "Already have an account? Log in"}
      </button>
    </div>
  );
}

function GoogleIcon({ className }: { readonly className?: string }): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.85-.08-1.66-.22-2.45H12v4.63h6.47a5.54 5.54 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.55-5.17 3.55-8.81Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.07 7.94-2.9l-3.88-3c-1.08.72-2.46 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.94H1.3v3.1A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.29 14.31A7.2 7.2 0 0 1 4.91 12c0-.8.14-1.58.38-2.31v-3.1H1.3A12 12 0 0 0 0 12c0 1.94.46 3.77 1.3 5.41l3.99-3.1Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.76 0 3.35.61 4.6 1.8l3.44-3.44C17.94 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.3 6.59l3.99 3.1C6.23 6.86 8.88 4.75 12 4.75Z"
      />
    </svg>
  );
}
