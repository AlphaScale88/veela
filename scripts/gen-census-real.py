"""Regenerate the Census per-district figures.

    python scripts/gen-census-real.py

Downloads the source from the department that publishes it, then regenerates
packages", "fixtures", "src", "census-real.ts. Generated rather than hand-typed because the table is
exactly the size at which a transcription error is both likely and invisible.

Run it when `node scripts/ingest-official.mjs` reports drift on this source.
"""

import io
import os
import urllib.request

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_URL = "https://www.census2021.gov.hk/doc/DC_21C.xlsx"
SRC = os.path.join(REPO, ".cache", "DC_21C.xlsx")
OUT = os.path.join(REPO, "packages", "fixtures", "src", "census-real.ts")

os.makedirs(os.path.dirname(SRC), exist_ok=True)
if not os.path.exists(SRC):
    print("downloading", SRC_URL)
    with urllib.request.urlopen(SRC_URL) as r, open(SRC, "wb") as f:
        f.write(r.read())

import io
import json
import re
import zipfile
import xml.etree.ElementTree as ET

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"

# Census English district name -> the repo's district id (districts.ts).
ID_BY_NAME = {
    "Central and Western": "HK-CW",
    "Wan Chai": "HK-WCH",
    "Eastern": "HK-E",
    "Southern": "HK-S",
    "Yau Tsim Mong": "HK-YTM",
    "Sham Shui Po": "HK-SSP",
    "Kowloon City": "HK-KC",
    "Wong Tai Sin": "HK-WTS",
    "Kwun Tong": "HK-KwT",
    "Kwai Tsing": "HK-KT2",
    "Tsuen Wan": "HK-TW",
    "Tuen Mun": "HK-TM",
    "Yuen Long": "HK-YL",
    "North": "HK-N",
    "Tai Po": "HK-TP",
    "Sha Tin": "HK-ST",
    "Sai Kung": "HK-SK",
    "Islands": "HK-IS",
}

z = zipfile.ZipFile(SRC)
shared = []
for si in ET.fromstring(z.read("xl/sharedStrings.xml")).findall(NS + "si"):
    shared.append("".join(t.text or "" for t in si.iter(NS + "t")))


def txt(c):
    if c.get("t") == "s":
        v = c.find(NS + "v")
        return shared[int(v.text)] if v is not None else ""
    v = c.find(NS + "v")
    return v.text if v is not None else ""


sheet = ET.fromstring(z.read("xl/worksheets/sheet1.xml"))
rows = {}
for row in sheet.iter(NS + "row"):
    rows[int(row.get("r"))] = {
        re.match(r"[A-Z]+", c.get("r")).group(0): txt(c) for c in row.findall(NS + "c")
    }
col = {v: k for k, v in rows[5].items() if v}

records = []
for r in range(6, 25):
    row = rows.get(r, {})
    name = row.get(col["dc_eng"], "")
    if name not in ID_BY_NAME:
        continue

    def num(code):
        try:
            return float(row.get(col[code], ""))
        except (KeyError, TypeError, ValueError):
            return None

    types = {k: num(k) for k in ("dh_pub", "dh_s", "dh_pri", "dh_non", "dh_tem")}
    total = sum(v for v in types.values() if v is not None)
    assert total > 0, name
    records.append(
        {
            "id": ID_BY_NAME[name],
            "name": name,
            "medianMonthlyRentHkd": int(round(num("dm_r"))),
            "rentToIncomeRatio": round(num("dmr_ir") / 100, 4),
            "medianMonthlyMortgageHkd": int(round(num("dhm_loan"))),
            "rentingHouseholds": None,  # not needed; shares below carry the caveat
            "households": int(round(total)),
            "publicRentalShare": round(types["dh_pub"] / total, 4),
            "privateHousingShare": round(types["dh_pri"] / total, 4),
        }
    )

assert len(records) == 18, len(records)
records.sort(key=lambda d: -d["medianMonthlyRentHkd"])

lines = []
for d in records:
    lines.append(
        "  {\n"
        f'    districtId: "{d["id"]}",\n'
        f'    name: "{d["name"]}",\n'
        f'    medianMonthlyRentHkd: {d["medianMonthlyRentHkd"]},\n'
        f'    rentToIncomeRatio: {d["rentToIncomeRatio"]},\n'
        f'    medianMonthlyMortgageHkd: {d["medianMonthlyMortgageHkd"]},\n'
        f'    households: {d["households"]},\n'
        f'    publicRentalShare: {d["publicRentalShare"]},\n'
        f'    privateHousingShare: {d["privateHousingShare"]},\n'
        "  },"
    )

body = "\n".join(lines)

header = '''/**
 * **Real Census figures, per district — the third non-synthetic file in this package**, after
 * `geo.ts` (coordinates) and `rvd-real.ts` (RVD indices). Everything else here is invented and
 * carries a demo banner. These are not.
 *
 * Source: Census and Statistics Department, **2021 Population Census — Statistics by District
 * Council District** (`DC_21C.xlsx`), columns `dm_r`, `dmr_ir`, `dhm_loan` and the housing-type
 * household counts `dh_pub` / `dh_s` / `dh_pri` / `dh_non` / `dh_tem`.
 *
 * **Generated from the workbook by a script, not typed in.** Eighteen districts times six figures
 * is exactly the size at which a transcription error is both likely and invisible \\u2014 the same
 * reasoning that made `rvdGrowthWindows()` derive its rates from the series instead of hardcoding
 * them.
 *
 * ## The one thing that must always be shown with `medianMonthlyRentHkd`
 *
 * **This is the median rent paid by every renting household in the district, including public
 * rental housing \\u2014 so it is emphatically not a private market rent.** The numbers prove it
 * themselves: Wong Tai Sin, half of whose households are in public rental housing, has a median
 * rent of HK$2,430, while Central and Western at 3.2% public has HK$15,070. A sixfold gap that is
 * mostly a housing-policy artefact, not a market signal.
 *
 * That is why `publicRentalShare` sits in the same record and is not optional: presenting
 * HK$2,430 to an investor as "the rent in Wong Tai Sin" would be one of the most misleading
 * things this product could do, and the share is what stops it. Any UI showing the rent must show
 * the share, and `rentContext()` below returns them together so it is awkward not to.
 *
 * **For what a private flat actually rents for**, use `estimateMonthlyRent()` in `rvd-real.ts` \\u2014
 * RVD market yields by size Class, which is a private-market measure. It is territory-wide, so the
 * two are complements: RVD says what a flat of this size rents for, this says what renting
 * households in this district actually pay and how much of the district is subsidised.
 *
 * ## Why 2021, and why that is acceptable here
 *
 * It is a census: the next one is 2031, with a by-census in 2026 whose district tables are not out
 * yet. So this is a **structural** picture that ages slowly \\u2014 the public-housing share of a
 * district does not move much in five years \\u2014 rather than a market rate, which is exactly the
 * kind of figure a five-year-old source can still carry. RVD\\u0027s monthly indices are what move.
 * `CENSUS_SOURCE.asOf` is on screen wherever these appear.
 */

export interface CensusDistrictProfile {
  readonly districtId: string;
  readonly name: string;
  /** Median monthly rent across ALL renting households, public rental housing included. */
  readonly medianMonthlyRentHkd: number;
  /** Median rent as a share of household income, 0\\u20131. */
  readonly rentToIncomeRatio: number;
  /** Median monthly mortgage payment and loan repayment, for households that have one. */
  readonly medianMonthlyMortgageHkd: number;
  readonly households: number;
  /** Share of households in public rental housing, 0\\u20131. The caveat on the rent figure. */
  readonly publicRentalShare: number;
  /** Share in private permanent housing, 0\\u20131 \\u2014 the part of the district an investor can buy. */
  readonly privateHousingShare: number;
}

export const CENSUS_SOURCE = {
  name: "Census and Statistics Department, 2021 Population Census",
  table: "Statistics by District Council District (DC_21C)",
  url: "https://www.census2021.gov.hk/en/district_profiles.html",
  asOf: "2021-06",
} as const;

/** Sorted by median rent, highest first \\u2014 the order a reader comparing districts wants. */
export const CENSUS_DISTRICTS: readonly CensusDistrictProfile[] = [
'''

footer = '''];

export function censusDistrict(districtId: string): CensusDistrictProfile | null {
  return CENSUS_DISTRICTS.find((d) => d.districtId === districtId) ?? null;
}

/** Territory-wide median of the district medians, for "is this district dear or cheap". */
export function censusRentRange(): {
  readonly lowest: CensusDistrictProfile;
  readonly highest: CensusDistrictProfile;
  readonly median: number;
} {
  const sorted = [...CENSUS_DISTRICTS].sort(
    (a, b) => a.medianMonthlyRentHkd - b.medianMonthlyRentHkd,
  );
  const mid = sorted.length / 2;
  const a = sorted[mid - 1];
  const b = sorted[mid];
  return {
    lowest: sorted[0]!,
    highest: sorted[sorted.length - 1]!,
    /* An even count, so the median is the mean of the two middle districts. Stated rather than
       silently taking one of them, because eighteen is even and someone will check. */
    median: a !== undefined && b !== undefined
      ? Math.round((a.medianMonthlyRentHkd + b.medianMonthlyRentHkd) / 2)
      : (sorted[0]?.medianMonthlyRentHkd ?? 0),
  };
}

/**
 * The rent figure **and the fact that qualifies it**, returned together on purpose.
 *
 * A caller cannot get the median without also getting the public-housing share and a
 * ready-made sentence saying what it means \\u2014 see the file comment for why that is the
 * whole design of this module rather than a nicety.
 */
export function rentContext(districtId: string): {
  readonly profile: CensusDistrictProfile;
  readonly caveat: string;
} | null {
  const profile = censusDistrict(districtId);
  if (profile === null) return null;
  const pct = Math.round(profile.publicRentalShare * 100);
  return {
    profile,
    caveat:
      pct >= 25
        ? `${pct}% of households here are in public rental housing, so this median is far below what a private flat lets for.`
        : `${pct}% of households here are in public rental housing, so this median is close to \\u2014 but still below \\u2014 private market rent.`,
  };
}
'''

text = header + body + "\n" + footer
# Replace only the literal \uXXXX sequences, one at a time. A whole-string
# unicode_escape round trip reads the UTF-8 bytes back as latin-1 and turns every em
# dash into mojibake, which is exactly what it did on the first run.
text = re.sub(r"\\\\u([0-9a-fA-F]{4})", lambda m: chr(int(m.group(1), 16)), text)
io.open(OUT, "w", encoding="utf-8", newline="").write(text)
print("wrote", OUT, "with", len(records), "districts")
print(json.dumps(records[:3], indent=2))
