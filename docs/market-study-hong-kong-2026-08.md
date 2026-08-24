# Veela — Hong Kong market study

**Date:** 18 August 2026
**Scope:** the Hong Kong residential market, the investor segment Veela targets, the data that can lawfully be obtained, the competition, and what can realistically be charged.

## How to read this

Every figure below is in one of three categories, and they are never mixed:

- **Verified** — published by a named body for a named period, with a source.
- **Derived** — arithmetic on verified figures. The arithmetic is shown.
- **Unknown** — we do not have it. Listed explicitly in §10 rather than estimated.

Figures marked *(own ingest)* come from data Veela has already parsed from the primary source and holds in the product, so they can be re-checked against the code.

---

## 1. Headline: the market is recovering fast, and that changes the pitch

| Measure | Latest | Period | Source |
|---|---|---|---|
| RVD private domestic **price index** | **323.2** | Jun 2026 | RVD Property Market Statistics *(own ingest)* |
| Price index **peak** | 398.1 | Sep 2021 | same |
| Price vs peak | **−18.8%** | Jun 2026 | *derived:* (323.2 − 398.1) / 398.1 |
| Price, 12-month change | **+12.7%** | Jun 2025 → Jun 2026 | *derived:* from 286.7 |
| RVD private domestic **rental index** | **205.8** | Jun 2026 | RVD *(own ingest)* |
| Rental index — highest in the series | **yes**, series starts 1993 | Jun 2026 | *derived* |
| Rent, 12-month change | **+5.1%** | Jun 2025 → Jun 2026 | *derived* |

**This is the single most important finding in this study, and it cuts both ways.**

Prices are up 12.7% in a year while rents are up 5.1%. Prices are rising roughly two and a half times faster than rents, which means **yields are compressing again**:

| RVD market yield by Class | Sep 2021 (price peak) | Jun 2025 | Jun 2026 |
|---|---|---|---|
| A — under 40 m² | 2.4% | **3.7%** | 3.4% |
| B — 40–69.9 m² | 2.2% | 3.2% | 3.0% |
| C — 70–99.9 m² | 2.1% | 2.8% | 2.7% |
| D — 100–159.9 m² | 1.9% | 2.6% | 2.6% |
| E — 160 m² and over | 2.0% | 2.4% | 2.3% |

*(RVD published market yields, own ingest. Every month of the last 24 is published for all five Classes, so this is a complete series, not a sampled one.)*

Read the middle column: **the yield opportunity peaked around mid-2025 and is closing.** Class A went 2.4% → 3.7% → 3.4%. The window in which "does this actually yield anything?" is a live, painful question for a Hong Kong buyer is open now and narrowing.

**What it means commercially.** A recovering market produces more transactions, therefore more moments at which Veela is useful. It also means the honest answer Veela gives is drifting back towards "this barely beats cash" — which is the monetisation problem in §8.

---

## 2. Market size

| Measure | Figure | Period | Source |
|---|---|---|---|
| Private domestic **stock** | **1,291,956 units** | 2024 | RVD, *Private Domestic Stock, Completions and Vacancy by District* via data.gov.hk *(own ingest, 18 districts summed)* |
| Completions | 24,261 units | 2024 | same *(own ingest)* |
| Completions | 18,450 units (−24% on 2024) | 2025 | RVD *Hong Kong Property Review 2026*, preliminary findings |
| Forecast completions | 16,980 (2026), 15,360 (2027) | forecast | same |
| Vacancy | **56,080 units, 4.3%** of stock | end-2025 | same |
| Households | 2,673,714 | 2021 Census | C&SD, 2021 Population Census *(own ingest)* |
| Population | 7,411,945 | 2021 Census | same *(own ingest)* |

### Transaction flow — the number that matters most

| Year | Transactions | Total value | Average |
|---|---|---|---|
| 2023 | 43,002 | HK$389.3bn | HK$9.05M |
| 2024 | 53,099 | HK$454.4bn | HK$8.56M |
| 2025 | **62,832** | **HK$519.8bn** | HK$8.27M |
| 2026 H1 | 40,810 | HK$366.9bn | HK$8.99M |

*(RVD primary + secondary sale counts and values, own ingest, monthly to Jun 2026.)*

**Derived:** H1-2026 at 40,810 annualises to **≈81,600 transactions** — about 30% above 2025 and nearly double 2023. That is an annualisation of six months, not a forecast; the second half of a Hong Kong year is not reliably like the first.

### Who owns and who lets

| Measure | Figure | Period | Source |
|---|---|---|---|
| Properties on the IRD's register, all types | 2,730,420 | 31 Mar 2025 | IRD Annual Report 2024-25, Schedule 7 |
| Solely owned by individuals (rent, if any, reported in individual returns) | 1,279,976 (46.9%) | same | same |
| **Explicitly classified as *letting*** (jointly owned / corporate, property-tax returns) | **116,042** | same | same |
| Owned by corporations, property-tax exempt | 451,399 (16.5%) | same | same |
| Property tax assessments raised | 731k → 759k → 762k → **781k** | 2021-22 → 2024-25 | IRD Annual Report, assessing figures |
| Households **owning** their home | **48.6%**, down from 52.1% in 2011 | 2021 Census | C&SD, *Housing Characteristics of the HK Population* |
| Households as **sole tenants** | **47.5%**, up from 43.9% in 2011 | same | same |
| Median monthly rent, private flats | **HK$12,000** (+60% in ten years) | 2021 Census | same |
| Median rent-to-income, private tenants | **31.4%**, up from 25.7% | same | same |

**Two things here matter more than the headline stock number.**

First, **the IRD does not publish a landlord count.** 116,042 is the only figure explicitly
labelled *letting*, and it covers only jointly-owned and corporate-held property — sole owners
report rent inside their individual return, so the 1.28M solely-owned bucket is not split between
let and owner-occupied. **116,042 is a hard floor, not an estimate.** Property tax assessments
(781k in 2024-25) are a broader activity proxy but count assessments, not landlords.

Second, **ownership is falling and tenancy is rising** — 52.1% → 48.6% owner-occupied over a
decade, with sole tenants going the other way. Rents up 60% in ten years against incomes that did
not keep pace (rent-to-income 25.7% → 31.4%). That is the demand side of a rental market getting
tighter, which is what makes a yield product relevant at all.

**Supply is falling while demand rises.** Completions drop from 24,261 (2024) to a forecast 15,360 (2027) — a 37% fall — against transaction volume up 46% from 2023 to 2025. That is the mechanism behind the price recovery, and it is unlikely to reverse quickly.

---

## 3. The regulatory frame — three hard constraints and one correction

### 3.1 Short-term letting is criminal, and the penalty is higher than we had recorded

Under the **Hotel and Guesthouse Accommodation Ordinance (Cap. 349)**, premises let for **under 28 consecutive days** require a licence. Operating unlicensed carries a maximum **fine of HK$500,000 and 3 years' imprisonment**.

**This study found a factual error in Veela's own landing page**, which stated HK$200,000 and two years. Those are the *superseded* figures: the Office of the Licensing Authority's FAQ states the fine rose from $200,000 to $500,000 and imprisonment from 2 years to 3 under the new regime. **Corrected on 18 August 2026 as part of this study.** Understating a criminal penalty is the same class of error as overstating a yield.

*Consequence for the product, unchanged:* the entire Airbnb/short-let half of the Mashvisor feature set has no lawful market here. Veela is a long-term yield product by law, not by choice.

### 3.2 Introducing parties to a transaction needs a licence (Cap. 511)

Under the **Estate Agents Ordinance (Cap. 511)**, estate agency work requires an EAA licence. The only relevant exemption is for a person dealing **exclusively** with property outside Hong Kong, who must say so in all documents and advertisements.

*Consequence:* two otherwise obvious revenue lines — referral fees from agents, and selling qualified buyer leads — engage this directly and must be checked with a solicitor **before** being built, not after. Veela's current Services pages are deliberately built to *check* an agent (against the EAA register) rather than to *find* one, which stays on the right side of this. That was the correct call and should not be quietly reversed for revenue.

### 3.3 Stamp duty: simplified in 2024, then raised at the top in 2026

- **28 February 2024:** BSD, SSD and NRSD abolished for all residential transactions. A non-permanent resident now pays the same duty as a local buyer, and companies can buy without punitive additional duty.
- **26 February 2026:** the top AVD rate above HK$100M rose from **4.25% to 6.5%** (Stamp Duty (Amendment) Ordinance 2026, gazetted 29 May 2026).

**Veela's engine is correct and current on this** — the AVD Scale 2 table carries the 6.5% top band and its marginal-relief step, effective 2026-02-26, and 36 tests pin the band boundaries. That is a genuine competitive asset and §6 returns to it.

**But it is also a gap.** There have been at least three distinct duty regimes since 2023 (pre-Feb-2024, Feb-2024 → Feb-2026, and Feb-2026 →). Veela holds **one** rule set. A user analysing a 2023 or 2025 purchase cannot be served at all today. Given the Alerts feature exists specifically to catch "the rules moved", this is the highest-value small fix in the product.

> **Closed on 22 August 2026** (recommendation 11.3). Five dated rule sets now cover 22/02/2023 onwards. Building them found that the count was **five regimes, not three** — the Scale 2 value bands moved twice on their own (the fixed HK$100 band went from HK$3M to HK$4M on 26/02/2025) and the 2023 Policy Address halved BSD and NRSD on 25/10/2023 before the February 2024 abolition. It also found a live error in the current rule set, described in §3.3a.

### 3.3a The correction this study did not catch: the flat 15% outlived its abolition

The paragraph above says Veela's engine "is correct and current". On the AVD Scale 2 table it was. On the *other* scale it was not.

Veela charged a buyer who already owned residential property, or bought through a company, a **flat 15%** — AVD Part 1 of Scale 1, the rate that applied until 25/10/2023. That rate was halved to 7.5% in October 2023 and then aligned to the Scale 2 rates on 28/02/2024. The IRD's own rate table has published a single column headed "Rates at Scale 2 or Part 1 of Scale 1" ever since.

The effect on an HK$8M flat bought by a second-property buyer today: Veela reported **HK$1,200,000** of stamp duty against an actual **HK$240,000**. A fivefold overstatement of the single largest acquisition cost, on the product's core number, in the direction that talks a buyer out of a sound deal. It was accompanied by a `critical` finding telling the user the concession they had missed was "often the single largest avoidable cost in the transaction" — advice about a concession that no longer exists to miss.

Corrected on 22 August 2026. Three tests now pin it: all three buyer profiles pay the same duty on a current date, the two scales are asserted to be the same table, and the flat 15% assertions were moved onto a 2023-dated transaction where they are the law.

### 3.4 Mortgage rules — our defaults were stale

HKMA position from its countercyclical macroprudential measures, against what Veela shipped:

| Rule | Current | Veela's default until 24/08/2026 | Verdict |
|---|---|---|---|
| LTV cap, residential | **70% flat**, regardless of value or self-occupation (from 16 Oct 2024) | 70% up to HK$30M, 60% above | **was stale** |
| Debt-servicing ratio | **50%** | 50% | correct |
| Stress test (+2pp) | **suspended** since 28 Feb 2024 | applied, and capping the loan | **was stale** |

Veela flagged these `unverified: true` and showed a "confirm with a bank" caveat keyed off that flag, so the product was honest about not knowing. Both stale rules erred in the same direction — telling a buyer they could borrow **less** than the regulator allows:

- **The banded cap cost a luxury buyer four million dollars of headroom.** On a HK$40M flat Veela capped the loan at HK$24M against an actual HK$28M, i.e. it demanded HK$4M more deposit than the rules require.
- **The withdrawn stress test kept capping the income-based limit.** At a HK$80k monthly income the ceiling was HK$7.45M against HK$7.58M — smaller in proportion, because at 4% the stressed 60% DSR sits close to the contractual 50% one, but wrong for a reason no longer in force.

> **Closed on 24 August 2026** (recommendation 11.4). Both corrected, `unverified` cleared, and three tests now pin the shape against the cited source: that the LTV cap has no value band, that the stress test is *recorded as suspended* rather than deleted, and that suspending it raises what the income allows.
>
> Two things this fix found that the table above did not say. **The page was framed around the wrong question** — its headline asked "Would the stress test let this through?", a test suspended two and a half years earlier, and it computed the borrowing limit from it. The framing was the bug; the numbers were downstream of it. And **the caveat was keyed off `unverified`**, so clearing that flag — the very thing this recommendation asked for — would have silently deleted the whole disclaimer from the page, including the half about a bank lending inside a ceiling at its own discretion, which no amount of sourcing makes untrue. That half is now unconditional.

*On sourcing:* the HKMA's own pages still do not render to an automated fetch, so the defaults cite the **Government Information Services releases** carrying the same announcements — `info.gov.hk` 16/10/2024 for the LTV and DSR, 28/02/2024 for the stress-test suspension. Those are the Government's own press channel and quote the measures verbatim, but they are not the HKMA's circular to authorised institutions, which is a letter and is not published. Worth noting rather than glossing: the figures are quoted, not paraphrased, but the primary instrument itself remains unread.

---

## 4. The data landscape — the binding constraint on the whole business

This has not changed and is the reason the product is shaped as it is.

| Source | What it gives | Grain | Cost |
|---|---|---|---|
| RVD Property Market Statistics | Price **and rent** indices, market yields by Class, stock, completions, vacancy | Aggregated; territory-wide monthly, district-level for stock/vacancy | **Free** |
| C&SD Census | Population, households by district | District | **Free** |
| Land Registry search | Actual transaction records per property | Transaction-level | **HK$10 per memorial, no bulk option** |
| Land Registry MMIM | Monthly memorial file | Transaction-level but **mortgages only, not sales** | HK$1,070 setup + **HK$5,500/month** |
| Land Registry S&P statistics | Counts and values of agreements | Aggregated | Free |
| Centaline / Midland transaction databases | The de-facto per-estate transaction history | Transaction-level | Free to browse, **no API** |

**There is no bulk sale-and-purchase dataset.** This is the structural fact that decides Veela's architecture: sale prices are reachable one property at a time at HK$10, so a listings-style aggregator cannot be built here on public data. Hence the user-fed model.

### 4.1 Centaline open data — the licence is explicit, and it excludes the data we want

**Correction.** The first version of this study, circulated earlier today, concluded that
Centaline's terms were *silent* on commercial use and that the position therefore had to be
established by asking. That was wrong, and understated what is knowable. There **is** a formal
licence; it is just not on the page that advertises the data.

The **Intellectual Property Rights Notice** at `census.centamap.com/en-US/CopyRight/IPRN`
expressly grants permission to *"download, print, adapt, distribute, reproduce and/or hyperlink
to the Specified Statistical Information and/or the Specified Boundaries free of charge for
commercial and/or non-commercial purposes"* — subject to attribution in the visitor's copies
**and in any subsequent copies made by recipients**, acknowledgement of the IPR owners, and clear
marking of any modifications.

**But the grant is scoped, and the scope is the whole story:**

| Layer | Covered by the grant? | Commercial use |
|---|---|---|
| C&SD census / by-census statistics (2001, 2006, 2011, 2016, 2021) — *"Specified Statistical Information"* | **Yes** | **Permitted, free, with attribution** |
| Boundary layers — Building Groups, Housing Market Areas, Large Subunit / Street Block Groups — *"Specified Boundaries"* | **Yes** | **Permitted, free, with attribution** |
| **Stock: 1.19M private residential units** by age and area, with turnover rates | **No** | Written consent required |
| **Transactions: ~1.4M records from 1995, with saleable area** | **No** | Written consent required |
| Digital maps / mapping information | No | Separately Crown copyright (Lands Department) |

Paragraph 5 of the Notice closes it explicitly: the permissions *"do not extend to the digital
maps, the mapping information or any other contents … that are not the Specified Statistical
Information or the Specified Boundaries."* Everything outside the grant falls under the baseline
Centamap copyright notice, which prohibits reproduction, distribution, publication or editing in
whole or in part without **written consent**. Paragraph 4 routes any other use to
`webmaster@censtatd.gov.hk` (C&SD) and `info@centamail.com` (Centamap).

Required attribution for the statistical layer, in Centaline's own wording:
*"資料來源：政府統計處及中原地圖"* — "Data source: Census and Statistics Department and Centaline Map".

**There is no public API.** The download portal is a JavaScript application that renders nothing
to an automated fetch, and its endpoints return 404 without session parameters.

**So the practical position is better than "unknown" in one direction and worse in the other:**

1. **Usable today, commercially, for free, with attribution:** the census statistics and the
   Housing Market Area / Building Group boundaries. That second item is not trivial — Veela
   currently has **no** real boundaries at all, which is why `/map` is proportional symbols
   rather than a choropleth. This licence appears to permit exactly the layer that would fix it.
2. **Not usable without a negotiated licence:** the 1.19M stock file and the 1.4M transaction
   file — which are the two datasets that would turn the finder from a demo into a product.

**Recommendation, revised:** treat the transaction and stock data as a **business-development
conversation with an unknown price**, not as open data — email `info@centamail.com`. And
separately, act on the boundaries now: they are licensed, free, and would materially improve the
map.

*One caveat, stated because it changes what to rely on:* that the restrictive notice governs the
stock and transaction files is an inference from the IPR Notice's explicit scope limit, not a
sentence anywhere saying so about those files by name. It is the safe reading, and it should still
be confirmed in the same email.

## 5. Competition — the white space is real, and so is the reason for it

**Every Hong Kong property analytics tool found is free to consumers and funded by agency
commission.** Nobody publishes a retail investor-analytics subscription price, because the
portals give analytics away as customer acquisition for a brokerage.

| Player | What it does | Targets investors? | Charges consumers? |
|---|---|---|---|
| Centadata (Centaline) | Land Registry + Centaline transaction records, price trends, floor plans | Indirectly; no investment tooling | **Free** — monetised via commission |
| Centaline open data | Bulk stock / transaction / census downloads | Analysts and researchers | Census layer free; **no price published** for the rest |
| Midland Realty | Transaction history, market insight, instant valuation, mortgage and affordability calculators, AI property recommendation | Lists investors among its users | **Free** — monetised via commission |
| **Spacious Data** | Sells proprietary portal-behaviour data as market insight; co-publishes the RICS–Spacious HK Residential Market Survey, redistributed to financial-industry clients | **Yes — the closest real comparable**, but sells to institutions, not consumers | No subscription price published |
| 28Hse / Squarefoot / House730 | Listing portals | No | Free to consumers; agent packages by enquiry only |

**No Hong Kong proptech startup offering investor yield or returns analytics was found.** A sweep
of the HK PropTech Association and proptech.hk surfaced smart-building, VR-tour and brokerage
tooling and nothing investor-facing. That is a genuine white-space signal — but it is
absence-of-evidence from a non-exhaustive search, not proof the space is empty.

**Spacious is the only Hong Kong company found monetising property data as a product**, and it
does so by selling to institutions rather than to the investors themselves. That is worth noting
as a possible route as well as a competitor.

## 6. What Veela actually owns

Worth stating plainly, because it decides the strategy in §8.

1. **A correct, dated, tested Hong Kong tax engine.** AVD Scale 2 transcribed from the IRD including the February 2026 6.5% band; Scale 1 Part 1; property tax at 15% on 80% of rent; no capital gains tax modelled as a *named Hong Kong rule* rather than a silent assumption; 36 tests pinning every marginal-relief boundary. **This is the asset a competitor cannot scrape**, and it is verifiably current as of this study.
2. **The RVD series, parsed and usable** — price and rent indices monthly back to 1993, market yields by Class back to 1999, stock/vacancy/completions by district.
3. **A rent estimator grounded in published yields** rather than invented comparables — price × RVD Class yield ÷ 12, which is the only defensible way to estimate a rent in a market that publishes no rental comparables.
4. **Correct regulatory posture** on Cap. 349 and Cap. 511, which is worth more than it sounds: a US-built competitor entering this market would ship an Airbnb calculator and be advertising a criminal offence.

---

## 7. Willingness to pay — no evidence of our own, but the benchmarks are published

Veela's published pricing: **Free**, **Investor HK$188/month**, **Pro HK$5,000/month** (10,000 API
calls). No payment processor is configured, so nothing has ever been charged. **We have no
willingness-to-pay evidence at all** — not one customer, not one priced conversation.

What can be checked is whether the two prices are defensible against comparable tools that *do*
publish. They are:

| Product | Entry /mo | Top self-serve /mo | API / enterprise |
|---|---|---|---|
| PropertyData (UK) | £14 | £60 | **published ladder £28 → £1,300** |
| Landlord Studio | $12 | $28 | — |
| Lendlord (UK) | £12 | £36 | — |
| Stessa | $15 | $35 | — |
| HouseCanary | $19 | $199 | $0.05–$6.00 per call, published |
| **Mashvisor** | **$49.99** | $99.99 | listed, no price |
| RentCast | $74 | $449 | enterprise, custom |
| PropStream | $99 | $699 | custom |
| DealMachine | $99/seat | $599 | not published |

**HK$188/month is about US$24**, which sits squarely in the *landlord-tool* cluster — Lendlord,
Stessa, Landlord Studio, HouseCanary Basic, PropertyData Basic. The tier above, for tools that do
deal analysis rather than bookkeeping, starts at Mashvisor's **$49.99** and PropStream's **$99**.
Veela does investment analysis, not bookkeeping. **On published comparables it looks under-priced,
plausibly by about half.**

**HK$5,000/month is about US$640**, and lands inside a published band rather than above the
market: PropertyData's API brackets it at £384 and £780, DealMachine Scale at $599, PropStream
Elite at $699. Above roughly $800/month the industry stops publishing and switches to
contact-sales, so HK$5,000 is at the **top of the transparent market**, which is a reasonable
place for a specialist rules engine to sit.

*This is a benchmark, not demand.* It says the prices are not absurd. It says nothing about
whether a Hong Kong investor will pay them.

## 8. Revenue: two models, and the arithmetic is not close

### Consumer subscription - now with a real denominator

The earlier version of this study guessed at conversion from total transactions. There is a better
figure. **UBS put investors at roughly 20% of total transactions in 2025** (property analyst Mark
Leung, reported in the South China Morning Post). Applied to a verified transaction count:

62,832 x 20% = **~12,570 investor purchases in 2025** *(derived; the 20% rests on a single press
citation of an analyst, not a primary research note - treat it as indicative)*

That is the buyer-side audience: **~12,600 a year**, not 63,000. It is a fifth of the market but a
far better-qualified fifth, and it is the population for whom "does this actually yield anything"
is the whole question.

The holder-side audience is bounded below by the IRD's **116,042** explicitly-let properties, and
plausibly far larger given that the 1.28M solely-owned bucket is not split.

**Scenarios, assumptions stated:**

| Basis | Assumption | Annual revenue |
|---|---|---|
| Buyers | 12,570 investor purchases, 5% convert, HK$188, 6 months | **HK$709k** |
| Buyers | 12,570, 10% convert, HK$188, 6 months | **HK$1.42M** |
| Holders | 116,042 let properties, 1% convert, HK$188, 12 months | **HK$2.62M** |
| Holders | 116,042, 3% convert, HK$188, 12 months | **HK$7.85M** |

The conversion rates are illustrative and unvalidated. What the table shows is structural: **the
holder audience is worth more than the buyer audience even at a third of the conversion rate**,
because it renews. That is the case for Alerts, and the case for pricing the consumer tier as a
subscription rather than a per-report charge.

It also says the consumer tier is a **single-digit-millions HKD** business at best on these
assumptions - the same conclusion as the earlier review, now with a denominator behind it.

**And a live counter-argument.** UBS's same commentary puts the average gross yield for mass
residential at **3.7%**, with specific estates above 4.5%. Our own RVD Class A figure is 3.4% gross
for the smallest flats. Gross is not net: after the 12% effective property tax, management fees,
rates and vacancy, those become the 2-3% net that makes Veela's honest answer "this barely beats
cash". **The gap between the 3.7% an agent quotes and the ~2.5% net a buyer actually gets is
precisely the product's reason to exist** - and is a much sharper pitch than "compute your yield".

### The tax engine as an API

`HK$5,000/month × 20 relationships = HK$1.2M per year` — comparable revenue from **20 relationships instead of ~1,300 customers**. Brokers, agencies and private-bank desks all need stamp duty computed correctly and versioned by transaction date, and February 2026's rate change is a live demonstration of why: every integration that hard-coded 4.25% has been wrong since 26 February and will be wrong again at the next Budget.

**This remains the stronger line**, for three reasons: it sells the one asset that cannot be scraped; it does not depend on yields being attractive; and 20 conversations is a tractable sales problem for a founder living in the market.

---

## 9. Risks

1. **Yield compression removes the product's own premise.** Class A yields went 3.7% → 3.4% in twelve months. If prices keep outrunning rents, "is this worth it?" becomes a question with an obvious answer and less need for a tool.
2. **No invoicing entity.** `/terms` and `/privacy` name no operator. Veela cannot lawfully take money until one exists and is named in both, and a Hong Kong payment processor will ask for the same details. **This blocks all revenue and only the founder can clear it.**
3. **Cap. 511 on the monetisation routes** that look most obvious (referrals, leads).
4. **Centaline data may be refused**, in which case the finder stays a demo indefinitely and the "reliable data" claim rests on RVD aggregates only.
5. **Rule changes are frequent** — three duty regimes since 2023 — so the versioned engine is both the moat and a maintenance obligation. It has to be kept current by someone.
6. **PDPO and the AI provider.** Free-tier AI providers generally reserve the right to train on inputs, and Veela's requests carry a real person's price, rent and building location. `/privacy` must name the transferee classes before this is pointed at real users' data.

---

## 10. What this study could not establish

Resolved since the first version: the Centaline licence (§4.1), pricing benchmarks (§7), the
competitive picture (§5), tenure and the letting floor (§2), and investor share of transactions
(§8). What is still open:

- **The number of private units actually rented out.** The IRD does not publish a landlord count
  and the 1.28M solely-owned bucket is not split let/owner-occupied. 116,042 is a floor. Deriving
  a figure from the 47.5% tenant share would be an unsourced calculation, so it has not been done.
- **Number of multiple-property owners.** IRD Schedule 7 counts owners *per property*, not
  properties per owner. No published statistic found.
- **Whether Centaline's stock and transaction files carry a fee, and at what level.** Nothing
  published; and that the restrictive notice governs them is a scope inference, not an explicit
  statement about those files by name (§4.1).
- **Spacious's actual data-product pricing**, and whether Spacious is still trading. Its site is
  behind a bot challenge; a figure seen in a search snippet was not confirmed against the page and
  is therefore not quoted here.
- **The UBS 20% investor share** rests on one press citation of an analyst, not a primary research
  note. It carries the §8 arithmetic and deserves a better source.
- **HKMA's rules from the primary circular.** Improved but not closed: §3.4 now quotes the
  Government Information Services releases of 16/10/2024 and 28/02/2024 verbatim rather than
  secondary commentary, but hkma.gov.hk still would not render, and the circular to authorised
  institutions is a letter that is not published at all.
- **Owner-occupied vs rented split of RVD's 1.29M private units** - likely in the Hong Kong
  Property Review, whose PDFs did not render. Worth reading by hand.
- **Agent-side package pricing** for the portals (28Hse, Squarefoot, House730, Midland) - all
  enquiry-only, which is itself informative about how this market sells.

## 11. Recommendation

In order, highest expected value first:

1. **Two separate Centaline actions, not one.** (a) Use the **census statistics and the Housing
   Market Area / Building Group boundaries now** - they are expressly licensed for commercial use,
   free, with attribution, and Veela currently has no real boundaries at all. (b) Email
   `info@centamail.com` about the **stock and transaction files**, which sit outside that grant and
   need a negotiated licence. Zero cost either way, and (a) needs nobody's permission.
2. **Name an invoicing entity** in `/terms` and `/privacy`. Nothing can be charged until this exists; it gates every revenue scenario in §8.
3. ~~**Add the missing dated rule sets** (pre-Feb-2024 and Feb-2024 → Feb-2026).~~ **Done 22/08/2026** — five sets, not two, covering 22/02/2023 onwards; and it surfaced the flat-15% error in §3.3a.
4. ~~**Correct the mortgage defaults** against the HKMA's own circular — 70% flat, no stress test — and only then consider clearing the `unverified` flag.~~ **Done 24/08/2026** — and it found that the page's headline question, not just its numbers, was about a test suspended in February 2024. See §3.4.
5. **Sell the API to five brokers before building more consumer features.** February 2026's rate
   change is the pitch: every hard-coded stamp duty table in this city is currently wrong.
6. **Reconsider HK$188.** On published comparables (§7) it prices Veela as a bookkeeping tool when
   it does deal analysis; the tier above starts near US$50. Raising it is not urgent, but it should
   be a decision rather than an inheritance.
7. **Lead with the gross-versus-net gap** in how the product is described. An agent quotes 3.7%
   gross; the buyer gets roughly 2.5% net after the 12% effective property tax, fees, rates and
   vacancy. Veela closes that gap, and that is a sharper sentence than "compute your yield".
8. **Do not build referrals or lead sales** without a solicitor's view on Cap. 511.

The strategic judgement has not changed since the earlier review: **the consumer product is the demonstration, and the tax engine is the business.** What has changed is that the market is recovering strongly, which widens the demonstration's audience while narrowing the yield story it tells — and that the top AVD band moved in February, which is the clearest possible argument for selling a versioned rules engine to people who currently maintain their own.

---

### Sources

- Rating and Valuation Department, *Property Market Statistics* (price and rental indices, market yields by Class, transaction counts and values) — <https://www.rvd.gov.hk/en/publications/property_market_statistics.html>
- Rating and Valuation Department, *Private Domestic Stock, Completions and Vacancy by District*, via data.gov.hk
- Rating and Valuation Department, *Hong Kong Property Review 2026* preliminary findings — <https://www.rvd.gov.hk/doc/en/HKPR2026_Preliminary_Findings_Eng.pdf>
- Census and Statistics Department, *2021 Population Census*, District Council district statistics
- Inland Revenue Department, ad valorem stamp duty — <https://www.ird.gov.hk/eng/faq/avd.htm>
- Stamp Duty (Amendment) Ordinance 2026 (gazetted 29 May 2026), top AVD band 4.25% → 6.5%
- Hong Kong Monetary Authority, countercyclical macroprudential measures for property mortgage loans — <https://www.hkma.gov.hk/eng/news-and-media/press-releases/2024/10/20241016-4/>
- Office of the Licensing Authority, *Hotels/Guesthouses* FAQ (Cap. 349 penalties) — <https://www.hadla.gov.hk/en/licensing_matters/hotels/faq.php>
- Estate Agents Ordinance (Cap. 511) — <https://www.elegislation.gov.hk/hk/cap511>
- Centaline *Property Market Big Data* — <https://hk.centanet.com/opendata2019/en/>
- Land Registry search fees and MMIM subscription — <https://www.landreg.gov.hk/en/services/search_fee.htm>
- Centamap, *Intellectual Property Rights Notice* (the licence governing the census and boundary layers) - <http://census.centamap.com/en-US/CopyRight/IPRN>
- Centamap proprietary rights notice - <http://www1.centamap.com/gc/o/b5/info.htm>
- Inland Revenue Department, *Annual Report 2024-25*, Schedule 7 (property ownership classification) - <https://www.ird.gov.hk/dar/2024-25/table/en/schedules.pdf>
- Census and Statistics Department, *Housing Characteristics of the Hong Kong Population*, 2021 Census - <https://www.census2021.gov.hk/doc/pub/21C_Articles_Housing.pdf>
- UBS investor-share and gross-yield commentary, reported via South China Morning Post - <https://finance.yahoo.com/news/hong-kong-residential-property-markets-093000606.html>
- Pricing benchmarks: PropertyData <https://propertydata.co.uk/pricing>, Mashvisor <https://www.mashvisor.com/pricing>, HouseCanary <https://www.housecanary.com/pricing>, Lendlord <https://lendlord.io/uk-plan>, Stessa <https://www.stessa.com/pricing/>, Landlord Studio <https://www.landlordstudio.com/pricing>, RentCast <https://www.rentcast.io/api>, PropStream <https://www.propstream.com/pricing>, DealMachine <https://www.dealmachine.com/pricing>
