"""Regenerate the RVD index series that are split by Class and by region.

    python scripts/gen-rvd-class-series.py

Three sources, all monthly, all from the Rating and Valuation Department:

  1.4M  price indices by Class (A-E), territory-wide, from 1993
  1.3M  rental indices by Class (A-E), territory-wide, from 1993
  1.5M  price indices for selected popular developments, Urban / New Territories, from 1992

**Why these and not the all-classes series already held.** `rvd-real.ts` carries one price
index and one rent index, both "All Classes", and every screen shows them to everyone. But
the product's entire size taxonomy *is* the RVD Class -- `rvdClassForAreaSqft` decides which
band a flat falls in, and the rent estimator already reads a per-Class yield. Showing the
all-classes index next to a per-Class yield is an inconsistency the reader cannot see, and
the bands have genuinely diverged.

1.5M is the only price series RVD publishes with **any** geographic split. Not eighteen
districts -- Urban against New Territories -- which is the same reasoning `rvd-rents.ts`
records for its three regions: a real coarse geography beats an invented fine one.

Generated rather than hand-typed: 400-odd months x 5 classes x 2 series is exactly the size
at which a transcription error is both likely and invisible.

Run it when `node scripts/ingest-official.mjs` reports drift on these sources.
"""

import csv
import io
import os
import re
import urllib.request

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(REPO, ".cache")
OUT = os.path.join(REPO, "packages", "fixtures", "src", "rvd-class-series.ts")

SOURCES = {
    "price": ("https://www.rvd.gov.hk/datagovhk/1.4M.csv", "rvd_price_index_by_class.csv"),
    "rent": ("https://www.rvd.gov.hk/datagovhk/1.3M.csv", "rvd_rent_index_by_class.csv"),
    "popular": ("https://www.rvd.gov.hk/datagovhk/1.5M.csv", "rvd_popular_developments.csv"),
}

os.makedirs(CACHE, exist_ok=True)


def load(key):
    url, name = SOURCES[key]
    path = os.path.join(CACHE, name)
    if not os.path.exists(path):
        print("downloading", url)
        with urllib.request.urlopen(url) as r, open(path, "wb") as f:
            f.write(r.read())
    return list(csv.reader(io.open(path, encoding="utf-8-sig")))


MONTH = re.compile(r"^(\d{2})-(\d{4})$")


def period_of(cell):
    """RVD writes MM-YYYY; the rest of this repo speaks YYYY-MM-01."""
    m = MONTH.match(cell.strip())
    return None if m is None else "%s-%s-01" % (m.group(2), m.group(1))


def num(cell):
    """Blank means RVD published nothing that month -- a hole, never a zero.

    Kept as null rather than interpolated, for the reason `rvd-real.ts` already records
    against the yield series: a made-up midpoint is indistinguishable from a measurement
    once it is in an array.
    """
    s = (cell or "").strip()
    if s in ("", "-", "N.A.", "NA"):
        return None
    try:
        return float(s)
    except ValueError:
        return None


def read_series(rows, wanted):
    """wanted: {output key: exact header text}. Returns (periods, {key: [values]})."""
    header = [h.strip() for h in rows[1]]
    col = {}
    for key, label in wanted.items():
        if label not in header:
            raise SystemExit("column not found: %r in %r" % (label, header))
        col[key] = header.index(label)

    periods, out = [], dict((k, []) for k in wanted)
    for row in rows[2:]:
        if not row:
            continue
        p = period_of(row[0])
        if p is None:
            continue
        periods.append(p)
        for key, i in col.items():
            out[key].append(num(row[i]) if i < len(row) else None)
    return periods, out


CLASSES = dict((k, "Class " + k) for k in "ABCDE")
POPULAR = {
    "urbanSmall": "Classes A, B & C Urban",
    "ntSmall": "Classes A, B & C New Territories",
    "urbanLarge": "Classes D & E Urban",
    "ntLarge": "Classes D & E New Territories",
    "urbanOverall": "Overall Urban",
    "ntOverall": "Overall New Territories",
    "overall": "Overall All",
}
POPULAR_ORDER = [
    "urbanSmall",
    "ntSmall",
    "urbanLarge",
    "ntLarge",
    "urbanOverall",
    "ntOverall",
    "overall",
]

price_periods, price = read_series(load("price"), CLASSES)
rent_periods, rent = read_series(load("rent"), CLASSES)
pop_periods, popular = read_series(load("popular"), POPULAR)

# The two Class series must share one axis or the arrays cannot be read side by side.
if price_periods != rent_periods:
    raise SystemExit(
        "1.3M and 1.4M no longer cover the same months (%d vs %d) -- "
        "they can no longer share an axis." % (len(price_periods), len(rent_periods))
    )

LATEST = price_periods[-1]


def fmt(v):
    if v is None:
        return "null"
    r = round(v, 2)
    return str(int(r)) if r == int(r) else str(r)


def arr(values):
    return "[" + ",".join(fmt(v) for v in values) + "]"


def periods_arr(values):
    return "[\n  " + ",\n  ".join('"%s"' % p for p in values) + ",\n]"


def last_real(values):
    for v in reversed(values):
        if v is not None:
            return v
    return None


NL = "\n"
class_price_lines = NL.join("  %s: %s," % (k, arr(price[k])) for k in "ABCDE")
class_rent_lines = NL.join("  %s: %s," % (k, arr(rent[k])) for k in "ABCDE")
popular_lines = NL.join("  %s: %s," % (k, arr(popular[k])) for k in POPULAR_ORDER)

body = """/**
 * RVD index series split by **Class** and by **region** -- generated, never typed.
 *
 *     python scripts/gen-rvd-class-series.py
 *
 * The fifth genuine module in this package, after `geo.ts`, `rvd-real.ts`, `census-real.ts`
 * and `rvd-rents.ts`. Nothing here is synthetic.
 *
 * **What this adds over `rvd-real.ts`.** That module holds one price index and one rent
 * index, both "All Classes", and every screen shows them to everyone. But this product's
 * whole size taxonomy is the RVD Class -- `rvdClassForAreaSqft` puts a flat in a band and
 * `estimateMonthlyRent` reads a per-Class yield -- so an all-classes index shown beside a
 * per-Class figure is an inconsistency the reader has no way to see. At %LATEST_MONTH% the
 * bands stand at A %A%, B %B%, C %C%, D %D%, E %E%: a spread of %SPREAD% points that the
 * single all-classes line flattens away.
 *
 * **Nulls are holes, not zeroes.** RVD leaves a month blank when it published nothing, and
 * the blank is preserved rather than interpolated -- the same rule the yield series follows.
 * Use `latestReported`; do not assume the final element is a number.
 *
 * Both Class series share `RVD_CLASS_INDEX_PERIODS`. The popular-developments series has its
 * own axis because it starts a year earlier. The generator refuses to emit if the two Class
 * sources ever stop covering the same months, rather than silently misaligning them.
 */

import type { RvdClassKey } from "./rvd-real.js";

export const RVD_CLASS_SERIES_SOURCE = {
  name: "Rating and Valuation Department",
  priceByClass: "Private Domestic \\u2014 Price Indices by Class (Territory-wide), Monthly",
  rentByClass: "Private Domestic \\u2014 Rental Indices by Class (Territory-wide), Monthly",
  popularDevelopments:
    "Private Domestic \\u2014 Price Indices for Selected Popular Developments, Monthly",
  url: "https://www.rvd.gov.hk/en/publications/property_market_statistics.html",
  latest: "%LATEST%",
} as const;

/** Shared monthly axis for both Class series, oldest first. */
export const RVD_CLASS_INDEX_PERIODS: readonly string[] = %PRICE_PERIODS%;

/** Price index by Class, territory-wide. Same length and order as the axis above. */
export const RVD_PRICE_INDEX_BY_CLASS: Readonly<
  Record<RvdClassKey, readonly (number | null)[]>
> = {
%CLASS_PRICE%
};

/** Rental index by Class, territory-wide. Same axis as the price index above. */
export const RVD_RENT_INDEX_BY_CLASS: Readonly<
  Record<RvdClassKey, readonly (number | null)[]>
> = {
%CLASS_RENT%
};

/**
 * Price indices for selected popular developments -- **the only RVD price series with a
 * geographic split.** Urban against New Territories, monthly from 1992.
 *
 * Not eighteen districts, and deliberately not spread into eighteen: the same argument
 * `rvd-rents.ts` makes for its three regions. A real coarse geography beats an invented fine
 * one. Say "Urban" on screen, never "your district".
 *
 * "Small" is Classes A, B and C (under 100 m\\u00b2 saleable); "Large" is D and E.
 */
export const RVD_POPULAR_DEV_PERIODS: readonly string[] = %POP_PERIODS%;

export const POPULAR_DEV_LABELS = {
  urbanSmall: "Urban \\u2014 under 100 m\\u00b2",
  ntSmall: "New Territories \\u2014 under 100 m\\u00b2",
  urbanLarge: "Urban \\u2014 100 m\\u00b2 and over",
  ntLarge: "New Territories \\u2014 100 m\\u00b2 and over",
  urbanOverall: "Urban \\u2014 all sizes",
  ntOverall: "New Territories \\u2014 all sizes",
  overall: "Hong Kong \\u2014 all sizes",
} as const;

export type PopularDevKey = keyof typeof POPULAR_DEV_LABELS;

export const RVD_POPULAR_DEV_PRICE_INDEX: Readonly<
  Record<PopularDevKey, readonly (number | null)[]>
> = {
%POPULAR%
};

/**
 * The last month a series actually reported, walking backwards past RVD's holes.
 *
 * Reading the final element is wrong often enough to be worth a function: the newest month
 * is routinely absent for the thinner Classes, and a null read as "no data at all" would
 * hide a series that is merely a month behind.
 */
export function latestReported(
  series: readonly (number | null)[],
  periods: readonly string[],
): { readonly periodStart: string; readonly value: number } | null {
  for (let i = series.length - 1; i >= 0; i -= 1) {
    const v = series[i];
    if (v !== null && v !== undefined) return { periodStart: periods[i]!, value: v };
  }
  return null;
}
"""

lastA = last_real(price["A"])
lastE = last_real(price["E"])
subs = {
    "%LATEST%": LATEST,
    "%LATEST_MONTH%": LATEST[:7],
    "%A%": fmt(lastA),
    "%B%": fmt(last_real(price["B"])),
    "%C%": fmt(last_real(price["C"])),
    "%D%": fmt(last_real(price["D"])),
    "%E%": fmt(lastE),
    "%SPREAD%": fmt(round(lastA - lastE, 1)),
    "%PRICE_PERIODS%": periods_arr(price_periods),
    "%POP_PERIODS%": periods_arr(pop_periods),
    "%CLASS_PRICE%": class_price_lines,
    "%CLASS_RENT%": class_rent_lines,
    "%POPULAR%": popular_lines,
}
for k, v in subs.items():
    body = body.replace(k, v)

io.open(OUT, "w", encoding="utf-8", newline="\n").write(body)
print("wrote %s" % OUT)
print("  class series : %d months, %s -> %s" % (len(price_periods), price_periods[0], price_periods[-1]))
print("  popular devs : %d months, %s -> %s" % (len(pop_periods), pop_periods[0], pop_periods[-1]))
for k in "ABCDE":
    lp = [v for v in price[k] if v is not None]
    lr = [v for v in rent[k] if v is not None]
    print("  Class %s: price %7s  rent %7s   (%d/%d reported)" % (k, fmt(lp[-1]), fmt(lr[-1]), len(lp), len(lr)))
for k in POPULAR_ORDER:
    print("  %-14s %8s" % (k, fmt(last_real(popular[k]))))
