# UK legal and regulatory record-keeping requirements for a restaurant operations app (current at 6 October 2026)

Method note: this pass used about 16 tool calls. It confirmed the highest-priority and fastest-changing items (SFBB pack variants, FHRS elements, display rules and scoring bands, Martyn's Law, Employment Rights Act 2025 dates, the FSA delivery model and tipping-law commencement) against primary or near-primary sources. Some items rest on long-standing statute or guidance that was not re-fetched this session. Those are marked **[unverified]** and need a primary-source check before they go into the product as "the law". FSA web content has moved from food.gov.uk to gov.uk: old food.gov.uk URLs now give a 301 redirect to gov.uk/government/publications/... This matters for any deep links built into the app.

---

## Q1. Food safety management: SFBB, CookSafe, HACCP, temperature control and training

### Takeaway
Every food business must run a documented, HACCP-based food safety management system. FSA's Safer Food Better Business (SFBB) is the standard template in England and Wales. SFBB has variants for Caterers, Retailers, Indian cuisine, Chinese cuisine and Childminders, plus a supplement for residential care homes. Every pack covers cross-contamination, cleaning, chilling, cooking and management, and uses a diary with daily records and a 4-weekly review. The app should model those sections directly. Scotland uses CookSafe from Food Standards Scotland instead.

### Cited Findings
- SFBB pack variants listed by the FSA: Caterers, Retailers, Indian cuisine, Chinese cuisine, Childminders, Residential care homes (supplementary pack) and Colleges (teaching resources) — [GOV.UK/FSA – Safer food, better business](https://www.gov.uk/government/publications/safer-food-better-business-sfbb/safer-food-better-business-sfbb)
- The packs cover "cross-contamination, cleaning, chilling, cooking, management, using the diary". The diary pages are for daily record-keeping, and there is a 4-weekly review. Businesses can keep an electronic diary or print it and fill it in — [GOV.UK/FSA – SFBB](https://www.gov.uk/government/publications/safer-food-better-business-sfbb/safer-food-better-business-sfbb)
- FSA wording: the pack "must be completed for all your food operations and must outline the food safety practices in place with daily records kept in the diary." This means FSA explicitly accepts an electronic diary, which supports a digital app — [GOV.UK/FSA – SFBB](https://www.gov.uk/government/publications/safer-food-better-business-sfbb/safer-food-better-business-sfbb)
- FSA has moved its business guidance to gov.uk. The food.gov.uk SFBB URL now returns a 301 redirect to gov.uk — observed when fetching https://www.food.gov.uk/business-guidance/safer-food-better-business

### Long-standing requirements not re-fetched this session (all **[unverified]**)
- **Legal basis:** retained Regulation (EC) 852/2004 Article 5 requires permanent procedures based on HACCP principles, with documents and records proportionate to the size of the business. Article 4 and Annex II Chapter XII require food handlers to be supervised and instructed or trained in food hygiene in line with their work. England: Food Safety and Hygiene (England) Regulations 2013. Wales, Scotland and NI each have their own equivalent Food Hygiene Regulations 2006.
- **SFBB structure for Caterers:**
  - Safe method sheets, each with a "safety point / why? / how do you do this? / what if things go wrong?" layout and "prove it" sign-offs.
  - Management section: opening and closing checks, prove-it checks, training records, supplier list, cleaning schedule, extra checks.
  - Diary: daily opening and closing check sign-off, notes of problems and changes, and the 4-weekly review.
  - The detailed per-page layout was not visible on the gov.uk landing page fetched.
- **Opening checks:** fridges, chilled display and freezers working properly; other equipment (e.g. probes) working; staff fit for work and wearing clean work clothes; food preparation areas clean and disinfected; no evidence of pest activity.
- **Closing checks:** food on display removed; food past its use-by date discarded; food stored covered and labelled; dirty cleaning equipment cleaned or thrown away; waste removed and new bags put in bins; food preparation areas clean and disinfected; floors clean; prove-it checks recorded.
- **Fitness to work:** food handlers with diarrhoea and/or vomiting should be excluded until 48 hours symptom-free (FSA "Fitness to work" guidance). Staff with infected skin lesions should be excluded or have the lesion covered. The legal duty to report illness to the employer is in 852/2004 Annex II Chapter VIII.
- **Temperature control:**
  - **Legal:**
    - England, Wales and NI: hot holding at 63°C or above, and chill holding at 8°C or below (Food Safety and Hygiene (England) Regs 2013, Sch 4).
    - Hot food may be held below 63°C for one period of up to 2 hours.
    - Cold food may be held above 8°C for one period of up to 4 hours.
    - Scotland: there is no 8°C rule; food must be kept in a refrigerator or cool place.
    - Scotland: reheating to 82°C or above is a legal requirement (Food Hygiene (Scotland) Regs 2006, Sch 4), unless that would harm the food's quality.
  - **Guidance (SFBB):** cook so the core reaches 75°C instantly, or an equivalent time and temperature such as 70°C for 2 minutes, 80°C for 6 seconds or 65°C for 10 minutes. Fridges are recommended at 5°C or below. Cooling should be completed within 90 minutes where possible.
  - The prompt mentioned "reheat to 75°C in Scotland". This is likely an error: the Scottish legal figure is 82°C, and 75°C is the England/Wales/NI guidance figure. **[unverified – confirm against legislation.gov.uk ssi/2006/3 Schedule 4]**
- **Training:** Level 2 Food Hygiene certificates are best practice and are expected by EHOs. They are not a statutory requirement. The legal test is "supervised and instructed and/or trained … commensurate with their work activity". Those responsible for the HACCP procedures must have adequate training.
- **CookSafe (Food Standards Scotland)** is the HACCP-based manual for Scottish caterers. Its sections include house rules, HACCP sections, and record-keeping forms such as temperature records, cleaning schedules, training records and supplier lists. The detailed contents were not fetched.
- **Allergen and labelling law:**
  - 14 allergens (Annex II of retained Reg (EU) 1169/2011 on food information): celery, cereals containing gluten, crustaceans, eggs, fish, lupin, milk, molluscs, mustard, tree nuts, peanuts, sesame, soya, and sulphur dioxide/sulphites above 10 mg/kg or 10 mg/L.
  - Natasha's Law covers prepacked-for-direct-sale (PPDS) foods. It is the Food Information (Amendment) (England) Regulations 2019, in force 1 October 2021, with parallel rules in Wales, Scotland and NI. PPDS labels must show the name of the food and a full ingredients list with allergens emphasised.
  - Food Information Regulations 2014 (SI 2014/1855) provide enforcement of the allergen rules in England.
  - Non-prepacked food allergen information may be given orally if signposted in writing.
  - FSA best-practice guidance for non-prepacked food (2025) recommends that allergen information be provided in writing and also through conversation.

### Inferences
- The app's food-safety module should mirror the SFBB sections so an EHO recognises it:
  - safe methods by category (cross-contamination, cleaning, chilling, cooking)
  - management records: opening and closing checks, prove-it, training, suppliers, cleaning schedule
  - daily diary sign-off
  - 4-weekly review
- Provide jurisdiction profiles: England/Wales/NI (SFBB, 8°C legal limit, 63°C hot holding) and Scotland (CookSafe, 82°C reheat, no 8°C rule).
- Allergen matrix: store all 14 allergens for every dish and PPDS label fields, with versioned change history.

### Gaps
- The page-level structure of each SFBB variant pack (safe method sheet names, exact opening and closing check lists) was not fetched. The gov.uk landing page shows only the topic list. The PDFs need fetching.
- CookSafe contents and Scottish reheat temperature: not fetched this session **[unverified]**.
- Natasha's Law SI details and the 14-allergen list: from legislation knowledge, not re-fetched **[unverified]**.
- The 48-hour exclusion rule: FSA Fitness to Work guidance not re-fetched **[unverified]**.

---

## Q2. FHRS (England, Wales, NI) and FHIS (Scotland): scoring, display and re-rating

### Takeaway
Ratings run from 0 to 5 and are built from three inspected elements: hygienic food handling, physical condition, and confidence in management. Display is a legal requirement in Wales and NI but voluntary in England. Scotland uses a Pass/Improvement Required scheme (FHIS). A business can request a paid re-visit, which usually takes place within 3 months.

### Cited Findings
- **Three elements:**
  1. hygienic food handling (preparation, cooking, reheating, cooling, storage)
  2. physical condition (cleanliness, layout, lighting, ventilation, pest control)
  3. food safety management systems / confidence in management (processes, training, procedures)

  — [GOV.UK/FSA – Food Hygiene Rating Scheme](https://www.gov.uk/government/publications/food-hygiene-rating-scheme/food-hygiene-rating-scheme)
- **Rating descriptors:** 5 "very good", 4 "good", 3 "generally satisfactory", 2 "some improvement is necessary", 1 "major improvement is necessary", 0 "urgent improvement is required" — [GOV.UK/FSA – FHRS](https://www.gov.uk/government/publications/food-hygiene-rating-scheme/food-hygiene-rating-scheme)
- **Display:** a legal requirement in Wales and Northern Ireland, "in a prominent place, like the front door, entrance or window". England is voluntary: businesses are encouraged but not required — [GOV.UK/FSA – FHRS](https://www.gov.uk/government/publications/food-hygiene-rating-scheme/food-hygiene-rating-scheme)
- **Scoring bands** (secondary summary of the FHRS Brand Standard):
  - hygiene and structure are each scored 0/5/10/15/20/25; confidence in management is scored 0/5/10/20/30
  - total 0–15 = rating 5; 20 = 4; 25–30 = 3; 35–40 = 2; 45–50 = 1; above 50 = 0

  — [search summary of LA/FSA sources incl. Reigate & Banstead, NCASS FHRS guide](https://www.reigate-banstead.gov.uk/info/20376/food_hygiene_rating_scheme/199/food_hygiene_rating_scheme_fhrs_-_information_for_businesses); [NCASS FHRS guide](https://www.ncass.org.uk/wp-content/Guides/Food%20Hygiene%20Rating%20Scheme%20Guide.pdf)
- **Re-visit (re-rating):** a fee is payable before the re-visit. Fees vary by local authority, roughly £175–£265 in the forms seen. The re-visit takes place within three months of the request and payment — [Erewash BC revisit form](https://www.erewash.gov.uk/sites/default/files/2025-03/FHRS%20Revisit%20Form.pdf); [Newham revisit application](https://www.newham.gov.uk/downloads/file/116/requestforarevisitapplication); [Gloucester re-visit with fee](https://www.gloucester.gov.uk/media/hpvjd2ny/fhrs-re-visit-with-fee.pdf)

### Inferences
- The rating hinges on confidence in management, which is driven largely by the records the app holds: food safety management system, diary, training and supplier records.

### Gaps
- **Per-element caps** (additional condition for each rating): from Brand Standard memory, rating 5 requires no single element above 5, rating 4 no element above 10, rating 3 no element above 10, rating 2 no element above 15, and rating 1 no element above 20. The FSA PDF returned a 404 **[unverified]**.
- **Safeguards:** a 21-day appeal window (the rating is published after the appeal period), a right to reply, and the rule that a re-visit can raise or lower the rating. These were not confirmed from FSA primary text this session **[unverified]**.
- **Mandatory display in England:** no confirmation found that legislation has been laid. FSA has long supported it, and its status in Oct 2026 is unknown **[unverified]**.
- **Scotland FHIS** (Pass / Improvement Required): not fetched **[unverified]**.

---

## Q3. EHO inspection frequency and the FSA delivery models

### Takeaway
Under the Food Law Code of Practice, hygiene risk categories run A–E, with A and B (and C) higher risk. A new **Food Standards Delivery Model** has been statutory for local authorities in England since 1 April 2025, with rollout continuing in England, Wales and NI. The hygiene model is also being reformed, which will change how intervention frequency is set.

### Cited Findings
- Food hygiene categories run A, B and C (higher risk) and D and E (lower risk). Food standards uses risk ratings A–C — [search summary, FSA/IoW LA report](https://iow.moderngov.co.uk/documents/s23474/Report.pdf)
- Delivering against the Food Standards Delivery Model became a statutory requirement for local authorities from 1 April 2025. As of May 2025, 20 of 154 local authorities had fully transitioned, 73 were working to it pending IT updates, and 61 were at various stages — [FSA Annual Local Authority Performance FSA 25/09/04](https://www.gov.uk/government/publications/fsa-250904-annual-local-authority-performance/fsa-250904-annual-local-authority-performance); [FSA Performance management framework for FSDM](https://www.gov.uk/government/publications/fsa-bc-251205-performance-management-framework-for-food-standards-delivery-model/performance-management-framework-for-food-standards-delivery-model)

### Gaps
- **Intervention frequencies by category:** the traditional Code of Practice figures are A at least every 6 months, B every 12 months, C every 18 months, D every 24 months, and E at least every 3 years via an alternative enforcement strategy. These are from memory and may change under the new hygiene delivery model **[unverified]**.
- **Achieving Business Compliance programme status in Oct 2026:** not researched this pass **[unverified]**.

---

## Q4. Health and safety, and premises duties, with records to keep

### Takeaway
Most H&S record duties are long-standing law, but this session could not re-verify each one against a primary source. The app should still model all of them as recurring tasks with evidence attachments.

### Cited Findings
- No new primary-source fetches for this block this session.

### Inferences / requirements from statute and guidance, all **[unverified]**, to confirm on legislation.gov.uk and hse.gov.uk
- **Fire safety** (Regulatory Reform (Fire Safety) Order 2005, England and Wales):
  - The fire risk assessment must be recorded where there are 5 or more employees, a licence, or an alterations notice.
  - Since 1 Oct 2023 (Building Safety Act 2022 s156), all responsible persons must record the full fire risk assessment and fire safety arrangements, record the identity of anyone engaged to do or review the assessment, and share fire safety information with other responsible persons and residents.
  - Scotland: Fire (Scotland) Act 2005. NI: Fire and Rescue Services (NI) Order 2006 / Fire Safety Regs (NI) 2010.
  - Fire alarm: weekly user test of a different call point (BS 5839-1). Emergency lighting: monthly functional test and annual full-duration test (BS 5266-1). Record both in a log book.
- **Gas safety** (Gas Safety (Installation and Use) Regulations 1998, reg 35):
  - Employers must maintain gas appliances in a safe condition. An annual inspection by a Gas Safe engineer is the norm.
  - Commercial catering certificate per IGEM/BPEC practice, often called CP42.
  - BS 6173: interlock between ventilation and the gas supply in commercial kitchens.
- **Kitchen extraction:** BESA TR19 Grease sets cleaning frequency by usage. Typical bands: heavy use (12–16 hrs/day) quarterly, moderate (6–12 hrs) 6-monthly, light (2–6 hrs) annually. Insurers often require a TR19 certificate.
- **Electrical** (Electricity at Work Regulations 1989): no fixed statutory interval. BS 7671/IET guidance gives EICR every 5 years for commercial premises. PAT is risk-based (IET Code of Practice), not annual by law. In England, the 5-year EICR is statutory only for private rented housing.
- **LOLER 1998:** thorough examination every 6 months for lifting equipment used to lift people, otherwise every 12 months. A dumbwaiter or goods lift carrying goods only is every 12 months unless the examination scheme says otherwise. "6-monthly for dumbwaiters" is therefore likely wrong unless people ride in it.
- **PSSR 2000:** a written scheme of examination is needed for pressure systems. Espresso machine boilers with a pressure-volume product above 250 bar·litres fall in scope.
- **Legionella** (HSE ACOP L8, HSG274): risk assessment and records of monitoring, e.g. monthly sentinel tap temperatures. Records kept 5 years.
- **COSHH 2002:** assessments for chemicals, and keeping the safety data sheets.
- **First aid:** Health and Safety (First-Aid) Regulations 1981, needs assessment.
- **Accidents:** accident book, with retention as personal data under GDPR. RIDDOR 2013 records are kept 3 years. Over-7-day injuries must be reported within 15 days.
- **Pest control:** contract and visit reports. Physical condition is assessed under FHRS.
- **Waste transfer notes** (Environmental Protection Act 1990 s34 Duty of Care): keep 2 years. Hazardous waste consignment notes: 3 years.
- **Licensing Act 2003** (England and Wales):
  - A Designated Premises Supervisor (DPS) is needed where alcohol is sold under a premises licence.
  - Mandatory conditions require an age verification policy (minimum ID check for under-18s).
  - Challenge 21/25 and a refusals log are typical licence conditions or best practice.
  - Scotland: Licensing (Scotland) Act 2005 with Challenge 25 mandatory. NI: Licensing (NI) Order 1996.

### Gaps
- None of the H&S items above were re-fetched this session. A follow-up pass on hse.gov.uk, legislation.gov.uk and BESA is required before release.

---

## Q5. Martyn's Law (Terrorism (Protection of Premises) Act 2025)

### Takeaway
Royal Assent was given on 3 April 2025 and enforcement by the SIA is expected from spring 2027, after an implementation period of at least 24 months. The tiers are Standard (200–799 people) and Enhanced (800+). Most restaurants fall below 200 and are out of scope, but large venues must notify the SIA and have documented public protection procedures.

### Cited Findings
- Royal Assent 3 April 2025. Implementation period of at least 24 months. The SIA is the regulator. Published guidance includes statutory guidance (25 Aug 2026), notification requirement guidance (14 Jul 2026) and "principal use of premises" guidance (10 Sep 2026) — [GOV.UK – Terrorism (Protection of Premises) Act 2025 collection](https://www.gov.uk/government/collections/terrorism-protection-of-premises-act-2025)
- **Standard tier** (200–799): public protection procedures covering evacuation, invacuation, lockdown and communication; coordination with other premises; notification to the SIA — [Foot Anstey (secondary, law firm)](https://www.footanstey.com/our-insights/articles-news/martyns-law-an-update-following-final-statutory-guidance/)
- **Enhanced tier** (800+): public protection measures (monitoring, movement, physical safety, security), a documented security plan and compliance statement, and a designated senior individual — [Foot Anstey](https://www.footanstey.com/our-insights/articles-news/martyns-law-an-update-following-final-statutory-guidance/)
- **Capacity** includes staff and is based on a "reasonable expectation" of the number of people present — [Foot Anstey](https://www.footanstey.com/our-insights/articles-news/martyns-law-an-update-following-final-statutory-guidance/)
- **Penalties:** Standard tier up to £10,000 fixed plus £500 per day. Enhanced tier up to £18m or 5% of worldwide revenue, plus £50,000 per day — [search summary of Foot Anstey / Keoghs](https://keoghs.co.uk/keoghs-insight/martyns-law-government-guidance-published)
- **Date conflict:** Foot Anstey says the final s27 statutory guidance was published on 15 April 2026. The gov.uk collection lists statutory guidance dated 25 Aug 2026, which is probably an updated version — [GOV.UK](https://www.gov.uk/government/collections/terrorism-protection-of-premises-act-2025); [Foot Anstey](https://www.footanstey.com/our-insights/articles-news/martyns-law-an-update-following-final-statutory-guidance/)

### Inferences
- The app should hold a capacity figure for each site. Where it is 200 or more, it should prompt for SIA notification, procedures, staff briefing records and periodic review.

### Gaps
- An exact commencement date set by regulations: not found; only "spring 2027 expected" **[unverified]**.
- Applies in England, Wales, Scotland and NI. UK-wide extent is from memory **[unverified]**.

---

## Q6. HR and staff handbook: employment law records

### Takeaway
Key changes in 2026–27 under the Employment Rights Act 2025:
- **April 2026:** SSP from day one, day-one paternity and parental leave, a 6-year holiday-record duty, and the Fair Work Agency.
- **October 2026:** tribunal time limits extended to 6 months (1 Oct), and the duty to take "all" reasonable steps against sexual harassment plus third-party harassment liability (30 Oct).
- **January 2027:** 6-month unfair dismissal qualifying period.
- **2027:** zero-hours guaranteed hours.

Tipping law has been in force since 1 Oct 2024.

### Cited Findings
- **April 2026:** SSP payable from day one with the lower earnings limit removed; day-one paternity and parental leave; an obligation to keep holiday pay records for six years; Fair Work Agency established 7 April 2026 — [Lewis Silkin (25 Sep 2026)](https://www.lewissilkin.com/insights/2026/09/25/whats-in-the-employment-rights-act)
- **October 2026:**
  - employment tribunal claim time limits rise from 3 to 6 months for acts on or after 1 Oct 2026 — [Blake Morgan](https://www.blakemorgan.co.uk/employment-rights-act-2025-october-2026-implementation-dates-confirmed/)
  - from 30 Oct 2026, employers must take "all reasonable steps" to prevent sexual harassment, and liability for third-party harassment is introduced — [Blake Morgan](https://www.blakemorgan.co.uk/employment-rights-act-2025-october-2026-implementation-dates-confirmed/); [Lewis Silkin](https://www.lewissilkin.com/insights/2026/09/25/whats-in-the-employment-rights-act)
  - union access rights and a written statement of the right to join a union — [Blake Morgan](https://www.blakemorgan.co.uk/employment-rights-act-2025-october-2026-implementation-dates-confirmed/)
- **Source conflict on the union notification duty:** Blake Morgan lists it under October 2026; Lewis Silkin puts it in January 2027.
- **Tipping:** the ERA 2025 adds a duty to consult workers on tipping policy. Lewis Silkin reports the draft Code is under review and implementation was delayed to the end of 2026 — [Lewis Silkin](https://www.lewissilkin.com/insights/2026/09/25/whats-in-the-employment-rights-act)
- **January 2027:** unfair dismissal qualifying period reduced to 6 months; compensation caps removed; fire-and-rehire restrictions — [Lewis Silkin](https://www.lewissilkin.com/insights/2026/09/25/whats-in-the-employment-rights-act)
- **2027:** guaranteed hours for zero-hours workers, shift notice and compensation, flexible working reasonableness test, bereavement leave (April 2027) — [Lewis Silkin](https://www.lewissilkin.com/insights/2026/09/25/whats-in-the-employment-rights-act)
- **Employment (Allocation of Tips) Act 2023:** s1 inserts the new Part 2B into the ERA 1996. In force for some purposes 31 July 2023 (SI 2023/876) and fully 1 October 2024 (SI 2024/829) — [legislation.gov.uk – 2023 c.13 s1](https://www.legislation.gov.uk/ukpga/2023/13/section/1)

### Long-standing law not re-fetched this session (all **[unverified]**)
- **Tipping:** a written tipping policy must be available to workers. Records of tip allocation must be kept for 3 years. Workers can request their records.
- **Written statement of particulars:** due on or before day one (ERA 1996 s1, since April 2020).
- **Right to work:** checks before employment (Immigration, Asylum and Nationality Act 2006). The civil penalty is up to £45,000 per illegal worker for a first breach and £60,000 for repeat breaches (since 13 Feb 2024). Keep copies for the duration of employment plus 2 years.
- **National minimum wage:** records kept 6 years (NMW Regs 2015, as amended in 2021).
- **Working Time Regulations 1998:** records kept 2 years for the 48-hour limit, opt-outs and night work.
- **Pensions auto-enrolment:** records kept 6 years; opt-out notices 4 years.
- **Worker protection duty:** the duty to take reasonable steps to prevent sexual harassment (Worker Protection (Amendment of Equality Act 2010) Act 2023) has been in force since 26 Oct 2024. It allows a tribunal compensation uplift of up to 25%, and the EHRC can enforce it.
- **Primary-source check:** the gov.uk ERA roadmap URL tried returned a 404, so the dates above rely on law-firm summaries citing the government roadmap.

### Inferences
- The app's HR module needs retention timers:
  - tips: 3 years
  - NMW: 6 years
  - holiday: 6 years, new
  - Working Time Regulations: 2 years
  - right to work: employment plus 2 years
  - pensions: 6 years
- It also needs a sexual-harassment risk assessment and policy record, with third-party (customer) harassment in scope from 30 Oct 2026.

### Gaps
- A primary gov.uk roadmap page for the ERA 2025 was not retrieved (404). The dates are from two reputable law firms that agree on the main points.
- Scotland and Wales: employment law is reserved, so it is the same across Great Britain. NI has its own employment legislation and the ERA 2025 largely does not extend there **[unverified]**.
