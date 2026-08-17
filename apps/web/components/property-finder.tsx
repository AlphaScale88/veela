"use client";

import { computeVerdict, HK_RULE_SETS, money, type PropertyInput, type Verdict } from "@veela/core";
import {
  DEMO_DISTRICTS,
  DEMO_LISTINGS,
  DISTRICT_CENTRES,
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
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { useAuth } from "./auth-provider";
import { CompareBar, CompareCheckbox, HeartButton, MAX_COMPARE } from "./listing-actions";
import { ListingsMap, type DistrictHeat, type FinderPin } from "./listings-map";
import { draftToApiInput, draftToCoreInput, EMPTY_DRAFT, type Draft } from "./property-form";

/**
 * A Mashvisor-style "Property Finder" — screen units against price, size and yield
 * criteria — built on data this product does not have: there is no bulk Hong Kong
 * listings feed (`.claude/CLAUDE.md`, "Hong Kong data landscape"). Every listing here is
 * fabricated by `@veela/fixtures/listings.ts`, on purpose without a building name or
 * street, precisely so nothing on this page can be mistaken for a real address.
 *
 * **The screening metric is unlevered net yield**, computed by the real engine
 * (`computeVerdict`) against a fixed cash-purchase assumption set stated in
 * `listingToDraft` below. Clicking a card hands its figures to `/analyse`, where the
 * fabrication stops at the input, never at the arithmetic.
 *
 * It used to say this assumption set was "the same one `INITIAL_DRAFT` uses on `/analyse`".
 * That stopped being true when `/analyse` was changed to start blank: `EMPTY_DRAFT` now
 * contributes only the buyer booleans and the (unused, because `loanAmount` is 0) financing
 * rates. Every money field is set explicitly here, which is why the yields on this page did
 * not move when the form's defaults were emptied.
 *
 * `districtQuery` and `view` are controlled from `app/finder/page.tsx`, which also owns
 * `FinderShell`'s top bar — the search box and the Map/Table toggle live in that bar,
 * not in this component, so there is exactly one place a district name is typed.
 */

const TRANSACTION_DATE = "2026-08-01";

/**
 * Short labels for the qualitative attributes, and the priority they are shown in.
 *
 * **A criterion you can filter on has to be visible on the result**, or the reader has no way
 * to tell a working filter from a broken one — the same reasoning that made every neighbourhood
 * count open the list behind it. Tenancy leads because it is the one attribute that changes
 * what is being bought rather than shading it; the rest follow in roughly the order a buyer
 * asks about them.
 */
function featureChips(l: DemoListing): readonly string[] {
  const chips: string[] = [];
  if (l.tenancy === "tenanted") chips.push("Tenanted");
  if (l.view !== "none") {
    chips.push(
      { sea: "Sea view", mountain: "Mountain view", city: "City view", open: "Open outlook" }[l.view],
    );
  }
  if (l.outdoor !== "none") {
    chips.push({ balcony: "Balcony", rooftop: "Rooftop", garden: "Garden" }[l.outdoor]);
  }
  if (l.carPark === "included") chips.push("Car park");
  if (l.renovation !== "none") {
    chips.push(l.renovation === "refined" ? "Refined" : "Simple reno");
  }
  if (l.furnishing !== "unfurnished") {
    chips.push(l.furnishing === "full" ? "Furnished" : "Part furnished");
  }
  if (l.facilities.length > 0) {
    chips.push(`${l.facilities.length} facilit${l.facilities.length === 1 ? "y" : "ies"}`);
  }
  if (l.petsAllowed) chips.push("Pets OK");
  return chips;
}

/** Capped at three on cards and rows, uncapped in the table. Uneven card heights in a grid
 *  read as a layout bug; the table is the view built to carry everything. */
function FeatureChips({ listing, max }: { readonly listing: DemoListing; readonly max: number }): React.JSX.Element | null {
  const all = featureChips(listing);
  if (all.length === 0) return null;
  const shown = all.slice(0, max);
  const rest = all.length - shown.length;
  return (
    <p className="mt-1 flex flex-wrap gap-1" title={all.join(" · ")}>
      {shown.map((c) => (
        <span key={c} className="rounded-full bg-surfaceMuted px-1.5 py-0.5 text-[10px] text-muted">
          {c}
        </span>
      ))}
      {rest > 0 && <span className="px-1 py-0.5 text-[10px] text-muted">+{rest}</span>}
    </p>
  );
}

export function listingToDraft(l: DemoListing, districtLabel: string): Draft {
  return {
    ...EMPTY_DRAFT,
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

/**
 * The extra criteria, behind a "More filters" disclosure, now grouped into the three tabs the
 * reference uses: **Listing features, Building features, Other features.**
 *
 * The tabs are not decoration. Twelve criteria in one grid is a form; split by *what the
 * criterion is about* — the flat, the building it sits in, everything else — a reader looking
 * for "does it come with a car park" has one place to look rather than twelve to scan. Grouping
 * by subject also survives adding more later, which an arbitrary two-column split does not.
 *
 * **Radio groups rather than dropdowns**, again following the reference. A `<select>` hides its
 * options until clicked, so a panel of eight selects shows a reader nothing about what they can
 * actually filter on; the whole vocabulary is visible at once here. The main bar keeps its
 * selects, where compactness matters more than discoverability.
 *
 * ## What changed about renovation and furnishing
 *
 * This comment used to say those two were **deliberately absent**, because `DemoListing` had no
 * such fields and generating them would deepen the fabrication the page discloses. **That
 * reasoning was inconsistent and has been withdrawn** — `floor`, `yearBuilt` and
 * `monthlyManagementFeeHkd` were every bit as generated, and all three were already being
 * filtered on right here. There was never a principled line between an invented number and an
 * invented category; what makes any of it defensible is `LISTINGS_NOTICE`, which covers the new
 * fields exactly as it covered the prices. See `packages/fixtures/src/listings.ts`.
 */
const AREA_BANDS = [
  { id: "any", label: "Any size", min: 0, max: Infinity },
  { id: "s", label: "Under 500 sq ft", min: 0, max: 500 },
  { id: "m", label: "500–800 sq ft", min: 500, max: 800 },
  { id: "l", label: "800–1,200 sq ft", min: 800, max: 1_200 },
  { id: "xl", label: "1,200 sq ft and up", min: 1_200, max: Infinity },
] as const;

/** Floor bands rather than a number box: nobody searches for "floor 23", they search for a
 *  view or for not climbing stairs. */
const FLOOR_BANDS = [
  { id: "any", label: "Any floor", min: 0, max: Infinity },
  { id: "low", label: "Low (1–10)", min: 1, max: 10 },
  { id: "mid", label: "Mid (11–25)", min: 11, max: 25 },
  { id: "high", label: "High (26+)", min: 26, max: Infinity },
] as const;

/** Age, not year built — an investor thinks "how old is it", and the answer moves every
 *  January if it is stored as a year and displayed as one. */
const AGE_BANDS = [
  { id: "any", label: "Any age", maxAge: Infinity },
  { id: "10", label: "Under 10 years", maxAge: 10 },
  { id: "20", label: "Under 20 years", maxAge: 20 },
  { id: "30", label: "Under 30 years", maxAge: 30 },
] as const;

/** Management fee ceilings. Worth filtering because it comes straight off the yield — a high
 *  fee on a small flat is the quiet killer of a Hong Kong return. */
const FEE_CEILINGS = [
  { id: "any", label: "Any fee", max: Infinity },
  { id: "2000", label: "Under HK$2,000/mo", max: 2_000 },
  { id: "3500", label: "Under HK$3,500/mo", max: 3_500 },
  { id: "5000", label: "Under HK$5,000/mo", max: 5_000 },
] as const;

/* The qualitative criteria. Each `id` is either `"any"` or a literal from the matching union
   in `@veela/fixtures`, so filtering is an equality check and a typo is a type error rather
   than a filter that silently matches nothing. */

const RENOVATION_OPTIONS = [
  { id: "any", label: "Any" },
  { id: "refined", label: "Refined" },
  { id: "simple", label: "Simple" },
  { id: "none", label: "Unrenovated" },
] as const;

const FURNISHING_OPTIONS = [
  { id: "any", label: "Any" },
  { id: "full", label: "Fully furnished" },
  { id: "partly", label: "Partly furnished" },
  { id: "unfurnished", label: "Unfurnished" },
] as const;

const OUTDOOR_OPTIONS = [
  { id: "any", label: "Any" },
  { id: "balcony", label: "Balcony" },
  { id: "rooftop", label: "Rooftop" },
  { id: "garden", label: "Garden" },
  { id: "none", label: "None" },
] as const;

const VIEW_OPTIONS = [
  { id: "any", label: "Any" },
  { id: "sea", label: "Sea view" },
  { id: "mountain", label: "Mountain" },
  { id: "city", label: "City" },
  { id: "open", label: "Open outlook" },
  { id: "none", label: "No open view" },
] as const;

/** "Available to rent" is a real third state in Hong Kong, not padding: a space in the
 *  building you can lease is worth something, but it is a monthly cost rather than an asset
 *  included in the price — and only the first of those changes the stamp duty. */
const CAR_PARK_OPTIONS = [
  { id: "any", label: "Any" },
  { id: "included", label: "Included in price" },
  { id: "rentable", label: "Available to rent" },
  { id: "none", label: "None" },
] as const;

const TENANCY_OPTIONS = [
  { id: "any", label: "Any" },
  { id: "vacant", label: "Vacant possession" },
  { id: "tenanted", label: "Sold with a tenant" },
] as const;

const FACILITY_OPTIONS = [
  { id: "clubhouse", label: "Clubhouse" },
  { id: "gym", label: "Gym" },
  { id: "pool", label: "Pool" },
] as const;

/** Grouped by *what the criterion is about* — the flat, the building, everything else. */
const MORE_TABS = [
  { id: "listing", label: "Listing features" },
  { id: "building", label: "Building features" },
  { id: "other", label: "Other features" },
] as const;

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

/** Cards and list rows only — `ListingsTable` already reads compactly at any length,
 *  so paginating it too would just add clicks to a view built to scroll. */
/** Fixed once per module load rather than per render: a filter result that changed halfway
 *  through a session because the clock ticked over midnight would be baffling. */
const CURRENT_YEAR = new Date().getFullYear();

const PAGE_SIZE = 6;

interface Props {
  readonly districtQuery: string;
  readonly view: "map" | "list" | "table";
}

export function PropertyFinder({ districtQuery, view }: Props): React.JSX.Element {
  const [bedrooms, setBedrooms] = useState<(typeof BEDROOM_OPTIONS)[number]>("any");
  const [priceBandId, setPriceBandId] = useState<(typeof PRICE_BANDS)[number]["id"]>("any");
  const [yieldFloorId, setYieldFloorId] = useState<(typeof YIELD_FLOORS)[number]["id"]>("any");
  const [areaBandId, setAreaBandId] = useState<(typeof AREA_BANDS)[number]["id"]>("any");
  const [floorBandId, setFloorBandId] = useState<(typeof FLOOR_BANDS)[number]["id"]>("any");
  const [ageBandId, setAgeBandId] = useState<(typeof AGE_BANDS)[number]["id"]>("any");
  const [feeCeilingId, setFeeCeilingId] = useState<(typeof FEE_CEILINGS)[number]["id"]>("any");
  const [renovationId, setRenovationId] = useState<(typeof RENOVATION_OPTIONS)[number]["id"]>("any");
  const [furnishingId, setFurnishingId] = useState<(typeof FURNISHING_OPTIONS)[number]["id"]>("any");
  const [outdoorId, setOutdoorId] = useState<(typeof OUTDOOR_OPTIONS)[number]["id"]>("any");
  const [viewId, setViewId] = useState<(typeof VIEW_OPTIONS)[number]["id"]>("any");
  const [carParkId, setCarParkId] = useState<(typeof CAR_PARK_OPTIONS)[number]["id"]>("any");
  const [tenancyId, setTenancyId] = useState<(typeof TENANCY_OPTIONS)[number]["id"]>("any");
  /* Facilities is the one multi-select, because they are cumulative rather than exclusive —
     "clubhouse and a gym" is an ordinary thing to want, where "refined and simple" is not.
     Ticking two means *both*, which is the reading a reader expects from a checkbox list. */
  const [facilityIds, setFacilityIds] = useState<readonly string[]>([]);
  const [petsOnly, setPetsOnly] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [moreTab, setMoreTab] = useState<(typeof MORE_TABS)[number]["id"]>("listing");
  const [sort, setSort] = useState<SortId>("yield-desc");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [heatMetric, setHeatMetric] = useState<HeatMetricId>("yield");
  const [page, setPage] = useState(1);

  const { user } = useAuth();
  const router = useRouter();
  /**
   * `demoListingId` → the id of the saved property it produced.
   *
   * This is what lets the heart render filled before anything is clicked, and lets un-hearting
   * delete *that* row rather than one that merely shares a label. Built from the saved list, so a
   * property saved from the report's own Save button (which sets no `demoListingId`) correctly
   * leaves its sample card un-hearted — it is a different object with the same figures.
   */
  const [savedByDemoId, setSavedByDemoId] = useState<ReadonlyMap<string, string>>(new Map());
  const [heartBusy, setHeartBusy] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<readonly string[]>([]);

  useEffect(() => {
    if (user === null) {
      setSavedByDemoId(new Map());
      return;
    }
    let cancelled = false;
    void (async () => {
      const res = await fetch("/api/properties");
      if (!res.ok || cancelled) return;
      const { properties } = (await res.json()) as {
        properties: { id: string; demoListingId: string | null }[];
      };
      if (cancelled) return;
      setSavedByDemoId(
        new Map(
          properties.flatMap((p) =>
            p.demoListingId === null ? [] : [[p.demoListingId, p.id] as const],
          ),
        ),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  /**
   * Saving a sample listing goes through the **same** `POST /properties` the report's Save button
   * uses, built from the **same** `listingToDraft`. That is the point: a hearted card and the
   * report you would have reached by clicking through cannot disagree about the figures, because
   * neither one re-derives them.
   */
  async function toggleHeart(row: Row): Promise<void> {
    if (user === null) {
      router.push("/login?next=/finder");
      return;
    }
    const demoId = row.listing.id;
    const existing = savedByDemoId.get(demoId);
    setHeartBusy(demoId);
    try {
      if (existing !== undefined) {
        const res = await fetch(`/api/properties/${existing}`, { method: "DELETE" });
        if (res.ok || res.status === 404) {
          setSavedByDemoId((m) => {
            const next = new Map(m);
            next.delete(demoId);
            return next;
          });
          // An unsaved property cannot stay in a comparison of saved ones.
          setCompareIds((ids) => ids.filter((id) => id !== existing));
        }
      } else {
        const res = await fetch("/api/properties", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            ...draftToApiInput(listingToDraft(row.listing, districtName(row.listing.districtId))),
            demoListingId: demoId,
          }),
        });
        if (res.ok) {
          const { property } = (await res.json()) as { property: { id: string } };
          setSavedByDemoId((m) => new Map(m).set(demoId, property.id));
        }
      }
    } finally {
      setHeartBusy(null);
    }
  }

  /** True when this sample listing's saved property is in the comparison. Reads through the
   *  saved map rather than comparing ids directly, so an un-hearted listing is never "checked". */
  function savedForCompare(demoId: string): boolean {
    const id = savedByDemoId.get(demoId);
    return id !== undefined && compareIds.includes(id);
  }

  function toggleCompare(propertyId: string): void {
    setCompareIds((ids) =>
      ids.includes(propertyId)
        ? ids.filter((id) => id !== propertyId)
        : ids.length >= MAX_COMPARE
          ? ids
          : [...ids, propertyId],
    );
  }

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

  const extraFilterCount =
    [
      areaBandId,
      floorBandId,
      ageBandId,
      feeCeilingId,
      renovationId,
      furnishingId,
      outdoorId,
      viewId,
      carParkId,
      tenancyId,
    ].filter((v) => v !== "any").length +
    /* Facilities counts as **one** active criterion however many boxes are ticked: the badge
       answers "how many things am I filtering on", and three ticks in one group is still one
       question the reader asked. */
    (facilityIds.length > 0 ? 1 : 0) +
    (petsOnly ? 1 : 0);
  const activeFilterCount =
    extraFilterCount +
    [bedrooms, priceBandId, yieldFloorId].filter((v) => v !== "any").length;

  function resetFilters(): void {
    setBedrooms("any");
    setPriceBandId("any");
    setYieldFloorId("any");
    setAreaBandId("any");
    setFloorBandId("any");
    setAgeBandId("any");
    setFeeCeilingId("any");
    setRenovationId("any");
    setFurnishingId("any");
    setOutdoorId("any");
    setViewId("any");
    setCarParkId("any");
    setTenancyId("any");
    setFacilityIds([]);
    setPetsOnly(false);
  }

  function toggleFacility(id: string): void {
    setFacilityIds((prev) => (prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]));
  }

  /**
   * The panel floats over the results rather than pushing them down, so it needs the two
   * dismissals every popover needs: clicking away, and Escape. A pointer user expects the
   * first; a keyboard user has no "away" to click. Listeners are bound only while it is open.
   *
   * `mousedown`, not `click` — a `click` listener fires after React has already re-rendered
   * from whatever was pressed, which makes a control inside the panel that removes its own
   * element (the Reset button when it disables itself) look like an outside click.
   */
  const moreRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!moreOpen) return;
    const onDown = (e: MouseEvent): void => {
      if (!moreRef.current?.contains(e.target as Node)) setMoreOpen(false);
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") setMoreOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [moreOpen]);

  const priceBand = PRICE_BANDS.find((b) => b.id === priceBandId) ?? PRICE_BANDS[0];
  const yieldFloor = YIELD_FLOORS.find((y) => y.id === yieldFloorId) ?? YIELD_FLOORS[0];

  const visible = useMemo(() => {
    const areaBand = AREA_BANDS.find((b) => b.id === areaBandId) ?? AREA_BANDS[0];
    const floorBand = FLOOR_BANDS.find((b) => b.id === floorBandId) ?? FLOOR_BANDS[0];
    const ageBand = AGE_BANDS.find((b) => b.id === ageBandId) ?? AGE_BANDS[0];
    const feeCeiling = FEE_CEILINGS.find((b) => b.id === feeCeilingId) ?? FEE_CEILINGS[0];

    const filtered = rows.filter((r) => {
      if (matchedDistrict !== undefined && r.listing.districtId !== matchedDistrict.id) {
        return false;
      }
      if (bedrooms !== "any" && String(r.listing.bedrooms) !== bedrooms) return false;
      if (r.listing.priceHkd < priceBand.min || r.listing.priceHkd > priceBand.max) return false;

      const sqft = r.listing.saleableAreaSqft;
      if (sqft < areaBand.min || sqft > areaBand.max) return false;
      if (r.listing.floor < floorBand.min || r.listing.floor > floorBand.max) return false;
      /* Age from the current year rather than a stored age, so it does not silently drift
         every January. */
      if (CURRENT_YEAR - r.listing.yearBuilt > ageBand.maxAge) return false;
      if (r.listing.monthlyManagementFeeHkd > feeCeiling.max) return false;

      if (renovationId !== "any" && r.listing.renovation !== renovationId) return false;
      if (furnishingId !== "any" && r.listing.furnishing !== furnishingId) return false;
      if (outdoorId !== "any" && r.listing.outdoor !== outdoorId) return false;
      if (viewId !== "any" && r.listing.view !== viewId) return false;
      if (carParkId !== "any" && r.listing.carPark !== carParkId) return false;
      if (tenancyId !== "any" && r.listing.tenancy !== tenancyId) return false;
      if (petsOnly && !r.listing.petsAllowed) return false;
      // `every`, not `some`: ticking Gym *and* Pool asks for a building that has both.
      const has: readonly string[] = r.listing.facilities;
      if (!facilityIds.every((f) => has.includes(f))) return false;

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
  }, [
    rows,
    matchedDistrict,
    bedrooms,
    priceBand,
    yieldFloor,
    sort,
    areaBandId,
    floorBandId,
    ageBandId,
    feeCeilingId,
    renovationId,
    furnishingId,
    outdoorId,
    viewId,
    carParkId,
    tenancyId,
    facilityIds,
    petsOnly,
  ]);

  // A filter change (or switching views) can strand the reader on a page number
  // that no longer exists — back to page 1 whenever the result set could differ.
  useEffect(() => {
    setPage(1);
  }, [matchedDistrict, bedrooms, priceBandId, yieldFloorId, sort, view, areaBandId, floorBandId, ageBandId, feeCeilingId]);

  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const paged = visible.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  /* Position is computed here now, not in `ListingsMap` — district centroid plus the
     listing's own fixed offset. Still not a real address; just spread out enough to browse
     rather than stacking three pins on each of eighteen points. The map takes a position and
     asks no questions, which is what lets the saved-property finder pass real coordinates. */
  const pins: readonly FinderPin[] = visible.flatMap((r) => {
    const centre = DISTRICT_CENTRES[r.listing.districtId];
    if (centre === undefined) return [];
    return [{
    id: r.listing.id,
    position: {
      lat: centre.lat + r.listing.latOffset,
      lng: centre.lng + r.listing.lngOffset,
    },
    standing: r.standing,
    label: `${districtName(r.listing.districtId)} · ${formatPercent(r.verdict.returns.netYield)} net yield`,
    priceLabel: formatCompactMoney(r.verdict.acquisition.price),
    yieldLabel: formatPercent(r.verdict.returns.netYield),
    metaLabel: `${districtName(r.listing.districtId)} · ${r.listing.bedrooms}-bed · ${r.listing.saleableAreaSqft} sqft`,
    }];
  });

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
    // One column per criterion rather than a joined "features" blob: a CSV is opened in a
    // spreadsheet to be sorted and filtered again, and a blob cannot be.
    const header = [
      "District",
      "Bedrooms",
      "Sqft",
      "Price (HKD)",
      "Net yield",
      "Floor",
      "Year built",
      "Management fee (HKD/mo)",
      "Renovation",
      "Furnishing",
      "Outdoor",
      "View",
      "Car park",
      "Facilities",
      "Pets allowed",
      "Tenancy",
    ];
    const lines = visible.map((r) =>
      [
        districtName(r.listing.districtId),
        r.listing.bedrooms,
        r.listing.saleableAreaSqft,
        r.listing.priceHkd,
        r.verdict.returns.netYield === null ? "" : (r.verdict.returns.netYield * 100).toFixed(2),
        r.listing.floor,
        r.listing.yearBuilt,
        r.listing.monthlyManagementFeeHkd,
        r.listing.renovation,
        r.listing.furnishing,
        r.listing.outdoor,
        r.listing.view,
        r.listing.carPark,
        // Semicolons, not commas — this field is a list inside a comma-separated file.
        r.listing.facilities.join(";"),
        r.listing.petsAllowed ? "yes" : "no",
        r.listing.tenancy,
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

      {/* `relative` so the More filters popover can anchor to the bar, and the wrapper is the
          click-outside boundary — pressing the button itself must not count as "outside",
          or opening it would immediately close it again. */}
      <div ref={moreRef} className="relative">
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
        {/* The reference puts its extra criteria behind a "More Filters" disclosure rather than
            widening the bar, and it is right to: four controls are scannable, eight are a form.
            The badge shows how many are active, so a reader who has forgotten why the list is
            short can see that something is on without opening it. */}
        <div className="ml-auto flex items-end gap-3">
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            aria-expanded={moreOpen}
            aria-controls="finder-more-filters"
            className={`rounded-card border px-4 py-2 text-sm transition-colors ${
              moreOpen || extraFilterCount > 0
                ? "border-accent bg-accent/5 text-mist"
                : "border-line text-muted hover:text-mist"
            }`}
          >
            More filters
            {extraFilterCount > 0 && (
              <span className="ml-2 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-white">
                {extraFilterCount}
              </span>
            )}
          </button>
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={resetFilters}
              className="pb-2 text-sm text-muted underline underline-offset-4 hover:text-mist"
            >
              Reset
            </button>
          )}
        </div>
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

      {moreOpen && (
        /**
         * A floating panel over the results, not a card wedged between the bar and the list.
         *
         * As a block in the flow it was ~700px tall and pushed every listing off the screen, so
         * the reader could not see what the filter they were setting did to the thing it
         * filtered — the reference floats it for exactly that reason. Now: anchored under the
         * bar, a fixed 40rem rather than the full page width (twelve criteria in a 1400px row
         * is mostly whitespace), its body capped at 60vh and scrolling internally so the tabs
         * and the footer stay put however long a tab is.
         *
         * Right-aligned on desktop so it cannot run off the viewport, full-width below `sm`
         * where 40rem would not fit anyway.
         */
        <div
          id="finder-more-filters"
          className="absolute left-0 right-0 top-full z-40 mt-2 overflow-hidden rounded-panel border border-line bg-surface shadow-lift sm:left-auto sm:w-[40rem] sm:max-w-[calc(100vw-2rem)]"
        >
          <div role="tablist" aria-label="Filter groups" className="flex gap-1 border-b border-line px-3 pt-2">
            {MORE_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                id={`finder-tab-${t.id}`}
                aria-selected={moreTab === t.id}
                aria-controls={`finder-tabpanel-${t.id}`}
                onClick={() => setMoreTab(t.id)}
                className={`-mb-px border-b-2 px-3 py-2.5 text-sm transition-colors ${
                  moreTab === t.id
                    ? "border-accent font-semibold text-mist"
                    : "border-transparent text-muted hover:text-mist"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div
            role="tabpanel"
            id={`finder-tabpanel-${moreTab}`}
            aria-labelledby={`finder-tab-${moreTab}`}
            className="grid max-h-[60vh] gap-x-6 gap-y-5 overflow-y-auto px-4 py-4 sm:grid-cols-2"
          >
            {moreTab === "listing" && (
              <>
                <RadioGroup
                  legend="Saleable area"
                  name="area"
                  value={areaBandId}
                  options={AREA_BANDS}
                  onChange={(v) => setAreaBandId(v as typeof areaBandId)}
                />
                <RadioGroup
                  legend="Floor"
                  name="floor"
                  value={floorBandId}
                  options={FLOOR_BANDS}
                  onChange={(v) => setFloorBandId(v as typeof floorBandId)}
                />
                <RadioGroup
                  legend="Renovation"
                  name="renovation"
                  value={renovationId}
                  options={RENOVATION_OPTIONS}
                  onChange={(v) => setRenovationId(v as typeof renovationId)}
                />
                <RadioGroup
                  legend="Furniture"
                  name="furnishing"
                  value={furnishingId}
                  options={FURNISHING_OPTIONS}
                  onChange={(v) => setFurnishingId(v as typeof furnishingId)}
                />
                <RadioGroup
                  legend="Outdoor space"
                  name="outdoor"
                  value={outdoorId}
                  options={OUTDOOR_OPTIONS}
                  onChange={(v) => setOutdoorId(v as typeof outdoorId)}
                />
              </>
            )}

            {moreTab === "building" && (
              <>
                <RadioGroup
                  legend="Building age"
                  name="age"
                  value={ageBandId}
                  options={AGE_BANDS}
                  onChange={(v) => setAgeBandId(v as typeof ageBandId)}
                />
                <RadioGroup
                  legend="Management fee"
                  name="fee"
                  value={feeCeilingId}
                  options={FEE_CEILINGS}
                  onChange={(v) => setFeeCeilingId(v as typeof feeCeilingId)}
                />
                <RadioGroup
                  legend="Car park"
                  name="carpark"
                  value={carParkId}
                  options={CAR_PARK_OPTIONS}
                  onChange={(v) => setCarParkId(v as typeof carParkId)}
                />
                <fieldset>
                  <legend className="text-[13px] font-semibold text-mist">Facilities</legend>
                  <p className="mt-0.5 text-[11px] text-muted">Tick more than one to require all of them.</p>
                  <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2">
                    {FACILITY_OPTIONS.map((f) => (
                      <CheckRow
                        key={f.id}
                        label={f.label}
                        checked={facilityIds.includes(f.id)}
                        onChange={() => toggleFacility(f.id)}
                      />
                    ))}
                  </div>
                </fieldset>
              </>
            )}

            {moreTab === "other" && (
              <>
                <RadioGroup
                  legend="View"
                  name="view"
                  value={viewId}
                  options={VIEW_OPTIONS}
                  onChange={(v) => setViewId(v as typeof viewId)}
                />
                <RadioGroup
                  legend="Tenancy"
                  name="tenancy"
                  value={tenancyId}
                  options={TENANCY_OPTIONS}
                  onChange={(v) => setTenancyId(v as typeof tenancyId)}
                />
                <fieldset>
                  <legend className="text-[13px] font-semibold text-mist">Pets</legend>
                  <div className="mt-2">
                    <CheckRow
                      label="Pets allowed"
                      checked={petsOnly}
                      onChange={() => setPetsOnly((v) => !v)}
                    />
                  </div>
                </fieldset>
                {/* The reference's Other Features tab also lists things a *listing agent* fills
                    in — floor plan available, video tour, virtual staging. Those describe the
                    advertisement rather than the property, and there is no advertisement here
                    to describe. Tenancy earns its place for the opposite reason: it changes
                    what you are actually buying. */}
                <p className="text-[11px] leading-relaxed text-muted sm:col-span-2">
                  A tenanted flat comes with the existing agreement attached — you inherit the
                  rent and the term, and cannot vary either until it expires. The report treats
                  the rent you enter as the rent you get, so check the agreement before relying
                  on the yield.
                </p>
              </>
            )}
          </div>

          {/* The reference closes its panel with Reset and "Show N listings", and both earn
              their place: the count turns the panel into a preview of its own effect, so a
              filter that leaves nothing is visible before it is applied rather than after. */}
          <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3">
            <button
              type="button"
              onClick={resetFilters}
              disabled={activeFilterCount === 0}
              className="text-sm text-muted underline underline-offset-4 hover:text-mist disabled:pointer-events-none disabled:opacity-40"
            >
              Reset all
            </button>
            <button type="button" onClick={() => setMoreOpen(false)} className="btn-primary !px-5 !py-2 !text-sm">
              Show {visible.length} listing{visible.length === 1 ? "" : "s"}
            </button>
          </div>
        </div>
      )}
      </div>

      <CompareBar ids={compareIds} max={MAX_COMPARE} onClear={() => setCompareIds([])} />

      {view === "table" && <ListingsTable rows={visible} />}

      {view === "list" && (
        <div className="space-y-4">
          {visible.length === 0 ? (
            <EmptyState total={rows.length} />
          ) : (
            <>
              <div className="space-y-3">
                {paged.map((r, i) => (
                  <ListingRow
                    key={r.listing.id}
                    row={r}
                    rank={(currentPage - 1) * PAGE_SIZE + i}
                    selected={r.listing.id === selectedId}
                    onSelect={() => setSelectedId(r.listing.id)}
                    savedPropertyId={savedByDemoId.get(r.listing.id)}
                    heartBusy={heartBusy === r.listing.id}
                    onHeart={() => void toggleHeart(r)}
                    compareChecked={savedForCompare(r.listing.id)}
                    compareFull={compareIds.length >= MAX_COMPARE}
                    onCompare={() => {
                      const id = savedByDemoId.get(r.listing.id);
                      if (id !== undefined) toggleCompare(id);
                    }}
                  />
                ))}
              </div>
              <Pagination page={currentPage} pageCount={pageCount} onChange={setPage} />
            </>
          )}
        </div>
      )}

      {view === "map" && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
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

          <div>
            {visible.length === 0 ? (
              <EmptyState total={rows.length} />
            ) : (
              <>
                <div
                  className={`grid grid-cols-2 gap-3 ${mapsKey === undefined || mapsKey === "" ? "xl:grid-cols-3" : ""}`}
                >
                  {paged.map((r, i) => (
                    <PropertyCard
                      key={r.listing.id}
                      row={r}
                      rank={(currentPage - 1) * PAGE_SIZE + i}
                      selected={r.listing.id === selectedId}
                      onSelect={() => setSelectedId(r.listing.id)}
                      savedPropertyId={savedByDemoId.get(r.listing.id)}
                      heartBusy={heartBusy === r.listing.id}
                      onHeart={() => void toggleHeart(r)}
                      compareChecked={savedForCompare(r.listing.id)}
                      compareFull={compareIds.length >= MAX_COMPARE}
                      onCompare={() => {
                        const id = savedByDemoId.get(r.listing.id);
                        if (id !== undefined) toggleCompare(id);
                      }}
                    />
                  ))}
                </div>
                <Pagination page={currentPage} pageCount={pageCount} onChange={setPage} />
              </>
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
            <th scope="col" className="px-4 py-2 font-medium">Features</th>
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
              {/* Uncapped here: the table is the view that already scrolls sideways and is
                  built to carry everything, which is what makes it the one place to check a
                  filter actually did what it said. */}
              <td className="px-4 py-2.5 text-xs text-muted">
                {featureChips(r.listing).join(" · ") || "—"}
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

/** Matched to Zillow's own listing card, measured directly off a reference screenshot:
 *  a landscape ~16:9 photo (not 4:3, not square — Zillow's is wider than it looks at a
 *  glance) that reads as dominant specifically because the text block under it is four
 *  short lines, not five with wrapping. The yield badge sits over the photo where
 *  Zillow's favourite-heart sits; price leads the text block the same way Zillow leads
 *  with the number before beds/baths/address; the last line takes Zillow's small-caps
 *  brokerage treatment for the one line here that's closest in spirit — the assumed rent. */
function PropertyCard({
  row,
  rank,
  selected,
  onSelect,
  savedPropertyId,
  heartBusy,
  onHeart,
  compareChecked,
  compareFull,
  onCompare,
}: {
  readonly row: Row;
  readonly rank: number;
  readonly selected: boolean;
  readonly onSelect: () => void;
  /** Set once this listing has been hearted — the id of the property it created. */
  readonly savedPropertyId: string | undefined;
  readonly heartBusy: boolean;
  readonly onHeart: () => void;
  readonly compareChecked: boolean;
  readonly compareFull: boolean;
  readonly onCompare: () => void;
}): React.JSX.Element {
  const { listing, verdict, standing } = row;

  return (
    <article
      onMouseEnter={onSelect}
      className={`card card-hover overflow-hidden !p-0 ${selected ? "ring-2 ring-accent" : ""}`}
    >
      <div className="relative">
        <ListingPhoto rank={rank} className="aspect-[16/9]" />
        {/* Heart top-left, yield top-right — Zillow's own placement, and it keeps the two apart
            so neither is clicked by accident. */}
        <span className="absolute left-2.5 top-2.5">
          <HeartButton
            filled={savedPropertyId !== undefined}
            busy={heartBusy}
            label={
              savedPropertyId === undefined
                ? "Save this sample to my properties"
                : "Remove this sample from my properties"
            }
            onClick={onHeart}
          />
        </span>
        <span
          className="absolute right-2.5 top-2.5 rounded-full px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] shadow-card"
          style={{ color: standingColor[standing], backgroundColor: "rgba(255,255,255,0.92)" }}
        >
          {formatPercent(verdict.returns.netYield)}
        </span>
        {/* Only once it is saved: the comparison reads stored snapshots, so there is nothing for
            it to show about a listing nobody has saved. */}
        {savedPropertyId !== undefined && (
          <span className="absolute bottom-2.5 left-2.5">
            <CompareCheckbox
              checked={compareChecked}
              disabled={compareFull && !compareChecked}
              onChange={onCompare}
            />
          </span>
        )}
      </div>

      <div className="p-2.5">
        <p className="tnum font-display text-[18px] font-bold tracking-[-0.01em]">
          {formatCompactMoney(verdict.acquisition.price)}
        </p>
        <p className="mt-0.5 text-[12px] text-mist">
          {listing.bedrooms} bd · {listing.saleableAreaSqft} sqft · Sample flat
        </p>
        <p className="text-[12px] text-muted">
          {districtName(listing.districtId)} · floor {listing.floor}
        </p>
        <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.06em] text-muted">
          Rent {formatCompactMoney(money(listing.monthlyRentHkd, "HKD"))}/mo, assumed
        </p>
        <FeatureChips listing={listing} max={3} />

        <Link
          href={`/analyse?listing=${listing.id}`}
          className="btn-secondary mt-2 w-full !py-1.5 !text-[12px]"
        >
          View full analysis
        </Link>
      </div>
    </article>
  );
}

/**
 * A single compact horizontal row — the "List" view's unit, distinct from both
 * `PropertyCard`'s vertical tile and `ListingsTable`'s dense data row. Same fields
 * as the card, laid out for fast vertical scanning rather than a grid.
 */
function ListingRow({
  row,
  rank,
  selected,
  onSelect,
  savedPropertyId,
  heartBusy,
  onHeart,
  compareChecked,
  compareFull,
  onCompare,
}: {
  readonly row: Row;
  readonly rank: number;
  readonly selected: boolean;
  readonly onSelect: () => void;
  readonly savedPropertyId: string | undefined;
  readonly heartBusy: boolean;
  readonly onHeart: () => void;
  readonly compareChecked: boolean;
  readonly compareFull: boolean;
  readonly onCompare: () => void;
}): React.JSX.Element {
  const { listing, verdict, standing } = row;

  return (
    <article
      onMouseEnter={onSelect}
      className={`card card-hover flex items-center gap-4 !p-3 ${selected ? "ring-2 ring-accent" : ""}`}
    >
      <ListingPhoto rank={rank} className="h-16 w-20 shrink-0 rounded-card" />

      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold leading-snug">
          {listing.bedrooms}-bed sample flat
        </p>
        <p className="text-[11px] text-muted">
          {districtName(listing.districtId)} · {listing.saleableAreaSqft} sq ft · floor{" "}
          {listing.floor} · rent {formatCompactMoney(money(listing.monthlyRentHkd, "HKD"))}/mo
        </p>
        <FeatureChips listing={listing} max={3} />
      </div>

      <div className="shrink-0 text-right">
        <p className="tnum font-display text-[15px] font-semibold tracking-[-0.02em]">
          {formatCompactMoney(verdict.acquisition.price)}
        </p>
        <span
          className="mt-0.5 inline-block rounded-full px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.08em]"
          style={{ color: standingColor[standing], backgroundColor: `${standingColor[standing]}1A` }}
        >
          {formatPercent(verdict.returns.netYield)}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {savedPropertyId !== undefined && (
          <CompareCheckbox
            checked={compareChecked}
            disabled={compareFull && !compareChecked}
            onChange={onCompare}
          />
        )}
        <HeartButton
          filled={savedPropertyId !== undefined}
          busy={heartBusy}
          label={
            savedPropertyId === undefined
              ? "Save this sample to my properties"
              : "Remove this sample from my properties"
          }
          onClick={onHeart}
        />
        <Link
          href={`/analyse?listing=${listing.id}`}
          className="btn-secondary !px-3 !py-1.5 !text-[12px]"
        >
          Analyse
        </Link>
      </div>
    </article>
  );
}

function EmptyState({ total }: { readonly total: number }): React.JSX.Element {
  return (
    <p className="card py-10 text-center text-sm text-muted">
      No sample listing matches these filters. Loosen one and it will reappear — this
      is a fixed set of {total}, not a live search.
    </p>
  );
}

function Pagination({
  page,
  pageCount,
  onChange,
}: {
  readonly page: number;
  readonly pageCount: number;
  readonly onChange: (page: number) => void;
}): React.JSX.Element | null {
  if (pageCount <= 1) return null;

  return (
    <div className="mt-5 flex items-center justify-center gap-3">
      <button
        type="button"
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        className="btn-secondary !px-3 !py-1.5 !text-xs disabled:pointer-events-none disabled:opacity-40"
      >
        Previous
      </button>
      <span className="font-mono text-xs text-muted">
        Page {page} of {pageCount}
      </span>
      <button
        type="button"
        onClick={() => onChange(page + 1)}
        disabled={page >= pageCount}
        className="btn-secondary !px-3 !py-1.5 !text-xs disabled:pointer-events-none disabled:opacity-40"
      >
        Next
      </button>
    </div>
  );
}

/** Sixteen CC0 interiors in `public/listings/`. See that folder's CREDITS.md for the
 *  licence, and for why these are generic anonymous interiors rather than photos of
 *  real Hong Kong buildings — Commons had plenty of the latter, and attaching one to a
 *  fabricated listing would make a specific false claim about a real property. */
const LISTING_PHOTO_COUNT = 16;

/**
 * Photo path from a listing's **rank in the currently filtered-and-sorted list** — not
 * from its id.
 *
 * Two earlier attempts, both wrong, both caught on screen rather than in review:
 *
 * 1. `hash * 31 + c`, reused from the old illustration's hue picker. Fine modulo 360,
 *    quietly broken modulo 16: `31 ≡ -1 (mod 16)` cancels nearly all the entropy against
 *    a power-of-two bucket count, and ids are adjacent by construction (`HK-CW-1`,
 *    `HK-CW-2`, …), so three of six cards on one page showed the same photo.
 * 2. FNV-1a with an avalanche mix. Fixed the clustering; still left one duplicate per
 *    page, because a hash spreads *probabilistically* and nothing stops two of the six
 *    listings that happen to land on a page from colliding.
 *
 * Rank is what the reader actually sees, so keying off rank is what removes the
 * duplicate: a page is 6 consecutive ranks, `PAGE_SIZE` (6) ≤ `LISTING_PHOTO_COUNT` (16),
 * so `rank % 16` cannot repeat within one page. Deterministic for a given filter/sort
 * state, so returning to the same view shows the same photos.
 *
 * **The trade-off, stated rather than hidden:** a listing's photo is no longer bound to
 * the listing — re-sorting can hand a card a different image. That would be wrong for a
 * real listing whose photo is *of* that property. It is acceptable here precisely because
 * these photos are stock interiors that were never of the property (see
 * `public/listings/CREDITS.md`), so the only job they have is to look like a listing
 * card, and six identical thumbnails on one screen fails that job badly.
 */
function photoForRank(rank: number): string {
  const n = (rank % LISTING_PHOTO_COUNT) + 1;
  return `/listings/listing-${String(n).padStart(2, "0")}.jpg`;
}

/**
 * A real photograph — but **not of this property**, because these listings are
 * generated (`packages/fixtures/src/listings.ts`). Photos were deliberately excluded
 * here until 09/08/2026 on the reasoning in `.claude/CLAUDE.md` ("a photo next to a
 * fabricated address reads as a real listing"); reversed on direct request, with the
 * page-level `LISTINGS_NOTICE` disclosure and the "sample flat" card labels both kept.
 * The alt text says what the image actually is rather than describing a property that
 * doesn't exist — a screen-reader user should not be told this is the listing's own photo.
 */
function ListingPhoto({
  rank,
  className = "h-36",
}: {
  readonly rank: number;
  readonly className?: string;
}): React.JSX.Element {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- these are already sized and
    // compressed to exactly the dimensions the card renders (800×450, ~55 KB); next/image
    // would add a resizing pipeline over files that need no resizing.
    <img
      src={photoForRank(rank)}
      alt="Stock interior photograph — illustrative only, not this property"
      loading="lazy"
      className={`w-full bg-surfaceMuted object-cover ${className}`}
    />
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

/**
 * A radio group, as `<fieldset>` + `<legend>` + real `<input type="radio">`.
 *
 * Native radios rather than styled buttons with `role="radio"`: arrow-key roving between
 * options, the group announcing itself as "Renovation, 1 of 4", and form semantics all come
 * for free and are fiddly to reproduce. `name` scopes each group so the browser's own
 * exclusivity does the work `useState` would otherwise have to police.
 */
function RadioGroup({
  legend,
  name,
  value,
  options,
  onChange,
}: {
  readonly legend: string;
  readonly name: string;
  readonly value: string;
  readonly options: readonly { readonly id: string; readonly label: string }[];
  readonly onChange: (v: string) => void;
}): React.JSX.Element {
  return (
    <fieldset>
      <legend className="text-[13px] font-semibold text-mist">{legend}</legend>
      {/* One column. Two read as airy in a full-width card and cramped in a 40rem popover,
          and a vertical list of four is the shape a radio group is scanned as anyway. */}
      <div className="mt-1.5 grid gap-y-1.5">
        {options.map((o) => (
          <label key={o.id} className="flex cursor-pointer items-center gap-2 text-[13px] text-muted">
            <input
              type="radio"
              name={`finder-${name}`}
              value={o.id}
              checked={value === o.id}
              onChange={() => onChange(o.id)}
              className="size-4 shrink-0 accent-accent"
            />
            <span className={value === o.id ? "text-mist" : ""}>{o.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function CheckRow({
  label,
  checked,
  onChange,
}: {
  readonly label: string;
  readonly checked: boolean;
  readonly onChange: () => void;
}): React.JSX.Element {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-[13px] text-muted">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="size-4 shrink-0 accent-accent"
      />
      <span className={checked ? "text-mist" : ""}>{label}</span>
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
