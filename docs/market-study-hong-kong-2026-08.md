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

### 3.4 Mortgage rules — our defaults are stale

Current HKMA position, from its countercyclical macroprudential measures:

| Rule | Current | Veela's shipped default | Verdict |
|---|---|---|---|
| LTV cap, residential | **70% flat**, regardless of value or self-occupation (from 16 Oct 2024) | 70% up to HK$30M, 60% above | **stale** |
| Debt-servicing ratio | **50%** | 50% | correct |
| Stress test (+2pp) | **suspended** since 28 Feb 2024 | applied, with a 60% stressed-DSR ceiling | **stale** |

Veela flags these `unverified: true` and shows a "confirm with a bank" caveat keyed off that flag, so the product is honest about not knowing. It can now be made *right*: the effect today is that Veela tells some buyers they may not qualify using a value-banded cap and a stress test the regulator no longer imposes.

*Recommendation:* update the defaults, but cite the HKMA circular itself. This study's sources for the mortgage rules are secondary — the HKMA's own pages did not render to an automated fetch, and a lending policy shown to a user should rest on the primary document.

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

### 4.1 Centaline open data — verified, and the answer is "ask them"

The single highest-value unknown coming into this study. What `hk.centanet.com/opendata2019` actually publishes:

- **Stock:** 1.19 million private residential units, classified by building age and area, with turnover rates.
- **Transactions:** approximately **1.4 million private residential transactions from 1995 onwards, including saleable area.**
- **Census:** 2016 Population By-census data.

**Licence position — this is the finding.** The page specifies **attribution**: cite Centaline Map as the source of the housing-market-area boundaries, and for statistics cite "Government Statistics Department and Centaline Map". It states **no fee**. And it says **nothing at all** about commercial use or redistribution.

That silence is not permission. A dataset published for reference with an attribution requirement and no licence grant cannot safely be embedded in a commercial product on the assumption that it is allowed.

**Recommendation:** write to Centaline and ask for written permission for commercial use, naming the datasets and the intended use. It is a short letter, it costs nothing, and it is the difference between a product built on 1.4 million real transactions and one built on 54 generated samples. **This is the highest-expected-value action available and it is not an engineering task.**

---

## 5. Competition

Verified: the Hong Kong market is served by **listing portals**, not investment analytics. Centanet/Centadata (Centaline), Midland, Spacious, 28Hse, Squarefoot and House730 all publish listings and — for the first two — transaction history per estate. Veela has tested five of them directly through its own listing importer, which is how we know that Centanet publishes price and bedrooms as structured data but no area; Squarefoot and 28Hse publish area and bedrooms but no price; Midland publishes a full hydration payload with price *and* rent as separate fields; and House730 and Spacious sit behind Cloudflare bot challenges that refuse even a real browser.

**What this establishes:** nobody in this market is competing on *"tell me whether this specific flat is a good investment, with the tax computed correctly."* The portals compete on inventory. That is the gap Veela occupies.

**What could not be verified** (the research agent failed twice on infrastructure): whether any Hong Kong proptech startup offers investor analytics, and published subscription prices for comparable tools elsewhere (Mashvisor, PropertyData, AirDNA) as a pricing benchmark. See §10.

---

## 6. What Veela actually owns

Worth stating plainly, because it decides the strategy in §8.

1. **A correct, dated, tested Hong Kong tax engine.** AVD Scale 2 transcribed from the IRD including the February 2026 6.5% band; Scale 1 Part 1; property tax at 15% on 80% of rent; no capital gains tax modelled as a *named Hong Kong rule* rather than a silent assumption; 36 tests pinning every marginal-relief boundary. **This is the asset a competitor cannot scrape**, and it is verifiably current as of this study.
2. **The RVD series, parsed and usable** — price and rent indices monthly back to 1993, market yields by Class back to 1999, stock/vacancy/completions by district.
3. **A rent estimator grounded in published yields** rather than invented comparables — price × RVD Class yield ÷ 12, which is the only defensible way to estimate a rent in a market that publishes no rental comparables.
4. **Correct regulatory posture** on Cap. 349 and Cap. 511, which is worth more than it sounds: a US-built competitor entering this market would ship an Airbnb calculator and be advertising a criminal offence.

---

## 7. Willingness to pay — what we know and don't

Veela's published pricing: **Free**, **Investor HK$188/month**, **Pro HK$5,000/month** (10,000 API calls). No payment processor is configured, so nothing has ever been charged.

**We have no willingness-to-pay evidence.** Not one customer, not one priced conversation. Everything in §8 is therefore a structural argument, not a validated one, and should be read as such. Benchmarks against comparable tools elsewhere could not be verified in this study.

---

## 8. Revenue: two models, and the arithmetic is not close

### Consumer subscription

The addressable flow is transactions, not stock: **62,832 in 2025**, annualising to ~81,600 in 2026. Someone buying a flat is in the market for a few months.

**Scenario, with every assumption stated:** if 2% of 2025's buyers ever subscribed at HK$188/month for an average of six months —

`62,832 × 2% × HK$188 × 6 = HK$1.42M per year`

At 5% and twelve months it is `62,832 × 5% × HK$188 × 12 = HK$7.1M`. Both are scenarios, not forecasts; the 2% and 5% are illustrative and unvalidated.

**The structural problem is unchanged.** Veela's honest answer in this market is usually "this yields 2–3%, which barely beats cash". Nobody renews a subscription to be told no. The Alerts feature (built 15 August) is the counter-argument — it gives a *holder* rather than a *buyer* a reason to stay — and it moves the target from ~63,000 annual buyers to a share of **1.29 million owned units**, which is a twenty-times-larger pool. That reframing is the strongest argument for the consumer tier, and it is still unvalidated.

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

Listed rather than estimated:

- **Number of landlords / buy-to-let share of transactions.** No published figure found. This is the key denominator for sizing the consumer tier and it remains unknown.
- **Share of purchases by non-permanent residents or companies** since the February 2024 abolition. Research was interrupted before this could be confirmed.
- **Subscription prices for comparable tools** elsewhere, as a benchmark for HK$188/month.
- **Whether any HK proptech competitor offers investor analytics**, and at what price.
- **Whether Centaline permits commercial re-use** — the terms are silent, so this must be asked, not inferred.
- **Owner-occupied vs rented split** of the 1.29M private units. RVD's own PDFs did not render to an automated fetch; the figure likely exists in the Hong Kong Property Review and should be read by hand.
- **HKMA's rules from the primary circular.** The current LTV/DSR position here rests on secondary sources because hkma.gov.hk did not render.

---

## 11. Recommendation

In order, highest expected value first:

1. **Write to Centaline for written commercial-use permission.** Zero cost, and it is the difference between real transaction data and generated samples. Not an engineering task.
2. **Name an invoicing entity** in `/terms` and `/privacy`. Nothing can be charged until this exists; it gates every revenue scenario in §8.
3. **Add the missing dated rule sets** (pre-Feb-2024 and Feb-2024 → Feb-2026). Today a user with a 2023 or 2025 purchase cannot be served at all, and the engine is the asset.
4. **Correct the mortgage defaults** against the HKMA's own circular — 70% flat, no stress test — and only then consider clearing the `unverified` flag.
5. **Sell the API to five brokers before building more consumer features.** February 2026's rate change is the pitch: every hard-coded stamp duty table in this city is currently wrong.
6. **Do not build referrals or lead sales** without a solicitor's view on Cap. 511.

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
