import { lookup } from "node:dns/promises";
import * as http from "node:http";
import * as https from "node:https";
import { isIPv4 } from "node:net";

/**
 * Fetching a URL a user just typed in is the textbook SSRF shape: without checks, a
 * "paste your listing link" box is also a "make our server request anything it can
 * reach" box — an internal admin panel, a cloud metadata endpoint, a port scan timed
 * by response latency. Three things make this safe rather than merely convenient:
 *
 * 1. **Resolve first, validate, then connect to the validated address literally** —
 *    never to the hostname a second time. Validating a hostname and then calling the
 *    stdlib's own `fetch(url)` re-resolves DNS at connection time, and a hostname that
 *    resolved to a public IP during validation can resolve to a private one a moment
 *    later ("DNS rebinding"). Connecting to the address we already checked closes that
 *    gap; the `Host` header and TLS SNI (`servername`) still carry the real hostname,
 *    so the destination server and certificate validation behave exactly as normal.
 * 2. **Every redirect hop is re-validated from scratch.** A public URL that redirects
 *    to a private one is the same attack one step later.
 * 3. **Bounded in every dimension that matters**: a handful of redirects, a short
 *    timeout, a small response cap, and only an HTML content type accepted — a page
 *    that is huge, slow, or not HTML is refused rather than partially read.
 */

const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 8_000;
const MAX_BYTES = 3_000_000;
const USER_AGENT = "VeelaListingImporter/1.0 (+https://veela.app; property analysis tool)";

export class UnsafeUrlError extends Error {}
export class FetchFailedError extends Error {}

function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  const [a, b] = parts;
  if (a === undefined || b === undefined) return true;
  if (a === 127) return true; // loopback
  if (a === 10) return true; // private
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 168) return true; // private
  if (a === 169 && b === 254) return true; // link-local, incl. cloud metadata (.169.254.169.254)
  if (a === 0) return true; // "this network"
  if (a >= 224) return true; // multicast + reserved
  return false;
}

function isPrivateIpv6(ip: string): boolean {
  const norm = ip.toLowerCase();
  if (norm === "::1") return true; // loopback
  if (norm.startsWith("fe80:")) return true; // link-local
  if (norm.startsWith("fc") || norm.startsWith("fd")) return true; // unique local (fc00::/7)
  if (norm.startsWith("::ffff:")) {
    // IPv4-mapped — validate the embedded v4 address instead.
    const v4 = norm.slice("::ffff:".length);
    return isIPv4(v4) ? isPrivateIpv4(v4) : true;
  }
  return false;
}

function isPrivateIp(address: string, family: number): boolean {
  return family === 4 ? isPrivateIpv4(address) : isPrivateIpv6(address);
}

/** Resolves a hostname and returns the first *public* address, or throws. Rejecting
 *  outright — rather than silently skipping to the next address — matters because an
 *  attacker fully controls which addresses their own domain resolves to. */
async function resolvePublicAddress(hostname: string): Promise<{ address: string; family: number }> {
  let records: { address: string; family: number }[];
  try {
    records = await lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new UnsafeUrlError(`Could not resolve host: ${hostname}`);
  }
  const pub = records.find((r) => !isPrivateIp(r.address, r.family));
  if (pub === undefined) {
    throw new UnsafeUrlError(`${hostname} resolves only to private/internal addresses`);
  }
  return pub;
}

interface FetchResult {
  readonly html: string;
  readonly finalUrl: string;
}

export async function fetchHtmlSafely(rawUrl: string): Promise<FetchResult> {
  let current = rawUrl;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const url = parseHttpUrl(current);
    const resolved = await resolvePublicAddress(url.hostname);
    const result = await requestOnce(url, resolved.address);

    if (result.kind === "redirect") {
      current = new URL(result.location, url).toString();
      continue;
    }
    return { html: result.html, finalUrl: current };
  }

  throw new FetchFailedError(`Too many redirects (>${MAX_REDIRECTS})`);
}

function parseHttpUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeUrlError("Not a valid URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UnsafeUrlError(`Unsupported scheme: ${url.protocol}`);
  }
  return url;
}

type RequestOutcome = { kind: "html"; html: string } | { kind: "redirect"; location: string };

function requestOnce(url: URL, connectAddress: string): Promise<RequestOutcome> {
  return new Promise((resolve, reject) => {
    const transport = url.protocol === "https:" ? https : http;

    const req = transport.request(
      {
        hostname: connectAddress,
        port: url.port === "" ? (url.protocol === "https:" ? 443 : 80) : url.port,
        path: `${url.pathname}${url.search}`,
        method: "GET",
        // TLS/HTTP still address the real domain — only the socket connects by IP.
        servername: url.protocol === "https:" ? url.hostname : undefined,
        headers: {
          Host: url.hostname,
          "User-Agent": USER_AGENT,
          Accept: "text/html,application/xhtml+xml",
        },
        timeout: TIMEOUT_MS,
      },
      (res) => {
        const status = res.statusCode ?? 0;

        if (status >= 300 && status < 400) {
          const location = res.headers.location;
          res.resume(); // discard body
          if (location === undefined) {
            reject(new FetchFailedError(`Redirect (${status}) with no Location header`));
            return;
          }
          resolve({ kind: "redirect", location });
          return;
        }

        if (status < 200 || status >= 300) {
          res.resume();
          reject(new FetchFailedError(`Listing page returned HTTP ${status}`));
          return;
        }

        const contentType = res.headers["content-type"] ?? "";
        if (!contentType.includes("html")) {
          res.resume();
          reject(new FetchFailedError(`Expected an HTML page, got "${contentType || "unknown"}"`));
          return;
        }

        const chunks: Buffer[] = [];
        let bytes = 0;
        res.on("data", (chunk: Buffer) => {
          bytes += chunk.length;
          if (bytes > MAX_BYTES) {
            req.destroy();
            reject(new FetchFailedError("Listing page exceeded the size limit"));
            return;
          }
          chunks.push(chunk);
        });
        res.on("end", () => {
          resolve({ kind: "html", html: Buffer.concat(chunks).toString("utf-8") });
        });
        res.on("error", (err) => reject(new FetchFailedError(err.message)));
      },
    );

    req.on("timeout", () => {
      req.destroy();
      reject(new FetchFailedError(`Timed out after ${TIMEOUT_MS}ms`));
    });
    req.on("error", (err) => reject(new FetchFailedError(err.message)));
    req.end();
  });
}
