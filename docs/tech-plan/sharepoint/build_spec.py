"""Single source of truth for the SharePoint site design.
Generates sharepoint-lists.json (for provisioning) and lists.md (tables for the tech plan).
Column notation: (InternalName, Type, Notes, flags) where flags may include
  I = indexed, U = unique (enforce unique values; requires index), R = required, F = set by the server, our Netlify Functions (read-only in apps)
"""
import json, os
HERE = os.path.dirname(os.path.abspath(__file__))

L = []  # (group, name, purpose, written_by, columns)
def lst(group, name, purpose, written_by, cols): L.append(dict(group=group, name=name, purpose=purpose, written_by=written_by, columns=[dict(name=c[0], type=c[1], notes=c[2], flags=c[3] if len(c) > 3 else "") for c in cols]))

# ---------------- Reference data ----------------
lst("Reference", "Sites", "One row per restaurant; drives rules, targets and settings", "Admin (console)", [
 ("Title", "Text", "Restaurant name, e.g. Bunso", "R"),
 ("SiteCode", "Text", "Short code used in keys, e.g. BUN", "IUR"),
 ("Nation", "Choice", "England / Wales / Scotland / Northern Ireland (selects rules pack)", "R"),
 ("Timezone", "Text", "Europe/London", ""),
 ("FHRSId", "Number", "FSA establishment id for rating sync", ""),
 ("Sessions", "Choice (multi)", "Lunch, Dinner, All day", ""),
 ("VATRatePct", "Number", "Default 20", ""),
 ("WageTargetPct", "Number", "Red above (default 35)", ""),
 ("WageAmberPct", "Number", "Amber above (default 30)", ""),
 ("NetSalesRule", "Choice", "GrossMinusSCTaxDiscounts (default) / GrossMinusSCTax — confirm with finance", ""),
 ("DayCloseTime", "Text", "e.g. 23:30 — when EOD/missed-check jobs run", ""),
 ("PowerAutomateFrom", "DateTime", "When head office switched the EOD flow on for this site; blank = off. Reports sent before it aren't sent to the flow", ""),
 ("Active", "Yes/No", "Open and trading. A closed site (e.g. Ramo) stays for its old records but drops out of pickers, counts and access", "I"),
])
lst("Reference", "Staff", "Everyone who uses the apps, incl. kiosk-only staff without Microsoft accounts. Role and sites decide what the server lets them open", "Head office (sites, roles) / Manager (own site's people)", [
 ("Title", "Text", "Full name", "R"),
 ("Email", "Text", "Microsoft account (blank for kiosk-only staff)", "I"),
 ("HomeSite", "Lookup → Sites", "Main site: where they land after signing in", "I"),
 ("OtherSites", "Lookup → Sites (multi)", "Other sites they work at. Head office only", ""),
 ("AllSites", "Yes/No", "Every open site, including ones opened later. Head office only", ""),
 ("Department", "Choice", "Kitchen / FOH / Management / Finance / Admin", ""),
 ("Position", "Choice", "Head chef, Sous chef, CDP, Commis, KP, Floor manager, Senior waiter, Waiter, Runner, Host, Bartender, RM, GM, AM, Duty manager, Supervisor", ""),
 ("AppRole", "Choice", "Staff / Supervisor / Manager / Head office (head office always has every site)", "R"),
 ("PinHash", "Text", "argon2 hash of 4-digit kiosk PIN (never the PIN)", ""),
 ("PreferredLanguage", "Text", "en-GB default", ""),
 ("Active", "Yes/No", "", "I"),
])
lst("Reference", "Devices", "Registered kiosk tablets and phones", "Admin", [
 ("Title", "Text", "Label, e.g. Bunso kitchen tablet", "R"),
 ("Site", "Lookup → Sites", "", "I"),
 ("DeviceAccount", "Text", "Site device Microsoft account (UPN)", ""),
 ("Platform", "Choice", "iPadOS / Android / iOS / Web", ""),
 ("LastSeen", "Date/Time", "Updated by app", ""),
 ("Revoked", "Yes/No", "Revoked devices are refused by the app", "I"),
])
lst("Reference", "Targets", "Daily targets per site (imported from finance Excel or edited in console)", "Nightly targets import (Netlify Scheduled Function) / Finance", [
 ("Title", "Text", "Key = SiteCode|yyyy-mm-dd", "IUR"),
 ("Site", "Lookup → Sites", "", "I"),
 ("TargetDate", "Date", "", "I"),
 ("NetSalesTarget", "Currency", "", ""),
 ("GrossSalesTarget", "Currency", "", ""),
 ("CoversTarget", "Number", "", ""),
 ("WagePctTarget", "Number", "Overrides site default", ""),
])
lst("Reference", "ReasonCodes", "Discount / comp / void reasons (23 discount/comp + 15 void codes from the current form)", "Finance / Admin", [
 ("Title", "Text", "Label, e.g. Employee Dining up to 4 Food Only", "R"),
 ("Kind", "Choice", "Discount / Comp / Void", "IR"),
 ("Scope", "Choice", "Check / Item", ""),
 ("DefaultPct", "Number", "20 / 50 / 100; blank = chosen amount", ""),
 ("IsWaste", "Yes/No", "Voids: W (waste) vs NW", ""),
 ("AppliesTo", "Choice", "Food / Drinks / Food & drink", ""),
 ("NotePrompt", "Text", "What the note must contain", ""),
 ("ApprovalRole", "Choice", "Manager / Owner", ""),
 ("SortOrder", "Number", "", ""),
 ("Active", "Yes/No", "", "I"),
])
lst("Reference", "DeliveryPlatforms", "Deliveroo, Uber Eats, Just Eat…", "Finance", [
 ("Title", "Text", "Platform name", "UR"),
 ("EstimatedNetPct", "Number", "Replaces hard-coded 55% (net ≈ gross ÷ (1+VAT) × pct)", ""),
 ("PricesIncludeVAT", "Yes/No", "", ""),
 ("Active", "Yes/No", "", ""),
])
lst("Reference", "RulesThresholds", "Food-safety limits per nation (data, not code); consultant-verified", "Admin (consultant sign-off)", [
 ("Title", "Text", "Key = Nation|CheckCode", "IUR"),
 ("Nation", "Choice", "", "I"),
 ("CheckCode", "Text", "cold_hold, hot_hold, reheat, cook_core, freezer, cooling_stage1 …", ""),
 ("MinValue", "Number", "", ""),
 ("MaxValue", "Number", "", ""),
 ("Unit", "Text", "C", ""),
 ("LegalBasis", "Text", "Citation shown to EHO", ""),
 ("Verified", "Yes/No", "False until checked against primary source", ""),
])

# ---------------- Checklists ----------------
lst("Checklists", "ChecklistTemplates", "Checklist definitions (opening, closing, cleaning, food safety, custom)", "Admin / Manager (console builder)", [
 ("Title", "Text", "Name", "R"),
 ("TemplateId", "Text", "Stable id used in run keys, e.g. closing", "IUR"),
 ("Kind", "Choice", "Opening / Closing / Cleaning / Food safety / Delivery / Handover / Custom", "I"),
 ("CurrentVersion", "Number", "Bumped on publish; runs store the version used", ""),
 ("Status", "Choice", "Draft / Published / Archived", "I"),
 ("SiteCodes", "Text", "Where it applies, e.g. BUN;HOX (blank = every site). Text, not a lookup", ""),
])
lst("Checklists", "Checkpoints", "Questions inside a template version — the customisable checkpoints with media", "Admin / Manager (builder)", [
 ("Title", "Text", "Prompt, e.g. Walk-in chiller temperature", "R"),
 ("CheckpointId", "Text", "Stable id used in answer keys, e.g. walkin-temp (never reused)", "IR"),
 ("TemplateId", "Text", "ChecklistTemplates.TemplateId (text, not a lookup)", "I"),
 ("TemplateVersion", "Number", "Published versions are never edited", "I"),
 ("Position", "Number", "", ""),
 ("Section", "Text", "", ""),
 ("Guidance", "Multi-line text", "'How to do it right' description", ""),
 ("MediaLinks", "Multi-line text", "Links to images/videos in HowToMedia library", ""),
 ("ResponseType", "Choice", "Yes/No, Number, Temperature, Text, Select, Multi-select, Photo, Signature, Date, Time", "R"),
 ("Options", "Multi-line text", "JSON for select options", ""),
 ("CheckCode", "Text", "Links to RulesThresholds for pass/fail", ""),
 ("Asset", "Lookup → Assets", "Optional: checkpoint about a specific unit", ""),
 ("Required", "Yes/No", "", ""),
 ("PhotoRequired", "Yes/No", "", ""),
 ("CorrectiveActionOnFail", "Yes/No", "", ""),
])
lst("Checklists", "Schedules", "When each checklist is due at each site", "Admin / Manager", [
 ("Title", "Text", "Description", ""),
 ("TemplateId", "Text", "ChecklistTemplates.TemplateId", "I"),
 ("SiteCode", "Text", "Sites.SiteCode", "I"),
 ("DueTime", "Text", "e.g. 08:00", "R"),
 ("Days", "Choice (multi)", "Mon–Sun", ""),
 ("WindowMinutes", "Number", "Late after this", ""),
 ("AutoClose", "Yes/No", "", ""),
 ("AssignedRole", "Choice", "", ""),
 ("PausedFrom", "Date", "Closures / refurb", ""),
 ("PausedUntil", "Date", "", ""),
 ("EffectiveFrom", "Text", "yyyy-MM-dd. Missed-day checks use the schedule that applied on that date", "R"),
 ("EffectiveTo", "Text", "yyyy-MM-dd; blank = still in use. Change a schedule by ending it and adding a new one", ""),
])
lst("Checklists", "ChecklistDays", "One header per open site per date: groups the day's runs and records misses (replaces DayClosures)", "Morning job creates; checklist-sync updates; nightly and weekly jobs mark Missed", [
 ("Title", "Text", "DayKey = SiteCode|yyyy-MM-dd, e.g. BUN|2026-11-06", "IUR"),
 ("Label", "Text", "For people and list search, e.g. Bunso · Fri 6 Nov 2026", ""),
 ("SiteCode", "Text", "", "I"),
 ("BusinessDateKey", "Text", "yyyy-MM-dd; keys and range filters (Date columns shift a day in British Summer Time)", "I"),
 ("BusinessDate", "Date", "Display and Power BI date tables only; never filter on it", ""),
 ("Status", "Choice", "Due / In progress / Submitted / Late / Missed / Not trading / Deleted / Deleting. Filter by date first, then status in code", "I"),
 ("NotTradingReason", "Text", "Head office: closure, refurb, holiday", ""),
 ("ExpectedRuns", "Number", "", "F"),
 ("CompletedRuns", "Number", "", "F"),
 ("MissedRuns", "Number", "", "F"),
 ("FailedCount", "Number", "", "F"),
 ("OpenFixes", "Number", "", "F"),
 ("SubmittedAt", "DateTime", "Last run finished (server time)", "F"),
 ("SubmittedById", "Text", "Entra object id (not a person column)", "F"),
 ("SubmittedByName", "Text", "", "F"),
 ("MissedDetectedAt", "DateTime", "Set once by the nightly job; never cleared, even by a late submission", "F"),
 ("DayHash", "Text", "SHA-256 over the finished runs' RunHash values", "F"),
 ("Stats", "Multi-line text", "JSON: completion %, failures, open fixes, faults", "F"),
 ("ReportItemId", "Text", "driveItem id of the day PDF in Maginhawa App Checklists (never a URL)", "F"),
 ("ReportBuiltAt", "DateTime", "When the day PDF was last made; remade after any correction", "F"),
 ("DeletedAt", "DateTime", "Soft delete", "F"),
 ("DeletedById", "Text", "", "F"),
 ("DeletedByName", "Text", "", "F"),
 ("DeletedReason", "Text", "Required to delete; 'Moved to …' after a move", "F"),
 ("StatusBeforeDelete", "Text", "Restore puts this back", "F"),
])
lst("Checklists", "ChecklistRuns", "One checklist (template + due time) on a day; holds the live answers while open", "checklist-sync (Netlify Function); scheduled jobs create and mark Missed", [
 ("Title", "Text", "RunKey = SiteCode|yyyy-MM-dd|templateId|HH:MM (or |any), e.g. BUN|2026-11-06|closing|22:30", "IUR"),
 ("DayKey", "Text", "ChecklistDays key; all runs for a day = one filter on this", "I"),
 ("SiteCode", "Text", "", "I"),
 ("BusinessDateKey", "Text", "yyyy-MM-dd", "I"),
 ("TemplateId", "Text", "", ""),
 ("TemplateVersion", "Number", "", ""),
 ("DueTime", "Text", "HH:MM or blank", ""),
 ("DueAt", "DateTime", "", ""),
 ("Status", "Choice", "Scheduled / In progress / Completed / Missed / Auto-closed / Cancelled / Deleted", "I"),
 ("AnswersJson", "Multi-line text (plain)", "Snapshot of the run's answers: value, who, when, fix, corrections, per-answer seq. Saved with If-Match; the server refuses more than about 50,000 characters. Photos and signatures are ids, never base64", "F"),
 ("SchemaVersion", "Number", "Version of the AnswersJson shape", "F"),
 ("Seq", "Number", "Raised on every successful write; the Finish 'seen' check compares against it", "F"),
 ("RecheckOf", "Text", "RunKey|checkpointId of the failed answer", ""),
 ("CompletedAt", "DateTime", "Server time", "F"),
 ("CompletedById", "Text", "Entra object id", "F"),
 ("CompletedByName", "Text", "", "F"),
 ("DurationSeconds", "Number", "Pencil-whip signal", "F"),
 ("FailedCount", "Number", "", "F"),
 ("RunHash", "Text", "SHA-256 of the canonical finished AnswersJson", "F"),
 ("RowsStatus", "Choice", "Pending / Written: queue for the background writer of Responses_{yyyy} rows", "I"),
 ("DeletedAt", "DateTime", "Soft delete of one run", "F"),
 ("DeletedById", "Text", "", "F"),
 ("DeletedReason", "Text", "", "F"),
])
lst("Checklists", "Responses_{yyyy}", "One list per business-date year (Responses_2026, Responses_2027…): one row per final answer, written at Finish and on each correction, never edited. Create every index before go-live: SharePoint Online can refuse a new index once a list passes 5,000 items, and this list passes that in about 4 days", "Background writer (Netlify Function) only; create-only", [
 ("Title", "Text", "RowKey = AnswerKey|rev (rev 0 = original, 1… = corrections). A retried write gets 409, not a duplicate", "IUR"),
 ("AnswerKey", "Text", "RunKey|checkpointId", "I"),
 ("DayKey", "Text", "Answers for one day", "I"),
 ("BusinessDateKey", "Text", "yyyy-MM-dd; date-range exports", "I"),
 ("CheckpointId", "Text", "One question over a year (about 2,920 rows)", "I"),
 ("SiteCode", "Text", "", ""),
 ("RunKey", "Text", "", ""),
 ("TemplateId", "Text", "", ""),
 ("TemplateVersion", "Number", "", ""),
 ("CheckpointTitle", "Text", "Snapshot, so later template edits don't rewrite history", ""),
 ("AnswerType", "Choice", "yesno / temp / number / text / photo / choice / date / sign (ANSWER_TYPES)", ""),
 ("ValueNumber", "Number", "temp, number", ""),
 ("ValueBool", "Choice", "Yes / No / blank (a Yes/No column can't be blank)", ""),
 ("ValueText", "Multi-line text", "text, choice", ""),
 ("ValueDateKey", "Text", "yyyy-MM-dd", ""),
 ("ValueDisplay", "Text", "Readable value for Excel, whatever the type", ""),
 ("Result", "Choice", "Pass / Fail / None (replaces Passed)", ""),
 ("ThresholdSnapshot", "Text", "Min/max/legal basis used, frozen", ""),
 ("Source", "Choice", "Manual / Bluetooth probe / Camera OCR", ""),
 ("CapturedLive", "Yes/No", "In-app camera, not gallery", ""),
 ("PhotoIds", "Text", "PhotoId values (; separated). Replaces PhotoUrl: links expire, ids don't", ""),
 ("PhotoItemIds", "Text", "driveItem ids in the Photos library", ""),
 ("PhotoSha256", "Text", "Detects reused photos", ""),
 ("AnsweredById", "Text", "Entra object id", ""),
 ("AnsweredByName", "Text", "", ""),
 ("AnsweredAt", "DateTime", "Capped at server time", ""),
 ("ReceivedAt", "DateTime", "Server time the answer reached us (offline answers arrive later)", ""),
 ("Rev", "Number", "0 = original", ""),
 ("Supersedes", "Text", "RowKey of the row this corrects", ""),
 ("CorrectionReason", "Text", "Required when Rev > 0", ""),
 ("CorrectedAt", "DateTime", "Server time", ""),
])
lst("Checklists", "CorrectiveActions", "What was done about a failed check", "App + Netlify Functions (checklist check, re-check and escalation)", [
 ("Title", "Text", "Short description", "R"),
 ("AnswerKey", "Text", "RunKey|checkpointId of the failed answer (replaces the Response lookup)", "I"),
 ("DayKey", "Text", "", "I"),
 ("SiteCode", "Text", "", "I"),
 ("ActionTaken", "Multi-line text", "", ""),
 ("FoodDisposed", "Yes/No", "", ""),
 ("Status", "Choice", "Open / Action taken / Verified / Escalated", "I"),
 ("RecheckDue", "Date/Time", "", "I"),
 ("WorkOrder", "Lookup → WorkOrders", "Set when escalated", ""),
 ("VerifiedById", "Text", "Entra object id", ""),
 ("VerifiedByName", "Text", "", ""),
])
lst("Checklists", "ChecklistAudit", "Restores, moves and hard deletes of checklist days; kept when the day itself is hard-deleted", "Netlify Functions only", [
 ("Title", "Text", "DayKey|action|timestamp", "IUR"),
 ("DayKey", "Text", "", "I"),
 ("Action", "Choice", "Soft delete / Restore / Move / Hard delete started / Hard delete finished", "R"),
 ("Reason", "Text", "", "R"),
 ("ById", "Text", "Entra object id", "R"),
 ("ByName", "Text", "", ""),
 ("At", "DateTime", "Server time", "R"),
 ("Counts", "Text", "JSON: runs, rows, photos, corrective actions affected", ""),
 ("MovedTo", "Text", "New DayKey after a move", ""),
])
lst("Checklists", "HandoverNotes", "Shift handover log", "App", [
 ("Title", "Text", "Summary", ""),
 ("Site", "Lookup → Sites", "", "I"),
 ("BusinessDate", "Date", "", "I"),
 ("Body", "Multi-line text", "", ""),
 ("Author", "Lookup → Staff", "", ""),
])

# ---------------- Food safety (HANDOFF.md §8a) ----------------
# Corrections to checklist answers are new Responses_{yyyy} rows (Rev + Supersedes + CorrectionReason; server time).
# Staff certificates and fit-to-work answers are in StaffCertificates and FitnessToWork (People & handbook).
lst("Food safety", "Dishes", "Every dish on a menu, for the allergen matrix", "Manager / Head office", [
 ("Title", "Text", "Dish name", "R"),
 ("Site", "Lookup → Sites", "Blank = on every site's menu", "I"),
 ("Course", "Text", "Starters, Mains, Desserts…", ""),
 ("CurrentVersion", "Number", "Latest AllergenVersions.Version", ""),
 ("Active", "Yes/No", "", "I"),
])
lst("Food safety", "AllergenVersions", "Each version of a dish's 14-allergen list; never edited or deleted", "Manager / Head office (append-only)", [
 ("Title", "Text", "DishId|Version", "IUR"),
 ("Dish", "Lookup → Dishes", "", "I"),
 ("Version", "Number", "1, 2, 3…", "R"),
 ("Allergens", "Choice (multi)", "The 14: Celery, Cereals with gluten, Crustaceans, Eggs, Fish, Lupin, Milk, Molluscs, Mustard, Tree nuts, Peanuts, Sesame, Soya, Sulphites", ""),
 ("ChangeNote", "Text", "Why it changed, e.g. new supplier", ""),
 ("ChangedBy", "Lookup → Staff", "", ""),
])
lst("Food safety", "AllergenReads", "Who has confirmed reading which version of a dish", "App", [
 ("Title", "Text", "DishId|StaffId", "IUR"),
 ("Dish", "Lookup → Dishes", "", "I"),
 ("Staff", "Lookup → Staff", "", "I"),
 ("VersionRead", "Number", "", ""),
])
lst("Food safety", "CookingLogs", "Core temperatures on cooking and reheating, and the cooling timer", "App", [
 ("Title", "Text", "ClientId", "IUR"),
 ("Site", "Lookup → Sites", "", "I"),
 ("BusinessDate", "Date", "", "I"),
 ("Dish", "Text", "Dish or batch", "R"),
 ("Kind", "Choice", "Cook / Reheat", ""),
 ("CoreTempC", "Number", "75°C or above (guidance)", "R"),
 ("Probe", "Lookup → Probes", "", ""),
 ("CoolingStartedAt", "Date/Time", "Blank if served or hot-held", ""),
 ("CoolingReadings", "Multi-line text", "JSON [{at, tempC}]", ""),
 ("InFridgeAt", "Date/Time", "Due within 90 minutes of CoolingStartedAt", ""),
 ("RecordedBy", "Lookup → Staff", "", ""),
])
lst("Food safety", "Probes", "Temperature probes per site", "Manager", [
 ("Title", "Text", "e.g. Probe 2 · kitchen", "R"),
 ("Site", "Lookup → Sites", "", "I"),
 ("Asset", "Lookup → Assets", "Optional", ""),
 ("Retired", "Yes/No", "", ""),
])
lst("Food safety", "ProbeCalibrations", "Weekly iced-water (−1 to 1°C) and boiling-water (99 to 101°C) readings", "App", [
 ("Title", "Text", "ClientId", "IUR"),
 ("Probe", "Lookup → Probes", "", "I"),
 ("Site", "Lookup → Sites", "", "I"),
 ("CheckedOn", "Date", "", "I"),
 ("IceC", "Number", "", "R"),
 ("BoilC", "Number", "", "R"),
 ("Passed", "Yes/No", "Set by the app from the ranges in packages/core", ""),
 ("CheckedBy", "Lookup → Staff", "", ""),
])
lst("Food safety", "Suppliers", "Approved suppliers", "Head office", [
 ("Title", "Text", "Supplier name", "IUR"),
 ("Approved", "Yes/No", "", "I"),
 ("Notes", "Multi-line text", "Certificates, audits", ""),
])
lst("Food safety", "Deliveries", "Goods received, with chilled temperature and packaging", "App", [
 ("Title", "Text", "ClientId", "IUR"),
 ("Site", "Lookup → Sites", "", "I"),
 ("Supplier", "Lookup → Suppliers", "", "I"),
 ("ReceivedAt", "Date/Time", "", "I"),
 ("ChilledC", "Number", "8°C or below", ""),
 ("PackagingOk", "Yes/No", "", ""),
 ("Rejected", "Multi-line text", "Items sent back", ""),
 ("ReceivedBy", "Lookup → Staff", "", ""),
])
lst("Food safety", "DeliveryItems", "Each item's batch code and use-by date, for tracing and recalls", "App", [
 ("Title", "Text", "Item name", "R"),
 ("Delivery", "Lookup → Deliveries", "", "I"),
 ("Site", "Lookup → Sites", "", "I"),
 ("BatchCode", "Text", "Matched against FoodAlerts", "I"),
 ("UseBy", "Date", "", ""),
])
lst("Food safety", "FoodAlerts", "FSA food alerts and recalls (entered by head office)", "Head office", [
 ("Title", "Text", "Alert title", "R"),
 ("Reason", "Text", "e.g. undeclared milk", ""),
 ("IssuedOn", "Date", "", "I"),
 ("Batches", "Multi-line text", "One per line: exact code or a range 'CM-4460 to CM-4479'", ""),
 ("SourceUrl", "Hyperlink", "food.gov.uk alert page", ""),
])
lst("Food safety", "AlertActions", "What each site did about an alert that matched its deliveries", "App", [
 ("Title", "Text", "AlertId|SiteCode", "IUR"),
 ("Alert", "Lookup → FoodAlerts", "", "I"),
 ("Site", "Lookup → Sites", "", "I"),
 ("Action", "Choice", "Set aside / Sent back / Not in stock", "R"),
 ("ActionBy", "Lookup → Staff", "", ""),
])
lst("Food safety", "Complaints", "Customer complaints about food (Food Safety Act s.14)", "Supervisor / Manager", [
 ("Title", "Text", "ClientId", "IUR"),
 ("Site", "Lookup → Sites", "", "I"),
 ("ReceivedAt", "Date/Time", "", "I"),
 ("Kind", "Choice", "Foreign body / Felt ill / Allergic reaction / Not what I ordered / Undercooked / Other", "R"),
 ("Dish", "Text", "", ""),
 ("Batch", "Text", "", ""),
 ("Details", "Multi-line text", "", "R"),
 ("Photos", "Multi-line text", "Photo library links", ""),
 ("ItemKept", "Yes/No", "", ""),
 ("Actions", "Choice (multi)", "Replaced / Refunded / Checked the batch / Took the dish off / Told the head chef", ""),
 ("CustomerContact", "Text", "Only with consent; never in inspector packs; cleared after the keep period", ""),
 ("RecordedBy", "Lookup → Staff", "", ""),
])
lst("Food safety", "Inspections", "Inspector visits and hygiene ratings", "Manager / Head office", [
 ("Title", "Text", "Who visited", "R"),
 ("Site", "Lookup → Sites", "", "I"),
 ("VisitedOn", "Date", "", "I"),
 ("Rating", "Number", "0–5, blank if not rated", ""),
 ("Outcome", "Multi-line text", "", ""),
 ("ReportLink", "Hyperlink", "Reports library", ""),
])
lst("Food safety", "Notices", "Improvement / prohibition notices and warnings, with deadlines", "Manager / Head office", [
 ("Title", "Text", "What it's about", "R"),
 ("Site", "Lookup → Sites", "", "I"),
 ("Inspection", "Lookup → Inspections", "", ""),
 ("Kind", "Choice", "Improvement notice / Prohibition notice / Written warning", "R"),
 ("ServedOn", "Date", "", ""),
 ("FixBy", "Date", "Reminder 7 days before", "I"),
 ("AppealBy", "Date", "Reminder 7 days before", ""),
 ("ClosedOn", "Date", "", "I"),
 ("WorkOrder", "Lookup → WorkOrders", "Optional repair job", ""),
])
lst("Food safety", "SafetyReviews", "4-weekly food-safety review per site", "Manager", [
 ("Title", "Text", "SiteCode|yyyy-mm-dd", "IUR"),
 ("Site", "Lookup → Sites", "", "I"),
 ("ReviewedOn", "Date", "", "I"),
 ("RepeatFaults", "Multi-line text", "JSON snapshot of the repeat faults shown", ""),
 ("Answers", "Multi-line text", "JSON {dishes, staff, equipment}", ""),
 ("ReviewedBy", "Lookup → Staff", "", ""),
])
lst("Food safety", "KeepPeriods", "How long each kind of record is kept; nothing is cleared without head office approval", "Head office", [
 ("Title", "Text", "Record type: checks, faults, allergens, complaints, training, fitness, inspections", "IUR"),
 ("Months", "Number", "Suggested defaults in packages/core DEFAULT_KEEP. Proposed: checks 36 (3 years: Food Safety Act s.34 prosecutions and injury claims both have 3-year limits; DEFAULT_KEEP still says 24 until agreed); check photos 12 unless tied to an incident", "R"),
 ("FromLeaving", "Yes/No", "Counted from when the person leaves", ""),
])

# ---------------- Maintenance ----------------
lst("Maintenance", "Assets", "Equipment register with QR sticker per unit", "Manager / Admin", [
 ("Title", "Text", "e.g. Walk-in chiller", "R"),
 ("Site", "Lookup → Sites", "", "I"),
 ("Category", "Choice", "Refrigeration, Cooking, Extraction, Gas, Electrical, Dishwash, Ice, Coffee, Lift, Other", "I"),
 ("Make", "Text", "", ""), ("Model", "Text", "", ""), ("SerialNumber", "Text", "", ""),
 ("QRCode", "Text", "Value on the sticker", "IU"),
 ("InstallDate", "Date", "", ""),
 ("WarrantyExpires", "Date", "", "I"),
 ("DefaultContractor", "Lookup → Contractors", "", ""),
 ("PhotoUrl", "Hyperlink", "", ""),
 ("Retired", "Yes/No", "", ""),
])
lst("Maintenance", "Contractors", "Refrigeration, gas, electrical, extraction, pest…", "Manager / Admin", [
 ("Title", "Text", "Company", "R"),
 ("Trade", "Choice", "", "I"),
 ("ContactName", "Text", "", ""), ("Phone", "Text", "", ""), ("Email", "Text", "", ""),
 ("GasSafeNumber", "Text", "", ""),
 ("Accreditation", "Text", "e.g. BESA TR19", ""),
])
lst("Maintenance", "WorkOrders", "Repairs: from fault report, failed check, statutory due or EOD note", "App + Netlify Functions (escalation, contractor emails)", [
 ("Title", "Text", "Reference WO-2026-00123", "IUR"),
 ("Site", "Lookup → Sites", "", "I"),
 ("Asset", "Lookup → Assets", "", "I"),
 ("Summary", "Text", "", "R"),
 ("Description", "Multi-line text", "", ""),
 ("Source", "Choice", "Fault report / Failed check / Statutory / Planned / EOD note / AI warning", ""),
 ("SourceAnswerKey", "Text", "AnswerKey (RunKey|checkpointId) when source = failed check", ""),
 ("Priority", "Choice", "Low / Normal / High / Urgent", "I"),
 ("Status", "Choice", "Reported / Triaged / Dispatched / Scheduled / In progress / Awaiting parts / Resolved / Closed / Cancelled", "I"),
 ("Contractor", "Lookup → Contractors", "", ""),
 ("ReportedBy", "Lookup → Staff", "", ""),
 ("DispatchedAt", "Date/Time", "", ""), ("AttendedAt", "Date/Time", "", ""), ("ResolvedAt", "Date/Time", "", ""),
 ("PhotoUrls", "Multi-line text", "", ""),
 ("History", "Multi-line text (append)", "Timeline notes (append changes on)", ""),
])
lst("Maintenance", "ComplianceItems", "Statutory calendar: gas CP42, TR19, EICR, fire alarm, emergency lighting, LOLER, PSSR, legionella, pest", "Admin / reminders (Netlify Scheduled Function)", [
 ("Title", "Text", "Requirement name", "R"),
 ("Site", "Lookup → Sites", "", "I"),
 ("Asset", "Lookup → Assets", "Optional", ""),
 ("RequirementCode", "Choice", "", ""),
 ("IntervalMonths", "Number", "[verify] per requirement", ""),
 ("LastDone", "Date", "", ""),
 ("NextDue", "Date", "", "I"),
 ("Contractor", "Lookup → Contractors", "", ""),
 ("CertificateLink", "Hyperlink", "Certificates library", ""),
 ("Verified", "Yes/No", "Interval checked by consultant", ""),
])
lst("Maintenance", "Invoices", "Contractor invoices for the Finance role", "Finance", [
 ("Title", "Text", "Invoice number", "R"),
 ("Contractor", "Lookup → Contractors", "", "I"),
 ("WorkOrder", "Lookup → WorkOrders", "", "I"),
 ("Asset", "Lookup → Assets", "", "I"),
 ("InvoiceDate", "Date", "", "I"),
 ("Net", "Currency", "", ""), ("VAT", "Currency", "", ""), ("Gross", "Currency", "", ""),
 ("DocumentLink", "Hyperlink", "Invoices library", ""),
 ("ApprovedBy", "Lookup → Staff", "", ""),
 ("ExportedAt", "Date/Time", "To Xero / QuickBooks / Sage (phase 2)", ""),
])
lst("Maintenance", "VisitorLog", "Contractor and visitor sign-in", "App", [
 ("Title", "Text", "Visitor name", "R"),
 ("Site", "Lookup → Sites", "", "I"),
 ("Company", "Text", "", ""), ("Purpose", "Text", "", ""),
 ("WorkOrder", "Lookup → WorkOrders", "", ""),
 ("SignedIn", "Date/Time", "", "I"), ("SignedOut", "Date/Time", "", ""),
 ("HealthDeclaration", "Yes/No", "Food-handler fitness questions answered", ""),
])

# ---------------- Trading / EOD ----------------
lst("Trading (EOD)", "TradingDays", "One per site per service date — replaces the Netlify form's Excel row", "App creates; submit-eod (Netlify Function) writes official totals", [
 ("Title", "Text", "Key = SiteCode|yyyy-mm-dd (blocks duplicates)", "IUR"),
 ("Site", "Lookup → Sites", "", "I"),
 ("BusinessDate", "Date", "", "I"),
 ("Status", "Choice", "Draft / Submitted / Checked / Approved / SentBack / Reopened. The app writes Draft, Submitted, Approved and SentBack", "I"),
 ("WageCost", "Currency", "", ""),
 ("NextShiftNotes", "Multi-line text", "", ""),
 ("SubmittedBy", "Lookup → Staff", "Signed-in user, not typed", ""),
 ("SubmittedAt", "Date/Time", "", ""),
 ("ApprovedBy", "Lookup → Staff", "Who last approved or sent it back. Set only with If-Match, so two reviewers can't both win", ""),
 ("ReviewedAt", "Date/Time", "When it was approved or sent back", "F"),
 ("TotalGross", "Currency", "", "F"), ("TotalNet", "Currency", "", "F"),
 ("DineInNet", "Currency", "", "F"), ("Covers", "Number", "", "F"),
 ("ASPHNet", "Currency", "", "F"), ("ASPHGross", "Currency", "", "F"), ("FoodPct", "Number", "", "F"), ("DrinkPct", "Number", "", "F"),
 ("WagePct", "Number", "", "F"), ("WageRAG", "Choice", "Green / Amber / Red", "F"),
 ("NetVsTarget", "Currency", "", "F"),
 ("CheckIssues", "Multi-line text", "Problems found by the server (e.g. discount lines ≠ EPOS total)", "F"),
 ("CalcVersion", "Text", "Formula version used", "F"),
 ("DraftJson", "Multi-line text", "The whole report between saves. Every save is PATCH with If-Match: <item ETag>, so a stale save gets 412 and is merged by section", ""),
 ("SectionStamps", "Multi-line text", "JSON: who last changed each section, and when (e.g. Jo changed Dinner at 21:14)", ""),
 ("SubmitId", "Text", "The submit press that won; a retry of the same press is a no-op", ""),
])
lst("Trading (EOD)", "EmailLog", "One row per EOD summary emailed to finance. Separate from TradingDays so stamping it never changes the report's ETag", "submit-eod and the email-retry job (Netlify Functions)", [
 ("Title", "Text", "Key = SiteCode|yyyy-mm-dd|SubmitId: one email per submit, a second insert fails (unique)", "IUR"),
 ("TradingDay", "Lookup → TradingDays", "", "I"),
 ("SentAt", "Date/Time", "Server time", "FR"),
])
lst("Trading (EOD)", "FlowOutbox", "One message per submitted EOD for the Power Automate flow \"EOD submitted\" (flows/MaginhawaOps). The server never calls a flow: the flow starts on a new row, so there is no trigger URL and no Premium licence", "submit-eod and the email-retry job add rows; the flow sets Status, ProcessedAt, RunId and Error", [
 ("Title", "Text", "Key = SiteCode|yyyy-mm-dd|SubmitId: one message per submit, a second insert fails (unique)", "IUR"),
 ("SiteCode", "Text", "", "F"),
 ("BusinessDate", "Date", "", "F"),
 ("Schema", "Text", "e.g. maginhawa.eod.submitted/1; the flow refuses one it doesn't know", "F"),
 ("Payload", "Multi-line text", "The message as JSON (flowMessage in packages/core/src/flow.ts). No handover notes. Not required in SharePoint, so the flow's Update item only sends Title and Status", "F"),
 ("Status", "Choice", "Queued / Done / Failed. The flow's trigger only takes Queued", "IR"),
 ("QueuedAt", "Date/Time", "Server time", "F"),
 ("ProcessedAt", "Date/Time", "Set by the flow", ""),
 ("RunId", "Text", "The flow run, to find it in run history", ""),
 ("Error", "Multi-line text", "Set by the flow when it fails; fix, then set Status back to Queued to run it again", ""),
])
lst("Trading (EOD)", "TradingSessions", "Lunch / dinner figures and cash", "App; submit-eod adds net & variance", [
 ("Title", "Text", "Key = SiteCode|yyyy-mm-dd|Session", "IUR"),
 ("TradingDay", "Lookup → TradingDays", "", "I"),
 ("Site", "Lookup → Sites", "", "I"),
 ("BusinessDate", "Date", "", "I"),
 ("Session", "Choice", "Lunch / Dinner / All day", ""),
 ("Gross", "Currency", "", ""), ("ServiceCharge", "Currency", "", ""), ("Tax", "Currency", "", ""),
 ("DiscountsComps", "Currency", "EPOS total; reconciled to Adjustments", ""),
 ("FoodSales", "Currency", "", ""), ("DrinkSales", "Currency", "", ""),
 ("BookedCovers", "Number", "'Starting covers' in old form", ""), ("Walkins", "Number", "", ""),
 ("CashInEpos", "Currency", "", ""), ("CashCollected", "Currency", "", ""),
 ("CashExplanation", "Multi-line text", "Required by app if variance > 1p", ""),
 ("Net", "Currency", "Gross − SC − tax − discounts", "F"),
 ("Covers", "Number", "", "F"),
 ("CashVariance", "Currency", "Collected − EPOS", "F"),
])
lst("Trading (EOD)", "Adjustments", "Discounts, comps and voids as rows (were text blobs)", "App", [
 ("Title", "Text", "ClientId (UUID)", "IUR"),
 ("TradingSession", "Lookup → TradingSessions", "", "I"),
 ("Site", "Lookup → Sites", "", "I"),
 ("BusinessDate", "Date", "", "I"),
 ("Kind", "Choice", "Discount / Comp / Void", "I"),
 ("ReasonCode", "Lookup → ReasonCodes", "", "R"),
 ("GuestOrStaffName", "Text", "", ""),
 ("Items", "Text", "", ""),
 ("SaleAmount", "Currency", "", ""), ("Amount", "Currency", "", "R"),
 ("Time", "Text", "", ""),
 ("PerformedBy", "Lookup → Staff", "'Voided by'", ""),
 ("ApprovedBy", "Lookup → Staff", "Real user", ""),
 ("Notes", "Multi-line text", "", ""),
])
lst("Trading (EOD)", "DeliverySales", "Per platform per day", "App; submit-eod adds estimated net", [
 ("Title", "Text", "Key = SiteCode|yyyy-mm-dd|Platform", "IUR"),
 ("TradingDay", "Lookup → TradingDays", "", "I"),
 ("Platform", "Lookup → DeliveryPlatforms", "", ""),
 ("Gross", "Currency", "", ""),
 ("EstimatedNet", "Currency", "", "F"),
 ("ActualPayout", "Currency", "From platform statement (later)", ""),
 ("CurrentPromotion", "Text", "", ""),
])
lst("Trading (EOD)", "DeliveryRefunds", "Refund requests from delivery platforms", "App", [
 ("Title", "Text", "Summary", ""),
 ("TradingDay", "Lookup → TradingDays", "", "I"),
 ("Platform", "Lookup → DeliveryPlatforms", "", ""),
 ("Amount", "Currency", "", "R"),
 ("Details", "Multi-line text", "", ""),
 ("Issued", "Choice", "Yes / No / Pending", "I"),
])
lst("Trading (EOD)", "ShiftStaff", "Who worked each session (fixes lunch managers being dropped)", "App (rota later)", [
 ("Title", "Text", "Name", "R"),
 ("TradingSession", "Lookup → TradingSessions", "", "I"),
 ("Staff", "Lookup → Staff", "Blank if no account", ""),
 ("Department", "Choice", "Kitchen / FOH / Management", ""),
 ("Position", "Choice", "", ""),
 ("Hours", "Number", "", ""),
])
lst("Trading (EOD)", "Feedback", "Service, kitchen, staff, complaints, maintenance notes", "App; submit-eod links work orders", [
 ("Title", "Text", "Category", ""),
 ("TradingDay", "Lookup → TradingDays", "", "I"),
 ("Category", "Choice", "Service / Kitchen / Staff / Complaints / Maintenance", "I"),
 ("Body", "Multi-line text", "", "R"),
 ("WorkOrder", "Lookup → WorkOrders", "Created by submit-eod for urgent maintenance", "F"),
])

# ---------------- Forecasting ----------------
lst("Forecasting", "BookingSnapshots", "Covers on the books for the next 14 days, saved every night. Can't be rebuilt later, so it starts before forecasting does", "Nightly function (nightly-snapshot)", [
 ("Title", "Text", "Key = SiteCode|TakenOn|ForDate|Session", "IUR"),
 ("Site", "Lookup → Sites", "", "I"),
 ("TakenOn", "Date", "Trading day the snapshot was taken (after close)", "I"),
 ("ForDate", "Date", "Trading day the bookings are for", "I"),
 ("LeadDays", "Number", "ForDate − TakenOn, 1–14", ""),
 ("Session", "Choice", "Lunch / Dinner", ""),
 ("Covers", "Number", "Covers booked", ""),
 ("Bookings", "Number", "Number of bookings (parties)", ""),
 ("Source", "Text", "Reservations system the figures came from", ""),
])
lst("Forecasting", "ForecastLog", "Every forecast shown, kept so accuracy can be measured honestly", "Nightly function (nightly-forecast)", [
 ("Title", "Text", "Key = SiteCode|MadeOn|ForDate|Service|Metric|Method", "IUR"),
 ("Site", "Lookup → Sites", "", "I"),
 ("MadeOn", "Date", "Trading day the forecast was made (after close)", "I"),
 ("ForDate", "Date", "", "I"),
 ("Horizon", "Number", "Days ahead, 1–14", ""),
 ("Service", "Choice", "Lunch / Dinner / Delivery", ""),
 ("Metric", "Choice", "Net / Covers", ""),
 ("Method", "Choice", "v1 (published) / Holt-Winters (hidden challenger) / Same weekday last week (baseline)", "I"),
 ("Version", "Text", "Code version, e.g. forecast-v1.0", ""),
 ("P50", "Number", "Central forecast (pence for Net)", ""),
 ("P10", "Number", "Low end of the 80% likely range", ""),
 ("P90", "Number", "High end of the 80% likely range", ""),
 ("Confidence", "Choice", "Normal / Low (little history)", ""),
 ("Reasons", "Text", "Why, e.g. 'Median of 6 Fridays · trend +4% · bank holiday'", ""),
])
# ---------------- People & handbook ----------------
lst("People & handbook", "PolicyAcknowledgements", "E-signed policy sign-offs", "App", [
 ("Title", "Text", "Key = PolicyFileId|Version|StaffId", "IUR"),
 ("PolicyFileId", "Number", "Item id in Policies library", "I"),
 ("PolicyVersion", "Text", "Library version label at signing", ""),
 ("Staff", "Lookup → Staff", "", "I"),
 ("AcknowledgedAt", "Date/Time", "", ""),
 ("Device", "Lookup → Devices", "", ""),
 ("SignatureJson", "Multi-line text", "", ""),
])
lst("People & handbook", "StaffCertificates", "Level 2/3 food hygiene, personal licence, first aid…", "Manager", [
 ("Title", "Text", "Certificate type", "R"),
 ("Staff", "Lookup → Staff", "", "I"),
 ("Issuer", "Text", "", ""),
 ("IssuedOn", "Date", "", ""),
 ("ExpiresOn", "Date", "", "I"),
 ("DocumentLink", "Hyperlink", "Certificates library", ""),
])
lst("People & handbook", "FitnessToWork", "Illness exclusion / return to work — restricted to Owner/Admin", "Manager (restricted list)", [
 ("Title", "Text", "Staff name", "R"),
 ("Staff", "Lookup → Staff", "", "I"),
 ("ReportedOn", "Date", "", ""),
 ("SymptomsCategory", "Choice", "Minimal data — no free-text diagnosis", ""),
 ("ExcludedUntil", "Date", "", ""),
 ("ClearedBy", "Lookup → Staff", "", ""),
 ("ClearedOn", "Date", "", ""),
])

LIBS = [
 ("Maginhawa App Checklists", "For people: one PDF per restaurant per day (missed days too) and one Excel file per restaurant per month, made from the lists", "Read-only for everyone; only Netlify Functions write. Folders {Site name}/{yyyy-MM}, e.g. Bunso/2026-11/. Files: '2026-11-06 Bunso – Fri.pdf', '2026-11-05 Bunso – Thu – MISSED.pdf', 'Bunso – Checklists – Nov 2026.xlsx'. Day PDF made after closing by a background function (PDFKit or react-pdf), remade after a correction (versions keep the old one); monthly XLSX rebuilt nightly (ExcelJS) and replaced whole. Columns: SiteCode (I), BusinessDateKey (I, blank on the monthly file), Kind Day PDF/Month XLSX (I), DayStatus (I), DayKey, BuiltAt. Automatic version limits; no sensitivity labels (they stop the app reading files). Inspectors get a view-only createLink with an expiry. Per-restaurant folder permissions: open decision. Keep 3 years proposed (KeepPeriods)"),
 ("Photos", "Check, signature, fault and work-order photos", "Write-once, uploaded with conflictBehavior=fail; compressed on device (~300 KB). Folders {Site name}/{yyyy-MM}/{yyyy-MM-dd}/{Checklist name}/, e.g. Bunso/2026-11/2026-11-06/Opening checks/. Readable file names '{Checkpoint title} – HH:MM.jpg', ' (2)' added on a clash; folder and file names are set at upload and never renamed (a renamed checklist keeps old folders). The app links by PhotoId, never by path. Faults and work orders use {Site name}/{yyyy-MM}/{yyyy-MM-dd}/Faults/. Columns: PhotoId (IU), Kind (I), Status Active/Removed (I), RemovedAt/ById/Reason, SiteCode, BusinessDateKey, DayKey (I), RunKey, CheckpointId, AnswerKey (I), Sha256, CapturedAt, UploadedAt, UploadedById. Shown through /api/photos; URLs never stored. Small copies printed in the day PDF and inspection pack. Keep about 12 months unless tied to an incident (open decision)"),
 ("HowToMedia", "Images and short videos attached to checkpoints", "Read-only for staff"),
 ("Policies", "Handbook and policies (Word/PDF) with metadata: Category, RequiresAck, AppliesToRoles", "Major versions only; publishing a major version sends sign-off requests (Netlify Function)"),
 ("Certificates", "Staff and contractor certificates (gas CP42, TR19, EICR…)", "Linked from StaffCertificates / ComplianceItems"),
 ("Invoices", "Contractor invoice PDFs", "Finance + Admin only"),
 ("Reports", "Generated EOD and EHO inspection-pack PDFs (checklist day PDFs live in Maginhawa App Checklists)", "Written by Netlify Functions"),
 ("Archive", "Yearly CSV/list exports for archived years", "Created by the yearly archive (Netlify Scheduled Function)"),
]

spec = dict(site="Maginhawa Ops", version="0.1", lists=L, libraries=[dict(name=a, purpose=b, notes=c) for a, b, c in LIBS])
json.dump(spec, open(os.path.join(HERE, "sharepoint-lists.json"), "w"), indent=2, ensure_ascii=False)

# markdown tables
def esc(t): return str(t).replace("|", "\\|")
out = []
for g in dict.fromkeys(x["group"] for x in L):
    out.append(f"#### {g}\n")
    for x in [y for y in L if y["group"] == g]:
        idx = [c["name"] for c in x["columns"] if "I" in c["flags"] or "U" in c["flags"]]
        uniq = [c["name"] for c in x["columns"] if "U" in c["flags"]]
        flow = [c["name"] for c in x["columns"] if "F" in c["flags"]]
        out.append(f"**{x['name']}**: {x['purpose']}. *Written by:* {x['written_by']}.\n")
        out.append("| Column | Type | Notes |\n|---|---|---|")
        for c in x["columns"]:
            tags = []
            if "U" in c["flags"]: tags.append("unique")
            if "I" in c["flags"] and "U" not in c["flags"]: tags.append("indexed")
            if "R" in c["flags"]: tags.append("required")
            if "F" in c["flags"]: tags.append("set by server")
            t = f" *({', '.join(tags)})*" if tags else ""
            out.append(f"| `{c['name']}`{t} | {esc(c['type'])} | {esc(c['notes'])} |")
        warn = f" ⚠ {len(idx)} indexes, over the 20 limit" if len(idx) > 20 else ""
        out.append(f"\n*Indexed ({len(idx)}):* {', '.join(idx) or '–'}{warn}\n")
open(os.path.join(HERE, "lists.md"), "w").write("\n".join(out))
lib = "| Library | Holds | Notes |\n|---|---|---|\n" + "\n".join(f"| **{a}** | {esc(b)} | {esc(c)} |" for a, b, c in LIBS)
open(os.path.join(HERE, "libraries.md"), "w").write(lib)

# summary table
def ukey(x):
    ks=[]
    for c in x['columns']:
        if 'U' in c['flags']:
            if c['name']=='Title':
                n=c['notes']
                ks.append(n.split('=')[-1].split('(')[0].strip() if '=' in n else n.split('—')[0].strip())
            else:
                ks.append(c['name'])
    return esc(', '.join(ks)) or '–'
summ = "| Group | List | Purpose | Written by | Unique key |\n|---|---|---|---|---|\n" + "\n".join(
    f"| {x['group']} | **{x['name']}** | {esc(x['purpose'])} | {esc(x['written_by'])} | {ukey(x)} |" for x in L)
open(os.path.join(HERE, "summary.md"), "w").write(summ)
lk = max(sum(1 for c in x['columns'] if c['type'].startswith('Lookup')) for x in L)
print(len(L), 'lists; max lookups', lk, '; max indexes', max(sum(1 for c in x['columns'] if ('I' in c['flags'] or 'U' in c['flags'])) for x in L))
