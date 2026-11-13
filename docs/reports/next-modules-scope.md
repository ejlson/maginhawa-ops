# Next modules: scope

*Draft, 13 Nov 2026. Not agreed with the client yet. All figures are examples.*

**Status, 13 Nov 2026: first version built in demo mode** (data on the device). Rules and tests: `packages/core/src/ordering.ts`, `recipes.ts`, `safety.ts` (safety and maintenance), `records.ts`. Store: `apps/eod-web/app/lib/ops*.ts`. Screens: `/stock/order`, `/stock/delivery/:id`, `/stock/waste`, `/stock/item/:id`, `/stock/count/:id/low`, `/recipes`, `/safety`, `/maintenance`, and for head office `/head-office/{ordering,menu,safety,maintenance,records}`. **Not done yet:**
- Connected mode (the SharePoint lists below).
- Emailing orders to suppliers.
- Storing certificate files (only the name is kept).
- Risk assessments, cleaning chemicals (COSHH), first aiders and fire drills.
- Transfers between sites.
- GP% per period.
- Staff and pay exports (they need payroll and rota connected).

This doc scopes four modules: **health and safety**, **planned maintenance**, **ordering and waste**, and **recipes and dish costing**. They follow the same rules as the rest of the app (HANDOFF.md §3):
- **Data and logic.** SharePoint lists hold the data, our own back end does the work, and the rules live in `packages/core` with tests.
- **Records.** Records are only ever added to, and a correction keeps the old value with who changed it and why.
- **Design.** Same design language: one main card per screen, then lists. Sites see their own records; head office sees every site.

> **Legal rules marked *(check)*** come from UK law or official guidance as we understand it. Before launch, confirm them with a health and safety consultant, your insurer or the fire risk assessor, as we're doing with the EHO for food safety.

---

## What's already there to build on

| Already built | Used by |
|---|---|
| **Checklists** (times, photos, fixes, locked records, corrections) | Health and safety checks. Needs one addition: **weekly, monthly and yearly** schedules (today a checklist runs every day at set times) |
| **Repairs** (report a fault, mark it fixed) | Maintenance. Faults get linked to a piece of equipment, and a visit can raise a repair |
| **Deliveries** (supplier, temperatures, batch codes, use-by dates) | Ordering. A delivery is checked against what was ordered, with prices |
| **Stock** (items, costs, areas, counts) | Ordering, waste and recipes all use the same item list and costs |
| **Allergens** (14 per dish, versions, read receipts) | Recipes. Each ingredient's allergens are checked against the dish's allergen record |
| **Records pack for an inspector** | Gains health and safety, fire and maintenance sections |

---

## 1 · Health and safety (not food)

**Why:** an employer must manage risks to staff and guests and be able to show it. A fire officer, an HSE or council inspector, or an insurer after a claim will ask for these records. Check65 has them and we don't.

| # | Feature | What it does | Who | Rules *(check)* |
|---|---|---|---|---|
| 1 | **Fire checks** | A weekly fire alarm test (which call point), a monthly emergency lighting flick test, a monthly look at the extinguishers, and fire doors and exits on the closing checklist. A failed check raises a repair | Supervisor and above | Regulatory Reform (Fire Safety) Order 2005. Weekly alarm test and monthly lighting test are standard practice (BS 5839-1, BS 5266-1) |
| 2 | **Fire drills and training** | Date, who took part, how long it took to clear the building, and what went wrong | Manager | Usually at least once a year, more often with high staff turnover |
| 3 | **Accident book** | Who, when, where, what happened, the injury, first aid given, witnesses, photos. Says whether it may need a **RIDDOR** report (see below) and logs the HSE reference. Personal details are shown to managers only | Anyone reports; manager completes | RIDDOR 2013: injuries that stop someone working normally for **more than 7 days** must be reported within **15 days**; a death or specified injury straight away. Accident records are kept at least **3 years** |
| 4 | **Risk assessments** | One per hazard (slips, knives, hot oil, manual handling, lone working, new or expectant mothers, young workers). Each has a review date, and staff confirm they've read it, like allergens | Manager writes; head office keeps the group versions | Management of Health and Safety at Work Regs 1999: written down when there are **5 or more** employees |
| 5 | **Cleaning chemicals (COSHH)** | The list of chemicals at each site, with the safety data sheet and a short "how to use it safely" card for each | Head office keeps the list; sites confirm what they use | COSHH 2002 |
| 6 | **First aid** | First aiders and their certificate expiry dates (warning 30 days before), plus a monthly check that the first aid kit is stocked | Manager | First-Aid Regs 1981 |

**Head office:** across all sites, see overdue checks, open RIDDOR reports, and risk assessments due for review.

---

## 2 · Planned maintenance

**Why:** some servicing is required by law or by your insurer, and missing it can close a kitchen. Repairs only covers things that are already broken; this covers what is due.

| # | Feature | What it does | Who |
|---|---|---|---|
| 1 | **Equipment list per site** | Fridges, freezers, ovens, fryers, the extraction system, the gas supply, the dishwasher, the ice machine, the fire alarm, extinguishers, the lift or dumb waiter. For each: make, model, serial number, photo, warranty and contractor | Head office sets it up; managers add and edit |
| 2 | **Service schedule** | What is due and how often, with reminders 30 and 7 days before. Anything overdue goes to head office | Head office |
| 3 | **Log a visit** | Date, contractor, what was done, and the certificate or report (photo or PDF, saved to the SharePoint library). A visit can raise a repair, and a repair can link back to the equipment | Manager |
| 4 | **Certificates** | The latest certificate for everything, per site, ready for an inspector or the insurer. Included in the records pack | Anyone can see; manager and head office upload |
| 5 | **Equipment history** | Every repair and visit on one piece of equipment. Shows when the same thing keeps breaking ("Walk-in compressor: 4 call-outs in 6 months") | Head office |

**Suggested schedule** *(check: your insurer's policy wording wins)*:

| Item | How often | Why |
|---|---|---|
| Gas appliances and pipework | Every 12 months | Gas Safety (Installation and Use) Regs 1998; usually an insurance condition (commercial catering, Gas Safe engineer) |
| Kitchen extraction and ductwork cleaning | 3, 6 or 12 months, by hours of use | TR19 Grease; insurers often make it a condition because of fire risk |
| Fixed electrics (EICR) | Every 5 years | Electricity at Work Regs 1989; IET guidance for commercial premises |
| Portable appliance testing | By risk, often every 12 months | Electricity at Work Regs 1989 |
| Fire alarm and emergency lighting service | Every 6 months / every 12 months | BS 5839-1, BS 5266-1 |
| Fire extinguishers | Every 12 months | BS 5306-3 |
| Legionella risk assessment and water temperature checks | Reviewed every 2 years; checks monthly | HSE ACOP L8 |
| Lifts and dumb waiters | Every 6 or 12 months | LOLER 1998 |
| Pest control visits | As contracted (often every 6–8 weeks) | Food hygiene; the EHO will ask |
| Refrigeration service | Every 6–12 months | Keeps fridges below 8°C (food safety) |

---

## 3 · Ordering and waste

**Why:** stock phase 1 counts what's on the shelf. Ordering and waste explain where the rest went, and together they make GP% real (stock phase 2).

| # | Feature | What it does | Who |
|---|---|---|---|
| 1 | **Suppliers and prices** | Each supplier: order days and cut-off times, delivery days, minimum order, and how to order (email, phone, their own portal). Each item's supplier, pack size ("case of 6"), order code and price | Head office |
| 2 | **Par levels** | How much of each item a site wants after a delivery. This can differ by day ("more on Fridays") | Manager |
| 3 | **Order** | Suggested amounts per supplier: par level minus what's on hand (from the last count, or a quick count on the spot), rounded up to whole packs. Change anything, then **send**: the app emails the supplier, or copies the order for their portal or WhatsApp. Shows the total and when it arrives | Supervisor and above *(manager's call)* |
| 4 | **Receive** | Joins the existing delivery check: tick what came against what was ordered, note shortages and swaps, photograph the invoice. A short or wrong delivery becomes a **credit to chase** | Whoever receives deliveries |
| 5 | **Price changes** | An invoice price different from the list price is flagged ("Pork belly £9.80 → £10.60, +8%"). Head office accepts the new price, which updates stock values and dish costs | Head office |
| 6 | **Waste log** | Item, amount, reason (out of date, spoiled, dropped or burnt, made too much, sent back by a guest, staff food), optional photo. Valued at cost. Big or repeated waste is flagged | Anyone |
| 7 | **Transfers between sites** | "6 bottles of Prosecco from Kentish Town to China Town": out of one site's stock and into the other's, valued at cost | Manager |
| 8 | **GP%** (stock phase 2) | Cost of sales = opening stock + purchases (from received orders) ± transfers − closing stock. GP% against EOD net sales, per site per period, with waste shown separately | Head office |

**Not in this module:** paying invoices and accounts. Invoices go to finance as they do today; we can export to Xero or Dext later if you use them (open question).

---

## 4 · Recipes and dish costing

**Why:** you can't price a menu, or know which dishes earn money, without knowing what each plate costs. It also makes every site cook the same dish the same way.

| # | Feature | What it does | Who |
|---|---|---|---|
| 1 | **Recipe card** | Ingredients from the stock item list, with amounts in kitchen units (g, ml, each), how much it makes, method, photo, plating, and which sites serve it. A recipe can use another recipe, like a sauce or a marinade | Head chef and head office |
| 2 | **Units** | Each item knows how its pack breaks down ("case of 6 × 75cl", "5kg bag"), so 200g of pork belly is costed at its price per kg | Head office |
| 3 | **Dish cost and GP** | Cost per portion from current prices. GP% = (price ex VAT − cost) ÷ price ex VAT; the price is entered including **20% VAT**. A dish below target GP (e.g. 70%, head office setting) is flagged in words: "Adobo 64%, 6 points under target" | Head office |
| 4 | **When prices change** | A new supplier price shows which dishes it moves: "Pork belly +8%: 6 dishes below target", with what the price would need to be | Head office |
| 5 | **Allergens check** | Each ingredient carries its allergens, so the dish's ingredients are compared with its allergen record and **any mismatch is flagged**. The allergen record (food safety) stays the source of truth: nothing changes it automatically | Head office; manager confirms |
| 6 | **Kitchen view** | The recipe card on the kitchen iPad: big type, the method one step at a time, no prices | Anyone |
| 7 | **Expected vs actual usage** *(later)* | What should have been used (dishes sold × recipes) against what was used (stock counts), to show waste and theft. **Needs sales per dish from the till**, which v1 doesn't have (§3 decision 5) | Head office |

---

## 5 · Shortcuts between modules (added 13 Nov 2026)

- **Count → order.** After a stock count is sent, the app says how many items are low and which suppliers they come from, with the order already filled in (**Order what's low**). "Low" means below the item's usual level. Designs: S6, then OW1.
- **Item → recipes.** Each stock item shows the dishes it's used in, how much each plate uses, roughly how long what's left will last, and who it's bought from, with **Order more**. Designs: RC3.

## 6 · Records and exports (researched 13 Nov 2026)

Head office starts from **who is asking**: a food safety inspector, the accountant or HMRC, the HSE / fire officer / insurer, staff and pay, or everything for one site. The app then lists what's included, the law behind it and how long it's kept, and produces the right format. Inspectors get PDFs, finance gets Excel, and selling or closing a site gets a zip. Exports are saved to SharePoint with a sharing link that expires, and every export is logged. Personal and health details are left out unless a law needs them (UK GDPR data minimisation). Design: EX1.

**What the law says to keep** *(check with your accountant and HR adviser; several of these come from secondary sources)*:

| Record | Keep for | Law or source |
|---|---|---|
| Company and accounting records (sales, purchases, EODs) | **6 years** from the end of the financial year | Companies Act 2006; HMRC: [running a limited company](https://gov.uk/running-a-limited-company/company-and-accounting-records) |
| VAT records | **6 years** | HMRC VAT record rules |
| PAYE records | **3 years** from the end of the tax year | HMRC: [keeping pay and tax records](https://www.gov.uk/keeping-your-pay-tax-records/how-long-to-keep-your-records) |
| Minimum wage evidence | **6 years** (since April 2021) | NMW Regulations; [HMRC NMW manual NMWM12040](https://gov.uk/hmrc-internal-manuals/national-minimum-wage-manual/nmwm12040) |
| Tips: amounts and how they were shared | **3 years**; give a worker their records within 4 weeks of asking | Employment (Allocation of Tips) Act 2023; [Acas](https://www.acas.org.uk/tips-and-service-charges/policies-and-records) |
| Holiday taken and holiday pay | **6 years** (from 6 April 2026) | Employment Rights Act 2025, s.35, into the Working Time Regs; enforced by the Fair Work Agency ([Browne Jacobson](https://www.brownejacobson.com/insights/employment-rights-act-2025-new-record-keeping-obligation)) |
| Hours worked (48-hour limit, night work) | **2 years** | Working Time Regulations 1998, reg. 9 *(check)* |
| Right to work checks | **Employment + 2 years**, then destroy | Immigration (Restrictions on Employment) Order 2016, [reg. 5A](https://legislation.gov.uk/uksi/2016/1058/regulation/5A/data.xht) |
| Accident book and RIDDOR reports | **3 years** minimum (6 is common practice, for claims) | RIDDOR 2013; Social Security (Claims and Payments) Regs (accident book for 10+ staff) |
| Waste transfer notes | **2 years** (3 for hazardous) | Environmental Protection Act 1990, duty of care. Since 31 March 2025, businesses in England with 10+ staff (counted across the group) must separate food waste and dry recycling (Simpler Recycling) |
| Food safety checks, allergens, deliveries | No set period: enough to show due diligence (we suggest 2–3 years, see §8a) | Food Safety Act 1990 s.21; Food Information Regs 2014; General Food Law |
| Fire risk assessment, checks and drills | Latest plus history; written down with 5+ staff | Regulatory Reform (Fire Safety) Order 2005 |
| Service certificates (gas, electrics, extraction) | The latest, plus the one before | Gas Safety Regs 1998; Electricity at Work Regs 1989; usually an insurance condition |

**Not in the app yet:** rotas, payroll and holiday records live in your payroll and rota tools. The "Staff and pay" export pulls them in once those are connected (open question 9 below).

---

## Who sees what

| | Staff | Supervisor | Manager | Head office |
|---|---|---|---|---|
| H&S checks, report an accident | Yes | Yes | Yes | Yes |
| Complete an accident, write risk assessments | — | — | Yes | Yes |
| Equipment and certificates | See | See | Edit, log visits | Edit, all sites |
| Waste log | Yes | Yes | Yes | Yes |
| Send an order, receive a delivery | Receive | Yes *(your call)* | Yes | Yes |
| Prices, suppliers, accept price changes | — | — | See | Edit |
| Recipe cards (no prices) | Yes | Yes | Yes | Yes |
| Dish costs and GP | — | — | See | Edit |

---

## Data (SharePoint lists, following the §4 rules)

| Module | New lists | Library |
|---|---|---|
| Health and safety | `Accidents`, `RiskAssessments` (+ versions and read receipts), `Chemicals`, `FirstAiders`, `FireDrills`. Fire checks reuse the checklist lists | Safety data sheets, risk assessment PDFs |
| Maintenance | `Equipment`, `ServiceSchedules`, `ServiceVisits`, `Contractors`. `Repairs` gains an `Equipment` lookup | Certificates and reports `{Site}/{Equipment}/…` |
| Ordering and waste | `SupplierItems` (price, pack, code), `ParLevels`, `Orders`, `OrderLines`, `PriceChanges`, `Waste`, `Transfers`. `Suppliers` and `Deliveries` already exist | Invoice photos |
| Recipes | `Recipes`, `RecipeLines`, `RecipeVersions`. `StockItems` gains pack and kitchen units | Recipe photos |

---

## Order and rough effort (one developer)

| Order | What | Rough effort | Why this order |
|---|---|---|---|
| 1 | **Weekly, monthly and yearly checklists** + fire checks + accident book | 2–3 weeks | A legal duty, the main gap against Check65, and it mostly reuses checklists |
| 2 | **Planned maintenance** (equipment, schedule, visits, certificates) | 2–3 weeks | Uses repairs and the records pack; protects the insurance |
| 3 | **Waste log** + **suppliers and prices** + **order and receive** | 3–4 weeks | Builds on stock and deliveries; makes GP% possible |
| 4 | **GP%** (stock phase 2) | 1 week | Needs purchases from step 3 |
| 5 | **Recipes and dish costing** | 3 weeks | Needs prices and units from step 3 |
| 6 | Risk assessments, COSHH, first aid, drills | 2 weeks | Mostly documents and reminders |
| Later | Expected vs actual usage | — | Needs till data per dish |

This adds roughly 13–16 weeks after the EOD roll-out (Jan 2027), alongside the Mar–Apr modules in §9. Connecting the app to SharePoint and offline sync still come first.

---

## Open questions for the client

1. **Health and safety today:** is there a consultant or an H&S manual (often from the insurer or a firm like Citation or Peninsula)? We'd link to their risk assessments rather than rewrite them.
2. **Insurer's conditions:** extraction cleaning frequency, gas and electrical certificates, and anything else the policy requires.
3. **Contractors:** who services what at each site, and do they email certificates?
4. **Ordering today:** how each supplier takes orders (email, phone, portal, WhatsApp), and who orders at each site.
5. **Invoices:** do you use Xero, Dext or another tool? Should received orders go there?
6. **Recipes:** do recipe cards or costings exist (spreadsheets, Apicbase, Kitchen CUT…)? Who is the head chef across the group?
7. **Target GP%** per menu section (food, drinks), and should prices differ by site?
8. **Waste:** should staff food count as waste or have its own line?
9. **Payroll and rota:** which tools hold hours, holiday and pay (for the six-year holiday records and the "Staff and pay" export)?
10. **Waste collection:** who collects each site's waste, and do they send waste transfer notes? Are the sites separating food waste and dry recycling (Simpler Recycling)?
