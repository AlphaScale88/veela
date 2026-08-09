import { HK_RULE_SETS, minor, type DutyBand, type StampDutyScale } from "@veela/core";
import { formatCompactMoney } from "@veela/ui";

import { AppShell } from "../../../components/app-shell";

/**
 * "Market Regulations" — Mashvisor's phrase for a page telling you the rules a market
 * runs on. This one reads `HK_RULE_SETS` directly, the same object `computeVerdict`
 * uses to price every report on `/analyse` — not a second, hand-copied summary that
 * could quietly drift from the numbers the engine actually charges. If a stamp duty
 * band changes here, it changed in the rule set, and this page is already right.
 *
 * A Server Component, unusually for an app-shell page: nothing here is interactive or
 * user-specific, and `HK_RULE_SETS` is a plain import, not a fetch.
 */
export default function MarketRegulationsPage(): React.JSX.Element {
  const rules = HK_RULE_SETS[HK_RULE_SETS.length - 1];
  if (rules === undefined) {
    return (
      <AppShell breadcrumb="Research & Analyse › Market Regulations">
        <p className="text-sm text-muted">No rule set is loaded.</p>
      </AppShell>
    );
  }

  return (
    <AppShell breadcrumb="Research & Analyse › Market Regulations">
      <header className="max-w-prose">
        <h1 className="font-display text-[26px] font-semibold tracking-[-0.03em] text-mist">
          Market Regulations
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Effective from {rules.meta.effectiveFrom}
          {rules.meta.effectiveTo !== null && ` to ${rules.meta.effectiveTo}`}. Every
          figure below is read from the same rule set{" "}
          <code className="font-mono text-xs">/api/verdict/preview</code> computes
          against — nothing here is a separate summary that could disagree with it.
        </p>
      </header>

      <Section title="Stamp duty (AVD)">
        <ScaleTable scale={rules.stampDuty.firstTimeResident} />
        <p className="mt-2 text-xs text-muted">
          Applies to a Hong Kong permanent resident buying their first residential
          property, in their own name.
        </p>

        <div className="mt-6">
          <ScaleTable scale={rules.stampDuty.other} />
          <p className="mt-2 text-xs text-muted">
            Applies to everyone else — an additional property, a non-permanent
            resident, or a purchase through a company.
          </p>
        </div>
      </Section>

      <Section title="Suspended duties">
        <p className="mb-3 text-sm leading-relaxed text-muted">
          These exist in law but are not currently charged. Modelled rather than
          deleted: a rule can be reinstated, and a scenario dated before its suspension
          still needs it.
        </p>
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-surfaceMuted text-left text-xs text-muted">
                <th scope="col" className="px-4 py-2 font-medium">Duty</th>
                <th scope="col" className="px-4 py-2 text-right font-medium">Rate</th>
                <th scope="col" className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rules.suspendedDuties.map((d) => (
                <tr key={d.id} className="border-b border-line/60">
                  <th scope="row" className="px-4 py-2.5 text-left font-normal text-mist">
                    {d.label}
                  </th>
                  <td className="tnum px-4 py-2.5 text-right text-muted">
                    {(d.rate * 100).toFixed(1)}%
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted">{d.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Rental income (Property Tax)">
        <dl className="card grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted">Rate</dt>
            <dd className="mt-1 font-medium">{(rules.rentalIncomeTax.standardRate * 100).toFixed(0)}% of net assessable value</dd>
          </div>
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
              Notional allowance
            </dt>
            <dd className="mt-1 font-medium">
              {(rules.rentalIncomeTax.notionalAllowance * 100).toFixed(0)}% of rent, for repairs and outgoings
            </dd>
          </div>
        </dl>
      </Section>

      <Section title="Capital gains">
        <p className="card text-sm leading-relaxed">{rules.capitalGains.note}</p>
      </Section>

      {rules.annualRates !== null && (
        <Section title="Government rates">
          <p className="card text-sm leading-relaxed">
            <span className="font-semibold">{(rules.annualRates.rate * 100).toFixed(1)}%</span>{" "}
            of rateable value per annum. {rules.annualRates.note}
          </p>
        </Section>
      )}

      {rules.meta.caveats !== undefined && rules.meta.caveats.length > 0 && (
        <Section title="Caveats">
          <ul className="card list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted">
            {rules.meta.caveats.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Sources">
        <ul className="space-y-1 text-sm">
          {rules.meta.sources.map((s) => (
            <li key={s}>
              <a
                href={s}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-xs underline decoration-line underline-offset-4 hover:text-mist"
              >
                {s}
              </a>
            </li>
          ))}
        </ul>
      </Section>
    </AppShell>
  );
}

function Section({ title, children }: { readonly title: string; readonly children: React.ReactNode }): React.JSX.Element {
  return (
    <section className="mt-8 max-w-2xl">
      <h2 className="font-display text-[18px] font-semibold tracking-[-0.02em] text-mist">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function ScaleTable({ scale }: { readonly scale: StampDutyScale }): React.JSX.Element {
  const rows = describeBands(scale.bands);
  return (
    <div className="card overflow-x-auto p-0">
      <caption className="sr-only">{scale.label}</caption>
      <p className="border-b border-line px-4 py-2.5 text-sm font-semibold text-mist">
        {scale.label}
      </p>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line bg-surfaceMuted text-left text-xs text-muted">
            <th scope="col" className="px-4 py-2 font-medium">Consideration</th>
            <th scope="col" className="px-4 py-2 font-medium">Duty</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-line/60 last:border-0">
              <td className="tnum px-4 py-2.5 text-mist">{r.range}</td>
              <td className="tnum px-4 py-2.5 text-muted">{r.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function describeBands(bands: readonly DutyBand[]): { range: string; description: string }[] {
  let lower = 0;
  return bands.map((band) => {
    const upperLabel = band.upTo === null ? "and above" : `up to ${formatCompactMoney(minor(band.upTo, "HKD"))}`;
    const range =
      lower === 0
        ? `First ${upperLabel.replace("up to ", "")}`
        : `${formatCompactMoney(minor(lower, "HKD"))} ${upperLabel}`;

    let description: string;
    switch (band.kind) {
      case "flat":
        description = `Flat ${formatCompactMoney(minor(band.fixed, "HKD"))}`;
        break;
      case "percentage":
        description = `${(band.rate * 100).toFixed(2).replace(/\.?0+$/, "")}% of the price`;
        break;
      case "marginal":
        description = `${formatCompactMoney(minor(band.base, "HKD"))} + ${(band.marginalRate * 100).toFixed(0)}% on the excess over ${formatCompactMoney(minor(band.over, "HKD"))}`;
        break;
    }

    if (band.upTo !== null) lower = band.upTo;
    return { range, description };
  });
}
