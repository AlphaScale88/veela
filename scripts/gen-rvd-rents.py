"""Regenerate RVD average rents by Class and region.

    python scripts/gen-rvd-rents.py

Downloads the source from the department that publishes it, then regenerates
packages", "fixtures", "src", "rvd-rents.ts. Generated rather than hand-typed because the table is
exactly the size at which a transcription error is both likely and invisible.

Run it when `node scripts/ingest-official.mjs` reports drift on this source.
"""

import io
import os
import urllib.request

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_URL = "https://www.rvd.gov.hk/datagovhk/1.1A(from_99).csv"
SRC = os.path.join(REPO, ".cache", "rvd_avg_rents_by_class.csv")
OUT = os.path.join(REPO, "packages", "fixtures", "src", "rvd-rents.ts")

os.makedirs(os.path.dirname(SRC), exist_ok=True)
if not os.path.exists(SRC):
    print("downloading", SRC_URL)
    with urllib.request.urlopen(SRC_URL) as r, open(SRC, "wb") as f:
        f.write(r.read())

import csv
import io
import re


rows = list(csv.reader(io.open(SRC, encoding="utf-8-sig")))
header = rows[1]
data = [r for r in rows[2:] if r and r[0].strip().isdigit()]

# Column index per (class, region), skipping every "- Remarks" column.
REGIONS = {"Hong Kong": "hongKong", "Kowloon": "kowloon", "New Territories": "newTerritories"}
series = {}
for i, name in enumerate(header):
    m = re.match(r"Class ([A-E]) (Hong Kong|Kowloon|New Territories)$", name.strip())
    if m:
        series[(m.group(1), REGIONS[m.group(2)])] = i

assert len(series) == 15, len(series)

years = [int(r[0].strip()) for r in data]


def val(row, idx):
    v = row[idx].strip()
    return v if v else "null"


blocks = []
for cls in "ABCDE":
    lines = [f"  {cls}: {{"]
    for region_key in ("hongKong", "kowloon", "newTerritories"):
        vals = [val(r, series[(cls, region_key)]) for r in data]
        lines.append(f"    {region_key}: [{','.join(vals)}],")
    lines.append("  },")
    blocks.append("\n".join(lines))

body = "\n".join(blocks)

ts = f'''/**
 * **Real average rents, per square metre per month — RVD's own published figures.** Fourth
 * genuine module in this package, after `geo.ts`, `rvd-real.ts` and `census-real.ts`.
 *
 * Source: Rating and Valuation Department, *Private Domestic — Average Rents by Class*, annual
 * from 1999, published on data.gov.hk as `1.1A(from_99).csv`. Generated from that file by a
 * script rather than typed in, for the same reason `census-real.ts` is.
 *
 * ## Why this matters more than it looks
 *
 * It is the **only official rent figure with a geographic breakdown** that this project has
 * found. RVD's district-level open data is stock, completions and vacancy — no rents; its rent
 * *index* is territory-wide. This is by Class **and by region**: Hong Kong Island, Kowloon, New
 * Territories. Three areas is coarser than eighteen districts, and it is real, which the
 * alternative was not: spreading a territory-wide number across districts to look precise is
 * exactly what this codebase refused to do when the same gap appeared for price indices.
 *
 * The repo's districts already carry a `region`, so a flat maps to one of these three without
 * inventing anything.
 *
 * ## It is a rent per square metre, and it is an average
 *
 * Multiply by saleable area to get a monthly rent — `averageRentForFlat()` does it, converting
 * from square feet, because every other area figure in this product is in square feet and RVD's
 * is not. Two honest limits, both stated wherever it renders: **an average is not this flat**
 * (RVD's own Remarks columns exist because thin sampling makes some cells unreliable), and the
 * **latest row is annual**, so it lags the monthly rent index in `rvd-real.ts`.
 *
 * The two are complements rather than rivals. `estimateMonthlyRent()` in `rvd-real.ts` derives a
 * rent from RVD's monthly *yield* by Class and is more current; this gives the actual average
 * rent per square metre and is the only one that knows about regions. Where they disagree, they
 * disagree for a reason a reader can see: one is territory-wide and monthly, the other is
 * regional and annual.
 */

export type RvdRegionKey = "hongKong" | "kowloon" | "newTerritories";

export const RVD_RENT_SOURCE = {{
  name: "Rating and Valuation Department — Private Domestic, Average Rents by Class",
  file: "1.1A(from_99).csv",
  url: "https://www.rvd.gov.hk/en/publications/property_market_statistics.html",
  unit: "HK$ per square metre of saleable area, per month",
}} as const;

/** Region label as it appears in `districts.ts`, mapped to this table's keys. */
export const RVD_REGION_BY_LABEL: Readonly<Record<string, RvdRegionKey>> = {{
  "Hong Kong Island": "hongKong",
  Kowloon: "kowloon",
  "New Territories": "newTerritories",
}};

export const RVD_RENT_YEARS: readonly number[] = [{",".join(str(y) for y in years)}];

/** `null` where RVD published nothing — never interpolated. */
export const RVD_AVG_RENT_PER_SQM: Readonly<
  Record<"A" | "B" | "C" | "D" | "E", Readonly<Record<RvdRegionKey, readonly (number | null)[]>>>
> = {{
{body}
}};

const SQFT_PER_SQM = 10.7639;

export interface AverageRentResult {{
  readonly year: number;
  readonly rentPerSqm: number;
  readonly monthlyRentHkd: number;
  readonly rvdClass: "A" | "B" | "C" | "D" | "E";
  readonly region: RvdRegionKey;
}}

/**
 * The latest published average rent for a flat of this Class in this region, and what that
 * implies for a flat of this size.
 *
 * Walks the series **backwards to the last year RVD actually published**, rather than assuming
 * the final element is present — the same guard `estimateMonthlyRent()` needs, because these
 * arrays carry `null` holes where a cell was too thinly sampled to report.
 */
export function averageRentForFlat(
  rvdClass: "A" | "B" | "C" | "D" | "E",
  region: RvdRegionKey,
  saleableAreaSqft: number,
): AverageRentResult | null {{
  if (!(saleableAreaSqft > 0)) return null;
  const series = RVD_AVG_RENT_PER_SQM[rvdClass][region];
  for (let i = series.length - 1; i >= 0; i -= 1) {{
    const rentPerSqm = series[i];
    const year = RVD_RENT_YEARS[i];
    if (rentPerSqm === null || rentPerSqm === undefined || year === undefined) continue;
    const sqm = saleableAreaSqft / SQFT_PER_SQM;
    return {{
      year,
      rentPerSqm,
      monthlyRentHkd: Math.round(rentPerSqm * sqm),
      rvdClass,
      region,
    }};
  }}
  return null;
}}

/** The same figure for all three regions, for "is this area dear or cheap" comparisons. */
export function averageRentAcrossRegions(
  rvdClass: "A" | "B" | "C" | "D" | "E",
  saleableAreaSqft: number,
): readonly {{ readonly region: RvdRegionKey; readonly result: AverageRentResult | null }}[] {{
  return (["hongKong", "kowloon", "newTerritories"] as const).map((region) => ({{
    region,
    result: averageRentForFlat(rvdClass, region, saleableAreaSqft),
  }}));
}}

export const RVD_REGION_LABEL: Readonly<Record<RvdRegionKey, string>> = {{
  hongKong: "Hong Kong Island",
  kowloon: "Kowloon",
  newTerritories: "New Territories",
}};
'''

io.open(OUT, "w", encoding="utf-8", newline="").write(ts)
print("wrote", OUT)
print("years:", years[0], "->", years[-1], f"({len(years)} rows)")
for cls in "ABCDE":
    latest = {r: data[-1][series[(cls, r)]].strip() for r in ("hongKong", "kowloon", "newTerritories")}
    print(f"  Class {cls} {years[-1]}: {latest}")
