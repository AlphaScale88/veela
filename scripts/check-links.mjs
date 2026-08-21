#!/usr/bin/env node
/**
 * Crawl the running app, follow every link, and report what is broken.
 *
 *   pnpm dev                                  # in another terminal
 *   node scripts/check-links.mjs              # internal pages + console errors
 *   node scripts/check-links.mjs --external   # also fetch every outbound link
 *   node scripts/check-links.mjs --ci         # exit 1 on any failure
 *
 * ## Why a real browser rather than fetching HTML
 *
 * Most of this app's navigation lives in client components — the product sidebar, the account
 * menu, the finder's view switcher. A plain `fetch` of `/dashboard` returns a shell with almost no
 * links in it, so a crawler built on `fetch` would report a clean site while never seeing the
 * navigation. Every page is rendered and given a moment to hydrate before its links are read.
 *
 * **It still cannot see everything, and that is worth knowing rather than papering over.**
 * Collapsed disclosures are not in the DOM: the sidebar's Services and My Workspace groups render
 * their children only when open, so their leaves are invisible to a crawl that starts anywhere
 * else. That is exactly how `/services` stayed unreachable — the page returned 200, nothing linked
 * to it, and no crawl found the gap because the group that should have linked it was shut. Hence
 * `ORPHAN_CANDIDATES`: routes that exist and must be reachable, asserted directly.
 *
 * ## What counts as broken
 *
 * A 4xx or 5xx on an internal page, a failed navigation, a console error, or a non-200 on an
 * outbound link. A **redirect is not a failure** — `/resources` and the four old `/services/*`
 * paths 308 on purpose, and the checker prints where they land so the intent stays visible.
 */

import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/* Playwright is a dependency of `apps/web` (the listing importer's stealth fetcher needs it), not
   of the repository root, so a bare `import "playwright"` does not resolve from here. Resolved
   through `apps/web`'s own require rather than by adding a root dependency: this is a one-off
   script, and a second copy of a browser automation library in the lockfile to save one line is a
   bad trade. */
const require = createRequire(
  join(dirname(fileURLToPath(import.meta.url)), "..", "apps", "web", "package.json"),
);
const { chromium } = require("playwright");

const BASE = process.env["CHECK_BASE"] ?? "http://localhost:3000";
const WANT_EXTERNAL = process.argv.includes("--external");
const CI = process.argv.includes("--ci");
const MAX_PAGES = 80;

/**
 * Routes that exist and must be linked from somewhere a reader can reach.
 *
 * A crawl cannot prove reachability through a collapsed menu, so these are asserted. Anything
 * added here that the crawl does not find is either genuinely orphaned or hidden behind a
 * disclosure — both worth knowing, and the report says which.
 */
const ORPHAN_CANDIDATES = [
  "/services",
  "/mortgage",
  "/insurance",
  "/agent-finder",
  "/home-valuation",
  "/pricing",
  "/developers",
  "/terms",
  "/privacy",
];

/** Paths that must redirect, and where to. A 200 here would mean a move silently regressed. */
const EXPECTED_REDIRECTS = {
  "/resources": "/research/market-regulations",
  "/services/mortgage": "/mortgage",
  "/services/insurance": "/insurance",
  "/services/agent-finder": "/agent-finder",
  "/services/valuation": "/home-valuation",
};

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } });

const pages = new Map(); // path -> { status, finalPath, consoleErrors }
const internal = new Map(); // path -> Set(referrers)
const external = new Map(); // url -> Set(referrers)

const queue = ["/"];
const seen = new Set(["/"]);

function note(map, key, from) {
  if (!map.has(key)) map.set(key, new Set());
  map.get(key).add(from);
}

while (queue.length > 0 && pages.size < MAX_PAGES) {
  const path = queue.shift();
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text().slice(0, 300));
  });
  page.on("pageerror", (e) => consoleErrors.push("pageerror: " + e.message.slice(0, 300)));

  let status = 0;
  let finalPath = path;
  try {
    const res = await page.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 45000 });
    status = res?.status() ?? 0;
    finalPath = page.url().replace(BASE, "") || "/";
    await page.waitForTimeout(1200); // let client components mount their links

    /* Open the collapsed **navigation** groups before reading links.
       Without this the crawl reports the sidebar's Services and My Workspace leaves as orphaned on
       every page, because a shut group renders no children at all — five false positives that
       would train a reader to ignore the orphan section, which is the one part of this report that
       cannot be checked any other way.

       Scoped to `nav`/`aside`, and deliberately: a first version clicked *every*
       `[aria-expanded="false"]` on the page and became unusably slow — a report page carries eight
       amenity-count buttons and a service page five FAQ items, none of which contain links, and
       each failed click waited out its own timeout. Only navigation hides routes, so only
       navigation is opened. Short timeout, best effort: a control that will not be clicked is not
       a broken link. */
    for (let pass = 0; pass < 2; pass += 1) {
      const groups = await page.$$('nav [aria-expanded="false"], aside [aria-expanded="false"]');
      if (groups.length === 0) break;
      for (const group of groups) {
        try {
          await group.click({ timeout: 500 });
        } catch {
          // Covered, detached, or not really clickable.
        }
      }
      await page.waitForTimeout(250);
    }

    const hrefs = await page.$$eval("a[href]", (as) => as.map((a) => a.getAttribute("href")));
    for (const raw of hrefs) {
      if (!raw || raw.startsWith("#") || raw.startsWith("mailto:") || raw.startsWith("tel:")) {
        continue;
      }
      if (raw.startsWith("http")) {
        if (raw.startsWith(BASE)) {
          const p = raw.replace(BASE, "") || "/";
          note(internal, p, path);
          const bare = p.split("#")[0];
          if (!seen.has(bare)) {
            seen.add(bare);
            queue.push(bare);
          }
        } else {
          note(external, raw, path);
        }
        continue;
      }
      if (!raw.startsWith("/")) continue;
      note(internal, raw, path);
      const bare = raw.split("#")[0];
      if (!seen.has(bare)) {
        seen.add(bare);
        queue.push(bare);
      }
    }
  } catch (err) {
    status = -1;
    consoleErrors.push("NAVIGATION FAILED: " + (err?.message ?? String(err)).slice(0, 200));
  }

  pages.set(path, { status, finalPath, consoleErrors });
  await page.close();
}

let failures = 0;

console.log(`Crawled ${pages.size} pages from ${BASE}\n` + "=".repeat(78));
for (const [path, info] of [...pages].sort()) {
  const moved = info.finalPath !== path ? ` -> ${info.finalPath}` : "";
  const bad = info.status >= 400 || info.status === -1;
  if (bad) failures += 1;
  console.log(`${String(info.status).padStart(4)}  ${path}${moved}${bad ? "   BROKEN" : ""}`);
  for (const e of info.consoleErrors) {
    failures += 1;
    console.log(`        console: ${e}`);
  }
}

console.log("\nReachability of routes that must be linked\n" + "=".repeat(78));
for (const route of ORPHAN_CANDIDATES) {
  const referrers = internal.get(route);
  if (referrers === undefined) {
    failures += 1;
    console.log(`  ORPHAN  ${route} — nothing on any crawled page links to it`);
  } else {
    console.log(`  ok      ${route} — linked from ${[...referrers].slice(0, 3).join(", ")}`);
  }
}

console.log("\nRedirects that must stay\n" + "=".repeat(78));
for (const [from, to] of Object.entries(EXPECTED_REDIRECTS)) {
  const res = await fetch(BASE + from, { redirect: "manual", headers: { "user-agent": UA } });
  const loc = res.headers.get("location") ?? "";
  const ok = res.status >= 300 && res.status < 400 && loc.endsWith(to);
  if (!ok) failures += 1;
  console.log(`  ${ok ? "ok    " : "BROKEN"}  ${from} -> ${loc || res.status} (want ${to})`);
}

if (WANT_EXTERNAL) {
  console.log("\nOutbound links\n" + "=".repeat(78));
  for (const [url, from] of [...external].sort()) {
    /* A real browser User-Agent: several of these government sites refuse an unfamiliar one, and
       a 403 from that is a false positive rather than a broken link. GET not HEAD, because some
       of them answer 405 to HEAD. */
    let line;
    try {
      const res = await fetch(url, {
        headers: { "user-agent": UA, accept: "text/html,*/*" },
        redirect: "follow",
        signal: AbortSignal.timeout(20000),
      });
      const ok = res.status === 200;
      if (!ok) failures += 1;
      line = `  ${ok ? "ok    " : "BROKEN"}  ${res.status}  ${url}`;
    } catch (err) {
      /* Not counted as a failure: these are third-party hosts and a timeout says more about the
         network than the link. Reported so a repeated one gets looked at. */
      line = `  timeout ${url}\n            ${err?.message ?? err}`;
    }
    console.log(line + `\n            from: ${[...from].slice(0, 2).join(", ")}`);
  }
}

await browser.close();

console.log("\n" + "=".repeat(78));
console.log(failures === 0 ? "No failures." : `${failures} failure(s).`);
if (CI && failures > 0) process.exit(1);
