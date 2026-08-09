import { MarketExplorer } from "../../components/market-explorer";

/**
 * Map-first discovery. The explorer is a client island; this shell stays a Server
 * Component.
 *
 * Everything it renders is synthetic — see `@veela/fixtures`. The banner inside the
 * explorer says so, and the fixtures package is deliberately not importable from the
 * API or the database layer, so demo numbers cannot leak into a real code path.
 */
export default function MapPage(): React.JSX.Element {
  return (
    /* This page never got the shared `.col` wrapper the rest of the site uses — it sat
       flush against the viewport edge with no side margin, which is what "content is
       too far left" was actually describing. Every other route (`/`, `/analyse`) is
       centred in `max-w-page` with side padding via `.col`; this one now matches. */
    <div className="col space-y-8 py-14">
      <header className="max-w-prose space-y-2">
        <p className="eyebrow">Discovery · Hong Kong</p>
        {/* font-extrabold to match the landing hero's weight — see app/page.tsx. */}
        <h1 className="font-display text-[34px] font-extrabold leading-tight tracking-[-0.03em]">
          Supply and demand, by district
        </h1>
        <p className="text-[15px] leading-relaxed text-muted">
          Vacancy against transaction volume, over a long series, is a defensible read on
          whether a district is tightening or loosening. Every series here comes from free
          public data — once the ingestion job exists.
        </p>
      </header>

      <MarketExplorer />

      <p className="card text-xs leading-relaxed text-muted">
        <strong className="text-mist">On precision.</strong> The real RVD series are
        published by Class and district, Centaline&apos;s by estate, and Lands Department
        geometry is per building. A district figure shown on a single building is
        indicative, not specific to it — the join between those levels is the hard part,
        and the UI will label which level every number was measured at rather than imply
        more than the data supports.
      </p>
    </div>
  );
}
