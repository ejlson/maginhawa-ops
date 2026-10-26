# UK Market Opportunity, Operator Pain Points and Go-To-Market for a Restaurant Operations/Compliance App

## Market size: UK food businesses, licensed premises, openings/closures (2025–2026)

### Takeaway
The FSA regulates about 590,000 UK food establishments, the widest addressable "anyone who must keep food safety records" universe. The licensed on-trade (pubs, bars, licensed restaurants) is a far smaller core of about 98,600 GB sites (CGA/NIQ, June 2026). That core is flat to slowly shrinking and turns over heavily: about 1,800 closures and 1,800 openings per quarter. Independents are the volatile majority and grew again from Q3 2025.

### Cited Findings
- About 590,000 food establishments in the UK, of which 36,000 (6.1%) are unrated. New food business registrations were about 104,000 in 2025/26, up 8.7% on 2024/25 — [FSA Sept 2026 Board: LA performance update](https://www.gov.uk/government/publications/food-standards-agency-september-2026-board-meeting/local-authority-performance-update-food-standards-agency-september-2026-board-meeting)
- New registrations were 96,283 in 2024/25, up from 90,613 in 2023/24 — [FSA 25/09/04 Annual LA Performance](https://www.gov.uk/government/publications/fsa-250904-annual-local-authority-performance/fsa-250904-annual-local-authority-performance)
- High Speed Training's analysis of the FSA FHRS API (downloaded June 2026) covers 239,562 food establishments across England, Scotland, Wales and NI. This is a subset of rated businesses in its analysis, not all registered FBOs — [High Speed Training Food Hygiene Report 2026](https://www.highspeedtraining.co.uk/hub/?p=79755)
- GB licensed premises: 98,564 at end of June 2026. This is flat versus March 2026 and 0.2% below June 2025. Q2 2026 saw 1,839 closures (about 20/day) and 1,794 openings — [NIQ/CGA Hospitality Market Monitor Q2 2026](https://nielseniq.com/global/en/news-center/2026/hospitality-outlets-flat-in-second-quarter-after-rapid-churn-of-closures-and-openings/); [The Caterer](https://www.thecaterer.com/news/britains-licensed-hospitality-sector-hit-with-1800-closures-in-q2-2026)
- Q1 2026: hospitality lost about three sites a day — [NIQ press release](https://nielseniq.com/global/en/news-center/2026/hospitality-loses-three-sites-a-day-in-tough-first-quarter-of-2026/)
- Sept 2025: 99,296 licensed venues, with 572 net closures in 12 months (about 11/week). That is 15,812 (14.2%) fewer than March 2020 — [CGA/NIQ via Restaurant Online](https://www.restaurantonline.co.uk/Article/2025/10/21/hospitality-numbers-fall-with-11-licensed-premises-closing-a-week-over-the-past-year); [CGA](https://cgastrategy.com/?p=84949)
- The independent sector lost "nearly a fifth of its sites in five years" but grew 0.9% in Q3 2025 — [CGA/NIQ](https://cgastrategy.com/?p=84949); [NIQ: Pubs, Bars and Independents](https://nielseniq.com/global/en/insights/analysis/2025/pubs-bars-and-independents-green-shoots-in-a-challenging-hospitality-landscape/)
- Bars: 4,695 sites (June 2026), +1.4% YoY. 515 bars opened in the past 12 months. City centres +0.4% YoY versus -0.2% for the whole market. Liverpool +4.0%, Brighton +2.2% — [NIQ Q2 2026](https://nielseniq.com/global/en/news-center/2026/hospitality-outlets-flat-in-second-quarter-after-rapid-churn-of-closures-and-openings/)
- ONS publishes counts of SIC 56 enterprises and local units by employment size for 2023–2025 (ad hoc ah1864.xlsx). Nomis provides 5-digit subclasses (56.101 licensed restaurants, 56.102 unlicensed restaurants, 56.302 pubs and bars). The figures sit in the spreadsheet, not on the web page — [ONS: Food services by employment size UK 2023–2025](https://www.ons.gov.uk/businessindustryandtrade/business/activitysizeandlocation/adhocs/3495foodservicesbyemploymentsizeuk2023to2025); [ONS FOI on restaurant counts](https://www.ons.gov.uk/aboutus/transparencyandgovernance/freedomofinformationfoi/numberofrestaurantstakeawayscafesbarsandpubsintheuk)
- Payrolled employees in accommodation and food services: 2,085,155 in Aug 2025, down 4.1% YoY from 2,174,759 — [RSM UK](https://www.rsmuk.com/news/employment-in-hospitality-sector-continues-to-shrink)

### Inferences
- TAM layers for the report writer:
  - About 590k FSA-registered establishments. This includes care homes, schools, retailers and manufacturers.
  - Roughly 240k FHRS-rated establishments in the public dataset.
  - About 98.6k licensed GB on-trade sites.
  - Unlicensed cafés and takeaways sit between the second and third figures. ONS Nomis 56.10/56.30 local-unit counts would confirm the number.
- About 100k new food business registrations a year, plus about 7,000 licensed openings a year (about 1,800/quarter), is a large recurring "new operator" inflow. These operators need a food safety management system from day one, which is a natural acquisition moment.
- High churn (about 1 in 14 licensed sites closing a year) means churn-tolerant pricing (monthly, no long contracts) and fast onboarding matter.

### Gaps
- I did not extract exact ONS UK Business Counts 2025 for SIC 56.10/56.21/56.29/56.30. They are in the ONS xlsx/Nomis, not reachable as page text.
- I found no 2025–26 split of independent vs. managed/chain site counts, beyond CGA's statements that independents fell by about a fifth since 2020 and grew 0.9% in Q3 2025. CGA's Q2 2026 release gives no ownership split.
- No by-nation counts (England/Scotland/Wales/NI) of hospitality sites were retrieved.

## FHRS data: rating distribution, inspection volume, and the role of "confidence in management"

### Takeaway
UK ratings are heavily skewed to the top: 78% are rated 5 and 97% are rated 3+. Only about 3% are rated 0–2, so "avoid a failing score" is a narrow pitch. The bigger pitch is moving 3s and 4s up to 5 and staying there. Takeaways are the weak segment, with 19.5% rated 3 or below. The documentation-driven "confidence in management" score can cap a rating on its own, which is the direct hook for a digital records app.

### Cited Findings
- Nationally, 97% of businesses are rated 3+ and 78% are rated 5 (England 77.8%, Wales 75.2%, NI 83.3%) — [FSA Sept 2026 LA performance update](https://www.gov.uk/government/publications/food-standards-agency-september-2026-board-meeting/local-authority-performance-update-food-standards-agency-september-2026-board-meeting)
- HST analysis of the FHRS API (June 2026), covering England, Wales and NI:
  - 72.33% are rated 5, 88.31% are rated 4+, and 11.69% are rated 3 or below.
  - 501 establishments are rated 0.
  - The average rating rose from 4.47 (2025) to 4.58 (2026).
  - 19.5% of takeaways are rated 3 or below.
  - London is the 10th of 11 regions (average 4.39).
  — [High Speed Training Food Hygiene Report 2026](https://www.highspeedtraining.co.uk/hub/?p=79755)
- Low-rated (0–2) businesses are about 3% of England's food business population. The FSA's 2025 display audit found 4.5% of audited businesses rated 0–2 in England, 1.3% in NI and 4.3% in Wales. Only 5% of 0–2 rated English businesses displayed their sticker, against 81% of 5-rated ones. Display is voluntary in England and mandatory in Wales and NI — [FSA FHRS Audit of Display and Business Survey 2025](https://science.food.gov.uk/article/162577-food-hygiene-rating-scheme-audit-of-display-and-business-survey-2025)
- 96% of businesses know their rating — [FSA FHRS Audit 2025](https://science.food.gov.uk/article/162577-food-hygiene-rating-scheme-audit-of-display-and-business-survey-2025)
- Scoring mechanics:
  - The FHRS score is the sum of three parts: hygiene and safety procedures, structural compliance, and confidence in management. Confidence in management is scored 0/5/10/20/30.
  - The worst score (30) means "no evidence of food safety management/documented procedures", poor supervision and a poor track record.
  - An "additional scoring factor" rule means a single bad component score caps the overall rating, however good the total is.
  — [High Speed Training FHRS scoring table (PDF)](https://highspeedtraining.co.uk/hub/wp-content/uploads/2025/03/fhrs-scoring-table.pdf); [Hygiene Scout explainer](https://hygienescout.co.uk/blog/understanding-food-hygiene-scores); [NCASS FHRS guide](https://www.ncass.org.uk/wp-content/Guides/Food%20Hygiene%20Rating%20Scheme%20Guide.pdf)
- Inspection delivery:
  - Due hygiene interventions completed (A–E) rose from about 52% (Apr/Oct 2024) to 62% (Apr 2025). England's E-rated interventions reached 42%.
  - A "large backlog" remains for lower-risk establishments.
  — [FSA 25/09/04 Annual LA Performance](https://www.gov.uk/government/publications/fsa-250904-annual-local-authority-performance/fsa-250904-annual-local-authority-performance); [FSA board papers](https://www.food.gov.uk/board-papers/annual-local-authority-performance)
- April 2026: due interventions achieved were 98.2% for A, 98.2% for B and 88.8% for C. Complaints exceeded 64,000 (+5%). Formal enforcement actions hit their "highest yearly volume in over ten years". Food hygiene FTE occupied was 1,582 — [FSA Sept 2026 LA update](https://www.gov.uk/government/publications/food-standards-agency-september-2026-board-meeting/local-authority-performance-update-food-standards-agency-september-2026-board-meeting)
- Councils cite officer loss and resourcing deficits as barriers to clearing backlogs — [Reading Food Service Plan 2025](https://democracy.reading.gov.uk/documents/s36414/Committee%20Report%20-%20FSP%20Policy%20Committee%2021%20July%2025%20Final.pdf); [West Suffolk Food Safety Service Plan 2024/25](https://www.westsuffolk.gov.uk/Business/Licensing-and-regulation/food-safety/upload/WSC-Food-Safety-and-Health-and-Safety-Service-Plan-2024-2025.pdf)
- The FSA FHRS open data API is the source used by third-party analyses such as HST's — [HST report 2026](https://www.highspeedtraining.co.uk/hub/?p=79755); [FSA FHRS page](https://www.food.gov.uk/about-us/food-hygiene-rating-scheme-fhrs)

### Inferences
- The FHRS API makes a data-driven acquisition engine possible. Target 3- and 4-rated sites, takeaways, recently rated sites, and the about 36k unrated new businesses, with "get to 5 and prove it at your next inspection" messaging. Each rating is public and timestamped.
- Because confidence in management is driven by documentation and the additional scoring factor can cap a rating, digital SFBB/HACCP records map directly onto a scoring component. This is the clearest ROI story.
- Rising enforcement volume (highest in 10+ years) and rising complaints, alongside an improving inspection catch-up, mean more inspections are reaching operators in 2025–26.

### Gaps
- No precise count of inspections per year (absolute number) was retrieved. Only completion percentages are available.
- I found no statistic on businesses failing or closing specifically because of poor documentation.
- Scotland uses FHIS (Pass/Improvement Required), not FHRS. No Scottish distribution was retrieved.

## Cost pressures shaping willingness to pay

### Takeaway
UK operators face stacked labour cost increases: employer NIC (April 2025), NLW at £12.71 from April 2026, and Employment Rights Act 2025 obligations phasing in from April 2026 to 2027. They are partly offset by permanently lower RHL business rates multipliers from April 2026. Budgets are tight, but labour-saving and audit-proofing tools are easier to justify than "nice to have" software.

### Cited Findings
- UKHospitality: 774,000 hospitality workers were brought into employer NICs for the first time by the threshold cut, costing the sector £1bn, alongside £2.4bn of other April 2025 costs — [Caterer Licensee / UKHospitality](https://catererlicensee.com/774000-hospitality-workers-dragged-into-new-nics-threshold/); [Restaurant Online](https://www.restaurantonline.co.uk/Article/2025/02/25/rise-in-national-insurance-contributions-to-hit-hospitality-employment-and-investment)
- Survey findings after the Budget: 70% of hospitality businesses expected to cut employment, 60% to cancel investment and 15% to close at least one site — [UKHospitality](https://www.ukhospitality.org.uk/?p=7781); [Personnel Today](https://www.personneltoday.com/?p=338057)
- Hospitality accounted for 53% of UK job losses since the Budget (about 89k of about 165k). From October 2024 to May 2025, hospitality lost 69,000 jobs — [UKHospitality](https://www.ukhospitality.org.uk/?p=8371)
- The National Living Wage rises 4.1% to £12.71 from April 2026, about £1.4bn of extra cost for hospitality per UKHospitality — [Restaurant Online](https://www.restaurantonline.co.uk/Article/2025/11/26/national-living-wage-to-increase-by-41-to-1271/)
- Business rates from April 2026 (England):
  - New permanent lower RHL multipliers replace the temporary RHL relief. The small business RHL multiplier is 38.2p for RV under £51k, against 43.2p for non-RHL.
  - A standard RHL multiplier applies for RV £51k–£499,999.
  - Pubs and live music venues get 15% relief in 2026–27.
  — [Morning Advertiser](https://www.morningadvertiser.co.uk/Article/2025/10/17/government-confirms-new-lower-business-rates-multipliers-for-hospitality-from-april-2026); [Brent Council](https://www.brent.gov.uk/business/business-rates/business-rates-changes-from-april-2026)
- The 2026 revaluation hits some subsectors hard. Hotel RVs rose 76% on average, and UKHospitality projects average hotel bills up 115% by April 2029 — [UKHospitality member insight](https://www.ukhospitality.org.uk/?p=10308); [Morning Advertiser](https://www.morningadvertiser.co.uk/Article/2025/10/17/government-confirms-new-lower-business-rates-multipliers-for-hospitality-from-april-2026)
- Employment Rights Act 2025 (Royal Assent 18 Dec 2025):
  - April 2026: day-one SSP and day-one paternity and unpaid parental leave.
  - October 2026: workers must be consulted on tipping policies, reviewed every 3 years. Fire-and-rehire rules tighten.
  - 2027: the unfair dismissal qualifying period falls to 6 months and the compensation cap is removed. Guaranteed hours, reasonable shift notice and short-notice cancellation pay are scheduled for 2027.
  — [Moore Kingston Smith](https://mooreks.co.uk/insights/the-uk-employment-rights-act-2025-what-it-means-for-hospitality-and-how-the-sector-can-stay-ahead/); [gov.uk ERA overview factsheet](https://assets.publishing.service.gov.uk/media/696fabb3c0f4afaa9536a0f2/employment-rights-act-2025-overview-factsheet.pdf); [CIPD on tipping](https://www.cipd.org/uk/views-and-insights/thought-leadership/insight/employment-rights-bill-update/); [Fourth](https://uk.fourth.com/article/the-employment-rights-act-september-2026)
- Trade bodies estimate 150,000–200,000 hospitality jobs at risk in 2026 — [Caterer Licensee](https://catererlicensee.com/uk-labour-market-softens-as-hospitality-sector-faces-workforce-challenges/)

### Inferences
- ERA 2025 creates new record-keeping needs (shift notice, cancellation, tipping consultation records, SSP). A compliance app that adds employment record-keeping, or integrates with rota tools, can widen its value beyond food safety.
- With labour costs rising and headcount being cut, fewer staff will cover the same checks. Time saved per check (for example Shield's "30–60 seconds" per check claim) and fewer manager hours are credible ROI levers.
- The lower RHL multiplier modestly eases costs for small pubs and restaurants under £51k RV, the independent beachhead. Hotels face sharp rate rises, so they are a weaker early segment.

### Gaps
- No 2025–26 UK hospitality energy cost data was retrieved.
- No BBPA or BII statements were retrieved directly. UKHospitality is the main source.
- NLW April 2025 base rate: £12.21 is implied by "4.1% to £12.71" but was not directly sourced. The exact NIC rate (15%) and threshold (£5,000) were not confirmed from a retrieved source.

## UK operator pain points: staffing, inspections, allergens, paperwork

### Takeaway
The main pains are:
- High churn of staff, who must be trained and keep records correctly.
- Allergen failures, which now bring five-figure fines and reputational damage.
- New FSA guidance pushing written allergen information.
- Paper SFBB diaries that EHOs scrutinise under confidence in management.

### Cited Findings
- Hospitality is the highest-turnover UK sector at 38.7% (RotaCloud 2024 data), and 47% in bars and clubs — [NatWest Mentor](https://www.natwestmentor.co.uk/news/staff-turnover-rates-by-industry-uk-2026-benchmarks)
- Vacancies:
  - 78,000 in Aug 2025, up from 74,000 in July and the first rise in a year.
  - 84,000 in Jan–Mar 2025, down from 107,000 a year earlier.
  — [RSM UK](https://www.rsmuk.com/news/hospitality-vacancies-rise-for-first-time-in-a-year-as-businesses-adapt-to-new-norm); [Morning Advertiser](https://www.morningadvertiser.co.uk/Article/2025/04/16/job-vacancies-in-hospitality-for-first-quarter-of-2025)
- Allergen prosecutions, 2025:
  - Javitri (Uxbridge) paid £43,816 after a customer was hospitalised. Officers found nuts stored incorrectly, incomplete menu descriptions and "uncertainty regarding recipes", even though staff had done FSA allergen training that month — [Hillingdon Council](https://www.hillingdon.gov.uk/article/14517/Uxbridge-restaurant-fined-more-than-40000-after-allergen-contamination-led-to-customer-being-hospitalised)
  - Pop-Inn Café (Southwark) was fined £18,000 plus a community order after the death of 12-year-old Mia-Shay St Hilaire (Jan 2025) — [Southwark Council](https://www.southwark.gov.uk/news/2025/southwark-cafe-fined-food-safety-breaches-following-death-12-year-old-girl-allergic)
  - A Hartlepool takeaway was fined £10,000 after a test purchase found peanut protein — [Hartlepool Council](https://www.hartlepool.gov.uk/news/article/107/takeaway-restaurant-fined-over-peanut-protein-in-meal)
- FSA best-practice guidance for non-prepacked food (England, Wales, NI) says written allergen information should always be available, alongside a conversation with the customer. The FSA provides an allergen matrix and icons. The law still allows verbal or written information — [FSA news](https://www.food.gov.uk/news-alerts/news/updated-industry-guidance-issued-for-food-allergen-information-in-the-out-of-home-sector); [gov.uk guidance](https://www.gov.uk/government/publications/allergen-information-for-non-prepacked-foods-best-practice/allergen-information-for-non-prepacked-foods-best-practice)
- Low-rated businesses tend to show outdated stickers. Only 1 of 71 displaying low-rated English businesses showed a valid rating — [FSA FHRS Audit 2025](https://science.food.gov.uk/article/162577-food-hygiene-rating-scheme-audit-of-display-and-business-survey-2025)

### Inferences
- The Javitri case is a strong illustration that training without recipe-level allergen records fails. Recipe and allergen matrix management tied to the menu is a high-value module.
- Turnover of 38–47% means onboarding, task guidance and auto-generated audit trails matter more than in low-churn sectors.

### Gaps
- Reddit (r/KitchenConfidential, r/chefit, r/UKhospitality) and Caterer forum threads were not reviewed in this pass, so there are no qualitative operator quotes.
- No UK data was found on equipment breakdown frequency, maintenance contractor costs or response times.
- No statistic was found on the share of operators still using paper SFBB diaries.

## Go-to-market channels in the UK

### Takeaway
Several channels have proven UK precedents:
- **Trade-body member deals.** Trail offers BII members 3 months free, then £12/site/month.
- **Pub-company estate deals.** Star Pubs partnered with Shield Safety for licensee compliance.
- **Insurer premium discounts.** Towergate gave Checkit users £60–£100 per site per year off premiums.
- **EPOS/rota integrations.** Trail integrates with Epos Now and Deputy.
- **Food hygiene trainers/consultancies.** Shield and HST run audit plus software models.

### Cited Findings
- **BII and Trail:** 3 months free for BII members, then £12/site/month, cancel anytime. Trail integrates with Epos Now, Deputy, HGEM, FeedItBack and iAuditor. Its customers include Bill's, Enterprise Inns, Gail's, Honest Burgers and BrewDog — [Trail BII page](https://trailapp.com/group/bii)
- Trail also runs partner pages for other channels (for example my-compliance, Surefoot "save £600 per site") — [Trail partner page](https://trailapp.com/partner/my-compliance); [Trail x Surefoot](https://trailapp.com/surefoot)
- **Star Pubs & Bars and Shield Safety:** licensees get audits, an EHO helpline, mobile compliance software and cloud records. Star can monitor compliance remotely via a traffic-light system, and checks take 30–60 seconds on an iPad — [Shield Safety case study](https://shieldsafety.co.uk/resources/case-studies/star-pubs); [Morning Advertiser 2018](https://www.morningadvertiser.co.uk/Article/2018/09/27/Star-launches-health-and-safety-system-for-licensees)
- **Greene King Pub Partners:** invested £200k in a "Pub Comms App" for licensee communication with Pubs Code-compliant records. This shows pubcos will fund tenant-facing apps — [Caterer Licensee](https://catererlicensee.com/greene-king-pub-partners-invests-200000-in-app-to-strengthen-collaboration-with-licensees/)
- **Towergate and Checkit:** Checkit Solo users save £60/year on Towergate premiums, and Checkit Professional users save £100 per location per year. This is an older deal, from about the late 2010s — [The Caterer](https://thecaterer.com/all-content/checkit-partners-with-towergate-insurance-to-reduce-business-insurance-premiums); [Post Online](https://postonline.co.uk/claims/3286091/towergate-to-roll-out-food-safety-compliance-tech)
- **Shield Safety "Shield Assure":** bundles compliance and assurance services — [Shield Assure](https://shieldsafety.co.uk/shield-assure/)
- **Epos Now:** advertises 150+ app integrations via its AppStore/API — per search summary; no primary Epos Now page was retrieved.
- **High Speed Training:** a major UK food hygiene trainer that publishes FHRS analysis. It is a content and partner channel candidate — [HST Food Hygiene Report](https://www.highspeedtraining.co.uk/hub/?p=79755)

### Inferences
- Recommended beachhead: independent and small-group (1–10 site) pubs, restaurants and takeaways in England. The reasons:
  - They are the majority of licensed sites and are churning or growing again.
  - Takeaways are the worst-rated segment.
  - Tenanted and leased pubs can be reached in bulk through pubcos (Star, Greene King, Admiral, Stonegate), which have a regulatory and brand reason to monitor tenant compliance.
- Channel priority:
  1. Pubco and franchise estate deals, which bring one contract and many sites.
  2. Trade-body member pricing (BII, UKHospitality, NCASS for street food).
  3. Integrations with Epos Now, Square and Lightspeed, plus rota tools.
  4. Insurer discount partnerships.
  5. FHRS-data-driven outbound to 3- and 4-rated and newly registered businesses.
- Incumbent competitors in UK pubs and multi-site: Trail, Checkit, Navitas, Shield Safety, FoodDocs. A new entrant should differentiate on SME price and combined ops (maintenance plus allergens plus ERA records).

### Gaps
- No primary pages were retrieved for Lightspeed, Square UK, Zonal or SumUp app marketplace listing terms or revenue share.
- Wholesalers (Bidfood, Brakes, Booker) were not checked for software referral programmes. Trade shows (Hospitality Show, Restaurant Show, HRC, Casual Dining) were not checked for costs.
- Primary Authority partnerships and CIEH/Highfield partnership models were not researched.
- Current partnerships of Hiscox, Simply Business, Markel and NFU Mutual with compliance software were not confirmed. Only Towergate–Checkit is evidenced, and it may be historical.
- No evidence was found of Admiral or Stonegate mandating a specific compliance app for tenants.

## UK hospitality software price benchmarks (per site per month)

### Takeaway
UK food safety and ops apps cluster around:
- £12–£38 per site/month at the SME or partner-discount entry level.
- £65–£90 for standard multi-site tiers.
- Up to $99–$299 per site for FoodDocs' full HACCP tiers.

Rota tools price per employee at about £1/employee/month. A credible SME price point is about £15–£40 per site/month, with a premium tier at about £60–£80.

### Cited Findings
- Trail (per site/month): Team £38 (£32 annual) for 1–3 sites; Standard £75 (£65 annual); Evo £82.50 (£71.50 annual); Enterprise custom. Users are unlimited, there is a 14-day trial and a 12-month minimum term — [Trail pricing](https://trailapp.com/pricing)
- A Trail Solo plan at £14/month for single sites was reported in a search snippet but not shown on the fetched pricing page, so treat it with caution — [Trail pricing](https://trailapp.com/pricing)
- Trail for BII members: £12/site/month after 3 free months — [Trail BII](https://trailapp.com/group/bii)
- Checkit: from about £20 (per user, per Capterra). The legacy Checkit Solo cost £199 upfront plus £19.99/month — [Capterra UK Checkit](https://www.capterra.co.uk/software/178590/checkit); [Chippy Chat](https://www.chippychat.co.uk/post/special-offer-for-chippy-chat-readers-improve-your-food-safety-and-get-rid-of-paperwork-823)
- Navitas Compliance: from £90 per Capterra (unit unclear) — [Capterra UK Navitas](https://www.capterra.co.uk/software/200496/navitas-compliance)
- FoodDocs (per site/month, unlimited users): Lite $99 ($79 annual), Standard $199 ($167), Professional $299 ($250) — [Capterra FoodDocs pricing](https://www.capterra.com/p/214198/FoodDocs/pricing/)
- RotaCloud: £1/employee/month for rota, plus £0.90 for time and attendance and £0.40 for SMS. For a 15-staff site that is about £15–£35/month — [Capterra RotaCloud](https://www.capterra.com/p/137099/RotaCloud/pricing/)
- Insurer offset benchmark: £60–£100 per site per year off premiums (Towergate/Checkit) — [The Caterer](https://thecaterer.com/all-content/checkit-partners-with-towergate-insurance-to-reduce-business-insurance-premiums)

### Inferences
- The partner-discounted floor (£12/site/month via BII) shows where SME price expectations sit for pub tenants. Above about £40/site/month, independents likely need clear extra value such as sensors, allergen/recipe management or maintenance.
- An insurer discount of about £5–£8/month can offset half or more of an entry-tier subscription, a useful sales argument.

### Gaps
- EPOS subscription benchmarks (Epos Now, Lightspeed, Square UK, Zonal, Tevalis) were not retrieved.
- Planday, Rotaready, Deputy UK and Fourth pricing were not retrieved.
- No survey data was found on UK SME stated willingness to pay for compliance software.
