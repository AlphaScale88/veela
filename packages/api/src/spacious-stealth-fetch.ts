import { execFile } from "node:child_process";
import * as path from "node:path";

import { FetchFailedError, UnsafeUrlError } from "./ssrf-safe-fetch.js";

/**
 * `fetchHtmlSafely()` — an honest client identifying itself as `VeelaListingImporter/1.0`
 * — gets a hard 403 from spacious.hk, verified against a real listing, not assumed. So
 * does a full headless Chromium carrying an ordinary browser User-Agent: Cloudflare's own
 * "performing security verification" interstitial, to a real browser. That rules out the
 * cheap fix (a different header) and confirms it's an active bot challenge.
 *
 * **This file exists to get past that specific challenge, for this one named domain, and
 * that is a real escalation from the rest of this importer.** Reading Open Graph tags and
 * JSON-LD is reading what a site chooses to publish. This is a browser dressed to defeat
 * a site's own anti-bot product — a materially more aggressive posture, asked for and
 * confirmed explicitly rather than added quietly.
 *
 * **Playwright runs in a child process, not imported here, deliberately.** The stealth
 * browser itself lives in `apps/web/scripts/spacious-fetch-worker.mjs`. Tried importing
 * `playwright` directly from this module first — it does not survive being bundled by
 * Next's webpack: playwright-core reads its own `package.json` by a path relative to its
 * real location on disk, and reaches for an optional BiDi module via a dynamic
 * `require()`. Both are ordinary Node module resolution and both break once webpack
 * rewrites them. `serverExternalPackages` did not fix it for this route-handler layer,
 * tried and confirmed, not assumed. A subprocess Node genuinely `require`s from real
 * `node_modules` sidesteps the whole class of problem rather than fighting the bundler.
 *
 * Scoped as tightly as the decision allows: domain-allowlisted (checked before the
 * subprocess is even spawned — every other host keeps using the SSRF-safe, self-
 * identifying `fetchHtmlSafely`), bounded (single navigation, hard timeout), and a
 * process per import rather than a pool — fine for one person pasting links
 * occasionally, not for production scale. Only verified in local dev.
 */

const ALLOWED_HOSTS = new Set(["spacious.hk", "www.spacious.hk"]);
const WORKER_TIMEOUT_MS = 45_000;

interface FetchResult {
  readonly html: string;
  readonly finalUrl: string;
}

type WorkerOutput =
  | { ok: true; html: string; finalUrl: string }
  | { ok: false; errorType: "UnsafeUrlError" | "FetchFailedError"; message: string };

export async function fetchSpaciousHtmlStealthily(rawUrl: string): Promise<FetchResult> {
  assertAllowedSpaciousUrl(rawUrl);

  // The Next.js server process's own cwd is guaranteed to be the app root (apps/web) —
  // that's how `next dev`/`next start` are always invoked, not an assumption specific to
  // this feature. The worker sits outside app/ and every other Next-managed directory,
  // so webpack's build never discovers it as a dependency to bundle in the first place.
  const workerPath = path.join(process.cwd(), "scripts", "spacious-fetch-worker.mjs");

  const stdout = await new Promise<string>((resolve, reject) => {
    execFile("node", [workerPath, rawUrl], { timeout: WORKER_TIMEOUT_MS, maxBuffer: 10_000_000 }, (error, stdoutResult) => {
      // The worker always writes its JSON result to stdout, whether it succeeded or
      // failed — a non-zero exit code alone (from execFile's own `error`) doesn't carry
      // enough detail to tell UnsafeUrlError from FetchFailedError, so it's ignored here
      // in favour of parsing whatever came out on stdout.
      if (stdoutResult.length > 0) {
        resolve(stdoutResult);
        return;
      }
      reject(error ?? new Error("Worker produced no output"));
    });
  });

  let parsed: WorkerOutput;
  try {
    parsed = JSON.parse(stdout) as WorkerOutput;
  } catch {
    throw new FetchFailedError("The Spacious fetch worker returned something unreadable.");
  }

  if (!parsed.ok) {
    if (parsed.errorType === "UnsafeUrlError") throw new UnsafeUrlError(parsed.message);
    throw new FetchFailedError(parsed.message);
  }
  return { html: parsed.html, finalUrl: parsed.finalUrl };
}

function assertAllowedSpaciousUrl(raw: string): void {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeUrlError("Not a valid URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UnsafeUrlError(`Unsupported scheme: ${url.protocol}`);
  }
  if (!ALLOWED_HOSTS.has(url.hostname.toLowerCase())) {
    throw new UnsafeUrlError(`This fetcher only handles spacious.hk, not ${url.hostname}`);
  }
}
