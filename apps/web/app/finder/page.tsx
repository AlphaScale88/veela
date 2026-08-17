"use client";

import { useEffect, useState } from "react";

import { AppShell, ListIcon, MapIcon, SearchIcon, TableIcon, ToggleButton } from "../../components/app-shell";
import { useAuth } from "../../components/auth-provider";
import { BuildingSearch } from "../../components/building-search";
import { DistrictKpiSummary } from "../../components/district-kpi-summary";
import { matchDistrictByQuery, PropertyFinder } from "../../components/property-finder";
import { SavedPropertyFinder } from "../../components/saved-property-finder";

/**
 * Two finders behind one toolbar.
 *
 * - **My properties** screens what the reader has imported and saved — real figures, real
 *   coordinates where a listing published them, their own photos.
 * - **Sample listings** screens the 54 generated flats, which is all this page used to do.
 *
 * ## Why both, rather than replacing one with the other
 *
 * Asked how to fix the fact that the listings are fabricated. The route chosen was the one
 * needing no data licence and no new supply: point the page at the reader's own properties.
 * **The demo was not deleted, and that is deliberate.** `/finder` is public and ungated on
 * purpose — a decision made on 09/08/2026, when the login wall came off precisely because
 * fabricated listings are marketing for the report rather than the product itself. Replacing
 * them outright would leave a logged-out visitor, and every brand-new account, looking at an
 * empty page, which throws away the demonstration this page exists to give.
 *
 * So the fabricated set stops pretending to be inventory and becomes what it always was — a
 * labelled sample you can switch to. **The mode defaults to real data whenever there is any**,
 * which is what makes this a fix rather than a toggle nobody ever finds.
 *
 * A client component from the top, because the toolbar's search box, the Map/List/Table toggle
 * and now the mode are all state this page owns and both finders read.
 */

type Mode = "mine" | "sample";

export default function FinderPage(): React.JSX.Element {
  const { user, configured } = useAuth();
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"map" | "list" | "table">("map");
  const [mode, setMode] = useState<Mode>("sample");
  /**
   * Whether the reader picked a mode themselves. Once they have, the default effect below stops
   * overriding it — otherwise the property count arriving a second later would yank the page
   * out from under somebody who had just chosen the sample deliberately.
   */
  const [modePinned, setModePinned] = useState(false);

  /* Default to real data when there is any, and only then. Cheap: this is the same list
     endpoint the finder itself calls, and all that is read from it is a length. */
  useEffect(() => {
    if (user === null || modePinned) return;
    let cancelled = false;
    void (async () => {
      const res = await fetch("/api/properties");
      if (!res.ok || cancelled) return;
      const { properties } = (await res.json()) as { properties: unknown[] };
      if (!cancelled && properties.length > 0) setMode("mine");
    })();
    return () => {
      cancelled = true;
    };
  }, [user, modePinned]);

  function choose(next: Mode): void {
    setMode(next);
    setModePinned(true);
  }

  const matched = mode === "sample" ? matchDistrictByQuery(query) : undefined;
  const breadcrumb =
    mode === "mine"
      ? "Hong Kong › My properties"
      : `Hong Kong › ${matched?.nameEn ?? "All districts"}`;

  return (
    <AppShell
      breadcrumb={breadcrumb}
      toolbar={
        <>
          <label className="relative flex-1">
            <span className="sr-only">
              {mode === "mine"
                ? "Search your saved properties by name or address"
                : "Search by district or neighbourhood"}
            </span>
            <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                mode === "mine"
                  ? "Search your properties — name or address…"
                  : "Search by district — e.g. Kennedy Town, Sha Tin…"
              }
              className="w-full max-w-md rounded-full border border-line bg-surfaceMuted py-2 pl-10 pr-4 text-sm outline-none transition-colors focus:border-accent focus:bg-surface"
            />
          </label>

          <div className="ml-auto flex items-center gap-1 rounded-full border border-line bg-surfaceMuted p-1">
            <ToggleButton active={view === "map"} onClick={() => setView("map")}>
              <MapIcon className="h-4 w-4" /> Map
            </ToggleButton>
            <ToggleButton active={view === "list"} onClick={() => setView("list")}>
              <ListIcon className="h-4 w-4" /> List
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
            {mode === "mine" ? (
              <>
                Screening <strong className="text-mist">your own saved properties</strong> — every
                figure here is one you entered or imported. Switch to the sample set to see the
                same screening run on generated data.
              </>
            ) : (
              <>
                Two searches, and they are not the same thing. The one directly below finds a{" "}
                <strong className="text-mist">real building</strong> by name, from the
                Government&apos;s address register. The filtered cards further down are{" "}
                <strong className="text-mist">generated examples</strong> — there is still no live
                Hong Kong listings feed behind them.
              </>
            )}
          </p>
        </header>

        {/* Only shown when there is an account system to hold properties: without Supabase
            configured there is exactly one thing this page can screen. */}
        {configured && (
          <div
            role="tablist"
            aria-label="What to screen"
            className="inline-flex items-center gap-1 rounded-full border border-line bg-surfaceMuted p-1"
          >
            <ModeTab active={mode === "mine"} onClick={() => choose("mine")}>
              My properties
            </ModeTab>
            <ModeTab active={mode === "sample"} onClick={() => choose("sample")}>
              Sample listings
            </ModeTab>
          </div>
        )}

        {/* Real data first, fabricated second — the order is the disclosure. */}
        <BuildingSearch />

        {mode === "mine" ? (
          <SavedPropertyFinder query={query} view={view} />
        ) : (
          <>
            {matched !== undefined && (
              <DistrictKpiSummary districtId={matched.id} districtName={matched.nameEn} />
            )}
            <PropertyFinder districtQuery={query} view={view} />
          </>
        )}
      </div>
    </AppShell>
  );
}

function ModeTab({
  active,
  onClick,
  children,
}: {
  readonly active: boolean;
  readonly onClick: () => void;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`rounded-full px-4 py-1.5 text-[13px] font-medium transition-colors ${
        active ? "bg-surface text-mist shadow-card" : "text-muted hover:text-mist"
      }`}
    >
      {children}
    </button>
  );
}
