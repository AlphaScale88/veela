#!/usr/bin/env node
/**
 * Collect Veela's market data from official sources, repeatably.
 *
 *   node scripts/ingest-official.mjs            # fetch, parse, and report
 *   node scripts/ingest-official.mjs --check    # same, but exit 1 if a snapshot has drifted
 *
 * ## What this does and does not touch, which is the important part
 *
 * **Only sources that publish their own data for re-use.** Every URL below is a file the issuing
 * department put on `data.gov.hk` or its own site precisely so that people would download it.
 * Fetching those is not scraping in any sense that matters; it is the intended use.
 *
 * **It deliberately collects nothing from Centaline, Midland, Squarefoot, 28Hse, House730 or
 * Spacious**, and that is a standing decision rather than an omission or a gap to be filled
 * later. Those sites hold the transaction and listing databases this market actually runs on, and
 * this project has declined to harvest them all along:
 *
 * - Their terms prohibit it, and bulk extraction of a database assembled at someone else's
 *   expense is the kind of exposure a company cannot carry quietly. Licensing is the defensible
 *   route and remains open (`info@centamail.com` for Centaline's transaction files).
 * - Two of them answer a real browser with a Cloudflare bot challenge, tested rather than
 *   assumed. Beating that on a schedule means building anti-bot-evasion infrastructure and
 *   running it continuously against sites that have said no in the clearest technical terms
 *   available to them.
 * - The listing importer's Spacious bypass is not a precedent for this. That exists for **one
 *   page a user pasted**, on a domain allowlist of exactly two hosts, at the moment they ask. A
 *   crawler collecting the whole catalogue on a timer is a different activity with a different
 *   name, whatever the transport looks like.
 *
 * So the honest shape of "collect from all reliable sources" is: everything the government
 * publishes, automated; the commercial portals, licensed or not at all.
 *
 * ## Why some sources are snapshots in the repo rather than rows in a database
 *
 * A source that changes monthly wants a scheduled job. A source that changes **once a decade**
 * wants a committed file and a check that it has not moved — a cron job re-deriving the 2021
 * Census every night would be pure motion. So this script does two different things:
 *
 * - **Verifies** the committed snapshots (`census-real.ts`, `rvd-rents.ts`) still match what the
 *   source serves today, and says so loudly when they do not. That is what keeps a snapshot
 *   honest, and it is the part `--check` is for in CI.
 * - **Fetches and parses** the district-level series that do move, ready for the database.
 *
 * The database write is the piece that needs `DATABASE_URL` and a `median_rent` metric; until
 * those exist this reports what it would have written rather than pretending to have written it.
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

/*
 * `DATABASE_URL` lives in `apps/web/.env.local`, not at the repository root — the root file
 * holds only a Vercel token. This script reported "DATABASE_URL is not set" for a fortnight
 * while the connection string sat one directory away, which is why it looks in both.
 *
 * Deliberately not a dotenv dependency: two candidate paths and a regex is the whole need, and
 * a data-collection script that pulls in a config library to read one variable has acquired a
 * dependency it will still have long after anyone remembers why.
 */
function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  for (const rel of ["apps/web/.env.local", ".env.local"]) {
    try {
      const body = readFileSync(join(ROOT, rel), "utf8");
      const line = body.split("\n").find((l) => l.startsWith("DATABASE_URL="));
      if (line === undefined) continue;
      return line.slice("DATABASE_URL=".length).trim().replace(/^["']|["']$/g, "");
    } catch {
      /* not there — try the next */
    }
  }
  return undefined;
}
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CHECK = process.argv.includes("--check");
/* Writing is opt-in: this script is run to look at the sources far more often than to
   change the database, and a collector that mutates by default is one nobody dares run. */
const WRITE = process.argv.includes("--write");

/**
 * Every source, with what it actually yields — including the ones that yield *nothing useful*,
 * recorded so nobody re-discovers the gap. `grain` is the honest geographic resolution, which is
 * the field that decides whether a figure can be shown per district or only per region.
 */
const SOURCES = [
  {
    id: "rvd-avg-rents-by-class",
    label: "RVD — Private Domestic, Average Rents by Class (annual, from 1999)",
    url: "https://www.rvd.gov.hk/datagovhk/1.1A(from_99).csv",
    grain: "class x region (3 regions)",
    yields: "average rent, HK$/m²/month",
    snapshot: "packages/fixtures/src/rvd-rents.ts",
  },
  {
    id: "rvd-dom-stock-vacancy-by-district",
    label: "RVD — Private Domestic Stock, Completions and Vacancy by District",
    url: "https://www.rvd.gov.hk/datagovhk/Dom_Stock_Completions_and_Vacancy_by_District_Eng.csv",
    grain: "18 districts",
    yields: "stock_units, completions_units, vacancy_rate",
  },
  {
    id: "rvd-dom-stock-by-district",
    label: "RVD — Private Domestic Stock by District",
    url: "https://www.rvd.gov.hk/datagovhk/Private_Dom_Stock_by_District_Eng.csv",
    grain: "18 districts",
    yields: "stock_units by class",
  },
  {
    id: "rvd-completions-forecast-by-district",
    label: "RVD — Completions and Forecast Completions by District",
    url: "https://www.rvd.gov.hk/datagovhk/Dom_Completions_and_Forecast_Completions_by_District_Eng.csv",
    grain: "18 districts",
    yields: "completions_units, forecast completions — the only forward-looking supply figure",
  },
  {
    id: "census-district-profiles",
    label: "C&SD — 2021 Population Census, Statistics by District Council District",
    url: "https://www.census2021.gov.hk/doc/DC_21C.xlsx",
    grain: "18 districts",
    yields: "median rent, rent-to-income, housing-type shares, population, households",
    snapshot: "packages/fixtures/src/census-real.ts",
    // A .xlsx is a zip; this script checks that the bytes have not changed rather than parsing
    // it. Re-deriving is `scripts/gen-census-real.py`'s job, and it is a once-a-decade file.
    bytesOnly: true,
    expectedBytes: 76335,
  },
  /*
   * Added 02/09/2026, after enumerating what RVD actually publishes rather than working from
   * what this repository already held. Its Property Market Statistics package carries about
   * 160 resources; seven were in use. The nine below are the residential ones that were not,
   * and every one of them is split by Class -- which is the resolution this product already
   * sorts a reader's flat into, and the resolution it was showing nobody.
   */
  {
    id: "rvd-price-index-by-class",
    label: "RVD \u2014 Price Indices by Class (territory-wide, monthly from 1993)",
    url: "https://www.rvd.gov.hk/datagovhk/1.4M.csv",
    grain: "class (5), territory-wide",
    yields: "price index per Class \u2014 A stands ~58 points above E and the all-classes line hides it",
    snapshot: "packages/fixtures/src/rvd-class-series.ts",
  },
  {
    id: "rvd-rent-index-by-class",
    label: "RVD \u2014 Rental Indices by Class (territory-wide, monthly from 1993)",
    url: "https://www.rvd.gov.hk/datagovhk/1.3M.csv",
    grain: "class (5), territory-wide",
    yields: "rent index per Class \u2014 diverged further than prices: 223.4 against 147.8",
    snapshot: "packages/fixtures/src/rvd-class-series.ts",
  },
  {
    id: "rvd-popular-developments",
    label: "RVD \u2014 Price Indices for Selected Popular Developments (monthly from 1992)",
    url: "https://www.rvd.gov.hk/datagovhk/1.5M.csv",
    grain: "2 regions (Urban / New Territories) x 2 size groups",
    yields: "the ONLY price series RVD publishes with any geographic split",
    snapshot: "packages/fixtures/src/rvd-class-series.ts",
  },
  {
    id: "rvd-stock-by-class",
    label: "RVD \u2014 Private Domestic Stock at year end by Class (from 1985)",
    url: "https://www.rvd.gov.hk/datagovhk/Private_Domestic-Stock.csv",
    grain: "class (5), territory-wide",
    yields: "stock per Class, 42 years",
    snapshot: "packages/fixtures/src/rvd-supply.ts",
  },
  {
    id: "rvd-vacancy-by-class",
    label: "RVD \u2014 Private Domestic Vacancy at year end by Class (from 1985)",
    url: "https://www.rvd.gov.hk/datagovhk/Private_Domestic-Vacancy.csv",
    grain: "class (5), territory-wide",
    yields: "vacant units and rate \u2014 Class E runs ~10% against Class B ~3.6%",
    snapshot: "packages/fixtures/src/rvd-supply.ts",
  },
  {
    id: "rvd-completions-by-class",
    label: "RVD \u2014 Private Domestic Completions by Class (from 1985)",
    url: "https://www.rvd.gov.hk/datagovhk/Private_Domestic-Completions.csv",
    grain: "class (5), territory-wide",
    yields: "completions per Class; the newest year is provisional",
    snapshot: "packages/fixtures/src/rvd-supply.ts",
  },
  {
    id: "rvd-takeup",
    label: "RVD \u2014 Private Domestic Take-up (from 1985)",
    url: "https://www.rvd.gov.hk/datagovhk/Private_Domestic-Take-up.csv",
    grain: "2 size groups, territory-wide",
    yields: "absorption \u2014 the demand half of vacancy, and not derivable from it",
    snapshot: "packages/fixtures/src/rvd-supply.ts",
  },
  {
    id: "rvd-demolition",
    label: "RVD \u2014 Private Domestic Demolition by Class and Region (from 2020)",
    url: "https://www.rvd.gov.hk/datagovhk/Private_Dom_Demolition_by_Class_and_Region_Eng.csv",
    grain: "class (5) x 3 regions",
    yields: "supply REMOVED \u2014 completions minus demolition is the real change in stock",
    snapshot: "packages/fixtures/src/rvd-supply.ts",
  },
  {
    id: "rvd-stock-by-age",
    label: "RVD \u2014 Private Domestic Stock by Age (from 2016)",
    url: "https://www.rvd.gov.hk/datagovhk/Private_Dom_Stock_by_Age_Eng.csv",
    grain: "3 segments, territory-wide",
    yields: "age profile of the stock \u2014 redevelopment and maintenance exposure",
    snapshot: "packages/fixtures/src/rvd-supply.ts",
  },
  /*
   * Per-district and class-split. Both are fetched and drift-checked here, and neither is
   * stored yet: `market_observations` keys on (district, metric, kind, period) with
   * `rvd_class` outside the key, so five Classes for one district and period collide.
   * Migration 0011 replaces that key; until it is applied these two cannot be written.
   */
  {
    id: "rvd-stock-by-district-and-class",
    label: "RVD \u2014 Private Domestic Stock by District (by Class)",
    url: "https://www.rvd.gov.hk/datagovhk/Private_Dom_Stock_by_District_Eng.csv",
    grain: "18 districts x 5 classes",
    yields: "stock per district PER CLASS \u2014 only the total is stored today; awaits migration 0011",
  },
  {
    id: "rvd-forecast-by-class-and-district",
    label: "RVD \u2014 Forecast Completions by Class and District",
    url: "https://www.rvd.gov.hk/datagovhk/Dom_Forecast_Completions_by_Class_and_District_Eng.csv",
    grain: "18 districts x 5 classes x 2 years",
    yields: "forward supply per district PER CLASS; awaits migration 0011",
  },
  {
    id: "rvd-houses-by-district",
    label: "RVD \u2014 Stock and Completions of Houses by District",
    url: "https://www.rvd.gov.hk/datagovhk/Dom_Stock_and_Completions_of_Houses_by_District_Eng.csv",
    grain: "18 districts",
    yields: "houses, not flats \u2014 19,741 territory-wide, almost all in the New Territories",
  },
];

/** Sources checked and found NOT to carry what we wanted. Kept so the gap is not re-litigated. */
const KNOWN_GAPS = [
  "RVD publishes no domestic RENTS by district — its district open data is stock, completions and vacancy only. Verified against data.gov.hk's own resource list for the Property Market Statistics package. Rents come by Class, and (only in the annual file) by region.",
  // Refined 02/09/2026: "territory-wide only" was too strong and had been repeated for weeks.
  // There is no DISTRICT index, which is the part that matters. But 1.5M splits Urban from
  // New Territories, and 1.3M/1.4M split all five Classes -- so the indices are not one line.
  "RVD publishes no rent or price index PER DISTRICT; district figures exist only inside annual PDF tables. It does publish them by Class (1.3M/1.4M) and, for selected popular developments, split Urban against New Territories (1.5M) — both now held.",
  "The Land Registry sells sale-and-purchase memorials one at a time at HK$10 with no bulk option. Its free monthly file is aggregate counts and values only.",
];

async function fetchBuffer(url) {
  const res = await fetch(url, {
    headers: { "user-agent": "VeelaDataIngest/1.0 (+https://veela-one.vercel.app)" },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/** Rows that actually carry data: RVD prefixes a title line and sometimes trails notes. */
function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  return { lines: lines.length, header: lines[1] ?? lines[0] ?? "", sample: lines.slice(2, 4) };
}

let failures = 0;

console.log("Veela — official-source ingest\n" + "=".repeat(78));

for (const src of SOURCES) {
  process.stdout.write(`\n${src.label}\n  ${src.url}\n`);
  try {
    const buf = await fetchBuffer(src.url);
    const sha = createHash("sha256").update(buf).digest("hex").slice(0, 12);
    console.log(`  ok — ${buf.length} bytes, sha256:${sha}, grain: ${src.grain}`);
    console.log(`  yields: ${src.yields}`);

    if (src.bytesOnly) {
      /* A byte-length change on a decennial file means the department reissued it, which is
         exactly when the committed snapshot needs regenerating. Not a checksum, because a
         re-zip with identical content would trip it and send somebody chasing nothing. */
      if (src.expectedBytes !== undefined && buf.length !== src.expectedBytes) {
        console.log(
          `  DRIFT — expected ${src.expectedBytes} bytes, got ${buf.length}. ` +
            `Re-run scripts/gen-census-real.py and review ${src.snapshot}.`,
        );
        failures += 1;
      } else {
        console.log(`  snapshot ${src.snapshot} still matches the published file`);
      }
      continue;
    }

    const parsed = parseCsv(buf.toString("utf8"));
    console.log(`  parsed ${parsed.lines} lines`);

    if (src.id === "rvd-avg-rents-by-class") {
      /* Verify the committed snapshot against the source it was generated from: does the last
         year in the CSV still appear in the TS module? A silent divergence here would mean the
         report quotes a rent RVD no longer publishes. */
      const years = buf
        .toString("utf8")
        .split(/\r?\n/)
        .map((l) => l.split(",")[0]?.trim())
        .filter((y) => /^\d{4}$/.test(y ?? ""));
      const latest = years[years.length - 1];
      const snapshot = readFileSync(join(ROOT, src.snapshot), "utf8");
      const hasLatest = snapshot.includes(`,${latest}]`) || snapshot.includes(`[${latest},`);
      console.log(
        hasLatest
          ? `  snapshot ${src.snapshot} carries RVD's latest year (${latest})`
          : `  DRIFT — RVD now publishes ${latest}; ${src.snapshot} does not have it. Re-run scripts/gen-rvd-rents.py.`,
      );
      if (!hasLatest) failures += 1;
    }
  } catch (err) {
    console.log(`  FAILED — ${err instanceof Error ? err.message : String(err)}`);
    failures += 1;
  }
}

console.log("\n" + "=".repeat(78));
console.log("Known gaps in the official data — do not go looking again:\n");
for (const g of KNOWN_GAPS) console.log("  · " + g);

console.log("\nDeliberately not collected: Centaline, Midland, Squarefoot, 28Hse, House730,");
console.log("Spacious. Their terms prohibit it and two of them actively challenge bots. See the");
console.log("comment at the top of this file — licensing is the route, not a crawler.\n");

/*
 * The write, which did not exist: this script fetched, parsed, verified and then reported that
 * it *would* have stored something.
 *
 * Only the Census district profiles are written. The RVD series are already committed snapshots
 * that the app imports directly — putting them in the database too would create a second copy
 * that can disagree with the first, which is the failure this repository keeps finding.
 * The Census figures are the ones `/map` reads from `market_observations` and could not show.
 *
 * Upserted on the natural key, so re-running is free and never duplicates. `periodStart` is the
 * census date rather than today: the observation is *of* 2021, and stamping it with the day the
 * collector happened to run would make a decade-old figure look fresh.
 */
const DATABASE_URL = loadDatabaseUrl();

if (DATABASE_URL === undefined) {
  console.log("No DATABASE_URL in the environment, apps/web/.env.local or .env.local —");
  console.log("nothing was written.\n");
} else if (!WRITE) {
  console.log("Census district profiles are ready to write. Re-run with --write to store them.\n");
} else {
  const { CENSUS_DISTRICTS, CENSUS_SOURCE } = await import("../packages/fixtures/dist/index.js");
  /* `postgres` is a dependency of packages/db, not of the repository root, so a bare import
     does not resolve from here — the same pnpm isolation `check-links.mjs` works around for
     playwright, and resolved the same way. */
  const require_ = createRequire(join(ROOT, "packages", "db", "package.json"));
  const postgres = (await import(pathToFileURL(require_.resolve("postgres")).href)).default;
  const sql = postgres(DATABASE_URL, { max: 1, prepare: false, onnotice: () => {} });

  const { DEMO_DISTRICTS } = await import("../packages/fixtures/dist/index.js");

  const CENSUS_PERIOD = "2021-06-30";
  const CENSUS_CITATION =
    "Census and Statistics Department — 2021 Population Census, District Council district statistics";
  const FORECAST_CITATION =
    "Rating and Valuation Department — Completions and Forecast Completions by District (data.gov.hk)";
  const FORECAST_URL =
    "https://www.rvd.gov.hk/datagovhk/Dom_Completions_and_Forecast_Completions_by_District_Eng.csv";
  const rows = [];
  for (const d of CENSUS_DISTRICTS) {
    rows.push([d.districtId, "median_rent", CENSUS_PERIOD, d.medianMonthlyRentHkd, CENSUS_CITATION]);
    rows.push([d.districtId, "rent_to_income", CENSUS_PERIOD, d.rentToIncomeRatio, CENSUS_CITATION]);
    rows.push([d.districtId, "public_rental_share", CENSUS_PERIOD, d.publicRentalShare, CENSUS_CITATION]);
    rows.push([d.districtId, "households", CENSUS_PERIOD, d.households, CENSUS_CITATION]);
  }

  /*
   * Crossed with RVD's forecast completions — the second source, and the reason this is worth
   * doing at all. The Census says who lives in a district and what they pay; this says how many
   * new flats land there next year and the year after. Together they answer a question neither
   * can alone: whether the rent a district commands is about to meet more supply.
   *
   * Matched by name, not by position: the CSV's row order is RVD's and could change, while the
   * district names are stable and already carried in `DEMO_DISTRICTS`. An unmatched name is
   * counted and reported rather than silently dropped — a district quietly missing from a supply
   * table is exactly the kind of gap that looks like "no new supply".
   */
  const byName = new Map(DEMO_DISTRICTS.map((d) => [d.nameEn.toLowerCase(), d.id]));
  let unmatched = 0;

  /**
   * Walk one of RVD's by-district CSVs, handing each real district's cells to `onRow`.
   *
   * Extracted once a second and third by-district source arrived: the fetch, the two header
   * lines, the four aggregate rows and the name match are identical in all of them, and three
   * hand-copied versions is how one of them quietly stops skipping "OVERALL" and writes the
   * territory total into a district.
   *
   * Matched by name, not by row position: the file's order is RVD's and can change, while the
   * district names are stable and already carried in `DEMO_DISTRICTS`. A name that matches
   * neither a district nor a known aggregate is counted and reported rather than dropped — a
   * district silently missing from a supply table reads as "no new supply", which is the wrong
   * kind of wrong.
   */
  async function forEachDistrictRow(url, onRow) {
    const csv = await (await fetch(url)).text();
    const lines = csv.split(/\r?\n/).filter((l) => l.trim() !== "");
    const cols = (lines[1] ?? "").split(",").map((c) => c.trim());
    for (const line of lines.slice(2)) {
      const cells = line.split(",");
      const name = (cells[0] ?? "").trim();
      if (/^(hong kong|kowloon|new territories|overall)$/i.test(name)) continue;
      const id = byName.get(name.toLowerCase());
      if (id === undefined) { unmatched += 1; continue; }
      onRow(id, cells, cols);
    }
  }

  /**
   * RVD writes "-" for none. It is a real zero, not a missing value, and the distinction
   * matters: a district with no new supply next year is a fact worth storing, while a blank is
   * an absence of information. Anything else unparseable returns null and is skipped upstream.
   */
  const cell = (cells, idx) => {
    const raw = (cells[idx] ?? "").trim();
    if (raw === "-") return 0;
    const n = Number(raw.replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  };

  const CLASSES = ["A", "B", "C", "D", "E"];

  try {
    await forEachDistrictRow(FORECAST_URL, (id, cells, cols) => {
      for (const year of ["2025", "2026"]) {
        const idx = cols.findIndex((c) => new RegExp(`Forecast Completions in ${year}$`, "i").test(c));
        const v = idx < 0 ? null : cell(cells, idx);
        if (v !== null) rows.push([id, "forecast_completions_units", `${year}-01-01`, v, FORECAST_CITATION]);
      }
    });
  } catch (err) {
    console.log(`  forecast completions unavailable — ${err instanceof Error ? err.message : err}`);
  }

  /*
   * ── The three sources migration 0011 unblocked ──────────────────────────────────────────
   *
   * All class-split or otherwise unable to share a key with a figure already stored. Until
   * 0011 replaced the primary key with a unique index over `(district, metric, kind, period,
   * rvd_class)`, five Classes for one district and period collided, so the first two of these
   * were being downloaded and thrown away — the stock file has been fetched by this script for
   * weeks and only its total column kept.
   */

  const STOCK_BY_CLASS_URL =
    "https://www.rvd.gov.hk/datagovhk/Private_Dom_Stock_by_District_Eng.csv";
  const FORECAST_BY_CLASS_URL =
    "https://www.rvd.gov.hk/datagovhk/Dom_Forecast_Completions_by_Class_and_District_Eng.csv";
  const HOUSES_URL =
    "https://www.rvd.gov.hk/datagovhk/Dom_Stock_and_Completions_of_Houses_by_District_Eng.csv";
  const STOCK_CITATION =
    "Rating and Valuation Department — Private Domestic Stock by District (data.gov.hk)";
  const FORECAST_CLASS_CITATION =
    "Rating and Valuation Department — Forecast Completions by Class and District (data.gov.hk)";
  const HOUSES_CITATION =
    "Rating and Valuation Department — Stock and Completions of Houses by District (data.gov.hk)";

  /*
   * Stock per district PER CLASS. The all-classes total for the same district and period is
   * already stored with a null class and is left alone — the class rows sit beside it rather
   * than replacing it, which is exactly what `NULLS NOT DISTINCT` makes safe.
   *
   * The period is read from the header rather than assumed: the file says "Stock at 2024
   * year-end" and will say 2025 next year, and a hardcoded date would silently file next
   * year's figures under this year's.
   */
  try {
    let period = null;
    await forEachDistrictRow(STOCK_BY_CLASS_URL, (id, cells, cols) => {
      if (period === null) {
        const m = cols.join(" ").match(/Stock at (\d{4}) year-end/i);
        period = m === null ? null : `${m[1]}-01-01`;
      }
      if (period === null) return;
      for (const k of CLASSES) {
        const idx = cols.findIndex((c) => new RegExp(`Stock at \\d{4} year-end - Class ${k}$`, "i").test(c));
        const v = idx < 0 ? null : cell(cells, idx);
        if (v !== null) rows.push([id, "stock_units", period, v, STOCK_CITATION, k]);
      }
    });
    if (period === null) console.log("  stock by class — could not read the year from the header, skipped");
  } catch (err) {
    console.log(`  stock by class unavailable — ${err instanceof Error ? err.message : err}`);
  }

  /* Forward supply per district PER CLASS — the class breakdown of the figure already stored
     as a district total. "1,300 new Class A flats coming to Sha Tin" is a different, sharper
     statement than the same total spread across every size. */
  try {
    await forEachDistrictRow(FORECAST_BY_CLASS_URL, (id, cells, cols) => {
      for (const year of ["2025", "2026"]) {
        for (const k of CLASSES) {
          const idx = cols.findIndex((c) =>
            new RegExp(`Forecast Completions in ${year} - Class ${k}$`, "i").test(c),
          );
          const v = idx < 0 ? null : cell(cells, idx);
          if (v !== null) {
            rows.push([id, "forecast_completions_units", `${year}-01-01`, v, FORECAST_CLASS_CITATION, k]);
          }
        }
      }
    });
  } catch (err) {
    console.log(`  forecast by class unavailable — ${err instanceof Error ? err.message : err}`);
  }

  /* Houses, which are not flats. Own metrics rather than `stock_units`, because the flat count
     for the same district, kind and period already holds that key — reusing it would not merely
     be confusing, the two would overwrite each other. */
  try {
    await forEachDistrictRow(HOUSES_URL, (id, cells, cols) => {
      const stockIdx = cols.findIndex((c) => /^Stock at (\d{4}) year-end$/i.test(c) && /2024|2025|2026/.test(c));
      const compIdx = cols.findIndex((c) => /^Completions in \d{4}$/i.test(c));
      const stockYear = (cols[stockIdx] ?? "").match(/(\d{4})/);
      const compYear = (cols[compIdx] ?? "").match(/(\d{4})/);
      if (stockIdx >= 0 && stockYear !== null) {
        const v = cell(cells, stockIdx);
        if (v !== null) rows.push([id, "house_stock_units", `${stockYear[1]}-01-01`, v, HOUSES_CITATION]);
      }
      if (compIdx >= 0 && compYear !== null) {
        const v = cell(cells, compIdx);
        if (v !== null) rows.push([id, "house_completions_units", `${compYear[1]}-01-01`, v, HOUSES_CITATION]);
      }
    });
  } catch (err) {
    console.log(`  houses by district unavailable — ${err instanceof Error ? err.message : err}`);
  }

  console.log("Writing district observations — Census 2021 and RVD\n" + "=".repeat(78));
  try {
    let written = 0;
    /*
     * `rvdClass` is the sixth element and undefined for everything published for a whole
     * district — normalised to null, which is what "all classes" has always meant here.
     *
     * The conflict target must name `rvd_class` too, or a class row would try to displace the
     * all-classes total that shares its other four columns. `NULLS NOT DISTINCT` on the index
     * is what keeps the null case behaving exactly as it did before 0011: one row per district
     * and period, not many. Verified against the live table rather than assumed.
     */
    for (const [districtId, metric, periodStart, value, source, rvdClass] of rows) {
      if (value === undefined || value === null) continue;
      await sql`
        insert into market_observations (district_id, metric, kind, rvd_class, period_start, value, source)
        values (
          ${districtId}, ${metric}, 'domestic', ${rvdClass ?? null},
          ${periodStart}, ${value}, ${source}
        )
        on conflict (district_id, metric, kind, period_start, rvd_class)
        do update set value = excluded.value, source = excluded.source
      `;
      written += 1;
    }
    console.log(`  ok — ${written} observations upserted across ${CENSUS_DISTRICTS.length} districts`);
    if (unmatched > 0) {
      console.log(`  ${unmatched} row(s) carried a district name we could not match`);
    }
    const summary = await sql`
      select metric::text as metric,
             count(*)::int as total,
             count(rvd_class)::int as class_split
      from market_observations
      group by 1
      order by 1
    `;
    console.log("");
    for (const r of summary) {
      const split = r.class_split > 0 ? `  (${r.class_split} by class)` : "";
      console.log(`  ${r.metric.padEnd(30)} ${String(r.total).padStart(4)}${split}`);
    }
    const [{ n }] = await sql`select count(*)::int as n from market_observations`;
    console.log(`  ${"".padEnd(30)} ${String(n).padStart(4)}  total`);
  } catch (err) {
    failures += 1;
    console.log(`  FAILED — ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    await sql.end();
  }
  console.log("");
}

if (failures > 0) {
  console.log(`${failures} source(s) failed or drifted.`);
  if (CHECK) process.exit(1);
}
