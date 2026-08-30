"use client";

import {
  HK_EARLIEST_COVERED_DATE,
  HK_RULE_SETS,
  evaluateScale,
  minor,
  type DutyBand,
  type JurisdictionRules,
  type StampDutyScale,
} from "@veela/core";
import { formatCompactMoney } from "@veela/ui";
import { useMemo, useState } from "react";

/**
 * Ad valorem duty, computed for *your* purchase rather than described in a table.
 *
 * The page around this renders all five dated rule sets, which answers "what are the rates" and
 * not "what do I owe" — the question anyone actually arrives with. Every figure below comes from
 * `evaluateScale` and `HK_RULE_SETS`, the same objects `computeVerdict` uses, so this cannot
 * drift from what a report would say. Nothing is recomputed independently and no rate is typed
 * in here.
 *
 * The three checkboxes are the real test, in the engine's own words: the concession needs a
 * permanent resident who owns no other residential property and is not buying through a company.
 * Failing any one of them moves you to the other scale, and failing the residency test also
 * brings BSD back in the periods where it was live — which is exactly why the date matters and
 * why it is an input rather than "today".
 */

/** Mirrors `verdict.ts`: the latest set whose window contains the date. */
function rulesForDate(date: string): JurisdictionRules | null {
  const applicable = HK_RULE_SETS.filter((r) => date >= r.meta.effectiveFrom)
    .filter((r) => r.meta.effectiveTo === null || date < r.meta.effectiveTo)
    .sort((a, b) => (a.meta.effectiveFrom < b.meta.effectiveFrom ? 1 : -1));
  return applicable[0] ?? null;
}

/** Which band a consideration lands in, so the working can be shown rather than asserted. */
function bandFor(scale: StampDutyScale, priceMinor: number): DutyBand | null {
  for (const band of scale.bands) {
    if (band.upTo === null || priceMinor <= band.upTo) return band;
  }
  return null;
}

function describeBand(band: DutyBand): string {
  if (band.kind === "flat") return `a fixed ${formatCompactMoney(minor(band.fixed, "HKD"))}`;
  if (band.kind === "percentage") return `${(band.rate * 100).toFixed(3).replace(/\.?0+$/, "")}% of the price`;
  return `${formatCompactMoney(minor(band.base, "HKD"))} plus ${(band.marginalRate * 100).toFixed(0)}% of the amount above ${formatCompactMoney(minor(band.over, "HKD"))}`;
}

const TODAY = new Date().toISOString().slice(0, 10);

export function DutyCalculator(): React.JSX.Element {
  const [priceM, setPriceM] = useState(9);
  const [date, setDate] = useState(TODAY);
  const [permanentResident, setPermanentResident] = useState(true);
  const [ownsOther, setOwnsOther] = useState(false);
  const [viaCompany, setViaCompany] = useState(false);

  const result = useMemo(() => {
    const rules = rulesForDate(date);
    if (rules === null) return null;

    const priceMinor = Math.round(priceM * 1_000_000 * 100);
    const price = minor(priceMinor, "HKD");

    // The engine's own test, copied in the same order it is written there.
    const qualifies = permanentResident && !ownsOther && !viaCompany;
    const scale = qualifies ? rules.stampDuty.firstTimeResident : rules.stampDuty.other;
    const avd = evaluateScale(scale, price);

    const bsdRule = rules.additionalDuties.find((d) => d.id === "hk-bsd");
    const liableToBsd = !permanentResident || viaCompany;
    const bsdLive = bsdRule !== undefined && !bsdRule.suspended;
    const bsd = bsdLive && liableToBsd ? Math.round(priceMinor * bsdRule.rate) : 0;

    return {
      rules,
      scale,
      qualifies,
      priceMinor,
      avdMinor: avd.amount,
      bsdMinor: bsd,
      bsdRate: bsdRule?.rate ?? 0,
      bsdLive,
      liableToBsd,
      band: bandFor(scale, priceMinor),
      scalesDiffer: rules.stampDuty.firstTimeResident.id !== rules.stampDuty.other.id,
    };
  }, [priceM, date, permanentResident, ownsOther, viaCompany]);

  const money = (m: number): string => formatCompactMoney(minor(m, "HKD"));

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_1fr] lg:items-start">
      <div className="card space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium">Purchase price</span>
            <span className="relative mt-1 block">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm text-muted">
                HK$
              </span>
              <input
                type="number"
                min={0}
                step={0.1}
                value={priceM}
                onChange={(e) => setPriceM(Number(e.target.value))}
                className="w-full rounded-card border border-line bg-surfaceMuted py-2.5 pl-12 pr-10 font-mono text-sm outline-none focus:border-accent focus:bg-surface"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-xs text-muted">
                M
              </span>
            </span>
          </label>

          <label className="block">
            <span className="text-sm font-medium">Date of the agreement</span>
            <input
              type="date"
              value={date}
              min={HK_EARLIEST_COVERED_DATE}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 w-full rounded-card border border-line bg-surfaceMuted px-3 py-2.5 font-mono text-sm outline-none focus:border-accent focus:bg-surface"
            />
          </label>
        </div>

        <fieldset className="space-y-2 border-t border-line pt-4">
          <legend className="text-sm font-medium">Your situation</legend>
          <Check label="Hong Kong permanent resident" checked={permanentResident} onChange={setPermanentResident} />
          <Check label="Already own other residential property" checked={ownsOther} onChange={setOwnsOther} />
          <Check label="Buying through a company" checked={viaCompany} onChange={setViaCompany} />
        </fieldset>

        <p className="text-xs leading-relaxed text-muted">
          The same three questions the report asks, in the same order the engine tests them. This
          is ad valorem duty only — it is not the whole cost of acquiring, and it is not advice.
        </p>
      </div>

      <div className="card">
        {result === null ? (
          <p className="text-sm text-negative">
            No rule set covers {date}. Rates are held from {HK_EARLIEST_COVERED_DATE} onwards —
            before that, the tables here would be guesswork.
          </p>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                Ad valorem duty
              </p>
              <p className="font-display text-[34px] font-bold leading-none tracking-[-0.02em]">
                {money(result.avdMinor)}
              </p>
              <p className="mt-1 text-xs text-muted">
                {((result.avdMinor / result.priceMinor) * 100).toFixed(2)}% of the price
              </p>
            </div>

            <dl className="space-y-2 border-t border-line pt-3 text-sm">
              <Line label="Scale applied" value={result.qualifies ? "Scale 2 (concession)" : "Part 1 of Scale 1"} />
              {result.band !== null && <Line label="Your band" value={describeBand(result.band)} />}
              {result.bsdLive && (
                <Line
                  label={`Buyer's Stamp Duty (${(result.bsdRate * 100).toFixed(0)}%)`}
                  value={result.liableToBsd ? money(result.bsdMinor) : "not payable"}
                />
              )}
              <Line
                label="Total duty"
                value={money(result.avdMinor + result.bsdMinor)}
                emphasis
              />
            </dl>

            {/* The single most valuable thing this can tell somebody, and it changes with the
                date: since 28/02/2024 both scales are the same table, so failing the concession
                test costs nothing in AVD. Before that it cost multiples. */}
            <p className="rounded-card border border-line bg-surfaceMuted px-3 py-2.5 text-xs leading-relaxed text-muted">
              {result.scalesDiffer ? (
                <>
                  On {date} the two scales <strong className="text-mist">differ</strong>, so
                  whether you meet the concession test changes what you owe.
                </>
              ) : (
                <>
                  On {date} both scales are the{" "}
                  <strong className="text-mist">same table</strong>, so owning another property or
                  buying through a company does not change the ad valorem duty
                  {result.bsdLive ? " — though BSD may still apply" : ""}.
                </>
              )}
            </p>

            <p className="text-xs text-muted">
              Rules in force {result.rules.meta.effectiveFrom}
              {result.rules.meta.effectiveTo === null ? " onwards" : ` to ${result.rules.meta.effectiveTo}`}.{" "}
              {result.rules.meta.sources.map((href, i) => (
                <a
                  key={href}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent underline underline-offset-2"
                >
                  {i === 0 ? "Source" : `Source ${i + 1}`}
                </a>
              ))}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Check({
  label,
  checked,
  onChange,
}: {
  readonly label: string;
  readonly checked: boolean;
  readonly onChange: (v: boolean) => void;
}): React.JSX.Element {
  return (
    <label className="flex items-center gap-2.5 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 rounded border-line accent-accent"
      />
      <span>{label}</span>
    </label>
  );
}

function Line({
  label,
  value,
  emphasis,
}: {
  readonly label: string;
  readonly value: string;
  readonly emphasis?: boolean;
}): React.JSX.Element {
  return (
    <div className={`flex items-baseline justify-between gap-4 ${emphasis ? "border-t border-line pt-2" : ""}`}>
      <dt className="text-muted">{label}</dt>
      <dd className={emphasis ? "font-semibold text-mist" : "text-mist"}>{value}</dd>
    </div>
  );
}
