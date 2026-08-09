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

import { StarRatingDisplay } from "./star-rating";

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

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-panel border border-line bg-line shadow-card sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-surface p-5">
            <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
              {s.label}
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
        ))}
      </div>

      {criticals > 0 && (
        <p className="rounded-card border-l-2 border-negative bg-negative/5 px-4 py-3 text-sm">
          <strong className="font-semibold text-negative">{criticals}</strong>{" "}
          {criticals === 1 ? "issue" : "issues"} could sink this deal. Read them before you
          commit.
        </p>
      )}

      <div>
        <h3 className="font-display text-[20px] font-semibold tracking-[-0.02em]">
          What to watch
        </h3>
        <ul className="mt-4 space-y-3">
          {verdict.findings.map((f, i) => (
            <li key={`${f.id}-${i}`} className="card py-4">
              <div className="flex flex-wrap items-baseline gap-2.5">
                <span
                  className="shrink-0 rounded-full border px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.08em]"
                  style={{
                    color: severityColor[f.severity],
                    borderColor: severityColor[f.severity],
                  }}
                >
                  {severityLabel[f.severity]}
                </span>
                <h4 className="text-[15px] font-medium">{f.title}</h4>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-muted">{f.detail}</p>
            </li>
          ))}
        </ul>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <CostTable title="Cash to acquire" lines={acquisitionLines(verdict)} />
        <CostTable title="Every year" lines={annualLines(verdict)} />
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
  lines,
}: {
  readonly title: string;
  readonly lines: ReturnType<typeof acquisitionLines>;
}): React.JSX.Element {
  return (
    <div className="card p-0">
      <h3 className="border-b border-line px-5 py-4 font-display text-[20px] font-semibold tracking-[-0.02em]">
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
