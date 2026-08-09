/**
 * **Real geography — the one file in this package that is not synthetic.**
 *
 * Everything else in `@veela/fixtures` is invented and carries the demo banner. These
 * coordinates are not: they are the approximate centres of Hong Kong's eighteen
 * administrative districts, and they are here rather than in `districts.ts` precisely so
 * that nobody has to wonder which half of that file is made up.
 *
 * **They are centroids, not boundaries.** Approximate to a few hundred metres, which is
 * fine for placing a district-level symbol and useless for anything that needs an edge.
 * A property does not sit "in" one of these points — it sits in a district whose outline
 * we do not have.
 *
 * ## Why symbols and not a choropleth
 *
 * A choropleth needs polygons. We have none: Lands Department geometry is not ingested,
 * and the schematic blobs in `districts.ts` are deliberately not a coastline. Drawing a
 * choropleth from invented outlines on top of a *real* basemap would be the worst of
 * both — the map would look authoritative and the shapes would be fiction.
 *
 * A **proportional symbol** map is the correct form when you have values located at
 * points but no areas. It is not a downgrade; it is the honest shape of this data, and
 * it stops being necessary the day real boundaries arrive.
 *
 * Two ways to get those, when it matters:
 * - Google's **data-driven styling for boundaries** — administrative polygons served by
 *   Google, no geometry to host. Verify it covers Hong Kong's district level before
 *   depending on it.
 * - **Lands Department open data**, which is authoritative and ours to host.
 */

/** WGS 84. The order is (lat, lng), matching the Google Maps API. */
export interface LatLng {
  readonly lat: number;
  readonly lng: number;
}

/**
 * Approximate district centres, keyed by the ids in `districts.ts`.
 *
 * Sanity-checked against Hong Kong's real extent: latitudes fall between 22.15 and
 * 22.56, longitudes between 113.83 and 114.44. A value outside that is a typo, and
 * `assertPlausible` below will say so rather than let a marker land in the sea.
 */
export const DISTRICT_CENTRES: Readonly<Record<string, LatLng>> = {
  // Hong Kong Island
  "HK-CW": { lat: 22.287, lng: 114.155 }, // Central and Western
  "HK-WCH": { lat: 22.279, lng: 114.173 }, // Wan Chai
  "HK-E": { lat: 22.283, lng: 114.224 }, // Eastern
  "HK-S": { lat: 22.247, lng: 114.16 }, // Southern

  // Kowloon
  "HK-YTM": { lat: 22.305, lng: 114.17 }, // Yau Tsim Mong
  "HK-SSP": { lat: 22.33, lng: 114.162 }, // Sham Shui Po
  "HK-KC": { lat: 22.328, lng: 114.191 }, // Kowloon City
  "HK-WTS": { lat: 22.342, lng: 114.193 }, // Wong Tai Sin
  "HK-KwT": { lat: 22.313, lng: 114.226 }, // Kwun Tong

  // New Territories
  "HK-KT2": { lat: 22.356, lng: 114.13 }, // Kwai Tsing
  "HK-TW": { lat: 22.371, lng: 114.114 }, // Tsuen Wan
  "HK-TM": { lat: 22.391, lng: 113.977 }, // Tuen Mun
  "HK-YL": { lat: 22.445, lng: 114.022 }, // Yuen Long
  "HK-N": { lat: 22.494, lng: 114.138 }, // North
  "HK-TP": { lat: 22.45, lng: 114.167 }, // Tai Po
  "HK-ST": { lat: 22.383, lng: 114.189 }, // Sha Tin
  "HK-SK": { lat: 22.381, lng: 114.271 }, // Sai Kung
  "HK-IS": { lat: 22.261, lng: 113.946 }, // Islands
} as const;

/** Centre and zoom that frame the whole territory on a desktop viewport. */
export const HK_VIEW = {
  centre: { lat: 22.362, lng: 114.115 } as LatLng,
  zoom: 10.4,
} as const;

/** Hong Kong's real bounding box, generously rounded. */
export const HK_BOUNDS = {
  south: 22.13,
  north: 22.58,
  west: 113.81,
  east: 114.46,
} as const;

/**
 * A coordinate outside Hong Kong is a transcription error, and the failure mode is a
 * marker quietly placed in the South China Sea — which looks like data rather than like
 * a bug. Cheap to check, so check.
 */
export function isPlausibleHongKong(p: LatLng): boolean {
  return (
    p.lat >= HK_BOUNDS.south &&
    p.lat <= HK_BOUNDS.north &&
    p.lng >= HK_BOUNDS.west &&
    p.lng <= HK_BOUNDS.east
  );
}
