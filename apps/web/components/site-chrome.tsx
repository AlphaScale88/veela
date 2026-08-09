"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { SiteFooter, SiteHeader } from "./site-nav";

/**
 * The "app" routes — Finder, Dashboard, the Assistant, Research, the portfolio, Account,
 * Resources — get the dark sidebar shell (`components/app-shell.tsx`) instead of the
 * marketing site's sticky top header. Started as `/finder`-only, after being shown a
 * screenshot of Mashvisor's dashboard chrome and asked to match it — that was a real
 * fork (site-wide vs. one page vs. none), asked rather than assumed, and the answer was
 * "this page only." Generalised here to the *rest* of the sidebar's real pages for the
 * same reason: they're the same kind of page Finder already was, so they get the same
 * shell. `/`, `/analyse` and `/map` keep the marketing header/footer unchanged — this
 * was never revisited to make it site-wide.
 *
 * A client component specifically so it can read the current path — the root layout
 * stays a Server Component (it exports `metadata`, which a client component cannot do),
 * so the pathname check has to live one level down, here.
 */
const APP_SHELL_PREFIXES = ["/finder", "/dashboard", "/assistant", "/research", "/portfolio", "/account", "/resources"];

export function SiteChrome({ children }: { readonly children: ReactNode }): React.JSX.Element {
  const pathname = usePathname();
  const isAppShellPage = APP_SHELL_PREFIXES.some((p) => pathname?.startsWith(p) ?? false);

  if (isAppShellPage) {
    // No marketing header/footer — the page itself renders `<AppShell>`. The landmark
    // stays so the root layout's skip-link still has a target.
    return <main id="main">{children}</main>;
  }

  return (
    <>
      <SiteHeader />
      <main id="main">{children}</main>
      <SiteFooter />
    </>
  );
}
