"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  AppShell,
  BookIcon,
  FolderIcon,
  GearIcon,
  MapIcon,
  ScaleIcon,
  SearchIcon,
  SparkleIcon,
  TrendIcon,
} from "../../components/app-shell";
import { useAuth } from "../../components/auth-provider";

/**
 * The front door of the "app" section — quick links to every real tool, plus (when
 * logged in) how many properties are saved. Deliberately not a metrics-heavy landing
 * page: with a personal portfolio in the single digits, a count and a link say
 * everything a chart would, without a chart's implied precision.
 */
export default function DashboardPage(): React.JSX.Element {
  const { user, configured } = useAuth();
  const [propertyCount, setPropertyCount] = useState<number | null>(null);

  useEffect(() => {
    if (user === null) return;
    let cancelled = false;
    fetch("/api/properties")
      .then((res) => (res.ok ? res.json() : null))
      .then((json: { properties: readonly unknown[] } | null) => {
        if (!cancelled && json !== null) setPropertyCount(json.properties.length);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <AppShell breadcrumb="Dashboard">
      <header className="max-w-prose">
        <h1 className="font-display text-[26px] font-semibold tracking-[-0.03em] text-mist">
          Dashboard
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Everything Veela does, in one place. Nothing here needs an account except
          the portfolio tile below.
        </p>
      </header>

      {configured && user !== null && (
        <p className="mt-6 max-w-prose text-sm text-muted">
          {propertyCount === null
            ? "Loading your portfolio…"
            : propertyCount === 0
              ? "No properties saved yet."
              : `${propertyCount} ${propertyCount === 1 ? "property" : "properties"} saved.`}{" "}
          <Link href="/portfolio" className="text-accent hover:underline">
            View portfolio →
          </Link>
        </p>
      )}

      {configured && user === null && (
        <p className="mt-6 max-w-prose text-sm text-muted">
          <Link href="/login?next=/dashboard" className="text-accent hover:underline">
            Log in
          </Link>{" "}
          to save properties and see them here next time.
        </p>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Tile
          href="/analyse"
          icon={SearchIcon}
          title="Analyse a property"
          detail="Enter a property's figures and get the full yield, tax and stamp-duty report."
        />
        <Tile
          href="/finder"
          icon={SearchIcon}
          title="Search"
          detail="Screen sample listings by price, size and yield, then open the full report."
        />
        <Tile
          href="/map"
          icon={MapIcon}
          title="Market Explorer"
          detail="Supply and demand by district — vacancy against transaction volume."
        />
        <Tile
          href="/research/market-performance"
          icon={TrendIcon}
          title="Market Performance"
          detail="Price and rent index trends over time, territory-wide and by district."
        />
        <Tile
          href="/research/market-regulations"
          icon={ScaleIcon}
          title="Market Regulations"
          detail="Stamp duty, property tax and the short-let rule — read straight from the rules the engine actually uses."
        />
        <Tile
          href="/assistant"
          icon={SparkleIcon}
          title="AI Assistant"
          detail="Ask about a property on screen, or a Hong Kong tax rule, any time."
        />
        <Tile
          href="/portfolio"
          icon={FolderIcon}
          title="My Workspace"
          detail="Properties you've saved from a report, with their figures at the time."
        />
        <Tile
          href="/account"
          icon={GearIcon}
          title="Manage"
          detail="Your account and how your data is used."
        />
        <Tile
          href="/resources"
          icon={BookIcon}
          title="Resources"
          detail="What net yield, cap rate and stamp duty scales actually mean, and where the numbers come from."
        />
      </div>
    </AppShell>
  );
}

function Tile({
  href,
  icon: Icon,
  title,
  detail,
}: {
  readonly href: Parameters<typeof Link>[0]["href"];
  readonly icon: (props: { readonly className?: string }) => React.JSX.Element;
  readonly title: string;
  readonly detail: string;
}): React.JSX.Element {
  return (
    <Link href={href} className="card card-hover block">
      <Icon className="h-5 w-5 text-accent" />
      <p className="mt-3 text-[15px] font-semibold">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted">{detail}</p>
    </Link>
  );
}
