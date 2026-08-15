import { HK_RULE_SETS } from "@veela/core";

import { AppShell } from "../../components/app-shell";

/** The rule set in force today — the last one, since they are ordered by effective date. */
const RULES = HK_RULE_SETS[HK_RULE_SETS.length - 1]!;

/**
 * Mashvisor's "Resources" without the version of it that doesn't fit here — no vetted
 * lender/contractor marketplace (Veela vets nobody; see `.claude/CLAUDE.md` for why
 * that specifically wasn't built). What travels: explaining terms the report uses, and
 * pointing at the government sources everything is checkable against.
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
    definition: "Net income after financing, divided by the cash actually invested (the deposit plus costs, not the full price) — the number that matters once a mortgage is in the picture.",
  },
  {
    term: "Payback period",
    definition: "Years of net income needed to recover the cash invested. A longer payback isn't necessarily bad — it depends what else the report finds.",
  },
  {
    term: "Stamp duty (AVD)",
    definition: "Ad Valorem Stamp Duty — a one-off tax on the purchase price, on a sliding scale that depends heavily on whether the buyer is a first-time Hong Kong permanent resident. See Market Regulations for the actual bands.",
  },
  {
    term: "Property Tax",
    definition: "Hong Kong's tax on rental income — 15% of the net assessable value (rent, less a 20% notional allowance for repairs). Not the same tax as Profits Tax or Salaries Tax.",
  },
  {
    term: "Government rates",
    definition: "A recurring charge on the rateable value of a property, separate from — and much smaller than — stamp duty.",
  },
  {
    term: "The 28-day rule (Cap. 349)",
    definition: "Letting a Hong Kong residential property for under 28 consecutive days without a guesthouse licence is a criminal offence. This is why Veela has no short-term-rental features.",
  },
  {
    term: "Capital gains",
    definition: "Hong Kong has no capital gains tax on investment property. Frequent buying and selling can still be assessed as trading under Profits Tax — a risk the report flags, not computes.",
  },
];

const EXTRA_GLOSSARY: readonly { readonly term: string; readonly definition: string }[] = [
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

const SOURCES: readonly { readonly label: string; readonly href: string }[] = [
  { label: "Inland Revenue Department — stamp duty", href: "https://www.gov.hk/en/residents/taxes/stamp/stamp_duty_rates.htm" },
  { label: "Inland Revenue Department — property tax FAQ", href: "https://www.ird.gov.hk/eng/faq/avd.htm" },
  {
    label: "Rating and Valuation Department — property market statistics",
    href: "https://www.rvd.gov.hk/en/publications/property_market_statistics.html",
  },
  { label: "Land Registry — monthly statistics", href: "https://www.landreg.gov.hk/en/monthly/agreement.htm" },
  { label: "Land Registry — search fees", href: "https://www.landreg.gov.hk/en/services/search_fee.htm" },
  { label: "Rating and Valuation Department — rates and Government rent", href: "https://www.rvd.gov.hk/en/public_services/index.html" },
  { label: "Census and Statistics Department", href: "https://www.censtatd.gov.hk/en/" },
  { label: "Estate Agents Authority — check an agent's licence", href: "https://www.eaa.org.hk/en-us/Information-Centre/Licensee-Search" },
  { label: "Law Society of Hong Kong — find a solicitor", href: "https://www.hklawsoc.org.hk/en/Serve-the-Public/The-Law-List" },
  { label: "Hong Kong Monetary Authority — residential mortgage survey", href: "https://www.hkma.gov.hk/eng/data-publications-and-research/statistics/monthly-statistical-bulletin/" },
  {
    label: "Hotel and Guesthouse Accommodation Ordinance (Cap. 349)",
    href: "https://clic.org.hk/en/topics/landlord_tenant/thingsYouNeedToNote/convert_or_use_property_to_grant_short-term_leases",
  },
];

export default function ResourcesPage(): React.JSX.Element {
  return (
    <AppShell breadcrumb="Resources">
      <header className="max-w-prose">
        <h1 className="font-display text-[26px] font-semibold tracking-[-0.03em] text-mist">
          Resources
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          What the terms on a report actually mean, and the government sources every
          rate here is checkable against. Veela doesn't vet lenders, solicitors or
          contractors — for that, the Law Society of Hong Kong and the Hong Kong
          Monetary Authority's list of authorized institutions are the real starting
          points, not a list we'd curate ourselves.
        </p>
      </header>

      <section className="mt-8 max-w-2xl">
        <h2 className="font-display text-[18px] font-semibold tracking-[-0.02em] text-mist">
          Glossary
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          Every term the report uses, plus the Hong Kong-specific ones that cost people money
          when they are misread — saleable versus gross area, and which stamp duty scale you
          fall under.
        </p>
        <dl className="mt-3 space-y-4">
          {[...GLOSSARY, ...EXTRA_GLOSSARY].map((g) => (
            <div key={g.term} className="card">
              <dt className="text-[15px] font-semibold">{g.term}</dt>
              <dd className="mt-1 text-sm leading-relaxed text-muted">{g.definition}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/**
       * The scales, read from `HK_RULE_SETS` rather than retyped.
       *
       * `/research/market-regulations` already does this for the rules narrative; this is the
       * same discipline applied to the numbers themselves. A hand-copied duty table on a
       * resources page is a second source of truth that goes wrong at the next Budget and
       * nobody notices — reading the object the engine prices against means this page is
       * already correct whenever the engine is.
       */}
      <section className="mt-8">
        <h2 className="font-display text-[18px] font-semibold tracking-[-0.02em] text-mist">
          Stamp duty, as the engine computes it
        </h2>
        <p className="mt-1 max-w-prose text-sm leading-relaxed text-muted">
          Read directly from the rule set every report is priced against — {RULES.meta.effectiveFrom}
          {RULES.meta.effectiveTo === null ? ", still current" : ` to ${RULES.meta.effectiveTo}`}. If
          this table and your report ever disagree, the report is right and this is a bug.
        </p>
        <div className="mt-4 grid gap-5 lg:grid-cols-2">
          {[RULES.stampDuty.firstTimeResident, RULES.stampDuty.other].map((scale) => (
            <ScaleTable key={scale.id} label={scale.label} bands={scale.bands} />
          ))}
        </div>
        {(RULES.meta.caveats ?? []).length > 0 && (
          <ul className="mt-4 max-w-prose space-y-2">
            {(RULES.meta.caveats ?? []).map((caveat) => (
              <li
                key={caveat}
                className="rounded-card border border-caution/40 bg-caution/10 px-3 py-2 text-xs leading-relaxed text-muted"
              >
                {caveat}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8 max-w-2xl">
        <h2 className="font-display text-[18px] font-semibold tracking-[-0.02em] text-mist">
          Primary sources
        </h2>
        <ul className="mt-3 space-y-2">
          {SOURCES.map((s) => (
            <li key={s.href}>
              <a
                href={s.href}
                target="_blank"
                rel="noreferrer"
                className="text-sm underline decoration-line underline-offset-4 hover:text-mist"
              >
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </section>
    </AppShell>
  );
}

/**
 * One scale, rendered from its bands.
 *
 * Bands come in three shapes and each says something different, so they are not flattened into
 * a single "rate" column that would misdescribe two of them:
 *  - `flat` — a fixed amount regardless of price (the HK$100 floor at the bottom of Scale 2)
 *  - `percentage` — a straight rate on the whole consideration
 *  - `marginal` — the relief band that stops a boundary costing more than the price step
 */
function ScaleTable({
  label,
  bands,
}: {
  readonly label: string;
  readonly bands: readonly Record<string, unknown>[];
}): React.JSX.Element {
  const hkd = (minor: unknown): string =>
    typeof minor === "number" ? `HK$${(minor / 100).toLocaleString("en-HK")}` : "—";

  return (
    <div className="card p-0">
      <h3 className="border-b border-line px-5 py-3 text-[15px] font-semibold">{label}</h3>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[340px] border-collapse text-sm">
          <thead>
            <tr className="text-left font-mono text-[10px] uppercase tracking-[0.08em] text-muted">
              <th className="px-5 py-2 font-normal">Up to</th>
              <th className="px-5 py-2 font-normal">Duty</th>
            </tr>
          </thead>
          <tbody>
            {bands.map((b, i) => (
              <tr key={i} className="border-t border-line/60">
                <td className="tnum px-5 py-2 font-mono text-xs">{hkd(b["upTo"])}</td>
                <td className="px-5 py-2">
                  {b["kind"] === "flat" && <span className="tnum">{hkd(b["fixed"])}</span>}
                  {b["kind"] === "percentage" && (
                    <span className="tnum">{((b["rate"] as number) * 100).toFixed(3).replace(/\.?0+$/, "")}%</span>
                  )}
                  {b["kind"] === "marginal" && (
                    <span className="text-muted">
                      marginal relief — capped so crossing this band never costs more than the
                      extra price
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
