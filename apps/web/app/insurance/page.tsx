import type { Metadata } from "next";

import { DropletIcon, KeyIcon, ShieldIcon } from "../../components/service-icons";
import {
  BenefitCards,
  ClosingNote,
  FactBar,
  Faq,
  ServiceHero,
  Steps,
} from "../../components/service-page";

export const metadata: Metadata = {
  title: "Insurance — Veela",
  description:
    "What a Hong Kong mortgage obliges you to insure, what the management fee already covers, and how to check an intermediary is licensed.",
};

/**
 * Structured like the reference's Insurance page — hero, three cards, steps, FAQ — and filled
 * with the opposite kind of content.
 *
 * **Arranging or advising on insurance in Hong Kong is a licensed activity** regulated by the
 * Insurance Authority. A page that compared quotes, recommended an insurer or passed details to
 * a broker would be carrying on regulated business without a licence. That is a line rather
 * than a risk to manage, and this page stays the safe side of it.
 *
 * What is useful and unregulated: which cover a mortgage actually obliges you to hold, what the
 * management fee has already bought, and where the official register is. The most valuable item
 * here is probably the least glamorous — a leak into the flat below is the commonest Hong Kong
 * liability claim of this kind, and most first-time landlords have never considered it.
 */

const BENEFITS = [
  {
    title: "Fire cover, required",
    caption: "Lenders make it a condition of the loan and usually want to be named on the policy.",
    icon: ShieldIcon,
  },
  {
    title: "The leak downstairs",
    caption: "The commonest claim of its kind here. Owner liability does not stop at your floor.",
    icon: DropletIcon,
  },
  {
    title: "Not your cover",
    caption: "Mortgage insurance protects the bank while you pay the premium. Know the difference.",
    icon: KeyIcon,
  },
] as const;

const FAQ = [
  {
    q: "Does Veela sell or arrange insurance?",
    a: "No. Advising on or arranging insurance in Hong Kong requires a licence from the Insurance Authority, which Veela does not hold. We recommend no insurer, compare no quotes and receive nothing from anyone. If somebody offers you cover, check they are licensed on the Authority's own register before the conversation goes further.",
  },
  {
    q: "Do I need buildings insurance for a flat?",
    a: "Usually not separately. In a multi-storey building the structure is insured by the incorporated owners under the Building Management Ordinance and you are already paying for it inside the management fee. A village house or a whole building is a different matter — there, the structure is yours to insure.",
  },
  {
    q: "What does the mortgage actually require?",
    a: "Almost always fire insurance, and often with the lender named on the policy. It starts at completion, not when a tenant moves in — an empty flat between purchase and first letting still needs to be covered.",
  },
  {
    q: "Is the HKMC Mortgage Insurance Programme cover for me?",
    a: "No, and this catches people out. It lets a lender advance more than its normal loan-to-value cap. You pay the premium; the bank holds the protection. Treat it as a financing cost in your figures, not as a risk you have transferred.",
  },
  {
    q: "What should I put in the report?",
    a: "A real quote, in annual other costs. A few thousand Hong Kong dollars a year is the usual order of magnitude for a flat, but do not take that from us — on a 2% net yield, a cost you guessed at is a meaningful slice of the return.",
  },
] as const;

export default function InsurancePage(): React.JSX.Element {
  return (
    <div className="col py-12 sm:py-16">
      <ServiceHero
        eyebrow="Services · Insurance"
        icon={ShieldIcon}
        title="What you actually have to insure"
        subtitle="Less than most first-time landlords expect, and in a different place. Much of a Hong Kong flat's building cover is already bought through the management fee — what the mortgage adds, and what a landlord carries on top, is the part worth knowing."
      />

      <BenefitCards items={BENEFITS} />

      <FactBar
        facts={[
          "No insurer recommended, no commission taken",
          "Veela holds no Insurance Authority licence",
          "Links to the official register, not a panel",
        ]}
      />

      <Steps
        title="What sits where"
        steps={[
          {
            title: "The building — already covered",
            body: "The incorporated owners insure the structure under the Building Management Ordinance, funded by your management fee. Buying a flat rarely means buying structural cover; buying a village house does.",
          },
          {
            title: "The loan — fire insurance",
            body: "A condition of almost every Hong Kong mortgage, effective from completion. The lender will often require to be noted on the policy.",
          },
          {
            title: "You — contents and liability",
            body: "Contents are your choice. Liability matters more than most landlords assume: as owner you can be pursued for damage originating in the flat, and water into the unit below is the classic case.",
          },
        ]}
      />

      <Faq items={FAQ} />

      <section className="mx-auto mt-12 max-w-2xl text-center">
        <a
          href="https://iir.ia.org.hk/en/"
          target="_blank"
          rel="noreferrer"
          className="btn-secondary inline-flex !px-6 !py-2.5 !text-[14px]"
        >
          Check a licence on the Insurance Authority register
        </a>
      </section>

      <ClosingNote
        title="Then put the real number in"
        body="Insurance belongs in annual other costs, alongside management fees and repairs. Guessed costs are where a thin Hong Kong yield quietly becomes a negative one — so get a quote and enter that figure, not ours."
        cta={{ href: "/analyse", label: "Open the report" }}
      />
    </div>
  );
}
