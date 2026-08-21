import type { Metadata } from "next";

import { BadgeCheckIcon, DocumentIcon, SearchGlassIcon } from "../../components/service-icons";
import {
  BenefitCards,
  ClosingNote,
  FactBar,
  Faq,
  ServiceHero,
  Steps,
} from "../../components/service-page";

export const metadata: Metadata = {
  title: "Agent Finder — Veela",
  description:
    "Check an estate agent's licence on the Estate Agents Authority register, and know what Form 3 and Form 4 commit you to before you sign.",
};

/**
 * ## The one page where the reference cannot be followed
 *
 * Mashvisor's Agent Finder is a matching funnel: *"Let's get you matched with the perfect
 * agent"*, partnered with BiggerPockets, promising vetted and pre-screened professionals.
 *
 * **Veela cannot run that, and it is not a matter of taste.** Introducing parties to a property
 * transaction is estate agency work under the Estate Agents Ordinance (Cap. 511); doing it for a
 * referral fee without a licence is an offence. This project's own notes already flagged
 * referral fees and lead-selling as the two routes that would engage Cap. 511, to be checked
 * before building either.
 *
 * So the page keeps the reference's *shape* and inverts its *promise*. Theirs finds you an
 * agent. This one helps you check the agent who has already found you — which is the greater
 * risk in Hong Kong anyway, where agents are abundant and verification is the scarce step.
 * "Vetted Agents / Perfect Match / Local Experts" becomes verification, obligations and
 * commission, because those are things a reader can act on without anyone vouching for anyone.
 */

const BENEFITS = [
  {
    title: "Licensed, verified",
    caption: "Check the individual on the EAA's own register — not the agency, the person.",
    icon: BadgeCheckIcon,
  },
  {
    title: "Know who they act for",
    caption: "Dual agency is legal here and common. It changes whose interest is being advanced.",
    icon: SearchGlassIcon,
  },
  {
    title: "Read Form 3 and 4",
    caption: "The prescribed agreement fixes commission, exclusivity and how long you are bound.",
    icon: DocumentIcon,
  },
] as const;

const FAQ = [
  {
    q: "Why don't you just recommend an agent?",
    a: "Because introducing parties to a property transaction is estate agency work under Cap. 511, and taking a fee for it without a licence is an offence. Veela holds no licence and accepts nothing from any agent. A list of names we had not verified would also be authority we have not earned — the same reason there is no vetted marketplace anywhere in this product.",
  },
  {
    q: "How do I check someone is licensed?",
    a: "The Estate Agents Authority publishes a public register of every licensed individual and agency. Search the person's name, not just the firm: an unlicensed salesperson working at a licensed agency is still unlicensed, and that is the common case rather than the exotic one.",
  },
  {
    q: "What commission is normal?",
    a: "Around 1% from each side is the Hong Kong convention, but nothing fixes it and it is negotiable. What matters more is that the figure is written on the agreement before you sign rather than agreed afterwards.",
  },
  {
    q: "What is dual agency and should I worry?",
    a: "An agent may act for both the vendor and the purchaser with written consent from both, which is legal and widespread here. It is not automatically a problem, but it does mean the person telling you a price is fair is also being paid by the person setting it. Ask, and check the answer against the prescribed form.",
  },
  {
    q: "The agent quoted a different area to Veela. Who is right?",
    a: "Probably both — they are likely quoting gross floor area and Veela uses saleable, which is typically 20–30% smaller. Since 2013 residential sales must quote saleable area, so ask for that figure. Comparing a saleable price per square foot against a gross one makes a flat look far better value than it is.",
  },
] as const;

export default function AgentFinderPage(): React.JSX.Element {
  return (
    <div className="col py-12 sm:py-16">
      <ServiceHero
        eyebrow="Services · Agent Finder"
        icon={BadgeCheckIcon}
        title="Check the agent. Don't take ours."
        subtitle="Agents will find you — Hong Kong has no shortage. The question worth answering is whether the one in front of you is licensed, who they actually act for, and what their form commits you to."
      >
        <a
          href="https://www.eaa.org.hk/en-us/Licence-list"
          target="_blank"
          rel="noreferrer"
          className="btn-primary inline-flex !px-6 !py-3 !text-[14px]"
        >
          Search the EAA register
        </a>
      </ServiceHero>

      <BenefitCards items={BENEFITS} />

      <FactBar
        facts={[
          "The official regulator's register, not our list",
          "No referral fees, from anyone",
          "Veela is not licensed under Cap. 511 and does not act as an agent",
        ]}
      />

      <Steps
        title="Before you sign anything"
        steps={[
          {
            title: "Verify the licence",
            body: "Look up the individual on the EAA register. Licences lapse and are suspended; the register is current and a business card is not.",
          },
          {
            title: "Establish who they act for",
            body: "Vendor, you, or both. It is on the prescribed form, and it determines how to read every price opinion they give you.",
          },
          {
            title: "Read the agreement, then sign",
            body: "Form 3 or Form 4 sets the commission, the validity period and whether the appointment is exclusive — which can oblige you to pay even if you find the property another way.",
          },
        ]}
      />

      <Faq items={FAQ} />

      <ClosingNote
        title="Then run their numbers yourself"
        body="An agent's job is to close a transaction; yours is to know whether it works. When they quote a yield, put the same figures through the full report — the stamp duty scale, the tax and the real cash to acquire are all computed from published rules you can check."
        cta={{ href: "/analyse", label: "Open the report" }}
      />
    </div>
  );
}
