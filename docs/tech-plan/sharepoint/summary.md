| Group | List | Purpose | Written by | Unique key |
|---|---|---|---|---|
| Reference | **Sites** | One row per restaurant; drives rules, targets and settings | Admin (console) | SiteCode |
| Reference | **Staff** | Everyone who uses the apps, incl. kiosk-only staff without Microsoft accounts | Admin / Manager | – |
| Reference | **Devices** | Registered kiosk tablets and phones | Admin | – |
| Reference | **Targets** | Daily targets per site (imported from finance Excel or edited in console) | Flow F09 / Finance | SiteCode\|yyyy-mm-dd |
| Reference | **ReasonCodes** | Discount / comp / void reasons (23 discount/comp + 15 void codes from the current form) | Finance / Admin | – |
| Reference | **DeliveryPlatforms** | Deliveroo, Uber Eats, Just Eat… | Finance | Platform name |
| Reference | **RulesThresholds** | Food-safety limits per nation (data, not code); consultant-verified | Admin (consultant sign-off) | Nation\|CheckCode |
| Checklists | **ChecklistTemplates** | Checklist definitions (opening, closing, cleaning, food safety, custom) | Admin / Manager (console builder) | – |
| Checklists | **Checkpoints** | Questions inside a template version — the customisable checkpoints with media | Admin / Manager (builder) | – |
| Checklists | **Schedules** | When each checklist is due at each site | Admin / Manager | – |
| Checklists | **ChecklistRuns** | One instance of a checklist on a day (created each morning by flow F02) | Flow F02 creates; app completes | SiteCode\|yyyy-mm-dd\|ScheduleId |
| Checklists | **Responses** | Every answer — the compliance record (largest list) | App (append-only by convention + Purview record label) | ClientId |
| Checklists | **CorrectiveActions** | What was done about a failed check | App + flows F04/F05 | – |
| Checklists | **DayClosures** | Ops end-of-day sign-off per site | App + flow F01 | SiteCode\|yyyy-mm-dd |
| Checklists | **HandoverNotes** | Shift handover log | App | – |
| Maintenance | **Assets** | Equipment register with QR sticker per unit | Manager / Admin | QRCode |
| Maintenance | **Contractors** | Refrigeration, gas, electrical, extraction, pest… | Manager / Admin | – |
| Maintenance | **WorkOrders** | Repairs: from fault report, failed check, statutory due or EOD note | App + flows F05/F06 | Reference WO-2026-00123 |
| Maintenance | **ComplianceItems** | Statutory calendar: gas CP42, TR19, EICR, fire alarm, emergency lighting, LOLER, PSSR, legionella, pest | Admin / flow F07 | – |
| Maintenance | **Invoices** | Contractor invoices for the Finance role | Finance | – |
| Maintenance | **VisitorLog** | Contractor and visitor sign-in | App | – |
| Trading (EOD) | **TradingDays** | One per site per service date — replaces the Netlify form's Excel row | App creates; flow F01 writes official totals | SiteCode\|yyyy-mm-dd |
| Trading (EOD) | **TradingSessions** | Lunch / dinner figures and cash | App; flow F01 adds net & variance | SiteCode\|yyyy-mm-dd\|Session |
| Trading (EOD) | **Adjustments** | Discounts, comps and voids as rows (were text blobs) | App | ClientId (UUID) |
| Trading (EOD) | **DeliverySales** | Per platform per day | App; flow F01 adds estimated net | SiteCode\|yyyy-mm-dd\|Platform |
| Trading (EOD) | **DeliveryRefunds** | Refund requests from delivery platforms | App | – |
| Trading (EOD) | **ShiftStaff** | Who worked each session (fixes lunch managers being dropped) | App (rota later) | – |
| Trading (EOD) | **Feedback** | Service, kitchen, staff, complaints, maintenance notes | App; flow F01 links work orders | – |
| Forecasting | **BookingSnapshots** | Covers on the books for the next 14 days, saved every night. Can't be rebuilt later, so it starts before forecasting does | Nightly function (nightly-snapshot) | SiteCode\|TakenOn\|ForDate\|Session |
| Forecasting | **ForecastLog** | Every forecast shown, kept so accuracy can be measured honestly | Nightly function (nightly-forecast) | SiteCode\|MadeOn\|ForDate\|Service\|Metric\|Method |
| People & handbook | **PolicyAcknowledgements** | E-signed policy sign-offs | App | PolicyFileId\|Version\|StaffId |
| People & handbook | **StaffCertificates** | Level 2/3 food hygiene, personal licence, first aid… | Manager | – |
| People & handbook | **FitnessToWork** | Illness exclusion / return to work — restricted to Owner/Admin | Manager (restricted list) | – |