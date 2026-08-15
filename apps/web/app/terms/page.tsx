import type { Metadata } from "next";
import Link from "next/link";

import { LEGAL_VERSIONS } from "@veela/types";

import { AppShell } from "../../components/app-shell";

export const metadata: Metadata = {
  title: "Terms of service — Veela",
  description: "The terms on which Veela is provided, including what it is and is not.",
};

/**
 * Terms of service.
 *
 * **Written because taking money without them is not an option**, and because two of the
 * clauses below are specific to what this product actually does rather than boilerplate: the
 * disclaimer of advice (section 3) and the estate-agency position (section 4).
 *
 * ## The operator is a placeholder, and that is a blocker
 *
 * `OPERATOR` and `CONTACT_EMAIL` below are unset. **Veela cannot lawfully take payment until a
 * legal entity is named here and on `/privacy`** — a contract needs a counterparty, and a
 * Hong Kong payment processor will ask for the same details. This is flagged in
 * `.claude/CLAUDE.md`'s open questions as the outstanding item on `/privacy`; it is the same
 * gap, and it now blocks revenue rather than just compliance tidiness.
 *
 * Everything else here is drafted and reviewable. **It has not been reviewed by a Hong Kong
 * solicitor**, and it should be before money changes hands — particularly section 4, where the
 * distinction between selling software and practising estate agency under Cap. 511 is doing
 * real work.
 */

/** TODO(founder): the invoicing entity, once decided. Blocks payments. */
const OPERATOR = "[operator entity to be confirmed]";
const CONTACT_EMAIL = "[contact address to be confirmed]";

/** The version shown here is **the one users accept**, read from `LEGAL_VERSIONS` rather than
 *  typed again. A page dated differently from the version recorded against a signature is the
 *  exact drift the consent record exists to make impossible — and it was already happening: a
 *  hardcoded "15 August 2026" sat beside a recorded version of 2026-08-16. */
const UPDATED = LEGAL_VERSIONS.terms;

export default function TermsPage(): React.JSX.Element {
  return (
    <AppShell breadcrumb="Terms">
      <article className="max-w-prose">
        <p className="eyebrow">Legal</p>
        <h1 className="mt-3 font-display text-[30px] font-extrabold leading-tight tracking-[-0.03em]">
          Terms of service
        </h1>
        <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.08em] text-muted">
          Version {UPDATED}
        </p>

        <div className="mt-6 rounded-panel border border-caution/40 bg-caution/10 px-4 py-3 text-sm leading-relaxed text-muted">
          <strong className="text-mist">Draft.</strong> The operator entity is not yet named and
          these terms have not been reviewed by a Hong Kong solicitor. Both must happen before
          Veela charges for anything.
        </div>

        <Section n="1" title="Who provides Veela">
          Veela is operated by {OPERATOR} (&ldquo;we&rdquo;). Contact: {CONTACT_EMAIL}. By using
          Veela you agree to these terms. If you do not, please do not use it.
        </Section>

        <Section n="2" title="What Veela does">
          Veela computes figures for Hong Kong residential property from public rules and the
          inputs you provide: ad valorem stamp duty, property tax, government rates, cash to
          acquire, and gross and net yield. It also shows public context — Rating and Valuation
          Department indices, Census figures, and amenity data from OpenStreetMap. Every figure
          is derived from what you enter and from published sources we name.
        </Section>

        <Section n="3" title="What Veela is not">
          <strong className="text-mist">Veela is not financial, investment, tax or legal
          advice</strong>, and it is not a substitute for a solicitor, a surveyor, an accountant
          or a licensed adviser. Nothing in a report is a recommendation to buy, sell or hold. We
          are not licensed by the Securities and Futures Commission and do not provide regulated
          advice.
          <br />
          <br />
          Figures depend entirely on the accuracy of what you enter. Where Veela estimates
          something — a rent derived from published market yields, for example — it says so on
          screen, and you should replace the estimate with a real figure before acting.
        </Section>

        <Section n="4" title="Veela is not an estate agency">
          We do not introduce parties to a transaction, negotiate on anyone&apos;s behalf, or
          accept commission on a property transaction. We are not licensed under the Estate
          Agents Ordinance (Cap. 511) and do not carry on estate agency work. Any listing
          information shown is either published metadata from a page you asked us to read, or is
          clearly labelled as sample data.
        </Section>

        <Section n="5" title="Accounts and acceptable use">
          You are responsible for activity under your account and for keeping any API key
          secret. Do not attempt to circumvent rate limits or quotas, resell access without
          agreement, scrape the service, or use it to build a competing dataset. We may suspend
          access that threatens the service or other users.
        </Section>

        <Section n="6" title="Paid products">
          Subscriptions are billed monthly in advance and may be cancelled at any time, taking
          effect at the end of the paid month — we do not lock you into a term. Included
          allowances, such as Land Registry searches and API calls, reset on the first of each
          month and do not roll over. The Land Registry&apos;s own fee for an included search is
          covered by the subscription.
          <br />
          <br />
          Cancelling stops future billing; we do not refund part-months by default, since the
          service was available for the period paid for. <strong className="text-mist">If Veela
          produced a figure that was wrong because of a defect on our side, tell us and we will
          refund it</strong> — that is not discretionary.
          <br />
          <br />
          Reports you saved remain yours to read and export after a subscription ends. We do not
          hold your own figures hostage to a renewal.
        </Section>

        <Section n="7" title="Third parties">
          Veela relies on services we do not control, including OpenStreetMap, Google Maps, the
          Rating and Valuation Department&apos;s published data, the Land Registry, and an AI
          provider for written summaries. Availability and accuracy of those sources are not
          guaranteed. Data shared with them is described in the{" "}
          <Link href="/privacy" className="underline decoration-line underline-offset-4 hover:text-mist">
            privacy statement
          </Link>
          .
        </Section>

        <Section n="8" title="Liability">
          To the extent permitted by Hong Kong law, our total liability arising from your use of
          Veela is limited to the amount you paid us in the twelve months before the claim. We
          are not liable for lost profit, lost opportunity, or decisions taken in reliance on a
          figure. Nothing here excludes liability that cannot lawfully be excluded.
        </Section>

        <Section n="9" title="Changes and governing law">
          We may change these terms; material changes will be dated here. These terms are
          governed by the laws of the Hong Kong Special Administrative Region, and the Hong Kong
          courts have exclusive jurisdiction.
        </Section>
      </article>
    </AppShell>
  );
}

function Section({
  n,
  title,
  children,
}: {
  readonly n: string;
  readonly title: string;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return (
    <section className="mt-8">
      <h2 className="font-display text-[18px] font-semibold tracking-[-0.02em]">
        <span className="mr-2 font-mono text-xs text-muted">{n}</span>
        {title}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">{children}</p>
    </section>
  );
}
