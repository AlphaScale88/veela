"use client";

import {
  DEMO_DISTRICTS,
  DISTRICT_CENTRES,
  formatDemoValue,
  HK_VIEW,
  isPlausibleHongKong,
  type DemoDistrict,
  type DemoMetric,
} from "@veela/fixtures";
import { viz } from "@veela/ui";
import { AdvancedMarker, Map, useMap, useMapsLibrary } from "@vis.gl/react-google-maps";
import { useEffect, useMemo } from "react";

/**
 * Hong Kong on a real basemap.
 *
 * ## Why symbols and not filled districts
 *
 * A choropleth needs polygons and we have none — Lands Department geometry is not
 * ingested, and the schematic blobs in the fixtures are explicitly not a coastline.
 * Drawing those invented outlines on top of a *real* map would be the worst possible
 * combination: the basemap would lend authority to shapes that are fiction, and nobody
 * looking at it could tell which part was which.
 *
 * A **proportional symbol** map is the right form for values located at points with no
 * areas. Circle area — not radius — encodes the value, because area is what the eye
 * actually compares; scaling the radius by the value exaggerates large districts by the
 * square. It stops being necessary the day real boundaries arrive, and then this
 * component grows a polygon layer instead of being replaced.
 *
 * ## The key is not optional, and the app must survive not having one
 *
 * Google Maps needs an API key and a billing account. This component renders nothing
 * without one — the *caller* decides what to show instead, which keeps the promise the
 * rest of this codebase makes: it runs with zero configuration.
 *
 * ## One `APIProvider`, and it isn't this component's job to mount it
 *
 * This used to wrap itself in its own `<APIProvider>`. `ListingsMap` (`/finder`) did
 * the same, independently. Navigating between the two client-side — no full reload —
 * meant two `APIProvider` instances racing to load the same Google Maps script in one
 * page session, and the map that finished second came up empty. The fix was moving
 * `APIProvider` to exactly one place, `components/maps-provider.tsx`, mounted once at
 * the root layout. This component now assumes it's already inside one.
 */

export interface DistrictDatum {
  readonly district: DemoDistrict;
  /** Normalised 0–1 within the current metric, for the colour ramp. */
  readonly t: number;
  /** Raw value, for the marker's accessible label. */
  readonly value: number;
  readonly formatted: string;
}

/**
 * Turn a raw metric map into the 0–1-normalised shape the map (and the choropleth)
 * consume. Pulled out from the explorer so a second call site — the landing-page
 * preview — cannot drift from how "what does this colour mean" is computed.
 *
 * Normalised **within the values passed in**, not against a fixed scale: a fixed scale
 * across metrics would make vacancy and transaction counts share an axis they have no
 * business sharing, and it's why this takes the metric only to format the label.
 *
 * `format` overrides that labelling. Real RVD/Census metrics (`stock_units`,
 * `population`, …) are not `DemoMetric`s and have no `DEMO_METRICS` entry to look a
 * formatter up in, so they pass their own — the geometry above is identical either way,
 * which is the point of routing both through one function.
 */
export function normaliseDistrictValues(
  values: ReadonlyMap<string, number>,
  metric: DemoMetric,
  format?: (value: number) => string,
): readonly DistrictDatum[] {
  const nums = [...values.values()].filter((n) => Number.isFinite(n));
  if (nums.length === 0) return [];
  const lo = Math.min(...nums);
  const hi = Math.max(...nums);
  const span = hi - lo;
  return DEMO_DISTRICTS.flatMap((district) => {
    const value = values.get(district.id);
    if (value === undefined) return [];
    return [
      {
        district,
        value,
        // A flat series would divide by zero; mid-scale is the honest answer for it.
        t: span === 0 ? 0.5 : (value - lo) / span,
        formatted: format?.(value) ?? formatDemoValue(metric, value),
      },
    ];
  });
}

interface Props {
  readonly data: readonly DistrictDatum[];
  readonly selectedId: string | null;
  readonly onSelect: (id: string) => void;
  readonly metricLabel: string;
  /** Tailwind height class for the map's box. Defaults to the full explorer size. */
  readonly heightClassName?: string;
  /**
   * "greedy" traps a one-finger drag and a bare wheel as map gestures — right for a
   * full-page map, wrong for one embedded in a scrolling page, where it fights the
   * page's own scroll. "cooperative" requires two fingers / Ctrl+wheel and shows a
   * hint instead of trapping the gesture. Default matches the previous behaviour.
   */
  readonly gestureHandling?: "greedy" | "cooperative";
  /** Independent of gesture handling — a compact teaser embed omits the button cluster
   *  on purpose; a full-page map keeps it. Defaults to shown. */
  readonly showZoomControl?: boolean;
}

/**
 * Muted basemap. The data has to be the loudest thing on the map, and Google's default
 * styling — coloured POIs, saturated roads, business labels — competes hard with a
 * scatter of translucent circles. Everything that is not coastline, water or a place
 * name is turned down.
 */
export type MapStyle = NonNullable<React.ComponentProps<typeof Map>["styles"]>;

/** Exported so a single-pin map (`imported-listing-map.tsx`) reads as the same product
 *  as this one, rather than growing its own slightly-different muted palette. */
export const MAP_STYLE: MapStyle = [
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "road", stylers: [{ saturation: -80 }, { lightness: 40 }] },
  { featureType: "landscape", stylers: [{ saturation: -70 }, { lightness: 30 }] },
  { featureType: "water", stylers: [{ saturation: -30 }, { lightness: 20 }] },
  {
    featureType: "administrative",
    elementType: "geometry.stroke",
    stylers: [{ visibility: "on" }, { lightness: 20 }],
  },
];

export function DistrictMap({
  data,
  selectedId,
  onSelect,
  metricLabel,
  heightClassName = "h-[520px]",
  gestureHandling = "greedy",
  showZoomControl = true,
}: Props): React.JSX.Element {
  return (
    <>
      <div
        className={`relative w-full overflow-hidden rounded-hero border border-line shadow-card ${heightClassName}`}
      >
        <Map
          defaultCenter={HK_VIEW.centre}
          defaultZoom={HK_VIEW.zoom}
          gestureHandling={gestureHandling}
          disableDefaultUI
          zoomControl={showZoomControl}
          styles={MAP_STYLE}
          className="h-full w-full"
          // A stable id is what Advanced Markers require; without it they silently fall
          // back and the styling below is ignored.
          mapId="veela-districts"
        >
          <Symbols
            data={data}
            selectedId={selectedId}
            onSelect={onSelect}
            metricLabel={metricLabel}
          />
        </Map>
      </div>
    </>
  );
}

function Symbols({
  data,
  selectedId,
  onSelect,
  metricLabel,
}: Props): React.JSX.Element {
  const map = useMap();
  /**
   * Not the global `google`. That object exists only once the Maps script has run, and
   * reaching for it directly works right up until a slow network — a failure that
   * appears for users and never for developers. This hook resolves when the library is
   * actually ready, and is `null` until then.
   */
  const core = useMapsLibrary("core");

  // Re-frame on the districts we actually have, rather than trusting a hard-coded zoom
  // to suit every viewport.
  useEffect(() => {
    if (map === null || core === null || data.length === 0) return;
    const bounds = new core.LatLngBounds();
    for (const d of data) {
      const p = DISTRICT_CENTRES[d.district.id];
      if (p !== undefined) bounds.extend(p);
    }
    map.fitBounds(bounds, { top: 48, bottom: 48, left: 48, right: 48 });
  }, [map, core, data]);

  /**
   * Circle **area** scales with the value; the radius therefore scales with its square
   * root. A minimum keeps the smallest district clickable — a 3px target is a target
   * nobody hits.
   */
  const sized = useMemo(
    () =>
      data.map((d) => ({
        ...d,
        px: Math.round(16 + Math.sqrt(Math.max(d.t, 0)) * 30),
        centre: DISTRICT_CENTRES[d.district.id],
      })),
    [data],
  );

  return (
    <>
      {sized.map((d) => {
        if (d.centre === undefined || !isPlausibleHongKong(d.centre)) return null;
        const selected = d.district.id === selectedId;
        return (
          <AdvancedMarker
            key={d.district.id}
            position={d.centre}
            onClick={() => onSelect(d.district.id)}
            title={`${d.district.nameEn} — ${metricLabel} ${d.formatted}`}
          >
            {/* Colour carries the same value as size, deliberately. Redundant encoding
                is what lets the map stay readable in greyscale and to a colour-blind
                reader, and it costs nothing here. */}
            <span
              className="block rounded-full transition-[box-shadow,transform] duration-150"
              style={{
                width: d.px,
                height: d.px,
                backgroundColor: rampColour(d.t),
                border: `2px solid ${selected ? viz.demand : viz.surface}`,
                boxShadow: selected ? `0 0 0 4px ${viz.demand}33` : "none",
                transform: selected ? "scale(1.08)" : "none",
              }}
            />
          </AdvancedMarker>
        );
      })}
    </>
  );
}

/** The validated sequential ramp, indexed by the normalised value. */
function rampColour(t: number): string {
  const ramp = viz.sequential;
  const i = Math.min(ramp.length - 1, Math.max(0, Math.round(t * (ramp.length - 1))));
  return `${ramp[i]}D9`; // ~85% alpha, so overlapping symbols stay legible
}
