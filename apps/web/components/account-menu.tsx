"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { useAuth } from "./auth-provider";
import { BookmarkIcon, DocumentIcon } from "./icons";

/**
 * The signed-in account menu: an avatar that opens a dropdown, in place of a bare
 * "Sign out" link.
 *
 * ## Why this shape
 *
 * Asked for, from a Mashvisor screenshot. The reasoning holds independently: **sign out was
 * the only account action in the header**, which is an odd thing to make the most prominent
 * one — it is the action a reader wants least often, sitting where they look for everything
 * else. An avatar collapses identity and every account destination into one control, and it is
 * the pattern every app of this kind uses, so it costs nobody a moment's learning.
 *
 * ## What is *not* in it, and why
 *
 * The reference menu carries **Billing** and an **Upgrade Now** button. Neither is here.
 * Billing does not exist — no payment processor is configured — and a menu item that opens
 * nothing is worse than an absent one: it spends the reader's trust to look complete. The plan
 * line does link to `/pricing`, which is honest, because that page says plainly that the
 * subscription is not on sale yet.
 *
 * Every remaining item goes somewhere real: `/portfolio`, `/account`, Market Regulations, `/pricing`.
 *
 * ## The plan line is not decorative
 *
 * It reads "Free plan" because that is what every account is on — there is no billing, so
 * there is no other state it could truthfully show. When subscriptions exist this is where the
 * real plan goes, and until then it is accurate rather than aspirational.
 */

interface MenuLink {
  /** Typed from `Link` rather than `string`: Next's typed routes reject an arbitrary string,
   *  and taking the type from the component keeps this honest as routes come and go. */
  readonly href: React.ComponentProps<typeof Link>["href"];
  readonly label: string;
  readonly icon: (p: { readonly className?: string }) => React.JSX.Element;
}

const LINKS: readonly MenuLink[] = [
  { href: "/portfolio", label: "My properties", icon: BookmarkIcon },
  { href: "/account", label: "Settings", icon: GearIcon },
  { href: "/research/market-regulations", label: "How it works", icon: DocumentIcon },
];

export function AccountMenu(): React.JSX.Element | null {
  const { user, configured, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  /**
   * Close on an outside click or on Escape.
   *
   * Both, not one: a pointer user expects clicking away to dismiss, and a keyboard user has no
   * "away" to click. Bound on `document` while open only — a listener left attached for the
   * whole session is a small leak and a needless call on every click in the app.
   */
  useEffect(() => {
    if (!open) return;
    function onPointer(e: MouseEvent): void {
      if (wrapRef.current !== null && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!configured || user === null) return null;

  const email = user.email ?? "";
  /* First letter of the email, since there is no display name in the session. Uppercased for
     the avatar; falls back to a dot rather than an empty circle if an account somehow has no
     address at all. */
  const initial = email.trim().charAt(0).toUpperCase() || "·";

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${email}`}
        className={`flex size-9 items-center justify-center rounded-full text-[13px] font-semibold text-white transition-shadow ${
          open ? "shadow-lift ring-2 ring-accent/30" : "hover:shadow-card"
        }`}
        style={{ backgroundColor: "#0B5BD3" }}
      >
        {initial}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-panel border border-line bg-surface shadow-lift"
        >
          {/* Identity first, as in every menu of this shape: the reader's own answer to "which
              account am I in" before any action they might take in it. */}
          <div className="border-b border-line bg-surfaceMuted px-4 py-3">
            <p className="truncate text-sm font-semibold text-mist">{email}</p>
            <Link
              href="/pricing"
              onClick={() => setOpen(false)}
              className="mt-0.5 inline-block text-xs text-muted hover:text-accent"
            >
              Free plan — see what&apos;s paid
            </Link>
          </div>

          <div className="py-1.5">
            {LINKS.map(({ href, label, icon: Icon }) => (
              <Link
                key={String(href)}
                href={href}
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-mist hover:bg-accent/[0.06]"
              >
                <Icon className="h-4 w-4 shrink-0 text-muted" />
                {label}
              </Link>
            ))}
          </div>

          <div className="border-t border-line py-1.5">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                void signOut();
              }}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-mist hover:bg-negative/[0.06] hover:text-negative"
            >
              <SignOutIcon className="h-4 w-4 shrink-0 text-muted" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* Two glyphs the shared set does not have, in the same house style — 24×24, stroked,
   currentColor. See `icons.tsx` for why that file exists at all. */

function GearIcon({ className }: { readonly className?: string }): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.56V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.11-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.65 8.6a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H9a1.7 1.7 0 0 0 1-1.56V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V9a1.7 1.7 0 0 0 1.56 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1Z" />
    </svg>
  );
}

function SignOutIcon({ className }: { readonly className?: string }): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9.5 20H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h3.5" />
      <path d="M15.5 16.5 20 12l-4.5-4.5" />
      <path d="M20 12H9.5" />
    </svg>
  );
}
