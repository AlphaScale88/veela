import { HK_RULE_SETS, minor, type DutyBand, type StampDutyScale } from "@veela/core";
import { formatCompactMoney } from "@veela/ui";

import { AppShell } from "../../../components/app-shell";
import { DutyCalculator } from "../../../components/duty-calculator";

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
/**
 * The glossary and the official-source list, moved here when `/resources` was removed.
 *
 * `/resources` carried three things: these terms, these links, and a copy of the stamp duty
 * scales. **The third was already a duplicate of this page** — both read `HK_RULE_SETS`, so the
 * scales existed twice with one object behind them. That is the argument for the merge: a reader
 * asking "what does *saleable area* mean" and a reader asking "what is the duty on HK$9M" are the
 * same reader, one paragraph apart, and splitting them across two pages meant the definitions sat
 * somewhere the rules were not.
 *
 * Nothing was rewritten in the move. Terms that point at "Market Regulations" now point at the
 * page they are on, which is the only edit.
 */
const GLOSSARY: readonly { readonly term: string; readonly definition: string }[] = [
  {
    term: "Net yield",
    definition:
      "Net income (rent, minus vacancy, management fees, rates, tax) divided by the total cash to acquire the property, before financing. The headline number on every report.",
  },
  {
    term: "Gross yield",
    definition: "Annual rent divided by price — the simplest, roughest read, before any cost is subtracted.",
  },
  {
    term: "Cash-on-cash return",
    definition:
      "Net income after financing, divided by the cash actually invested (the deposit plus costs, not the full price) — the number that matters once a mortgage is in the picture.",
  },
  {
    term: "Payback period",
    definition:
      "Years of net income needed to recover the cash invested. A longer payback isn't necessarily bad — it depends what else the report finds.",
  },
  {
    term: "Stamp duty (AVD)",
    definition:
      "Ad Valorem Stamp Duty — a one-off tax on the purchase price, on a sliding scale that depends heavily on whether the buyer is a first-time Hong Kong permanent resident. The actual bands are at the top of this page.",
  },
  {
    term: "Property Tax",
    definition:
      "Hong Kong's tax on rental income — 15% of the net assessable value (rent, less a 20% notional allowance for repairs). Not the same tax as Profits Tax or Salaries Tax.",
  },
  {
    term: "Government rates",
    definition:
      "A recurring charge on the rateable value of a property, separate from — and much smaller than — stamp duty.",
  },
  {
    term: "The 28-day rule (Cap. 349)",
    definition:
      "Letting a Hong Kong residential property for under 28 consecutive days without a guesthouse licence is a criminal offence, carrying up to HK$500,000 and three years' imprisonment. This is why Veela has no short-term-rental features.",
  },
  {
    term: "Capital gains",
    definition:
      "Hong Kong has no capital gains tax on investment property. Frequent buying and selling can still be assessed as trading under Profits Tax — a risk the report flags, not computes.",
  },
  {
    term: "Saleable area",
    definition:
      "The floor area you can actually use, measured to the inside of the walls. Hong Kong listings historically quoted gross floor area, which adds a share of lifts, lobbies and clubhouse — typically 20-30% larger. Since 2013 residential sales must quote saleable area, but older listings and casual conversation still mix them, and comparing a saleable figure with a gross one makes a flat look far better value than it is. Everything Veela computes uses saleable area.",
  },
  {
    term: "Efficiency ratio",
    definition:
      "Saleable area divided by gross floor area. A high ratio means less of what you buy is corridor and clubhouse. Older buildings often beat newer ones here, which is part of why price per square foot alone is a poor comparison between developments.",
  },
  {
    term: "Rateable value",
    definition:
      "The Rating and Valuation Department's estimate of the annual open-market rent of a property. Government rates are charged as a percentage of it, not of the purchase price. Veela estimates rates from your rent figure when you do not supply a rateable value, and the report says so — the real figure comes from the RVD and will differ.",
  },
  {
    term: "Government rent",
    definition:
      "Separate from rates, and often confused with them. A charge on land held under a lease that requires it — commonly 3% of rateable value a year. Whether it applies depends on the lot's own lease terms, which is why it is not assumed for every property.",
  },
  {
    term: "AVD Scale 1 and Scale 2",
    definition:
      "The two ad valorem stamp duty scales. Scale 2 is the lower one and applies to a Hong Kong permanent resident buying who owns no other residential property. Scale 1 is the flat higher rate that applies otherwise — buying a second property, or buying through a company. Which one you fall under is usually the single largest cost difference in a Hong Kong purchase, which is why the report asks about it before anything else.",
  },
  {
    term: "Marginal relief",
    definition:
      "Where a stamp duty band changes, a small increase in price would otherwise cause a large jump in duty. Marginal relief caps the duty so that crossing a boundary never costs more than the extra price paid. Veela's scale table is tested for continuity at every one of these boundaries — the property that proves a transcription of the IRD table is correct rather than merely plausible.",
  },
  {
    term: "BSD, SSD and NRSD",
    definition:
      "Buyer's Stamp Duty, Special Stamp Duty and New Residential Stamp Duty — the cooling measures removed in February 2024. They are modelled rather than deleted, because the rules are versioned by transaction date: a purchase dated while they applied still prices under them.",
  },
  {
    term: "Vacancy rate",
    definition:
      "The share of the year a flat sits empty between tenants. A report assuming none is assuming perfect, uninterrupted letting, which no landlord experiences. Veela defaults to 4% — about two weeks a year — and raises a finding if you set it to zero.",
  },
  {
    term: "Provisional and formal agreement",
    definition:
      "A Hong Kong purchase usually runs provisional agreement (with an initial deposit, commonly 3-5%), then a formal agreement within a couple of weeks (taking the deposit to around 10%), then completion. Stamp duty is generally payable within 30 days of the earlier chargeable agreement — a timing question worth putting to your solicitor rather than inferring from a calculator.",
  },
];

/** The official sources everything on this page and in every report is checkable against. */
const OFFICIAL_SOURCES: readonly { readonly label: string; readonly href: string }[] = [
  { label: "Inland Revenue Department — stamp duty rates", href: "https://www.gov.hk/en/residents/taxes/stamp/stamp_duty_rates.htm" },
  { label: "Inland Revenue Department — ad valorem duty FAQ", href: "https://www.ird.gov.hk/eng/faq/avd.htm" },
  { label: "Rating and Valuation Department — property market statistics", href: "https://www.rvd.gov.hk/en/publications/property_market_statistics.html" },
  { label: "Rating and Valuation Department — rates and Government rent", href: "https://www.rvd.gov.hk/en/our_services/rates.html" },
  { label: "Land Registry — monthly statistics", href: "https://www.landreg.gov.hk/en/monthly/agreement.htm" },
  { label: "Land Registry — search fees", href: "https://www.landreg.gov.hk/en/services/search_fee.htm" },
  { label: "Census and Statistics Department", href: "https://www.censtatd.gov.hk/en/" },
  /* Two of these were dead until 21/08/2026, found by fetching every outbound link on the site
     rather than by anyone clicking: the EAA search had moved to `/en-us/Licence-list`, and the
     HKMA bulletin path had gained a `data-and-` segment. Both returned a plain 404, and a source
     list is the worst place in this product to carry one — the whole claim of the page is
     "check us against the primary source", which a 404 quietly withdraws.

     Replacements were confirmed by title, not just by status: "Licence list" and "Monthly
     Statistical Bulletin". Worth re-running `scripts/check-links.mjs` after any Budget or site
     redesign. */
  { label: "Estate Agents Authority — check an agent's licence", href: "https://www.eaa.org.hk/en-us/Licence-list" },
  { label: "Law Society of Hong Kong — find a solicitor", href: "https://www.hklawsoc.org.hk/en/Serve-the-Public/The-Law-List" },
  { label: "Hong Kong Monetary Authority — monthly statistical bulletin", href: "https://www.hkma.gov.hk/eng/data-publications-and-research/data-and-statistics/monthly-statistical-bulletin/" },
  { label: "Hotel and Guesthouse Accommodation Ordinance (Cap. 349)", href: "https://clic.org.hk/en/topics/landlord_tenant/thingsYouNeedToNote/convert_or_use_property_to_grant_short-term_leases" },
];

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
          Stamp duty & rules
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Effective from {rules.meta.effectiveFrom}
          {rules.meta.effectiveTo !== null && ` to ${rules.meta.effectiveTo}`}. Every
          figure below is read from the same rule set{" "}
          <code className="font-mono text-xs">/api/verdict/preview</code> computes
          against — nothing here is a separate summary that could disagree with it.
        </p>
      </header>

      {/* Before the tables, not after: the tables answer "what are the rates", and almost
          nobody arrives with that question. They arrive with "what do I owe", which is a
          different question the same rule sets can answer directly. The calculator reads
          `evaluateScale` and `HK_RULE_SETS`, so it cannot disagree with the tables below it
          or with a report. */}
      <Section title="What would you pay?">
        <DutyCalculator />
      </Section>

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
              {rules.additionalDuties.map((d) => (
                <tr key={d.id} className="border-b border-line/60">
                  <th scope="row" className="px-4 py-2.5 text-left font-normal text-mist">
                    {d.label}
                  </th>
                  <td className="tnum px-4 py-2.5 text-right text-muted">
                    {(d.rate * 100).toFixed(1)}%
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted">
                    {d.suspended ? `Abolished ${d.suspendedSince}. ` : "In force. "}
                    {d.note}
                  </td>
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

      <Section title="Terms this report uses">
        <p className="text-sm leading-relaxed text-muted">
          Moved here from the Resources page, which also carried a second copy of the stamp duty
          scales above — both read the same rule set, so the definitions now sit next to the rules
          they define rather than one page away.
        </p>
        <dl className="mt-4 divide-y divide-line overflow-hidden rounded-panel border border-line bg-surface">
          {GLOSSARY.map(({ term, definition }) => (
            <div key={term} className="px-4 py-3">
              <dt className="text-[14px] font-semibold text-mist">{term}</dt>
              <dd className="mt-1 text-sm leading-relaxed text-muted">{definition}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section title="Sources">
        <p className="text-sm leading-relaxed text-muted">
          The rule set on this page cites these directly:
        </p>
        <ul className="mt-2 space-y-1 text-sm">
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

        <p className="mt-5 text-sm leading-relaxed text-muted">
          And the wider set everything in the product is checkable against — regulators and
          registers, not a curated list of providers. Veela vets nobody.
        </p>
        <ul className="mt-2 space-y-1.5 text-sm">
          {/* Filtered against the rule set's own citations, so a URL never appears twice on one
              page just because two lists happen to contain it. */}
          {OFFICIAL_SOURCES.filter((o) => !rules.meta.sources.includes(o.href)).map((o) => (
            <li key={o.href}>
              <a
                href={o.href}
                target="_blank"
                rel="noreferrer"
                className="underline decoration-line underline-offset-4 hover:text-mist"
              >
                {o.label}
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
      {/* The label was a `<caption className="sr-only">` here, *outside* the table. A `<caption>`
          must be the first child of its `<table>`; a browser relocates a stray one, so the
          server-rendered HTML never matched the hydrated DOM and this page threw a hydration
          error on every visit. It was also redundant with the visible label directly below it.
          Removed, and the table names itself instead. Pre-existing, found by running this page
          with the console captured while merging the Resources content into it. */}
      <p className="border-b border-line px-4 py-2.5 text-sm font-semibold text-mist">
        {scale.label}
      </p>
      <table className="w-full text-sm" aria-label={scale.label}>
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
