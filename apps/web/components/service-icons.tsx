/**
 * Glyphs for the Services pages, in the house style the rest of the app uses: 24×24 viewBox,
 * stroked outlines, `currentColor`, round caps and joins. See `icons.tsx` for why that file
 * exists and why an icon package was not added.
 *
 * Separate from `icons.tsx` only because these are used by one section and that file is already
 * the shared set for the report — keeping section-specific marks out of it stops the shared set
 * growing into a dumping ground. No glyph is duplicated between the two.
 */

function Svg({
  className,
  children,
}: {
  /** `| undefined` is required, not noise: `exactOptionalPropertyTypes` is on, so forwarding an
   *  optional prop from a caller means this must accept the undefined it may receive. */
  readonly className?: string | undefined;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

/** A licence checked — the Agent Finder mark. */
export function BadgeCheckIcon({ className }: { readonly className?: string }): React.JSX.Element {
  return (
    <Svg className={className}>
      <path d="M12 2.8 14.2 5l3-.3.9 2.9 2.6 1.5-1.3 2.7 1.3 2.7-2.6 1.5-.9 2.9-3-.3L12 21.2 9.8 19l-3 .3-.9-2.9L3.3 15l1.3-2.7L3.3 9.6l2.6-1.5.9-2.9 3 .3L12 2.8Z" />
      <path d="m9 12 2 2 4-4" />
    </Svg>
  );
}

/** Looking something up, rather than being matched to it. */
export function SearchGlassIcon({ className }: { readonly className?: string }): React.JSX.Element {
  return (
    <Svg className={className}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M15.8 15.8 20.5 20.5" />
    </Svg>
  );
}

export function DocumentIcon({ className }: { readonly className?: string }): React.JSX.Element {
  return (
    <Svg className={className}>
      <path d="M13.5 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5L13.5 3Z" />
      <path d="M13.5 3v5.5H19" />
      <path d="M8.5 13h7M8.5 16.5h4.5" />
    </Svg>
  );
}

/** A bank — the Mortgage mark. */
export function BankIcon({ className }: { readonly className?: string }): React.JSX.Element {
  return (
    <Svg className={className}>
      <path d="M3 9.5 12 4l9 5.5" />
      <path d="M5 9.5V19M9.5 9.5V19M14.5 9.5V19M19 9.5V19" />
      <path d="M2.5 19h19" />
    </Svg>
  );
}

/** A gauge under pressure — the stress test. */
export function GaugeIcon({ className }: { readonly className?: string }): React.JSX.Element {
  return (
    <Svg className={className}>
      <path d="M4 18a9 9 0 1 1 16 0" />
      <path d="m12 18 4.5-6" />
      <circle cx="12" cy="18" r="1.4" />
    </Svg>
  );
}

/** A calculator — arithmetic rather than a referral. */
export function CalculatorIcon({ className }: { readonly className?: string }): React.JSX.Element {
  return (
    <Svg className={className}>
      <rect x="5" y="3" width="14" height="18" rx="2.5" />
      <path d="M8.5 7.5h7" />
      <path d="M9 12h.01M12 12h.01M15 12h.01M9 16h.01M12 16h.01M15 16h.01" />
    </Svg>
  );
}

/** A shield — the Insurance mark. */
export function ShieldIcon({ className }: { readonly className?: string }): React.JSX.Element {
  return (
    <Svg className={className}>
      <path d="M12 3 5 6v6c0 4.2 2.9 7.6 7 9 4.1-1.4 7-4.8 7-9V6l-7-3Z" />
    </Svg>
  );
}

export function DropletIcon({ className }: { readonly className?: string }): React.JSX.Element {
  return (
    <Svg className={className}>
      <path d="M12 3.2s5.5 5.6 5.5 9.3a5.5 5.5 0 0 1-11 0C6.5 8.8 12 3.2 12 3.2Z" />
    </Svg>
  );
}

export function KeyIcon({ className }: { readonly className?: string }): React.JSX.Element {
  return (
    <Svg className={className}>
      <circle cx="8" cy="15" r="4" />
      <path d="m11 12 8-8" />
      <path d="m17 6 2 2M14.5 8.5l2 2" />
    </Svg>
  );
}

/** A trend line — the Home Valuation mark. */
export function TrendIcon({ className }: { readonly className?: string }): React.JSX.Element {
  return (
    <Svg className={className}>
      <path d="M3 16.5 9 10.5l3.5 3.5L21 5.5" />
      <path d="M15 5.5h6v6" />
    </Svg>
  );
}

export function ScaleIcon({ className }: { readonly className?: string }): React.JSX.Element {
  return (
    <Svg className={className}>
      <path d="M12 3.5V21" />
      <path d="M7 21h10" />
      <path d="M5 7.5h14" />
      <path d="M5 7.5 2.5 13a3 3 0 0 0 5 0L5 7.5Z" />
      <path d="M19 7.5 16.5 13a3 3 0 0 0 5 0L19 7.5Z" />
    </Svg>
  );
}

export function ClockIcon({ className }: { readonly className?: string }): React.JSX.Element {
  return (
    <Svg className={className}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </Svg>
  );
}
