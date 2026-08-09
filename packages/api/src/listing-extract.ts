import { isPlausibleHongKong } from "@veela/fixtures";
import type { ImportedListing } from "@veela/types";

/**
 * Reads what a listing page *publishes*, deliberately not what it *renders*. Open Graph
 * tags and JSON-LD structured data are content a site puts there on purpose, for search
 * engines and social-media previews — a fundamentally different (and far less legally
 * fraught) thing than parsing its proprietary page layout to lift figures out of a
 * rendered table. Most Hong Kong listing sites publish some of this and not all of it;
 * whatever this can't find is left blank rather than guessed, and the caller is expected
 * to fill the rest in by hand. A regex pass over the visible text is the one step down
 * from structured data, used only as a last resort and always against simple, bounded
 * patterns — no nested quantifiers, so no pathological input can make this hang.
 */

function extractMetaTags(html: string): Map<string, string> {
  const map = new Map<string, string>();
  const metaTagRe = /<meta\b[^>]*>/gi;
  const attrRe = /([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

  for (const tag of html.match(metaTagRe) ?? []) {
    let property: string | undefined;
    let content: string | undefined;
    for (const attr of tag.matchAll(attrRe)) {
      const name = attr[1]?.toLowerCase();
      const value = attr[2] ?? attr[3];
      if (name === "property" || name === "name") property = value;
      if (name === "content") content = value;
    }
    if (property !== undefined && content !== undefined) {
      map.set(property.toLowerCase(), content);
    }
  }
  return map;
}

function extractJsonLd(html: string): unknown[] {
  const blocks: unknown[] = [];
  const scriptRe = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const m of html.matchAll(scriptRe)) {
    try {
      const parsed: unknown = JSON.parse(m[1] ?? "");
      blocks.push(parsed);
    } catch {
      // Malformed JSON-LD is common in the wild — not a reason to fail the import.
    }
  }
  return blocks;
}

/** Bounded recursive walk (JSON output can't cycle, so depth alone is enough) looking
 *  for the first field whose key matches, case-insensitively. `keys` is a priority
 *  order, checked in full against the current object before descending — not "whichever
 *  key this object happens to list first." That distinction is real: Midland's own
 *  listing object carries both `net_area` (saleable) and `area` (gross) as siblings, and
 *  matching on object-iteration-order would silently return whichever JS happened to
 *  keep first, not the one the caller actually asked for. */
function findField(obj: unknown, keys: readonly string[], depth = 0): unknown {
  if (depth > 6 || obj === null || typeof obj !== "object") return undefined;

  if (Array.isArray(obj)) {
    for (const item of obj) {
      const found = findField(item, keys, depth + 1);
      if (found !== undefined) return found;
    }
    return undefined;
  }

  const rec = obj as Record<string, unknown>;
  for (const key of keys) {
    for (const [k, v] of Object.entries(rec)) {
      if (k.toLowerCase() !== key) continue;
      if (typeof v === "number" || typeof v === "string") return v;
      // schema.org's QuantitativeValue pattern — Centanet's floorSize is
      // `{"@type":"QuantitativeValue","value":947,"unitCode":"FTK"}`, not a bare number.
      // Unwrapping it here means every caller (area, and anything shaped like it later)
      // gets it for free rather than each needing its own special case.
      if (v !== null && typeof v === "object" && !Array.isArray(v) && "value" in v) {
        const inner = (v as Record<string, unknown>).value;
        if (typeof inner === "number" || typeof inner === "string") return inner;
      }
    }
  }
  for (const v of Object.values(rec)) {
    const found = findField(v, keys, depth + 1);
    if (found !== undefined) return found;
  }
  return undefined;
}

/**
 * Bounded recursive walk for a schema.org address, in whichever of the two shapes a
 * real site actually used it: Spacious states `address` as a bare string sitting right
 * next to `geo`; Centanet nests a full `PostalAddress` (`streetAddress`,
 * `addressRegion`, `addressCountry`) three levels down inside
 * `RealEstateListing.mainEntity`. Both tested against real listings, both correct.
 * `streetAddress` and `addressRegion` come back identical on Centanet's own data
 * ("Tsuen Wan West" twice) — deduplicated rather than printed as a stutter.
 */
function findAddressText(obj: unknown, depth = 0): string | undefined {
  if (depth > 8 || obj === null || typeof obj !== "object") return undefined;
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const found = findAddressText(item, depth + 1);
      if (found !== undefined) return found;
    }
    return undefined;
  }
  const rec = obj as Record<string, unknown>;
  const addr = rec.address;
  if (typeof addr === "string" && addr.trim() !== "") return addr;
  if (addr !== null && typeof addr === "object" && !Array.isArray(addr)) {
    const a = addr as Record<string, unknown>;
    const parts = [a.streetAddress, a.addressLocality, a.addressRegion].filter(
      (p): p is string => typeof p === "string" && p.trim() !== "",
    );
    const deduped = parts.filter((p, i) => p !== parts[i - 1]);
    if (deduped.length > 0) return deduped.join(", ");
  }
  for (const v of Object.values(rec)) {
    const found = findAddressText(v, depth + 1);
    if (found !== undefined) return found;
  }
  return undefined;
}

/**
 * Bounded recursive walk for a `{latitude, longitude}` pair, wherever it sits — a
 * schema.org `GeoCoordinates` object (Centanet, Spacious) or Midland's own
 * `building.{latitude,longitude}`, no `geo` wrapper at all. Matched by the two key names
 * directly rather than by a parent key like `"geo"`, so it doesn't need a different rule
 * per site. Midland's `building` object also carries `streetview_latitude` /
 * `streetview_longitude` for its camera angle, a real but different pair — matching the
 * exact keys `latitude`/`longitude` (not a prefix) is what keeps the two apart.
 */
function findGeoCoordinates(obj: unknown, depth = 0): { readonly latitude: number; readonly longitude: number } | undefined {
  if (depth > 8 || obj === null || typeof obj !== "object") return undefined;
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const found = findGeoCoordinates(item, depth + 1);
      if (found !== undefined) return found;
    }
    return undefined;
  }
  const rec = obj as Record<string, unknown>;
  const latitude = toNumber(rec.latitude);
  const longitude = toNumber(rec.longitude);
  if (latitude !== undefined && longitude !== undefined) return { latitude, longitude };
  for (const v of Object.values(rec)) {
    const found = findGeoCoordinates(v, depth + 1);
    if (found !== undefined) return found;
  }
  return undefined;
}

/**
 * Squarefoot and 28Hse publish neither JSON-LD nor a `__NEXT_DATA__` payload, but both
 * carry the old ICBM-style `<meta name="geo.position" content="lat;lng">` tag — verified
 * against a real listing on each. A `,` is accepted too; the meta-tag convention itself
 * is inconsistent about which separator, and this file has no reason to care which.
 */
function extractGeoMetaTag(meta: Map<string, string>): { readonly latitude: number; readonly longitude: number } | undefined {
  const raw = meta.get("geo.position");
  if (raw === undefined) return undefined;
  const parts = raw.split(/[;,]/).map((p) => toNumber(p.trim()));
  const [latitude, longitude] = parts;
  if (latitude === undefined || longitude === undefined) return undefined;
  return { latitude, longitude };
}

function toNumber(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/,/g, ""));
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

/**
 * Midland's `__NEXT_DATA__` property object uses a literal `0` — not a missing key — as
 * its "not entered" sentinel: a real village-house listing carried `net_area: 0,
 * area: 0` (no registered floor area) while still stating a real price. Nothing in this
 * domain is legitimately zero — no listing costs HK$0 or measures 0 sqft — so `0` here
 * means the same as absent, and treating it as a found value would print a false zero
 * next to a "read from the listing" claim, the exact confidently-wrong shape this file
 * exists to avoid.
 */
function toPositiveNumber(v: unknown): number | undefined {
  const n = toNumber(v);
  return n !== undefined && n > 0 ? n : undefined;
}

/**
 * The text-pattern fallback used to scan the *entire visible page* — every listing
 * site tested (Centanet, Squarefoot, 28Hse) also renders "similar properties",
 * filters and navigation full of other listings' numbers, and a global regex has no
 * way to tell those apart from the subject property's own figures. Tested against
 * real listings, it produced confidently **wrong** answers on two of three sites —
 * the worse failure mode this product exists to avoid, worse than finding nothing.
 *
 * The fix: scope the fallback to `og:title` + `og:description` only. Squarefoot and
 * 28Hse (the same underlying platform) both truncate their own `og:title` badly but
 * put a clean, single-purpose summary in `og:description` — "Ming Fung Building Sell
 * 2 Bedrooms, 2 Bathrooms 386 ft²" — written by the site itself to describe *this*
 * listing for search engines and social previews. Still metadata the page publishes
 * on purpose, still not the rendered layout; just a smaller, page-authored, verified
 * single source instead of the whole DOM's worth of unrelated numbers.
 */
function metaSummaryText(meta: Map<string, string>): string {
  const parts = [meta.get("og:title"), meta.get("og:description"), meta.get("twitter:description")];
  return parts.filter((p): p is string => p !== undefined).join(" \n ");
}

/**
 * Midland (`deluxe.midland.com.hk`) publishes no Open Graph price/area and no JSON-LD —
 * tested against a real listing, both are absent. What it does publish is `__NEXT_DATA__`,
 * the standard Next.js hydration payload every Next.js page embeds as a `<script>` tag so
 * the client can pick up server-rendered state without refetching. That is still the site
 * handing over structured data verbatim in the page source — no DOM parsing, no rendering
 * needed — so it sits in the same category as JSON-LD, not in the "parse the rendered
 * layout" category this file otherwise refuses to enter.
 *
 * **Scoped to `props.pageProps.property` only, deliberately.** The full payload also
 * carries `recommendedProperties`, `estateData` and filter-range data (`filters`), each
 * with their own `price`/`net_area`-shaped fields describing a *different* property or no
 * property at all. Handing the whole blob to `findField` would let it silently return a
 * recommended listing's price instead of the one on screen — the exact "confidently
 * wrong" failure mode `metaSummaryText` was scoped down to avoid. `property` is the one
 * object that describes the page's own subject.
 */
function extractNextDataProperty(html: string): unknown {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (m?.[1] === undefined) return undefined;
  try {
    const data = JSON.parse(m[1]) as { props?: { pageProps?: { property?: unknown } } };
    return data.props?.pageProps?.property;
  } catch {
    return undefined;
  }
}

const PRICE_MILLIONS_RE = /HK\$|\$\s?([\d.]{1,6})\s?[Mm]\b/;
const PRICE_FULL_RE = /(?:HK\$|\$)\s?([\d]{1,3}(?:,\d{3}){1,4})\b/;
// HK listings mix "sq ft" / "sqft" and the "ft²" (or plain "ft2") form about equally.
const AREA_RE = /([\d,]{2,6})\s?(?:sq\.?\s?ft\.?|sqft|ft\s?[²2]|平方呎|呎)/i;
const BEDROOM_RE = /(\d)\s?(?:-|\s)?(?:bed(?:room)?s?|房)/i;

/**
 * Whether the page is a rental listing rather than a sale — decided before the one price
 * figure this file finds is assigned anywhere, because a rental's headline number is a
 * monthly rent, and filing it as `priceMinor` reads as a purchase price a few hundred
 * times too low. Every HK portal tested encodes this in the URL itself: Centanet's
 * `?theme=buy`/`?theme=rent`, 28Hse's and Squarefoot's `/buy/`/`/rent/` path segment —
 * cheaper to check than the page body, and exactly as reliable for the sites tested. The
 * page's own summary text ("For Sale" / "For Rent" / "To Let") is the fallback for a
 * listing URL that doesn't say either way, as Spacious's permalinks don't.
 */
function isRentalListing(sourceUrl: string, summary: string): boolean {
  let pathAndQuery = "";
  try {
    const url = new URL(sourceUrl);
    pathAndQuery = url.pathname + url.search;
  } catch {
    // Falls through to the text check below.
  }
  if (/\b(rent|to-let|lease)\b/i.test(pathAndQuery)) return true;
  if (/\b(buy|sale)\b/i.test(pathAndQuery)) return false;
  return /\bfor rent\b|\bto let\b|\bfor lease\b/i.test(summary);
}

export function extractListing(html: string, sourceUrl: string): ImportedListing {
  const warnings: string[] = [];
  const meta = extractMetaTags(html);
  const jsonLd = extractJsonLd(html);
  const nextDataProperty = extractNextDataProperty(html);

  const title = meta.get("og:title") ?? meta.get("twitter:title");
  const description = meta.get("og:description") ?? meta.get("twitter:description");
  if (title === undefined) {
    warnings.push("No page title found (og:title) — the listing's own heading isn't published as metadata.");
  }

  const summary = metaSummaryText(meta);
  const rental = isRentalListing(sourceUrl, summary);

  let priceMinor: number | undefined;
  let monthlyRentMinor: number | undefined;
  let currency: ImportedListing["currency"];

  const ldPrice = toNumber(findField(jsonLd, ["price", "lowprice", "highprice"]));
  const ldCurrency = findField(jsonLd, ["pricecurrency"]);
  // Midland's own object carries `price` and `rent` as independent fields — a unit can
  // be listed for both at once (`price: 0` is that object's usual "not offered" sentinel
  // for whichever of the two doesn't apply). Read both directly; neither depends on the
  // URL/text guess above, which exists for the other sites' single, undifferentiated
  // headline figure.
  const nextDataPrice = toPositiveNumber(findField(nextDataProperty, ["price"]));
  const nextDataRent = toPositiveNumber(findField(nextDataProperty, ["rent"]));

  if (ldPrice !== undefined) {
    if (ldCurrency === undefined || ldCurrency === "HKD") {
      const amountMinor = Math.round(ldPrice * 100);
      if (rental) {
        monthlyRentMinor = amountMinor;
      } else {
        priceMinor = amountMinor;
      }
      currency = "HKD";
    } else {
      warnings.push(
        `The listing states its price in ${String(ldCurrency)}, not HKD — enter the price yourself rather than trust an automatic conversion.`,
      );
    }
  } else if (nextDataPrice !== undefined || nextDataRent !== undefined) {
    // Midland has no separate currency field on this object — it prices everything on
    // the site in HKD, unlike schema.org listings which sometimes state one explicitly.
    if (nextDataPrice !== undefined) {
      priceMinor = Math.round(nextDataPrice * 100);
      currency = "HKD";
      warnings.push("Price was read from the page's own embedded listing data, not published Open Graph/JSON-LD — double-check it.");
    }
    if (nextDataRent !== undefined) {
      monthlyRentMinor = Math.round(nextDataRent * 100);
      currency = "HKD";
      warnings.push("Monthly rent was read from the page's own embedded listing data, not published Open Graph/JSON-LD — double-check it.");
    }
  } else {
    const millions = summary.match(PRICE_MILLIONS_RE);
    const full = summary.match(PRICE_FULL_RE);
    const foundAmount =
      millions?.[1] !== undefined
        ? Number(millions[1]) * 1_000_000
        : full?.[1] !== undefined
          ? Number(full[1].replace(/,/g, ""))
          : undefined;
    if (foundAmount !== undefined) {
      const amountMinor = Math.round(foundAmount * 100);
      currency = "HKD";
      if (rental) {
        monthlyRentMinor = amountMinor;
      } else {
        priceMinor = amountMinor;
      }
      warnings.push(
        `${rental ? "Monthly rent" : "Price"} was read from the listing's own summary text, not structured data — double-check it.`,
      );
    } else {
      warnings.push(rental ? "No rent figure found — enter it from the listing yourself." : "No price found — enter it from the listing yourself.");
    }
  }

  if (monthlyRentMinor !== undefined) {
    warnings.push(
      priceMinor !== undefined
        ? "This listing publishes both a price and a monthly rent — both were filled in, so the estimated yield reflects this listing directly."
        : "This is a rental listing, not a sale — the figure above was read as monthly rent, not a purchase price. Net yield can't be estimated from this import alone; enter a purchase price yourself to see it.",
    );
  }

  let saleableAreaSqft: number | undefined;
  const ldArea = toNumber(findField(jsonLd, ["floorsize", "area"]));
  // "net_area" ahead of "area" is deliberate: Midland's own object carries both, and
  // net_area is the saleable figure — area is gross. See extractNextDataProperty.
  const nextDataArea = toPositiveNumber(findField(nextDataProperty, ["net_area", "area"]));
  if (ldArea !== undefined) {
    saleableAreaSqft = ldArea;
  } else if (nextDataArea !== undefined) {
    saleableAreaSqft = nextDataArea;
    warnings.push("Saleable area was read from the page's own embedded listing data, not published Open Graph/JSON-LD — double-check it.");
  } else {
    const areaMatch = summary.match(AREA_RE);
    if (areaMatch?.[1] !== undefined) {
      saleableAreaSqft = Number(areaMatch[1].replace(/,/g, ""));
      warnings.push("Saleable area was read from the listing's own summary text — Hong Kong listings often quote gross, not saleable, area. Verify which one this is.");
    } else {
      warnings.push("No floor area found — enter it yourself, and confirm it's the saleable (not gross) area.");
    }
  }

  let bedrooms: number | undefined;
  // Deliberately not "numberOfRooms" — tested against a real Squarefoot listing whose
  // JSON-LD carried a correct floorSize (1,282 sqft) alongside "numberOfRooms":1, while
  // its own og:description said "3 Bedrooms". schema.org's "room" count and a
  // marketing "bedroom" count are legitimately different numbers on a real site, not
  // interchangeable — only the fields actually named for bedrooms count as bedrooms.
  const ldBedrooms = toNumber(findField(jsonLd, ["numberofbedroomstotal", "numberofbedrooms"]));
  const nextDataBedrooms = toPositiveNumber(findField(nextDataProperty, ["bedroom"]));
  if (ldBedrooms !== undefined) {
    bedrooms = ldBedrooms;
  } else if (nextDataBedrooms !== undefined) {
    bedrooms = nextDataBedrooms;
  } else {
    const bedroomMatch = summary.match(BEDROOM_RE);
    if (bedroomMatch?.[1] !== undefined) {
      bedrooms = Number(bedroomMatch[1]);
    }
  }

  // Same JSON-LD-then-embedded-data order as every other field — Centanet and Spacious
  // publish a real address and geo pair in JSON-LD; Midland's only in __NEXT_DATA__.
  const address = findAddressText(jsonLd) ?? findAddressText(nextDataProperty);
  const rawGeo = findGeoCoordinates(jsonLd) ?? findGeoCoordinates(nextDataProperty) ?? extractGeoMetaTag(meta);
  // A transcription error or a mis-scoped match puts the marker in the South China Sea —
  // the same guard `@veela/fixtures` already applies to its own generated coordinates,
  // reused here because a wrong pin on a real map reads as data, not as a parsing bug.
  const geo = rawGeo !== undefined && isPlausibleHongKong({ lat: rawGeo.latitude, lng: rawGeo.longitude }) ? rawGeo : undefined;
  if (rawGeo !== undefined && geo === undefined) {
    warnings.push("Coordinates were found but fall outside Hong Kong — discarded rather than shown on the map.");
  } else if (geo === undefined) {
    warnings.push("No coordinates found — the map below can't place this listing.");
  }

  warnings.push(
    "This import reads only what the page publishes as metadata (Open Graph tags and structured data) — it does not read the page's own rendered layout. Treat every figure above as a starting point to verify against the listing itself, not a final answer.",
  );

  return {
    sourceUrl,
    fetchedAt: new Date().toISOString(),
    ...(title !== undefined && { title }),
    ...(description !== undefined && { description }),
    ...(priceMinor !== undefined && { priceMinor }),
    ...(monthlyRentMinor !== undefined && { monthlyRentMinor }),
    ...(currency !== undefined && { currency }),
    ...(saleableAreaSqft !== undefined && { saleableAreaSqft }),
    ...(bedrooms !== undefined && { bedrooms }),
    ...(address !== undefined && { address }),
    ...(geo !== undefined && { latitude: geo.latitude, longitude: geo.longitude }),
    warnings,
  };
}
