import { AppShell } from "../../components/app-shell";
import { MarketExplorer } from "../../components/market-explorer";

/**
 * Map-first discovery. The explorer is a client island; this shell stays a Server
 * Component.
 *
 * Moved into `AppShell` on 10/08/2026 along with `/analyse` — it is one of the product's
 * two main tools and sat behind the marketing header, looking like a different
 * application from `/finder` beside it. See `site-chrome.tsx` for the full reasoning.
 */
export default function MapPage(): React.JSX.Element {
  return (
    <AppShell breadcrumb="Market Explorer · Hong Kong">
      <div className="space-y-8">
      <header className="max-w-prose space-y-2">
        <p className="eyebrow">Discovery · Hong Kong</p>
        {/* font-extrabold to match the landing hero's weight — see app/page.tsx. */}
        <h1 className="font-display text-[34px] font-extrabold leading-tight tracking-[-0.03em]">
          Market Explorer
        </h1>
        <p className="text-[15px] leading-relaxed text-muted">
          Vacancy against transaction volume, over a long series, is a defensible read on
          whether a district is tightening or loosening. Every figure in a district panel is{" "}
          <strong className="text-mist">measured</strong> — stock and vacancy and forward
          supply from the RVD, population and rent from the 2021 Census, and household income
          annually since 2001 from the General Household Survey. The monthly charts further
          down are still generated, and say so.
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
    </AppShell>
  );
}
