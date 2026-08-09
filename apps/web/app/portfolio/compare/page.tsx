"use client";

import type { Verdict as CoreVerdict } from "@veela/core";
import type { Property } from "@veela/db";
import {
  criticalCount,
  formatCompactMoney,
  formatPercent,
  formatYears,
  gradeNetYield,
  rateVerdict,
  standingColor,
} from "@veela/ui";
import Link from "next/link";
import { useEffect, useState } from "react";

import { AppShell } from "../../../components/app-shell";
import { useAuth } from "../../../components/auth-provider";

const MAX_COMPARE = 3;

interface Row {
  readonly property: Property;
  readonly verdict: CoreVerdict | null;
}

/**
 * Property Compare — side by side, from what's already saved. No new computation:
 * every figure here is the stored snapshot from when each property was saved (or the
 * live report, for whichever one was analysed most recently), same as `/portfolio`.
 */
export default function ComparePage(): React.JSX.Element {
  const { user, loading, configured } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [selected, setSelected] = useState<readonly string[]>([]);

  useEffect(() => {
    if (user === null) return;
    let cancelled = false;
    (async () => {
      const listRes = await fetch("/api/properties");
      if (!listRes.ok) return;
      const { properties } = (await listRes.json()) as { properties: Property[] };
      const detailed = await Promise.all(
        properties.map(async (property) => {
          const res = await fetch(`/api/properties/${property.id}`);
          if (!res.ok) return { property, verdict: null };
          const detail = (await res.json()) as { verdict: { payload: CoreVerdict } | null };
          return { property, verdict: detail.verdict?.payload ?? null };
        }),
      );
      if (!cancelled) {
        setRows(detailed);
        setSelected(detailed.slice(0, 2).map((r) => r.property.id));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  function toggle(id: string): void {
    setSelected((s) =>
      s.includes(id) ? s.filter((x) => x !== id) : s.length >= MAX_COMPARE ? s : [...s, id],
    );
  }

  if (!configured) {
    return (
      <AppShell breadcrumb="My Workspace › Property Compare">
        <p className="card max-w-prose text-sm text-muted">
          Sign-in isn't configured on this deployment.
        </p>
      </AppShell>
    );
  }

  if (loading) {
    return (
      <AppShell breadcrumb="My Workspace › Property Compare">
        <p className="text-sm text-muted">Loading…</p>
      </AppShell>
    );
  }

  if (user === null) {
    return (
      <AppShell breadcrumb="My Workspace › Property Compare">
        <h1 className="font-display text-[26px] font-semibold tracking-[-0.03em] text-mist">
          Property Compare
        </h1>
        <p className="mt-3 max-w-prose text-sm text-muted">
          Log in and save a couple of properties from a report to compare them here.
        </p>
        <Link href="/login?next=/portfolio/compare" className="btn-primary mt-5 inline-flex !px-6 !py-3">
          Log in
        </Link>
      </AppShell>
    );
  }

  const compared = rows?.filter((r) => selected.includes(r.property.id)) ?? [];

  return (
    <AppShell breadcrumb="My Workspace › Property Compare">
      <header className="max-w-prose">
        <h1 className="font-display text-[26px] font-semibold tracking-[-0.03em] text-mist">
          Property Compare
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Pick up to {MAX_COMPARE} saved properties. Figures are each one's saved
          snapshot, not recomputed — re-run a report on{" "}
          <Link href="/analyse" className="text-accent hover:underline">
            /analyse
          </Link>{" "}
          if it's been a while.
        </p>
      </header>

      {rows !== null && rows.length === 0 && (
        <p className="card mt-8 max-w-prose text-sm text-muted">
          Nothing saved yet — there's nothing to compare.{" "}
          <Link href="/analyse" className="text-accent hover:underline">
            Analyse a property
          </Link>{" "}
          first.
        </p>
      )}

      {rows !== null && rows.length > 0 && (
        <>
          <div className="mt-6 flex flex-wrap gap-2">
            {rows.map((r) => (
              <button
                key={r.property.id}
                type="button"
                onClick={() => toggle(r.property.id)}
                aria-pressed={selected.includes(r.property.id)}
                disabled={!selected.includes(r.property.id) && selected.length >= MAX_COMPARE}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                  selected.includes(r.property.id)
                    ? "border-accent bg-accent text-white"
                    : "border-line text-muted hover:text-mist"
                }`}
              >
                {r.property.label}
              </button>
            ))}
          </div>

          {compared.length === 0 ? (
            <p className="card mt-6 max-w-prose text-sm text-muted">Pick at least one.</p>
          ) : (
            <div className="card mt-6 overflow-x-auto p-0">
              <table className="w-full min-w-[36rem] text-sm">
                <thead>
                  <tr className="border-b border-line bg-surfaceMuted text-left text-xs text-muted">
                    <th scope="col" className="px-4 py-2.5 font-medium">—</th>
                    {compared.map((r) => (
                      <th key={r.property.id} scope="col" className="px-4 py-2.5 text-left font-medium text-mist">
                        {r.property.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <CompareRow label="Price" rows={compared} render={(v, p) => formatCompactMoney({ amount: p.priceMinor, currency: p.currency })} />
                  <CompareRow label="Net yield" rows={compared} render={(v) => (v !== null ? formatPercent(v.returns.netYield) : "—")} color={(v) => (v !== null ? standingColor[gradeNetYield(v.returns.netYield)] : undefined)} />
                  <CompareRow label="Cash-on-cash" rows={compared} render={(v) => (v !== null ? formatPercent(v.returns.cashOnCash) : "—")} />
                  <CompareRow label="Payback" rows={compared} render={(v) => (v !== null ? formatYears(v.returns.paybackYears) : "—")} />
                  <CompareRow label="Stamp duty" rows={compared} render={(v) => (v !== null ? formatCompactMoney(v.acquisition.stampDuty) : "—")} />
                  <CompareRow label="Critical findings" rows={compared} render={(v) => (v !== null ? String(criticalCount(v)) : "—")} />
                  <CompareRow label="Veela rating" rows={compared} render={(v) => (v !== null ? `${rateVerdict(v).stars.toFixed(1)}/5` : "—")} />
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}

function CompareRow({
  label,
  rows,
  render,
  color,
}: {
  readonly label: string;
  readonly rows: readonly Row[];
  readonly render: (v: CoreVerdict | null, p: Property) => string;
  readonly color?: (v: CoreVerdict | null) => string | undefined;
}): React.JSX.Element {
  return (
    <tr className="border-b border-line/60 last:border-0">
      <th scope="row" className="px-4 py-2.5 text-left font-normal text-muted">{label}</th>
      {rows.map((r) => (
        <td
          key={r.property.id}
          className="tnum px-4 py-2.5 font-medium"
          style={color !== undefined ? { color: color(r.verdict) } : undefined}
        >
          {render(r.verdict, r.property)}
        </td>
      ))}
    </tr>
  );
}
