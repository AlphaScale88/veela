/**
 * What is *near* a property — schools, stations, shops, health, green space — from
 * OpenStreetMap via the Overpass API.
 *
 * ## Why OSM and not a Hong Kong government dataset
 *
 * Preferred, and tried first. The blockers were practical, not licensing: each amenity
 * class is published as its own dataset in its own shape (EDB for schools, separate feeds
 * for MTR, hospitals, markets), several sit behind the CSDI geoportal as API-only
 * datasets whose query endpoints were not reachable without portal registration, and none
 * of them answers the actual question — *what is within walking distance of this point* —
 * without first ingesting the lot. Overpass answers exactly that question, for every
 * category at once, with no key.
 *
 * The trade-off: OSM is contributor-maintained, so coverage is uneven and a missing school
 * means "nobody mapped it", not "there is no school". Never present this as exhaustive.
 *
 * **ODbL.** OSM data is licensed under the Open Database Licence, which requires
 * attribution — "© OpenStreetMap contributors" — wherever it is shown. The UI carries it.
 * Note also the share-alike term: publishing a *derived database* would carry obligations.
 * Showing what's nearby beside a report does not, but building a proprietary POI database
 * out of it would need reading the licence properly first.
 *
 * ## Practical limits
 *
 * Overpass is a shared community instance. It is slow (seconds, not milliseconds), rate
 * limited, and returns 429/504 when busy — a territory-wide building count timed out
 * outright during this work. So: one bounded query per request, a hard timeout, and every
 * failure surfaced as "unavailable" rather than as an empty neighbourhood, because "no
 * schools nearby" is a claim and "we could not check" is not.
 *
 * A cache belongs here eventually — results for a point barely change month to month, and
 * caching would remove almost all of this latency. Deliberately not built yet rather than
 * built badly: it needs a table and an eviction rule, and the feature is worth proving
 * first.
 */

/**
 * Tried in order. Not redundancy for its own sake: during this work the main instance
 * returned a 504 and, minutes later, a plain XML error page to an identical query. One
 * shared community endpoint is not something to build a page section on.
 */
const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
] as const;

/**
 * **Keep this plain.** The first version was
 * `"Veela/1.0 (Hong Kong property analysis)"` and every request came back **406 Not
 * Acceptable** — the instance's filtering rejects the parenthesised form, and the failure
 * looks exactly like a busy server rather than a rejected header. Identifying the client
 * is still the right etiquette; doing it with punctuation is not worth the outage.
 */
const USER_AGENT = "Veela/1.0";

/** Metres. Walking distance, per category — a station 800m away is still "near", a
 *  supermarket 800m away is not really the local shop. */
const RADIUS = {
  school: 800,
  transport: 900,
  shop: 600,
  health: 800,
  park: 700,
  premium: 900,
  construction: 900,
} as const;

/**
 * **"Prestige" is a judgement, so it is written down here rather than hidden in a score.**
 *
 * Asked for an assessment including "luxury store, famous schools, high end area", the
 * honest form is a *countable signal with an editable definition*, not a number that
 * implies measurement. A property near three of these is near three of these; whether that
 * makes an area "high end" is the reader's call, and they can disagree with any entry
 * because the entries are visible.
 *
 * Matched case-insensitively against OSM's `brand`, `name` and `operator` tags. Deliberately
 * short and mainstream — a long list invites arguments about tiers and starts encoding
 * opinions nobody can audit. Extend it knowingly.
 *
 * Note what this is *not*: a review score, a price signal, or an official designation. OSM
 * says a shop exists and what it is called. It says nothing about whether it is any good.
 */
const PREMIUM_BRANDS: readonly string[] = [
  // Fashion and leather goods
  "louis vuitton", "hermès", "hermes", "chanel", "gucci", "prada", "dior", "fendi",
  "bottega veneta", "balenciaga", "saint laurent", "loewe", "celine", "givenchy",
  "burberry", "moncler", "brunello cucinelli", "loro piana", "max mara", "miu miu",
  // Watches and jewellery
  "rolex", "patek philippe", "audemars piguet", "cartier", "van cleef", "tiffany",
  "bulgari", "bvlgari", "piaget", "vacheron constantin", "jaeger-lecoultre", "omega",
  "iwc", "panerai", "chopard", "harry winston", "graff",
  // Department stores and hotels that mark a prime address
  "lane crawford", "harvey nichols", "joyce", "seibu",
  "four seasons", "mandarin oriental", "the peninsula", "rosewood", "st. regis",
  "ritz-carlton", "shangri-la", "grand hyatt", "conrad", "w hong kong", "the upper house",
];

/** OSM shop values that are premium-leaning by category rather than by brand. Kept
 *  separate from the brand list so the two can be reasoned about independently. */
const PREMIUM_SHOP_TYPES: readonly string[] = ["jewelry", "watches", "art", "antiques"];

export type AmenityKind = keyof typeof RADIUS;

export interface Amenity {
  readonly kind: AmenityKind;
  readonly name: string;
  /** The OSM tag that matched, e.g. "subway_station", "supermarket" — shown so a reader
   *  can tell a kindergarten from a university, or a clinic from a hospital. */
  readonly subtype: string;
  /** Straight-line metres. Not walking distance: OSM routing would be a different
   *  service and a bigger promise. Labelled as "straight line" in the UI for that reason. */
  readonly metres: number;
}

export interface Neighbourhood {
  readonly latitude: number;
  readonly longitude: number;
  readonly counts: Readonly<Record<AmenityKind, number>>;
  readonly nearest: readonly Amenity[];
  readonly attribution: string;
}

export const OSM_ATTRIBUTION = "© OpenStreetMap contributors (ODbL)";

/** Haversine. Overpass returns coordinates, not distances. */
function metresBetween(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6_371_000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const la1 = (aLat * Math.PI) / 180;
  const la2 = (bLat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

/**
 * One query for every category. `nwr` covers nodes, ways and relations — a school mapped
 * as a campus polygon is a way, a station can be a relation, and asking only for nodes
 * silently misses both. `center` gives a single point for non-node elements so distance
 * is computable without walking their geometry.
 */
function buildQuery(lat: number, lng: number): string {
  const at = (r: number): string => `(around:${r},${lat},${lng})`;
  return `[out:json][timeout:25];
(
  nwr["amenity"~"^(school|kindergarten|college|university)$"]${at(RADIUS.school)};
  nwr["railway"="station"]${at(RADIUS.transport)};
  nwr["station"="subway"]${at(RADIUS.transport)};
  nwr["amenity"="bus_station"]${at(RADIUS.transport)};
  nwr["shop"~"^(supermarket|mall|convenience|department_store)$"]${at(RADIUS.shop)};
  nwr["amenity"="marketplace"]${at(RADIUS.shop)};
  nwr["amenity"~"^(hospital|clinic|doctors|pharmacy)$"]${at(RADIUS.health)};
  nwr["leisure"~"^(park|garden|playground)$"]${at(RADIUS.park)};
  nwr["shop"]["brand"]${at(RADIUS.premium)};
  nwr["shop"~"^(jewelry|watches|art|antiques)$"]${at(RADIUS.premium)};
  nwr["tourism"="hotel"]${at(RADIUS.premium)};
  nwr["building"="construction"]${at(RADIUS.construction)};
  nwr["landuse"="construction"]${at(RADIUS.construction)};
);
out center tags;`;
}

/** Brand, name or operator against the visible allowlist. `brand` first — it is the tag
 *  OSM actually intends for this, and a `name` can be a shopping-centre unit number. */
function premiumMatch(tags: Record<string, string>): string | null {
  const candidates = [tags["brand"], tags["name:en"], tags["name"], tags["operator"]]
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.toLowerCase());
  for (const brand of PREMIUM_BRANDS) {
    if (candidates.some((c) => c.includes(brand))) return brand;
  }
  const shop = tags["shop"];
  if (shop !== undefined && PREMIUM_SHOP_TYPES.includes(shop)) return shop;
  return null;
}

function classify(tags: Record<string, string>): { kind: AmenityKind; subtype: string } | null {
  const { amenity, railway, station, shop, leisure } = tags;

  /* Premium is tested before the generic `shop` branch, or a Cartier would be filed as an
     ordinary jewellery shop and the signal the reader asked for would vanish into it. */
  const premium = premiumMatch(tags);
  if (premium !== null) return { kind: "premium", subtype: premium };

  if (tags["building"] === "construction" || tags["landuse"] === "construction") {
    return { kind: "construction", subtype: "under construction" };
  }
  if (amenity !== undefined && /^(school|kindergarten|college|university)$/.test(amenity)) {
    return { kind: "school", subtype: amenity };
  }
  if (railway === "station" || station === "subway" || amenity === "bus_station") {
    return { kind: "transport", subtype: station === "subway" ? "subway_station" : (railway ?? amenity ?? "station") };
  }
  /**
   * **Only everyday-shopping types count as "shops"**, not any shop at all.
   *
   * The query asks for `["shop"]["brand"]` across a 900m radius purely so the premium
   * allowlist has something to match against. Treating whatever *fails* that match as a
   * generic shop was a regression I shipped and caught on screen: the nearest-things list
   * filled up with IKEA, Muji, Audi and Toys R Us, burying the stations and schools that
   * are the point. A car showroom is not a local amenity.
   */
  const EVERYDAY_SHOPS = ["supermarket", "mall", "convenience", "department_store"];
  if ((shop !== undefined && EVERYDAY_SHOPS.includes(shop)) || amenity === "marketplace") {
    return { kind: "shop", subtype: shop ?? "marketplace" };
  }
  if (amenity !== undefined && /^(hospital|clinic|doctors|pharmacy)$/.test(amenity)) {
    return { kind: "health", subtype: amenity };
  }
  if (leisure !== undefined) return { kind: "park", subtype: leisure };
  return null;
}

export async function fetchNeighbourhood(
  latitude: number,
  longitude: number,
  fetchImpl: typeof fetch = fetch,
): Promise<Neighbourhood> {
  const payload = `data=${encodeURIComponent(buildQuery(latitude, longitude))}`;

  /**
   * A busy Overpass does not always answer with a status code. It sometimes returns
   * `200` with an XML error page in the body, which `res.json()` then throws on — so a
   * mirror is tried both on a bad status *and* on an unparseable body, and only the last
   * failure propagates.
   */
  let body: { elements?: readonly {
    lat?: number; lon?: number; center?: { lat: number; lon: number };
    tags?: Record<string, string>;
  }[] } | undefined;
  let lastError: Error | undefined;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetchImpl(endpoint, {
        method: "POST",
        body: payload,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": USER_AGENT,
        },
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) throw new Error(`${new URL(endpoint).host} returned ${res.status}`);
      const text = await res.text();
      if (!text.trimStart().startsWith("{")) {
        throw new Error(`${new URL(endpoint).host} returned a non-JSON body (busy)`);
      }
      body = JSON.parse(text) as typeof body;
      break;
    } catch (cause) {
      lastError = cause instanceof Error ? cause : new Error("unknown Overpass failure");
    }
  }

  if (body === undefined) throw lastError ?? new Error("Overpass unreachable");

  const counts: Record<AmenityKind, number> = {
    school: 0, transport: 0, shop: 0, health: 0, park: 0, premium: 0, construction: 0,
  };
  const all: Amenity[] = [];
  // OSM frequently maps the same place more than once (a node inside its own polygon, or
  // a station split per entrance). Dedupe on kind + name so "Wellcome" doesn't appear
  // five times and inflate the count.
  const seen = new Set<string>();

  for (const el of body.elements ?? []) {
    const tags = el.tags;
    if (tags === undefined) continue;
    const classified = classify(tags);
    if (classified === null) continue;

    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (lat === undefined || lon === undefined) continue;

    const metres = metresBetween(latitude, longitude, lat, lon);
    if (metres > RADIUS[classified.kind]) continue;

    // Prefer the English name where OSM carries both; Hong Kong tags are often bilingual
    // in one string ("太古 Tai Koo"), which is fine to show as-is.
    //
    // Construction sites are the one category allowed through unnamed: "three sites under
    // construction within 900m" is precisely the signal, and demanding a name would drop
    // nearly all of them. Everything else must identify itself.
    const rawName = tags["name:en"] ?? tags["name"];
    const named = rawName !== undefined && rawName.trim() !== "";
    if (!named && classified.kind !== "construction") continue;
    const name = named ? rawName.trim() : "Unnamed construction site";

    // Unnamed sites would all collide on one dedupe key, so distance disambiguates them.
    const key =
      named
        ? `${classified.kind}|${name.toLowerCase()}`
        : `${classified.kind}|unnamed|${metres}`;
    if (seen.has(key)) continue;
    seen.add(key);

    counts[classified.kind] += 1;
    all.push({ kind: classified.kind, name, subtype: classified.subtype, metres });
  }

  all.sort((a, b) => a.metres - b.metres);

  return {
    latitude,
    longitude,
    counts,
    // Capped: this sits inside a report, not a directory listing. The counts carry the
    // "how well served is this area" signal; the list answers "by what, exactly".
    nearest: all.slice(0, 18),
    attribution: OSM_ATTRIBUTION,
  };
}
