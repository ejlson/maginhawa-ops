# Keeping daily checklist records in SharePoint Online trustworthy, retained, findable and reportable (UK)

Scope: 8-site UK restaurant group; opening/closing and food-safety checklists in SharePoint lists plus a photo library, written by our own back end via Microsoft Graph. Researched 6 Nov 2026. Items not confirmed against a primary source are listed under Gaps or flagged.

## Immutability: versioning, permissions, Purview retention and record labels (and Graph support)

### Takeaway
The cheapest dependable control is **app-enforced append-only** (back end is the only writer; users read-only; corrections are new versions with a reason) on top of SharePoint versioning. Purview "record" labels add platform-level locking but **marking items as records needs E5-tier licensing** (not E3 or Business Premium alone), and Graph only exposes label APIs for **driveItems (files/photos)**, not for list items; list items need CSOM/REST.

### Cited Findings
**Versioning**
- Version history limits can be set at organisation, site, library or list level; site owners can override org settings for lists and libraries they own. — [Microsoft Learn: Version history limits](https://learn.microsoft.com/en-us/sharepoint/document-library-version-history-limits)
- Two modes: **Automatic** (Microsoft-recommended, optimises storage by trimming versions) and **Manual** (major-version count limit, with or without an age expiry, e.g. 500 versions + 365-day expiry). The UI won't allow fewer than 100 versions or less than 30 days, though the API can. — [Microsoft Learn](https://learn.microsoft.com/en-us/sharepoint/document-library-version-history-limits)
- Versions trimmed for exceeding limits, or by scheduled trim jobs, are **permanently deleted and bypass the recycle bin**. — [Microsoft Learn](https://learn.microsoft.com/en-us/sharepoint/document-library-version-history-limits)
- Items under a **retention policy or eDiscovery hold ignore version limits** until the retention period ends. Items with a retention label (no policy) still have versions trimmed, but users can't delete versions. **Version deletion on items marked as records is blocked.** — [Microsoft Learn](https://learn.microsoft.com/en-us/sharepoint/document-library-version-history-limits)
- Audit events are logged for version-limit changes, user deletion of versions, and expiry/bulk deletion of versions (viewable in Purview). — [Microsoft Learn](https://learn.microsoft.com/en-us/sharepoint/document-library-version-history-limits)
- New SharePoint lists have versioning on by default and keep the **50 most recent major versions** (2021 rollout notice; existing lists unaffected). Libraries default to 500 major versions. Secondary sources, not re-verified on Learn. — [lazyadmin.nl](https://lazyadmin.nl/office-365/sharepoint-recycle-bin/); [Intranet from the Trenches](https://intranetfromthetrenches.substack.com/p/9-essential-facts-about-the-sharepoint-online-recycle-bin?open=false)
- Third-party commentary on the 2024–25 "Automatically" option (Message Center MC789209) adds that retention policies override versioning limits. — [m365scripts](https://m365scripts.com/microsoft365/improved-version-history-controls-for-sharepoint-and-onedrive/); [Tech Community thread](https://techcommunity.microsoft.com/discussions/sharepoint_general/automatically-option-for-the-organization-version-history-limit-how-it-works/4383174)

**What labels and records actually block** (Microsoft's table):

| Action | Retention label | Record locked | Record unlocked | Regulatory record |
|---|---|---|---|---|
| Edit contents | Allowed | Blocked | Allowed | Blocked |
| Edit properties | Allowed | Allowed (a tenant setting can block it) | Allowed | Blocked |
| Delete | Allowed (a tenant setting can block it) | Blocked | Blocked | Blocked |
| Move across sites | Allowed | Allowed if never unlocked | Blocked | Blocked |
| Change or remove label | Allowed | Container admin only | Blocked | Blocked |

— [Microsoft Learn: Records management](https://learn.microsoft.com/en-us/purview/records-management)
- **Important for lists:** a locked record still allows **property edits** by default, and list-item data lives in properties (columns). So for list items, "record" protects against deletion more than editing unless the tenant setting "Allow editing of record properties" is turned off. — [Microsoft Learn: Records management](https://learn.microsoft.com/en-us/purview/records-management)
- A standard retention label on a list item doesn't protect its attachment, which can still be deleted. A record or regulatory-record label is inherited by the attachment, which then can't be deleted. — [Microsoft Learn: Records management](https://learn.microsoft.com/en-us/purview/records-management)
- A **regulatory record** label can't be removed by anyone, including a global admin. Its retention period can only be extended, it can't be auto-applied, and it must first be enabled via PowerShell. Microsoft warns to be sure before using it. — [Microsoft Learn: Records management](https://learn.microsoft.com/en-us/purview/records-management)
- Retained SharePoint content is kept in the site's **Preservation Hold library**, which counts towards site storage quota. — [Microsoft Learn: Retention settings](https://learn.microsoft.com/en-us/purview/retention-settings)
- Preservation Lock can stop anyone turning off, deleting or weakening a retention policy. — [Microsoft Learn: Retention settings](https://learn.microsoft.com/en-us/purview/retention-settings)

**Graph and API support**
- `PATCH /drives/{drive-id}/items/{item-id}/retentionLabel` with `{"name": "<label>"}` applies a label to a **driveItem (file or folder)** in Graph v1.0. The label doesn't need to be published. Application permission: Files.Read.All is least privileged, but **`Sites.FullControl.All` is the least privileged permission needed to change labels that classify content as records**. — [Microsoft Learn: driveItem setRetentionLabel](https://learn.microsoft.com/en-us/graph/api/driveitem-setretentionlabel)
- The same endpoint with `{"retentionSettings":{"isRecordLocked":true}}` locks or unlocks a record on a driveItem (v1.0; application permission Files.ReadWrite.All or Sites.ReadWrite.All). — [Microsoft Learn: lockOrUnlockRecord](https://learn.microsoft.com/graph/api/driveitem-lockorunlockrecord)
- For **list items**, Microsoft documents the CSOM method `SetComplianceTagOnBulkItems` (list URL, item IDs, label name) as the recommended way and says older per-item methods may be deprecated. PnP PowerShell `Set-PnPRetentionLabel -ItemIds` wraps it, in batches of 25 by default. Community posts describe a REST `.../items(ID)/SetComplianceTag()` endpoint, with mixed reports of it working. — [Microsoft Learn: CSOM methods for retention labels](https://learn.microsoft.com/en-us/sharepoint/dev/apis/csom-methods-for-applying-retention-labels); [PnP Set-PnPRetentionLabel](https://pnp.github.io/powershell/cmdlets/Set-PnPRetentionLabel.html); [Tech Community](https://techcommunity.microsoft.com/t5/sharepoint/rest-api-to-apply-a-retention-label/m-p/634431)

**Licensing** (Purview service description, updated 29 Oct 2026)
- Creating and publishing retention labels: Microsoft 365 E3/E5/F3/F1/**Business Premium**, Office 365 E1/E3/E5. Retention policies on SharePoint: M365 E3/E5, Business Premium, or SharePoint Plan 2. — [Microsoft Purview service description](https://learn.microsoft.com/en-us/office365/servicedescriptions/microsoft-365-service-descriptions/microsoft-365-tenantlevel-services-licensing-guidance/microsoft-purview-service-description)
- These need **E5-tier rights** (M365 E5, Office 365 E5, Purview Suite, or E5 Information Protection & Governance): labels that **mark items as a record or regulatory record**, event-based retention, disposition review, relabelling at end of period, auto-apply, default label on a library, and adaptive scopes. — [Microsoft Purview service description](https://learn.microsoft.com/en-us/office365/servicedescriptions/microsoft-365-service-descriptions/microsoft-365-tenantlevel-services-licensing-guidance/microsoft-purview-service-description)
- A "Microsoft Purview Suite for Business Premium" add-on exists, requires a Business Premium base and is capped at 300 seats (stated in the audit section). — [Microsoft Purview service description](https://learn.microsoft.com/en-us/office365/servicedescriptions/microsoft-365-service-descriptions/microsoft-365-tenantlevel-services-licensing-guidance/microsoft-purview-service-description)
- Users who need a licence include SharePoint **site owners and members** on a site with a retention policy or label policy; site visitors don't. — [Microsoft Purview service description](https://learn.microsoft.com/en-us/office365/servicedescriptions/microsoft-365-service-descriptions/microsoft-365-tenantlevel-services-licensing-guidance/microsoft-purview-service-description)

### Inferences
- **Recommended baseline (no extra licence):** (1) A **retention policy** on the checklist site (E3 or Business Premium) set to "retain N years then delete". This also overrides version trimming, so every version of every item is kept for the period. (2) The back end, via a Sites.Selected app registration, is the only writer. Staff and head office get Read only. Each correction is a new version or new linked row carrying `CorrectionReason`, `CorrectedBy` and `CorrectedAt`. (3) A content hash of the finished checklist stored in a column (and optionally in a separate audit list) so later tampering is detectable.
- Purview "record" labels are worth it only if the tenant already has E5 or Purview Suite. Even then, locked records on **list items** still allow property edits unless the tenant setting is changed. Turning that setting off is tenant-wide, so check its effect on other teams first.
- Photos (driveItems) are the easiest place to use Graph labels. Lists need CSOM `SetComplianceTagOnBulkItems`, which adds a CSOM dependency to a Netlify Functions back end.
- Avoid **regulatory record**: it is irreversible, and food-safety logs don't need it.
- Give the back-end app `Sites.FullControl.All` only if record labels are actually used, since it is a high-privilege grant.

### Gaps
- Microsoft Learn wasn't checked directly for whether **Automatic version limits apply to lists** as well as libraries (the Learn page refers to "lists and libraries" for site-owner settings but describes limits mainly for libraries).
- No Graph v1.0 or beta endpoint for retention labels on **listItem** was found. The newest beta wasn't checked.
- Whether SharePoint item-level permissions alone (without Purview) appear in any Microsoft guidance as an "immutability" control wasn't found.

## Retention periods: food-safety records, UK GDPR and photos of people

### Takeaway
**No statutory or FSA-specified retention period** exists for SFBB diary or checklist records in England. The FSA says to keep completed diary pages "safely until your next visit" from the food safety officer. Common practice in vendor guidance is 3–12 months minimum, with one vendor keeping 4 years. UK GDPR then requires a documented, justified period, which matters most for photos that may show staff.

### Cited Findings
- FSA/GOV.UK SFBB page (published 5 June 2025): the pack must document practices "with daily records kept in the diary". The diary can be kept **electronically**, and completed diary pages should be stored "safely until your next visit from a local authority food safety officer". Officers "may want to look at your diary pages as well as your SFBB pack". **No retention period is stated.** — [GOV.UK: Safer food, better business](https://www.gov.uk/government/publications/safer-food-better-business-sfbb/safer-food-better-business-sfbb)
- Council guidance: SFBB needs no records other than the diary, and the diary should be reviewed every 4 weeks and whenever operations change. — [Doncaster Council](https://doncaster.gov.uk/services/environmental/safer-food-better-business)
- A council FSMS template says records must be kept "for an appropriate period" to show the system is working (no number given). — [Perth & Kinross Council FSMS](https://www.pkc.gov.uk/media/40147/Food-Safety-Management-System/pdf/FSMS_version_3) (Scottish council; illustrative)
- Vendor guidance: keep daily records **at least 3 months**, and many keep them for a year. — [Xlent Foods guide (commercial)](https://xlentfoods.myzen.co.uk/guides/food-safety-compliance-essentials)
- Vendor guidance (Netherlands-focused): daily temperature records can go after 12 months unless there's an open complaint or investigation. — [Kitchen NMBRS (commercial, non-UK)](https://kitchennmbrs.app/en/knowledge-base/food-safety-and-haccp/what-do-you-keep-for-one-year-and-what-longer-as-proof-of-your-haccp-approach)
- Safe Food Pro (a UK competitor) stores records for **a minimum of four years**, even if the business leaves the platform. — [Safe Food Pro auditor guide (vendor)](https://intercom.help/sfp/en/articles/12971177-an-auditor-verifier-s-guide-to-a-safe-food-pro-audit)
- ICO: UK GDPR sets no fixed retention period. You must justify it from your purposes, have "a policy with standard retention periods where possible", review it, and erase or anonymise data once no longer needed. — [ICO: Storage limitation](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/data-protection-principles/a-guide-to-the-data-protection-principles/storage-limitation/)
- ICO "Employment practices and data protection: monitoring workers" (final, 3 Oct 2023) says monitoring must be proportionate, transparent and not excessive. Employers should keep only information relevant to the monitoring's purpose, and a DPIA is expected for higher-risk monitoring, including biometric or facial-recognition data. — [RPC summary](https://www.rpclegal.com/snapshots/data-protection/winter-2023/ico-publishes-guidance-to-ensure-lawful-monitoring-in-the-workplace/); [Data Protection Report](https://www.dataprotectionreport.com/2023/10/uk-information-commissioners-office-publishes-final-guidance-on-employee-monitoring/)

### Inferences
- Defensible policy (our recommendation, not a legal requirement): **keep checklist data for 2–3 years** to cover at least one full inspection cycle and any civil claim. Under the Limitation Act 1980, personal-injury claims (e.g. food poisoning) generally have a **3-year** limit, but this wasn't sourced here; confirm with a solicitor. Keep **photos for a shorter period** (e.g. 12 months) unless attached to an incident, which is then put on hold.
- Use a **retention policy (or label) with "retain then delete"** so deletion happens automatically and is documented, satisfying both due diligence and storage limitation.
- Photo minimisation: tell staff to photograph the **probe display, label or fridge, not people**. Show that guidance in the app's camera UI, mention photos in the staff privacy notice, and offer a "retake" option. Record the purpose ("evidence of temperature reading") in the Record of Processing Activities (ROPA). Never run face detection or recognition, since that is biometric processing.
- Scotland (FSS) and Wales/NI (FSA) have similar packs (e.g. CookSafe in Scotland). No material retention difference was found.

### Gaps
- No primary FSA or local-authority document gives a numeric retention period for SFBB diaries or HACCP records in England.
- The ICO monitoring guidance wasn't fetched directly, so its photo-specific wording isn't confirmed.
- The Limitation Act period wasn't sourced in this session.

## Missing submissions: explicit "Missed" records vs computing absence

### Takeaway
No authoritative source was found that settles this. Competitor apps flag exceptions and overdue tasks in their reports. For an audit trail, **a scheduled job that writes an explicit, immutable "Missed" record** (later linked to any late submission) is the stronger pattern, and it also makes head office reporting trivial.

### Cited Findings
- Safe Food Pro reports list every form completed in a date range, with "modified by". Exceptions show in red text or with a note icon. The auditor guide doesn't describe missed-check reporting. — [Safe Food Pro auditor guide](https://intercom.help/sfp/en/articles/12971177-an-auditor-verifier-s-guide-to-a-safe-food-pro-audit)
- Trail markets a task "History" view to "travel back through days" and data export for managers (marketing). — [Trail EHO page](https://trailapp.com/eho-inspection); [Trail deck](https://docs.google.com/presentation/d/1eDlnCMM8hgDOvWjqKZU_71VWSTmkYdrV6iZ_fT1vjHQ/htmlpresent)

### Inferences
- **Explicit "Missed" row** (status `Missed`, `ScheduledFor`, `DetectedAt`, written by a timer function after a cut-off time):
  - Pros: point-in-time evidence that the gap was detected, a single source for a "who didn't submit" view, and simple filtering in Power BI.
  - Cons: needs a reliable scheduler and the site trading calendar (closures, Ramo closed). If the job fails, the gap goes unrecorded unless there's a reconciliation job.
- **Computed absence** (schedule × submissions):
  - Pros: never wrong if the schedule is right.
  - Cons: the schedule must itself be versioned. Reports must re-implement the logic in Excel, Power BI and the app. There's no record of when head office knew.
- Recommended hybrid: keep a versioned **schedule/expected-checklists list** (site × checklist × days and times, with effective-from dates) as the source of truth. A timer function writes `Missed` rows after the cut-off. A late submission is a new record that references the Missed row (`LateFor`), and the Missed row is never deleted. A weekly reconciliation job recomputes the expected set and backfills any gaps the timer missed.

### Gaps
- No FSA, EHO or audit-standard guidance on how to record missed checks was found. The recommendation above is reasoned practice, not a cited requirement.

## Reporting: Excel Power Query, Power BI and exports

### Takeaway
Excel and Power BI can read SharePoint lists directly with the SharePoint Online list connector. **v2.0 is faster but has reported row-truncation and join-limit problems on large lists.** For multi-year history (8 sites × several checklists per day, roughly 10–30k rows a year), plan **scheduled CSV/Parquet exports**, or a Graph-backed export function, as the long-term reporting source, and use the live connector for recent data.

### Cited Findings
- The connector works in Excel, Power BI and Power Query Online. **Implementation 2.0** (GA Sept 2022) uses improved APIs, isn't backwards-compatible with 1.0, and offers "All" or "Default" view modes. With a Calendar or Board default view, only that view's columns return. — [Microsoft Learn: SharePoint Online list connector](https://learn.microsoft.com/en-us/power-query/connectors/sharepoint-online-list)
- v2.0 is subject to the **12-lookup-join limit** per query (lookup, person and managed-metadata columns count). The workaround is a default view with fewer than 12 lookups. v1.0 returns datetimes in **UTC** and needs conversion. — [Microsoft Learn: SharePoint Online list connector](https://learn.microsoft.com/en-us/power-query/connectors/sharepoint-online-list)
- Community reports say v2.0 returns far fewer rows than 1.0 on lists over about 6,000 items (e.g. 124 of 40,000; a 2,000-row cap blamed on RenderListDataAsStream paging). Workarounds: switch to `Implementation="1.0"`, use `ViewMode="Default"`, or index the filtered columns. v1.0 is described as slow. These are forum reports, not Microsoft statements. — [Fabric community](https://community.fabric.microsoft.com/t5/Desktop/Power-BI-Sharepoint-Online-List-Connector-2-0-returning-2000/m-p/5144774); [Fabric community](https://community.fabric.microsoft.com/t5/Power-Query/Retrieve-SharePoint-Online-list-data-v2-0-connector-is-returning/m-p/3212238)
- An OData feed to a SharePoint list has a roughly 2,100-character URL limit. — [Microsoft Learn](https://learn.microsoft.com/en-us/power-query/connectors/sharepoint-online-list)
- Lists hold up to **30 million items**. The **List View Threshold is 5,000** and can't be changed in SharePoint Online. A warning appears at 3,000 items. — [Microsoft Support: Manage large lists and libraries](https://support.microsoft.com/en-us/office/manage-large-lists-and-libraries-b8588dae-9387-48c2-9248-c24122f07c59)

### Inferences
- Use **flat columns** (text or number for site code, date as `yyyy-mm-dd` text plus a date column) rather than lookups. This avoids the 12-join limit and makes CSV exports clean.
- For Power BI: either (a) a nightly function that writes one CSV per month to a "Reporting" library, which Power BI reads with the SharePoint Folder connector and incremental refresh; or (b) the list connector filtered to the last 90 days for live views. Option (a) also gives an independent, human-readable copy (see Backup).
- Excel for head office: a pre-built workbook with Power Query on the export library (one table per checklist type) is simpler and more robust than live list queries.
- "How many rows is practical": no Microsoft figure was found. Treat forum reports of v2.0 truncation above about 5–6k rows as a warning and test with real volumes.

### Gaps
- No official Microsoft performance guidance or row ceiling for the list connector.
- Whether Power BI incremental refresh folds against SharePoint lists wasn't checked.

## Backup and recovery

### Takeaway
SharePoint's own safety nets are the **93-day two-stage recycle bin** and **version history**, but version trims and second-stage purges are permanent. Retention policies (which keep deleted content in the Preservation Hold library) are the main free protection against deletion. **Microsoft 365 Backup** at **US$0.15 per GB per month** adds point-in-time restore, and for a small checklist site the cost is negligible.

### Cited Findings
- Recycle bin: items stay **93 days** from deletion across first and second stage. The clock doesn't restart when an item moves to the second stage, and only site owners or admins can see the second stage. The period can't be changed. — [lazyadmin.nl](https://lazyadmin.nl/office-365/sharepoint-recycle-bin/); [Intranet from the Trenches](https://intranetfromthetrenches.substack.com/p/9-essential-facts-about-the-sharepoint-online-recycle-bin?open=false) (secondary; consistent with Microsoft's long-standing documentation)
- Versions deleted by limits or trim jobs bypass the recycle bin and can't be recovered. A version a user deletes goes to the recycle bin. — [Microsoft Learn: Version history limits](https://learn.microsoft.com/en-us/sharepoint/document-library-version-history-limits)
- Microsoft 365 Backup: **US$0.15 per GB per month**, pay-as-you-go through an Azure subscription, with no per-user charge. Billing is based on the size of protected sites, **including recycle-bin content**. Microsoft's example: a 1 GB site with 0.5 GB in its second-stage bin, plus a 1 GB mailbox with a 1 GB archive, is billed as 3.5 GB. — [Microsoft Learn: Backup pricing](https://learn.microsoft.com/en-us/microsoft-365/backup/backup-pricing); [Microsoft 365 Backup product page](https://www.microsoft.com/en-gb/microsoft-365/microsoft-365-backup)
- Analysts note that per-GB pricing is competitive mainly for small tenants or small protected scopes. — [Office 365 IT Pros](https://office365itpros.com/2024/03/20/microsoft-365-backup-costs/)

### Inferences
- Layers in order: (1) retention policy on the site, so deleted or edited content is preserved in the Preservation Hold library for N years; (2) versioning; (3) nightly CSV export to a separate library or site (doubles as reporting); (4) Microsoft 365 Backup on just this site if the business wants one-click point-in-time restore. Photos dominate size. Example: 8 sites × 5 photos/day × 1 MB ≈ 15 GB/year ≈ US$2.25/month in year one (illustrative arithmetic only).
- Compress or resize photos on upload (e.g. long edge 1600 px, JPEG about 300 KB) to cut storage, backup and quota cost.

### Gaps
- Microsoft 365 Backup's retention length and restore granularity (whole site vs item) weren't verified this session.
- No GBP price was found. Microsoft lists US$.

## Finding records: views, indexes and Microsoft Search

### Takeaway
Head office browsing of "Site X, date Y" works in list views **if the filtered columns (Site, ChecklistDate, Status) are indexed** and views filter first on an indexed column so each query stays under the 5,000-item threshold.

### Cited Findings
- Filtered views that use column indexes create database queries returning only a subset of rows. The threshold is 5,000, can't be changed in SharePoint Online, and lists can hold up to 30 million items. — [Microsoft Support: Manage large lists and libraries](https://support.microsoft.com/en-us/office/manage-large-lists-and-libraries-b8588dae-9387-48c2-9248-c24122f07c59)
- The List View Lookup Threshold is 12 joins. — [Microsoft Support](https://support.microsoft.com/en-us/office/manage-large-lists-and-libraries-b8588dae-9387-48c2-9248-c24122f07c59)

### Inferences
- Create indexes on `SiteCode`, `ChecklistDate`, `Status` and `ChecklistType` **at provisioning time** (in the provisioning script), not after the list grows.
- Suggested views: "Today by site", "Missed this week" (Status = Missed, date ≥ [Today]-7), "Corrections" (has a CorrectionReason), and one view per site. All should filter on an indexed column first.
- Put a human-readable `Title` such as "Soho · 2026-11-06 · Closing" on each item so Microsoft Search and the list's search box find it by name.
- For EHO requests the app should generate a PDF pack (site × date range) itself, rather than relying on SharePoint search.

### Gaps
- Not verified: Microsoft's current rules on adding an index to a list already over 5,000 items, auto-indexing, and the limit of 20 indexes per list (from memory, unconfirmed).
- Not verified: how Microsoft Search ranks or displays SharePoint **list items** (as opposed to files) and how long indexing takes.

## How competitor apps present records to EHOs

### Takeaway
UK competitors market **date-range reports exported as PDF (for the inspector) and CSV (for analysis)**, showing who completed or modified each check and highlighting exceptions and corrective actions. Long retention (e.g. 4 years) is a selling point. Inspectors want the SFBB-style pack plus diary records for the period they ask about. No inspector-mandated format was found.

### Cited Findings
- Safe Food Pro: date-range form reports (e.g. 3 months) showing completion date, questions and answers, and "modified by". Exceptions are marked in red or with a note icon. Export is **PDF or CSV**, emailed to the auditor. Records are kept for at least 4 years (vendor). — [Safe Food Pro auditor guide](https://intercom.help/sfp/en/articles/12971177-an-auditor-verifier-s-guide-to-a-safe-food-pro-audit)
- triSaaS ("Oh no it's the EHO" article): "Download PDF" exports a group of completed checks as one file (can take up to 10 minutes), and there's multi-location check management (vendor help). — [triSaaS help](https://intercom.help/trisaas/en/articles/6423513-oh-no-it-s-the-eho)
- Trail: markets itself as an EHO-ready digital record of daily checks with history and data export. No help doc confirming a one-click EHO PDF was found (marketing). — [Trail EHO page](https://trailapp.com/eho-inspection); [Trail](https://trailapp.com/)
- NCASS: EHOs should have no reason not to accept a digital safety app, and reports can gather all checks for the EHO to review (trade body selling its own system). — [NCASS](https://www.ncass.org.uk/news/the-ncass-digital-food-safety-system/)
- FSA: the SFBB diary may be kept electronically, and officers may ask to see diary pages and the pack. — [GOV.UK SFBB](https://www.gov.uk/government/publications/safer-food-better-business-sfbb/safer-food-better-business-sfbb)

### Inferences
- Build an **"EHO pack" export**: site + date range → PDF with a cover page (site, FBO, period, generated-at timestamp and record hash), a daily table of checks with times, values and who completed them, missed checks shown explicitly, corrections shown with original value, new value, reason, who and when, and photo thumbnails. Add a CSV export with the same data.
- Showing corrections and misses openly is better due-diligence evidence than a "perfect" log.

### Gaps
- Product docs for Jolt, Navitas (Safe), Check65 and Kitchen Checks weren't found in this session, so their export formats are unconfirmed.
- No EHO or LGA guidance on a preferred digital record format was found.
