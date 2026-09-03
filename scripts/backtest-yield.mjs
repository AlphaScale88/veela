/**
 * Backtest the yields this product shows, against RVD's own measurements.
 *
 *     node scripts/backtest-yield.mjs
 *
 * Four checks, in order of what they can prove:
 *
 *   A. **Our parse.** `rvd-rents.ts` is generated from `1.1A(from_99).csv`. Re-read the source
 *      and compare. A generator that silently drifts from its source is the failure mode this
 *      repository has already hit twice with `dist/`.
 *
 *   B. **RVD's internal consistency, and our reading of it.** RVD publishes average prices,
 *      average rents and gross yields as three separate files. They are bound by an identity:
 *
 *          gross yield = (monthly rent per m² × 12) ÷ (price per m²)
 *
 *      Prices and rents are published by Class **and region**; the yield only by Class. So the
 *      published figure should sit inside the range the three regions imply. If it does, three
 *      independent parses agree on an arithmetic identity and all three are probably right.
 *
 *   C. **`estimateMonthlyRent`.** It turns a price and an area into a rent using the
 *      territory-wide yield for that Class. Prices and rents differ by region, so the estimate
 *      must be wrong by region — the question is by how much, and the answer belongs on screen
 *      next to the estimate rather than in a comment.
 *
 *   D. **The gross-to-net gap, through the real engine.** `computeVerdict` on RVD's measured
 *      average price and measured average rent, rather than on figures somebody typed. This is
 *      the product's headline claim — an agent quotes gross, we show what you keep — tested
 *      rather than asserted.
 *
 * Nothing here is fabricated: every input is an RVD published figure, and the one judgement
 * call (a representative flat area per Class) is stated and cancels out of every yield.
 */

import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const CACHE = join(ROOT, ".cache");
if (!existsSync(CACHE)) mkdirSync(CACHE, { recursive: true });

const require = createRequire(join(ROOT, "packages", "core", "package.json"));
const core = await import(pathToFileURL(join(ROOT, "packages", "core", "dist", "index.js")).href);
const fixtures = await import(
  pathToFileURL(join(ROOT, "packages", "fixtures", "dist", "index.js")).href
);
const { computeVerdict, money, HK_RULE_SETS } = core;

const SOURCES = {
  prices: ["https://www.rvd.gov.hk/datagovhk/1.2A(from_99).csv", "bt_avg_prices.csv"],
  rents: ["https://www.rvd.gov.hk/datagovhk/1.1A(from_99).csv", "bt_avg_rents.csv"],
  yields: ["https://www.rvd.gov.hk/datagovhk/5.1A.csv", "bt_yields.csv"],
};

async function load(key) {
  const [url, name] = SOURCES[key];
  const path = join(CACHE, name);
  if (!existsSync(path)) {
    const res = await fetch(url);
    const { writeFileSync } = await import("node:fs");
    writeFileSync(path, Buffer.from(await res.arrayBuffer()));
  }
  return readFileSync(path, "utf8")
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .filter((l) => l.trim() !== "")
    .map((l) => l.split(","));
}

const CLASSES = ["A", "B", "C", "D", "E"];
const REGIONS = ["Hong Kong", "Kowloon", "New Territories"];

/** RVD leaves a cell blank or "-" when it published nothing. Null, never zero. */
const num = (s) => {
  const v = (s ?? "").trim();
  if (v === "" || v === "-" || /^n\.?a\.?$/i.test(v)) return null;
  const n = Number(v.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
};

/** {year: {"A|Hong Kong": value}} for a Class × region file. */
function byClassRegion(rows) {
  const header = rows[1].map((h) => h.trim());
  const cols = {};
  for (const k of CLASSES) {
    for (const r of REGIONS) {
      const i = header.indexOf(`Class ${k} ${r}`);
      if (i >= 0) cols[`${k}|${r}`] = i;
    }
  }
  const out = {};
  for (const row of rows.slice(2)) {
    const year = (row[0] ?? "").trim();
    if (!/^\d{4}$/.test(year)) continue;
    out[year] = {};
    for (const [key, i] of Object.entries(cols)) out[year][key] = num(row[i]);
  }
  return out;
}

/** {year: {A: pct}} for the Class-only yield file. */
function byClass(rows) {
  const header = rows[1].map((h) => h.trim());
  const cols = {};
  for (const k of CLASSES) {
    const i = header.indexOf(`Domestic Class ${k}`);
    if (i >= 0) cols[k] = i;
  }
  const out = {};
  for (const row of rows.slice(2)) {
    const year = (row[0] ?? "").trim();
    if (!/^\d{4}$/.test(year)) continue;
    out[year] = {};
    for (const [k, i] of Object.entries(cols)) out[year][k] = num(row[i]);
  }
  return out;
}

const prices = byClassRegion(await load("prices"));
const rents = byClassRegion(await load("rents"));
const yields = byClass(await load("yields"));
const years = Object.keys(yields).filter((y) => y in prices && y in rents).sort();
const LATEST = years[years.length - 1];

const rule = (t) => console.log(`\n${t}\n${"=".repeat(78)}`);
const pct = (v, d = 2) => (v === null ? "   —  " : `${v.toFixed(d)}%`);

// ─────────────────────────────────────────────────────────────────────────────
rule("A. Does the committed fixture still match its source?");
// ─────────────────────────────────────────────────────────────────────────────
{
  const fx = fixtures.RVD_AVG_RENT_PER_SQM;
  const fxYears = fixtures.RVD_RENT_YEARS;
  const REGION_KEY = { hongKong: "Hong Kong", kowloon: "Kowloon", newTerritories: "New Territories" };
  let checked = 0;
  const bad = [];
  for (const k of CLASSES) {
    for (const [fxRegion, csvRegion] of Object.entries(REGION_KEY)) {
      const series = fx[k]?.[fxRegion];
      if (!Array.isArray(series)) { bad.push(`${k}|${fxRegion}: missing from the fixture`); continue; }
      for (let i = 0; i < fxYears.length; i += 1) {
        const y = String(fxYears[i]);
        const mine = series[i] ?? null;
        const theirs = (rents[y] ?? {})[`${k}|${csvRegion}`];
        if (theirs === undefined) continue;
        checked += 1;
        if (mine === null && theirs === null) continue;
        if (mine === null || theirs === null || Math.abs(mine - theirs) > 0.51) {
          bad.push(`Class ${k} ${csvRegion} ${y}: fixture ${mine} vs source ${theirs}`);
        }
      }
    }
  }
  console.log(`  ${checked} fixture cells compared against the live CSV`);
  if (bad.length === 0) console.log("  ok — the generated module still matches what RVD serves");
  else {
    console.log(`  ${bad.length} MISMATCH(ES):`);
    for (const b of bad.slice(0, 8)) console.log(`    ${b}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
rule(`B. Does RVD's published gross yield follow from its own prices and rents? (${LATEST})`);
// ─────────────────────────────────────────────────────────────────────────────
console.log("   derived = rent per m²/month × 12 ÷ price per m². Published is territory-wide,");
console.log("   so it should sit inside the spread the three regions imply.\n");
console.log(`   ${"Class".padEnd(8)}${"HK Island".padStart(11)}${"Kowloon".padStart(11)}${"N.T.".padStart(11)}${"published".padStart(12)}   verdict`);
let insideCount = 0;
let testedCount = 0;
for (const k of CLASSES) {
  const derived = REGIONS.map((r) => {
    const p = prices[LATEST][`${k}|${r}`];
    const rt = rents[LATEST][`${k}|${r}`];
    return p && rt ? (rt * 12) / p * 100 : null;
  });
  const pub = yields[LATEST][k];
  const real = derived.filter((d) => d !== null);
  let verdict = "no data";
  if (pub !== null && real.length > 0) {
    testedCount += 1;
    const lo = Math.min(...real);
    const hi = Math.max(...real);
    const inside = pub >= lo - 0.05 && pub <= hi + 0.05;
    if (inside) insideCount += 1;
    verdict = inside ? `inside [${lo.toFixed(2)}, ${hi.toFixed(2)}]` : `OUTSIDE [${lo.toFixed(2)}, ${hi.toFixed(2)}]`;
  }
  console.log(
    `   ${("Class " + k).padEnd(8)}${pct(derived[0]).padStart(11)}${pct(derived[1]).padStart(11)}${pct(derived[2]).padStart(11)}${pct(pub, 1).padStart(12)}   ${verdict}`,
  );
}
console.log(`\n   ${insideCount}/${testedCount} classes consistent.`);

// across every year, how often does the identity hold?
{
  let inside = 0, tested = 0;
  for (const y of years) {
    for (const k of CLASSES) {
      const pub = yields[y][k];
      if (pub === null) continue;
      const real = REGIONS.map((r) => {
        const p = prices[y][`${k}|${r}`];
        const rt = rents[y][`${k}|${r}`];
        return p && rt ? (rt * 12) / p * 100 : null;
      }).filter((d) => d !== null);
      if (real.length === 0) continue;
      tested += 1;
      if (pub >= Math.min(...real) - 0.05 && pub <= Math.max(...real) + 0.05) inside += 1;
    }
  }
  console.log(`   Across ${years[0]}–${LATEST}: ${inside}/${tested} class-years consistent (${((inside / tested) * 100).toFixed(0)}%).`);
}

// ─────────────────────────────────────────────────────────────────────────────
rule("C. How wrong is estimateMonthlyRent, by region?");
// ─────────────────────────────────────────────────────────────────────────────
console.log("   It applies the territory-wide Class yield to any flat. Prices and rents differ");
console.log("   by region, so the error is structural. Measured against RVD's own average rent");
console.log(`   for the same Class and region, at ${LATEST}.\n`);
/* Areas are Class midpoints. They cancel out of a yield, and matter only for the absolute
   rent figures below — stated rather than hidden because they are the one chosen input. */
const AREA_M2 = { A: 30, B: 55, C: 85, D: 130, E: 200 };
const SQFT = 10.7639;
console.log(`   ${"Class".padEnd(8)}${"region".padEnd(17)}${"actual rent".padStart(13)}${"estimated".padStart(12)}${"error".padStart(10)}`);
const errors = [];
for (const k of CLASSES) {
  for (const r of REGIONS) {
    const pricePerM2 = prices[LATEST][`${k}|${r}`];
    const rentPerM2 = rents[LATEST][`${k}|${r}`];
    if (!pricePerM2 || !rentPerM2) continue;
    const areaM2 = AREA_M2[k];
    const totalPrice = pricePerM2 * areaM2;
    const actualRent = rentPerM2 * areaM2;
    const est = fixtures.estimateMonthlyRent(totalPrice, areaM2 * SQFT);
    if (est === null) continue;
    const err = (est.monthlyRentHkd - actualRent) / actualRent;
    errors.push({ k, r, err });
    console.log(
      `   ${("Class " + k).padEnd(8)}${r.padEnd(17)}${Math.round(actualRent).toLocaleString("en-HK").padStart(13)}${est.monthlyRentHkd.toLocaleString("en-HK").padStart(12)}${((err * 100).toFixed(1) + "%").padStart(10)}`,
    );
  }
}
{
  const abs = errors.map((e) => Math.abs(e.err));
  const worst = errors.reduce((a, b) => (Math.abs(b.err) > Math.abs(a.err) ? b : a));
  console.log(`\n   mean absolute error ${((abs.reduce((a, b) => a + b, 0) / abs.length) * 100).toFixed(1)}%`);
  console.log(`   worst: Class ${worst.k} ${worst.r}, ${(worst.err * 100).toFixed(1)}%`);
  console.log(`   direction: ${errors.filter((e) => e.err < 0).length}/${errors.length} are UNDER-estimates`);

  /*
   * One year could be an accident. The method is identical in every year — apply that year's
   * published Class yield to that year's average price, compare with that year's average rent
   * — so running it over the whole series says whether this is a bias or a wobble.
   */
  const perYear = [];
  for (const y of years) {
    const errs = [];
    for (const k of CLASSES) {
      const yld = yields[y][k];
      if (yld === null) continue;
      for (const r of REGIONS) {
        const p = prices[y][`${k}|${r}`];
        const rt = rents[y][`${k}|${r}`];
        if (!p || !rt) continue;
        // implied rent = price × yield ÷ 12, exactly what estimateMonthlyRent computes
        errs.push(((p * (yld / 100)) / 12 - rt) / rt);
      }
    }
    if (errs.length === 0) continue;
    perYear.push({ y, mean: errs.reduce((a, b) => a + b, 0) / errs.length });
  }
  const under = perYear.filter((p) => p.mean < 0).length;
  const overall = perYear.reduce((a, b) => a + b.mean, 0) / perYear.length;
  const best = perYear.reduce((a, b) => (b.mean > a.mean ? b : a));
  const wrst = perYear.reduce((a, b) => (b.mean < a.mean ? b : a));
  console.log(`\n   Across ${years[0]}-${LATEST}: the mean signed error was negative in ${under}/${perYear.length} years.`);
  console.log(`   Mean over the whole series ${(overall * 100).toFixed(1)}%; best year ${best.y} ${(best.mean * 100).toFixed(1)}%, worst ${wrst.y} ${(wrst.mean * 100).toFixed(1)}%.`);
  console.log("\n   An error in one direction in nearly every year is a methodology difference,");
  console.log("   not noise: the published yield is demonstrably NOT the ratio of RVD's own");
  console.log("   average rent to its own average price, so a rent derived from that yield is");
  console.log("   not the rent RVD measures.");
  console.log("   WHY is not established here. The plausible reading is that rents and prices");
  console.log("   are measured over different samples -- let stock against sold stock -- but");
  console.log("   RVD's technical notes could not be read (the PDF is font-encoded) and no");
  console.log("   source stating the method was found. The measurement is settled; the");
  console.log("   explanation is a hypothesis and is labelled as one wherever it is repeated.");
}

// ─────────────────────────────────────────────────────────────────────────────
rule("D. Gross to net, through the real engine, on measured inputs");
// ─────────────────────────────────────────────────────────────────────────────
console.log("   computeVerdict on RVD's own average price and average rent — not typed figures.");
console.log("   Cash purchase, permanent resident, first property, today's rules.\n");

const SCENARIOS = [
  {
    name: "app defaults",
    note: "what the form ships with: 4% vacancy, owner pays rates, and every cost field blank",
    costs: (rentMonthly, areaSqft) => ({
      ownerPaysRates: true,
      vacancyRate: 0.04,
    }),
  },
  {
    name: "realistic costs",
    note: "adds a management fee at HK$3.50/sqft/month, 1% agency, HK$15k legal, HK$8k repairs",
    costs: (rentMonthly, areaSqft, price) => ({
      ownerPaysRates: true,
      vacancyRate: 0.04,
      monthlyManagementFee: money(Math.round(areaSqft * 3.5), "HKD"),
      agencyFee: money(Math.round(price * 0.01), "HKD"),
      legalFees: money(15000, "HKD"),
      annualOtherCosts: money(8000, "HKD"),
    }),
  },
];

for (const scenario of SCENARIOS) {
  console.log(`   ── ${scenario.name} — ${scenario.note}`);
  console.log(`   ${"Class".padEnd(8)}${"price".padStart(14)}${"rent/mo".padStart(11)}${"gross".padStart(9)}${"net".padStart(9)}${"gap".padStart(9)}${"RVD gross".padStart(11)}`);
  for (const k of CLASSES) {
    // Territory figure: average the three regions weighted equally is wrong; use HK Island,
    // Kowloon and NT separately would triple the table. Kowloon is the middle market and is
    // used as the single representative region, named here rather than implied.
    const pricePerM2 = prices[LATEST][`${k}|Kowloon`];
    const rentPerM2 = rents[LATEST][`${k}|Kowloon`];
    if (!pricePerM2 || !rentPerM2) { console.log(`   ${("Class " + k).padEnd(8)}   (RVD published nothing for Kowloon this year)`); continue; }
    const areaM2 = AREA_M2[k];
    const areaSqft = Math.round(areaM2 * SQFT);
    const price = Math.round(pricePerM2 * areaM2);
    const rentMonthly = Math.round(rentPerM2 * areaM2);

    const verdict = computeVerdict({
      currency: "HKD",
      price: money(price, "HKD"),
      monthlyRent: money(rentMonthly, "HKD"),
      saleableAreaSqft: areaSqft,
      transactionDate: `${LATEST}-06-30`,
      buyer: { isPermanentResident: true, ownsOtherResidentialProperty: false, purchasingViaCompany: false },
      costs: scenario.costs(rentMonthly, areaSqft, price),
    }, HK_RULE_SETS);
    const g = verdict.returns.grossYield;
    const n = verdict.returns.netYield;
    console.log(
      `   ${("Class " + k).padEnd(8)}${price.toLocaleString("en-HK").padStart(14)}${rentMonthly.toLocaleString("en-HK").padStart(11)}${pct(g * 100).padStart(9)}${pct(n * 100).padStart(9)}${(((g - n) * 100).toFixed(2) + "pt").padStart(9)}${pct(yields[LATEST][k], 1).padStart(11)}`,
    );
  }
  console.log("");
}

// ─────────────────────────────────────────────────────────────────────────────
rule("E. Do the published yields at least MOVE with the published indices?");
// ─────────────────────────────────────────────────────────────────────────────
console.log("   A different question from B, and a fairer one. B asked whether the yield equals");
console.log("   rent ÷ price in levels. This asks whether it moves with them. If RVD measures");
console.log("   yield on a different sample the level can differ while the direction agrees,");
console.log("   and for a chart of a trend, direction is what is being claimed.");
console.log("");
{
  /* Annual means of the monthly by-Class indices already committed in @veela/fixtures. */
  const periods = fixtures.RVD_CLASS_INDEX_PERIODS;
  const annual = (series) => {
    const acc = {};
    for (let i = 0; i < series.length; i += 1) {
      const v = series[i];
      if (v === null || v === undefined) continue;
      const y = periods[i].slice(0, 4);
      (acc[y] ??= []).push(v);
    }
    return Object.fromEntries(
      Object.entries(acc).map(([y, xs]) => [y, xs.reduce((a, b) => a + b, 0) / xs.length]),
    );
  };
  console.log(`   ${"Class".padEnd(8)}${"corr(published yield, rent index / price index)".padStart(48)}${"years".padStart(8)}`);
  for (const k of CLASSES) {
    const pi = annual(fixtures.RVD_PRICE_INDEX_BY_CLASS[k]);
    const ri = annual(fixtures.RVD_RENT_INDEX_BY_CLASS[k]);
    const xs = [];
    const ys = [];
    for (const y of years) {
      const pub = yields[y][k];
      if (pub === null || pi[y] === undefined || ri[y] === undefined) continue;
      xs.push(ri[y] / pi[y]);
      ys.push(pub);
    }
    if (xs.length < 5) {
      console.log(`   ${("Class " + k).padEnd(8)}${"(too few years)".padStart(48)}`);
      continue;
    }
    const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
    const my = ys.reduce((a, b) => a + b, 0) / ys.length;
    let sxy = 0;
    let sxx = 0;
    let syy = 0;
    for (let i = 0; i < xs.length; i += 1) {
      sxy += (xs[i] - mx) * (ys[i] - my);
      sxx += (xs[i] - mx) ** 2;
      syy += (ys[i] - my) ** 2;
    }
    console.log(
      `   ${("Class " + k).padEnd(8)}${(sxy / Math.sqrt(sxx * syy)).toFixed(4).padStart(48)}${String(xs.length).padStart(8)}`,
    );
  }
  console.log("");
  console.log("   A correlation near 1 means the published yield and the index ratio tell the");
  console.log("   same story about direction whatever their levels. That is what licenses");
  console.log("   showing the yield series as a trend. It is NOT what licenses deriving a rent");
  console.log("   from it, which is a question about levels — test C answers that separately.");
}

console.log("");
console.log("=".repeat(78));
console.log("Note on comparability: the engine's gross yield is annual rent ÷ price, which is");
console.log("RVD's own definition. Its NET yield divides by cash-to-acquire — price plus stamp");
console.log("duty, agency and legal — so the gap above is not only operating costs. That is");
console.log("deliberate and it means the net is not on the same denominator as the gross.");
