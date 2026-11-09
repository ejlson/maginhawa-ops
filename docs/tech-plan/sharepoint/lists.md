#### Reference

**Sites**: One row per restaurant; drives rules, targets and settings. *Written by:* Admin (console).

| Column | Type | Notes |
|---|---|---|
| `Title` *(required)* | Text | Restaurant name, e.g. Bunso |
| `SiteCode` *(unique, required)* | Text | Short code used in keys, e.g. BUN |
| `Nation` *(required)* | Choice | England / Wales / Scotland / Northern Ireland (selects rules pack) |
| `Timezone` | Text | Europe/London |
| `FHRSId` | Number | FSA establishment id for rating sync |
| `Sessions` | Choice (multi) | Lunch, Dinner, All day |
| `VATRatePct` | Number | Default 20 |
| `WageTargetPct` | Number | Red above (default 35) |
| `WageAmberPct` | Number | Amber above (default 30) |
| `NetSalesRule` | Choice | GrossMinusSCTaxDiscounts (default) / GrossMinusSCTax — confirm with finance |
| `DayCloseTime` | Text | e.g. 23:30 — when EOD/missed-check jobs run |
| `PowerAutomateFrom` | DateTime | When head office switched the EOD flow on for this site; blank = off. Reports sent before it aren't sent to the flow |
| `Active` *(indexed)* | Yes/No | Open and trading. A closed site (e.g. Ramo) stays for its old records but drops out of pickers, counts and access |

*Indexed (2):* SiteCode, Active

**Staff**: Everyone who uses the apps, incl. kiosk-only staff without Microsoft accounts. Role and sites decide what the server lets them open. *Written by:* Head office (sites, roles) / Manager (own site's people).

| Column | Type | Notes |
|---|---|---|
| `Title` *(required)* | Text | Full name |
| `Email` *(indexed)* | Text | Microsoft account (blank for kiosk-only staff) |
| `HomeSite` *(indexed)* | Lookup → Sites | Main site: where they land after signing in |
| `OtherSites` | Lookup → Sites (multi) | Other sites they work at. Head office only |
| `AllSites` | Yes/No | Every open site, including ones opened later. Head office only |
| `Department` | Choice | Kitchen / FOH / Management / Finance / Admin |
| `Position` | Choice | Head chef, Sous chef, CDP, Commis, KP, Floor manager, Senior waiter, Waiter, Runner, Host, Bartender, RM, GM, AM, Duty manager, Supervisor |
| `AppRole` *(required)* | Choice | Staff / Supervisor / Manager / Head office (head office always has every site) |
| `PinHash` | Text | argon2 hash of 4-digit kiosk PIN (never the PIN) |
| `PreferredLanguage` | Text | en-GB default |
| `Active` *(indexed)* | Yes/No |  |

*Indexed (3):* Email, HomeSite, Active

**Devices**: Registered kiosk tablets and phones. *Written by:* Admin.

| Column | Type | Notes |
|---|---|---|
| `Title` *(required)* | Text | Label, e.g. Bunso kitchen tablet |
| `Site` *(indexed)* | Lookup → Sites |  |
| `DeviceAccount` | Text | Site device Microsoft account (UPN) |
| `Platform` | Choice | iPadOS / Android / iOS / Web |
| `LastSeen` | Date/Time | Updated by app |
| `Revoked` *(indexed)* | Yes/No | Revoked devices are refused by the app |

*Indexed (2):* Site, Revoked

**Targets**: Daily targets per site (imported from finance Excel or edited in console). *Written by:* Nightly targets import (Netlify Scheduled Function) / Finance.

| Column | Type | Notes |
|---|---|---|
| `Title` *(unique, required)* | Text | Key = SiteCode\|yyyy-mm-dd |
| `Site` *(indexed)* | Lookup → Sites |  |
| `TargetDate` *(indexed)* | Date |  |
| `NetSalesTarget` | Currency |  |
| `GrossSalesTarget` | Currency |  |
| `CoversTarget` | Number |  |
| `WagePctTarget` | Number | Overrides site default |

*Indexed (3):* Title, Site, TargetDate

**ReasonCodes**: Discount / comp / void reasons (23 discount/comp + 15 void codes from the current form). *Written by:* Finance / Admin.

| Column | Type | Notes |
|---|---|---|
| `Title` *(required)* | Text | Label, e.g. Employee Dining up to 4 Food Only |
| `Kind` *(indexed, required)* | Choice | Discount / Comp / Void |
| `Scope` | Choice | Check / Item |
| `DefaultPct` | Number | 20 / 50 / 100; blank = chosen amount |
| `IsWaste` | Yes/No | Voids: W (waste) vs NW |
| `AppliesTo` | Choice | Food / Drinks / Food & drink |
| `NotePrompt` | Text | What the note must contain |
| `ApprovalRole` | Choice | Manager / Owner |
| `SortOrder` | Number |  |
| `Active` *(indexed)* | Yes/No |  |

*Indexed (2):* Kind, Active

**DeliveryPlatforms**: Deliveroo, Uber Eats, Just Eat…. *Written by:* Finance.

| Column | Type | Notes |
|---|---|---|
| `Title` *(unique, required)* | Text | Platform name |
| `EstimatedNetPct` | Number | Replaces hard-coded 55% (net ≈ gross ÷ (1+VAT) × pct) |
| `PricesIncludeVAT` | Yes/No |  |
| `Active` | Yes/No |  |

*Indexed (1):* Title

**RulesThresholds**: Food-safety limits per nation (data, not code); consultant-verified. *Written by:* Admin (consultant sign-off).

| Column | Type | Notes |
|---|---|---|
| `Title` *(unique, required)* | Text | Key = Nation\|CheckCode |
| `Nation` *(indexed)* | Choice |  |
| `CheckCode` | Text | cold_hold, hot_hold, reheat, cook_core, freezer, cooling_stage1 … |
| `MinValue` | Number |  |
| `MaxValue` | Number |  |
| `Unit` | Text | C |
| `LegalBasis` | Text | Citation shown to EHO |
| `Verified` | Yes/No | False until checked against primary source |

*Indexed (2):* Title, Nation

#### Checklists

**ChecklistTemplates**: Checklist definitions (opening, closing, cleaning, food safety, custom). *Written by:* Admin / Manager (console builder).

| Column | Type | Notes |
|---|---|---|
| `Title` *(required)* | Text | Name |
| `TemplateId` *(unique, required)* | Text | Stable id used in run keys, e.g. closing |
| `Kind` *(indexed)* | Choice | Opening / Closing / Cleaning / Food safety / Delivery / Handover / Custom |
| `CurrentVersion` | Number | Bumped on publish; runs store the version used |
| `Status` *(indexed)* | Choice | Draft / Published / Archived |
| `SiteCodes` | Text | Where it applies, e.g. BUN;HOX (blank = every site). Text, not a lookup |

*Indexed (3):* TemplateId, Kind, Status

**Checkpoints**: Questions inside a template version — the customisable checkpoints with media. *Written by:* Admin / Manager (builder).

| Column | Type | Notes |
|---|---|---|
| `Title` *(required)* | Text | Prompt, e.g. Walk-in chiller temperature |
| `CheckpointId` *(indexed, required)* | Text | Stable id used in answer keys, e.g. walkin-temp (never reused) |
| `TemplateId` *(indexed)* | Text | ChecklistTemplates.TemplateId (text, not a lookup) |
| `TemplateVersion` *(indexed)* | Number | Published versions are never edited |
| `Position` | Number |  |
| `Section` | Text |  |
| `Guidance` | Multi-line text | 'How to do it right' description |
| `MediaLinks` | Multi-line text | Links to images/videos in HowToMedia library |
| `ResponseType` *(required)* | Choice | Yes/No, Number, Temperature, Text, Select, Multi-select, Photo, Signature, Date, Time |
| `Options` | Multi-line text | JSON for select options |
| `CheckCode` | Text | Links to RulesThresholds for pass/fail |
| `Asset` | Lookup → Assets | Optional: checkpoint about a specific unit |
| `Required` | Yes/No |  |
| `PhotoRequired` | Yes/No |  |
| `CorrectiveActionOnFail` | Yes/No |  |

*Indexed (3):* CheckpointId, TemplateId, TemplateVersion

**Schedules**: When each checklist is due at each site. *Written by:* Admin / Manager.

| Column | Type | Notes |
|---|---|---|
| `Title` | Text | Description |
| `TemplateId` *(indexed)* | Text | ChecklistTemplates.TemplateId |
| `SiteCode` *(indexed)* | Text | Sites.SiteCode |
| `DueTime` *(required)* | Text | e.g. 08:00 |
| `Days` | Choice (multi) | Mon–Sun |
| `WindowMinutes` | Number | Late after this |
| `AutoClose` | Yes/No |  |
| `AssignedRole` | Choice |  |
| `PausedFrom` | Date | Closures / refurb |
| `PausedUntil` | Date |  |
| `EffectiveFrom` *(required)* | Text | yyyy-MM-dd. Missed-day checks use the schedule that applied on that date |
| `EffectiveTo` | Text | yyyy-MM-dd; blank = still in use. Change a schedule by ending it and adding a new one |

*Indexed (2):* TemplateId, SiteCode

**ChecklistDays**: One header per open site per date: groups the day's runs and records misses (replaces DayClosures). *Written by:* Morning job creates; checklist-sync updates; nightly and weekly jobs mark Missed.

| Column | Type | Notes |
|---|---|---|
| `Title` *(unique, required)* | Text | DayKey = SiteCode\|yyyy-MM-dd, e.g. BUN\|2026-11-06 |
| `Label` | Text | For people and list search, e.g. Bunso · Fri 6 Nov 2026 |
| `SiteCode` *(indexed)* | Text |  |
| `BusinessDateKey` *(indexed)* | Text | yyyy-MM-dd; keys and range filters (Date columns shift a day in British Summer Time) |
| `BusinessDate` | Date | Display and Power BI date tables only; never filter on it |
| `Status` *(indexed)* | Choice | Due / In progress / Submitted / Late / Missed / Not trading / Deleted / Deleting. Filter by date first, then status in code |
| `NotTradingReason` | Text | Head office: closure, refurb, holiday |
| `ExpectedRuns` *(set by server)* | Number |  |
| `CompletedRuns` *(set by server)* | Number |  |
| `MissedRuns` *(set by server)* | Number |  |
| `FailedCount` *(set by server)* | Number |  |
| `OpenFixes` *(set by server)* | Number |  |
| `SubmittedAt` *(set by server)* | DateTime | Last run finished (server time) |
| `SubmittedById` *(set by server)* | Text | Entra object id (not a person column) |
| `SubmittedByName` *(set by server)* | Text |  |
| `MissedDetectedAt` *(set by server)* | DateTime | Set once by the nightly job; never cleared, even by a late submission |
| `DayHash` *(set by server)* | Text | SHA-256 over the finished runs' RunHash values |
| `Stats` *(set by server)* | Multi-line text | JSON: completion %, failures, open fixes, faults |
| `ReportItemId` *(set by server)* | Text | driveItem id of the day PDF in Maginhawa App Checklists (never a URL) |
| `ReportBuiltAt` *(set by server)* | DateTime | When the day PDF was last made; remade after any correction |
| `DeletedAt` *(set by server)* | DateTime | Soft delete |
| `DeletedById` *(set by server)* | Text |  |
| `DeletedByName` *(set by server)* | Text |  |
| `DeletedReason` *(set by server)* | Text | Required to delete; 'Moved to …' after a move |
| `StatusBeforeDelete` *(set by server)* | Text | Restore puts this back |

*Indexed (4):* Title, SiteCode, BusinessDateKey, Status

**ChecklistRuns**: One checklist (template + due time) on a day; holds the live answers while open. *Written by:* checklist-sync (Netlify Function); scheduled jobs create and mark Missed.

| Column | Type | Notes |
|---|---|---|
| `Title` *(unique, required)* | Text | RunKey = SiteCode\|yyyy-MM-dd\|templateId\|HH:MM (or \|any), e.g. BUN\|2026-11-06\|closing\|22:30 |
| `DayKey` *(indexed)* | Text | ChecklistDays key; all runs for a day = one filter on this |
| `SiteCode` *(indexed)* | Text |  |
| `BusinessDateKey` *(indexed)* | Text | yyyy-MM-dd |
| `TemplateId` | Text |  |
| `TemplateVersion` | Number |  |
| `DueTime` | Text | HH:MM or blank |
| `DueAt` | DateTime |  |
| `Status` *(indexed)* | Choice | Scheduled / In progress / Completed / Missed / Auto-closed / Cancelled / Deleted |
| `AnswersJson` *(set by server)* | Multi-line text (plain) | Snapshot of the run's answers: value, who, when, fix, corrections, per-answer seq. Saved with If-Match; the server refuses more than about 50,000 characters. Photos and signatures are ids, never base64 |
| `SchemaVersion` *(set by server)* | Number | Version of the AnswersJson shape |
| `Seq` *(set by server)* | Number | Raised on every successful write; the Finish 'seen' check compares against it |
| `RecheckOf` | Text | RunKey\|checkpointId of the failed answer |
| `CompletedAt` *(set by server)* | DateTime | Server time |
| `CompletedById` *(set by server)* | Text | Entra object id |
| `CompletedByName` *(set by server)* | Text |  |
| `DurationSeconds` *(set by server)* | Number | Pencil-whip signal |
| `FailedCount` *(set by server)* | Number |  |
| `RunHash` *(set by server)* | Text | SHA-256 of the canonical finished AnswersJson |
| `RowsStatus` *(indexed)* | Choice | Pending / Written: queue for the background writer of Responses_{yyyy} rows |
| `DeletedAt` *(set by server)* | DateTime | Soft delete of one run |
| `DeletedById` *(set by server)* | Text |  |
| `DeletedReason` *(set by server)* | Text |  |

*Indexed (6):* Title, DayKey, SiteCode, BusinessDateKey, Status, RowsStatus

**Responses_{yyyy}**: One list per business-date year (Responses_2026, Responses_2027…): one row per final answer, written at Finish and on each correction, never edited. Create every index before go-live: SharePoint Online can refuse a new index once a list passes 5,000 items, and this list passes that in about 4 days. *Written by:* Background writer (Netlify Function) only; create-only.

| Column | Type | Notes |
|---|---|---|
| `Title` *(unique, required)* | Text | RowKey = AnswerKey\|rev (rev 0 = original, 1… = corrections). A retried write gets 409, not a duplicate |
| `AnswerKey` *(indexed)* | Text | RunKey\|checkpointId |
| `DayKey` *(indexed)* | Text | Answers for one day |
| `BusinessDateKey` *(indexed)* | Text | yyyy-MM-dd; date-range exports |
| `CheckpointId` *(indexed)* | Text | One question over a year (about 2,920 rows) |
| `SiteCode` | Text |  |
| `RunKey` | Text |  |
| `TemplateId` | Text |  |
| `TemplateVersion` | Number |  |
| `CheckpointTitle` | Text | Snapshot, so later template edits don't rewrite history |
| `AnswerType` | Choice | yesno / temp / number / text / photo / choice / date / sign (ANSWER_TYPES) |
| `ValueNumber` | Number | temp, number |
| `ValueBool` | Choice | Yes / No / blank (a Yes/No column can't be blank) |
| `ValueText` | Multi-line text | text, choice |
| `ValueDateKey` | Text | yyyy-MM-dd |
| `ValueDisplay` | Text | Readable value for Excel, whatever the type |
| `Result` | Choice | Pass / Fail / None (replaces Passed) |
| `ThresholdSnapshot` | Text | Min/max/legal basis used, frozen |
| `Source` | Choice | Manual / Bluetooth probe / Camera OCR |
| `CapturedLive` | Yes/No | In-app camera, not gallery |
| `PhotoIds` | Text | PhotoId values (; separated). Replaces PhotoUrl: links expire, ids don't |
| `PhotoItemIds` | Text | driveItem ids in the Photos library |
| `PhotoSha256` | Text | Detects reused photos |
| `AnsweredById` | Text | Entra object id |
| `AnsweredByName` | Text |  |
| `AnsweredAt` | DateTime | Capped at server time |
| `ReceivedAt` | DateTime | Server time the answer reached us (offline answers arrive later) |
| `Rev` | Number | 0 = original |
| `Supersedes` | Text | RowKey of the row this corrects |
| `CorrectionReason` | Text | Required when Rev > 0 |
| `CorrectedAt` | DateTime | Server time |

*Indexed (5):* Title, AnswerKey, DayKey, BusinessDateKey, CheckpointId

**CorrectiveActions**: What was done about a failed check. *Written by:* App + Netlify Functions (checklist check, re-check and escalation).

| Column | Type | Notes |
|---|---|---|
| `Title` *(required)* | Text | Short description |
| `AnswerKey` *(indexed)* | Text | RunKey\|checkpointId of the failed answer (replaces the Response lookup) |
| `DayKey` *(indexed)* | Text |  |
| `SiteCode` *(indexed)* | Text |  |
| `ActionTaken` | Multi-line text |  |
| `FoodDisposed` | Yes/No |  |
| `Status` *(indexed)* | Choice | Open / Action taken / Verified / Escalated |
| `RecheckDue` *(indexed)* | Date/Time |  |
| `WorkOrder` | Lookup → WorkOrders | Set when escalated |
| `VerifiedById` | Text | Entra object id |
| `VerifiedByName` | Text |  |

*Indexed (5):* AnswerKey, DayKey, SiteCode, Status, RecheckDue

**ChecklistAudit**: Restores, moves and hard deletes of checklist days; kept when the day itself is hard-deleted. *Written by:* Netlify Functions only.

| Column | Type | Notes |
|---|---|---|
| `Title` *(unique, required)* | Text | DayKey\|action\|timestamp |
| `DayKey` *(indexed)* | Text |  |
| `Action` *(required)* | Choice | Soft delete / Restore / Move / Hard delete started / Hard delete finished |
| `Reason` *(required)* | Text |  |
| `ById` *(required)* | Text | Entra object id |
| `ByName` | Text |  |
| `At` *(required)* | DateTime | Server time |
| `Counts` | Text | JSON: runs, rows, photos, corrective actions affected |
| `MovedTo` | Text | New DayKey after a move |

*Indexed (2):* Title, DayKey

**HandoverNotes**: Shift handover log. *Written by:* App.

| Column | Type | Notes |
|---|---|---|
| `Title` | Text | Summary |
| `Site` *(indexed)* | Lookup → Sites |  |
| `BusinessDate` *(indexed)* | Date |  |
| `Body` | Multi-line text |  |
| `Author` | Lookup → Staff |  |

*Indexed (2):* Site, BusinessDate

#### Food safety

**Dishes**: Every dish on a menu, for the allergen matrix. *Written by:* Manager / Head office.

| Column | Type | Notes |
|---|---|---|
| `Title` *(required)* | Text | Dish name |
| `Site` *(indexed)* | Lookup → Sites | Blank = on every site's menu |
| `Course` | Text | Starters, Mains, Desserts… |
| `CurrentVersion` | Number | Latest AllergenVersions.Version |
| `Active` *(indexed)* | Yes/No |  |

*Indexed (2):* Site, Active

**AllergenVersions**: Each version of a dish's 14-allergen list; never edited or deleted. *Written by:* Manager / Head office (append-only).

| Column | Type | Notes |
|---|---|---|
| `Title` *(unique, required)* | Text | DishId\|Version |
| `Dish` *(indexed)* | Lookup → Dishes |  |
| `Version` *(required)* | Number | 1, 2, 3… |
| `Allergens` | Choice (multi) | The 14: Celery, Cereals with gluten, Crustaceans, Eggs, Fish, Lupin, Milk, Molluscs, Mustard, Tree nuts, Peanuts, Sesame, Soya, Sulphites |
| `ChangeNote` | Text | Why it changed, e.g. new supplier |
| `ChangedBy` | Lookup → Staff |  |

*Indexed (2):* Title, Dish

**AllergenReads**: Who has confirmed reading which version of a dish. *Written by:* App.

| Column | Type | Notes |
|---|---|---|
| `Title` *(unique, required)* | Text | DishId\|StaffId |
| `Dish` *(indexed)* | Lookup → Dishes |  |
| `Staff` *(indexed)* | Lookup → Staff |  |
| `VersionRead` | Number |  |

*Indexed (3):* Title, Dish, Staff

**CookingLogs**: Core temperatures on cooking and reheating, and the cooling timer. *Written by:* App.

| Column | Type | Notes |
|---|---|---|
| `Title` *(unique, required)* | Text | ClientId |
| `Site` *(indexed)* | Lookup → Sites |  |
| `BusinessDate` *(indexed)* | Date |  |
| `Dish` *(required)* | Text | Dish or batch |
| `Kind` | Choice | Cook / Reheat |
| `CoreTempC` *(required)* | Number | 75°C or above (guidance) |
| `Probe` | Lookup → Probes |  |
| `CoolingStartedAt` | Date/Time | Blank if served or hot-held |
| `CoolingReadings` | Multi-line text | JSON [{at, tempC}] |
| `InFridgeAt` | Date/Time | Due within 90 minutes of CoolingStartedAt |
| `RecordedBy` | Lookup → Staff |  |

*Indexed (3):* Title, Site, BusinessDate

**Probes**: Temperature probes per site. *Written by:* Manager.

| Column | Type | Notes |
|---|---|---|
| `Title` *(required)* | Text | e.g. Probe 2 · kitchen |
| `Site` *(indexed)* | Lookup → Sites |  |
| `Asset` | Lookup → Assets | Optional |
| `Retired` | Yes/No |  |

*Indexed (1):* Site

**ProbeCalibrations**: Weekly iced-water (−1 to 1°C) and boiling-water (99 to 101°C) readings. *Written by:* App.

| Column | Type | Notes |
|---|---|---|
| `Title` *(unique, required)* | Text | ClientId |
| `Probe` *(indexed)* | Lookup → Probes |  |
| `Site` *(indexed)* | Lookup → Sites |  |
| `CheckedOn` *(indexed)* | Date |  |
| `IceC` *(required)* | Number |  |
| `BoilC` *(required)* | Number |  |
| `Passed` | Yes/No | Set by the app from the ranges in packages/core |
| `CheckedBy` | Lookup → Staff |  |

*Indexed (4):* Title, Probe, Site, CheckedOn

**Suppliers**: Approved suppliers. *Written by:* Head office.

| Column | Type | Notes |
|---|---|---|
| `Title` *(unique, required)* | Text | Supplier name |
| `Approved` *(indexed)* | Yes/No |  |
| `Notes` | Multi-line text | Certificates, audits |

*Indexed (2):* Title, Approved

**Deliveries**: Goods received, with chilled temperature and packaging. *Written by:* App.

| Column | Type | Notes |
|---|---|---|
| `Title` *(unique, required)* | Text | ClientId |
| `Site` *(indexed)* | Lookup → Sites |  |
| `Supplier` *(indexed)* | Lookup → Suppliers |  |
| `ReceivedAt` *(indexed)* | Date/Time |  |
| `ChilledC` | Number | 8°C or below |
| `PackagingOk` | Yes/No |  |
| `Rejected` | Multi-line text | Items sent back |
| `ReceivedBy` | Lookup → Staff |  |

*Indexed (4):* Title, Site, Supplier, ReceivedAt

**DeliveryItems**: Each item's batch code and use-by date, for tracing and recalls. *Written by:* App.

| Column | Type | Notes |
|---|---|---|
| `Title` *(required)* | Text | Item name |
| `Delivery` *(indexed)* | Lookup → Deliveries |  |
| `Site` *(indexed)* | Lookup → Sites |  |
| `BatchCode` *(indexed)* | Text | Matched against FoodAlerts |
| `UseBy` | Date |  |

*Indexed (3):* Delivery, Site, BatchCode

**FoodAlerts**: FSA food alerts and recalls (entered by head office). *Written by:* Head office.

| Column | Type | Notes |
|---|---|---|
| `Title` *(required)* | Text | Alert title |
| `Reason` | Text | e.g. undeclared milk |
| `IssuedOn` *(indexed)* | Date |  |
| `Batches` | Multi-line text | One per line: exact code or a range 'CM-4460 to CM-4479' |
| `SourceUrl` | Hyperlink | food.gov.uk alert page |

*Indexed (1):* IssuedOn

**AlertActions**: What each site did about an alert that matched its deliveries. *Written by:* App.

| Column | Type | Notes |
|---|---|---|
| `Title` *(unique, required)* | Text | AlertId\|SiteCode |
| `Alert` *(indexed)* | Lookup → FoodAlerts |  |
| `Site` *(indexed)* | Lookup → Sites |  |
| `Action` *(required)* | Choice | Set aside / Sent back / Not in stock |
| `ActionBy` | Lookup → Staff |  |

*Indexed (3):* Title, Alert, Site

**Complaints**: Customer complaints about food (Food Safety Act s.14). *Written by:* Supervisor / Manager.

| Column | Type | Notes |
|---|---|---|
| `Title` *(unique, required)* | Text | ClientId |
| `Site` *(indexed)* | Lookup → Sites |  |
| `ReceivedAt` *(indexed)* | Date/Time |  |
| `Kind` *(required)* | Choice | Foreign body / Felt ill / Allergic reaction / Not what I ordered / Undercooked / Other |
| `Dish` | Text |  |
| `Batch` | Text |  |
| `Details` *(required)* | Multi-line text |  |
| `Photos` | Multi-line text | Photo library links |
| `ItemKept` | Yes/No |  |
| `Actions` | Choice (multi) | Replaced / Refunded / Checked the batch / Took the dish off / Told the head chef |
| `CustomerContact` | Text | Only with consent; never in inspector packs; cleared after the keep period |
| `RecordedBy` | Lookup → Staff |  |

*Indexed (3):* Title, Site, ReceivedAt

**Inspections**: Inspector visits and hygiene ratings. *Written by:* Manager / Head office.

| Column | Type | Notes |
|---|---|---|
| `Title` *(required)* | Text | Who visited |
| `Site` *(indexed)* | Lookup → Sites |  |
| `VisitedOn` *(indexed)* | Date |  |
| `Rating` | Number | 0–5, blank if not rated |
| `Outcome` | Multi-line text |  |
| `ReportLink` | Hyperlink | Reports library |

*Indexed (2):* Site, VisitedOn

**Notices**: Improvement / prohibition notices and warnings, with deadlines. *Written by:* Manager / Head office.

| Column | Type | Notes |
|---|---|---|
| `Title` *(required)* | Text | What it's about |
| `Site` *(indexed)* | Lookup → Sites |  |
| `Inspection` | Lookup → Inspections |  |
| `Kind` *(required)* | Choice | Improvement notice / Prohibition notice / Written warning |
| `ServedOn` | Date |  |
| `FixBy` *(indexed)* | Date | Reminder 7 days before |
| `AppealBy` | Date | Reminder 7 days before |
| `ClosedOn` *(indexed)* | Date |  |
| `WorkOrder` | Lookup → WorkOrders | Optional repair job |

*Indexed (3):* Site, FixBy, ClosedOn

**SafetyReviews**: 4-weekly food-safety review per site. *Written by:* Manager.

| Column | Type | Notes |
|---|---|---|
| `Title` *(unique, required)* | Text | SiteCode\|yyyy-mm-dd |
| `Site` *(indexed)* | Lookup → Sites |  |
| `ReviewedOn` *(indexed)* | Date |  |
| `RepeatFaults` | Multi-line text | JSON snapshot of the repeat faults shown |
| `Answers` | Multi-line text | JSON {dishes, staff, equipment} |
| `ReviewedBy` | Lookup → Staff |  |

*Indexed (3):* Title, Site, ReviewedOn

**KeepPeriods**: How long each kind of record is kept; nothing is cleared without head office approval. *Written by:* Head office.

| Column | Type | Notes |
|---|---|---|
| `Title` *(unique, required)* | Text | Record type: checks, faults, allergens, complaints, training, fitness, inspections |
| `Months` *(required)* | Number | Suggested defaults in packages/core DEFAULT_KEEP. Proposed: checks 36 (3 years: Food Safety Act s.34 prosecutions and injury claims both have 3-year limits; DEFAULT_KEEP still says 24 until agreed); check photos 12 unless tied to an incident |
| `FromLeaving` | Yes/No | Counted from when the person leaves |

*Indexed (1):* Title

#### Maintenance

**Assets**: Equipment register with QR sticker per unit. *Written by:* Manager / Admin.

| Column | Type | Notes |
|---|---|---|
| `Title` *(required)* | Text | e.g. Walk-in chiller |
| `Site` *(indexed)* | Lookup → Sites |  |
| `Category` *(indexed)* | Choice | Refrigeration, Cooking, Extraction, Gas, Electrical, Dishwash, Ice, Coffee, Lift, Other |
| `Make` | Text |  |
| `Model` | Text |  |
| `SerialNumber` | Text |  |
| `QRCode` *(unique)* | Text | Value on the sticker |
| `InstallDate` | Date |  |
| `WarrantyExpires` *(indexed)* | Date |  |
| `DefaultContractor` | Lookup → Contractors |  |
| `PhotoUrl` | Hyperlink |  |
| `Retired` | Yes/No |  |

*Indexed (4):* Site, Category, QRCode, WarrantyExpires

**Contractors**: Refrigeration, gas, electrical, extraction, pest…. *Written by:* Manager / Admin.

| Column | Type | Notes |
|---|---|---|
| `Title` *(required)* | Text | Company |
| `Trade` *(indexed)* | Choice |  |
| `ContactName` | Text |  |
| `Phone` | Text |  |
| `Email` | Text |  |
| `GasSafeNumber` | Text |  |
| `Accreditation` | Text | e.g. BESA TR19 |

*Indexed (1):* Trade

**WorkOrders**: Repairs: from fault report, failed check, statutory due or EOD note. *Written by:* App + Netlify Functions (escalation, contractor emails).

| Column | Type | Notes |
|---|---|---|
| `Title` *(unique, required)* | Text | Reference WO-2026-00123 |
| `Site` *(indexed)* | Lookup → Sites |  |
| `Asset` *(indexed)* | Lookup → Assets |  |
| `Summary` *(required)* | Text |  |
| `Description` | Multi-line text |  |
| `Source` | Choice | Fault report / Failed check / Statutory / Planned / EOD note / AI warning |
| `SourceAnswerKey` | Text | AnswerKey (RunKey\|checkpointId) when source = failed check |
| `Priority` *(indexed)* | Choice | Low / Normal / High / Urgent |
| `Status` *(indexed)* | Choice | Reported / Triaged / Dispatched / Scheduled / In progress / Awaiting parts / Resolved / Closed / Cancelled |
| `Contractor` | Lookup → Contractors |  |
| `ReportedBy` | Lookup → Staff |  |
| `DispatchedAt` | Date/Time |  |
| `AttendedAt` | Date/Time |  |
| `ResolvedAt` | Date/Time |  |
| `PhotoUrls` | Multi-line text |  |
| `History` | Multi-line text (append) | Timeline notes (append changes on) |

*Indexed (5):* Title, Site, Asset, Priority, Status

**ComplianceItems**: Statutory calendar: gas CP42, TR19, EICR, fire alarm, emergency lighting, LOLER, PSSR, legionella, pest. *Written by:* Admin / reminders (Netlify Scheduled Function).

| Column | Type | Notes |
|---|---|---|
| `Title` *(required)* | Text | Requirement name |
| `Site` *(indexed)* | Lookup → Sites |  |
| `Asset` | Lookup → Assets | Optional |
| `RequirementCode` | Choice |  |
| `IntervalMonths` | Number | [verify] per requirement |
| `LastDone` | Date |  |
| `NextDue` *(indexed)* | Date |  |
| `Contractor` | Lookup → Contractors |  |
| `CertificateLink` | Hyperlink | Certificates library |
| `Verified` | Yes/No | Interval checked by consultant |

*Indexed (2):* Site, NextDue

**Invoices**: Contractor invoices for the Finance role. *Written by:* Finance.

| Column | Type | Notes |
|---|---|---|
| `Title` *(required)* | Text | Invoice number |
| `Contractor` *(indexed)* | Lookup → Contractors |  |
| `WorkOrder` *(indexed)* | Lookup → WorkOrders |  |
| `Asset` *(indexed)* | Lookup → Assets |  |
| `InvoiceDate` *(indexed)* | Date |  |
| `Net` | Currency |  |
| `VAT` | Currency |  |
| `Gross` | Currency |  |
| `DocumentLink` | Hyperlink | Invoices library |
| `ApprovedBy` | Lookup → Staff |  |
| `ExportedAt` | Date/Time | To Xero / QuickBooks / Sage (phase 2) |

*Indexed (4):* Contractor, WorkOrder, Asset, InvoiceDate

**VisitorLog**: Contractor and visitor sign-in. *Written by:* App.

| Column | Type | Notes |
|---|---|---|
| `Title` *(required)* | Text | Visitor name |
| `Site` *(indexed)* | Lookup → Sites |  |
| `Company` | Text |  |
| `Purpose` | Text |  |
| `WorkOrder` | Lookup → WorkOrders |  |
| `SignedIn` *(indexed)* | Date/Time |  |
| `SignedOut` | Date/Time |  |
| `HealthDeclaration` | Yes/No | Food-handler fitness questions answered |

*Indexed (2):* Site, SignedIn

#### Trading (EOD)

**TradingDays**: One per site per service date — replaces the Netlify form's Excel row. *Written by:* App creates; submit-eod (Netlify Function) writes official totals.

| Column | Type | Notes |
|---|---|---|
| `Title` *(unique, required)* | Text | Key = SiteCode\|yyyy-mm-dd (blocks duplicates) |
| `Site` *(indexed)* | Lookup → Sites |  |
| `BusinessDate` *(indexed)* | Date |  |
| `Status` *(indexed)* | Choice | Draft / Submitted / Checked / Approved / SentBack / Reopened. The app writes Draft, Submitted, Approved and SentBack |
| `WageCost` | Currency |  |
| `NextShiftNotes` | Multi-line text |  |
| `SubmittedBy` | Lookup → Staff | Signed-in user, not typed |
| `SubmittedAt` | Date/Time |  |
| `ApprovedBy` | Lookup → Staff | Who last approved or sent it back. Set only with If-Match, so two reviewers can't both win |
| `ReviewedAt` *(set by server)* | Date/Time | When it was approved or sent back |
| `TotalGross` *(set by server)* | Currency |  |
| `TotalNet` *(set by server)* | Currency |  |
| `DineInNet` *(set by server)* | Currency |  |
| `Covers` *(set by server)* | Number |  |
| `ASPHNet` *(set by server)* | Currency |  |
| `ASPHGross` *(set by server)* | Currency |  |
| `FoodPct` *(set by server)* | Number |  |
| `DrinkPct` *(set by server)* | Number |  |
| `WagePct` *(set by server)* | Number |  |
| `WageRAG` *(set by server)* | Choice | Green / Amber / Red |
| `NetVsTarget` *(set by server)* | Currency |  |
| `CheckIssues` *(set by server)* | Multi-line text | Problems found by the server (e.g. discount lines ≠ EPOS total) |
| `CalcVersion` *(set by server)* | Text | Formula version used |
| `DraftJson` | Multi-line text | The whole report between saves. Every save is PATCH with If-Match: <item ETag>, so a stale save gets 412 and is merged by section |
| `SectionStamps` | Multi-line text | JSON: who last changed each section, and when (e.g. Jo changed Dinner at 21:14) |
| `SubmitId` | Text | The submit press that won; a retry of the same press is a no-op |

*Indexed (4):* Title, Site, BusinessDate, Status

**EmailLog**: One row per EOD summary emailed to finance. Separate from TradingDays so stamping it never changes the report's ETag. *Written by:* submit-eod and the email-retry job (Netlify Functions).

| Column | Type | Notes |
|---|---|---|
| `Title` *(unique, required)* | Text | Key = SiteCode\|yyyy-mm-dd\|SubmitId: one email per submit, a second insert fails (unique) |
| `TradingDay` *(indexed)* | Lookup → TradingDays |  |
| `SentAt` *(required, set by server)* | Date/Time | Server time |

*Indexed (2):* Title, TradingDay

**FlowOutbox**: One message per submitted EOD for the Power Automate flow "EOD submitted" (flows/MaginhawaOps). The server never calls a flow: the flow starts on a new row, so there is no trigger URL and no Premium licence. *Written by:* submit-eod and the email-retry job add rows; the flow sets Status, ProcessedAt, RunId and Error.

| Column | Type | Notes |
|---|---|---|
| `Title` *(unique, required)* | Text | Key = SiteCode\|yyyy-mm-dd\|SubmitId: one message per submit, a second insert fails (unique) |
| `SiteCode` *(set by server)* | Text |  |
| `BusinessDate` *(set by server)* | Date |  |
| `Schema` *(set by server)* | Text | e.g. maginhawa.eod.submitted/1; the flow refuses one it doesn't know |
| `Payload` *(set by server)* | Multi-line text | The message as JSON (flowMessage in packages/core/src/flow.ts). No handover notes. Not required in SharePoint, so the flow's Update item only sends Title and Status |
| `Status` *(indexed, required)* | Choice | Queued / Done / Failed. The flow's trigger only takes Queued |
| `QueuedAt` *(set by server)* | Date/Time | Server time |
| `ProcessedAt` | Date/Time | Set by the flow |
| `RunId` | Text | The flow run, to find it in run history |
| `Error` | Multi-line text | Set by the flow when it fails; fix, then set Status back to Queued to run it again |

*Indexed (2):* Title, Status

**TradingSessions**: Lunch / dinner figures and cash. *Written by:* App; submit-eod adds net & variance.

| Column | Type | Notes |
|---|---|---|
| `Title` *(unique, required)* | Text | Key = SiteCode\|yyyy-mm-dd\|Session |
| `TradingDay` *(indexed)* | Lookup → TradingDays |  |
| `Site` *(indexed)* | Lookup → Sites |  |
| `BusinessDate` *(indexed)* | Date |  |
| `Session` | Choice | Lunch / Dinner / All day |
| `Gross` | Currency |  |
| `ServiceCharge` | Currency |  |
| `Tax` | Currency |  |
| `DiscountsComps` | Currency | EPOS total; reconciled to Adjustments |
| `FoodSales` | Currency |  |
| `DrinkSales` | Currency |  |
| `BookedCovers` | Number | 'Starting covers' in old form |
| `Walkins` | Number |  |
| `CashInEpos` | Currency |  |
| `CashCollected` | Currency |  |
| `CashExplanation` | Multi-line text | Required by app if variance > 1p |
| `Net` *(set by server)* | Currency | Gross − SC − tax − discounts |
| `Covers` *(set by server)* | Number |  |
| `CashVariance` *(set by server)* | Currency | Collected − EPOS |

*Indexed (4):* Title, TradingDay, Site, BusinessDate

**Adjustments**: Discounts, comps and voids as rows (were text blobs). *Written by:* App.

| Column | Type | Notes |
|---|---|---|
| `Title` *(unique, required)* | Text | ClientId (UUID) |
| `TradingSession` *(indexed)* | Lookup → TradingSessions |  |
| `Site` *(indexed)* | Lookup → Sites |  |
| `BusinessDate` *(indexed)* | Date |  |
| `Kind` *(indexed)* | Choice | Discount / Comp / Void |
| `ReasonCode` *(required)* | Lookup → ReasonCodes |  |
| `GuestOrStaffName` | Text |  |
| `Items` | Text |  |
| `SaleAmount` | Currency |  |
| `Amount` *(required)* | Currency |  |
| `Time` | Text |  |
| `PerformedBy` | Lookup → Staff | 'Voided by' |
| `ApprovedBy` | Lookup → Staff | Real user |
| `Notes` | Multi-line text |  |

*Indexed (5):* Title, TradingSession, Site, BusinessDate, Kind

**DeliverySales**: Per platform per day. *Written by:* App; submit-eod adds estimated net.

| Column | Type | Notes |
|---|---|---|
| `Title` *(unique, required)* | Text | Key = SiteCode\|yyyy-mm-dd\|Platform |
| `TradingDay` *(indexed)* | Lookup → TradingDays |  |
| `Platform` | Lookup → DeliveryPlatforms |  |
| `Gross` | Currency |  |
| `EstimatedNet` *(set by server)* | Currency |  |
| `ActualPayout` | Currency | From platform statement (later) |
| `CurrentPromotion` | Text |  |

*Indexed (2):* Title, TradingDay

**DeliveryRefunds**: Refund requests from delivery platforms. *Written by:* App.

| Column | Type | Notes |
|---|---|---|
| `Title` | Text | Summary |
| `TradingDay` *(indexed)* | Lookup → TradingDays |  |
| `Platform` | Lookup → DeliveryPlatforms |  |
| `Amount` *(required)* | Currency |  |
| `Details` | Multi-line text |  |
| `Issued` *(indexed)* | Choice | Yes / No / Pending |

*Indexed (2):* TradingDay, Issued

**ShiftStaff**: Who worked each session (fixes lunch managers being dropped). *Written by:* App (rota later).

| Column | Type | Notes |
|---|---|---|
| `Title` *(required)* | Text | Name |
| `TradingSession` *(indexed)* | Lookup → TradingSessions |  |
| `Staff` | Lookup → Staff | Blank if no account |
| `Department` | Choice | Kitchen / FOH / Management |
| `Position` | Choice |  |
| `Hours` | Number |  |

*Indexed (1):* TradingSession

**Feedback**: Service, kitchen, staff, complaints, maintenance notes. *Written by:* App; submit-eod links work orders.

| Column | Type | Notes |
|---|---|---|
| `Title` | Text | Category |
| `TradingDay` *(indexed)* | Lookup → TradingDays |  |
| `Category` *(indexed)* | Choice | Service / Kitchen / Staff / Complaints / Maintenance |
| `Body` *(required)* | Multi-line text |  |
| `WorkOrder` *(set by server)* | Lookup → WorkOrders | Created by submit-eod for urgent maintenance |

*Indexed (2):* TradingDay, Category

#### Forecasting

**BookingSnapshots**: Covers on the books for the next 14 days, saved every night. Can't be rebuilt later, so it starts before forecasting does. *Written by:* Nightly function (nightly-snapshot).

| Column | Type | Notes |
|---|---|---|
| `Title` *(unique, required)* | Text | Key = SiteCode\|TakenOn\|ForDate\|Session |
| `Site` *(indexed)* | Lookup → Sites |  |
| `TakenOn` *(indexed)* | Date | Trading day the snapshot was taken (after close) |
| `ForDate` *(indexed)* | Date | Trading day the bookings are for |
| `LeadDays` | Number | ForDate − TakenOn, 1–14 |
| `Session` | Choice | Lunch / Dinner |
| `Covers` | Number | Covers booked |
| `Bookings` | Number | Number of bookings (parties) |
| `Source` | Text | Reservations system the figures came from |

*Indexed (4):* Title, Site, TakenOn, ForDate

**ForecastLog**: Every forecast shown, kept so accuracy can be measured honestly. *Written by:* Nightly function (nightly-forecast).

| Column | Type | Notes |
|---|---|---|
| `Title` *(unique, required)* | Text | Key = SiteCode\|MadeOn\|ForDate\|Service\|Metric\|Method |
| `Site` *(indexed)* | Lookup → Sites |  |
| `MadeOn` *(indexed)* | Date | Trading day the forecast was made (after close) |
| `ForDate` *(indexed)* | Date |  |
| `Horizon` | Number | Days ahead, 1–14 |
| `Service` | Choice | Lunch / Dinner / Delivery |
| `Metric` | Choice | Net / Covers |
| `Method` *(indexed)* | Choice | v1 (published) / Holt-Winters (hidden challenger) / Same weekday last week (baseline) |
| `Version` | Text | Code version, e.g. forecast-v1.0 |
| `P50` | Number | Central forecast (pence for Net) |
| `P10` | Number | Low end of the 80% likely range |
| `P90` | Number | High end of the 80% likely range |
| `Confidence` | Choice | Normal / Low (little history) |
| `Reasons` | Text | Why, e.g. 'Median of 6 Fridays · trend +4% · bank holiday' |

*Indexed (5):* Title, Site, MadeOn, ForDate, Method

#### People & handbook

**PolicyAcknowledgements**: E-signed policy sign-offs. *Written by:* App.

| Column | Type | Notes |
|---|---|---|
| `Title` *(unique, required)* | Text | Key = PolicyFileId\|Version\|StaffId |
| `PolicyFileId` *(indexed)* | Number | Item id in Policies library |
| `PolicyVersion` | Text | Library version label at signing |
| `Staff` *(indexed)* | Lookup → Staff |  |
| `AcknowledgedAt` | Date/Time |  |
| `Device` | Lookup → Devices |  |
| `SignatureJson` | Multi-line text |  |

*Indexed (3):* Title, PolicyFileId, Staff

**StaffCertificates**: Level 2/3 food hygiene, personal licence, first aid…. *Written by:* Manager.

| Column | Type | Notes |
|---|---|---|
| `Title` *(required)* | Text | Certificate type |
| `Staff` *(indexed)* | Lookup → Staff |  |
| `Issuer` | Text |  |
| `IssuedOn` | Date |  |
| `ExpiresOn` *(indexed)* | Date |  |
| `DocumentLink` | Hyperlink | Certificates library |

*Indexed (2):* Staff, ExpiresOn

**FitnessToWork**: Illness exclusion / return to work — restricted to Owner/Admin. *Written by:* Manager (restricted list).

| Column | Type | Notes |
|---|---|---|
| `Title` *(required)* | Text | Staff name |
| `Staff` *(indexed)* | Lookup → Staff |  |
| `ReportedOn` | Date |  |
| `SymptomsCategory` | Choice | Minimal data — no free-text diagnosis |
| `ExcludedUntil` | Date |  |
| `ClearedBy` | Lookup → Staff |  |
| `ClearedOn` | Date |  |

*Indexed (1):* Staff
