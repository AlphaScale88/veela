"use client";

import { AdvancedMarker, Map } from "@vis.gl/react-google-maps";

import { MAP_STYLE } from "./district-map";

/**
 * A single pin at a listing's own coordinates, dropped in next to the paste-a-link
 * importer. Not the district-level explorer elsewhere in this app — that one only ever
 * locates a *demo* district centroid, generated fixture data plainly labelled as such.
 * This is the one place a real, page-published address gets a real marker, so it reuses
 * `DistrictMap`'s muted basemap styling to read as the same product rather than a
 * second, slightly different one, without reusing the component itself — a single fixed
 * pin needs none of `DistrictMap`'s sizing or selection machinery.
 *
 * Renders unconditionally once mounted — the "no key, no map" decision belongs to the
 * caller, the same way `market-explorer.tsx` and `map-preview.tsx` already check
 * `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` themselves before ever rendering a `<Map>`.
 */
interface Props {
  readonly latitude: number;
  readonly longitude: number;
  readonly label: string;
}

export function ImportedListingMap({ latitude, longitude, label }: Props): React.JSX.Element {
  const position = { lat: latitude, lng: longitude };
  return (
    <div className="relative h-[440px] w-full overflow-hidden rounded-card border border-line shadow-card">
      <Map
        defaultCenter={position}
        defaultZoom={16}
        gestureHandling="cooperative"
        disableDefaultUI
        zoomControl
        styles={MAP_STYLE}
        className="h-full w-full"
        // A stable id is what Advanced Markers require — same reasoning as DistrictMap.
        mapId="veela-imported-listing"
      >
        <AdvancedMarker position={position} title={label} />
      </Map>
    </div>
  );
}
