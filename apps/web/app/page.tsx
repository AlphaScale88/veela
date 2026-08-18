import { PLANS, formatPlanPrice } from "@veela/api/plans";
import { HK_RULES_2026 } from "@veela/core";
import Image from "next/image";
import Link from "next/link";

import heroPhoto from "../public/hero/hong-kong-apartments.jpg";
import { HeroDemo } from "../components/hero-demo";
import { MapPreview } from "../components/map-preview";

/**
 * The landing page. A Server Component — the only client island is the hero, which has
 * to be one because it recomputes as you drag.
 *
 * A note on what is deliberately absent: there are no testimonials, no client count and
 * no ratings badges. Veela has no customers yet, and a page that invents them would
 * contradict the one thing the product is selling, which is that its numbers are
 * checkable. The credibility section cites dated rules and their sources instead —
 * that is the honest version of social proof for a product at this stage.
 */

export default function HomePage(): React.JSX.Element {
  return (
    <>
      <Hero />
      <MapTeaser />
      <Provenance />
      <Answers />
      <HowItWorks />
      <ShortLetLaw />
      <Pricing />
      <ClosingCta />
    </>
  );
}

function Hero(): React.JSX.Element {
  return (
    /* The marketplace hero: headline and CTAs on the left, a real Hong Kong photo in a
       big rounded card on the right — the Zillow/Airbnb shape, where the photo is doing
       as much persuasion as the copy. The photo is a genuine, credited find (see
       public/hero/CREDITS.md), not a stand-in for one the product doesn't have: the old
       codebase's only photography is Ho Chi Minh City and Hanoi, the wrong country for
       a Hong Kong-only product, so none of it is here.
       The live demo — the thing that actually proves the numbers are real — keeps its
       full-width band beneath, still its own card via hero-demo.tsx's own styling. */
    <section>
      <div className="col pb-14 pt-14 sm:pb-20 sm:pt-20">
        <div className="grid gap-12 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-16">
          <div>
            <p className="eyebrow">Hong Kong · long-term residential</p>

            {/* One weight, one colour — the two-tone (bold clause + muted clause) read
                as hedging on a line that's supposed to be the whole pitch in one
                breath. font-extrabold (800) is Bricolage Grotesque's heaviest cut;
                this is the one line on the site that should use it. */}
            <h1 className="mt-5 max-w-[15ch] font-display text-display-1 font-extrabold">
              Every number on a Hong Kong flat, and the one that kills the deal.
            </h1>

            <p className="mt-6 max-w-prose text-lede text-muted">
              Give Veela a price, a rent and your own buyer situation. It returns the
              yield, the stamp duty <em className="not-italic text-mist">you
              personally</em> owe, the tax, the payback — and the problems a first-time
              investor finds out about after signing.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link href="/analyse" className="btn-primary">
                Analyse a property
              </Link>
              <Link href="/map" className="btn-secondary">
                Explore the map
              </Link>
            </div>

            <p className="mt-5 text-sm text-muted">
              No account, nothing saved. The engine runs on the figures you type.
            </p>
          </div>

          <div className="relative aspect-[4/5] w-full overflow-hidden rounded-hero shadow-lift sm:aspect-[5/4] lg:aspect-[4/5]">
            <Image
              src={heroPhoto}
              alt="Colourful residential apartment towers in Hong Kong"
              fill
              sizes="(min-width: 1024px) 40vw, 100vw"
              priority
              className="object-cover"
            />
            {/* Gradient so the credit and the floating stat card stay legible over
                whatever the photo is doing at that corner. */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />

            <div className="absolute bottom-4 left-4 right-4 rounded-panel bg-surface/95 px-4 py-3 shadow-lift backdrop-blur sm:right-auto sm:max-w-[72%]">
              <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">
                Sourced, not guessed
              </p>
              <p className="mt-1 text-sm leading-snug text-mist">
                Stamp duty, tax and yield rules, each dated and cited.
              </p>
            </div>

            <a
              href="https://commons.wikimedia.org/wiki/File:Colorful_apartment_buildings_in_Hong_Kong.jpg"
              target="_blank"
              rel="noreferrer"
              className="absolute bottom-2 right-3 font-mono text-[10px] text-white/80 underline decoration-white/40 underline-offset-2 hover:text-white"
            >
              Photo: Raita Futo, CC BY 2.0
            </a>
          </div>
        </div>
      </div>

      <div className="col pb-16 sm:pb-24">
        <p className="eyebrow mb-4">Try it now</p>
        <HeroDemo />
      </div>
    </section>
  );
}

function Provenance(): React.JSX.Element {
  const effective = new Date(HK_RULES_2026.meta.effectiveFrom).toLocaleDateString(
    "en-GB",
    { day: "2-digit", month: "long", year: "numeric" },
  );

  return (
    <section className="band">
      <div className="col">
        <div className="grid gap-8 sm:grid-cols-[1fr_1.6fr] sm:items-start">
          <div>
            <h2 className="font-display text-display-3 font-semibold">
              An unsourced rate is a bug
            </h2>
            <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">
              Hong Kong changed its stamp duty three times in as many years. Veela selects
              a rule set by transaction date and shows you which one it used, so a figure
              from last year still reproduces.
            </p>
          </div>

          <dl className="grid gap-4 sm:grid-cols-3">
            <div className="card p-4">
              <dt className="eyebrow">Rule set in force</dt>
              <dd className="tnum mt-1.5 font-mono text-sm">
                {HK_RULES_2026.meta.jurisdiction} · from {effective}
              </dd>
            </div>
            <div className="card p-4">
              <dt className="eyebrow">Money</dt>
              <dd className="mt-1.5 font-mono text-sm">Integer cents, never a float</dd>
            </div>
            <div className="card p-4">
              <dt className="eyebrow">Suspended duties</dt>
              <dd className="mt-1.5 font-mono text-sm">Modelled, not deleted</dd>
            </div>
          </dl>
        </div>

        <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 border-t border-line pt-5">
          {HK_RULES_2026.meta.sources.map((s) => (
            <li key={s}>
              <a
                href={s}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-xs text-muted underline decoration-line underline-offset-4 hover:text-mist"
              >
                {new URL(s).hostname}
              </a>
            </li>
          ))}
          <li>
            <a
              href="https://www.rvd.gov.hk/en/publications/property_market_statistics.html"
              target="_blank"
              rel="noreferrer"
              className="font-mono text-xs text-muted underline decoration-line underline-offset-4 hover:text-mist"
            >
              www.rvd.gov.hk
            </a>
          </li>
        </ul>
      </div>
    </section>
  );
}

const ANSWERS = [
  {
    title: "What it returns",
    body: "Gross and net yield, cash-on-cash, and the payback period in years. Net is after costs and tax, before financing — and it says so, because the two get quoted interchangeably.",
    figure: "Net yield",
  },
  {
    title: "What you owe on day one",
    body: "Ad valorem stamp duty on your situation, not the headline rate. Permanent resident or not, first property or second, personal name or company — each moves you to a different scale.",
    figure: "AVD scale",
  },
  {
    title: "What goes wrong",
    body: "Assuming zero vacancy, a management fee that eats the margin, a mortgage that turns a positive yield negative. Each finding is rated: deal risk, check this, or note.",
    figure: "Findings",
  },
  {
    title: "Where the district is heading",
    body: "Vacancy against transaction volume over a long series is a defensible read on whether a district is tightening. Labelled with the level it was measured at.",
    figure: "Map",
  },
] as const;

function Answers(): React.JSX.Element {
  return (
    /* A card grid, deliberately — the feature-matrix shape Zillow and Airbnb both use
       for "here's what you get". Each card is independently legible, which is the
       point: a visitor scanning rather than reading should get the whole promise from
       four headlines and four eyebrows without touching the body copy. */
    <section className="band">
      <div className="col">
        <h2 className="max-w-display font-display text-display-2 font-semibold">
          Four questions, answered on the figures you actually have
        </h2>

        <dl className="mt-10 grid gap-5 sm:grid-cols-2">
          {ANSWERS.map((a) => (
            <div key={a.title} className="card card-hover">
              <dt>
                <span className="eyebrow">{a.figure}</span>
                <h3 className="mt-2 font-display text-display-3 font-semibold">
                  {a.title}
                </h3>
              </dt>
              <dd className="mt-2 text-[15px] leading-relaxed text-muted">{a.body}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

/**
 * Numbered because this genuinely is a sequence — you cannot read the verdict before
 * entering the figures. Numbering a set of unordered features would be decoration.
 */
const STEPS = [
  {
    n: "01",
    title: "Describe the flat",
    body: "Price, rent, area and transaction date. Then your own position as a buyer, which is what decides the stamp duty scale.",
  },
  {
    n: "02",
    title: "Read the verdict",
    body: "The headline returns first, then what is wrong with the deal, then the arithmetic that produced both — acquisition costs and the annual picture, line by line.",
  },
  {
    n: "03",
    title: "Keep it under watch",
    body: "A saved property becomes a monitored one: rules change, indices move, and the figures your decision rested on are dated so you can see what shifted.",
    pending: true,
  },
] as const;

function HowItWorks(): React.JSX.Element {
  return (
    <section className="band">
      <div className="col">
        <h2 className="font-display text-display-2 font-semibold">
          How it works
        </h2>

        <ol className="mt-10 grid gap-5 sm:grid-cols-3">
          {STEPS.map((s) => (
            <li key={s.n} className="card">
              <span className="tnum flex size-9 items-center justify-center rounded-full bg-accent/10 font-mono text-sm font-semibold text-accent">
                {s.n}
              </span>
              <h3 className="mt-4 font-display text-[19px] font-semibold tracking-[-0.02em]">
                {s.title}
                {"pending" in s && s.pending && (
                  <span className="ml-2 rounded-full border border-line px-2 py-0.5 align-middle font-mono text-[10px] uppercase tracking-[0.08em] text-muted">
                    Not built yet
                  </span>
                )}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function ShortLetLaw(): React.JSX.Element {
  return (
    /* Contained rather than full-bleed — every other section on the page is now a
       bounded card, and an edge-to-edge dark band would read as a leftover from a
       different design system rather than a deliberate contrast section. Same dark
       surface, same content, just given the same rounded-card treatment as everything
       around it. */
    <section className="band">
      <div className="col">
        <div className="grid gap-14 rounded-hero bg-inverse p-8 text-inverseText shadow-card sm:p-12 lg:grid-cols-[1.3fr_1fr] lg:items-start">
          <div>
            <p className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-inverseMuted">
              Cap. 349 · Hotel and Guesthouse Accommodation Ordinance
            </p>
            <h2 className="mt-4 max-w-[18ch] font-display text-display-2 font-semibold">
              There is no Airbnb calculator here, and there never will be.
            </h2>
            <p className="mt-5 max-w-prose leading-relaxed text-inverseMuted">
              {/* HK$500,000 and three years, not the HK$200,000 and two years this said until
                  18/08/2026. The penalties were raised under the new licensing regime and this
                  page was quoting the superseded figures — confirmed against the Office of the
                  Licensing Authority's own FAQ, which states the fine rose from $200,000 to
                  $500,000 and imprisonment from 2 years to 3. Understating a criminal penalty is
                  the same class of error as overstating a yield. */}
              Letting a Hong Kong flat for under 28 consecutive days without a guesthouse
              licence is a criminal offence — up to HK$500,000 and three years&apos;
              imprisonment. Tools built for the American market will happily model that
              income for you. Veela is a long-term rental yield product because that is
              the only legal one here.
            </p>
          </div>

          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-panel border border-inverseLine bg-inverseLine">
            <div className="bg-inverse p-5">
              <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-inverseMuted">
                Minimum let
              </dt>
              <dd className="tnum mt-1.5 font-display text-[28px] font-semibold tracking-[-0.02em]">
                28 days
              </dd>
            </div>
            <div className="bg-inverse p-5">
              <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-inverseMuted">
                Maximum fine
              </dt>
              <dd className="tnum mt-1.5 font-display text-[28px] font-semibold tracking-[-0.02em]">
                HK$200k
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}

function MapTeaser(): React.JSX.Element {
  return (
    /* Moved to directly follow the Hero, and given the Hero's own shape — a text row,
       then the evidence at full width below it — rather than squeezed into a side
       column. "Search happens on a map" is the second thing on the page now, not
       something you had to scroll past three other sections to find, and the map is
       large enough to read as the product rather than as an illustration of it. */
    <section className="band">
      <div className="col">
        <div className="sm:flex sm:items-end sm:justify-between sm:gap-8">
          <div>
            <p className="eyebrow">Discovery</p>
            <h2 className="mt-3 max-w-[26ch] font-display text-display-2 font-semibold">
              Search happens on a map, not in a form
            </h2>
            <p className="mt-4 max-w-prose text-[16px] leading-relaxed text-muted">
              Tap a district and read its supply and demand history — vacancy, completions,
              transaction volume. The map is built from free public aggregates; the verdict
              comes from what you enter. Each half stands on its own.
            </p>
          </div>

          <Link
            href="/map"
            className="mt-6 inline-block shrink-0 text-[15px] font-medium underline decoration-accent decoration-2 underline-offset-[6px] transition-colors hover:text-accent sm:mt-0"
          >
            Open the full map →
          </Link>
        </div>

        <div className="mt-10">
          <MapPreview heightClassName="h-[420px] sm:h-[520px]" showZoomControl />
        </div>

        <p className="mt-4 max-w-prose border-l-2 border-caution pl-5 text-sm leading-relaxed text-muted">
          <span className="font-medium text-mist">Currently synthetic.</span> The
          ingestion job for Lands Department geometry and the RVD series is not built, so
          the map ships with fixtures and says so on the page. Inventing plausible numbers
          would be the fastest way to lose an investor&apos;s trust.
        </p>
      </div>
    </section>
  );
}

/**
 * Pricing on the landing page, immediately before the closing call to action.
 *
 * **A summary, not a copy of `/pricing`.** It renders from the same `PLANS` object, so the
 * numbers cannot drift from the pricing page or from the quotas the rate limiter actually
 * enforces — but it shows the price, the one-line pitch and a link, rather than every feature
 * bullet. Duplicating the full table would mean two pages to keep in step and a landing page
 * that reads like a spreadsheet.
 *
 * Placed last on purpose: a visitor who has just been shown what the product does is in a
 * position to judge a price. One who meets it first is being asked to value something they
 * have not seen.
 */
function Pricing(): React.JSX.Element {
  const plans = [PLANS.free, PLANS.investor, PLANS.pro];
  return (
    <section className="band">
      <div className="col">
        <h2 className="max-w-display font-display text-display-2 font-semibold">
          Free to look. Paid when it matters.
        </h2>
        <p className="mt-5 max-w-prose text-[16px] leading-relaxed text-muted">
          Deciding on one property costs nothing, and that is most of what Veela does. You pay
          to keep watching what you own — a portfolio checked against the market and the stamp
          duty rules, month after month. Teams pay for the tax engine directly.
        </p>

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {plans.map((plan) => (
            <div key={plan.id} className="card flex h-full flex-col">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-[15px] font-semibold">{plan.name}</h3>
                <span className="tnum font-display text-[22px] font-semibold tracking-[-0.02em]">
                  {formatPlanPrice(plan)}
                </span>
              </div>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{plan.blurb}</p>
              {plan.monthlyQuota > 0 && (
                <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.08em] text-muted">
                  {plan.monthlyQuota.toLocaleString("en-HK")} API calls a month
                </p>
              )}
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2">
          <Link href="/pricing" className="btn-secondary">
            See what each plan includes
          </Link>
          <Link
            href="/developers"
            className="text-sm font-medium underline decoration-line underline-offset-4 hover:text-mist"
          >
            Or read the API docs
          </Link>
        </div>
      </div>
    </section>
  );
}

function ClosingCta(): React.JSX.Element {
  return (
    /* The closing banner every marketplace page ends on — a tinted card, not full-bleed
       colour, so it stays inside the same bounded-card language as the rest of the
       page rather than reaching for a louder full-width block. */
    <section className="pb-20 pt-4 sm:pb-28">
      <div className="col">
        <div className="grid gap-x-16 gap-y-8 rounded-hero border border-line bg-accent/[0.05] p-8 shadow-card sm:p-12 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <h2 className="max-w-display font-display text-display-2 font-semibold">
              Find out before you sign, not after
            </h2>
            <p className="mt-5 max-w-prose text-[16px] leading-relaxed text-muted">
              The form is one screen and the live yield estimate is immediate, no
              account needed — the full report needs a free login.
            </p>
          </div>
          <Link href="/analyse" className="btn-primary shrink-0">
            Analyse a property
          </Link>
        </div>
      </div>
    </section>
  );
}
