# Food Safety & Workplace Compliance Requirements for a Restaurant Operations App (US, UK, brief international)

Research date: 2026-10-06. About 17 tool calls. Items marked **[background, unverified this session]** come from the researcher's prior knowledge and were not confirmed against a source during this session. Report writer: present these as "verify" items, not as established fact.

## US food safety: FDA Food Code, FSMA 204, allergens, electronic records

### Takeaway
The FDA Food Code (2022 edition plus the Supplement of Nov 2024) is a model code. It only binds a restaurant once its state or locality adopts it, and many places still run older editions. The core logging requirements are temperature control (cold ≤41°F, hot ≥135°F, two-stage cooling) and 7-day date marking. FSMA 204 traceability record-keeping for restaurants will not be enforced before **20 July 2028**.

### Cited Findings
- The current model code is the 2022 Food Code. The FDA published a **Supplement to the 2022 Food Code on 4 Nov 2024**, based on recommendations from the 2023 Conference for Food Protection, with editorial corrections in Dec 2024 — [FDA](https://www.fda.gov/food/hfp-constituent-updates/fda-releases-supplement-2022-food-code); [FDA Food Code 2022](https://www.fda.gov/food/fda-food-code/food-code-2022)
- The Supplement changes the following:
  - new provisions on **disinfection** of food-contact, nonfood-contact and equipment surfaces
  - expanded rules on **refilling and reuse of containers**
  - **food defense** awareness provisions
  - definitions of **Food Safety Management System and Active Managerial Control**, plus new provisions on *when an FSMS is required*
  - updated reinstatement testing (culture-independent diagnostic tests) for employees diagnosed with STEC, Shigella or nontyphoidal Salmonella
  - a dedicated Annex 6 section on **sushi rice acidification**

  — [FDA](https://www.fda.gov/food/hfp-constituent-updates/fda-releases-supplement-2022-food-code)
- The danger zone is 41°F–135°F. Cooked TCS food must cool **135°F→70°F within 2 h, then 70°F→41°F within a further 4 h** — [LegalClarity summary of Food Code](https://legalclarity.org/fda-food-code-what-it-covers-and-how-it-works/); [ICN cooling fact sheet](https://theicn.org/resources/521/food-safety-fact-sheets/107110/cooling-foods.pdf)
- **Date marking:** ready-to-eat TCS food held refrigerated for more than 24 h must be date marked and kept no longer than **7 days at ≤41°F**, with the day of preparation counted as day 1 — [CDC date marking](https://cdc.gov/restaurant-food-safety/php/practices/date-marking.html); [Chesprocott HD](https://www.chesprocott.org/wp-content/uploads/2023/05/Date-Marking.pdf)
- **FSMA 204 (Food Traceability Rule):**
  - The rule took effect 21 Nov 2022, with an original compliance date of 20 Jan 2026.
  - The FDA proposed a 30-month extension on 7 Aug 2025.
  - In Nov 2025 a continuing-appropriations act directed the FDA not to enforce the rule before **20 July 2028**.

  — [Beancount summary](https://beancount.io/blog/2026/07/20/fsma-204-food-traceability-rule-deadline-extension-guide); [CSP Daily News](https://cspdailynews.com/foodservice/food-traceability-rule-delayed-until-2028). The National Restaurant Association supported the extension — [NRA comments](https://restaurant.org/getmedia/62158663-726b-4a86-bd97-edaec71f9d1d/National_Restaurant_Association_Traceability_Comments_9_8_25.pdf)
- FSMA 204 applies to restaurants and retail food establishments, with some exemptions:
  - Records must be given to the FDA as an **electronic sortable spreadsheet** unless the firm is partially exempt.
  - Small RFEs/restaurants (e.g. fewer than 10 FTEs) are exempt or partially exempt from the spreadsheet requirement.
  - Food bought directly from a farm, or ad hoc from another RFE/restaurant, has further exemptions.

  — [FDA presentation](https://fda.gov/media/163838/download); [UF IFAS FS455](https://ask.ifas.ufl.edu/publication/FS455)
- The **FASTER Act** made **sesame the 9th major food allergen effective 1 Jan 2023**. The full US "Big 9" list is milk, eggs, fish, crustacean shellfish, tree nuts, peanuts, wheat, soybeans and sesame (the list is background knowledge) — [Fox13 / FDA guidance report](https://www.fox13news.com/news/sesame-to-become-9th-major-food-allergen-on-jan-1-fda-says)

### Inferences
- **Records the app should support**, each with timestamp, user, location/unit, value, pass/fail against threshold, and corrective action when failed:
  - cold-holding and hot-holding temperature checks
  - cooking end-point temperatures
  - **two-stage cooling logs**: start time/temp, 2-h checkpoint ≤70°F, 6-h checkpoint ≤41°F
  - date-mark labels and discard dates (day 1 = prep day, discard after day 7)
  - receiving temperatures
  - employee illness reporting / exclusion / reinstatement
- The thresholds and editions differ by jurisdiction, so the app needs a **per-jurisdiction rules profile**: temperature unit, cold-holding limit (some states still use 45°F or older editions), and date-marking days. Do not hard-code them.
- The 2024 Supplement's FSMS/Active Managerial Control definitions directly support positioning a digital checklist and verification tool as the operator's "FSMS".
- Build FSMA 204 readiness now as a low-priority roadmap item (receiving KDE capture for Food Traceability List items, plus sortable spreadsheet export), because enforcement starts in July 2028.

### Gaps
- **FDA Food Code adoption table:** the FDA page URL returned 404, so per-state edition counts were not verified. [background, unverified] Most states have adopted 2013/2017/2022 editions with local amendments. A few (e.g. California's CalCode, New York City's Health Code) use their own codes.
- **Food Code provisions not fetched this session** [background, unverified]:
  - Cooking temperatures: poultry 165°F <1 s; ground meats 155°F 17 s; whole-muscle meat/fish/eggs for immediate service 145°F 15 s; reheating for hot holding 165°F within 2 h.
  - Person in Charge present at all times, able to demonstrate knowledge (§2-101.11, §2-102.11).
  - At least one employee with supervisory authority is a **Certified Food Protection Manager** (§2-102.12; ANAB-accredited exam such as ServSafe; typically renewed every 5 years).
  - Employee health reporting of the "Big 6" pathogens and symptoms (§2-201.11). Since 2017, a written procedure for vomiting/diarrheal events (§2-501.11).
  - Variance and **HACCP plan** required for specialized processes (§3-502.11/3-502.12: smoking, curing, ROP/sous vide, acidifying such as sushi rice, live shellfish tanks, custom processing).
  - Time as a Public Health Control (4 h without temperature control, or 6 h cold ≤70°F) requires written procedures.
  - Consumer advisory for raw/undercooked food.
  - **Allergen awareness** duty of the PIC, and since the 2017 Food Code, a major-allergen notification to consumers via written means.
- **FSMA 204 restaurant specifics** [background, unverified]:
  - Restaurants are "receivers" of Food Traceability List foods (leafy greens, fresh-cut produce, shell eggs, finfish, crustaceans, soft cheeses, etc.).
  - They must record receiving KDEs, including the traceability lot code and its source.
  - Records are kept **2 years** and must be produced within **24 hours** of an FDA request.
  - The full exemption covers RFEs with average annual food sales ≤$250k.
  - Verify these against [FDA FTL rule page](https://www.fda.gov/food/food-safety-modernization-act-fsma/fsma-final-rule-requirements-additional-traceability-records-certain-foods).
- **21 CFR Part 11:** no source fetched. [background, unverified] Part 11 applies to records that FDA predicate rules require. Restaurant inspections run under state/local codes, so Part 11 does not apply to routine restaurant logs. FSMA 204 records explicitly do not need Part 11 compliance (21 CFR 1.1455 allows electronic records and excludes Part 11). Local inspectors generally accept electronic logs if they can be viewed on site.
- **Inspector focus:** no direct source found on what US inspectors look for. [background] Inspection forms emphasise "priority" items (risk factors: holding temps, cooling, handwashing, bare-hand contact, employee health, CFPM present) and require logs only where the code mandates them (e.g. cooling under some local codes, TPHC, HACCP/variance logs).

## UK food safety: law, SFBB/CookSafe, FHRS, temperature, allergens, digital records

### Takeaway
UK law (retained Reg 852/2004 Article 5) requires a documented HACCP-based procedure, with records "commensurate with the nature and size" of the business. SFBB (England/Wales) and CookSafe (Scotland) are the accepted small-business route, and **SFBB explicitly allows electronic diaries**. FHRS's "confidence in management" element is where documented systems and records drive the score.

### Cited Findings
- Reg (EC) 852/2004 Art 5 (retained in UK law) requires FBOs to "put in place, implement and maintain a permanent procedure or procedures based on the HACCP principles". One principle is establishing documents and records "commensurate with the nature and size of the food business" — [legislation.gov.uk Art 5](https://www.legislation.gov.uk/eur/2004/852/article/5/data.htm?view=plain); [FSA Food Law Practice Guidance ch 4.2](https://www.food.gov.uk/sites/default/files/media/document/chapter-4.2-haccp-based-procedures_5.pdf)
- Small businesses such as restaurants and pubs may use simplified documentation, provided it achieves Art 5's objectives — [IHK Hamburg](https://www.ihk.de/hamburg/en/produktmarken/startup/point-single-contact/sector-specific-information/haccp-self-inspection-1168678); [York CC HACCP factsheet](https://www.york.gov.uk/downloads/file/657/haccp-factsheet-for-businesses)
- **The SFBB pack:**
  - covers six areas: cross-contamination, cleaning, chilling, cooking, management, and using the diary
  - applies to England and Wales and is aimed at small businesses
  - diary pages must be completed and stored "until your next visit from a local authority food safety officer"
  - **businesses may keep an electronic diary**, filling in pages on a device and storing them electronically

  — [GOV.UK SFBB](https://www.gov.uk/government/publications/safer-food-better-business-sfbb/safer-food-better-business-sfbb)
- **FHRS:**
  - Three elements are assessed: food handling (preparation, cooking, reheating, cooling, storage); premises (cleanliness, layout, lighting, ventilation, pest control); and **management systems**, i.e. processes, training and systems that give confidence standards will be maintained.
  - Ratings run from 0 (urgent improvement necessary) to 5 (very good).
  - Display is **mandatory in Wales and Northern Ireland**, at or near each customer entrance, and voluntary in England.
  - Appeal window is 21 days. Right to reply has no deadline. Re-rating requests are available (fee in Wales/NI and some English LAs).

  — [GOV.UK FHRS guidance for businesses](https://www.gov.uk/government/publications/food-hygiene-rating-scheme-fhrs-guidance-for-businesses/food-hygiene-rating-scheme-fhrs-guidance-for-businesses)
- **Temperature, Food Hygiene (England) Regs 2013 Sch 4:**
  - Keeping food that supports pathogen growth **above 8°C** is an offence.
  - Holding hot food for service **below 63°C** is an offence.
  - There is a defence for chilled food on display for service for **<4 h** if it was not previously above 8°C.
  - These rules are unchanged from the 1995 Temperature Control Regs. Wales has equivalent 2006 regs.

  — [legislation.gov.uk SI 2013/2996 Sch 4](https://legislation.gov.uk/uksi/2013/2996/schedule/4); [Wales SI 2006/31 Sch 4](https://www.legislation.gov.uk/wsi/2006/31/schedule/4)
- **Allergens:**
  - On **5 Mar 2025** the FSA published updated best-practice guidance for the out-of-home sector (restaurants, cafes, takeaways, online sales of non-prepacked food). It says **written allergen information should always be available** for non-prepacked food, alongside a conversation between server and customer.
  - The guidance applies in England, Wales and NI, covers the 14 allergens, and the FSA offers an allergen matrix template.

  — [FSA news](https://www.food.gov.uk/news-alerts/news/updated-industry-guidance-issued-for-food-allergen-information-in-the-out-of-home-sector); [NI Business Info](https://www.nibusinessinfo.co.uk/content/updated-allergen-guidance-food-businesses)

### Inferences
- **Minimum UK record set the app should cover:**
  - opening and closing checks
  - fridge/freezer temperatures (twice daily is common practice)
  - hot-holding checks (≥63°C), with a 2-h tolerance per the regs (background)
  - cooking/reheat probe checks
  - cooling records
  - cleaning schedule sign-off
  - delivery checks
  - staff training records
  - supplier list
  - "problems/changes" diary entries with corrective actions
  - a **4-weekly review**
  - a 14-allergen matrix per dish, with recipe-change versioning
- FHRS "confidence in management" rewards visible, consistent, reviewed records. The app should make the 4-weekly review and corrective-action closure easy to evidence on inspection: an exportable or printable view, plus an "inspector mode".
- The FSA's 2025 written-allergen guidance makes a **per-dish allergen matrix and menu-change audit trail** a core feature for UK restaurants. It is currently best practice, not law, for non-prepacked food.

### Gaps
- **Natasha's Law** [background, unverified]: in force since **1 Oct 2021** (England, Wales, NI; Scotland equivalent). Prepacked for direct sale (PPDS) food must carry name plus full ingredients list with the 14 allergens emphasised. The FSA allergen labelling page URL returned 404 this session.
- **The 14 UK allergens** [background, unverified]: celery, cereals containing gluten, crustaceans, eggs, fish, lupin, milk, molluscs, mustard, tree nuts, peanuts, sesame, soya, sulphur dioxide/sulphites (>10 mg/kg or 10 mg/L).
- **SFBB PDF content** was not retrieved [background]:
  - opening/closing checklists
  - daily diary sign-off
  - **4-weekly review**: records problems, changes to menu/suppliers/staff, and a sign-off
  - staff training record, supplier list, cleaning schedule
  - prove-it probe checks: cooking to 75°C core is the common SFBB check, though 70°C for 2 min equivalents are accepted
- **Food Standards Scotland CookSafe** was not fetched [background]: Scotland's HACCP-based manual, with house rules, HACCP sections and daily/weekly record sheets. The Scottish FHIS is a Pass/Improvement Required scheme, not 0–5.
- **Food handler training** levels (Level 2 for food handlers, Level 3 for supervisors) are not legally mandated by specific level. Reg 852/2004 Annex II Ch XII requires training "commensurate with work activity". Not verified this session.
- **EHO acceptance of third-party digital apps:** beyond the SFBB statement, no FSA statement was found. [background] EHOs generally accept electronic records that are complete, contemporaneous and retrievable during the visit.

## Health & safety and maintenance records (OSHA US; HSE/fire/gas UK)

### Takeaway
US restaurants are **partially exempt** from routine OSHA 300 injury logs but must still report severe injuries. In the UK, the core record set is fire risk assessment, gas safety (CP42), extraction cleaning (TR19), electrical/PAT, legionella, accident book/RIDDOR and COSHH. Each has a recurring inspection cadence and certificate retention that suits a maintenance-scheduler feature.

### Cited Findings
- **OSHA 300 logs:**
  - Restaurants (NAICS 7225; previously 7221/7222) are on OSHA's partially exempt industries list. They need not keep 300/300A/301 records unless asked in writing by OSHA/BLS.
  - **All employers must still report a fatality, in-patient hospitalization, amputation or loss of an eye.**

  — [OSHA 29 CFR 1904 Subpart B App A](https://www.osha.gov/laws-regs/regulations/standardnumber/1904/1904SubpartBAppA); [OSHA FAQ](https://osha.gov/faq/2-3)
- **Fire safety, UK:** the Regulatory Reform (Fire Safety) Order 2005 requires a fire risk assessment. Since **Oct 2023** (Building Safety Act s156 changes), every business must **record the fire risk assessment in writing regardless of headcount** — [Pilla blog](https://yourpilla.com/blog/fire-risk-assessment-hospitality) (secondary source; consistent with the GOV.UK change)
- **Gas, UK:** commercial catering gas appliances must be serviced and checked regularly, normally annually, by a **Gas Safe registered** engineer, who issues a gas safety record (**CP42** for commercial catering) — [Hillingdon Council](https://www.hillingdon.gov.uk/gas-safety); [Highland Council](https://www.highland.gov.uk/news/article/4669/inverness_catering_businesses_urged_to_improve_safety_of_gas_appliances)
- **Extraction ductwork:** cleaning to **TR19 Grease** (BESA) is the industry standard. Grease build-up is a recognised fire risk — [5mins.ai](https://www.5mins.ai/resources/blog/restaurant-hotel-health-safety-compliance-uk) (secondary)
- **Legionella:** HSE ACoP L8 recommends **5 years** retention for monitoring records. Employers with **5+ employees** must record significant findings of the risk assessment — [BrodexTrident](https://www.brodextrident.com/blog/is-your-legionella-record-keeping-compliant) (secondary)
- **Accident records:** RIDDOR records must be kept at least **3 years** — [Assurity Consulting](https://www.assurityconsulting.co.uk/knowledge/insights/record-keeping-retention-where-to-draw-the-line) (secondary)

### Inferences
- The app needs a **"certificates & contractor visits" module**. Each record holds type, contractor/registration number (e.g. Gas Safe ID), visit date, next-due date, outcome, attached certificate PDF, and remedial actions. Reminders should be driven by cadence.
- Typical cadences [background, unverified]:
  - gas CP42: 12 months
  - TR19 duct clean: 3/6/12 months by cooking volume
  - pest control: ~6–8 visits/yr contract
  - fire alarm: weekly test plus 6-monthly service
  - emergency lighting: monthly flick test plus annual 3-h test
  - extinguishers: annual service
  - fixed wiring EICR: 5 years
  - PAT: risk-based
  - LOLER: 6/12-monthly for lifts/hoists
  - legionella: monthly temperature checks
- For US OSHA, store an incident log anyway, both for workers' comp and for severe-injury reporting. Prompt users with OSHA's reporting windows: 8 h for a fatality, 24 h for hospitalization/amputation/eye loss [background, unverified].

### Gaps
- No HSE primary pages were fetched for COSHH, first aid (needs assessment and a first-aid box), PAT (no fixed legal frequency; Electricity at Work Regs 1989 "maintain") or LOLER (thorough examination every 6 months for people-lifting equipment, 12 months otherwise). All are background and unverified.
- **RIDDOR:** [background] the over-7-day injury reporting deadline is 15 days. The accident book (BI 510) is required for employers with 10+ employees under the Social Security (Claims and Payments) Regs. Not verified.
- **US non-OSHA items:** no sources fetched. These include NFPA 96 (hood cleaning frequency by cooking volume), NFPA 10 (extinguisher monthly visual / annual), local fire marshal rules, and OSHA Hazard Communication (SDS binder, training).

## Employment / handbook policies and acknowledgements

### Takeaway
US mandatory harassment-prevention training is state-driven, with the heaviest requirements in CA, NY, IL, CT, DE and ME. **Illinois requires restaurant/bar-specific training in English and Spanish.** The UK Employment Rights Act 2025 phases in through 2026–27, including a 6-year holiday record-keeping duty already in force since April 2026 and a harassment-prevention duty from 30 Oct 2026.

### Cited Findings
- **California:** employers with 5+ employees must train all staff every 2 years, within 6 months of hire or promotion (seasonal/temp staff within 30 days or 100 hours). Supervisors get 2 h, other staff 1 h — [ASE](https://www.aseonline.org/News-Events/Articles/what-states-and-jurisdictions-require-harassment-training-for-employees); [Vubiz](https://vubiz.com/breakdown-of-us-harassment-training-requirements-by-state)
- **New York:** all employers must provide **annual interactive** training — same sources.
- **Illinois:** all employers must provide annual training. **Restaurants and bars must provide industry-specific training in English and Spanish** — same sources.
- **Connecticut:** employers with 3+ employees must train within 6 months, with supplemental training every 10 years.
- **Delaware:** employers with 50+ employees must train within 1 year, and supervisors every 2 years.
- **Maine:** employers with 15+ employees must train within 1 year of hire.
  — same sources.
- **UK Employment Rights Act 2025:**
  - **18 Dec 2025:** Royal Assent.
  - **6 Apr 2026:**
    - SSP payable from the first day of sickness, with the lower earnings limit removed
    - day-1 paternity and unpaid parental leave
    - **employers must keep records demonstrating annual leave/holiday pay compliance for 6 years**
  - **7 Apr 2026:** Fair Work Agency established.
  - **1 Oct 2026:** tribunal time limit rises from 3 to 6 months.
  - **30 Oct 2026:** duty to take "all reasonable steps" to prevent sexual harassment, plus third-party harassment protection.
  - **2027, dates to be confirmed:**
    - zero/low-hours guaranteed hours offers, reasonable shift notice and cancellation payments (highly relevant to hospitality rota features)
    - fire-and-rehire restrictions
    - flexible working consultation
    - gender equality and menopause action plans

  — [VinciWorks timeline (updated July 2026)](https://vinciworks.com/blog/employment-rights-act-timeline/)
- **Unfair dismissal qualifying period:** reported as cut from 2 years to **6 months from 1 Jan 2027**, with the compensation cap removed — [VinciWorks search summary](https://vinciworks.com/blog/employment-rights-act-2025-implementation-timeline-updated-july-2026/); [Cambridge Network](https://www.cambridgenetwork.co.uk/news/employment-rights-act-2025-new-implementation-timeline-published). Note: the VinciWorks page fetched in full did not list this item, so confirm on GOV.UK.

### Inferences
- **US product needs:**
  - a state-aware training-assignment engine (who, by when, how long, which language)
  - certificate storage
  - e-signed acknowledgements of the handbook, at-will statement, harassment policy, employee illness reporting policy (Food Code Form 1-B style) and allergen policy
- **UK product needs:**
  - a holiday/leave ledger retained 6 years
  - rota features ready for 2027 shift-notice and cancellation-payment rules (timestamp when shifts are published, changed or cancelled)
  - harassment-prevention evidence before 30 Oct 2026: policy acknowledgement, training records, risk assessment covering customers (third-party harassment)
  - right-to-work check records
  - day-1 written statement of particulars

### Gaps
- **UK right-to-work checks** were not fetched [background, unverified]. Checks happen before employment starts, by manual document check, IDSP or the Home Office online share code. Copies are kept for the duration of employment plus 2 years. The civil penalty is up to £60,000 per illegal worker (since Feb 2024).
- **Written statement of particulars** [background]: required by day 1 of employment under ERA 1996 s1 (since Apr 2020).
- **UK payroll/working-time record retention** [background]: payroll/PAYE 3 years after tax year end (HMRC); minimum wage records 6 years (since 2021); working time 48-hour records 2 years.
- **US** [background, unverified]: the at-will statement is customary, not mandated. Federal I-9 retention is the later of 3 years from hire or 1 year after termination. FLSA payroll records 3 years, timecards 2 years. Tip credit notice rules exist. Many states require food handler cards: CA (within 30 days, valid 3 years), IL, TX, WA, OR and others.
- **Fair Work Agency and Employment Rights Act** dates beyond July 2026 rely on one secondary source (VinciWorks). Confirm on gov.uk's "Employment Rights Act implementation roadmap".

## Brief notes: EU, Australia, Canada, Philippines

### Takeaway
None of these jurisdictions was researched with sources this session (tool-budget limit). Everything below is **[background, unverified]** and should be checked or flagged by the report writer.

### Cited Findings
- EU: Reg 852/2004 Art 5 HACCP with proportionate documentation for small businesses. The same text underlies UK retained law — [legislation.gov.uk Art 5](https://www.legislation.gov.uk/eur/2004/852/article/5/data.htm?view=plain); [WKO EU guidance on HACCP flexibility](https://www.wko.at/oe/handel/agrarhandel/guidancehaccp.pdf)

### Inferences
- **EU** [background]:
  - EU FIC Reg 1169/2011 requires the same 14 allergens to be declared for non-prepacked food, with national implementation rules.
  - Commission Reg 2021/382 amended 852/2004 to require **food safety culture**, allergen management and a redistribution/donation hierarchy. This favours apps that evidence training and culture.
  - Temperature limits are set nationally, not by the EU.
- **Australia** [background]:
  - FSANZ Food Standards Code Standard 3.2.2A, in force **8 Dec 2023**, applies to category 1 and 2 businesses (restaurants are category 1).
  - It requires a certified **Food Safety Supervisor** (recertified every 5 years) and food handler training.
  - Category 1 businesses must keep **records** (or demonstrate equivalence) for temperature control, cooling and reheating, sanitising, and the 2-hour/4-hour rule. Records are kept 3 months.
  - Limits are cold ≤5°C and hot ≥60°C.
- **Canada** [background]:
  - Provincial/municipal food premises regulations apply (e.g. Ontario O. Reg 493/17, BC Food Premises Regulation which requires a written food safety plan and sanitation plan).
  - Federal SFCR applies mainly to importers and processors.
  - Limits are cold ≤4°C and hot ≥60°C.
  - Food handler certification is required in Ontario, BC and others.
- **Philippines** [background]:
  - RA 10611 (Food Safety Act of 2013).
  - PD 856 Code on Sanitation, Chapter III, requires sanitary permits and **health certificates** for food handlers, renewed annually.
  - LGU (city/municipal) sanitary inspection.
  - FDA Philippines covers processed food.
  - DOLE OSH Law RA 11058 (2018) requires a safety officer and OSH program.

### Gaps
- None of the international items above were verified with a fetched source. Priority checks:
  - FSANZ Standard 3.2.2A record requirements and retention
  - EU 2021/382 food safety culture
  - Canadian provincial temperature limits
  - Philippine health certificate renewal frequency
