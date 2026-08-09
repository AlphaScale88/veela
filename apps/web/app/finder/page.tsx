"use client";

import { useState } from "react";

import { AppShell, MapIcon, SearchIcon, TableIcon, ToggleButton } from "../../components/app-shell";
import { DistrictKpiSummary } from "../../components/district-kpi-summary";
import { matchDistrictByQuery, PropertyFinder } from "../../components/property-finder";

/**
 * Screen sample properties against price, size and yield criteria — the Mashvisor
 * "Property Finder" pattern, in the shared app shell (`AppShell`) rather than the
 * marketing site's header — see `components/site-chrome.tsx`. A client component from
 * the top, because the toolbar's search box and Map/Table toggle are state this page
 * owns, and both the toolbar itself and `PropertyFinder` (which filters by them) need
 * to read it.
 *
 * Everything under the demo banner in `PropertyFinder` is fabricated; see
 * `@veela/fixtures/listings.ts` for exactly why and what that does and does not imply.
 */
export default function FinderPage(): React.JSX.Element {
  const [districtQuery, setDistrictQuery] = useState("");
  const [view, setView] = useState<"map" | "table">("map");

  const matched = matchDistrictByQuery(districtQuery);
  const breadcrumb = `Hong Kong › ${matched?.nameEn ?? "All districts"}`;

  return (
    <AppShell
      breadcrumb={breadcrumb}
      toolbar={
        <>
          <label className="relative flex-1">
            <span className="sr-only">Search by district or neighbourhood</span>
            <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              value={districtQuery}
              onChange={(e) => setDistrictQuery(e.target.value)}
              placeholder="Search by district — e.g. Kennedy Town, Sha Tin…"
              className="w-full max-w-md rounded-full border border-line bg-surfaceMuted py-2 pl-10 pr-4 text-sm outline-none transition-colors focus:border-accent focus:bg-surface"
            />
          </label>

          <div className="ml-auto flex items-center gap-1 rounded-full border border-line bg-surfaceMuted p-1">
            <ToggleButton active={view === "map"} onClick={() => setView("map")}>
              <MapIcon className="h-4 w-4" /> Map
            </ToggleButton>
            <ToggleButton active={view === "table"} onClick={() => setView("table")}>
              <TableIcon className="h-4 w-4" /> Table
            </ToggleButton>
          </div>
        </>
      }
    >
      <div className="space-y-6">
        <header className="max-w-prose space-y-1.5">
          <h1 className="font-display text-[26px] font-semibold leading-tight tracking-[-0.03em] text-mist">
            Find a property worth analysing
          </h1>
          <p className="text-sm leading-relaxed text-muted">
            Filter by price, size and net yield, then open the full report on anything
            that looks worth a closer look. There is no live Hong Kong listings feed
            behind this yet — every card below is a generated example, clearly marked.
          </p>
        </header>

        {matched !== undefined && (
          <DistrictKpiSummary districtId={matched.id} districtName={matched.nameEn} />
        )}

        <PropertyFinder districtQuery={districtQuery} view={view} />
      </div>
    </AppShell>
  );
}
