"use client";

import type { Verdict } from "@veela/core";
import {
  acquisitionLines,
  annualLines,
  criticalCount,
  formatCompactMoney,
  formatMoney,
  headlineStats,
  rateVerdict,
  severityColor,
  severityLabel,
} from "@veela/ui";

import {
  AlertCircleIcon,
  AlertTriangleIcon,
  ClockIcon,
  InfoIcon,
  PercentIcon,
  ReceiptIcon,
  TrendUpIcon,
  WalletIcon,
} from "./icons";
import { StarRatingDisplay } from "./star-rating";

type IconComponent = (props: { readonly className?: string }) => React.JSX.Element;

/** Keyed by `headlineStats`' own labels — see the grid below for why by label and not by
 *  index. A label with no entry renders without an icon rather than borrowing a neighbour's. */
const STAT_ICON: Readonly<Record<string, IconComponent | undefined>> = {
  "Net yield": TrendUpIcon,
  "Gross yield": PercentIcon,
  "Cash-on-cash": WalletIcon,
  Payback: ClockIcon,
};

/** Shape carries severity alongside colour: a triangle for the thing that can sink a deal,
 *  a circle for "check this", an `i` for a caveat. Never colour alone. */
const SEVERITY_ICON: Readonly<Record<"critical" | "warning" | "info", IconComponent>> = {
  critical: AlertTriangleIcon,
  warning: AlertCircleIcon,
  info: InfoIcon,
};

/**
 * The verdict. Order is deliberate: the headline numbers, then what's wrong, then the
 * arithmetic. An investor wants the answer first and the audit trail second — but the
 * audit trail has to be there, or the answer isn't believable.
 */
export function VerdictView({ verdict }: { readonly verdict: Verdict }): React.JSX.Element {
  const stats = headlineStats(verdict);
  const criticals = criticalCount(verdict);
  const rating = rateVerdict(verdict);

  return (
    <section className="space-y-10">
      <StarRatingDisplay rating={rating} />

      {/* Each metric gets its own mark. The icon is keyed off the stat's label rather than
          its position, so reordering `headlineStats` can't silently pair "Payback" with a
          percent sign — and an unknown label falls back to no icon rather than a wrong one. */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-panel border border-line bg-line shadow-card sm:grid-cols-4">
        {stats.map((s) => {
          const Icon = STAT_ICON[s.label];
          return (
            <div key={s.label} className="bg-surface p-5">
              <div className="flex items-center gap-1.5 text-muted">
                {Icon !== undefined && <Icon className="h-3.5 w-3.5 shrink-0" />}
                <span className="font-mono text-[10px] uppercase tracking-[0.12em]">
                  {s.label}
                </span>
              </div>
              <div
                className="tnum mt-1.5 font-display text-[28px] font-semibold tracking-[-0.025em]"
                style={s.color !== undefined ? { color: s.color } : undefined}
              >
                {s.value}
              </div>
              {s.hint !== undefined && (
                <div className="mt-1.5 text-xs leading-snug text-muted">{s.hint}</div>
              )}
            </div>
          );
        })}
      </div>

      {/**
       * **The standalone red "N issues could sink this deal" banner used to sit here, and
       * it was removed on request** — opening the full report landed the reader on an alarm
       * rather than on the report.
       *
       * The information is not gone, because losing it would be the wrong fix: it is now the
       * subtitle of the findings list it was describing, a few pixels below. That is where a
       * reader is already looking to find out *which* issues, every critical still carries
       * its own red `CRITICAL` badge in that list, and `rateVerdict` still docks a full star
       * per critical — so the warning is stated three times over without a full-width block
       * shouting it before the numbers have been read.
       */}
      <div>
        <h3 className="flex items-center gap-2 font-display text-[20px] font-semibold tracking-[-0.02em]">
          <AlertCircleIcon className="h-5 w-5 shrink-0 text-muted" />
          What to watch
        </h3>
        {criticals > 0 && (
          <p className="mt-1.5 text-sm text-muted">
            <strong className="font-semibold text-negative">
              {criticals} {criticals === 1 ? "issue" : "issues"}
            </strong>{" "}
            {criticals === 1 ? "is" : "are"} marked critical — read{" "}
            {criticals === 1 ? "it" : "them"} before you commit.
          </p>
        )}
        {/**
         * A finding now leads with its severity **icon in a tinted disc**, and the card
         * carries a left edge in the same colour.
         *
         * The pill badge stays: the icon is a second encoding of severity, never the only
         * one. A triangle and a circle differ by shape as well as colour — which is the
         * point, since `severityColor` is red/amber/grey and roughly one man in twelve
         * cannot separate the first two. Colour, shape and the words "Deal risk" all say
         * the same thing, so no reader depends on the channel they happen to lack.
         *
         * The tint is `${colour}14` — the colour at 8% alpha as an 8-digit hex, the same
         * trick `/portfolio` uses for its standing chips, so a disc never competes with the
         * text it sits beside.
         */}
        <ul className="mt-4 space-y-3">
          {verdict.findings.map((f, i) => {
            const Icon = SEVERITY_ICON[f.severity];
            const colour = severityColor[f.severity];
            return (
              <li
                key={`${f.id}-${i}`}
                className="card border-l-[3px] py-4"
                style={{ borderLeftColor: colour }}
              >
                <div className="flex gap-3">
                  <span
                    className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundColor: `${colour}14`, color: colour }}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline gap-2.5">
                      <span
                        className="shrink-0 rounded-full border px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.08em]"
                        style={{ color: colour, borderColor: colour }}
                      >
                        {severityLabel[f.severity]}
                      </span>
                      <h4 className="text-[15px] font-medium">{f.title}</h4>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-muted">{f.detail}</p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* `items-start` so the shorter table doesn't stretch to match the taller one — the
          two have different row counts by nature (four acquisition lines against eight
          annual ones), and a stretched card left a visible empty panel under the totals. */}
      <div className="grid items-start gap-6 sm:grid-cols-2">
        <CostTable title="Cash to acquire" icon={ReceiptIcon} lines={acquisitionLines(verdict)} />
        <CostTable title="Every year" icon={ClockIcon} lines={annualLines(verdict)} />
      </div>

      <div className="border-l-2 border-line pl-4">
        <div className="eyebrow">Provenance</div>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          Computed with {verdict.rulesUsed}. Sources:{" "}
          {verdict.sources.map((s, i) => (
            <span key={s}>
              {i > 0 && ", "}
              <a
                href={s}
                target="_blank"
                rel="noreferrer"
                className="font-mono underline decoration-line underline-offset-4 hover:text-mist"
              >
                {new URL(s).hostname}
              </a>
            </span>
          ))}
        </p>
      </div>
    </section>
  );
}

function CostTable({
  title,
  icon: Icon,
  lines,
}: {
  readonly title: string;
  readonly icon: IconComponent;
  readonly lines: ReturnType<typeof acquisitionLines>;
}): React.JSX.Element {
  return (
    <div className="card p-0">
      <h3 className="flex items-center gap-2 border-b border-line px-5 py-4 font-display text-[20px] font-semibold tracking-[-0.02em]">
        <Icon className="h-5 w-5 shrink-0 text-muted" />
        {title}
      </h3>
      <dl>
        {lines.map((l) => (
          <div
            key={l.label}
            className={`flex items-baseline justify-between gap-4 px-5 py-2.5 ${
              l.emphasis === true
                ? "border-t border-line bg-surfaceMuted font-semibold"
                : "border-t border-line/60 first:border-t-0"
            }`}
          >
            <dt className="text-sm text-muted">{l.label}</dt>
            <dd className="tnum shrink-0 font-mono text-sm" title={formatMoney(l.amount)}>
              {formatCompactMoney(l.amount)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
