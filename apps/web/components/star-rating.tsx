import type { StarRating } from "@veela/ui";

/**
 * Renders `rateVerdict`'s output. The explanation sentence always sits right next to
 * the stars, in the same size text as everything else on the report — a rating that
 * hides its own formula reads as an opinion; one that shows it reads as arithmetic.
 */
export function StarRatingDisplay({ rating }: { readonly rating: StarRating }): React.JSX.Element {
  return (
    <div>
      <div className="flex items-center gap-2">
        <div className="flex gap-0.5" role="img" aria-label={`${rating.stars.toFixed(1)} out of 5 stars`}>
          {Array.from({ length: 5 }, (_, i) => (
            <Star key={i} fraction={Math.min(1, Math.max(0, rating.stars - i))} />
          ))}
        </div>
        <span className="tnum text-sm font-semibold">{rating.stars.toFixed(1)}/5</span>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-muted">{rating.explanation}</p>
    </div>
  );
}

function Star({ fraction }: { readonly fraction: number }): React.JSX.Element {
  return (
    <span className="relative inline-block h-4 w-4 text-line">
      <StarShape className="h-4 w-4" />
      {fraction > 0 && (
        <span
          className="absolute inset-0 overflow-hidden text-accent"
          style={{ width: `${fraction * 100}%` }}
        >
          <StarShape className="h-4 w-4" />
        </span>
      )}
    </span>
  );
}

function StarShape({ className }: { readonly className?: string }): React.JSX.Element {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden="true">
      <path
        d="M10 1.3l2.62 5.31 5.86.85-4.24 4.13 1 5.83L10 14.5l-5.24 2.75 1-5.83-4.24-4.13 5.86-.85L10 1.3Z"
        fill="currentColor"
      />
    </svg>
  );
}
