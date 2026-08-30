"use client";

import { AdvancedMarker, Circle, Map, useMap, useMapsLibrary } from "@vis.gl/react-google-maps";
import { useEffect } from "react";

import { MAP_STYLE } from "./district-map";

/**
 * The neighbourhood list, plotted.
 *
 * The counts answered "how well served is this area" and the drill-down answered "by what".
 * Neither answered **"in which direction, and is it all on one side?"** — which is the
 * question a straight-line distance most obviously raises. Two properties can each have
 * "12 shops within 600m" and be completely different places: one ringed, one with everything
 * across a motorway.
 *
 * **The coordinates were always there.** `metres` is computed from each item's own lat/lng
 * in `neighbourhood.ts` and the pair was then discarded; this map is mostly the API keeping
 * what it already had (payload version 3).
 *
 * ## What the drawing does and doesn't claim
 *
 * - **The radius ring is the real search radius** for whichever category is shown, not a
 *   decorative circle — 600m for shops, 900m for transport. Drawing one ring while the pins
 *   obey a different bound would be a lie about the query.
 * - **Straight-line, still.** A pin 300m away can be a 900m walk around a podium or across
 *   a nullah. The ring makes that limitation *visible* rather than hiding it: everything
 *   inside the circle is inside the circle, and nothing about the drawing implies a route.
 * - **Pins are OSM `center` points** for anything mapped as an area, so a school pin sits in
 *   the middle of its campus, not at its gate.
 *
 * Renders only when a Maps key exists — the caller checks, exactly as `market-explorer.tsx`,
 * `map-preview.tsx` and `imported-listing-map.tsx` already do, per the app's
 * zero-configuration rule.
 *
 * ## A known limitation, stated because it is visible
 *
 * **Google's own POI icons show through, and `MAP_STYLE` cannot switch them off here.**
 * Advanced Markers require a `mapId`, and a `mapId` makes Google prefer Cloud-console
 * styling over the inline `styles` array — already noted against `ImportedListingMap`, but
 * it bites harder on this map, because Google's labelled teardrops are *also* nearby places
 * and could be read as ours. Mitigated rather than solved: our pins are ringed in white with
 * a shadow so they sit visibly above the basemap, the legend names every colour, and the
 * fit-to-bounds zoom is capped one step out from maximum, where POI labels are densest.
 * A real fix means a Cloud Console map style, which this project does not have.
 */

export type AmenityKind =
  | "school"
  | "transport"
  | "bus"
  | "shop"
  | "health"
  | "park"
  | "premium"
  | "construction";

export interface MapAmenity {
  readonly kind: AmenityKind;
  readonly name: string;
  readonly subtype: string;
  readonly metres: number;
  readonly latitude: number;
  readonly longitude: number;
}

/**
 * A colour per category, so a mixed map is readable without clicking every pin.
 *
 * **Deliberately not the app's status palette.** `standingColor`'s red/amber/green means
 * *good, fair, weak* everywhere else in this product, and a red pin for "health" would
 * import that meaning onto a category where it is nonsense — a hospital is not a bad
 * outcome. These are categorical hues, chosen to be distinguishable, carrying no ranking.
 * The same reasoning the map's own heat-map dropdown uses when it switches to a sequential
 * ramp for price per square foot.
 */
const KIND_PIN: Readonly<Record<AmenityKind, string>> = {
  school: "#7C4DFF",
  transport: "#0B5BD3",
  /* A lighter blue than rail's: the two are related modes, so related hues, but distinct
     enough to tell a bus stop from a station at a glance. */
  bus: "#4FA3F7",
  shop: "#00897B",
  health: "#D81B60",
  park: "#2E7D32",
  premium: "#B8860B",
  construction: "#6D6D6D",
};

/** Mirrors `RADIUS` in `packages/api/src/neighbourhood.ts` — see the note on `RADIUS_M` in
 *  `neighbourhood-panel.tsx`: display copy duplicated knowingly rather than pulling the
 *  compiled server bundle into a client component. Edit both together. */
const RADIUS_M: Readonly<Record<AmenityKind, number>> = {
  school: 800,
  transport: 900,
  bus: 500,
  shop: 600,
  health: 800,
  park: 700,
  premium: 900,
  construction: 900,
};

interface Props {
  readonly latitude: number;
  readonly longitude: number;
  /** The property's own label, for the centre pin's tooltip. */
  readonly label?: string | undefined;
  /** Exactly what the list beside it shows — one category when a count is expanded, the
   *  closest few otherwise. Passing a different slice than the list would recreate the
   *  count/list disagreement the drill-down was built to remove. */
  readonly items: readonly MapAmenity[];
  /** Set when a single category is expanded: draws that category's real search radius. */
  readonly radiusKind?: AmenityKind | undefined;
  /** Hovered in the list, so the matching pin can be raised. Keyed by name+metres, which is
   *  what the list's own React key uses. */
  readonly highlightKey?: string | null | undefined;
}

export function NeighbourhoodMap({
  latitude,
  longitude,
  label,
  items,
  radiusKind,
  highlightKey,
}: Props): React.JSX.Element {
  const centre = { lat: latitude, lng: longitude };

  return (
    <div className="relative h-[360px] w-full overflow-hidden rounded-card border border-line">
      <Map
        defaultCenter={centre}
        defaultZoom={15}
        gestureHandling="cooperative"
        disableDefaultUI
        zoomControl
        styles={MAP_STYLE}
        className="h-full w-full"
        mapId="veela-neighbourhood"
      >
        <FitToItems centre={centre} items={items} />

        {radiusKind !== undefined && (
          <Circle
            center={centre}
            radius={RADIUS_M[radiusKind]}
            strokeColor={KIND_PIN[radiusKind]}
            strokeOpacity={0.5}
            strokeWeight={1}
            fillColor={KIND_PIN[radiusKind]}
            fillOpacity={0.05}
          />
        )}

        {/* The property itself — a filled ring, visually unlike the amenity dots so it is
            never mistaken for one of them. */}
        <AdvancedMarker position={centre} title={label ?? "This property"} zIndex={40}>
          <div className="h-4 w-4 rounded-full border-2 border-white bg-accent shadow-lift" />
        </AdvancedMarker>

        {items.map((a) => {
          const key = `${a.kind}-${a.name}-${a.metres}`;
          const active = highlightKey === key;
          return (
            <AdvancedMarker
              key={key}
              position={{ lat: a.latitude, lng: a.longitude }}
              title={`${a.name} — ${a.metres} m`}
              zIndex={active ? 30 : 10}
            >
              {/* Sized and ringed to sit clearly *above* the basemap — see the note on
                  Google's own POI icons in the component doc. A 10px flat dot lost that
                  contest against Google's labelled teardrops when this was first drawn. */}
              <div
                className={`rounded-full border-2 border-white shadow-card transition-transform ${
                  active ? "h-4 w-4 scale-125 shadow-lift" : "h-3 w-3"
                }`}
                style={{ backgroundColor: KIND_PIN[a.kind] }}
              />
            </AdvancedMarker>
          );
        })}
      </Map>
    </div>
  );
}

/**
 * Frame the pins rather than trusting a fixed zoom.
 *
 * A 600m shop radius and a 900m transport radius do not fit the same viewport, and a single
 * `defaultZoom` either crops the far pins or leaves a mostly-empty map. This fits the bounds
 * of what is actually drawn, **always including the property itself** so the centre never
 * scrolls out of frame, then pads so pins are not stuck to the edge.
 *
 * Guarded against the one-item case: `fitBounds` on a degenerate box zooms to maximum, which
 * would show a single shop and no context at all.
 */
function FitToItems({
  centre,
  items,
}: {
  readonly centre: { lat: number; lng: number };
  readonly items: readonly MapAmenity[];
}): null {
  const map = useMap();
  /**
   * `useMapsLibrary`, **not the global `google` object** — this repo's own note on the 2024
   * codebase says reaching for that global "works right until a slow network, a failure that
   * appears for users and never for developers". It is also the honest type: the constructor
   * genuinely does not exist until the library has loaded.
   */
  const core = useMapsLibrary("core");

  /*
   * Keyed on the *positions*, not on the array.
   *
   * `items` was in the dependency list directly, and the panel above builds it fresh on every
   * render. Anything that re-rendered the panel — hovering a row in the list, which it does
   * through `highlightKey` — therefore handed this effect a new array identity, re-ran it, and
   * re-fitted the map. `fitBounds` jumps the camera, the `idle` clamp pulls it back to 16, the
   * next render fits again: the map zoomed in and out without stopping, which is exactly how it
   * was reported.
   *
   * A string of the coordinates changes when the points change and not when React re-renders,
   * so the camera moves when there is something new to frame and stays still otherwise.
   */
  const fitKey = `${centre.lat},${centre.lng}|${items
    .map((a) => `${a.latitude},${a.longitude}`)
    .join(";")}`;

  useEffect(() => {
    if (map === null || core === null) return;

    if (items.length === 0) {
      map.setCenter(centre);
      map.setZoom(15);
      return;
    }

    const bounds = new core.LatLngBounds();
    bounds.extend(centre);
    for (const a of items) bounds.extend({ lat: a.latitude, lng: a.longitude });
    map.fitBounds(bounds, 48);

    // fitBounds on a tiny box over-zooms; cap it so there is always context around the pin.
    const listener = map.addListener("idle", () => {
      const z = map.getZoom();
      // Capped at 16, not 17: the ten closest places in a dense district sit within ~130m,
      // which fits at maximum zoom — exactly where Google's own POI labels are densest and
      // most likely to be mistaken for our pins. One step out costs nothing and calms it.
      if (z !== undefined && z > 16) map.setZoom(16);
      listener.remove();
    });
    return () => listener.remove();
    // `items` and `centre` are read above but deliberately not listed: `fitKey` is their
    // content, and listing the objects themselves is what caused the loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, core, fitKey]);

  return null;
}

export { KIND_PIN };
