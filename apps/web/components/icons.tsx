/**
 * The app's icon set — one place, one style.
 *
 * **Why hand-drawn paths and not an icon package.** There was no icon dependency here and
 * adding one would ship a few thousand glyphs to render the two dozen this product uses.
 * More to the point, a house style already existed and was being retyped: nineteen inline
 * `<svg>` blocks in `app-shell.tsx` alone, plus one-offs in seven other components, every
 * one of them 24×24, `fill="none"`, `stroke="currentColor"`, round caps. That is a design
 * system that nobody had put in a file yet. This is that file.
 *
 * **The rules every icon here follows**, so a new one never looks bolted on:
 *   - `viewBox="0 0 24 24"`, no width/height — size comes from the caller's class.
 *   - Stroked outlines only, never filled shapes, so an icon inherits text colour and
 *     reads at 14px as well as at 32px.
 *   - `strokeWidth` 1.7 (2.2 only for the very short strokes of `Plus`, which looks thin
 *     otherwise) with round caps and joins, matching the sidebar's existing glyphs.
 *   - `aria-hidden` by default: these sit beside a text label in every case, and an icon
 *     that repeats the word next to it is noise to a screen reader. The handful of places
 *     with no adjacent text pass a `title` instead.
 *
 * **Deliberately not decorative.** Each icon is a label for a category the product already
 * names — a finding's severity, an amenity kind, a headline metric. None of them carries
 * information that isn't also written in words next to it, because an icon a reader has to
 * decode is worse than no icon.
 *
 * **Where the navigation icons live, and why they didn't move.** `app-shell.tsx` exports a
 * dozen glyphs (`SearchIcon`, `MapIcon`, `FolderIcon`, …) for the sidebar and the dashboard
 * tiles. They stayed there. The split is by *purpose*, not by accident: those name
 * destinations, these name things inside a report. What matters is that no glyph exists in
 * both files — checked, and the one collision (`SearchIcon`) was resolved by not adding a
 * second one here. Moving them is a worthwhile tidy-up, but it would touch every page in
 * the app for no visible change, so it is not bundled into a design pass.
 */

interface IconProps {
  readonly className?: string;
  /** Supply only when the icon stands alone. With a visible text label, leave it off — the
   *  icon is then correctly hidden from assistive technology. */
  readonly title?: string;
  /**
   * For a colour that isn't in the Tailwind palette — specifically the neighbourhood's
   * per-category pin hues, where the list icon has to match a map marker exactly. Every
   * other caller should use a text-colour class and let `currentColor` do the work.
   */
  readonly style?: React.CSSProperties;
}

function Svg({
  className,
  title,
  style,
  children,
}: IconProps & { readonly children: React.ReactNode }): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      style={style}
      aria-hidden={title === undefined ? "true" : undefined}
      role={title === undefined ? undefined : "img"}
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {title !== undefined && <title>{title}</title>}
      {children}
    </svg>
  );
}

// ── Headline metrics ────────────────────────────────────────────────────────

/** Net yield — a rising line. */
export function TrendUpIcon(p: IconProps): React.JSX.Element {
  return (
    <Svg {...p}>
      <path d="M3 16.5 9 10.5l3.5 3.5L21 5.5" />
      <path d="M15 5.5h6v6" />
    </Svg>
  );
}

/** Gross yield — rent over price, a ratio. */
export function PercentIcon(p: IconProps): React.JSX.Element {
  return (
    <Svg {...p}>
      <path d="M19 5 5 19" />
      <circle cx="7.5" cy="7.5" r="2.5" />
      <circle cx="16.5" cy="16.5" r="2.5" />
    </Svg>
  );
}

/** Cash-on-cash — money actually put in. */
export function WalletIcon(p: IconProps): React.JSX.Element {
  return (
    <Svg {...p}>
      <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H18a1 1 0 0 1 1 1v2" />
      <path d="M3 7.5V17a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-2" />
      <path d="M20 10.5h-4a2 2 0 0 0 0 4h4a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1Z" />
    </Svg>
  );
}

/** Payback — years to recover the cash. */
export function ClockIcon(p: IconProps): React.JSX.Element {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </Svg>
  );
}

/** Stamp duty and other one-off acquisition cost. */
export function ReceiptIcon(p: IconProps): React.JSX.Element {
  return (
    <Svg {...p}>
      <path d="M6 3h12v18l-3-1.8-3 1.8-3-1.8L6 21V3Z" />
      <path d="M9.5 8.5h5M9.5 12.5h5" />
    </Svg>
  );
}

// ── Finding severity ────────────────────────────────────────────────────────

/** Critical — the one that can sink a deal. */
export function AlertTriangleIcon(p: IconProps): React.JSX.Element {
  return (
    <Svg {...p}>
      <path d="M12 4.5 2.8 20h18.4L12 4.5Z" />
      <path d="M12 10v4" />
      <path d="M12 17.2h.01" />
    </Svg>
  );
}

/** Warning — worth knowing, not fatal. */
export function AlertCircleIcon(p: IconProps): React.JSX.Element {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 8v4.5" />
      <path d="M12 15.8h.01" />
    </Svg>
  );
}

/** Note — a caveat about the rules, not about this property. */
export function InfoIcon(p: IconProps): React.JSX.Element {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11.5V16" />
      <path d="M12 8.2h.01" />
    </Svg>
  );
}

// ── Neighbourhood categories ────────────────────────────────────────────────
// One per `AmenityKind`. See `neighbourhood-panel.tsx`.

export function SchoolIcon(p: IconProps): React.JSX.Element {
  return (
    <Svg {...p}>
      <path d="M12 4 2.5 8.5 12 13l9.5-4.5L12 4Z" />
      <path d="M6.5 11v5c0 1.4 2.5 2.8 5.5 2.8s5.5-1.4 5.5-2.8v-5" />
    </Svg>
  );
}

export function TrainIcon(p: IconProps): React.JSX.Element {
  return (
    <Svg {...p}>
      <rect x="5" y="3.5" width="14" height="12.5" rx="3" />
      <path d="M5 9.5h14" />
      <path d="M9 12.8h.01M15 12.8h.01" />
      <path d="M8 16 6 20.5M16 16l2 4.5" />
    </Svg>
  );
}

/** Ordinary bus stops — a separate kind from `TrainIcon`'s rail/tram/ferry, because the two
 *  are counted and scored separately. See the note in `neighbourhood.ts` on why. */
export function BusIcon(p: IconProps): React.JSX.Element {
  return (
    <Svg {...p}>
      <rect x="4" y="4" width="16" height="12.5" rx="2.5" />
      <path d="M4 10.5h16" />
      <path d="M8 13.6h.01M16 13.6h.01" />
      <path d="M7.5 16.5V19M16.5 16.5V19" />
    </Svg>
  );
}

export function ShopIcon(p: IconProps): React.JSX.Element {
  return (
    <Svg {...p}>
      <path d="M4 4h16l1 4.5a3 3 0 0 1-5.7 1.3A3 3 0 0 1 12 11a3 3 0 0 1-3.3-1.2A3 3 0 0 1 3 8.5L4 4Z" />
      <path d="M5 11.5V20h14v-8.5" />
      <path d="M10 20v-4.5h4V20" />
    </Svg>
  );
}

export function HealthIcon(p: IconProps): React.JSX.Element {
  return (
    <Svg {...p}>
      <rect x="3.5" y="6" width="17" height="13" rx="2.5" />
      <path d="M12 9.5v6M9 12.5h6" />
      <path d="M8.5 6V4.5h7V6" />
    </Svg>
  );
}

export function TreeIcon(p: IconProps): React.JSX.Element {
  return (
    <Svg {...p}>
      <path d="M12 3.5 6.5 12h11L12 3.5Z" />
      <path d="M12 8.5 7.5 16h9L12 8.5Z" />
      <path d="M12 16v4.5" />
    </Svg>
  );
}

/** Premium retail — a named-brand signal, not a quality judgement. */
export function DiamondIcon(p: IconProps): React.JSX.Element {
  return (
    <Svg {...p}>
      <path d="M6 4h12l3 5-9 11L3 9l3-5Z" />
      <path d="M3 9h18M9.5 4 8 9l4 11 4-11-1.5-5" />
    </Svg>
  );
}

/** Under construction — information, deliberately neither good nor bad. */
export function ConstructionIcon(p: IconProps): React.JSX.Element {
  return (
    <Svg {...p}>
      <path d="M4 20.5h16" />
      <path d="M6.5 20.5V7.5L18 4v4" />
      <path d="M6.5 7.5 18 4" />
      <path d="M18 8v4.5a2.5 2.5 0 0 1-5 0" />
      <path d="M13 20.5v-5.5h5v5.5" />
    </Svg>
  );
}

// ── Structure and navigation ────────────────────────────────────────────────

export function DocumentIcon(p: IconProps): React.JSX.Element {
  return (
    <Svg {...p}>
      <path d="M13.5 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5L13.5 3Z" />
      <path d="M13.5 3v5.5H19" />
      <path d="M8.5 13h7M8.5 16.5h4.5" />
    </Svg>
  );
}

export function MapPinIcon(p: IconProps): React.JSX.Element {
  return (
    <Svg {...p}>
      <path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.6" />
    </Svg>
  );
}

export function BuildingIcon(p: IconProps): React.JSX.Element {
  return (
    <Svg {...p}>
      <path d="M4 20.5h16" />
      <path d="M6 20.5V4.5h9v16" />
      <path d="M15 9.5h3.5v11" />
      <path d="M9 8h3M9 11.5h3M9 15h3" />
    </Svg>
  );
}

export function BookmarkIcon(p: IconProps): React.JSX.Element {
  return (
    <Svg {...p}>
      <path d="M6.5 3.5h11a1 1 0 0 1 1 1V21l-6.5-4.2L5.5 21V4.5a1 1 0 0 1 1-1Z" />
    </Svg>
  );
}

/* No `SearchIcon` here on purpose — `app-shell.tsx` already exports one, and two glyphs
   with the same name in one codebase is precisely the duplication this file exists to end.
   Import that one. Likewise `MapIcon` (a folded map, for Market Explorer) lives there;
   `MapPinIcon` below is a different thing — a single located point, for a property. */

export function ChevronRightIcon(p: IconProps): React.JSX.Element {
  return (
    <Svg {...p}>
      <path d="m9.5 5.5 7 6.5-7 6.5" />
    </Svg>
  );
}
