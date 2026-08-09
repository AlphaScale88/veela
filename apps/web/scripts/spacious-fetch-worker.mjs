#!/usr/bin/env node
// Runs Playwright's stealth-patched Chromium against spacious.hk, outside Next's webpack
// bundle entirely. Playwright's own internals (a package.json read by real filesystem
// path, an optional BiDi module reached via a dynamic require()) don't survive being
// bundled — both are ordinary Node module resolution that webpack's static analysis
// can't reproduce. Running as a plain `node` subprocess sidesteps that: this file is
// never imported by anything Next compiles, so webpack never sees it, and Node resolves
// `playwright` for real, from this file's own node_modules.
//
// Invoked by spacious-stealth-fetch.ts via child_process.execFile — see that file for
// why this path exists at all (spacious.hk's Cloudflare challenge, and the decision to
// go around it, made explicitly rather than added quietly).
//
// Protocol: argv[2] is the URL. Prints one JSON line to stdout and exits 0 on success —
// `{ok: true, html, finalUrl}` — or exits 1 with `{ok: false, errorType, message}` on
// failure. errorType is "UnsafeUrlError" (bad/disallowed URL) or "FetchFailedError"
// (reachable but couldn't get a usable page) so the parent can raise the same error
// classes fetchHtmlSafely already uses for every other site.

import { chromium } from "playwright";

const ALLOWED_HOSTS = new Set(["spacious.hk", "www.spacious.hk"]);
const NAV_TIMEOUT_MS = 30_000;
const CHALLENGE_POLL_MS = 2_000;
const CHALLENGE_MAX_POLLS = 8;
const CHALLENGE_TITLE_RE = /security verification|just a moment|attention required|checking your browser/i;

// The evasions Cloudflare's Managed Challenge actually checks: a bare Playwright browser
// leaves `navigator.webdriver === true` and a few other tells default browsers don't
// have. Verified against a real spacious.hk listing with exactly this patch set — no
// more, no less; it passed on the first attempt.
const STEALTH_INIT_SCRIPT = `
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
  Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
  window.chrome = { runtime: {} };
`;

const DESKTOP_CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

function fail(errorType, message) {
  process.stdout.write(JSON.stringify({ ok: false, errorType, message }));
  process.exit(1);
}

function parseAllowedSpaciousUrl(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    return { error: "Not a valid URL" };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { error: `Unsupported scheme: ${url.protocol}` };
  }
  if (!ALLOWED_HOSTS.has(url.hostname.toLowerCase())) {
    return { error: `This fetcher only handles spacious.hk, not ${url.hostname}` };
  }
  return { url };
}

async function main() {
  const rawUrl = process.argv[2];
  if (rawUrl === undefined) return fail("UnsafeUrlError", "No URL given");

  const parsed = parseAllowedSpaciousUrl(rawUrl);
  if (parsed.error !== undefined) return fail("UnsafeUrlError", parsed.error);

  const browser = await chromium.launch({
    args: ["--disable-blink-features=AutomationControlled", "--no-sandbox", "--disable-dev-shm-usage"],
  });

  try {
    const context = await browser.newContext({
      userAgent: DESKTOP_CHROME_UA,
      viewport: { width: 1366, height: 768 },
      locale: "en-US",
      timezoneId: "Asia/Hong_Kong",
    });
    await context.addInitScript(STEALTH_INIT_SCRIPT);
    const page = await context.newPage();

    try {
      await page.goto(parsed.url.toString(), { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS });
    } catch (cause) {
      return fail("FetchFailedError", `Couldn't reach spacious.hk: ${cause instanceof Error ? cause.message : String(cause)}`);
    }

    for (let poll = 0; poll < CHALLENGE_MAX_POLLS; poll += 1) {
      const title = await page.title();
      if (!CHALLENGE_TITLE_RE.test(title)) break;
      await page.waitForTimeout(CHALLENGE_POLL_MS);
    }

    const finalTitle = await page.title();
    if (CHALLENGE_TITLE_RE.test(finalTitle)) {
      return fail("FetchFailedError", "spacious.hk's bot challenge didn't clear in time — try again, or enter the listing by hand.");
    }

    const html = await page.content();
    const finalUrl = page.url();
    process.stdout.write(JSON.stringify({ ok: true, html, finalUrl }));
    process.exit(0);
  } finally {
    await browser.close();
  }
}

main().catch((cause) => {
  fail("FetchFailedError", cause instanceof Error ? cause.message : String(cause));
});
