"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { LoginForm } from "../../components/login-form";
import { useAuth } from "../../components/auth-provider";

/**
 * The page wrapper around `LoginForm` — layout, the `?next=`/`?error=` query handling,
 * and the redirect-on-success that only makes sense as a *page*: landing here directly
 * (typed the URL, followed a link) has nothing to preserve by staying put, unlike the
 * inline gate embedded in `/analyse`'s report (`components/login-form.tsx`'s own doc
 * comment explains why that one can't redirect the same way).
 */
export default function LoginPage(): React.JSX.Element {
  const { user, configured } = useAuth();
  const [next, setNext] = useState("/portfolio");
  const [authFailed, setAuthFailed] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setNext(params.get("next") ?? "/portfolio");
    if (params.get("error") === "auth_failed") setAuthFailed(true);
  }, []);

  useEffect(() => {
    if (user !== null) window.location.assign(next);
  }, [user, next]);

  if (!configured) {
    return (
      <div className="col max-w-sm py-20">
        <p className="card text-sm text-muted">
          Sign-in isn't configured on this deployment — <code className="font-mono">
            NEXT_PUBLIC_SUPABASE_URL
          </code>{" "}
          and <code className="font-mono">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> aren't set.
          Everything that doesn't need an account still works.
        </p>
      </div>
    );
  }

  return (
    <div className="col max-w-sm py-20">
      {authFailed && (
        <p role="alert" className="mb-5 text-sm text-negative">
          That sign-in link didn't work — it may have expired. Try again.
        </p>
      )}
      <LoginForm
        next={next}
        description="Needed to see a property's full report and to use the Property Finder — and saves what you look at so it's there next time you visit."
        // A full-page redirect here has nothing to preserve, so a plain reload after
        // the auth-state-change effect above catches the new session is enough —
        // no need for the inline gate's onSignedIn callback.
      />
      <p className="mt-6 text-xs text-muted">
        Creating an account means we hold your email and whatever you choose to save —
        see <Link href="/privacy" className="text-accent hover:underline">how, and what your rights are</Link>.
      </p>
    </div>
  );
}
