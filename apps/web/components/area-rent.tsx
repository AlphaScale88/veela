"use client";

import {
  CENSUS_SOURCE,
  RVD_REGION_BY_LABEL,
  RVD_REGION_LABEL,
  RVD_RENT_SOURCE,
  averageRentAcrossRegions,
  averageRentForFlat,
  rentContext,
  rvdClassForAreaSqft,
  type RvdRegionKey,
} from "@veela/fixtures";
import { formatPercent } from "@veela/ui";

import { InfoIcon } from "./icons";

/**
 * What rent actually looks like around here — from the two official sources that publish it, and
 * from neither of the two that do not.
 *
 * ## The research this rests on, so nobody repeats it
 *
 * "Average rent per area" sounds like one lookup. It is not, because **Hong Kong publishes no
 * per-district private rent series at all.** Checked against data.gov.hk's own resource list
 * rather than assumed: RVD's eighteen-district open data is stock, completions and vacancy; its
 * rent *index* is territory-wide; the Land Registry sells sales one memorial at a time and
 * publishes no rents whatever. The two real geographic rent figures that do exist are:
 *
 * 1. **RVD average rents by Class and region** — HK$/m²/month, three regions, annual. A genuine
 *    *private-market* rent, and the finest real geography available for one. This is the headline
 *    figure, because it is the one an investor's flat is actually measured by.
 * 2. **Census median household rent by district** — eighteen districts, but it is *every* renting
 *    household, public rental housing included.
 *
 * ## Which is why the Census figure is presented the way it is
 *
 * Wong Tai Sin's median is HK$2,430 and Central and Western's is HK$15,070. Almost none of that
 * gap is the market: half of Wong Tai Sin's households are in public rental housing and 3% of
 * Central and Western's are. Showing HK$2,430 as "rent in Wong Tai Sin" to somebody pricing a
 * private flat would be among the most misleading things this product could do — so the
 * public-housing share is printed **beside every median**, `rentContext()` hands the two back
 * together, and the panel says in words what the number is and is not.
 *
 * The alternative — spreading a territory-wide rent across eighteen districts to look precise —
 * is the thing this codebase already refused when the same gap appeared for price indices. Three
 * real regions beat eighteen invented ones.
 */
export function AreaRentPanel({
  saleableAreaSqft,
  districtId,
  districtName,
  regionLabel,
  monthlyRentHkd,
}: {
  readonly saleableAreaSqft: number | null;
  readonly districtId: string | null;
  readonly districtName: string | null;
  /** The `region` from `districts.ts` — "Hong Kong Island" | "Kowloon" | "New Territories". */
  readonly regionLabel: string | null;
  /** What the reader entered, so the comparison is against their own figure. */
  readonly monthlyRentHkd: number | null;
}): React.JSX.Element | null {
  const rvdClass = saleableAreaSqft === null ? null : rvdClassForAreaSqft(saleableAreaSqft);
  const region: RvdRegionKey | null =
    regionLabel === null ? null : (RVD_REGION_BY_LABEL[regionLabel] ?? null);

  const own =
    rvdClass !== null && region !== null && saleableAreaSqft !== null
      ? averageRentForFlat(rvdClass, region, saleableAreaSqft)
      : null;

  const allRegions =
    rvdClass !== null && saleableAreaSqft !== null
      ? averageRentAcrossRegions(rvdClass, saleableAreaSqft)
      : [];

  const census = districtId === null ? null : rentContext(districtId);

  /* Whichever region actually published a figure — they share a year in practice, and taking it
     from the data rather than hardcoding it means the citation cannot go stale. */
  const latestYear = allRegions.find((r) => r.result !== null)?.result?.year ?? null;

  /* Nothing real to say without an area, since the size Class is what both figures key off. But
     an area alone IS enough: the by-region table needs only Class and size, so a report typed in
     by hand — no district, no region — still gets the real private-market rents for all three
     regions. Requiring a region here would have limited the whole panel to reports opened from a
     sample listing, which is the minority path. */
  if (allRegions.length === 0 && census === null) return null;

  const gap =
    own !== null && monthlyRentHkd !== null && monthlyRentHkd > 0
      ? monthlyRentHkd / own.monthlyRentHkd - 1
      : null;

  return (
    <section className="card">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-[15px] font-semibold">What rent looks like around here</h3>
        <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-muted">
          Official figures only
        </p>
      </div>

      {own !== null && (
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <Figure
              label={`Average rent, Class ${own.rvdClass}`}
              value={`HK$${own.monthlyRentHkd.toLocaleString("en-HK")}`}
              sub={`${RVD_REGION_LABEL[own.region]} · ${own.year} · HK$${own.rentPerSqm}/m²`}
            />
            <Figure
              label="The rent you entered"
              value={
                monthlyRentHkd !== null && monthlyRentHkd > 0
                  ? `HK$${monthlyRentHkd.toLocaleString("en-HK")}`
                  : "—"
              }
              sub={
                gap === null
                  ? "Enter a rent to compare"
                  : `${gap >= 0 ? "+" : ""}${formatPercent(gap, 1)} against the average`
              }
              tone={gap === null ? undefined : gap >= 0 ? "positive" : "negative"}
            />
            <Figure
              label="Flats of this size"
              value={`${saleableAreaSqft?.toLocaleString("en-HK")} sq ft`}
              sub={`RVD Class ${own.rvdClass}`}
          />
        </div>
      )}

      {allRegions.length > 0 && (
        <>
          {/* Three regions is the whole geography RVD gives for rents, so showing all three is
              showing everything there is — not a teaser for a district figure that exists. */}
          <table className="mt-4 w-full text-xs">
            <caption className="pb-1.5 text-left text-[13px] font-semibold text-mist">
              Average rent for a flat this size, by region
            </caption>
            <tbody>
              {allRegions.map(({ region: r, result }) => (
                <tr key={r} className={r === region ? "font-semibold" : undefined}>
                  <th scope="row" className="py-1.5 text-left font-normal text-muted">
                    {RVD_REGION_LABEL[r]}
                    {r === region && (
                      <span className="ml-1.5 text-[10px] uppercase tracking-[0.06em] text-accent">
                        this flat
                      </span>
                    )}
                  </th>
                  <td className="py-1.5 text-right tabular-nums text-mist">
                    {result === null
                      ? "—"
                      : `HK$${result.monthlyRentHkd.toLocaleString("en-HK")}/mo`}
                  </td>
                  <td className="w-20 py-1.5 text-right tabular-nums text-muted">
                    {result === null ? "" : `HK$${result.rentPerSqm}/m²`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {region === null && (
            <p className="mt-1.5 text-xs leading-relaxed text-muted">
              No region is attached to this report, so no row is marked as yours — open a report
              from a listing, or pick a building above, and the matching region is highlighted.
            </p>
          )}
        </>
      )}

      {census !== null && (
        <div className="mt-4 rounded-card border border-line bg-surfaceMuted p-3">
          <p className="text-[13px] font-semibold text-mist">
            {districtName ?? census.profile.name} — what renting households actually pay
          </p>
          <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2">
            <Inline
              label="Median household rent"
              value={`HK$${census.profile.medianMonthlyRentHkd.toLocaleString("en-HK")}`}
            />
            <Inline
              label="Rent to income"
              value={formatPercent(census.profile.rentToIncomeRatio, 1)}
            />
            <Inline
              label="Private housing"
              value={formatPercent(census.profile.privateHousingShare, 0)}
            />
            <Inline
              label="Public rental"
              value={formatPercent(census.profile.publicRentalShare, 0)}
            />
          </div>
          {/* The caveat travels with the figure, from `rentContext()`, so it cannot be dropped
              by a caller who only wanted the number. */}
          <p className="mt-2.5 text-xs leading-relaxed text-muted">
            <strong className="text-mist">This is not a private market rent.</strong>{" "}
            {census.caveat} It is the median across every renting household in the district,
            subsidised ones included — useful for judging what kind of area this is, and not for
            pricing a flat. The figure above it is the private-market one.
          </p>
        </div>
      )}

      <div className="mt-4 flex gap-2.5 border-t border-line pt-3">
        <InfoIcon className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
        <p className="text-xs leading-relaxed text-muted">
          <strong className="text-mist">Nobody publishes private rents by district in Hong
          Kong.</strong>{" "}
          RVD&apos;s district data is stock, completions and vacancy; its rent index is
          territory-wide; the Land Registry publishes no rents at all. So the market figure here is
          by size Class and region — three areas, which is the finest real geography that exists —
          rather than eighteen districts of invented precision.{" "}
          {latestYear !== null && (
            <>
              Sources: {RVD_RENT_SOURCE.name} ({latestYear}, {RVD_RENT_SOURCE.unit});{" "}
            </>
          )}
          {CENSUS_SOURCE.name}, {CENSUS_SOURCE.table} ({CENSUS_SOURCE.asOf}).
        </p>
      </div>
    </section>
  );
}

function Figure({
  label,
  value,
  sub,
  tone,
}: {
  readonly label: string;
  readonly value: string;
  readonly sub: string;
  readonly tone?: "positive" | "negative" | undefined;
}): React.JSX.Element {
  return (
    <div className="rounded-card border border-line bg-surfaceMuted p-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted">{label}</p>
      <p
        className={`mt-1 text-lg font-semibold tabular-nums ${
          tone === "positive" ? "text-positive" : tone === "negative" ? "text-negative" : "text-mist"
        }`}
      >
        {value}
      </p>
      <p className="mt-0.5 text-[11px] leading-relaxed text-muted">{sub}</p>
    </div>
  );
}

function Inline({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}): React.JSX.Element {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted">{label}</p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums text-mist">{value}</p>
    </div>
  );
}
