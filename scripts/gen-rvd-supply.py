"""Regenerate the RVD supply-and-absorption series, by Class.

    python scripts/gen-rvd-supply.py

Six sources, all annual, all from the Rating and Valuation Department:

  Private_Domestic-Stock                    stock at year end by Class, from 1985
  Private_Domestic-Vacancy                  vacant units and rate by Class, from 1985
  Private_Domestic-Completions              completions by Class, from 1985
  Private_Domestic-Take-up                  absorption, split at 100 m2, from 1985
  Private_Dom_Demolition_by_Class_and_Region  units demolished, from 2020
  Private_Dom_Stock_by_Age                  age profile of the stock, from 2016

**Why this is one module.** Separately each is a column of numbers. Together, and read
alongside `rvd-class-series.ts`, they answer one question per size band: for a Class B flat,
what is the price doing, what is the rent doing, how many exist, how many are empty, how many
are being built, how many are being absorbed, and how many are being demolished. That is a
complete supply-and-demand picture at the only resolution Hong Kong publishes it -- and it is
the resolution this product already sorts flats into.

**Take-up is the demand half of vacancy and is not derivable from it.** Vacancy says how many
flats sit empty at one instant; take-up says how many were absorbed over the year. A rising
vacancy rate with rising take-up is a market building faster than it can absorb; a rising
vacancy rate with falling take-up is a market losing demand. The two numbers separate cases
that one number cannot.

Generated rather than hand-typed, for the same reason as every other module here.

Run it when `node scripts/ingest-official.mjs` reports drift on these sources.
"""

import csv
import io
import os
import re
import urllib.request

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(REPO, ".cache")
OUT = os.path.join(REPO, "packages", "fixtures", "src", "rvd-supply.ts")

BASE = "https://www.rvd.gov.hk/datagovhk/"
SOURCES = {
    "stock": ("Private_Domestic-Stock.csv", "rvd_t_stock.csv"),
    "vacancy": ("Private_Domestic-Vacancy.csv", "rvd_t_vacancy.csv"),
    "completions": ("Private_Domestic-Completions.csv", "rvd_t_completions.csv"),
    "takeup": ("Private_Domestic-Take-up.csv", "rvd_t_takeup.csv"),
    "demolition": ("Private_Dom_Demolition_by_Class_and_Region_Eng.csv", "rvd_demolition.csv"),
    "age": ("Private_Dom_Stock_by_Age_Eng.csv", "rvd_stock_by_age.csv"),
}

os.makedirs(CACHE, exist_ok=True)


def load(key):
    name, cached = SOURCES[key]
    path = os.path.join(CACHE, cached)
    if not os.path.exists(path):
        print("downloading", BASE + name)
        with urllib.request.urlopen(BASE + name) as r, open(path, "wb") as f:
            f.write(r.read())
    return list(csv.reader(io.open(path, encoding="utf-8-sig")))


def num(cell):
    """Blank, '-' and 'NA' all mean RVD published nothing. None, never zero."""
    s = (cell or "").strip().replace(",", "")
    if s in ("", "-", "NA", "N.A.", "n.a."):
        return None
    try:
        return float(s)
    except ValueError:
        return None


def year_of(cell):
    m = re.match(r"^(\d{4})$", (cell or "").strip())
    return None if m is None else int(m.group(1))


def by_year(rows, wanted, year_col=0, header_row=1, data_from=2):
    """Returns {year: {key: value}} for the columns named in `wanted`."""
    header = [h.strip() for h in rows[header_row]]
    col = {}
    for key, label in wanted.items():
        if label not in header:
            raise SystemExit("column not found: %r\n  have: %r" % (label, header))
        col[key] = header.index(label)
    out = {}
    for row in rows[data_from:]:
        if not row:
            continue
        y = year_of(row[year_col])
        if y is None:
            continue
        out[y] = dict(
            (k, num(row[i]) if i < len(row) else None) for k, i in col.items()
        )
    return out


CLASSES = "ABCDE"

stock = by_year(load("stock"), dict(
    [(k, "Class %s (Stock)" % k) for k in CLASSES] + [("total", "Total (Stock)")]
))
vac_units = by_year(load("vacancy"), dict(
    [(k, "Class %s (Vacancy) - Unit" % k) for k in CLASSES]
))
vac_rate = by_year(load("vacancy"), dict(
    [(k, "Class %s (Vacancy) - %%" % k) for k in CLASSES]
))
completions = by_year(load("completions"), dict(
    [(k, "Class %s (Completions)" % k) for k in CLASSES]
))
takeup = by_year(load("takeup"), {
    "small": "Take Up (SA Less than 100 m2)",
    "large": "Take up (SA 100 m2 or above)",
    "total": "Take up (Total)",
})

# One axis across every annual series. They end in different years -- completions runs a year
# ahead on provisional figures, take-up a year behind -- so a shared axis with nulls is the
# only way the arrays can be read side by side without silently misaligning.
YEARS = sorted(set(stock) | set(vac_units) | set(completions) | set(takeup))


def col(table, key):
    return [(table.get(y) or {}).get(key) for y in YEARS]


def fmt(v, pct=False):
    if v is None:
        return "null"
    if pct:
        v = v * 100.0
    r = round(v, 4 if pct else 2)
    return str(int(r)) if r == int(r) else str(r)


def arr(values, pct=False):
    return "[" + ",".join(fmt(v, pct) for v in values) + "]"


# Demolition and the age profile are small and irregularly shaped -- flat records read better
# than a padded matrix, and there are only a couple of dozen rows of each.
dem_rows = []
for row in load("demolition")[2:]:
    if not row or year_of(row[0]) is None:
        continue
    dem_rows.append((year_of(row[0]), row[1].strip(),
                     [num(row[2 + i]) for i in range(5)], num(row[7])))

age_header = [h.strip() for h in load("age")[1]]
AGE_BANDS = [h for h in age_header if h.startswith("Year of Completions - ")]
age_rows = []
for row in load("age")[2:]:
    if not row or year_of(row[0]) is None:
        continue
    vals = [num(row[age_header.index(b)]) for b in AGE_BANDS]
    age_rows.append((year_of(row[0]), row[1].strip(), vals, num(row[-1])))

NL = "\n"
LATEST_STOCK = max(y for y in stock if stock[y].get("total") is not None)

body = """/**
 * RVD supply and absorption, by Class -- generated, never typed.
 *
 *     python scripts/gen-rvd-supply.py
 *
 * Genuine data. Nothing in this file is synthetic.
 *
 * **Read this beside `rvd-class-series.ts`.** That module holds the price and rent indices per
 * Class; this one holds the physical market underneath them. Together they answer one question
 * per size band: for a Class B flat, what is the price doing, what is the rent doing, how many
 * exist, how many sit empty, how many are being built, and how many are being absorbed. The
 * Class is the only resolution Hong Kong publishes this at, and it is the same band
 * `rvdClassForAreaSqft` already sorts a reader's flat into.
 *
 * **Take-up is not derivable from vacancy, and that is why both are here.** Vacancy counts
 * flats empty at one instant; take-up counts flats absorbed across a year. Rising vacancy with
 * rising take-up is a market building faster than it absorbs; rising vacancy with falling
 * take-up is a market losing demand. One number cannot separate those.
 *
 * **One axis, padded with nulls.** The series end in different years -- completions runs ahead
 * on provisional figures, take-up behind -- so they share `RVD_SUPPLY_YEARS` and carry null
 * where a source has not reported. A null is a hole, never a zero.
 *
 * **Vacancy rates are stored as percentages.** RVD publishes them as fractions (0.043); they
 * are multiplied by 100 here so they match `vacancy_rate` everywhere else in this product,
 * which is a percentage. That conversion is the one transformation this file performs.
 */

import type { RvdClassKey } from "./rvd-real.js";

export const RVD_SUPPLY_SOURCE = {
  name: "Rating and Valuation Department",
  detail:
    "Private Domestic \\u2014 Stock, Vacancy, Completions, Take-up, Demolition and Stock by Age",
  url: "https://www.rvd.gov.hk/en/publications/property_market_statistics.html",
  latestStockYear: %LATEST_STOCK%,
} as const;

/** Shared annual axis, oldest first. Every array below is this length. */
export const RVD_SUPPLY_YEARS: readonly number[] = %YEARS%;

/** Flats in existence at year end, by Class. */
export const RVD_STOCK_BY_CLASS: Readonly<Record<RvdClassKey, readonly (number | null)[]>> = {
%STOCK%
};

/** All Classes together -- published by RVD, not summed here. */
export const RVD_STOCK_TOTAL: readonly (number | null)[] = %STOCK_TOTAL%;

/** Flats standing empty at year end, by Class. */
export const RVD_VACANCY_UNITS_BY_CLASS: Readonly<
  Record<RvdClassKey, readonly (number | null)[]>
> = {
%VAC_UNITS%
};

/** The same, as a percentage of that Class's stock. Converted from RVD's fractions. */
export const RVD_VACANCY_RATE_BY_CLASS: Readonly<
  Record<RvdClassKey, readonly (number | null)[]>
> = {
%VAC_RATE%
};

/** Flats completed during the year, by Class. The newest year is provisional. */
export const RVD_COMPLETIONS_BY_CLASS: Readonly<
  Record<RvdClassKey, readonly (number | null)[]>
> = {
%COMPLETIONS%
};

/**
 * Take-up -- flats absorbed during the year. Split at 100 m\\u00b2 saleable, which is the
 * Class C/D boundary, so "small" is Classes A-C and "large" is D-E.
 *
 * RVD did not publish the split before 1997; those years carry null on the two halves and a
 * real figure on the total.
 */
export const RVD_TAKEUP = {
  small: %TAKEUP_SMALL%,
  large: %TAKEUP_LARGE%,
  total: %TAKEUP_TOTAL%,
} as const;

export interface RvdDemolitionRow {
  readonly year: number;
  /** "Hong Kong", "Kowloon", "New Territories" or "Overall" -- RVD's own regions. */
  readonly region: string;
  readonly byClass: Readonly<Record<RvdClassKey, number | null>>;
  readonly total: number | null;
}

/**
 * Units demolished, by Class and region. Supply removed, which nothing else here records --
 * completions minus demolition is the real change in stock, and in an ageing urban market the
 * second term is not negligible.
 *
 * Flat records rather than a padded matrix: two dozen rows on a short, irregular axis.
 * Rows include RVD's own "Overall" region; it is a published total, not a sum computed here.
 */
export const RVD_DEMOLITION: readonly RvdDemolitionRow[] = [
%DEMOLITION%
];

export const RVD_STOCK_AGE_BANDS: readonly string[] = %AGE_BANDS%;

export interface RvdStockAgeRow {
  readonly year: number;
  /** "Overall", "Small/Medium" (Classes A-C) or "Large" (D-E) -- RVD's own segments. */
  readonly segment: string;
  /** Percentage of that segment's stock completed in each band of `RVD_STOCK_AGE_BANDS`. */
  readonly sharePct: readonly (number | null)[];
  readonly totalUnits: number | null;
}

/**
 * The age profile of the private domestic stock.
 *
 * An investor signal the rest of this data cannot give: a district or segment whose stock is
 * mostly pre-1980 is one where maintenance, redevelopment and lease renewal are live
 * questions. Published territory-wide by segment only -- there is no per-district age
 * breakdown, which is why this is not in `market_observations`.
 */
export const RVD_STOCK_BY_AGE: readonly RvdStockAgeRow[] = [
%AGE%
];
"""

subs = {
    "%LATEST_STOCK%": str(LATEST_STOCK),
    "%YEARS%": "[" + ",".join(str(y) for y in YEARS) + "]",
    "%STOCK%": NL.join("  %s: %s," % (k, arr(col(stock, k))) for k in CLASSES),
    "%STOCK_TOTAL%": arr(col(stock, "total")),
    "%VAC_UNITS%": NL.join("  %s: %s," % (k, arr(col(vac_units, k))) for k in CLASSES),
    "%VAC_RATE%": NL.join("  %s: %s," % (k, arr(col(vac_rate, k), pct=True)) for k in CLASSES),
    "%COMPLETIONS%": NL.join("  %s: %s," % (k, arr(col(completions, k))) for k in CLASSES),
    "%TAKEUP_SMALL%": arr(col(takeup, "small")),
    "%TAKEUP_LARGE%": arr(col(takeup, "large")),
    "%TAKEUP_TOTAL%": arr(col(takeup, "total")),
    "%DEMOLITION%": NL.join(
        '  { year: %d, region: "%s", byClass: { %s }, total: %s },'
        % (y, reg, ", ".join("%s: %s" % (CLASSES[i], fmt(v)) for i, v in enumerate(vals)), fmt(tot))
        for (y, reg, vals, tot) in dem_rows
    ),
    "%AGE_BANDS%": "[" + ", ".join(
        '"%s"' % b.replace("Year of Completions - ", "") for b in AGE_BANDS
    ) + "]",
    "%AGE%": NL.join(
        '  { year: %d, segment: "%s", sharePct: %s, totalUnits: %s },'
        % (y, seg, arr(vals), fmt(tot))
        for (y, seg, vals, tot) in age_rows
    ),
}
for k, v in subs.items():
    body = body.replace(k, v)

io.open(OUT, "w", encoding="utf-8", newline="\n").write(body)
print("wrote %s" % OUT)
print("  years        : %d (%d -> %d)" % (len(YEARS), YEARS[0], YEARS[-1]))
print("  demolition   : %d rows" % len(dem_rows))
print("  stock by age : %d rows, %d bands" % (len(age_rows), len(AGE_BANDS)))
print("  latest stock : %s" % fmt(stock[LATEST_STOCK]["total"]))
for k in CLASSES:
    s = [v for v in col(stock, k) if v is not None]
    r = [v for v in col(vac_rate, k) if v is not None]
    print("  Class %s: stock %9s  vacancy %5s%%" % (k, fmt(s[-1]), fmt(r[-1], pct=True)))
t = [v for v in col(takeup, "total") if v is not None]
print("  take-up last : %s" % fmt(t[-1]))
