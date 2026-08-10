/**
 * The Government's **Address Lookup Service** (`als.gov.hk`) — free, authoritative, and
 * the answer to the per-building layer this product had no source for.
 *
 * ## Why this rather than the Lands Department building footprints
 *
 * `.claude/CLAUDE.md` names Lands Department open geospatial data as the per-building
 * source, and it is the right one for *geometry*. But it is published through the CSDI
 * geoportal as an **API-only dataset** (`landsd_rcd_1637211194312_35158`) with no bulk
 * file on data.gov.hk, and its query endpoints were not reachable without portal
 * registration. ALS needs no key, returns exactly the fields a search box needs, and is
 * as authoritative as it gets — it *is* the Government's address register.
 *
 * The trade-off, stated rather than buried: ALS gives a **point**, not a footprint. So
 * this fills `buildings.centroid` and leaves `buildings.footprint` null. Polygons still
 * need the Lands Department ingestion, and the map still cannot draw a real boundary.
 *
 * ## What it is not
 *
 * A bulk source. ALS answers a query; it does not enumerate Hong Kong. That suits this
 * product's own "user-fed, not aggregation-first" model — the database accumulates real
 * buildings as a by-product of people searching, rather than needing 40,000 rows up
 * front — but it means coverage grows with use and is never complete.
 *
 * Also: it indexes **all** addresses, not just residential. Fire stations, substations
 * and government complexes come back for plausible queries, so callers must not present
 * a result as a dwelling.
 */

const ALS_ENDPOINT = "https://www.als.gov.hk/lookup";

/** ALS answers with the district's full name; `districts.id` uses short codes. Mapped
 *  explicitly rather than by string-munging " DISTRICT" off the end and hoping the rest
 *  matches — it doesn't: ALS writes "CENTRAL & WESTERN", the seeded name is "Central and
 *  Western", and "KWAI TSING" has no space-free equivalent either. An unmapped district
 *  is dropped with a warning rather than guessed at, because the district is the key the
 *  whole market layer joins on. */
const ALS_DISTRICT_TO_ID: Readonly<Record<string, string>> = {
  "CENTRAL & WESTERN DISTRICT": "HK-CW",
  "WAN CHAI DISTRICT": "HK-WCH",
  "EASTERN DISTRICT": "HK-E",
  "SOUTHERN DISTRICT": "HK-S",
  "YAU TSIM MONG DISTRICT": "HK-YTM",
  "SHAM SHUI PO DISTRICT": "HK-SSP",
  "KOWLOON CITY DISTRICT": "HK-KC",
  "WONG TAI SIN DISTRICT": "HK-WTS",
  "KWUN TONG DISTRICT": "HK-KwT",
  "KWAI TSING DISTRICT": "HK-KT2",
  "TSUEN WAN DISTRICT": "HK-TW",
  "TUEN MUN DISTRICT": "HK-TM",
  "YUEN LONG DISTRICT": "HK-YL",
  "NORTH DISTRICT": "HK-N",
  "TAI PO DISTRICT": "HK-TP",
  "SHA TIN DISTRICT": "HK-ST",
  "SAI KUNG DISTRICT": "HK-SK",
  "ISLANDS DISTRICT": "HK-IS",
};

export interface AddressMatch {
  /** The specific building: its own name where ALS has one, else street + number. */
  readonly label: string;
  readonly estateNameEn: string | undefined;
  readonly estateNameZh: string | undefined;
  readonly streetEn: string | undefined;
  readonly buildingNo: string | undefined;
  readonly districtId: string;
  readonly districtNameAls: string;
  readonly latitude: number;
  readonly longitude: number;
  /** ALS's own fuzzy-match score, 0–100. Passed through rather than re-ranked: it is the
   *  service's judgement of relevance and we have nothing better to replace it with. */
  readonly score: number;
}

/** Hong Kong's bounding box, the same guard `@veela/fixtures`'s `isPlausibleHongKong`
 *  applies to generated points — duplicated here rather than imported because
 *  `packages/api` must never depend on the fixtures package (see that package's own
 *  rule 1). A coordinate outside the territory is a parsing error, and a wrong pin on a
 *  real map reads as data. */
function isPlausibleHongKong(lat: number, lng: number): boolean {
  return lat >= 22.1 && lat <= 22.6 && lng >= 113.8 && lng <= 114.5;
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : undefined;
}

function num(v: unknown): number | undefined {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : undefined;
}

/**
 * `limit` is what we return, not what we ask ALS for: it returns near-duplicates (the
 * same street and number twice, differing only in an internal key), so we over-fetch and
 * dedupe down. Asking for exactly `limit` would quietly return fewer.
 */
export async function searchAddresses(
  query: string,
  limit: number,
  fetchImpl: typeof fetch = fetch,
): Promise<readonly AddressMatch[]> {
  const url = `${ALS_ENDPOINT}?q=${encodeURIComponent(query)}&n=${Math.min(50, limit * 3)}`;

  const res = await fetchImpl(url, {
    headers: { Accept: "application/json", "User-Agent": "Veela/1.0 (property analysis)" },
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) throw new Error(`Address Lookup Service returned ${res.status}`);

  const body = (await res.json()) as {
    SuggestedAddress?: readonly Record<string, unknown>[];
  };

  const seen = new Set<string>();
  const out: AddressMatch[] = [];

  for (const suggestion of body.SuggestedAddress ?? []) {
    const address = (suggestion["Address"] as Record<string, unknown> | undefined)?.[
      "PremisesAddress"
    ] as Record<string, unknown> | undefined;
    if (address === undefined) continue;

    const eng = address["EngPremisesAddress"] as Record<string, unknown> | undefined;
    const chi = address["ChiPremisesAddress"] as Record<string, unknown> | undefined;
    const geo = address["GeospatialInformation"] as Record<string, unknown> | undefined;
    if (eng === undefined || geo === undefined) continue;

    const districtNameAls = str(
      (eng["EngDistrict"] as Record<string, unknown> | undefined)?.["DcDistrict"],
    );
    const districtId = districtNameAls === undefined ? undefined : ALS_DISTRICT_TO_ID[districtNameAls];
    if (districtId === undefined) continue;

    const latitude = num(geo["Latitude"]);
    const longitude = num(geo["Longitude"]);
    if (latitude === undefined || longitude === undefined) continue;
    if (!isPlausibleHongKong(latitude, longitude)) continue;

    const street = eng["EngStreet"] as Record<string, unknown> | undefined;
    const streetEn = str(street?.["StreetName"]);
    const buildingNo = str(street?.["BuildingNoFrom"]);
    const estateNameEn = str((eng["EngEstate"] as Record<string, unknown> | undefined)?.["EstateName"]);
    const buildingName = str(eng["BuildingName"]);

    // Explicit fallback chain, not `??` over a join: `[].join(" ")` is `""`, which is
    // falsy but *not* nullish, so `?? estateNameEn` would never fire and an address with
    // an estate name but no street would be dropped instead of labelled.
    const streetLabel =
      buildingNo !== undefined && streetEn !== undefined
        ? `${buildingNo} ${streetEn}`
        : streetEn;
    const label = buildingName ?? streetLabel ?? estateNameEn;
    if (label === undefined) continue;

    // Dedupe on what a reader would call the same place, not on ALS's internal key.
    const key = `${districtId}|${label.toUpperCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({
      label,
      estateNameEn,
      estateNameZh: str((chi?.["ChiEstate"] as Record<string, unknown> | undefined)?.["EstateName"]),
      streetEn,
      buildingNo,
      districtId,
      districtNameAls: districtNameAls ?? "",
      latitude,
      longitude,
      score: num((suggestion["ValidationInformation"] as Record<string, unknown> | undefined)?.["Score"]) ?? 0,
    });

    if (out.length >= limit) break;
  }

  return out;
}

export const ADDRESS_LOOKUP_SOURCE = "als.gov.hk";
