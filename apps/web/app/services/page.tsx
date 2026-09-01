import type { Metadata } from "next";
import Link from "next/link";

import { AppShell } from "../../components/app-shell";

export const metadata: Metadata = {
  title: "Services — Veela",
  description:
    "Mortgage stress test, insurance obligations, agent licence checks and an index-adjusted price estimate. No referrals, no commissions.",
};

/**
 * The Services hub.
 *
 * ## This section was previously declined, and the reason still shapes it
 *
 * `.claude/CLAUDE.md` recorded Services as deliberately *not built*: the reference product's
 * version is a vetted marketplace of lenders, insurers and contractors, and "Veela has vetted
 * no one — a page presenting unvetted names as trusted services would be inventing authority
 * the product doesn't have."
 *
 * Built now on request, and that objection is answered rather than ignored: **there is no
 * marketplace here.** Every page either computes something from published rules, or points at
 * the official register that is authoritative in a way a curated list never could be. Nobody is
 * recommended, and no money changes hands with any provider.
 *
 * That is also the only lawful shape. Introducing parties to a transaction engages Cap. 511;
 * advising on insurance requires an Insurance Authority licence; a valuation is a surveyor's
 * professional opinion. Each page stays on the computing side of its line and says so.
 */

interface Service {
  readonly href: "/mortgage" | "/insurance" | "/agent-finder" | "/home-valuation";
  readonly name: string;
  readonly summary: string;
  readonly kind: "Calculator" | "Guide" | "Official register";
}

const SERVICES: readonly Service[] = [
  {
    href: "/mortgage",
    name: "Mortgage",
    summary:
      "What you can borrow, the monthly payment, and whether it survives a bank's stress test at +2 points. Every policy assumption is on screen and editable.",
    kind: "Calculator",
  },
  {
    href: "/home-valuation",
    name: "Home valuation",
    summary:
      "Apply the RVD's published price index to what you actually paid. Shows its working, and says plainly why it is not a valuation.",
    kind: "Calculator",
  },
  {
    href: "/insurance",
    name: "Insurance",
    summary:
      "What a mortgage obliges you to hold, what the management fee already covers, and where to check an intermediary is licensed.",
    kind: "Guide",
  },
  {
    href: "/agent-finder",
    name: "Agent finder",
    summary:
      "Check a licence on the EAA's own register, and know what Form 3 and Form 4 commit you to before you sign.",
    kind: "Official register",
  },
];

export default function ServicesPage(): React.JSX.Element {
  return (
    <AppShell breadcrumb="Services">
      <header className="max-w-prose">
        <p className="eyebrow">Services · Hong Kong</p>
        <h1 className="mt-3 font-display text-[34px] font-extrabold leading-tight tracking-[-0.03em]">
          Costs &amp; rules
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">
          Financing, insurance, agents and what the place is worth. Tools where something can
          honestly be computed, and the official register where it can&apos;t.
        </p>
      </header>

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        {SERVICES.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="card-hover card flex h-full flex-col no-underline"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-[17px] font-semibold">{s.name}</h2>
              <span className="rounded-full border border-line px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted">
                {s.kind}
              </span>
            </div>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{s.summary}</p>
            <span className="mt-4 text-sm font-medium text-accent">Open →</span>
          </Link>
        ))}
      </div>

      {/* The distinction that defines the whole section, stated once and prominently rather
          than left implicit in four separate pages. */}
      <section className="card mt-10 max-w-prose">
        <h2 className="text-[15px] font-semibold">No referrals, no commissions, nobody vetted</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Comparable products run this section as a marketplace: recommended lenders, insurers
          and agents, paid for by referral. Veela does not, and it is not squeamishness — it is
          that we have vetted nobody, and a name presented as trusted would be authority this
          product has not earned. It is also the lawful line: introducing parties to a
          transaction is estate agency work under Cap. 511, and advising on insurance needs a
          licence from the Insurance Authority. We hold neither and take nothing from anyone.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          What you get instead is the arithmetic, with its assumptions visible, and a link to the
          register that can actually answer the question.
        </p>
      </section>
    </AppShell>
  );
}
