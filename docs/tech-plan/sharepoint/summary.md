| Group | List | Purpose | Written by | Unique key |
|---|---|---|---|---|
| Reference | **Sites** | One row per restaurant; drives rules, targets and settings | Admin (console) | SiteCode |
| Reference | **Staff** | Everyone who uses the apps, incl. kiosk-only staff with no email (PIN only). Role and sites decide what the server lets them open | Head office (sites, roles) / Manager (own site's people) | – |
| Reference | **Devices** | Registered kiosk tablets and phones | Admin | – |
| Reference | **Targets** | Daily targets per site (imported from finance Excel or edited in console) | Nightly targets import (Netlify Scheduled Function) / Finance | SiteCode\|yyyy-mm-dd |
| Reference | **ReasonCodes** | Discount / comp / void reasons (23 discount/comp + 15 void codes from the current form) | Finance / Admin | – |
| Reference | **DeliveryPlatforms** | Deliveroo, Uber Eats, Just Eat… | Finance | Platform name |
| Reference | **RulesThresholds** | Food-safety limits per nation (data, not code); consultant-verified | Admin (consultant sign-off) | Nation\|CheckCode |
| Checklists | **ChecklistTemplates** | Checklist definitions (opening, closing, cleaning, food safety, custom) | Admin / Manager (console builder) | TemplateId |
| Checklists | **Checkpoints** | Questions inside a template version — the customisable checkpoints with media | Admin / Manager (builder) | – |
| Checklists | **Schedules** | When each checklist is due at each site | Admin / Manager | – |
| Checklists | **ChecklistDays** | One header per open site per date: groups the day's runs and records misses (replaces DayClosures) | Morning job creates; checklist-sync updates; nightly and weekly jobs mark Missed | SiteCode\|yyyy-MM-dd, e.g. BUN\|2026-11-06 |
| Checklists | **ChecklistRuns** | One checklist (template + due time) on a day; holds the live answers while open | checklist-sync (Netlify Function); scheduled jobs create and mark Missed | SiteCode\|yyyy-MM-dd\|templateId\|HH:MM |
| Checklists | **Responses_{yyyy}** | One list per business-date year (Responses_2026, Responses_2027…): one row per final answer, written at Finish and on each correction, never edited. Create every index before go-live: SharePoint Online can refuse a new index once a list passes 5,000 items, and this list passes that in about 4 days | Background writer (Netlify Function) only; create-only | corrections). A retried write gets 409, not a duplicate |
| Checklists | **CorrectiveActions** | What was done about a failed check | App + Netlify Functions (checklist check, re-check and escalation) | – |
| Checklists | **ChecklistAudit** | Restores, moves and hard deletes of checklist days; kept when the day itself is hard-deleted | Netlify Functions only | DayKey\|action\|timestamp |
| Reference | **SignInLog** | Sign-ins, codes asked for, wrong codes, kitchen iPads set up and sign-outs. Never the code itself. Kept 12 months | Server (sign-in routes) only | – |
| Reference | **Devices** | Kitchen iPads set up by a manager. Turning one off stops it at once; it also stops if that manager leaves or loses the site | Server; managers turn them off in the app | DeviceId (random, from the sign-in cookie) |
| Checklists | **HandoverNotes** | Shift handover log | App | – |
| Food safety | **Dishes** | Every dish on a menu, for the allergen matrix | Manager / Head office | – |
| Food safety | **AllergenVersions** | Each version of a dish's 14-allergen list; never edited or deleted | Manager / Head office (append-only) | DishId\|Version |
| Food safety | **AllergenReads** | Who has confirmed reading which version of a dish | App | DishId\|StaffId |
| Food safety | **CookingLogs** | Core temperatures on cooking and reheating, and the cooling timer | App | ClientId |
| Food safety | **Probes** | Temperature probes per site | Manager | – |
| Food safety | **ProbeCalibrations** | Weekly iced-water (−1 to 1°C) and boiling-water (99 to 101°C) readings | App | ClientId |
| Food safety | **Suppliers** | Approved suppliers | Head office | Supplier name |
| Food safety | **Deliveries** | Goods received, with chilled temperature and packaging | App | ClientId |
| Food safety | **DeliveryItems** | Each item's batch code and use-by date, for tracing and recalls | App | – |
| Food safety | **FoodAlerts** | FSA food alerts and recalls (entered by head office) | Head office | – |
| Food safety | **AlertActions** | What each site did about an alert that matched its deliveries | App | AlertId\|SiteCode |
| Food safety | **Complaints** | Customer complaints about food (Food Safety Act s.14) | Supervisor / Manager | ClientId |
| Food safety | **Inspections** | Inspector visits and hygiene ratings | Manager / Head office | – |
| Food safety | **Notices** | Improvement / prohibition notices and warnings, with deadlines | Manager / Head office | – |
| Food safety | **SafetyReviews** | 4-weekly food-safety review per site | Manager | SiteCode\|yyyy-mm-dd |
| Food safety | **KeepPeriods** | How long each kind of record is kept; nothing is cleared without head office approval | Head office | Record type: checks, faults, allergens, complaints, training, fitness, inspections |
| Maintenance | **Assets** | Equipment register with QR sticker per unit | Manager / Admin | QRCode |
| Maintenance | **Contractors** | Refrigeration, gas, electrical, extraction, pest… | Manager / Admin | – |
| Maintenance | **WorkOrders** | Repairs: from fault report, failed check, statutory due or EOD note | App + Netlify Functions (escalation, contractor emails) | Reference WO-2026-00123 |
| Maintenance | **ComplianceItems** | Statutory calendar: gas CP42, TR19, EICR, fire alarm, emergency lighting, LOLER, PSSR, legionella, pest | Admin / reminders (Netlify Scheduled Function) | – |
| Maintenance | **Invoices** | Contractor invoices for the Finance role | Finance | – |
| Maintenance | **VisitorLog** | Contractor and visitor sign-in | App | – |
| Trading (EOD) | **TradingDays** | One per site per service date — replaces the Netlify form's Excel row | App creates; submit-eod (Netlify Function) writes official totals | SiteCode\|yyyy-mm-dd |
| Trading (EOD) | **EmailLog** | One row per EOD summary emailed to finance. Separate from TradingDays so stamping it never changes the report's ETag | submit-eod and the email-retry job (Netlify Functions) | SiteCode\|yyyy-mm-dd\|SubmitId: one email per submit, a second insert fails |
| Trading (EOD) | **FlowOutbox** | One message per submitted EOD for the Power Automate flow "EOD submitted" (flows/MaginhawaOps). The server never calls a flow: the flow starts on a new row, so there is no trigger URL and no Premium licence | submit-eod and the email-retry job add rows; the flow sets Status, ProcessedAt, RunId and Error | SiteCode\|yyyy-mm-dd\|SubmitId: one message per submit, a second insert fails |
| Trading (EOD) | **TradingSessions** | Lunch / dinner figures and cash | App; submit-eod adds net & variance | SiteCode\|yyyy-mm-dd\|Session |
| Trading (EOD) | **Adjustments** | Discounts, comps and voids as rows (were text blobs) | App | ClientId (UUID) |
| Trading (EOD) | **DeliverySales** | Per platform per day | App; submit-eod adds estimated net | SiteCode\|yyyy-mm-dd\|Platform |
| Trading (EOD) | **DeliveryRefunds** | Refund requests from delivery platforms | App | – |
| Trading (EOD) | **ShiftStaff** | Who worked each session (fixes lunch managers being dropped) | App (rota later) | – |
| Trading (EOD) | **Feedback** | Service, kitchen, staff, complaints, maintenance notes | App; submit-eod links work orders | – |
| Forecasting | **BookingSnapshots** | Covers on the books for the next 14 days, saved every night. Can't be rebuilt later, so it starts before forecasting does | Nightly function (nightly-snapshot) | SiteCode\|TakenOn\|ForDate\|Session |
| Forecasting | **ForecastLog** | Every forecast shown, kept so accuracy can be measured honestly | Nightly function (nightly-forecast) | SiteCode\|MadeOn\|ForDate\|Service\|Metric\|Method |
| People & handbook | **PolicyAcknowledgements** | E-signed policy sign-offs | App | PolicyFileId\|Version\|StaffId |
| People & handbook | **StaffCertificates** | Level 2/3 food hygiene, personal licence, first aid… | Manager | – |
| People & handbook | **FitnessToWork** | Illness exclusion / return to work — restricted to Owner/Admin | Manager (restricted list) | – |