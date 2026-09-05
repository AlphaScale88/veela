"use client";

import { LANDING_PAGES } from "@veela/types";

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
/**
 * `?next=` is attacker-controlled, and this page hands it straight to
 * `window.location.assign` — so it has to be a path on this site or it is an **open redirect**.
 *
 * `/login?next=https://evil.example` would otherwise bounce somebody through Veela's own login
 * form and out to another site the moment they authenticate, which is the classic phishing setup:
 * the victim sees a genuine, correctly-certificated Veela login, types real credentials, and lands
 * somewhere else entirely. Noticed while fixing the round trip that *populates* this parameter,
 * not by a report.
 *
 * Three things are refused, and the third is the one people forget:
 * - anything that is not rooted at `/` (`https://…`, `javascript:…`, a bare `evil.com`)
 * - `//host`, which browsers read as protocol-relative and therefore off-site
 * - `/\host` and `/\\host`, since a backslash is normalised to a slash by several browsers
 *
 * Anything refused falls back to the same default an absent parameter gets. Deliberately a
 * whitelist of shape rather than a blacklist of strings: a new way to write an absolute URL
 * should fail closed.
 */
function safeNext(raw: string | null): string {
  const fallback = "/portfolio";
  if (raw === null || raw === "") return fallback;
  if (!raw.startsWith("/")) return fallback;
  if (raw.startsWith("//") || raw.startsWith("/\\")) return fallback;
  return raw;
}

/*
 * One sentence per reason, because they call for different actions and the single message this
 * replaced ("it may have expired — try again") gave the wrong advice for the most common case.
 * A link clicked a minute after it arrived has not expired; it was opened somewhere that never
 * held the other half of it, and requesting another one fails identically.
 *
 * `auth_failed` is kept so a link already in someone's inbox, pointing at the old reason, still
 * says something sensible.
 */
const AUTH_ERRORS: Record<string, string> = {
  wrong_browser:
    "That link has to be opened in the same browser you signed up in — email apps often open their own. Copy the link into that browser, or sign in with your email and password below.",
  link_used:
    "That link has already been used or has expired. Request a new one, or sign in with your email and password below.",
  no_code:
    "That link arrived without its confirmation code, which usually means the email client altered it. Try opening it in a browser instead, or sign in below.",
  not_configured: "Sign-in isn't configured on this deployment.",
  auth_failed: "That sign-in link didn't work. Try again, or sign in with your email and password below.",
};

export default function LoginPage(): React.JSX.Element {
  const { user, configured } = useAuth();
  const [next, setNext] = useState("/portfolio");
  /*
   * True when the URL carried no `?next=`, which is the only case where a standing
   * preference should decide the destination. Somebody bounced here from a gated page has a
   * more specific intent than a setting made weeks ago, and that intent wins.
   */
  const [freeChoice, setFreeChoice] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("next");
    setNext(safeNext(requested));
    setFreeChoice(requested === null || requested === "");
    const reason = params.get("error");
    if (reason !== null && reason !== "") setAuthError(reason);
  }, []);

  useEffect(() => {
    if (user === null) return;
    if (!freeChoice) {
      window.location.assign(next);
      return;
    }
    /*
     * One request, on the one screen where it pays for itself. The alternative considered was
     * a portfolio count in the app shell so the sidebar could reorder itself — that is a
     * request on *every* page for a cosmetic change, where this is a request on one page that
     * decides where the reader actually goes.
     *
     * The value is checked against the whitelist rather than trusted: it reaches
     * `window.location.assign`, and a stored destination is a stored redirect if nobody
     * checks it. Any failure falls through to the default, because a preference is a
     * convenience and must never be able to strand somebody at a sign-in screen.
     */
    let cancelled = false;
    fetch("/api/profile")
      .then((res) => (res.ok ? res.json() : null))
      .then((json: { profile?: { landingPage?: string | null } } | null) => {
        if (cancelled) return;
        const wanted = json?.profile?.landingPage;
        const allowed = LANDING_PAGES as readonly string[];
        window.location.assign(
          typeof wanted === "string" && allowed.includes(wanted) ? wanted : next,
        );
      })
      .catch(() => {
        if (!cancelled) window.location.assign(next);
      });
    return () => {
      cancelled = true;
    };
  }, [user, next, freeChoice]);

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
      {authError !== null && (
        <p role="alert" className="mb-5 text-sm text-negative">
          {AUTH_ERRORS[authError] ?? AUTH_ERRORS["link_used"]}
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
