"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  AppShell,
  FolderIcon,
  GearIcon,
  MapIcon,
  ScaleIcon,
  SearchIcon,
  SparkleIcon,
  StarIcon,
  TableIcon,
  TrendIcon,
} from "../../components/app-shell";
import { useAuth } from "../../components/auth-provider";
import {
  BuildingIcon,
  ClockIcon,
  DocumentIcon,
  ReceiptIcon,
  WalletIcon,
} from "../../components/icons";

/**
 * The front door of the app section — **grouped by what somebody came to do**, not by what
 * we called the features.
 *
 * It used to be a flat grid of eight tiles named "Market Explorer", "My Workspace",
 * "Manage". That is a list of our vocabulary, and it is the same failure a reader already
 * reported in the sidebar: *"I do not understand what each tab does."* Renaming the tabs was
 * only half the answer; the other half is that a page listing every tool at equal weight
 * asks the reader to hold the whole product in their head before choosing.
 *
 * Three groups, because there are three jobs people arrive with: learn the market, evaluate
 * one property, look after what you already own. Every existing page belongs to exactly one
 * of them, which is the test that the grouping is real rather than decorative — nothing had
 * to be invented and nothing was left over.
 *
 * **Still deliberately not a metrics dashboard.** With a personal portfolio in the single
 * digits, a count and a link say what a chart would without a chart's implied precision.
 * The count now sits in the group it belongs to rather than floating above everything, so it
 * answers "what do I own" where that question is being asked.
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
          Where do you want to start?
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Everything Veela does, grouped by what you came to do rather than by what we call
          it. Only the last group needs an account.
        </p>
      </header>

      <Group
        title="Understand the market"
        detail="Measured figures, no account needed. Nothing here asks you about a property."
      >
        <Tile
          href="/map"
          icon={MapIcon}
          title="Market map"
          detail="All eighteen districts — stock, vacancy, completions, rents, household income and what is being built next."
        />
        <Tile
          href="/research/market-performance"
          icon={TrendIcon}
          title="Prices and rents over time"
          detail="Price and rent indices back to 1993, by flat size, with transaction volumes underneath them."
        />
        <Tile
          href="/research/market-regulations"
          icon={ScaleIcon}
          title="Stamp duty and the rules"
          detail="Every dated duty scale, read from the same object the report prices against — plus a calculator and a glossary."
        />
      </Group>

      <Group
        title="Evaluate a property"
        detail="You have found something, or you are about to. The live preview is free; the full report needs an account."
      >
        <Tile
          href="/analyse"
          icon={DocumentIcon}
          title="Analyse a property"
          detail="Paste a listing link or type the figures. Net yield after duty, property tax, rates, fees and vacancy."
        />
        <Tile
          href="/finder"
          icon={SearchIcon}
          title="Screen listings"
          detail="Filter by price, size and yield. Sample listings while you are logged out, your own saved ones once you are in."
        />
        <Tile
          href="/mortgage"
          icon={WalletIcon}
          title="What a bank would lend"
          detail="The HKMA loan-to-value cap and the debt-servicing limit, applied to your income and the price."
        />
        <Tile
          href="/agent-finder"
          icon={ReceiptIcon}
          title="Check an agent"
          detail="What the Estate Agents Authority register says, and what Form 3 and Form 4 actually commit you to."
        />
      </Group>

      <Group
        title="Look after what you own"
        detail={
          configured && user === null
            ? "Needs an account — this is the half that remembers things."
            : "Saved from a report, with the figures as they stood on the day."
        }
        aside={
          configured && user !== null ? (
            <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-muted">
              {propertyCount === null
                ? "counting…"
                : `${propertyCount} saved`}
            </span>
          ) : configured && user === null ? (
            <Link
              href="/login?next=/dashboard"
              className="text-[13px] font-medium text-accent hover:underline"
            >
              Log in →
            </Link>
          ) : null
        }
      >
        <Tile
          href="/portfolio"
          icon={FolderIcon}
          title="My properties"
          detail="Everything you have saved, with combined value, rent and a blended net yield across the lot."
        />
        <Tile
          href="/portfolio/compare"
          icon={TableIcon}
          title="Compare"
          detail="Up to three side by side, on the snapshots they were saved with — including your notes."
        />
        <Tile
          href="/portfolio/alerts"
          icon={ClockIcon}
          title="Alerts"
          detail="Told when market rents or prices move against a saved figure, or when the duty rules change under it."
        />
        <Tile
          href="/portfolio/favorites"
          icon={StarIcon}
          title="Favourite districts"
          detail="The districts you are watching, gathered in one place."
        />
        <Tile
          href="/home-valuation"
          icon={BuildingIcon}
          title="What it might be worth now"
          detail="Applies the RVD price index to what you paid, and shows its working. Not a valuation, and it says so."
        />
      </Group>

      {/*
        * The tail is deliberately outside the three groups: neither is a job somebody
        * arrives with. The assistant is a floating button on every page already, and
        * settings is somewhere you go once.
        */}
      <div className="mt-10 flex flex-wrap gap-x-6 gap-y-2 border-t border-line pt-5 text-sm">
        <Link href="/assistant" className="inline-flex items-center gap-2 text-muted hover:text-mist">
          <SparkleIcon className="h-4 w-4" />
          Ask Veela
        </Link>
        <Link href="/account" className="inline-flex items-center gap-2 text-muted hover:text-mist">
          <GearIcon className="h-4 w-4" />
          Account and privacy
        </Link>
      </div>
    </AppShell>
  );
}

function Group({
  title,
  detail,
  aside,
  children,
}: {
  readonly title: string;
  readonly detail: string;
  readonly aside?: React.ReactNode;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return (
    <section className="mt-9">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h2 className="text-sm font-semibold text-mist">{title}</h2>
        {aside}
      </div>
      <p className="mt-1 max-w-prose text-xs leading-relaxed text-muted">{detail}</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{children}</div>
    </section>
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
