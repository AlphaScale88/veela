import type { Metadata } from "next";

import { AppShell } from "../../../components/app-shell";

export const metadata: Metadata = {
  title: "Agent Finder — Veela",
  description:
    "Check an estate agent's licence on the EAA register, and know what to ask before you sign.",
};

/**
 * ## Why this checks agents rather than finding them
 *
 * The reference product's Agent Finder recommends agents. **Veela cannot**, and the reason is
 * not squeamishness: introducing parties to a property transaction is estate agency work under
 * the Estate Agents Ordinance (Cap. 511), and taking a referral fee for it without a licence is
 * an offence. This project's own notes already flagged referral fees and lead-selling as the two
 * routes that would engage Cap. 511, to be checked *before* building either.
 *
 * So this does the part that is both lawful and more useful: it points at the **EAA's own
 * register**, which is authoritative in a way any list we curated would not be, and sets out
 * what to verify. An investor's real risk is not failing to find an agent — there is no shortage
 * — it is not checking the one who found them.
 */
export default function AgentFinderPage(): React.JSX.Element {
  return (
    <AppShell breadcrumb="Services › Agent Finder">
      <header className="max-w-prose">
        <p className="eyebrow">Services · Agent Finder</p>
        <h1 className="mt-3 font-display text-[30px] font-extrabold leading-tight tracking-[-0.03em]">
          Check the agent, don&apos;t take ours
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">
          Agents will find you. The useful question is whether the one in front of you is
          licensed, what they are contractually obliged to tell you, and what you are agreeing to
          when you sign their form.
        </p>
      </header>

      <section className="card mt-8 max-w-prose">
        <h2 className="text-[15px] font-semibold">Verify the licence first</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Every individual agent and agency in Hong Kong must be licensed by the Estate Agents
          Authority, and the register is public and searchable. Check the person, not just the
          firm — an unlicensed salesperson at a licensed agency is still unlicensed.
        </p>
        <a
          href="https://www.eaa.org.hk/en-us/Information-Centre/Licensee-Search"
          target="_blank"
          rel="noreferrer"
          className="btn-primary mt-4 inline-flex !px-5 !py-2.5 !text-[13px]"
        >
          Search the EAA register
        </a>
      </section>

      <h2 className="mt-10 font-display text-[20px] font-semibold tracking-[-0.02em]">
        What to establish before you sign anything
      </h2>
      <div className="mt-4 grid gap-5 lg:grid-cols-2">
        <Card
          title="Who they act for"
          body="An agent can act for the vendor, for you, or for both with written consent. Dual agency is legal in Hong Kong and common, and it changes whose interest they are advancing when they tell you a price is fair. Ask, and check the answer against Form 3 or Form 4."
        />
        <Card
          title="The commission, in writing"
          body="Around 1% from each side is the Hong Kong norm, but it is negotiable and nothing fixes it. It should be written on the agreement before you sign, not agreed afterwards."
        />
        <Card
          title="The estate agency agreement"
          body="Form 3 (vendor) and Form 4 (purchaser) are prescribed by the EAA and set out the validity period, the commission and whether the appointment is exclusive. An exclusive appointment can oblige you to pay even if you find the property another way."
        />
        <Card
          title="The property information the law already owes you"
          body="Agents must give prescribed particulars — including saleable area, and any known material defects. If a figure is quoted as gross area only, ask for saleable: the two differ by roughly a quarter and every Veela calculation uses saleable."
        />
      </div>

      <section className="card mt-8 max-w-prose">
        <h2 className="text-[15px] font-semibold">Veela is not an estate agency</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          We do not introduce parties to a transaction, negotiate for anyone, or accept
          commission or referral fees from an agent. We are not licensed under Cap. 511 and do
          not carry on estate agency work. If an agent&apos;s numbers and ours disagree, run the
          figures yourself — that is what the report is for.
        </p>
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
