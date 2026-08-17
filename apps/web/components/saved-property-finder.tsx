"use client";

import type { Verdict as CoreVerdict } from "@veela/core";
import type { Property } from "@veela/db";
import type { CreatePropertyInput } from "@veela/types";
import {
  formatCompactMoney,
  formatPercent,
  gradeNetYield,
  standingColor,
  type Standing,
} from "@veela/ui";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { useAuth } from "./auth-provider";
import { BuildingIcon } from "./icons";
import { CompareBar, CompareCheckbox, HeartButton, MAX_COMPARE } from "./listing-actions";
import { ListingsMap, type FinderPin } from "./listings-map";
import { signedUrls, type PropertyPhoto } from "../lib/property-photos";

/**
 * Screening the reader's **own saved properties** — the same Finder machinery, pointed at real
 * data instead of the fabricated catalogue.
 *
 * ## Why this exists
 *
 * `/finder` screened 54 generated flats, because there is no bulk Hong Kong listings feed to
 * screen instead (`.claude/CLAUDE.md`, "Hong Kong data landscape"): the Land Registry sells
 * transactions one at a time at HK$10 with no bulk option, and licensing Centaline or Midland
 * is a deferred commercial decision. Asked how to fix that, and the answer chosen was the one
 * needing no licence and no new data supply: **screen what the reader has actually imported and
 * saved.** It also happens to be the product's own stated model — "the user brings the
 * property" — applied to the one page that was still pretending otherwise.
 *
 * ## The filters are a smaller set than the demo's, and that is the honest part
 *
 * `PropertyFinder` offers twelve extra criteria — bedrooms, floor, renovation, furnishing,
 * outdoor space, view, car park, facilities, pets, tenancy — because it *generates* those
 * fields. **A saved property has none of them**, because the form that creates one never asks:
 * it collects price, rent, area, transaction date, buyer situation, costs and financing, and
 * that is all. Offering the same panel here would mean either inventing the values or filtering
 * on empty, and the second is worse than the first because it silently returns nothing.
 *
 * So this screens on what a saved property really carries, and the panel **says which criteria
 * are missing and why** rather than leaving a reader hunting for a filter that was never built.
 * If the form starts collecting bedrooms and floor, they belong here on the same day.
 *
 * ## District, and why there isn't a district filter
 *
 * A saved property's `districtId` is null in practice — `draftToApiInput` never sets it. The
 * tempting fix is to derive one from the stored coordinates by nearest district centroid, and it
 * was rejected: those centroids are accurate to a few hundred metres and Hong Kong's districts
 * are large with contested edges, so nearest-centroid would confidently mislabel anything near a
 * boundary. The top bar's search box therefore matches the **label and address text** here, which
 * is a behaviour that can be explained in one sentence and is never wrong.
 */

export interface SavedRow {
  readonly property: Property;
  readonly verdict: CoreVerdict | null;
  readonly standing: Standing;
  readonly coverUrl: string | undefined;
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

const AREA_BANDS = [
  { id: "any", label: "Any size", min: 0, max: Infinity },
  { id: "s", label: "Under 500 sq ft", min: 0, max: 500 },
  { id: "m", label: "500–800 sq ft", min: 500, max: 800 },
  { id: "l", label: "800–1,200 sq ft", min: 800, max: 1_200 },
  { id: "xl", label: "1,200 sq ft and up", min: 1_200, max: Infinity },
] as const;

const SORTS = [
  { id: "recent", label: "Recently saved" },
  { id: "yield-desc", label: "Net yield: high to low" },
  { id: "price-asc", label: "Price: low to high" },
  { id: "price-desc", label: "Price: high to low" },
  { id: "size-desc", label: "Size: large to small" },
] as const;
type SortId = (typeof SORTS)[number]["id"];

const PAGE_SIZE = 6;

function toMajor(minor: number): number {
  return minor / 100;
}

/**
 * Management fee lives inside the `costs` jsonb, which crosses the wire as `unknown`.
 *
 * The field is checked rather than assumed present: `costs` is validated by Zod on the way *in*,
 * but a row written before a schema change would satisfy the cast and not the shape — the same
 * class of bug as `toEngineInput` dereferencing a `null` that `!== undefined` waved through.
 */
function monthlyFee(property: Property): number | null {
  const costs = property.costs as CreatePropertyInput["costs"] | null | undefined;
  const minor = costs?.monthlyManagementFeeMinor;
  return typeof minor === "number" ? toMajor(minor) : null;
}

export function SavedPropertyFinder({
  query,
  view,
}: {
  readonly query: string;
  readonly view: "map" | "list" | "table";
}): React.JSX.Element {
  const { user } = useAuth();
  const [rows, setRows] = useState<readonly SavedRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [priceBandId, setPriceBandId] = useState<(typeof PRICE_BANDS)[number]["id"]>("any");
  const [yieldFloorId, setYieldFloorId] = useState<(typeof YIELD_FLOORS)[number]["id"]>("any");
  const [areaBandId, setAreaBandId] = useState<(typeof AREA_BANDS)[number]["id"]>("any");
  const [trackedOnly, setTrackedOnly] = useState(false);
  const [withPhotosOnly, setWithPhotosOnly] = useState(false);
  const [importedOnly, setImportedOnly] = useState(false);
  const [sort, setSort] = useState<SortId>("recent");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [compareIds, setCompareIds] = useState<readonly string[]>([]);
  const [heartBusy, setHeartBusy] = useState<string | null>(null);

  /**
   * Here the heart means **tracked**, not saved — the property already is saved, so there is
   * nothing for a save to do. `monitored` is the flag that already existed and already feeds
   * `/portfolio/alerts`, which is what "keep an eye on this" means in this product. Writing it
   * through the same `PATCH /properties/:id` the Alerts page uses means the two cannot disagree.
   */
  async function toggleTracked(row: SavedRow): Promise<void> {
    const id = row.property.id;
    setHeartBusy(id);
    try {
      const res = await fetch(`/api/properties/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ monitored: !row.property.monitored }),
      });
      if (res.ok) {
        setRows((prev) =>
          prev === null
            ? prev
            : prev.map((r) =>
                r.property.id === id
                  ? { ...r, property: { ...r.property, monitored: !r.property.monitored } }
                  : r,
              ),
        );
      }
    } finally {
      setHeartBusy(null);
    }
  }

  function toggleCompare(id: string): void {
    setCompareIds((ids) =>
      ids.includes(id)
        ? ids.filter((x) => x !== id)
        : ids.length >= MAX_COMPARE
          ? ids
          : [...ids, id],
    );
  }

  useEffect(() => {
    if (user === null) return;
    let cancelled = false;
    void (async () => {
      try {
        const listRes = await fetch("/api/properties");
        if (!listRes.ok) throw new Error(`Could not load your properties (${listRes.status}).`);
        const { properties } = (await listRes.json()) as { properties: Property[] };

        /* One request per property for its latest verdict, as `/portfolio` already does — fine
           at personal-portfolio scale and it keeps `GET /properties` cheap for callers that
           only want the list. Covers come from the one batch endpoint instead, because a
           request per photo would be an N+1 on top of an N+1. */
        const [detailed, coverRes] = await Promise.all([
          Promise.all(
            properties.map(async (property) => {
              const res = await fetch(`/api/properties/${property.id}`);
              if (!res.ok) return { property, verdict: null as CoreVerdict | null };
              const body = (await res.json()) as { verdict: { payload: CoreVerdict } | null };
              return { property, verdict: body.verdict?.payload ?? null };
            }),
          ),
          fetch("/api/photos/covers"),
        ]);

        let covers = new Map<string, string>();
        if (coverRes.ok) {
          const { covers: photos } = (await coverRes.json()) as { covers: PropertyPhoto[] };
          const urls = await signedUrls(photos.map((p) => p.storagePath));
          covers = new Map(
            photos.flatMap((p) => {
              const url = urls.get(p.storagePath);
              return url === undefined ? [] : [[p.propertyId, url] as const];
            }),
          );
        }

        if (cancelled) return;
        setRows(
          detailed.map(({ property, verdict }) => ({
            property,
            verdict,
            standing: gradeNetYield(verdict?.returns.netYield ?? null),
            coverUrl: covers.get(property.id),
          })),
        );
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Something went wrong.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const activeFilterCount =
    [priceBandId, yieldFloorId, areaBandId].filter((v) => v !== "any").length +
    [trackedOnly, withPhotosOnly, importedOnly].filter(Boolean).length;

  function resetFilters(): void {
    setPriceBandId("any");
    setYieldFloorId("any");
    setAreaBandId("any");
    setTrackedOnly(false);
    setWithPhotosOnly(false);
    setImportedOnly(false);
  }

  const visible = useMemo(() => {
    if (rows === null) return [];
    const price = PRICE_BANDS.find((b) => b.id === priceBandId) ?? PRICE_BANDS[0];
    const floor = YIELD_FLOORS.find((y) => y.id === yieldFloorId) ?? YIELD_FLOORS[0];
    const area = AREA_BANDS.find((a) => a.id === areaBandId) ?? AREA_BANDS[0];
    const q = query.trim().toLowerCase();

    const filtered = rows.filter((r) => {
      const p = r.property;
      if (q !== "") {
        const haystack = `${p.label} ${p.address ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      const major = toMajor(p.priceMinor);
      if (major < price.min || major > price.max) return false;

      /* A property with no area is not excluded by "Any size" but is excluded by a real band —
         it cannot be shown to satisfy a constraint on a figure it does not have. */
      if (areaBandId !== "any") {
        if (p.saleableAreaSqft === null) return false;
        if (p.saleableAreaSqft < area.min || p.saleableAreaSqft > area.max) return false;
      }
      if (yieldFloorId !== "any") {
        const y = r.verdict?.returns.netYield ?? null;
        if (y === null || y < floor.min) return false;
      }
      if (trackedOnly && !p.monitored) return false;
      if (withPhotosOnly && r.coverUrl === undefined) return false;
      if (importedOnly && p.sourceUrl === null) return false;
      return true;
    });

    const sorted = [...filtered];
    sorted.sort((a, b) => {
      switch (sort) {
        case "price-asc":
          return a.property.priceMinor - b.property.priceMinor;
        case "price-desc":
          return b.property.priceMinor - a.property.priceMinor;
        case "size-desc":
          return (b.property.saleableAreaSqft ?? 0) - (a.property.saleableAreaSqft ?? 0);
        case "yield-desc":
          return (b.verdict?.returns.netYield ?? -1) - (a.verdict?.returns.netYield ?? -1);
        case "recent":
        default:
          return (
            new Date(b.property.updatedAt).getTime() - new Date(a.property.updatedAt).getTime()
          );
      }
    });
    return sorted;
  }, [rows, query, priceBandId, yieldFloorId, areaBandId, trackedOnly, withPhotosOnly, importedOnly, sort]);

  useEffect(() => {
    setPage(1);
  }, [query, priceBandId, yieldFloorId, areaBandId, trackedOnly, withPhotosOnly, importedOnly, view]);

  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const paged = visible.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  /* Only properties that actually carry coordinates get a pin. Most do not: the form collects
     no location, so a coordinate means the property came from a listing link that published
     one. The count of unmapped properties is stated rather than left to be inferred from a
     map that looks emptier than the list beside it. */
  const pins: readonly FinderPin[] = visible.flatMap((r) => {
    const { latitude, longitude } = r.property;
    if (latitude === null || longitude === null) return [];
    return [
      {
        id: r.property.id,
        position: { lat: latitude, lng: longitude },
        standing: r.standing,
        label: `${r.property.label} · ${formatPercent(r.verdict?.returns.netYield ?? null)} net yield`,
        priceLabel: formatCompactMoney({
          amount: r.property.priceMinor,
          currency: r.property.currency,
        }),
        yieldLabel: formatPercent(r.verdict?.returns.netYield ?? null),
        metaLabel: r.property.address ?? r.property.label,
      },
    ];
  });
  const unmapped = visible.length - pins.length;

  function exportCsv(): void {
    const header = [
      "Label",
      "Price (HKD)",
      "Monthly rent (HKD)",
      "Sqft",
      "Net yield %",
      "Management fee (HKD/mo)",
      "Transaction date",
      "Tracked",
      "Source URL",
      "Address",
    ];
    const lines = visible.map((r) =>
      [
        `"${r.property.label.replace(/"/g, '""')}"`,
        toMajor(r.property.priceMinor),
        toMajor(r.property.monthlyRentMinor),
        r.property.saleableAreaSqft ?? "",
        r.verdict?.returns.netYield == null ? "" : (r.verdict.returns.netYield * 100).toFixed(2),
        monthlyFee(r.property) ?? "",
        r.property.transactionDate,
        r.property.monitored ? "yes" : "no",
        r.property.sourceUrl ?? "",
        `"${(r.property.address ?? "").replace(/"/g, '""')}"`,
      ].join(","),
    );
    const blob = new Blob([[header.join(","), ...lines].join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "veela-my-properties.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (user === null) {
    return (
      <p className="card max-w-prose text-sm text-muted">
        <Link href="/login?next=/finder" className="font-medium text-accent hover:underline">
          Log in
        </Link>{" "}
        to screen the properties you have saved. Nothing here needs an account until you have
        something of your own to screen.
      </p>
    );
  }

  if (error !== null) {
    return <p className="card max-w-prose text-sm text-negative">{error}</p>;
  }

  if (rows === null) {
    return <p className="card max-w-prose text-sm text-muted">Loading your properties…</p>;
  }

  if (rows.length === 0) {
    return (
      <div className="card max-w-prose">
        <h2 className="text-[15px] font-semibold">Nothing saved yet</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">
          This screens properties you have saved, so it starts empty. Analyse one — paste a
          listing link or type the figures in — then use <em>Save to my portfolio</em> on its
          report. Switch to <strong className="text-mist">Sample listings</strong> above to see
          how the screening works on a generated set first.
        </p>
        <Link href="/analyse" className="btn-primary mt-4 inline-flex !px-5 !py-2 !text-[13px]">
          Analyse a property
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <CompareBar ids={compareIds} max={MAX_COMPARE} onClear={() => setCompareIds([])} />
      <div className="card flex flex-wrap items-end gap-4 py-4">
        <FilterSelect
          label="Price"
          value={priceBandId}
          onChange={(v) => setPriceBandId(v as typeof priceBandId)}
          options={PRICE_BANDS}
        />
        <FilterSelect
          label="Net yield"
          value={yieldFloorId}
          onChange={(v) => setYieldFloorId(v as typeof yieldFloorId)}
          options={YIELD_FLOORS}
        />
        <FilterSelect
          label="Saleable area"
          value={areaBandId}
          onChange={(v) => setAreaBandId(v as typeof areaBandId)}
          options={AREA_BANDS}
        />
        <FilterSelect
          label="Sort"
          value={sort}
          onChange={(v) => setSort(v as SortId)}
          options={SORTS}
        />

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <Check label="Tracked only" checked={trackedOnly} onChange={setTrackedOnly} />
          <Check label="Has photos" checked={withPhotosOnly} onChange={setWithPhotosOnly} />
          <Check label="From a link" checked={importedOnly} onChange={setImportedOnly} />
        </div>

        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={resetFilters}
            className="pb-2 text-sm text-muted underline underline-offset-4 hover:text-mist"
          >
            Reset
          </button>
        )}

        <span className="ml-auto font-mono text-[11px] text-muted">
          {visible.length} of {rows.length} saved
        </span>

        <button
          type="button"
          onClick={exportCsv}
          disabled={visible.length === 0}
          className="btn-secondary !px-4 !py-2 !text-xs disabled:pointer-events-none disabled:opacity-40"
        >
          Export
        </button>
      </div>

      {/* Said on screen, not left to be discovered by a reader hunting for a filter that was
          never built. The absence is what the form collects, not an oversight — and it is the
          honest difference between screening real data and screening generated data. */}
      <p className="max-w-prose text-xs leading-relaxed text-muted">
        No bedrooms, floor, renovation or view filters here: a saved property carries none of
        those, because the report form does not ask for them. Every filter above reads a figure
        your saved properties actually have.
      </p>

      {view === "table" && <SavedTable rows={visible} />}

      {view === "list" &&
        (visible.length === 0 ? (
          <EmptyFilter total={rows.length} />
        ) : (
          <>
            <div className="space-y-3">
              {paged.map((r) => (
                <SavedRowCard
                  key={r.property.id}
                  row={r}
                  compact
                  heartBusy={heartBusy === r.property.id}
                  onHeart={() => void toggleTracked(r)}
                  compareChecked={compareIds.includes(r.property.id)}
                  compareFull={compareIds.length >= MAX_COMPARE}
                  onCompare={() => toggleCompare(r.property.id)}
                />
              ))}
            </div>
            <Pager page={currentPage} pageCount={pageCount} onPage={setPage} />
          </>
        ))}

      {view === "map" && (
        <div className="grid gap-5 lg:grid-cols-2">
          <div>
            <ListingsMap
              pins={pins}
              heat={[]}
              selectedId={selectedId}
              onSelect={setSelectedId}
              heightClassName="h-[520px]"
            />
            <p className="mt-2 text-xs leading-relaxed text-muted">
              {pins.length === 0
                ? "None of these carry coordinates, so the map is empty. A property only has a location if it came from a listing link that published one."
                : unmapped > 0
                  ? `${pins.length} mapped. ${unmapped} not shown — a property only has coordinates if it came from a listing link that published them.`
                  : `${pins.length} mapped from their listing's own coordinates.`}
            </p>
          </div>
          <div>
            {visible.length === 0 ? (
              <EmptyFilter total={rows.length} />
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  {paged.map((r) => (
                    <SavedRowCard
                      key={r.property.id}
                      row={r}
                      selected={r.property.id === selectedId}
                      onHover={() => setSelectedId(r.property.id)}
                      heartBusy={heartBusy === r.property.id}
                      onHeart={() => void toggleTracked(r)}
                      compareChecked={compareIds.includes(r.property.id)}
                      compareFull={compareIds.length >= MAX_COMPARE}
                      onCompare={() => toggleCompare(r.property.id)}
                    />
                  ))}
                </div>
                <Pager page={currentPage} pageCount={pageCount} onPage={setPage} />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SavedRowCard({
  row,
  compact = false,
  selected = false,
  onHover,
  heartBusy,
  onHeart,
  compareChecked,
  compareFull,
  onCompare,
}: {
  readonly row: SavedRow;
  readonly compact?: boolean;
  readonly selected?: boolean;
  readonly onHover?: () => void;
  readonly heartBusy: boolean;
  readonly onHeart: () => void;
  readonly compareChecked: boolean;
  readonly compareFull: boolean;
  readonly onCompare: () => void;
}): React.JSX.Element {
  const { property, verdict, standing, coverUrl } = row;
  const netYield = verdict?.returns.netYield ?? null;

  return (
    <article
      onMouseEnter={onHover}
      className={`card card-hover relative ${compact ? "flex items-center gap-4 !p-3" : "overflow-hidden !p-0"} ${
        selected ? "ring-2 ring-accent" : ""
      }`}
    >
      {/* No placeholder when there is no photo — a stock interior standing in for someone's
          own flat is the same false claim this product refuses to make with a number. */}
      {coverUrl !== undefined ? (
        /* eslint-disable-next-line @next/next/no-img-element -- expiring signed URL from a
           private bucket; next/image would need the host allow-listed and would cache a URL
           built to expire. */
        <img
          src={coverUrl}
          alt=""
          className={compact ? "h-16 w-20 shrink-0 rounded-card object-cover" : "aspect-[16/9] w-full object-cover"}
        />
      ) : compact ? (
        <span className="grid h-16 w-20 shrink-0 place-items-center rounded-card bg-accent/10 text-accent">
          <BuildingIcon className="h-5 w-5" />
        </span>
      ) : null}

      <div className={compact ? "min-w-0 flex-1" : "p-2.5"}>
        <p className={compact ? "text-[13px] font-semibold leading-snug" : "tnum font-display text-[18px] font-bold tracking-[-0.01em]"}>
          {compact
            ? property.label
            : formatCompactMoney({ amount: property.priceMinor, currency: property.currency })}
        </p>
        <p className="mt-0.5 text-[12px] text-muted">
          {compact
            ? formatCompactMoney({ amount: property.priceMinor, currency: property.currency })
            : property.label}
          {property.saleableAreaSqft !== null && ` · ${property.saleableAreaSqft} sq ft`}
          {" · rent "}
          {formatCompactMoney({ amount: property.monthlyRentMinor, currency: property.currency })}
          /mo
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-1">
          {!compact && coverUrl === undefined && (
            <span
              className="rounded-full px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.08em]"
              style={{ color: standingColor[standing], backgroundColor: `${standingColor[standing]}1A` }}
            >
              {formatPercent(netYield)}
            </span>
          )}
          {property.monitored && <Chip>Tracked</Chip>}
          {property.sourceUrl !== null && <Chip>From a link</Chip>}
          {coverUrl !== undefined && <Chip>Photo</Chip>}
        </p>
        {!compact && (
          <>
            <div className="mt-2 flex items-center gap-2">
              <CompareCheckbox
                checked={compareChecked}
                disabled={compareFull && !compareChecked}
                onChange={onCompare}
              />
              <span className="ml-auto">
                <HeartButton
                  filled={property.monitored}
                  busy={heartBusy}
                  label={property.monitored ? "Stop tracking this property" : "Track this property"}
                  onClick={onHeart}
                />
              </span>
            </div>
            <Link
              href={`/analyse?property=${property.id}`}
              className="btn-secondary mt-2 w-full !py-1.5 !text-[12px]"
            >
              Open the report
            </Link>
          </>
        )}
      </div>

      {compact && (
        <>
          <CompareCheckbox
            checked={compareChecked}
            disabled={compareFull && !compareChecked}
            onChange={onCompare}
          />
          <HeartButton
            filled={property.monitored}
            busy={heartBusy}
            label={property.monitored ? "Stop tracking this property" : "Track this property"}
            onClick={onHeart}
          />
          <div className="shrink-0 text-right">
            <span
              className="inline-block rounded-full px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.08em]"
              style={{ color: standingColor[standing], backgroundColor: `${standingColor[standing]}1A` }}
            >
              {formatPercent(netYield)}
            </span>
          </div>
          <Link
            href={`/analyse?property=${property.id}`}
            className="btn-secondary shrink-0 !px-3 !py-1.5 !text-[12px]"
          >
            Open
          </Link>
        </>
      )}

      {/* The yield badge sits over the photo where the demo cards put theirs — but only when
          there *is* a photo. Without one it would float over the price instead, so it moves
          inline into the flow. A badge overlapping the number it comments on is worse than a
          badge in a slightly different place on two kinds of card. */}
      {!compact && coverUrl !== undefined && (
        <span
          className="absolute right-2.5 top-2.5 rounded-full px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] shadow-card"
          style={{ color: standingColor[standing], backgroundColor: "rgba(255,255,255,0.92)" }}
        >
          {formatPercent(netYield)}
        </span>
      )}
    </article>
  );
}

function Chip({ children }: { readonly children: React.ReactNode }): React.JSX.Element {
  return (
    <span className="rounded-full bg-surfaceMuted px-1.5 py-0.5 text-[10px] text-muted">
      {children}
    </span>
  );
}

function SavedTable({ rows }: { readonly rows: readonly SavedRow[] }): React.JSX.Element {
  if (rows.length === 0) {
    return (
      <p className="card py-10 text-center text-sm text-muted">
        None of your saved properties match these filters.
      </p>
    );
  }
  return (
    <div className="card overflow-x-auto p-0">
      <table className="w-full min-w-[46rem] text-sm">
        <caption className="px-4 py-2.5 text-left text-xs text-muted">
          {rows.length} of your own saved properties. Every figure is one you entered or
          imported.
        </caption>
        <thead>
          <tr className="border-y border-line bg-surfaceMuted text-left text-xs text-muted">
            <th scope="col" className="px-4 py-2 font-medium">Property</th>
            <th scope="col" className="px-4 py-2 font-medium">Sqft</th>
            <th scope="col" className="px-4 py-2 text-right font-medium">Price</th>
            <th scope="col" className="px-4 py-2 text-right font-medium">Rent/mo</th>
            <th scope="col" className="px-4 py-2 text-right font-medium">Net yield</th>
            <th scope="col" className="px-4 py-2 font-medium">Source</th>
            <th scope="col" className="px-4 py-2 font-medium" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.property.id} className="border-b border-line/60">
              <th scope="row" className="px-4 py-2.5 text-left font-normal text-mist">
                {r.property.label}
              </th>
              <td className="tnum px-4 py-2.5 text-muted">{r.property.saleableAreaSqft ?? "—"}</td>
              <td className="tnum px-4 py-2.5 text-right text-mist">
                {formatCompactMoney({ amount: r.property.priceMinor, currency: r.property.currency })}
              </td>
              <td className="tnum px-4 py-2.5 text-right text-muted">
                {formatCompactMoney({
                  amount: r.property.monthlyRentMinor,
                  currency: r.property.currency,
                })}
              </td>
              <td
                className="tnum px-4 py-2.5 text-right font-medium"
                style={{ color: standingColor[r.standing] }}
              >
                {formatPercent(r.verdict?.returns.netYield ?? null)}
              </td>
              <td className="px-4 py-2.5 text-xs text-muted">
                {r.property.sourceUrl === null ? "Typed in" : hostOf(r.property.sourceUrl)}
              </td>
              <td className="px-4 py-2.5 text-right">
                <Link
                  href={`/analyse?property=${r.property.id}`}
                  className="text-xs font-medium text-accent hover:underline"
                >
                  Open →
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "a link";
  }
}

function EmptyFilter({ total }: { readonly total: number }): React.JSX.Element {
  return (
    <p className="card py-10 text-center text-sm text-muted">
      None of your {total} saved propert{total === 1 ? "y" : "ies"} match these filters. Loosen
      one and it reappears.
    </p>
  );
}

function Pager({
  page,
  pageCount,
  onPage,
}: {
  readonly page: number;
  readonly pageCount: number;
  readonly onPage: (p: number) => void;
}): React.JSX.Element | null {
  if (pageCount <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-center gap-3 text-sm">
      <button
        type="button"
        onClick={() => onPage(page - 1)}
        disabled={page <= 1}
        className="text-muted hover:text-mist disabled:opacity-40"
      >
        Previous
      </button>
      <span className="font-mono text-[11px] text-muted">
        {page} / {pageCount}
      </span>
      <button
        type="button"
        onClick={() => onPage(page + 1)}
        disabled={page >= pageCount}
        className="text-muted hover:text-mist disabled:opacity-40"
      >
        Next
      </button>
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
  readonly options: readonly { readonly id: string; readonly label: string }[];
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
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Check({
  label,
  checked,
  onChange,
}: {
  readonly label: string;
  readonly checked: boolean;
  readonly onChange: (v: boolean) => void;
}): React.JSX.Element {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-[13px] text-muted">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 shrink-0 accent-accent"
      />
      <span className={checked ? "text-mist" : ""}>{label}</span>
    </label>
  );
}
