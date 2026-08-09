"use client";

import { computeVerdict, HK_RULE_SETS, money, type PropertyInput, type Verdict } from "@veela/core";
import {
  DEMO_DISTRICTS,
  DEMO_LISTINGS,
  LISTINGS_NOTICE,
  type DemoDistrict,
  type DemoListing,
} from "@veela/fixtures";
import {
  formatCompactMoney,
  formatPercent,
  gradeNetYield,
  sequentialBin,
  standingColor,
  type Standing,
} from "@veela/ui";
import Link from "next/link";
import { useMemo, useState } from "react";

import { ListingsMap, type DistrictHeat, type FinderPin } from "./listings-map";
import { draftToCoreInput, INITIAL_DRAFT, type Draft } from "./property-form";

/**
 * A Mashvisor-style "Property Finder" — screen units against price, size and yield
 * criteria — built on data this product does not have: there is no bulk Hong Kong
 * listings feed (`.claude/CLAUDE.md`, "Hong Kong data landscape"). Every listing here is
 * fabricated by `@veela/fixtures/listings.ts`, on purpose without a building name or
 * street, precisely so nothing on this page can be mistaken for a real address.
 *
 * **The screening metric is unlevered net yield**, computed by the real engine
 * (`computeVerdict`) against a fixed cash-purchase assumption set — the same one
 * `INITIAL_DRAFT` uses on `/analyse`. Clicking a card hands its figures to `/analyse`,
 * where the fabrication stops at the input, never at the arithmetic.
 *
 * `districtQuery` and `view` are controlled from `app/finder/page.tsx`, which also owns
 * `FinderShell`'s top bar — the search box and the Map/Table toggle live in that bar,
 * not in this component, so there is exactly one place a district name is typed.
 */

const TRANSACTION_DATE = "2026-08-01";

export function listingToDraft(l: DemoListing, districtLabel: string): Draft {
  return {
    ...INITIAL_DRAFT,
    label: `${l.bedrooms}-bed sample flat — ${districtLabel}`,
    price: l.priceHkd,
    monthlyRent: l.monthlyRentHkd,
    saleableAreaSqft: l.saleableAreaSqft,
    monthlyManagementFee: l.monthlyManagementFeeHkd,
    transactionDate: TRANSACTION_DATE,
    agencyFee: Math.round(l.priceHkd * 0.01),
    annualOtherCosts: 8_000,
    legalFees: 15_000,
    vacancyRate: 4,
    loanAmount: 0,
  };
}

function listingToPropertyInput(l: DemoListing, districtLabel: string): PropertyInput {
  return draftToCoreInput(listingToDraft(l, districtLabel));
}

/** Case-insensitive substring match against the real district names — the top bar's
 *  search box and the breadcrumb both resolve a query the same way this does, so
 *  neither can show a district the other one didn't actually filter to. */
export function matchDistrictByQuery(query: string): DemoDistrict | undefined {
  const q = query.trim().toLowerCase();
  if (q === "") return undefined;
  return DEMO_DISTRICTS.find((d) => d.nameEn.toLowerCase().includes(q));
}

function districtName(id: string): string {
  return DEMO_DISTRICTS.find((d) => d.id === id)?.nameEn ?? id;
}

interface Row {
  readonly listing: DemoListing;
  readonly verdict: Verdict;
  readonly standing: Standing;
}

const PRICE_BANDS = [
  { id: "any", label: "Any price", min: 0, max: Infinity },
  { id: "u6", label: "Under HK$6M", min: 0, max: 6_000_000 },
  { id: "6-10", label: "HK$6–10M", min: 6_000_000, max: 10_000_000 },
  { id: "10-15", label: "HK$10–15M", min: 10_000_000, max: 15_000_000 },
  { id: "15-25", label: "HK$15–25M", min: 15_000_000, max: 25_000_000 },
  { id: "25", label: "HK$25M+", min: 25_000_000, max: Infinity },
] as const;

const YIELD_FLOORS = [
  { id: "any", label: "Any yield", min: -Infinity },
  { id: "2", label: "2%+", min: 0.02 },
  { id: "3", label: "3%+", min: 0.03 },
  { id: "4", label: "4%+", min: 0.04 },
] as const;

const BEDROOM_OPTIONS = ["any", "1", "2", "3", "4"] as const;

const SORTS = [
  { id: "yield-desc", label: "Net yield: high to low" },
  { id: "price-asc", label: "Price: low to high" },
  { id: "price-desc", label: "Price: high to low" },
  { id: "size-desc", label: "Size: large to small" },
] as const;
type SortId = (typeof SORTS)[number]["id"];

const HEAT_METRICS = [
  { id: "yield", label: "Net yield" },
  { id: "price", label: "Price per sq ft" },
] as const;
type HeatMetricId = (typeof HEAT_METRICS)[number]["id"];

interface Props {
  readonly districtQuery: string;
  readonly view: "map" | "table";
}

export function PropertyFinder({ districtQuery, view }: Props): React.JSX.Element {
  const [bedrooms, setBedrooms] = useState<(typeof BEDROOM_OPTIONS)[number]>("any");
  const [priceBandId, setPriceBandId] = useState<(typeof PRICE_BANDS)[number]["id"]>("any");
  const [yieldFloorId, setYieldFloorId] = useState<(typeof YIELD_FLOORS)[number]["id"]>("any");
  const [sort, setSort] = useState<SortId>("yield-desc");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [heatMetric, setHeatMetric] = useState<HeatMetricId>("yield");

  const mapsKey = process.env["NEXT_PUBLIC_GOOGLE_MAPS_API_KEY"];
  const matchedDistrict = matchDistrictByQuery(districtQuery);

  const rows = useMemo<readonly Row[]>(
    () =>
      DEMO_LISTINGS.map((listing) => {
        const input = listingToPropertyInput(listing, districtName(listing.districtId));
        const verdict = computeVerdict(input, HK_RULE_SETS);
        return { listing, verdict, standing: gradeNetYield(verdict.returns.netYield) };
      }),
    [],
  );

  const priceBand = PRICE_BANDS.find((b) => b.id === priceBandId) ?? PRICE_BANDS[0];
  const yieldFloor = YIELD_FLOORS.find((y) => y.id === yieldFloorId) ?? YIELD_FLOORS[0];

  const visible = useMemo(() => {
    const filtered = rows.filter((r) => {
      if (matchedDistrict !== undefined && r.listing.districtId !== matchedDistrict.id) {
        return false;
      }
      if (bedrooms !== "any" && String(r.listing.bedrooms) !== bedrooms) return false;
      if (r.listing.priceHkd < priceBand.min || r.listing.priceHkd > priceBand.max) return false;
      const netYield = r.verdict.returns.netYield;
      if (netYield === null || netYield < yieldFloor.min) return false;
      return true;
    });

    const sorted = [...filtered];
    sorted.sort((a, b) => {
      switch (sort) {
        case "price-asc":
          return a.listing.priceHkd - b.listing.priceHkd;
        case "price-desc":
          return b.listing.priceHkd - a.listing.priceHkd;
        case "size-desc":
          return b.listing.saleableAreaSqft - a.listing.saleableAreaSqft;
        case "yield-desc":
        default:
          return (b.verdict.returns.netYield ?? -1) - (a.verdict.returns.netYield ?? -1);
      }
    });
    return sorted;
  }, [rows, matchedDistrict, bedrooms, priceBand, yieldFloor, sort]);

  const pins: readonly FinderPin[] = visible.map((r) => ({
    listing: r.listing,
    standing: r.standing,
    label: `${districtName(r.listing.districtId)} · ${formatPercent(r.verdict.returns.netYield)} net yield`,
    priceLabel: formatCompactMoney(r.verdict.acquisition.price),
    yieldLabel: formatPercent(r.verdict.returns.netYield),
    metaLabel: `${districtName(r.listing.districtId)} · ${r.listing.bedrooms}-bed · ${r.listing.saleableAreaSqft} sqft`,
  }));

  // The heatmap wash — one figure per district, averaged over whatever is currently
  // passing the filters, in whichever metric "Heat Map Filters" currently selects.
  // Filtering a district down to nothing removes its wash along with its pins.
  const heat: readonly DistrictHeat[] = useMemo(() => {
    const byDistrict = new Map<string, { total: number; count: number }>();
    for (const r of visible) {
      const value =
        heatMetric === "yield"
          ? r.verdict.returns.netYield
          : r.listing.priceHkd / r.listing.saleableAreaSqft;
      if (value === null) continue;
      const bucket = byDistrict.get(r.listing.districtId) ?? { total: 0, count: 0 };
      bucket.total += value;
      bucket.count += 1;
      byDistrict.set(r.listing.districtId, bucket);
    }
    const entries = [...byDistrict.entries()];

    if (heatMetric === "yield") {
      return entries.map(([districtId, { total, count }]) => ({
        districtId,
        color: standingColor[gradeNetYield(total / count)],
        count,
      }));
    }

    // Price per square foot has no "good/bad" standing — it's magnitude, so it takes
    // the sequential ramp (dataviz convention: sequential = one hue, light → dark),
    // not the yield's strong/fair/weak bands.
    const averages = entries.map(([districtId, { total, count }]) => ({
      districtId,
      value: total / count,
      count,
    }));
    const values = averages.map((a) => a.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    return averages.map((a) => ({
      districtId: a.districtId,
      color: sequentialBin(a.value, min, max),
      count: a.count,
    }));
  }, [visible, heatMetric]);

  function exportCsv(): void {
    const header = ["District", "Bedrooms", "Sqft", "Price (HKD)", "Net yield", "Floor"];
    const lines = visible.map((r) =>
      [
        districtName(r.listing.districtId),
        r.listing.bedrooms,
        r.listing.saleableAreaSqft,
        r.listing.priceHkd,
        r.verdict.returns.netYield === null ? "" : (r.verdict.returns.netYield * 100).toFixed(2),
        r.listing.floor,
      ].join(","),
    );
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "veela-finder-sample-listings.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <DemoBanner />

      <div className="card flex flex-wrap items-end gap-4 py-4">
        <FilterSelect
          label="Bedrooms"
          value={bedrooms}
          onChange={(v) => setBedrooms(v as typeof bedrooms)}
          options={BEDROOM_OPTIONS.map((b) => ({
            value: b,
            label: b === "any" ? "Any" : `${b}${b === "4" ? "+" : ""}`,
          }))}
        />
        <FilterSelect
          label="Price"
          value={priceBandId}
          onChange={(v) => setPriceBandId(v as typeof priceBandId)}
          options={PRICE_BANDS.map((b) => ({ value: b.id, label: b.label }))}
        />
        <FilterSelect
          label="Net yield"
          value={yieldFloorId}
          onChange={(v) => setYieldFloorId(v as typeof yieldFloorId)}
          options={YIELD_FLOORS.map((y) => ({ value: y.id, label: y.label }))}
        />
        <FilterSelect
          label="Sort"
          value={sort}
          onChange={(v) => setSort(v as SortId)}
          options={SORTS.map((s) => ({ value: s.id, label: s.label }))}
        />

        <span className="font-mono text-[11px] text-muted">
          {visible.length} of {rows.length} sample listings
        </span>

        <button
          type="button"
          onClick={exportCsv}
          disabled={visible.length === 0}
          className="btn-secondary ml-auto !px-4 !py-2 !text-xs disabled:pointer-events-none disabled:opacity-40"
        >
          <DownloadIcon className="h-3.5 w-3.5" /> Export
        </button>
      </div>

      {view === "table" ? (
        <ListingsTable rows={visible} />
      ) : (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] lg:items-start">
          {mapsKey !== undefined && mapsKey !== "" && (
            <div className="relative lg:sticky lg:top-24">
              <div className="absolute right-3 top-3 z-10">
                <label className="flex items-center gap-1.5 rounded-full border border-line bg-surface/95 px-3 py-1.5 text-[11px] shadow-card backdrop-blur">
                  <span className="text-muted">Heat map</span>
                  <select
                    value={heatMetric}
                    onChange={(e) => setHeatMetric(e.target.value as HeatMetricId)}
                    className="bg-transparent font-medium text-mist outline-none"
                  >
                    {HEAT_METRICS.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <ListingsMap
                pins={pins}
                heat={heat}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
              <p className="mt-3 text-xs leading-relaxed text-muted">
                The district wash averages the selected metric across whatever passes
                the filters — a heatmap, not a boundary. Pin colour always tracks net
                yield, regardless of the heat metric chosen. Positions are spread
                around each district's centre, not real coordinates.
              </p>
            </div>
          )}

          <div
            className={`grid gap-5 sm:grid-cols-2 ${mapsKey === undefined || mapsKey === "" ? "xl:grid-cols-3" : ""}`}
          >
            {visible.length === 0 ? (
              <p className="card col-span-full py-10 text-center text-sm text-muted">
                No sample listing matches these filters. Loosen one and it will
                reappear — this is a fixed set of {rows.length}, not a live search.
              </p>
            ) : (
              visible.map((r) => (
                <PropertyCard
                  key={r.listing.id}
                  row={r}
                  selected={r.listing.id === selectedId}
                  onSelect={() => setSelectedId(r.listing.id)}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ListingsTable({ rows }: { readonly rows: readonly Row[] }): React.JSX.Element {
  if (rows.length === 0) {
    return (
      <p className="card py-10 text-center text-sm text-muted">
        No sample listing matches these filters.
      </p>
    );
  }

  return (
    <div className="card overflow-x-auto p-0">
      <table className="w-full min-w-[40rem] text-sm">
        <caption className="px-4 py-2.5 text-left text-xs text-muted">
          {rows.length} sample listings. Every figure is generated — see the banner above.
        </caption>
        <thead>
          <tr className="border-y border-line bg-surfaceMuted text-left text-xs text-muted">
            <th scope="col" className="px-4 py-2 font-medium">District</th>
            <th scope="col" className="px-4 py-2 font-medium">Beds</th>
            <th scope="col" className="px-4 py-2 font-medium">Sqft</th>
            <th scope="col" className="px-4 py-2 text-right font-medium">Price</th>
            <th scope="col" className="px-4 py-2 text-right font-medium">Net yield</th>
            <th scope="col" className="px-4 py-2 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.listing.id} className="border-b border-line/60">
              <th scope="row" className="px-4 py-2.5 text-left font-normal text-mist">
                {districtName(r.listing.districtId)}
              </th>
              <td className="px-4 py-2.5 text-muted">{r.listing.bedrooms}</td>
              <td className="tnum px-4 py-2.5 text-muted">{r.listing.saleableAreaSqft}</td>
              <td className="tnum px-4 py-2.5 text-right text-mist">
                {formatCompactMoney(r.verdict.acquisition.price)}
              </td>
              <td
                className="tnum px-4 py-2.5 text-right font-medium"
                style={{ color: standingColor[r.standing] }}
              >
                {formatPercent(r.verdict.returns.netYield)}
              </td>
              <td className="px-4 py-2.5 text-right">
                <Link
                  href={`/analyse?listing=${r.listing.id}`}
                  className="text-xs font-medium text-accent hover:underline"
                >
                  Analyse →
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PropertyCard({
  row,
  selected,
  onSelect,
}: {
  readonly row: Row;
  readonly selected: boolean;
  readonly onSelect: () => void;
}): React.JSX.Element {
  const { listing, verdict, standing } = row;

  return (
    <article
      onMouseEnter={onSelect}
      className={`card card-hover overflow-hidden !p-0 ${selected ? "ring-2 ring-accent" : ""}`}
    >
      <PlaceholderArt seed={listing.id} />

      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[15px] font-semibold leading-snug">
              {listing.bedrooms}-bed sample flat
            </p>
            <p className="text-xs text-muted">
              {districtName(listing.districtId)} · {listing.saleableAreaSqft} sq ft ·
              floor {listing.floor}
            </p>
          </div>
          <span
            className="shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.08em]"
            style={{ color: standingColor[standing], backgroundColor: `${standingColor[standing]}1A` }}
          >
            {formatPercent(verdict.returns.netYield)}
          </span>
        </div>

        <p className="tnum mt-3 font-display text-[22px] font-semibold tracking-[-0.02em]">
          {formatCompactMoney(verdict.acquisition.price)}
        </p>
        <p className="mt-0.5 text-xs text-muted">
          Rent {formatCompactMoney(money(listing.monthlyRentHkd, "HKD"))}/mo (assumed) ·
          net yield before financing
        </p>

        <Link
          href={`/analyse?listing=${listing.id}`}
          className="btn-secondary mt-4 w-full !py-2 !text-[13px]"
        >
          View full analysis
        </Link>
      </div>
    </article>
  );
}

/**
 * Deliberately not a photo. A stock or AI-generated image beside a fabricated address
 * would look like a real listing; a flat illustration cannot be mistaken for one. Hue
 * is a stable hash of the listing id, so a card doesn't repaint on every re-render.
 */
function PlaceholderArt({ seed }: { readonly seed: string }): React.JSX.Element {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  const hue = hash % 360;

  return (
    <div
      className="flex h-36 items-center justify-center"
      style={{
        background: `linear-gradient(135deg, hsl(${hue} 55% 94%), hsl(${hue} 45% 86%))`,
      }}
    >
      <svg viewBox="0 0 64 64" className="h-14 w-14" aria-hidden="true">
        <rect x="14" y="18" width="36" height="40" rx="2" fill={`hsl(${hue} 35% 55%)`} />
        {[24, 32, 40, 48].flatMap((y) =>
          [20, 30, 40].map((x) => (
            <rect key={`${x}-${y}`} x={x} y={y} width="6" height="6" fill="white" opacity="0.85" />
          )),
        )}
        <rect x="8" y="52" width="48" height="6" rx="1" fill={`hsl(${hue} 30% 40%)`} />
      </svg>
      <span className="sr-only">No photo — illustrative listing only</span>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  readonly label: string;
  readonly value: string;
  readonly onChange: (v: string) => void;
  readonly options: readonly { value: string; label: string }[];
}): React.JSX.Element {
  return (
    <label className="text-xs">
      <span className="block text-muted">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 rounded-card border border-line bg-surfaceMuted px-2.5 py-1.5 text-sm text-mist outline-none focus:border-accent focus:bg-surface"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function DownloadIcon({ className }: { readonly className?: string }): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M12 4v11m0 0 4-4m-4 4-4-4M5 19h14"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DemoBanner(): React.JSX.Element {
  return (
    <div className="rounded-panel border border-caution/40 bg-caution/10 px-4 py-3 shadow-card">
      <p className="text-sm font-semibold text-mist">{LISTINGS_NOTICE.title}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted">{LISTINGS_NOTICE.detail}</p>
    </div>
  );
}
