/**
 * Load the CCI constituent estates into `estates`.
 *
 *     node scripts/ingest-estates.mjs            # fetch, resolve, report
 *     node scripts/ingest-estates.mjs --write    # and store
 *
 * ## Where this comes from, and why it is allowed
 *
 * Centaline Property Agency publishes on **data.gov.hk**, which settles an open question this
 * repository carried from 30/07/2026 to 06/09/2026: *"terms, cost and true granularity are NOT
 * yet verified — this is the single highest-value thing left to check."* Verified. The portal's
 * terms permit re-use for commercial and non-commercial purposes free of charge, on condition
 * of attribution to the Government and the relevant organisation.
 *
 *   https://data.gov.hk/en-data/dataset/centaline-centanetod-ccipropertyinfo
 *
 * **This is not their transaction database.** It is the 140-odd estates that constitute the
 * Centaline City Index — names in both languages, address, region, occupation years, building
 * count and developer. Reference data, licensed, and the layer this codebase has wanted since
 * the beginning: its own note on the hard problem reads *"a building polygon must be joined to
 * an estate name to an RVD class. Building names are the natural key, and they will be messy."*
 * Here they are, spelled the way the market spells them.
 *
 * ## The district is resolved, not guessed
 *
 * `estates.district_id` is NOT NULL and the source file carries a **region** — Hong Kong,
 * Kowloon, New Territories — which is three buckets where eighteen are needed. Deriving a
 * district by reading the address string would be inventing a resolution the file does not
 * have, which is the failure this project refuses everywhere else.
 *
 * So each address goes to the Government's own **Address Lookup Service**, the same service the
 * building picker already uses, and the district comes back from it. An estate ALS cannot place
 * is **reported and skipped**, never filed under a guess.
 *
 * One request per estate, paced. ALS is a free government service and this is ~140 lookups run
 * rarely; hammering it would be both rude and the fastest way to lose the access.
 */

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const WRITE = process.argv.includes("--write");

const SOURCE_URL = "http://hk.centanet.com/opendata/CCI%20Estate%20for%20Opendata.csv";
const CITATION =
  "Centaline Property Agency Limited — Property information of the CCI constituent estates (data.gov.hk)";

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  for (const rel of ["apps/web/.env.local", ".env.local"]) {
    try {
      const body = readFileSync(join(ROOT, rel), "utf8");
      const line = body.split("\n").find((l) => l.startsWith("DATABASE_URL="));
      if (line !== undefined) {
        return line.slice("DATABASE_URL=".length).trim().replace(/^["']|["']$/g, "");
      }
    } catch {
      /* not there — try the next */
    }
  }
  return undefined;
}

/** The file quotes every field and estate names contain no quotes; a small parser is enough. */
function parseCsv(text) {
  const rows = [];
  for (const line of text.replace(/^﻿/, "").split(/\r?\n/)) {
    if (line.trim() === "") continue;
    const cells = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { cur += '"'; i += 1; } else inQuotes = !inQuotes;
      } else if (ch === "," && !inQuotes) {
        cells.push(cur);
        cur = "";
      } else cur += ch;
    }
    cells.push(cur);
    rows.push(cells);
  }
  return rows;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

console.log("Centaline CCI constituent estates\n" + "=".repeat(78));
console.log(`  ${SOURCE_URL}`);

const csv = await (await fetch(SOURCE_URL)).text();
const rows = parseCsv(csv);
const header = rows[0].map((h) => h.trim());
const col = (name) => header.indexOf(name);
const iEn = col("e_estate");
const iZh = col("c_estate");
const iAddrEn = col("pe_addr");
const iRegion = col("scp_mkte");
const iFrom = col("min_opdate");
const iTo = col("max_opdate");
const iBuildings = col("blgcount");
const iDevEn = col("pe_dev");
if ([iEn, iZh, iAddrEn].some((i) => i < 0)) {
  console.log("  the file's columns have changed — expected e_estate, c_estate, pe_addr");
  process.exit(1);
}

const estates = rows.slice(1).map((r) => ({
  nameEn: (r[iEn] ?? "").trim(),
  nameZh: (r[iZh] ?? "").trim() || null,
  address: (r[iAddrEn] ?? "").trim(),
  region: (r[iRegion] ?? "").trim(),
  from: (r[iFrom] ?? "").trim(),
  to: (r[iTo] ?? "").trim(),
  buildings: Number((r[iBuildings] ?? "").trim()) || null,
  developer: (r[iDevEn] ?? "").trim() || null,
})).filter((e) => e.nameEn !== "" && e.address !== "");

console.log(`  parsed ${estates.length} estates`);
console.log(`  regions: ${[...new Set(estates.map((e) => e.region))].join(", ")}`);
const years = estates.map((e) => Number(e.from)).filter((n) => Number.isFinite(n) && n > 1900);
console.log(`  occupation years ${Math.min(...years)}–${Math.max(...years)}\n`);

// ── resolve each district against the Government's own service
const require = createRequire(join(ROOT, "packages", "api", "package.json"));
const { searchAddresses } = await import(
  pathToFileURL(join(ROOT, "packages", "api", "dist", "address-lookup.js")).href
);

console.log("Resolving districts against the Address Lookup Service");
console.log("-".repeat(78));
const resolved = [];
const unresolved = [];
for (const [i, e] of estates.entries()) {
  try {
    const matches = await searchAddresses(e.address, 3);
    const hit = matches[0];
    if (hit === undefined) unresolved.push({ ...e, why: "no ALS match" });
    else resolved.push({ ...e, districtId: hit.districtId, alsDistrict: hit.districtNameAls });
  } catch (err) {
    unresolved.push({ ...e, why: err instanceof Error ? err.message : String(err) });
  }
  if ((i + 1) % 25 === 0) console.log(`  ${i + 1}/${estates.length}…`);
  await sleep(120); // polite pacing on a free government service
}

console.log(`\n  resolved   ${resolved.length}`);
console.log(`  unresolved ${unresolved.length}`);
for (const u of unresolved.slice(0, 10)) console.log(`    · ${u.nameEn} — ${u.why}`);

const byDistrict = new Map();
for (const e of resolved) byDistrict.set(e.districtId, (byDistrict.get(e.districtId) ?? 0) + 1);
console.log(
  "\n  " +
    [...byDistrict.entries()].sort((a, b) => b[1] - a[1]).map(([d, n]) => `${d}:${n}`).join("  "),
);

if (!WRITE) {
  console.log("\nNothing written. Re-run with --write to store them.\n");
  process.exit(0);
}

const url = loadDatabaseUrl();
if (url === undefined) {
  console.log("\nNo DATABASE_URL found — nothing written.\n");
  process.exit(1);
}
/* `postgres` is a dependency of `packages/db`, not of `packages/api` — pnpm keeps each
   package's node_modules to itself, so resolving it against the api package fails. The same
   trap `ingest-official.mjs` and `db-query.mjs` already work around. */
const dbRequire = createRequire(join(ROOT, "packages", "db", "package.json"));
const postgres = (await import(pathToFileURL(dbRequire.resolve("postgres")).href)).default;
const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} });

console.log("\nWriting\n" + "=".repeat(78));
let written = 0;
try {
  for (const e of resolved) {
    /*
     * Upserted on the table's own natural key, (district_id, name_en), so a re-run is free.
     *
     * `name_confidence` is 1: the English name is the index owner's own spelling and the
     * district came from the Government's address service, so neither half is a guess. It is
     * left below 1 only for names this project has had to reconcile itself.
     */
    await sql`
      insert into estates (district_id, name_en, name_zh, name_confidence)
      values (${e.districtId}, ${e.nameEn}, ${e.nameZh}, 1)
      on conflict (district_id, name_en)
      do update set name_zh = excluded.name_zh, name_confidence = excluded.name_confidence
    `;
    written += 1;
  }
  const [{ n }] = await sql`select count(*)::int as n from estates`;
  console.log(`  ok — ${written} upserted, ${n} estates in the table`);
  console.log(`  attribution required by the licence: ${CITATION}`);
} catch (err) {
  console.log(`  FAILED — ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
} finally {
  await sql.end();
}
console.log("");
