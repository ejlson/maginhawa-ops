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
| `Active` *(indexed)* | Yes/No |  |

*Indexed (2):* SiteCode, Active

**Staff**: Everyone who uses the apps, incl. kiosk-only staff without Microsoft accounts. *Written by:* Admin / Manager.

| Column | Type | Notes |
|---|---|---|
| `Title` *(required)* | Text | Full name |
| `Email` *(indexed)* | Text | Microsoft account (blank for kiosk-only staff) |
| `HomeSite` *(indexed)* | Lookup → Sites |  |
| `Department` | Choice | Kitchen / FOH / Management / Finance / Admin |
| `Position` | Choice | Head chef, Sous chef, CDP, Commis, KP, Floor manager, Senior waiter, Waiter, Runner, Host, Bartender, RM, GM, AM, Duty manager, Supervisor |
| `AppRole` *(required)* | Choice | Staff / Manager / Admin / Finance / Owner |
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

**Targets**: Daily targets per site (imported from finance Excel or edited in console). *Written by:* Flow F09 / Finance.

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
| `Kind` *(indexed)* | Choice | Opening / Closing / Cleaning / Food safety / Delivery / Handover / Custom |
| `CurrentVersion` | Number | Bumped on publish; runs store the version used |
| `Status` *(indexed)* | Choice | Draft / Published / Archived |
| `Sites` | Lookup (multi) → Sites | Where it applies |

*Indexed (2):* Kind, Status

**Checkpoints**: Questions inside a template version — the customisable checkpoints with media. *Written by:* Admin / Manager (builder).

| Column | Type | Notes |
|---|---|---|
| `Title` *(required)* | Text | Prompt, e.g. Walk-in chiller temperature |
| `Template` *(indexed)* | Lookup → ChecklistTemplates |  |
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

*Indexed (2):* Template, TemplateVersion

**Schedules**: When each checklist is due at each site. *Written by:* Admin / Manager.

| Column | Type | Notes |
|---|---|---|
| `Title` | Text | Description |
| `Template` *(indexed)* | Lookup → ChecklistTemplates |  |
| `Site` *(indexed)* | Lookup → Sites |  |
| `DueTime` *(required)* | Text | e.g. 08:00 |
| `Days` | Choice (multi) | Mon–Sun |
| `WindowMinutes` | Number | Late after this |
| `AutoClose` | Yes/No |  |
| `AssignedRole` | Choice |  |
| `PausedFrom` | Date | Closures / refurb |
| `PausedUntil` | Date |  |

*Indexed (2):* Template, Site

**ChecklistRuns**: One instance of a checklist on a day (created each morning by flow F02). *Written by:* Flow F02 creates; app completes.

| Column | Type | Notes |
|---|---|---|
| `Title` *(unique, required)* | Text | Key = SiteCode\|yyyy-mm-dd\|ScheduleId |
| `Site` *(indexed)* | Lookup → Sites |  |
| `BusinessDate` *(indexed)* | Date |  |
| `Template` | Lookup → ChecklistTemplates |  |
| `TemplateVersion` | Number |  |
| `DueAt` | Date/Time |  |
| `Status` *(indexed)* | Choice | Scheduled / In progress / Completed / Missed / Auto-closed / Cancelled |
| `CompletedBy` | Lookup → Staff |  |
| `CompletedAt` | Date/Time |  |
| `DurationSeconds` | Number | Pencil-whip signal |
| `FailedCount` *(set by flow)* | Number | Set by flow F04 |

*Indexed (4):* Title, Site, BusinessDate, Status

**Responses**: Every answer — the compliance record (largest list). *Written by:* App (append-only by convention + Purview record label).

| Column | Type | Notes |
|---|---|---|
| `Title` *(unique, required)* | Text | ClientId — UUID from the device; makes offline retries idempotent |
| `Run` *(indexed)* | Lookup → ChecklistRuns |  |
| `Site` *(indexed)* | Lookup → Sites |  |
| `BusinessDate` *(indexed)* | Date |  |
| `CheckpointId` | Number | Checkpoint item id |
| `ValueNumber` | Number |  |
| `ValueText` | Multi-line text | Text / select / signature JSON |
| `Passed` *(indexed)* | Yes/No | App preview; confirmed by flow F04 |
| `ThresholdSnapshot` | Text | Min/max/legal basis used, frozen |
| `Source` | Choice | Manual / Bluetooth probe / Camera OCR |
| `PhotoUrl` | Hyperlink | Photos library |
| `PhotoSha256` | Text | Detects reused photos |
| `CapturedLive` | Yes/No | In-app camera, not gallery |
| `RecordedBy` | Lookup → Staff |  |
| `Device` | Lookup → Devices |  |
| `ClientRecordedAt` | Date/Time | Device clock (Created = server time) |
| `Supersedes` | Number | Id of the response this corrects (never edit in place) |
| `CorrectionReason` | Text |  |

*Indexed (5):* Title, Run, Site, BusinessDate, Passed

**CorrectiveActions**: What was done about a failed check. *Written by:* App + flows F04/F05.

| Column | Type | Notes |
|---|---|---|
| `Title` *(required)* | Text | Short description |
| `Response` *(indexed)* | Lookup → Responses |  |
| `Site` *(indexed)* | Lookup → Sites |  |
| `ActionTaken` | Multi-line text |  |
| `FoodDisposed` | Yes/No |  |
| `Status` *(indexed)* | Choice | Open / Action taken / Verified / Escalated |
| `RecheckDue` *(indexed)* | Date/Time |  |
| `WorkOrder` | Lookup → WorkOrders | Set when escalated |
| `VerifiedBy` | Lookup → Staff |  |

*Indexed (4):* Response, Site, Status, RecheckDue

**DayClosures**: Ops end-of-day sign-off per site. *Written by:* App + flow F01.

| Column | Type | Notes |
|---|---|---|
| `Title` *(unique, required)* | Text | Key = SiteCode\|yyyy-mm-dd |
| `Site` *(indexed)* | Lookup → Sites |  |
| `BusinessDate` *(indexed)* | Date |  |
| `ClosedBy` | Lookup → Staff | Blank = auto-closed |
| `Stats` *(set by flow)* | Multi-line text | JSON: completion %, failures, open CAs, faults |
| `ReportLink` *(set by flow)* | Hyperlink | PDF in Reports library |

*Indexed (3):* Title, Site, BusinessDate

**HandoverNotes**: Shift handover log. *Written by:* App.

| Column | Type | Notes |
|---|---|---|
| `Title` | Text | Summary |
| `Site` *(indexed)* | Lookup → Sites |  |
| `BusinessDate` *(indexed)* | Date |  |
| `Body` | Multi-line text |  |
| `Author` | Lookup → Staff |  |

*Indexed (2):* Site, BusinessDate

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

**WorkOrders**: Repairs: from fault report, failed check, statutory due or EOD note. *Written by:* App + flows F05/F06.

| Column | Type | Notes |
|---|---|---|
| `Title` *(unique, required)* | Text | Reference WO-2026-00123 |
| `Site` *(indexed)* | Lookup → Sites |  |
| `Asset` *(indexed)* | Lookup → Assets |  |
| `Summary` *(required)* | Text |  |
| `Description` | Multi-line text |  |
| `Source` | Choice | Fault report / Failed check / Statutory / Planned / EOD note / AI warning |
| `SourceResponse` | Number | Response id when source = failed check |
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

**ComplianceItems**: Statutory calendar: gas CP42, TR19, EICR, fire alarm, emergency lighting, LOLER, PSSR, legionella, pest. *Written by:* Admin / flow F07.

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

**TradingDays**: One per site per service date — replaces the Netlify form's Excel row. *Written by:* App creates; flow F01 writes official totals.

| Column | Type | Notes |
|---|---|---|
| `Title` *(unique, required)* | Text | Key = SiteCode\|yyyy-mm-dd (blocks duplicates) |
| `Site` *(indexed)* | Lookup → Sites |  |
| `BusinessDate` *(indexed)* | Date |  |
| `Status` *(indexed)* | Choice | Draft / Submitted / Checked / Approved / Reopened |
| `WageCost` | Currency |  |
| `NextShiftNotes` | Multi-line text |  |
| `SubmittedBy` | Lookup → Staff | Signed-in user, not typed |
| `SubmittedAt` | Date/Time |  |
| `ApprovedBy` | Lookup → Staff | Finance sign-off |
| `TotalGross` *(set by flow)* | Currency |  |
| `TotalNet` *(set by flow)* | Currency |  |
| `DineInNet` *(set by flow)* | Currency |  |
| `Covers` *(set by flow)* | Number |  |
| `ASPHNet` *(set by flow)* | Currency |  |
| `FoodPct` *(set by flow)* | Number |  |
| `DrinkPct` *(set by flow)* | Number |  |
| `WagePct` *(set by flow)* | Number |  |
| `WageRAG` *(set by flow)* | Choice | Green / Amber / Red |
| `NetVsTarget` *(set by flow)* | Currency |  |
| `CheckIssues` *(set by flow)* | Multi-line text | Problems found by flow (e.g. discount lines ≠ EPOS total) |
| `CalcVersion` *(set by flow)* | Text | Formula version used |

*Indexed (4):* Title, Site, BusinessDate, Status

**TradingSessions**: Lunch / dinner figures and cash. *Written by:* App; flow F01 adds net & variance.

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
| `Net` *(set by flow)* | Currency | Gross − SC − tax − discounts |
| `Covers` *(set by flow)* | Number |  |
| `CashVariance` *(set by flow)* | Currency | Collected − EPOS |

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

**DeliverySales**: Per platform per day. *Written by:* App; flow F01 adds estimated net.

| Column | Type | Notes |
|---|---|---|
| `Title` *(unique, required)* | Text | Key = SiteCode\|yyyy-mm-dd\|Platform |
| `TradingDay` *(indexed)* | Lookup → TradingDays |  |
| `Platform` | Lookup → DeliveryPlatforms |  |
| `Gross` | Currency |  |
| `EstimatedNet` *(set by flow)* | Currency |  |
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

**Feedback**: Service, kitchen, staff, complaints, maintenance notes. *Written by:* App; flow F01 links work orders.

| Column | Type | Notes |
|---|---|---|
| `Title` | Text | Category |
| `TradingDay` *(indexed)* | Lookup → TradingDays |  |
| `Category` *(indexed)* | Choice | Service / Kitchen / Staff / Complaints / Maintenance |
| `Body` *(required)* | Multi-line text |  |
| `WorkOrder` *(set by flow)* | Lookup → WorkOrders | Created by F01 for urgent maintenance |

*Indexed (2):* TradingDay, Category

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
