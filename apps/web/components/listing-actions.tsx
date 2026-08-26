"use client";

import Link from "next/link";

/**
 * The heart and the compare bar — shared by both finder modes so the two cannot drift.
 *
 * ## What the heart means, and why it means two different things
 *
 * Zillow's heart means *keep this*. Applied here that lands on two different existing concepts
 * depending on what is being hearted, and collapsing them into one would have required inventing
 * a third:
 *
 * - **A sample listing is not yours yet**, so the heart *saves* it — the same `POST /properties`
 *   the report's Save button uses, carrying `demoListingId` so the heart can render filled next
 *   time and un-hearting can delete the row this listing produced.
 * - **A saved property is already yours**, so there is nothing to save. There the heart toggles
 *   `monitored`, the flag that already existed and already feeds `/portfolio/alerts` — which is
 *   what "keep an eye on this" actually means in this product.
 *
 * Both are labelled, so nobody has to infer it from an icon.
 */

/**
 * How many properties the comparison holds. Lives here rather than on the compare page so the
 * page and the bar that links to it cannot disagree about the limit — the bar has to disable at
 * the ceiling and the page has to enforce it.
 */
export const MAX_COMPARE = 3;

/**
 * Two sizes, because the heart appears in two different kinds of place.
 *
 * `overlay` sits on a listing photo and is the one Zillow's is comparable to. Measured off
 * their card: a 30px heart on a 345px card, i.e. **8.7% of the card's width**, inset ~4%.
 * Ours was 18px on a 280px card — 6.4% — which read as a small utility control rather than
 * the card's own affordance. 24px restores the proportion.
 *
 * `inline` is the default and is unchanged at 18px: those hearts sit in a control row beside
 * a `CompareCheckbox`, where matching the checkbox matters more than matching Zillow, and a
 * 40px button next to a 16px tick would look like a mistake.
 *
 * The button is 40px at `overlay` — which also lifts it over the 24px WCAG 2.2 target-size
 * minimum with room to spare, where 32px was closer to the line than it needed to be.
 */
export function HeartButton({
  filled,
  busy,
  label,
  onClick,
  size = "inline",
}: {
  readonly filled: boolean;
  readonly busy: boolean;
  readonly label: string;
  readonly onClick: () => void;
  readonly size?: "inline" | "overlay";
}): React.JSX.Element {
  const overlay = size === "overlay";
  return (
    <button
      type="button"
      onClick={(e) => {
        /* The heart sits inside a card whose body is a link and whose hover selects a map pin.
           Without this, clicking it also navigates. */
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      disabled={busy}
      aria-pressed={filled}
      aria-label={label}
      title={label}
      className={`grid place-items-center rounded-full bg-white/92 shadow-card transition-transform hover:scale-105 disabled:opacity-50 ${
        overlay ? "size-10" : "size-8"
      }`}
    >
      <HeartIcon filled={filled} className={overlay ? "h-6 w-6" : "h-[18px] w-[18px]"} />
    </button>
  );
}

/** Filled vs outlined, not two colours: the state has to survive greyscale and colour blindness,
 *  the same reason report severities carry a shape as well as a hue. */
function HeartIcon({
  filled,
  className,
}: {
  readonly filled: boolean;
  readonly className?: string;
}): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      fill={filled ? "#E0245E" : "none"}
      stroke={filled ? "#E0245E" : "currentColor"}
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 20.3 4.6 13a4.8 4.8 0 0 1 6.8-6.8l.6.6.6-.6A4.8 4.8 0 0 1 19.4 13Z" />
    </svg>
  );
}

/**
 * The selection bar. Fixed to the bottom of the viewport rather than placed in the flow, because
 * the thing it acts on is the list you are scrolling — a button that scrolls away with the first
 * card you ticked is a button you have to hunt for again.
 *
 * `max` is the compare page's own limit, passed in rather than duplicated here, so the two cannot
 * disagree about how many columns fit.
 */
export function CompareBar({
  ids,
  max,
  onClear,
}: {
  readonly ids: readonly string[];
  readonly max: number;
  readonly onClear: () => void;
}): React.JSX.Element | null {
  if (ids.length === 0) return null;
  const enough = ids.length >= 2;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 px-4 py-3 shadow-lift backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3">
        <p className="text-sm text-mist">
          <strong>{ids.length}</strong> selected
          {!enough && <span className="text-muted"> — pick one more to compare</span>}
          {ids.length >= max && <span className="text-muted"> — {max} is the maximum</span>}
        </p>
        <button
          type="button"
          onClick={onClear}
          className="text-sm text-muted underline underline-offset-4 hover:text-mist"
        >
          Clear
        </button>
        <div className="ml-auto">
          {enough ? (
            <Link
              href={`/portfolio/compare?ids=${ids.join(",")}`}
              className="btn-primary !px-5 !py-2 !text-sm"
            >
              Compare {ids.length}
            </Link>
          ) : (
            /* Disabled rather than absent: a control that appears only once the condition is met
               leaves a reader wondering whether ticking a second box will do anything at all. */
            <span
              aria-disabled="true"
              className="btn-primary pointer-events-none !px-5 !py-2 !text-sm opacity-40"
            >
              Compare
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/** The tick that puts a *saved* property into the comparison. Only rendered on saved cards —
 *  the compare page reads stored snapshots, so there is nothing for it to show about a listing
 *  nobody has saved. */
export function CompareCheckbox({
  checked,
  disabled,
  onChange,
}: {
  readonly checked: boolean;
  readonly disabled: boolean;
  readonly onChange: () => void;
}): React.JSX.Element {
  return (
    <label
      onClick={(e) => e.stopPropagation()}
      className={`flex items-center gap-1.5 whitespace-nowrap rounded-full bg-white/92 px-2 py-1 text-[11px] font-medium shadow-card ${
        disabled ? "opacity-50" : "cursor-pointer"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        className="size-3.5 accent-accent"
      />
      <span className="text-mist">Compare</span>
    </label>
  );
}
