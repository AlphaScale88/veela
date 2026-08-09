"use client";

import type { Route } from "next";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useState, type ReactNode } from "react";

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

  return (
    <div className="flex min-h-dvh">
      <Sidebar collapsed={collapsed} />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar collapsed={collapsed} onToggleCollapsed={() => setCollapsed((c) => !c)} toolbar={toolbar} />

        <div className="border-b border-line bg-surface px-6 py-2 text-xs text-muted">
          {breadcrumb}
        </div>

        <main className="flex-1 overflow-y-auto bg-ink px-6 py-6">{children}</main>
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

/** Mashvisor's "Research & Analyze" nests sub-pages; the real, buildable equivalents
 *  here are two — a real "Market Performance" section needs a rank-many-cities feature
 *  this product doesn't have (see "Hong Kong only" in CLAUDE.md), so it isn't a third
 *  item, it's these two. */
const RESEARCH_LINKS: readonly NavLink[] = [
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

const TAIL_LINKS: readonly NavLink[] = [
  { href: "/account", label: "Manage", icon: GearIcon },
  { href: "/resources", label: "Resources", icon: BookIcon },
];

function Sidebar({ collapsed }: { readonly collapsed: boolean }): React.JSX.Element {
  const pathname = usePathname();
  const isActive = (href: string): boolean => pathname === href || pathname?.startsWith(`${href}/`) === true;
  const workspaceActive = isActive("/portfolio");
  const [workspaceOpen, setWorkspaceOpen] = useState(workspaceActive);

  return (
    <nav
      className={`flex shrink-0 flex-col overflow-y-auto bg-gradient-to-b from-accent to-inverse py-5 transition-[width] duration-150 ${
        collapsed ? "w-16" : "w-56"
      }`}
      aria-label="App navigation"
    >
      <Link href="/" className={`flex items-center gap-2.5 px-4 ${collapsed ? "justify-center" : ""}`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- see site-nav.tsx */}
        {collapsed ? (
          <img src="/brand/veela-icon.svg" alt="Veela" width={24} height={25} />
        ) : (
          <img src="/brand/veela-logo-white.svg" alt="Veela" width={92} height={22} />
        )}
      </Link>

      <ul className="mt-8 space-y-1 px-2.5">
        {NAV_LINKS.map((item) => (
          <NavItem key={item.href} item={item} active={isActive(item.href)} collapsed={collapsed} />
        ))}
      </ul>

      {!collapsed && (
        <p className="mt-6 px-5 font-mono text-[10px] uppercase tracking-[0.12em] text-inverseMuted">
          Research &amp; Analyse
        </p>
      )}
      <ul className={`space-y-1 px-2.5 ${collapsed ? "mt-6" : "mt-2"}`}>
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
          className={`flex w-full items-center gap-3 rounded-full px-3 py-2.5 text-sm font-medium transition-colors ${
            workspaceActive
              ? "bg-white text-accent shadow-card"
              : "text-inverseMuted hover:bg-white/10 hover:text-inverseText"
          }`}
        >
          <SearchIcon className="h-[18px] w-[18px] shrink-0" />
          {!collapsed && (
            <>
              <span className="flex-1 text-left">My Workspace</span>
              <ChevronDownIcon className={`h-3.5 w-3.5 shrink-0 transition-transform ${workspaceOpen ? "rotate-180" : ""}`} />
            </>
          )}
        </button>

        {workspaceOpen && (
          <ul className={`space-y-1 ${collapsed ? "" : "pl-4"}`}>
            {WORKSPACE_LINKS.map((item) => (
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
    </nav>
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
        className={`flex items-center gap-2.5 rounded-full px-3 py-2.5 text-sm transition-colors ${
          active
            ? "bg-white font-medium text-accent shadow-card"
            : "text-inverseMuted hover:bg-white/10 hover:text-inverseText"
        }`}
      >
        {active && !collapsed && (
          <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-accent" />
        )}
        <item.icon className="h-[18px] w-[18px] shrink-0" />
        {!collapsed && <span>{item.label}</span>}
      </Link>
    </li>
  );
}

function TopBar({
  collapsed,
  onToggleCollapsed,
  toolbar,
}: {
  readonly collapsed: boolean;
  readonly onToggleCollapsed: () => void;
  readonly toolbar?: ReactNode;
}): React.JSX.Element {
  return (
    <div className="flex items-center gap-4 border-b border-line bg-surface px-4 py-3">
      <button
        type="button"
        onClick={onToggleCollapsed}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="grid size-8 shrink-0 place-items-center rounded-card border border-line text-muted transition-colors hover:text-mist"
      >
        <ChevronIcon className={`h-4 w-4 transition-transform ${collapsed ? "rotate-180" : ""}`} />
      </button>

      {toolbar !== undefined && <div className="flex flex-1 items-center gap-4">{toolbar}</div>}
    </div>
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
