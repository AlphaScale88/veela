"use client";

import {
  DEMO_METRICS,
  DEMO_PERIODS,
  demoLatest,
} from "@veela/fixtures";
import { useRouter } from "next/navigation";
import { useMemo } from "react";

import { Choropleth } from "./choropleth";
import { DistrictMap, normaliseDistrictValues } from "./district-map";

/**
 * Landing-page proof, not a second explorer. The full filterable view lives at `/map`;
 * this is a single fixed metric (vacancy) at a compact height, so the claim "search
 * happens on a map" is something you can see on the page that makes it, not just a
 * link promising it.
 *
 * No side panel and no selection state here — there is nowhere on the landing page for
 * a selected district's detail to go. Clicking a symbol instead takes you to the real
 * explorer, which **is** somewhere a selection means something. That keeps the preview
 * honest: it never pretends to be interactive in a way it cannot follow through on.
 */
interface Props {
  /** Tailwind height class(es). Defaults to a compact embed; the landing hero passes a
   *  taller one so the map reads as the product, not as an illustration of it. */
  readonly heightClassName?: string;
  /** Off by default for a small embed (visual clutter at that size); the caller turns
   *  it on once there's room for it to be genuinely useful. */
  readonly showZoomControl?: boolean;
}

export function MapPreview({
  heightClassName = "h-[340px]",
  showZoomControl = false,
}: Props): React.JSX.Element {
  const router = useRouter();
  const metric = "vacancy_rate" as const;
  const periodStart = DEMO_PERIODS[DEMO_PERIODS.length - 1];

  const values = useMemo(() => demoLatest(metric, periodStart), [periodStart]);
  const mapData = useMemo(() => normaliseDistrictValues(values, metric), [values]);

  const mapsKey = process.env["NEXT_PUBLIC_GOOGLE_MAPS_API_KEY"];
  const goToExplorer = (): void => router.push("/map");

  return (
    <div>
      {mapsKey === undefined || mapsKey === "" ? (
        <Choropleth
          metric={metric}
          values={values}
          selectedId={null}
          onSelect={goToExplorer}
        />
      ) : (
        <DistrictMap
          data={mapData}
          selectedId={null}
          onSelect={goToExplorer}
          metricLabel={DEMO_METRICS[metric].label}
          heightClassName={heightClassName}
          gestureHandling="cooperative"
          showZoomControl={showZoomControl}
        />
      )}
      <p className="mt-3 text-xs leading-relaxed text-muted">
        {DEMO_METRICS[metric].label}, by district — <span className="text-caution">synthetic
        demo data</span>. Click a district to open the full map.
      </p>
    </div>
  );
}
