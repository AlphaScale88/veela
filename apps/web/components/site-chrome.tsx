"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { SiteFooter, SiteHeader } from "./site-nav";

/**
 * Which chrome a route gets. **Three cases now, not two** — and the split is by what the
 * page is *for*, which is what makes the navigation predictable:
 *
 * 1. **The landing page only** keeps the marketing header and footer. It is the one page
 *    whose job is to persuade someone who has not decided yet.
 * 2. **Auth pages** get neither: no sidebar, no nav links, just the page. A signup form
 *    surrounded by fourteen other destinations is a form people leave.
 * 3. **Everything else is the product**, and gets the sidebar — including `/analyse` and
 *    `/map`, which did not before.
 *
 * ## Why this changed
 *
 * The sidebar started as `/finder`-only (a Mashvisor screenshot, asked rather than
 * assumed), then spread to the pages that were obviously like Finder. That left
 * `/analyse` and `/map` — the two most-used tools — behind the marketing header, which
 * reaches **three** destinations out of fifteen. So from the core action of the entire
 * product you could not get to your portfolio, the assistant, research or resources at
 * all, and `/map` looked like a different application from `/finder` beside it. The old
 * comment here called that inconsistency an accepted trade-off; asked directly to make
 * navigation intuitive, it stopped being acceptable.
 *
 * `isAppShellPage` is now the default rather than a list to maintain: a new route gets
 * the product shell unless it is deliberately named below, which is the safer direction
 * for a file whose failure mode is a page with the wrong navigation.
 *
 * A client component specifically so it can read the current path — the root layout stays
 * a Server Component (it exports `metadata`, which a client component cannot do).
 */

/**
 * Pages that keep the marketing header and footer.
 *
 * The landing page, plus the four **Services** pages. Those were nested at `/services/*`
 * inside the app shell; they are top-level and public now, matching how the reference
 * publishes them (`/mortgage`, `/insurance`, `/home-valuation`).
 *
 * The move is not cosmetic. These are the pages someone arrives on from a search or a shared
 * link, before they have an account — and a stranger's first screen should be the marketing
 * header they can navigate from, not a logged-out product sidebar. Nesting them three levels
 * deep behind an app chrome also made them effectively unfindable to anyone not already
 * inside the product, which is the opposite of what a page about mortgages is for.
 *
 * `/services` itself stays in the app shell: it is the in-product index of the four, and the
 * sidebar group links straight to the pages anyway.
 *
 * **`/pricing` and `/developers` moved for the same reason, and as a pair.** A price list is
 * read by someone deciding whether to have an account at all — putting it behind the chrome of
 * a product they have not bought is precisely backwards. They move together because pricing's
 * own "Talk to us" links straight to the API docs: moving one and not the other would flip the
 * page furniture halfway through a single decision.
 */
const MARKETING_ROUTES = new Set([
  "/",
  "/pricing",
  "/developers",
  "/mortgage",
  "/insurance",
  "/agent-finder",
  "/home-valuation",
]);

/** Deliberately chrome-less: nothing to click but the form. */
const BARE_ROUTES = new Set(["/login", "/signup", "/auth/callback"]);

export function SiteChrome({ children }: { readonly children: ReactNode }): React.JSX.Element {
  const pathname = usePathname() ?? "/";

  if (BARE_ROUTES.has(pathname)) {
    return (
      <>
        <AuthChrome />
        <main id="main">{children}</main>
      </>
    );
  }

  if (MARKETING_ROUTES.has(pathname)) {
    return (
      <>
        <SiteHeader />
        <main id="main">{children}</main>
        <SiteFooter />
      </>
    );
  }

  // The product. The page renders its own `<AppShell>`; the landmark stays here so the
  // root layout's skip-link keeps a target.
  return <main id="main">{children}</main>;
}

/**
 * Just the wordmark, linked home. Auth pages carry no navigation on purpose — a signup
 * form surrounded by fourteen destinations is a form people wander away from — but "no
 * navigation" is not the same as "no way out", and the first version of this was a page
 * with literally nothing clickable except the form. That is a dead end: someone who
 * arrives unsure has to reach for the browser's back button.
 */
function AuthChrome(): React.JSX.Element {
  return (
    <div className="col pt-8">
      <Link href="/" className="inline-flex items-center gap-2.5" aria-label="Veela — home">
        {/* eslint-disable-next-line @next/next/no-img-element -- see site-nav.tsx */}
        <img src="/brand/veela-logo.svg" alt="Veela" width={96} height={24} />
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
          Hong Kong
        </span>
      </Link>
    </div>
  );
}
