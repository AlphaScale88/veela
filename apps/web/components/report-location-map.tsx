"use client";

import { AdvancedMarker, Map } from "@vis.gl/react-google-maps";
import { DISTRICT_CENTRES } from "@veela/fixtures";

import { MAP_STYLE } from "./district-map";

/**
 * Where the flat is, next to the photographs — and the distinction that decides what it may claim.
 *
 * The report had a column of empty space beside the photo card, which is a good reason to put a map
 * there and a bad reason to invent a location for it. So this renders **one of two different
 * things**, and says which:
 *
 * - **A real position** (`precise`) — the coordinates a listing published, or the building the
 *   reader picked themselves. A pin at zoom 16 is a true statement about a real place.
 * - **A district centre** (`district`) — everything else. The pin sits on the district's centroid at
 *   a zoom where a whole district is visible, and the caption says outright that it marks the
 *   district and not the flat.
 *
 * **The second case is the one that needed care.** A sample listing has no address by design — no
 * building name, no street, no unit — so a tight pin next to one would assert a specific location
 * for a flat that does not exist. This file's own codebase already learned that "a wrong pin on a
 * real map reads as data, never as the parsing bug it is"; an invented pin reads the same way. The
 * fix is not to hide the map but to zoom it out to the level the data actually supports: the
 * district is real, so show the district.
 *
 * `DISTRICT_CENTRES` is the one genuinely non-synthetic thing in the fixtures package, and it is
 * accurate to a few hundred metres — fine for "this district is here", useless for an address,
 * which is exactly the claim the caption makes.
 */
export function ReportLocationMap({
  latitude,
  longitude,
  districtId,
  districtName,
  label,
}: {
  readonly latitude: number | undefined;
  readonly longitude: number | undefined;
  readonly districtId: string | null;
  readonly districtName: string | null;
  readonly label: string | undefined;
}): React.JSX.Element | null {
  const precise =
    latitude !== undefined && longitude !== undefined ? { lat: latitude, lng: longitude } : null;

  const centre = districtId === null ? undefined : DISTRICT_CENTRES[districtId];
  const position = precise ?? (centre !== undefined ? { lat: centre.lat, lng: centre.lng } : null);

  // No coordinates and no district: nothing truthful to draw, so nothing is drawn.
  if (position === null) return null;

  return (
    <figure className="flex flex-col overflow-hidden rounded-card border border-line bg-surface shadow-card">
      {/* `mapId` is required for Advanced Markers and makes Google prefer Cloud styling over the
          inline array, so its own POI labels show through — noted against every other map in this
          app, and it matters least here, where the point is orientation rather than precision. */}
      <div className="relative aspect-[16/10] w-full">
        <Map
          defaultCenter={position}
          /* Zoom carries the claim. 16 puts you on a street for a real address; 13 shows a whole
             district, which is the most a centroid can honestly support. */
          defaultZoom={precise !== null ? 16 : 13}
          gestureHandling="cooperative"
          disableDefaultUI
          zoomControl
          styles={MAP_STYLE}
          className="h-full w-full"
          mapId="veela-report-location"
        >
          <AdvancedMarker
            position={position}
            title={precise !== null ? (label ?? "This property") : (districtName ?? "District")}
          >
            {precise !== null ? (
              <span className="block h-3.5 w-3.5 rounded-full border-2 border-white bg-accent shadow-lift" />
            ) : (
              /* Visibly a different kind of mark from a real pin: a soft ring, not a dot, because
                 it stands for an area rather than a point. */
              <span className="block h-7 w-7 rounded-full border-2 border-accent bg-accent/25 shadow-card" />
            )}
          </AdvancedMarker>
        </Map>
      </div>

      <figcaption className="border-t border-line px-3.5 py-2.5 text-xs leading-relaxed text-muted">
        {precise !== null ? (
          <>
            <strong className="text-mist">{label ?? "This property"}</strong> — the location this
            report is about, from the coordinates the listing published or the building you picked.
          </>
        ) : (
          <>
            <strong className="text-mist">{districtName} — the district, not the flat.</strong> A
            sample listing carries no address by design, so this ring marks the centre of the
            district and nothing more precise. Pick a building above, or import a listing that
            publishes coordinates, and this becomes an actual pin.
          </>
        )}
      </figcaption>
    </figure>
  );
}
