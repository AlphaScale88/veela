"use client";

import Link from "next/link";
import { useId, useState } from "react";

import { useAuth } from "./auth-provider";

/**
 * **Sign-in only.** Creating an account moved to its own page (`app/signup/page.tsx`) —
 * the mode toggle that used to live here cost a linkable URL and left no room to say what
 * an account is *for*, which matters in a product that gives its report away without one.
 *
 * Still a component rather than page-inline so `/login` and any future call site share one
 * implementation. Success needs no callback: `/login` redirects when `useAuth()`'s `user`
 * turns non-null. Every gated action sends the reader to `/login?next=…`, so there is
 * exactly one place a session gets established.
 */
interface Props {
  readonly next: string;
  /** Overrides the default "Log in" heading. */
  readonly heading?: string;
  readonly description: string;
}

export function LoginForm({ next, heading, description }: Props): React.JSX.Element {
  const { configured, signInWithGoogle, signInWithPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /* Generated, not hard-coded: this component renders on `/login` *and* inline as
     `/analyse`'s report gate, so a fixed id is a duplicate-id bug waiting for the day both
     appear on one page — at which point a label silently points at the wrong input. */
  const ids = useId();

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
      const message = await signInWithPassword(email, password);
      if (message !== null) setError(message);
      // Success needs no handling here — `/login`'s own effect redirects the moment
      // `useAuth()`'s `user` turns non-null.
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <h2 className="font-display text-[20px] font-semibold tracking-[-0.02em]">
        {heading ?? "Log in"}
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

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="space-y-3"
      >
        {/**
         * Real `<label>`s, hidden visually.
         *
         * These two boxes carried a placeholder and nothing else, which is not a label: a
         * placeholder is the accessible name only as a last-resort fallback, it disappears
         * the moment anything is typed, and it is the wrong text anyway — the email field
         * announced as *"you@example.com"*. So a screen-reader user got no persistent name
         * for either field on the one form the whole account system stands behind.
         *
         * `sr-only` rather than a visible label because the compact card is deliberate and
         * `/signup` — which does show its labels — is the form where the extra guidance
         * earns its space. A real hidden label beats `aria-label`: it is still a label
         * element, so it is exposed consistently and picked up by page-translation tools
         * that skip ARIA attributes.
         */}
        <label htmlFor={`${ids}-email`} className="sr-only">
          Email address
        </label>
        <input
          id={`${ids}-email`}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          required
          className="w-full rounded-card border border-line bg-surfaceMuted px-3.5 py-2.5 text-sm outline-none focus:border-accent focus:bg-surface"
        />
        <label htmlFor={`${ids}-password`} className="sr-only">
          Password
        </label>
        <input
          id={`${ids}-password`}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          required
          autoComplete="current-password"
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
          {pending ? "Logging in…" : "Log in"}
        </button>
      </form>

      {/* A link to a real page, not a mode toggle. `next` is carried across so someone
          who was sent here from a gated action still lands where they were going after
          signing up, not on a default page. */}
      <p className="mt-4 text-sm text-muted">
        No account yet?{" "}
        <Link
          href={`/signup?next=${encodeURIComponent(next)}`}
          className="font-medium text-accent hover:underline"
        >
          Create one
        </Link>
      </p>
    </div>
  );
}

/** Exported so `/signup` renders the identical button rather than a near-copy — two
 *  hand-drawn Google marks that drift apart is exactly the kind of detail that makes a
 *  sign-in page look untrustworthy. */
export function GoogleIcon({ className }: { readonly className?: string }): React.JSX.Element {
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
