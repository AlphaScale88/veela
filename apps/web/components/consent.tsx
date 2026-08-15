"use client";

import { LEGAL_VERSIONS, LEGAL_LABEL, type LegalDocument } from "@veela/types";
import Link from "next/link";
import { useEffect, useState } from "react";

import { useAuth } from "./auth-provider";

/**
 * Accepting the terms and privacy statement, and the gate that catches everyone the signup
 * form cannot.
 *
 * ## Why a gate exists at all
 *
 * The signup checkbox covers people who sign up from now on. It does not cover:
 *
 *  - **anyone who already has an account** — they never saw an acceptance, and pretending
 *    otherwise would be inventing consent, which is worse than not having it;
 *  - **Google sign-up**, which never touches the signup form at all;
 *  - **anyone who accepted an older version** — consent to wording since rewritten is not
 *    consent to the current wording.
 *
 * All three are the same condition — *the current versions are not on record for this user* —
 * so they get one mechanism rather than three special cases. `GET /consent` answers it.
 *
 * ## Why a banner and not a modal
 *
 * A modal that cannot be dismissed is a hostage situation, and this product's own privacy page
 * promises a DPP6 access route rather than a wall. The banner is persistent and prominent and
 * does not go away until it is accepted, but the reader can still read the documents it is
 * asking them to accept — which a trapping modal makes oddly difficult.
 */

export interface ConsentState {
  readonly outstanding: readonly LegalDocument[];
  readonly accepted: readonly { document: string; version: string; acceptedAt: string }[];
}

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
 * Shown inside the app shell whenever anything is outstanding. Renders nothing at all when
 * there is nothing to ask, when nobody is signed in, or when Supabase is unconfigured — the
 * same zero-configuration rule as everywhere else.
 */
export function ConsentGate(): React.JSX.Element | null {
  /* Reads auth itself rather than taking a prop: it is mounted in the shell's layout, where
     no session is in scope, and threading one through would couple the shell to a concern
     that is entirely this component's. `configured` false means no account system at all. */
  const { user, configured } = useAuth();
  const userId = configured ? (user?.id ?? null) : null;
  const [state, setState] = useState<ConsentState | null>(null);
  const [checked, setChecked] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (userId === null) {
      setState(null);
      return;
    }
    let cancelled = false;
    fetch("/api/consent")
      .then((res) => (res.ok ? res.json() : null))
      .then((json: ConsentState | null) => {
        if (json !== null && !cancelled) setState(json);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (userId === null || state === null || state.outstanding.length === 0) return null;

  const isUpdate = state.accepted.length > 0;

  async function accept(): Promise<void> {
    setPending(true);
    setError(null);
    const message = await recordConsent();
    setPending(false);
    if (message !== null) {
      setError(message);
      return;
    }
    setState({ outstanding: [], accepted: state?.accepted ?? [] });
  }

  return (
    <section
      role="alertdialog"
      aria-labelledby="consent-gate-title"
      className="mb-6 rounded-panel border border-caution/50 bg-caution/10 px-5 py-4 shadow-card"
    >
      <h2 id="consent-gate-title" className="text-[15px] font-semibold text-mist">
        {isUpdate ? "Our terms have changed" : "Before you carry on"}
      </h2>
      <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-muted">
        {isUpdate
          ? `The ${state.outstanding.map((d) => LEGAL_LABEL[d].toLowerCase()).join(" and ")} ${
              state.outstanding.length === 1 ? "has" : "have"
            } been updated since you last accepted. Please read and accept the current version.`
          : "Your account was created before we asked for this. Please read and accept the terms and privacy statement — it records what you agreed to, and when."}
      </p>

      <div className="mt-3 max-w-prose">
        <AcceptLegal checked={checked} onChange={setChecked} />
      </div>

      {error !== null && (
        <p role="alert" className="mt-2 text-xs text-negative">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={() => void accept()}
        disabled={!checked || pending}
        className="btn-primary mt-3 !px-6 !py-2 !text-[13px] disabled:pointer-events-none disabled:opacity-50"
      >
        {pending ? "Recording…" : "Accept and continue"}
      </button>
    </section>
  );
}
