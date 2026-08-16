"use client";

import type { Route } from "next";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

import { useAuth } from "./auth-provider";
import { DocumentIcon, WalletIcon } from "./icons";
import { ConsentRecorder } from "./consent";

/**
 * The dashboard-style shell for every "app" page — Finder, Dashboard, the Assistant,
 * Research, the portfolio ("My Workspace"), Account ("Manage") and Resources — as
 * opposed to the marketing site's sticky top header (`site-nav.tsx`), which stays on
 * `/`, `/analyse` and `/map`. `site-chrome.tsx` decides which pages get which shell.
 *
 * Started as `/finder`-only, modelled on a Mashvisor screenshot. Generalised here
 * because the same "dark rail, real HK-market tools, no dead chrome" shape is exactly
 * what the rest of the sidebar's real, buildable items need too — see
 * `.claude/CLAUDE.md` for which sidebar items got a real page and which didn't.
 *
 * Sidebar is a top-to-bottom gradient (accent → inverse) with a white rounded pill for
 * the active item, matching a second Mashvisor screenshot asked for directly — built
 * from this workspace's own `accent`/`inverse` tokens, not Mashvisor's literal hex
 * values, same as everywhere else a Mashvisor visual got adapted rather than copied.
 *
 * **What's still deliberately not here**: a workspace switcher (still no accounts
 * required for most of this — login only adds the portfolio), an "Upgrade now" button
 * (no paid tier), and anything for Marketing or a vetted-provider Services marketplace
 * — see CLAUDE.md for why those two specifically were not built at all. That same
 * screenshot's "Manage" turned out to be short-term-rental host tooling (Multi
 * Calendar, Reservations, Channel Manager, Dynamic Pricing) — confirms `/account`
 * mapping "Manage" to profile settings rather than STR management was the right call,
 * not a guess: that toolset needs a guesthouse licence to operate legally in Hong Kong
 * at all (Cap. 349), the same reason Marketing and the Airbnb toggle were left out.
 */

interface Props {
  readonly children: ReactNode;
  readonly breadcrumb: string;
  /** Page-specific controls in the top bar — Finder's search box and Map/Table
   *  toggle, for instance. Most pages have none. */
  readonly toolbar?: ReactNode;
}

export function AppShell({ children, breadcrumb, toolbar }: Props): React.JSX.Element {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  /**
   * Two different behaviours behind one sidebar, split at `lg`. On a desktop it's a
   * permanent column that collapses to icons; on a phone a 224px column would eat most
   * of the screen, so it slides in over the content as a drawer instead and the collapse
   * chevron is replaced by a hamburger. `collapsed` deliberately doesn't apply below
   * `lg` — an icons-only rail is a desktop space-saving trick, and it would just make a
   * phone drawer harder to read for no gain.
   */
  // Navigating from inside the drawer should close it — otherwise the new page renders
  // underneath a still-open overlay.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <div className="flex min-h-dvh">
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
        />
      )}

      <Sidebar collapsed={collapsed} mobileOpen={mobileOpen} />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          collapsed={collapsed}
          onToggleCollapsed={() => setCollapsed((c) => !c)}
          onOpenMobile={() => setMobileOpen(true)}
          toolbar={toolbar}
        />

        <div className="border-b border-line bg-surface px-4 py-2 text-xs text-muted sm:px-6">
          {breadcrumb}
        </div>

        <main className="flex-1 overflow-y-auto bg-ink px-4 py-6 sm:px-6">
          {/* Renders nothing, ever. It only writes the record for an acceptance already given
              on /signup, in the one case where asking and recording cannot happen together —
              Google sign-up leaves the page before a session exists. Consent is asked for at
              signup and nowhere else. */}
          <ConsentRecorder />
          {children}
        </main>
      </div>
    </div>
  );
}

interface NavLink {
  readonly href: Route;
  readonly label: string;
  readonly icon: (props: { readonly className?: string }) => React.JSX.Element;
}

const NAV_LINKS: readonly NavLink[] = [
  { href: "/dashboard", label: "Dashboard", icon: GridIcon },
  { href: "/finder", label: "Search", icon: SearchIcon },
  { href: "/assistant", label: "AI Assistant", icon: SparkleIcon },
  { href: "/map", label: "Market Explorer", icon: MapIcon },
];

/**
 * Mashvisor's "Research & Analyze" nests sub-pages; the real, buildable equivalents here are
 * these — a rank-many-cities "Market Performance" needs a feature this product doesn't have
 * (see "Hong Kong only" in CLAUDE.md).
 *
 * **"Analyse a property" leads the group**, as an ordinary item rather than the white pill it
 * used to be above the list. The pill's argument was that every other entry is a *place* and
 * this is the one *action* — Gmail's Compose. Asked to make it match the rest, and the group
 * label is the reason the request is right: this section is literally called *Research &
 * Analyse*, and analysing a property is the analysis. It reads as the first thing you do in
 * the section rather than a control floating above the navigation.
 *
 * It is first in the group, not alphabetical: the two market pages are context, this is the
 * thing the context is for.
 */
const RESEARCH_LINKS: readonly NavLink[] = [
  { href: "/analyse", label: "Analyse a property", icon: DocumentIcon },
  { href: "/research/market-performance", label: "Market Performance", icon: TrendIcon },
  { href: "/research/market-regulations", label: "Market Regulations", icon: ScaleIcon },
];

/**
 * "My Workspace" is the one group Mashvisor itself renders as an expandable dropdown
 * rather than a flat link, so this mirrors that specifically rather than every group —
 * Research & Analyse's two items read fine as a flat pair; four sub-pages under one
 * label read better collapsed by default. `/portfolio` is both the group's own link
 * and "Saved Properties" — Mashvisor draws that same overlap in its own sidebar.
 */
const WORKSPACE_LINKS: readonly NavLink[] = [
  { href: "/portfolio", label: "Saved Properties", icon: FolderIcon },
  { href: "/portfolio/compare", label: "Property Compare", icon: CompareIcon },
  { href: "/portfolio/alerts", label: "Property Alerts", icon: BellIcon },
  { href: "/portfolio/favorites", label: "My Favorite Markets", icon: StarIcon },
];

/** Services — the same expandable-group treatment My Workspace gets, because it is the other
 *  place with several related leaves rather than one destination. */
const SERVICES_LINKS: readonly NavLink[] = [
  { href: "/mortgage", label: "Mortgage", icon: WalletIcon },
  { href: "/insurance", label: "Insurance", icon: ShieldIcon },
  { href: "/agent-finder", label: "Agent Finder", icon: BadgeIcon },
  { href: "/home-valuation", label: "Home Valuation", icon: TagIcon },
];

/**
 * Pricing was here and is not any more, on request.
 *
 * It reads better as a marketing-header item than a product-sidebar one, and the two are not
 * the same audience: the sidebar belongs to someone already inside the product, while a price
 * list is read by someone deciding whether to be. That is the same reasoning that took
 * `/pricing` out of the app shell entirely a day earlier — the sidebar entry was the last
 * piece of that move left behind. It is still in the marketing header, the landing page's
 * pricing section and the footer.
 */
const TAIL_LINKS: readonly NavLink[] = [
  { href: "/account", label: "Settings", icon: GearIcon },
  { href: "/resources", label: "Resources", icon: BookIcon },
];

/** Home Valuation's glyph. It was drawn for Pricing, which has since left this nav; kept
 *  because Services still uses it, and a price tag reads correctly for a valuation too. */
function TagIcon({ className }: { readonly className?: string }): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M4 11.5V5a1 1 0 0 1 1-1h6.5L20 12.5 12.5 20 4 11.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <circle cx="8.5" cy="8.5" r="1.4" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function Sidebar({
  collapsed,
  mobileOpen,
}: {
  readonly collapsed: boolean;
  readonly mobileOpen: boolean;
}): React.JSX.Element {
  const pathname = usePathname();

  /**
   * **Exact match, not prefix.** It used to be `pathname === href || startsWith(href +
   * "/")`, which lit up three items at once inside My Workspace: on `/portfolio/alerts`
   * both "Property Alerts" (the real page) *and* "Saved Properties" highlighted, because
   * `/portfolio` is a prefix of every one of its own children. A nav that claims you are
   * in two places is worse than one that claims neither.
   *
   * Prefix matching is still what the *group* wants — see `workspaceActive` and
   * `sectionActive` below — so it stays available, just not as the default for a leaf.
   */
  const isActive = (href: string): boolean => pathname === href;
  const sectionActive = (href: string): boolean =>
    pathname === href || pathname?.startsWith(`${href}/`) === true;
  const workspaceActive = sectionActive("/portfolio");
  const [workspaceOpen, setWorkspaceOpen] = useState(workspaceActive);
  /* The leaves are top-level now, so a single prefix no longer covers the group. Listed
     explicitly rather than matched loosely — `/mortgage` and `/insurance` share no prefix. */
  const servicesActive =
    pathname.startsWith("/services") ||
    SERVICES_LINKS.some((l) => pathname === l.href);
  const [servicesOpen, setServicesOpen] = useState(servicesActive);

  return (
    <nav
      className={`fixed inset-y-0 left-0 z-50 flex w-56 shrink-0 flex-col overflow-y-auto bg-gradient-to-b from-accent to-inverse py-5 transition-transform duration-200 lg:static lg:z-auto lg:translate-x-0 lg:transition-[width] ${
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      } ${collapsed ? "lg:w-16" : "lg:w-56"}`}
      aria-label="App navigation"
    >
      <Link href="/" className={`flex items-center gap-2.5 px-4 ${collapsed ? "lg:justify-center" : ""}`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- see site-nav.tsx */}
        <img
          src="/brand/veela-icon.svg"
          alt="Veela"
          width={24}
          height={25}
          className={collapsed ? "hidden lg:block" : "hidden"}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/veela-logo-white.svg"
          alt="Veela"
          width={92}
          height={22}
          className={collapsed ? "lg:hidden" : ""}
        />
      </Link>

      {/* The white "Analyse a property" pill used to sit here, above the list. It is now the
          first item of Research & Analyse, in the same treatment as every other entry — see
          `RESEARCH_LINKS` for why the request was the right call. */}

      <ul className="mt-6 space-y-1 px-2.5">
        {NAV_LINKS.map((item) => (
          <NavItem key={item.href} item={item} active={isActive(item.href)} collapsed={collapsed} />
        ))}
      </ul>

      <p
        className={`mt-6 px-5 font-mono text-[10px] uppercase tracking-[0.12em] text-inverseMuted ${
          collapsed ? "lg:hidden" : ""
        }`}
      >
        Research &amp; Analyse
      </p>
      <ul className={`mt-2 space-y-1 px-2.5 ${collapsed ? "lg:mt-6" : ""}`}>
        {RESEARCH_LINKS.map((item) => (
          <NavItem key={item.href} item={item} active={isActive(item.href)} collapsed={collapsed} />
        ))}
      </ul>

      <div className="mt-6 space-y-1 border-t border-white/10 px-2.5 pt-4">
        <button
          type="button"
          onClick={() => setWorkspaceOpen((o) => !o)}
          aria-expanded={workspaceOpen}
          title={collapsed ? "My Workspace" : undefined}
          /* The group reads as "you are somewhere in here" — brighter text, no wash. The
             wash belongs to the one leaf you are actually on, so the two are
             distinguishable instead of two identical slabs stacked on each other. */
          className={`flex w-full items-center gap-3 rounded-full px-3 py-2.5 text-sm font-medium transition-colors ${
            workspaceActive
              ? "text-inverseText"
              : "text-inverseMuted hover:bg-white/10 hover:text-inverseText"
          }`}
        >
          <SearchIcon className="h-[18px] w-[18px] shrink-0" />
          <span className={`flex-1 text-left ${collapsed ? "lg:hidden" : ""}`}>My Workspace</span>
          <ChevronDownIcon
            className={`h-3.5 w-3.5 shrink-0 transition-transform ${workspaceOpen ? "rotate-180" : ""} ${
              collapsed ? "lg:hidden" : ""
            }`}
          />
        </button>

        {workspaceOpen && (
          <ul className={`space-y-1 pl-4 ${collapsed ? "lg:pl-0" : ""}`}>
            {WORKSPACE_LINKS.map((item) => (
              <NavItem key={item.href} item={item} active={isActive(item.href)} collapsed={collapsed} />
            ))}
          </ul>
        )}
      </div>

      <div className="mt-2 space-y-1 px-2.5">
        <button
          type="button"
          onClick={() => setServicesOpen((o) => !o)}
          aria-expanded={servicesOpen}
          title={collapsed ? "Services" : undefined}
          className={`flex w-full items-center gap-3 rounded-full px-3 py-2.5 text-sm font-medium transition-colors ${
            servicesActive
              ? "text-inverseText"
              : "text-inverseMuted hover:bg-white/10 hover:text-inverseText"
          }`}
        >
          <LayersIcon className="h-[18px] w-[18px] shrink-0" />
          <span className={`flex-1 text-left ${collapsed ? "lg:hidden" : ""}`}>Services</span>
          <ChevronDownIcon
            className={`h-3.5 w-3.5 shrink-0 transition-transform ${servicesOpen ? "rotate-180" : ""} ${
              collapsed ? "lg:hidden" : ""
            }`}
          />
        </button>

        {servicesOpen && (
          <ul className={`space-y-1 pl-4 ${collapsed ? "lg:pl-0" : ""}`}>
            {SERVICES_LINKS.map((item) => (
              <NavItem key={item.href} item={item} active={isActive(item.href)} collapsed={collapsed} />
            ))}
          </ul>
        )}
      </div>

      <ul className="mt-2 space-y-1 px-2.5">
        {TAIL_LINKS.map((item) => (
          <NavItem key={item.href} item={item} active={isActive(item.href)} collapsed={collapsed} />
        ))}
      </ul>

      {/* `mt-auto` pins this to the bottom of the rail — account state is the one thing a
          reader looks for in a fixed place rather than by scanning. */}
      <SidebarAccount collapsed={collapsed} />
    </nav>
  );
}

/**
 * Who you are, and the way in or out. **The sidebar had no auth affordance at all** until
 * `/analyse` and `/map` moved into it — the marketing header carried "Sign in" and the
 * signed-in menu, so a reader inside the app shell had no way to log in, no way to log
 * out, and no indication of whether they were signed in. Unifying the navigation is what
 * made that gap load-bearing rather than merely odd.
 *
 * Unconfigured Supabase renders nothing, the same rule as everywhere else this project
 * touches auth: an affordance that cannot work should not be shown.
 */
function SidebarAccount({ collapsed }: { readonly collapsed: boolean }): React.JSX.Element | null {
  const { user, loading, configured } = useAuth();
  if (!configured) return null;

  return (
    <div className="mt-auto border-t border-white/10 px-2.5 pt-4">
      {loading ? (
        <p className={`px-3 text-xs text-inverseMuted ${collapsed ? "lg:hidden" : ""}`}>…</p>
      ) : user === null ? (
        <Link
          href="/login"
          title={collapsed ? "Log in" : undefined}
          className="flex items-center gap-2.5 rounded-full bg-white px-3 py-2.5 text-sm font-medium text-accent shadow-card transition-opacity hover:opacity-90"
        >
          <UserIcon className="h-[18px] w-[18px] shrink-0" />
          <span className={collapsed ? "lg:hidden" : ""}>Log in</span>
        </Link>
      ) : (
        /* Who you are, linking to Settings — **not** a sign-out button.
           Sign out used to sit here, one stray click from every page in the product, which
           is a lot of exposure for an action nobody performs often. It now lives inside
           Settings, where a reader looks for it deliberately. */
        <Link
          href="/account"
          title={collapsed ? (user.email ?? "Settings") : undefined}
          className="flex items-center gap-2.5 rounded-full px-3 py-2 text-inverseMuted transition-colors hover:bg-white/10 hover:text-inverseText"
        >
          <UserIcon className="h-[18px] w-[18px] shrink-0" />
          <span className={`min-w-0 ${collapsed ? "lg:hidden" : ""}`}>
            <span className="block truncate text-xs" title={user.email ?? undefined}>
              {user.email}
            </span>
            <span className="block text-[11px] opacity-70">Settings &amp; sign out</span>
          </span>
        </Link>
      )}
    </div>
  );
}

function UserIcon({ className }: { readonly className?: string }): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="12" cy="8" r="3.4" stroke="currentColor" strokeWidth="1.7" />
      <path d="M5 20c0-3.6 3.1-5.6 7-5.6s7 2 7 5.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function NavItem({
  item,
  active,
  collapsed,
}: {
  readonly item: NavLink;
  readonly active: boolean;
  readonly collapsed: boolean;
}): React.JSX.Element {
  return (
    <li>
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        title={collapsed ? item.label : undefined}
        /* A translucent wash and a brighter label, not a solid white pill. The pill came
           from a Mashvisor screenshot and worked there, on one active item at a time; here
           it stacked — a group and its child are both "active" — and three white slabs on
           a blue rail read as an error rather than a selection. Selected now means
           *slightly lifted off the rail*, which is enough when only one leaf can be
           active and the label already brightens. */
        className={`flex items-center gap-2.5 rounded-full px-3 py-2.5 text-sm transition-colors ${
          active
            ? "bg-white/15 font-medium text-inverseText"
            : "text-inverseMuted hover:bg-white/10 hover:text-inverseText"
        }`}
      >
        {/* `collapsed` is a desktop-only affordance — an icons-only rail saves width on a
            wide screen, but the mobile drawer is already an overlay and hiding its labels
            would only make it harder to read. So collapsing hides via `lg:hidden` rather
            than by not rendering, which would apply at every width. */}
        {active && (
          <span aria-hidden className={`size-1.5 shrink-0 rounded-full bg-white ${collapsed ? "lg:hidden" : ""}`} />
        )}
        <item.icon className="h-[18px] w-[18px] shrink-0" />
        <span className={collapsed ? "lg:hidden" : ""}>{item.label}</span>
      </Link>
    </li>
  );
}

function TopBar({
  collapsed,
  onToggleCollapsed,
  onOpenMobile,
  toolbar,
}: {
  readonly collapsed: boolean;
  readonly onToggleCollapsed: () => void;
  readonly onOpenMobile: () => void;
  readonly toolbar?: ReactNode;
}): React.JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-line bg-surface px-4 py-3 sm:gap-4">
      {/* Two buttons, one slot: below `lg` the sidebar is an off-canvas drawer and this
          opens it; at `lg` and up it's a permanent column and the chevron collapses it
          to icons. Same position, different job — never both at once. */}
      <button
        type="button"
        onClick={onOpenMobile}
        aria-label="Open navigation"
        className="grid size-8 shrink-0 place-items-center rounded-card border border-line text-muted transition-colors hover:text-mist lg:hidden"
      >
        <MenuIcon className="h-4 w-4" />
      </button>

      <button
        type="button"
        onClick={onToggleCollapsed}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="hidden size-8 shrink-0 place-items-center rounded-card border border-line text-muted transition-colors hover:text-mist lg:grid"
      >
        <ChevronIcon className={`h-4 w-4 transition-transform ${collapsed ? "rotate-180" : ""}`} />
      </button>

      {toolbar !== undefined && (
        <div className="flex w-full flex-1 flex-wrap items-center gap-3 sm:w-auto sm:gap-4">{toolbar}</div>
      )}
    </div>
  );
}

function MenuIcon({ className }: { readonly className?: string }): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function ToggleButton({
  active,
  onClick,
  children,
}: {
  readonly active: boolean;
  readonly onClick: () => void;
  readonly children: ReactNode;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
        active ? "bg-accent text-white shadow-card" : "text-muted hover:text-mist"
      }`}
    >
      {children}
    </button>
  );
}

export function GridIcon({ className }: { readonly className?: string }): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect x="4" y="4" width="7" height="7" rx="1.2" stroke="currentColor" strokeWidth="1.7" />
      <rect x="13" y="4" width="7" height="7" rx="1.2" stroke="currentColor" strokeWidth="1.7" />
      <rect x="4" y="13" width="7" height="7" rx="1.2" stroke="currentColor" strokeWidth="1.7" />
      <rect x="13" y="13" width="7" height="7" rx="1.2" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

export function SearchIcon({ className }: { readonly className?: string }): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="M20 20l-4.3-4.3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function SparkleIcon({ className }: { readonly className?: string }): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z"
        fill="currentColor"
      />
    </svg>
  );
}

export function MapIcon({ className }: { readonly className?: string }): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M9 4 4 6v14l5-2 6 2 5-2V4l-5 2-6-2Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M9 4v14M15 6v14" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

export function TableIcon({ className }: { readonly className?: string }): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect x="4" y="5" width="16" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="M4 10h16M9.5 5v14" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

export function ListIcon({ className }: { readonly className?: string }): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M8 6h12M8 12h12M8 18h12"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <circle cx="4" cy="6" r="1.3" fill="currentColor" />
      <circle cx="4" cy="12" r="1.3" fill="currentColor" />
      <circle cx="4" cy="18" r="1.3" fill="currentColor" />
    </svg>
  );
}

export function TrendIcon({ className }: { readonly className?: string }): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M4 16l5-5 4 4 7-8"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M15 7h5v5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ScaleIcon({ className }: { readonly className?: string }): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M12 3v18M7 21h10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path
        d="M12 5l-5 3 2.5 6h5L12 8"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 5l5 3-2.5 6"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function FolderIcon({ className }: { readonly className?: string }): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M4 7a1 1 0 0 1 1-1h4l2 2h8a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function GearIcon({ className }: { readonly className?: string }): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M12 3.5v2.3M12 18.2v2.3M20.5 12h-2.3M5.8 12H3.5M17.7 6.3l-1.6 1.6M7.9 16.1l-1.6 1.6M17.7 17.7l-1.6-1.6M7.9 7.9 6.3 6.3"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function BookIcon({ className }: { readonly className?: string }): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M5 4.5h6a2 2 0 0 1 2 2V20a2 2 0 0 0-2-1.5H5a1 1 0 0 1-1-1V5.5a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M19 4.5h-6a2 2 0 0 0-2 2V20a2 2 0 0 1 2-1.5h6a1 1 0 0 0 1-1V5.5a1 1 0 0 0-1-1Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CompareIcon({ className }: { readonly className?: string }): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect x="3.5" y="6" width="7.5" height="13" rx="1.3" stroke="currentColor" strokeWidth="1.7" />
      <rect x="13" y="4" width="7.5" height="15" rx="1.3" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function BellIcon({ className }: { readonly className?: string }): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M6 10a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5h-15S6 14 6 10Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M10 18.5a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function StarIcon({ className }: { readonly className?: string }): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M12 3.5l2.6 5.6 6 .8-4.4 4.2 1.1 6-5.3-3-5.3 3 1.1-6-4.4-4.2 6-.8L12 3.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronDownIcon({ className }: { readonly className?: string }): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M6 9l6 6 6-6"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronIcon({ className }: { readonly className?: string }): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M15 6l-6 6 6 6"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* Services glyphs, in the sidebar's house style: 24×24, stroked, currentColor. */

function LayersIcon({ className }: { readonly className?: string }): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round">
      <path d="M12 3 3 7.5 12 12l9-4.5L12 3Z" />
      <path d="M3 12.5 12 17l9-4.5" />
      <path d="M3 17 12 21.5 21 17" />
    </svg>
  );
}

function ShieldIcon({ className }: { readonly className?: string }): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round">
      <path d="M12 3 5 6v6c0 4.2 2.9 7.6 7 9 4.1-1.4 7-4.8 7-9V6l-7-3Z" />
      <path d="m9 12 2 2 4-4" strokeLinecap="round" />
    </svg>
  );
}

function BadgeIcon({ className }: { readonly className?: string }): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round">
      <circle cx="12" cy="9" r="4.5" />
      <path d="M8.5 12.8 7 21l5-2.5 5 2.5-1.5-8.2" strokeLinecap="round" />
    </svg>
  );
}
