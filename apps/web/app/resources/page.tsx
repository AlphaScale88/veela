import { AppShell } from "../../components/app-shell";

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

const SOURCES: readonly { readonly label: string; readonly href: string }[] = [
  { label: "Inland Revenue Department — stamp duty", href: "https://www.gov.hk/en/residents/taxes/stamp/stamp_duty_rates.htm" },
  { label: "Inland Revenue Department — property tax FAQ", href: "https://www.ird.gov.hk/eng/faq/avd.htm" },
  {
    label: "Rating and Valuation Department — property market statistics",
    href: "https://www.rvd.gov.hk/en/publications/property_market_statistics.html",
  },
  { label: "Land Registry — monthly statistics", href: "https://www.landreg.gov.hk/en/monthly/agreement.htm" },
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
        <dl className="mt-3 space-y-4">
          {GLOSSARY.map((g) => (
            <div key={g.term} className="card">
              <dt className="text-[15px] font-semibold">{g.term}</dt>
              <dd className="mt-1 text-sm leading-relaxed text-muted">{g.definition}</dd>
            </div>
          ))}
        </dl>
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
