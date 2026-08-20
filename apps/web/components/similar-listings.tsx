"use client";

import {
  DEMO_DISTRICTS,
  DEMO_LISTINGS,
  rvdClassForAreaSqft,
  type DemoListing,
} from "@veela/fixtures";
import { formatCompactMoney, formatPercent, gradeNetYield, standingColor } from "@veela/ui";
import Link from "next/link";

/**
 * Comparable listings — and the disclosure that has to sit on top of them, because in this
 * product a "comp" is the one thing that cannot be quietly synthesised.
 *
 * ## Why these are samples and not real comparables
 *
 * A real comparables panel needs a transaction database. Hong Kong's is behind the Land
 * Registry's HK$10-per-memorial counter with no bulk option, or inside Centaline's and Midland's
 * own products, which this project has repeatedly declined to harvest. So the catalogue here is
 * the same fifty-four **generated sample listings** the finder shows, screened to the ones that
 * genuinely resemble the subject: same district first, then the same RVD size Class, then
 * nearest by price per square foot.
 *
 * **The screening is real even though the stock is not.** That distinction is the point of the
 * feature: it demonstrates exactly what a comparables panel would tell you, against data that
 * says on every row that it is invented. `LISTINGS_NOTICE` covers the catalogue site-wide; this
 * panel repeats it, because a reader arriving at the bottom of their own report has not
 * necessarily seen the finder's banner.
 *
 * ## What is real here
 *
 * Two things, and they are the ones worth reading. Each card's **net yield comes from
 * `computeVerdict`** through the same `listingToDraft` the finder uses — the arithmetic is the
 * production engine, only the inputs are fabricated. And the **price per square foot spread** at
 * the bottom is computed from whatever is on screen, so the comparison of the subject against the
 * set is honest arithmetic over dishonest data, which is the most this can be until a real feed
 * exists.
 *
 * When a real transaction source arrives, only `pickComparables()` changes. Nothing above it
 * assumes where a comparable came from.
 */
const MAX_COMPARABLES = 4;

export interface ComparableSubject {
  readonly districtId: string | null;
  readonly priceMinor: number;
  readonly saleableAreaSqft: number | null;
  /** Excluded from its own comparables, when the subject *is* one of the samples. */
  readonly excludeListingId?: string | undefined;
}

/**
 * Nearest comparables, most alike first.
 *
 * Ranked rather than filtered: a hard filter on district plus size Class returns nothing at all
 * for a flat in a district with three samples, and an empty panel teaches a reader less than four
 * imperfect rows that say how alike they are. So every candidate scores, and the score is what
 * the card displays as its "why this one".
 */
export function pickComparables(
  subject: ComparableSubject,
  catalogue: readonly DemoListing[] = DEMO_LISTINGS,
): readonly { readonly listing: DemoListing; readonly sameDistrict: boolean; readonly sameClass: boolean }[] {
  const subjectClass =
    subject.saleableAreaSqft === null ? null : rvdClassForAreaSqft(subject.saleableAreaSqft);
  const subjectPpsf =
    subject.saleableAreaSqft !== null && subject.saleableAreaSqft > 0
      ? subject.priceMinor / 100 / subject.saleableAreaSqft
      : null;

  const scored = catalogue
    .filter((l) => l.id !== subject.excludeListingId)
    .map((listing) => {
      const sameDistrict = listing.districtId === subject.districtId;
      const listingClass = rvdClassForAreaSqft(listing.saleableAreaSqft);
      const sameClass = subjectClass !== null && listingClass === subjectClass;
      const ppsf = listing.priceHkd / listing.saleableAreaSqft;
      /* District dominates, then size band, then price per square foot — the order a surveyor
         would use, and the reason it is not a single blended score is that a blended one cannot
         be explained on the card. */
      const priceDistance =
        subjectPpsf === null ? 1 : Math.min(1, Math.abs(ppsf - subjectPpsf) / subjectPpsf);
      const score = (sameDistrict ? 0 : 100) + (sameClass ? 0 : 10) + priceDistance;
      return { listing, sameDistrict, sameClass, score };
    })
    .sort((a, b) => a.score - b.score)
    .slice(0, MAX_COMPARABLES);

  return scored.map(({ listing, sameDistrict, sameClass }) => ({ listing, sameDistrict, sameClass }));
}

export function SimilarListings({
  subject,
  netYieldFor,
}: {
  readonly subject: ComparableSubject;
  /**
   * Net yield per listing, passed in rather than computed here: the caller already holds the
   * engine and `listingToDraft`, and a second call site computing yields is exactly the
   * duplication that let a card and its report disagree once before.
   */
  readonly netYieldFor: (listing: DemoListing) => number | null;
}): React.JSX.Element | null {
  const comparables = pickComparables(subject);
  if (comparables.length === 0) return null;

  const subjectPpsf =
    subject.saleableAreaSqft !== null && subject.saleableAreaSqft > 0
      ? subject.priceMinor / 100 / subject.saleableAreaSqft
      : null;

  const ppsfs = comparables.map((c) => c.listing.priceHkd / c.listing.saleableAreaSqft);
  const low = Math.min(...ppsfs);
  const high = Math.max(...ppsfs);

  return (
    <section className="card">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-[15px] font-semibold">Similar listings</h3>
        <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-muted">
          Sample stock
        </p>
      </div>

      {/* Before the rows, not after. A reader who reads one line must read this one. */}
      <p className="mt-2 rounded-card border border-line bg-surfaceMuted p-2.5 text-xs leading-relaxed text-muted">
        <strong className="text-mist">These are generated sample flats, not real listings.</strong>{" "}
        Hong Kong sells transaction records one at a time at HK$10 each with no bulk option, and
        the commercial databases are not ours to copy — so there is no real comparables feed to
        draw on. The screening below is real, and every yield is computed by the same engine as
        your report; the stock it screens is invented.
      </p>

      <ul className="mt-3 space-y-2">
        {comparables.map(({ listing, sameDistrict, sameClass }) => {
          const y = netYieldFor(listing);
          const ppsf = Math.round(listing.priceHkd / listing.saleableAreaSqft);
          const district = DEMO_DISTRICTS.find((d) => d.id === listing.districtId);
          return (
            <li key={listing.id}>
              <Link
                href={`/analyse?listing=${listing.id}`}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-card border border-line px-3 py-2.5 transition-colors hover:border-accent hover:bg-surfaceMuted"
              >
                <span className="min-w-0 flex-1 text-[13px] font-medium text-mist">
                  {listing.bedrooms}-bed sample flat
                  <span className="text-muted"> · {district?.nameEn ?? listing.districtId}</span>
                </span>
                <span className="tabular-nums text-[13px] font-semibold text-mist">
                  {formatCompactMoney({ amount: listing.priceHkd * 100, currency: "HKD" })}
                </span>
                <span className="w-24 text-right tabular-nums text-xs text-muted">
                  {listing.saleableAreaSqft} sq ft
                </span>
                <span className="w-28 text-right tabular-nums text-xs text-muted">
                  HK${ppsf.toLocaleString("en-HK")}/sq ft
                </span>
                <span
                  className="w-14 text-right tabular-nums text-xs font-semibold"
                  style={y === null ? undefined : { color: standingColor[gradeNetYield(y)] }}
                >
                  {formatPercent(y)}
                </span>
                {/* Says why it is here, which is what makes a ranked list readable. */}
                <span className="w-full font-mono text-[10px] uppercase tracking-[0.06em] text-muted">
                  {sameDistrict ? "same district" : "other district"}
                  {sameClass ? " · same size class" : " · different size class"}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      <p className="mt-3 text-xs leading-relaxed text-muted">
        Price per square foot across these {comparables.length}:{" "}
        <strong className="text-mist">
          HK${Math.round(low).toLocaleString("en-HK")} – HK${Math.round(high).toLocaleString("en-HK")}
        </strong>
        {subjectPpsf !== null && (
          <>
            . Yours is{" "}
            <strong className="text-mist">
              HK${Math.round(subjectPpsf).toLocaleString("en-HK")}
            </strong>
            {subjectPpsf > high
              ? " — above every one of them."
              : subjectPpsf < low
                ? " — below every one of them."
                : " — inside the range."}
          </>
        )}
      </p>
    </section>
  );
}
