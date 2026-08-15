"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { useAuth } from "./auth-provider";

/**
 * The marketing site's header and footer — extracted out of `app/layout.tsx` so
 * `site-chrome.tsx` can choose, per route, whether to render them at all. `/finder` is
 * the one route that doesn't; everywhere else, this is exactly what used to be inlined
 * in the root layout, unchanged.
 *
 * A client component now (it wasn't, before login existed) — showing "Log in" versus a
 * signed-in menu needs `useAuth()`.
 */

export function SiteHeader(): React.JSX.Element {
  const { user, configured, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  // Tapping a link in the panel navigates — leaving it open over the new page would be
  // a dead overlay the reader has to dismiss before they can read anything.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    /* An app bar, this time deliberately. Sticky, white against the tinted page, with
       a resting shadow rather than a border — the Zillow/Airbnb nav pattern, and the
       right one once the page itself has a tint to float above. The pill CTA carries
       the primary action; the other two links stay plain text, so there is exactly
       one filled button in the header and it means exactly one thing. */
    <header className="sticky top-0 z-40 border-b border-line bg-surface/95 shadow-card backdrop-blur">
      <nav className="col flex items-center gap-8 py-4">
        <Link href="/" className="flex items-center gap-3" aria-label="Veela — home">
          {/* eslint-disable-next-line @next/next/no-img-element -- a static vector
              logo doesn't need next/image's raster pipeline, and rendering an SVG
              through it requires enabling dangerouslyAllowSVG for no real benefit. */}
          <img src="/brand/veela-logo.svg" alt="Veela" width={106} height={26} />
          <span className="hidden font-mono text-[10px] uppercase tracking-[0.14em] text-muted sm:inline">
            Hong Kong
          </span>
        </Link>

        <div className="ml-auto flex items-center gap-7 text-[15px]">
          {/* No longer dimmed for a logged-out reader — /finder stopped requiring an
              account on 09/08/2026 (see middleware.ts), so a login prompt here would now
              be a lie about what clicking it does. */}
          <Link href="/finder" className="hidden text-muted transition-colors hover:text-mist sm:inline">
            Finder
          </Link>
          <Link
            href="/map"
            className="hidden text-muted transition-colors hover:text-mist sm:inline"
          >
            Market Explorer
          </Link>

          {/* btn-secondary now, not btn-primary — "Sign in" further right carries the
              filled pill instead, asked for directly. Still exactly one solid button in
              this header, just the other one. */}
          <Link href="/analyse" className="btn-secondary !px-5 !py-2.5 !text-[14px]">
            Analyse a property
          </Link>

          {configured && (
            <>
              {user === null ? (
                // "Sign in" stays the filled pill it was asked to be. "Sign up" is added
                // beside it as plain text rather than a second button — the header had no
                // path to *create* an account at all, only to log into one, and two
                // filled pills next to each other would compete for the same click.
                <>
                  <Link
                    href="/signup"
                    className="hidden text-muted transition-colors hover:text-mist sm:inline"
                  >
                    Sign up
                  </Link>
                  <Link href="/login" className="btn-primary hidden !px-5 !py-2.5 !text-[14px] sm:inline-flex">
                    Sign in
                  </Link>
                </>
              ) : (
                <div className="hidden items-center gap-4 sm:flex">
                  <Link href="/portfolio" className="text-muted transition-colors hover:text-mist">
                    My Properties
                  </Link>
                  <button
                    type="button"
                    onClick={() => void signOut()}
                    className="text-muted transition-colors hover:text-mist"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </>
          )}

          {/* Everything to the left of "Analyse a property" is `hidden sm:` — without
              this, a phone gets a header with no navigation in it at all. */}
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-expanded={menuOpen}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            className="grid size-9 shrink-0 place-items-center rounded-card border border-line text-muted transition-colors hover:text-mist sm:hidden"
          >
            {menuOpen ? <CloseIcon className="h-4 w-4" /> : <MenuIcon className="h-4 w-4" />}
          </button>
        </div>
      </nav>

      {menuOpen && (
        <div className="border-t border-line bg-surface sm:hidden">
          <div className="col flex flex-col py-3 text-[15px]">
            <Link href="/finder" className="py-2.5 text-muted hover:text-mist">
              Finder
            </Link>
            <Link href="/map" className="py-2.5 text-muted hover:text-mist">
              Market Explorer
            </Link>
            {configured &&
              (user === null ? (
                <>
                  <Link href="/signup" className="py-2.5 text-muted hover:text-mist">
                    Sign up
                  </Link>
                  <Link href="/login" className="btn-primary mt-2 !py-2.5 !text-[14px]">
                    Sign in
                  </Link>
                </>
              ) : (
                <>
                  <Link href="/portfolio" className="py-2.5 text-muted hover:text-mist">
                    My Properties
                  </Link>
                  <button
                    type="button"
                    onClick={() => void signOut()}
                    className="py-2.5 text-left text-muted hover:text-mist"
                  >
                    Sign out
                  </button>
                </>
              ))}
          </div>
        </div>
      )}
    </header>
  );
}

function MenuIcon({ className }: { readonly className?: string }): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon({ className }: { readonly className?: string }): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function SiteFooter(): React.JSX.Element {
  return (
    <footer className="border-t border-line">
      <div className="col grid gap-10 py-16 sm:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/veela-logo.svg" alt="Veela" width={92} height={22} />
          <p className="mt-3 max-w-prose text-sm leading-relaxed text-muted">
            Veela produces estimates from figures you supply and public statistics. It is
            not tax or investment advice — verify anything you act on against the Inland
            Revenue Department and the Rating and Valuation Department.
          </p>
          <span className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
            <Link href="/pricing" className="text-sm text-muted hover:text-mist">
              Pricing
            </Link>
            <Link href="/developers" className="text-sm text-muted hover:text-mist">
              API
            </Link>
            <Link href="/terms" className="text-sm text-muted hover:text-mist">
              Terms
            </Link>
          </span>
          <Link href="/privacy" className="mt-3 inline-block text-sm text-muted hover:text-mist">
            Privacy
          </Link>
        </div>

        <div>
          <div className="eyebrow">Product</div>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link href="/finder" className="text-muted hover:text-mist">
                Find a property
              </Link>
            </li>
            <li>
              <Link href="/analyse" className="text-muted hover:text-mist">
                Analyse a property
              </Link>
            </li>
            <li>
              <Link href="/map" className="text-muted hover:text-mist">
                Supply and demand map
              </Link>
            </li>
            <li>
              <Link href="/portfolio" className="text-muted hover:text-mist">
                My properties
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <div className="eyebrow">Sources</div>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <a
                href="https://www.gov.hk/en/residents/taxes/stamp/stamp_duty_rates.htm"
                target="_blank"
                rel="noreferrer"
                className="text-muted hover:text-mist"
              >
                Inland Revenue Department
              </a>
            </li>
            <li>
              <a
                href="https://www.rvd.gov.hk/en/publications/property_market_statistics.html"
                target="_blank"
                rel="noreferrer"
                className="text-muted hover:text-mist"
              >
                Rating and Valuation Department
              </a>
            </li>
            <li>
              <a
                href="https://www.landreg.gov.hk/en/monthly/agreement.htm"
                target="_blank"
                rel="noreferrer"
                className="text-muted hover:text-mist"
              >
                Land Registry
              </a>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
