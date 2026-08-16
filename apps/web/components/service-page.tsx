import Link from "next/link";

/**
 * Shared furniture for the Services pages: hero, benefit cards, fact bar, FAQ.
 *
 * ## What was taken from the reference, and what deliberately wasn't
 *
 * Mashvisor's Mortgage, Insurance, Agent Finder and Home Valuation pages share one architecture
 * — centred hero with an icon, a headline and a subheadline; three benefit cards; a strip of
 * trust statistics; a "how it works" sequence; an FAQ; a closing call to action. It is a good
 * structure and it is adopted here almost exactly.
 *
 * **What is not adopted is what fills it.** All three of those pages are lead-generation funnels
 * for a partner: "Get Matched Now" hands you to a lender, valuations go to Akrivis at $275,
 * agents come from BiggerPockets. Veela has no partners, takes no referral fee, and could not
 * lawfully run the agent one anyway. So the same slots carry Veela's own substance.
 *
 * The trust strip is the sharpest example. Theirs reads *"Trusted by 50,000+ investors"* and
 * *"10,000+ successful matches"*. **Veela has no users, so any number of that kind would be
 * invented** — the precise failure this codebase refuses everywhere else. `FactBar` therefore
 * takes only facts that are checkable from the repository itself: the IRD transcription, the
 * test count, the span of the RVD series. For this product those are the better claim anyway —
 * an investor deciding whether to trust a stamp duty figure cares more that it is tested than
 * that other people liked it.
 */

export function ServiceHero({
  eyebrow,
  title,
  subtitle,
  icon: Icon,
  children,
}: {
  readonly eyebrow: string;
  readonly title: string;
  readonly subtitle: string;
  readonly icon: (p: { readonly className?: string }) => React.JSX.Element;
  /** Optional call to action under the subtitle. */
  readonly children?: React.ReactNode;
}): React.JSX.Element {
  return (
    <header className="mx-auto max-w-2xl text-center">
      <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-accent/10 text-accent">
        <Icon className="h-7 w-7" />
      </span>
      <p className="eyebrow mt-4">{eyebrow}</p>
      <h1 className="mt-3 font-display text-[32px] font-extrabold leading-tight tracking-[-0.03em] sm:text-[38px]">
        {title}
      </h1>
      <p className="mx-auto mt-4 max-w-prose text-[16px] leading-relaxed text-muted">{subtitle}</p>
      {children !== undefined && <div className="mt-6">{children}</div>}
    </header>
  );
}

export interface Benefit {
  readonly title: string;
  readonly caption: string;
  readonly icon: (p: { readonly className?: string }) => React.JSX.Element;
}

/** The three-card row. Three because the eye takes three at a glance and the reference uses
 *  three; a fourth would read as a list rather than a summary. */
export function BenefitCards({ items }: { readonly items: readonly Benefit[] }): React.JSX.Element {
  return (
    <div className="mx-auto mt-10 grid max-w-4xl gap-4 sm:grid-cols-3">
      {items.map(({ title, caption, icon: Icon }) => (
        <div key={title} className="card text-center">
          <span className="mx-auto flex size-10 items-center justify-center rounded-card bg-accent/10 text-accent">
            <Icon className="h-5 w-5" />
          </span>
          <h3 className="mt-3 text-[15px] font-semibold">{title}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">{caption}</p>
        </div>
      ))}
    </div>
  );
}

/**
 * Where the reference puts "Trusted by 50,000+ investors".
 *
 * Every entry must be checkable from this repository. Veela has no user base and inventing one
 * would undo the point of the pages it sits on.
 */
export function FactBar({ facts }: { readonly facts: readonly string[] }): React.JSX.Element {
  return (
    <ul className="mx-auto mt-8 flex max-w-3xl flex-wrap items-center justify-center gap-x-7 gap-y-2 text-sm text-muted">
      {facts.map((f) => (
        <li key={f} className="flex items-center gap-2">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-accent" />
          {f}
        </li>
      ))}
    </ul>
  );
}

/** The numbered sequence the reference calls "How it works". */
export function Steps({
  title,
  steps,
}: {
  readonly title: string;
  readonly steps: readonly { readonly title: string; readonly body: string }[];
}): React.JSX.Element {
  return (
    <section className="mt-16">
      <h2 className="text-center font-display text-[24px] font-semibold tracking-[-0.025em]">
        {title}
      </h2>
      <ol className="mx-auto mt-6 grid max-w-4xl gap-4 sm:grid-cols-3">
        {steps.map((s, i) => (
          <li key={s.title} className="card">
            <span className="flex size-7 items-center justify-center rounded-full bg-accent text-[12px] font-semibold text-white">
              {i + 1}
            </span>
            <h3 className="mt-3 text-[15px] font-semibold">{s.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">{s.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

/**
 * FAQ, as `<details>` rather than a JavaScript accordion.
 *
 * Native disclosure is keyboard-accessible, works before hydration, and is findable by the
 * browser's own in-page search when collapsed in current browsers — none of which a hand-rolled
 * accordion gives without work. There is no behaviour here worth owning.
 */
export function Faq({
  items,
}: {
  readonly items: readonly { readonly q: string; readonly a: string }[];
}): React.JSX.Element {
  return (
    <section className="mx-auto mt-16 max-w-2xl">
      <h2 className="text-center font-display text-[24px] font-semibold tracking-[-0.025em]">
        Questions people actually ask
      </h2>
      <div className="mt-6 divide-y divide-line overflow-hidden rounded-panel border border-line bg-surface">
        {items.map(({ q, a }) => (
          <details key={q} className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-[15px] font-medium hover:bg-accent/[0.03]">
              {q}
              <span
                aria-hidden="true"
                className="shrink-0 text-muted transition-transform group-open:rotate-45"
              >
                +
              </span>
            </summary>
            <p className="px-5 pb-4 text-sm leading-relaxed text-muted">{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

/** The closing block. Deliberately states what Veela does *not* do — on these pages that is the
 *  differentiator, not the fine print. */
export function ClosingNote({
  title,
  body,
  cta,
}: {
  readonly title: string;
  readonly body: string;
  readonly cta?: { readonly href: React.ComponentProps<typeof Link>["href"]; readonly label: string };
}): React.JSX.Element {
  return (
    <section className="mx-auto mt-16 max-w-2xl rounded-hero border border-line bg-accent/[0.05] p-8 text-center shadow-card">
      <h2 className="font-display text-[22px] font-semibold tracking-[-0.02em]">{title}</h2>
      <p className="mx-auto mt-3 max-w-prose text-sm leading-relaxed text-muted">{body}</p>
      {cta !== undefined && (
        <Link href={cta.href} className="btn-primary mt-5 inline-flex !px-6 !py-2.5 !text-[14px]">
          {cta.label}
        </Link>
      )}
    </section>
  );
}
