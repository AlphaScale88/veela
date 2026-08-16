"use client";

import { LEGAL_VERSIONS, type LegalDocument } from "@veela/types";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { useAuth } from "./auth-provider";

/**
 * Accepting the terms and privacy statement at signup.
 *
 * ## Asked at signup, and only at signup
 *
 * An earlier version also carried a banner in the app shell that caught existing accounts and
 * anyone holding superseded wording. **Removed by decision: consent is asked for at signup.**
 *
 * What that costs, stated rather than glossed: accounts created before this existed have no
 * record, and a future change to the wording will not re-ask. Both are recoverable — the
 * versioned records make it possible to tell exactly who is missing which document — but until
 * something re-asks, "accepted" means "accepted at signup, on the version in force that day".
 *
 * What it must not cost is **Google sign-up silently escaping the checkbox**, which it would,
 * since that path leaves `/signup` before a session exists. Both signup buttons are gated on
 * the same acceptance, and `ConsentRecorder` writes the record when the session lands.
 */

/** Records acceptance of every document currently in force. Returns an error message, or
 *  `null` on success — the same shape the auth helpers use, so callers handle it the same way. */
export async function recordConsent(): Promise<string | null> {
  try {
    const res = await fetch("/api/consent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        documents: (Object.keys(LEGAL_VERSIONS) as LegalDocument[]).map((document) => ({
          document,
          version: LEGAL_VERSIONS[document],
        })),
      }),
    });
    if (res.ok) return null;
    if (res.status === 401) return null; // No session yet — the gate will catch it on arrival.
    return (await res.text()) || `Could not record your acceptance (${res.status}).`;
  } catch {
    return "Could not reach the server to record your acceptance.";
  }
}

/** The acceptance control itself, shared by the signup form and the gate so the wording a user
 *  agrees to is identical in both — two copies would drift, and the whole point is knowing
 *  exactly what was shown. */
export function AcceptLegal({
  checked,
  onChange,
  invalid = false,
}: {
  readonly checked: boolean;
  readonly onChange: (v: boolean) => void;
  readonly invalid?: boolean;
}): React.JSX.Element {
  return (
    <label
      className={`flex cursor-pointer items-start gap-2.5 rounded-card border px-3.5 py-3 text-sm ${
        invalid ? "border-negative bg-negative/5" : "border-line bg-surfaceMuted"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 shrink-0 accent-accent"
      />
      <span className="leading-relaxed text-mist">
        I have read and accept the{" "}
        <Link href="/terms" target="_blank" className="text-accent underline hover:no-underline">
          terms of service
        </Link>{" "}
        and the{" "}
        <Link href="/privacy" target="_blank" className="text-accent underline hover:no-underline">
          privacy statement
        </Link>
        , including how my personal data is collected, used and kept.
        <span className="mt-1 block text-xs text-muted">
          Versions {LEGAL_VERSIONS.terms} and {LEGAL_VERSIONS.privacy}. We record that you
          accepted these, and when — nothing more.
        </span>
      </span>
    </label>
  );
}

/**
 * Key for the acceptance a reader gave on `/signup` immediately before Google took them away.
 *
 * `sessionStorage`, not `localStorage`: this only has to survive the few seconds of an OAuth
 * round trip, exactly like the analyse page's draft stash, and it must not linger on a shared
 * machine.
 */
const CONSENT_PENDING_KEY = "veela:consent-pending";

/** Called on `/signup` just before handing off to Google. */
export function stashConsentForOAuth(): void {
  try {
    sessionStorage.setItem(CONSENT_PENDING_KEY, LEGAL_VERSIONS.terms);
  } catch {
    /* Private browsing. The worst case is a Google sign-up without a record, which is the
       same position this was in before any of it existed — not a regression. */
  }
}

/**
 * Records an acceptance that was already given, and renders nothing. Ever.
 *
 * **This is not a gate.** Consent is asked for at signup and nowhere else, by decision. What
 * this handles is the one case where the asking and the recording cannot happen in the same
 * moment: Google sign-up navigates away from `/signup` before a session exists, so the checkbox
 * is ticked on one page and the session appears on another. Without this, every Google sign-up
 * would accept the terms and have nothing written down — the acceptance would be real and the
 * evidence would not.
 *
 * It fires once, only when a stash is present, and clears it immediately. A user who did not
 * just sign up has no stash and this does nothing at all.
 *
 * **Consequence worth being explicit about:** accounts created before consent existed are never
 * asked. There is no record for them, and this file does not pretend otherwise.
 */
export function ConsentRecorder(): null {
  const { user, configured } = useAuth();
  const done = useRef(false);

  useEffect(() => {
    if (!configured || user === null || done.current) return;
    let pending: string | null = null;
    try {
      pending = sessionStorage.getItem(CONSENT_PENDING_KEY);
    } catch {
      return;
    }
    if (pending === null) return;

    done.current = true;
    try {
      sessionStorage.removeItem(CONSENT_PENDING_KEY);
    } catch {
      /* nothing to do */
    }
    void recordConsent();
  }, [user, configured]);

  return null;
}
