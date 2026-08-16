import type { Metadata } from "next";
import Link from "next/link";

import { AppShell } from "../../../components/app-shell";

export const metadata: Metadata = {
  title: "Insurance — Veela",
  description:
    "What a Hong Kong landlord actually has to insure, what it costs, and how to check a broker is licensed.",
};

/**
 * ## Why this page sells nothing
 *
 * Arranging or advising on insurance in Hong Kong is a **licensed activity** regulated by the
 * Insurance Authority. A page that recommended an insurer, compared quotes or passed details to
 * a broker would be carrying on regulated business without a licence. That is not a caution to
 * manage — it is a line, and this page stays the safe side of it.
 *
 * What is useful and unregulated: saying which cover a mortgage actually obliges you to hold,
 * what it typically costs so the figure can go into a report, and where the official register
 * of licensed intermediaries is so a reader can check anyone they are talking to.
 */
export default function InsurancePage(): React.JSX.Element {
  return (
    <AppShell breadcrumb="Services › Insurance">
      <header className="max-w-prose">
        <p className="eyebrow">Services · Insurance</p>
        <h1 className="mt-3 font-display text-[30px] font-extrabold leading-tight tracking-[-0.03em]">
          What you actually have to insure
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">
          Most of a Hong Kong flat&apos;s building cover is already bought for you, through the
          management fee. What the mortgage adds, and what a landlord carries on top, is smaller
          than people expect — and it belongs in the report as a real annual cost.
        </p>
      </header>

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <Card
          title="Buildings — usually already covered"
          body="A multi-storey building's structure is insured by the incorporated owners under the Building Management Ordinance, and you pay for it inside the management fee. Buying a flat rarely means buying separate structural cover; buying a village house or a whole building does."
        />
        <Card
          title="Fire insurance — the mortgage will require it"
          body="Lenders almost always make fire insurance a condition of the loan, and often want to be named on the policy. Budget for it from the day of completion, not the day the tenant moves in."
        />
        <Card
          title="Home contents and landlord liability"
          body="Contents cover is yours to choose. Liability cover matters more than most landlords assume: as owner you can be pursued for injury or damage originating in the flat, including a leak into the unit below — the single most common Hong Kong dispute of this kind."
        />
        <Card
          title="Mortgage insurance is not your cover"
          body="The HKMC Mortgage Insurance Programme lets a lender advance above its normal loan-to-value cap. The premium is yours to pay but the protection is the bank's, not yours. It is a financing cost, not a risk you have transferred."
        />
      </div>

      <section className="card mt-8 max-w-prose">
        <h2 className="text-[15px] font-semibold">Putting it in the report</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Insurance goes in the <strong className="text-mist">annual other costs</strong> field on{" "}
          <Link href="/analyse" className="text-accent hover:underline">
            the analysis form
          </Link>
          . A few thousand Hong Kong dollars a year is the usual order of magnitude for a flat,
          but do not take that from us — get a real quote and enter that. On a 2% net yield, a
          cost you guessed at is a meaningful share of the return.
        </p>
      </section>

      <section className="card mt-6 max-w-prose">
        <h2 className="text-[15px] font-semibold">We do not arrange insurance</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Advising on or arranging insurance in Hong Kong requires a licence from the Insurance
          Authority. Veela holds none, recommends no insurer, and receives nothing from any. If
          somebody offers you cover, you can check they are licensed on the Authority&apos;s own
          register — that is worth doing before a conversation, not after.
        </p>
        <a
          href="https://iir.ia.org.hk/en/"
          target="_blank"
          rel="noreferrer"
          className="btn-secondary mt-4 inline-flex !px-5 !py-2 !text-[13px]"
        >
          Insurance Authority register
        </a>
      </section>
    </AppShell>
  );
}

function Card({ title, body }: { readonly title: string; readonly body: string }): React.JSX.Element {
  return (
    <article className="card">
      <h2 className="text-[15px] font-semibold">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
    </article>
  );
}
