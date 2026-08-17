"use client";

import {
  DISTRICT_CENTRES,
  isPlausibleHongKong,
  type LatLng,
} from "@veela/fixtures";
import { standingColor, type Standing } from "@veela/ui";
import { AdvancedMarker, Circle, Map, useMap, useMapsLibrary } from "@vis.gl/react-google-maps";
import { useEffect, useMemo, useState } from "react";

/**
 * Mashvisor's own "Real Estate Heatmap" colours the map by neighbourhood performance
 * first and shows individual properties as clickable circles on top — this is that,
 * built on the one dataset that actually exists here: the fabricated listings, not a
 * real feed. Two layers:
 *
 * - **The wash** — one soft, low-opacity circle per district, coloured by the average
 *   net yield of whatever listings are currently passing the filters. It responds live
 *   to the filter bar, same as the real thing does, and it recedes rather than
 *   competes with the pins on top of it — this is context, not the headline.
 * - **The pins** — one per demo listing, coloured by the same `standingColor` bands as
 *   the wash and the property cards, so a colour always means the same thing wherever
 *   it appears on the page. Hovering one raises a small quick-stat card, matching
 *   Mashvisor's "hover for projected ROI" behaviour; clicking selects it, syncing with
 *   the card grid beside the map.
 *
 * **The caller supplies the position; this file no longer derives one.** It used to take a
 * `DemoListing` and compute district centroid + that listing's fixed offset — fine while every
 * pin was fabricated, and wrong the moment a *saved* property needed plotting, because a real
 * property has real coordinates and no district offset to add them to. A shared map had no
 * business knowing the shape of the demo fixture either. `PropertyFinder` still does the
 * centroid-plus-offset arithmetic for its generated listings (still not a real address, just
 * spread out enough to browse rather than stacking pins on eighteen points); the saved-property
 * finder passes coordinates the listing actually published. Anything outside Hong Kong is still
 * dropped here — a wrong pin on a real map reads as data, never as the bug it is.
 *
 * No `<APIProvider>` here — it used to wrap one locally, same as `district-map.tsx`
 * did, and the two independent instances were exactly what broke Market Finder after a
 * client-side navigation from here. One `APIProvider` now, at the root
 * (`components/maps-provider.tsx`); this assumes it's already inside it.
 */

/** Ceiling for the fit-to-bounds zoom — see the effect that applies it. */
const MAX_FIT_ZOOM = 16;

export interface FinderPin {
  readonly id: string;
  readonly position: LatLng;
  readonly standing: Standing;
  /** Accessible name / native tooltip fallback. */
  readonly label: string;
  readonly priceLabel: string;
  readonly yieldLabel: string;
  readonly metaLabel: string;
}

export interface DistrictHeat {
  readonly districtId: string;
  /** Resolved by the caller — `standingColor` bands for a yield-style metric,
   *  `viz.sequential` for a magnitude metric like price. Kept as a colour rather than
   *  a `Standing` here because "Heat Map Filters" can switch between the two, and only
   *  the caller (`property-finder.tsx`) knows which kind of metric is selected. */
  readonly color: string;
  readonly count: number;
}

interface Props {
  readonly pins: readonly FinderPin[];
  readonly heat: readonly DistrictHeat[];
  readonly selectedId: string | null;
  readonly onSelect: (id: string) => void;
  readonly heightClassName?: string;
}

const MAP_STYLE: NonNullable<React.ComponentProps<typeof Map>["styles"]> = [
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "road", stylers: [{ saturation: -80 }, { lightness: 40 }] },
  { featureType: "landscape", stylers: [{ saturation: -70 }, { lightness: 30 }] },
  { featureType: "water", stylers: [{ saturation: -30 }, { lightness: 20 }] },
];

export function ListingsMap({
  pins,
  heat,
  selectedId,
  onSelect,
  heightClassName = "h-[560px]",
}: Props): React.JSX.Element {
  return (
    <div
      className={`relative w-full overflow-hidden rounded-hero border border-line shadow-card ${heightClassName}`}
    >
      <Map
        defaultCenter={{ lat: 22.362, lng: 114.115 }}
        defaultZoom={10.4}
        gestureHandling="cooperative"
        disableDefaultUI
        zoomControl
        styles={MAP_STYLE}
        className="h-full w-full"
        mapId="veela-listings"
      >
        <HeatWash heat={heat} />
        <Pins pins={pins} selectedId={selectedId} onSelect={onSelect} />
      </Map>
    </div>
  );
}

/** The neighbourhood-performance wash, underneath everything else. Fixed radius — this
 *  is an indicative tint, not a claim about where a district's real boundary sits. */
function HeatWash({ heat }: { readonly heat: readonly DistrictHeat[] }): React.JSX.Element {
  return (
    <>
      {heat.flatMap((h) => {
        const centre = DISTRICT_CENTRES[h.districtId];
        if (centre === undefined) return [];
        return [
          <Circle
            key={h.districtId}
            center={centre}
            radius={1_300 + Math.min(h.count, 8) * 90}
            clickable={false}
            fillColor={h.color}
            fillOpacity={0.14}
            strokeColor={h.color}
            strokeOpacity={0.22}
            strokeWeight={1}
          />,
        ];
      })}
    </>
  );
}

function Pins({
  pins,
  selectedId,
  onSelect,
}: Pick<Props, "pins" | "selectedId" | "onSelect">): React.JSX.Element {
  const map = useMap();
  const core = useMapsLibrary("core");

  const positioned = useMemo(() => pins.filter((p) => isPlausibleHongKong(p.position)), [pins]);

  /**
   * Fit to whatever is on screen, then **cap the zoom.**
   *
   * `fitBounds` on a single point zooms to the maximum the basemap has, which produces a
   * featureless tile with one pin in the middle of it — no street, no coastline, nothing to
   * locate the property against. It never showed up while every caller passed 54 pins spread
   * across Hong Kong; it appeared immediately once a reader with **one** saved property could
   * map it. The same cap is already applied on the neighbourhood map, for the same reason.
   *
   * 16 is close enough to read street names and far enough to see which block you are on.
   */
  useEffect(() => {
    if (map === null || core === null || positioned.length === 0) return;
    const bounds = new core.LatLngBounds();
    for (const p of positioned) bounds.extend(p.position);
    map.fitBounds(bounds, { top: 48, bottom: 48, left: 48, right: 48 });

    /* Clamped on the next `idle` rather than immediately after `fitBounds`: the new zoom is not
       guaranteed to be readable on the same tick, so reading it straight away can clamp a stale
       value and leave the real one untouched. One-shot listener, removed either way. */
    const listener = map.addListener("idle", () => {
      const zoom = map.getZoom();
      if (zoom !== undefined && zoom > MAX_FIT_ZOOM) map.setZoom(MAX_FIT_ZOOM);
      listener.remove();
    });
    return () => listener.remove();
  }, [map, core, positioned]);

  return (
    <>
      {positioned.map((p) => (
        <Pin
          key={p.id}
          pin={p}
          position={p.position}
          selected={p.id === selectedId}
          onSelect={() => onSelect(p.id)}
        />
      ))}
    </>
  );
}

function Pin({
  pin,
  position,
  selected,
  onSelect,
}: {
  readonly pin: FinderPin;
  readonly position: LatLng;
  readonly selected: boolean;
  readonly onSelect: () => void;
}): React.JSX.Element {
  const [hovered, setHovered] = useState(false);
  const colour = standingColor[pin.standing];

  return (
    <AdvancedMarker
      position={position}
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={pin.label}
      zIndex={selected || hovered ? 10 : 1}
    >
      <div className="relative">
        {(hovered || selected) && (
          <div className="pointer-events-none absolute bottom-full left-1/2 mb-2 w-max max-w-[11rem] -translate-x-1/2 rounded-panel border border-line bg-surface px-3 py-2 text-left shadow-lift">
            <p className="text-[11px] font-semibold leading-snug text-mist">
              {pin.priceLabel}
            </p>
            <p className="tnum text-[11px] font-medium leading-snug" style={{ color: colour }}>
              {pin.yieldLabel} net yield
            </p>
            <p className="mt-0.5 text-[10px] leading-snug text-muted">{pin.metaLabel}</p>
          </div>
        )}
        <span
          className="block rounded-full transition-transform duration-150"
          style={{
            width: selected ? 18 : 13,
            height: selected ? 18 : 13,
            backgroundColor: colour,
            border: "2px solid #FFFFFF",
            boxShadow: selected || hovered ? `0 0 0 4px ${colour}33` : "0 1px 3px rgba(12,26,43,0.35)",
          }}
        />
      </div>
    </AdvancedMarker>
  );
}
