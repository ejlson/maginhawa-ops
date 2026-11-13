# Microsoft 365 storage options for daily restaurant checklist submissions

Scope: system-of-record options within Microsoft 365 for Maginhawa checklists (8 sites; about 5–10 runs a day per site, about 80 answers per run; about 410k answers a year; about 9 GB of photos a year). The back end is Netlify Functions (Node) calling Microsoft Graph **app-only with Sites.Selected**. Research date: 9 Nov 2026.

Labels used: **[Verified]** = Microsoft Learn or Support page read in this session (page date given where shown); **[Community]** = Microsoft Q&A or forum report; **[Inference]** = my own reasoning or arithmetic from the cited facts.

---

## Q1. Graph Excel (workbook) API: concurrency, sessions, throttling, locks, sizes, row-add performance, reliability, Microsoft guidance

### Takeaway
The Excel workbook API is **not a supported write path for this architecture**. Microsoft's own reference page for adding table rows lists **Application permissions as "Not supported"**, and Maginhawa's functions run app-only. Even with delegated auth, Microsoft advises against concurrent writes to one workbook, and documents lock and merge-conflict errors as a normal failure mode. Community threads from 2023 onwards report persistent 504 time-outs that were never resolved. Excel is a poor fit for a multi-writer, offline-sync system of record.

### Cited Findings
- **[Verified] App-only not supported.** The permissions table for `POST …/workbook/tables/{id}/rows/add` reads: Delegated (work or school) Files.ReadWrite; Delegated (personal) Files.ReadWrite; **"Application | Not supported. | Not supported."** (page updated 19 May 2026) — [TableRowCollection: add](https://learn.microsoft.com/en-us/graph/api/tablerowcollection-add?view=graph-rest-1.0)
- **[Verified] Batch rows rather than adding one at a time.** "Adding one row at a time could lead to performance degradation… collect the rows to be inserted on the application side and perform single rows add operation." The same page says: "This request might occasionally receive a 504 HTTP error. The appropriate response to this error is to repeat the request." — [TableRowCollection: add](https://learn.microsoft.com/en-us/graph/api/tablerowcollection-add?view=graph-rest-1.0)
- **[Verified] Three session modes.** Persistent ("most efficient"), non-persistent (changes lost when the session expires) and sessionless ("Excel servers have to locate the server's copy of the workbook each time… isn't an efficient way"). "Typically the persistent session expires after about 5 minutes of inactivity. Non persistent session expires after about 7 minutes of inactivity." Only Office Open XML (.xlsx) workbooks are supported, and only in business OneDrive/SharePoint. — [Working with Excel in Microsoft Graph](https://learn.microsoft.com/en-us/graph/api/resources/excel) (ms.date 20 Mar 2024)
- **[Verified] Microsoft advises against concurrency.** "We don't recommend increasing concurrency when using Excel APIs (for example, parallelizing the requests to the same workbook), especially for write requests… for each workbook, only send the next request after receiving a successful response to the current request." "Concurrent write requests to the same workbook don't usually run in parallel… they are often the cause of throttling, timeout (when requests are queued on servers), merge conflict (when concurrent sessions are involved) and other types of failures… when you receive a failure response, there is no way to confirm the status of other pending requests." — [Best practices for working with the Excel API](https://learn.microsoft.com/en-us/graph/workbook-best-practice) (ms.date 7 Nov 2024; updated Aug 2025)
- **[Verified] No published numeric throttling limits.** "Excel API throttling isn't defined with simple and universal limit numbers." Callers must honour `Retry-After`. — [Best practices](https://learn.microsoft.com/en-us/graph/workbook-best-practice)
- **[Verified] Opening a large workbook can be slow.** Microsoft says this can take "an indeterminate amount time", so session creation supports a long-running-operation pattern (`Prefer: respond-async`, 202 + poll "around 30 seconds", "no more than 4 minutes"). The failure example is `GenericFileOpenError: The workbook cannot be opened.` — [Best practices](https://learn.microsoft.com/en-us/graph/workbook-best-practice)
- **[Verified] Lock and conflict errors are documented as normal cases.** `accessConflict`: "another client has locked the workbook for edit… not expected to resend the failed request until the conflict is resolved." `invalidSessionAccessConflict`: the session is invalidated by other clients. `invalidSessionUnsupportedWorkbook` / `unsupportedWorkbook`: "contains unsupported features or exceeds the size limit. Usually the unsupported factors are introduced by another client accessing the workbook." `insertDeleteConflict` and `requestAborted` ("usually caused by long time calculation") are also listed. — [Error handling for Excel APIs](https://learn.microsoft.com/en-us/graph/workbook-error-handling) (ms.date 7 Nov 2024)
- **[Verified] Range size cap.** Some range properties return null once a range exceeds 5M cells, and large ranges should be split across calls. — [Working with Excel in Microsoft Graph](https://learn.microsoft.com/en-us/graph/api/resources/excel)
- **[Community] App-only workbook access.** A Microsoft Q&A answer states that Graph "does not support read/write access to shared Excel files using App-only permissions". A third-party integration doc (Nango) says "the Excel workbook API does not support application permissions." — [Microsoft Q&A 2286958](https://learn.microsoft.com/en-us/answers/questions/2286958/support-required-for-shared-excel-file-read-write); [Nango doc](https://nango.dev/docs/api-integrations/microsoft-excel-oauth2-cc.md)
- **[Community] Persistent 504s, even on single-cell updates.** Reported in production in Sept 2023. A Microsoft responder called it server-side and suggested smaller requests, no JSON batching and retries. No resolution was accepted, and a second user reported retries "made jobs very slow". — [Q&A 1365864](https://learn.microsoft.com/en-us/answers/questions/1365864/persistent-504-errors-in-excel-operations-with-mic); [Q&A 1359336](https://learn.microsoft.com/en-us/answers/questions/1359336/graph-api-returns-504-error-even-for-single-cell-v) *(older: 2023)*
- **[Community] Add-row time-outs grow with table size and locks.** Power Automate "Add a row" 504s were traced to a large or slow workbook (fixed by removing historic data), to recalculation on insert, and to file locks from desktop Excel. 429 and 504 errors appear together in a 2025–26 Q&A thread. — [Q&A 5215267](https://learn.microsoft.com/en-us/answers/questions/5215267/power-automate-workflow-suddenly-run-failed-error); [Power Users forum](https://powerusers.microsoft.com/t5/General-Power-Automate/Power-Automate-Gateway-Error/m-p/2470190/highlight/true)

### Inferences
- **[Inference]** Option 2 is blocked at the authorisation level: the back end is app-only with Sites.Selected, and row add is documented as delegated-only. Making it work would need a service user with delegated tokens (refresh-token custody in Netlify, MFA and conditional-access problems), and that conflicts with the decided architecture.
- **[Inference]** Even with delegated auth, the documented model of one writer per workbook, sending each request only after the previous one succeeds, conflicts with "several staff fill one checklist at once, sometimes offline, then sync". All the sync bursts after reconnecting would queue on a single workbook per site, and any manager who has the file open in desktop Excel can lock out the API (`accessConflict`).
- **[Inference]** Excel has no per-row ETag or If-Match, so the optimistic concurrency the previous plan relies on (AnswersJson saved with If-Match) can't be done in Excel. The only fallback is a single serialised writer per workbook.
- **[Inference]** Splitting by workbook doesn't solve this. Per site per month is about 4,300 answer rows (410k ÷ 8 ÷ 12) and stays small, but concurrency is still one writer. One master workbook would reach about 410k rows a year and grow into the "large, slow, recalculating" pattern the community 504 reports describe.

### Gaps
- I found no Microsoft statement in 2025–26 that literally says "don't use Excel as a database". The guidance is implicit in the concurrency text above.
- I found no official per-workbook request rate or row-count threshold for the Excel API. Microsoft deliberately publishes none.
- I didn't verify whether app-only calls to *other* workbook endpoints (for example, reads) work in practice with Files.ReadWrite.All or Sites.Selected. The community suggests some do, but this is unsupported.

---

## Q2. Excel limits: rows, file size in SharePoint and Excel for the web, performance at 100k+ rows, Power Query refresh

### Takeaway
Row capacity isn't the constraint. The browser-open limit for SharePoint Online is up to 100 MB depending on the subscription. Performance, recalculation and locking are the practical limits. Excel works well as a **read-only reporting surface** refreshed from lists or files.

### Cited Findings
- **[Verified – search summary of Microsoft Support]** A SharePoint Online workbook is limited to "0-100 MB" for viewing in a browser, depending on the Microsoft 365 subscription. Over the limit, it won't open in the browser (download and use desktop Excel instead). An older Microsoft-derived guide gives 0–50 MB *(older)*. — [File size limits for workbooks in SharePoint](https://support.microsoft.com/en-us/office/file-size-limits-for-workbooks-in-sharepoint-9e5bc6f8-018f-415a-b890-5452687b325e); [older troubleshooting PDF](https://choc.org/files/MSresources/SharePoint/Troubleshooting-SharePoint.pdf)
- **[Verified – search summary]** Excel for the web data-model workbooks have a 250 MB total file size limit. — [Data Model specification and limits](https://support.microsoft.com/en-us/excel/data-model-specification-and-limits)
- **[Verified]** `unsupportedWorkbook` / `invalidSessionUnsupportedWorkbook` errors are returned when a workbook "exceeds the size limit" for the Excel service. — [Error handling for Excel APIs](https://learn.microsoft.com/en-us/graph/workbook-error-handling)
- **[Community]** Add-row 504 time-outs were fixed by removing historic rows ("too slow to allow the 'add row' to complete"). — [Power Users forum thread](https://powerusers.microsoft.com/t5/General-Power-Automate/Power-Automate-Gateway-Error/m-p/1995360/highlight/true)

### Inferences
- **[Inference]** The worksheet row maximum of 1,048,576 is a standard Excel specification, but I didn't re-fetch it this session. At about 410k answer rows a year, one master workbook would reach roughly 40% of the sheet maximum in year 1 and exceed it in year 3.
- **[Inference]** 410k rows × about 12 columns is probably tens of MB as .xlsx. That is under the browser limit, but squarely in the territory where community reports describe slow add-row calls and time-outs.
- **[Inference]** For humans, a Power Query workbook that *reads* from the lists (or from CSV and JSON exports) avoids every write-concurrency problem. Refresh happens on demand in desktop Excel.

### Gaps
- I found no authoritative Microsoft benchmark for Graph add-row latency at 100k+ rows.
- I didn't verify Power Query's SharePoint list connector limits or refresh behaviour in Excel for the web (scheduled refresh isn't available in Excel for the web without Power BI). This needs a check if Option 5 relies on browser refresh.

---

## Q3. Files as records (one JSON file per checklist run in a document library with metadata columns)

### Takeaway
This works with app-only Graph and is simple to write. A library is a list under the hood, so it carries the **same 5,000 view threshold and 20-index limits** as Option 1. Querying and reporting are weaker: answers inside JSON aren't filterable or reportable without downloading each file. Per-file overwrite also loses field-level merging when several staff edit one run.

### Cited Findings
- **[Verified]** Simple upload (`PUT …/content`) supports files up to 250 MB. Application permission is Files.ReadWrite.All (higher: Sites.ReadWrite.All). "Replacing the contents of a file protected with a sensitivity label is not supported with app-only authentication." — [Upload small files](https://learn.microsoft.com/en-us/graph/api/driveitem-put-content?view=graph-rest-1.0) (updated Aug 2026)
- **[Verified]** Libraries and lists share limits: up to 30 million files and folders per library; once there are more than 100,000 items, you can't break inheritance at list, library or folder level; 50,000 major versions per file. — [SharePoint limits](https://learn.microsoft.com/en-us/office365/servicedescriptions/sharepoint-online-service-description/sharepoint-online-limits) (ms.date 6 Oct 2026)
- **[Verified]** Graph RU costs: download a file = 1 RU; create, update, delete or upload = 2 RU; list children (multi-item) = 2 RU. — [Avoid getting throttled](https://learn.microsoft.com/en-us/sharepoint/dev/general-development/how-to-avoid-getting-throttled-or-blocked-in-sharepoint-online) (updated Aug 2026)
- **[Verified]** The 5,000 list view threshold and 20-column index limit apply to "a list or library". — [Manage large lists and libraries](https://support.microsoft.com/en-us/office/manage-large-lists-and-libraries-b4038448-ec0e-49b7-b853-679d3d8fb784); [Add an index to a list or library column](https://support.microsoft.com/en-us/office/add-an-index-to-a-list-or-library-column-f3f00554-b7dc-44d1-a2ed-d477eac463b0)
- **[Verified]** OneDrive sync: Microsoft recommends syncing no more than 300,000 files in one library. — [SharePoint limits](https://learn.microsoft.com/en-us/office365/servicedescriptions/sharepoint-online-service-description/sharepoint-online-limits)

### Inferences
- **[Inference]** Volume is about 8 sites × about 7.5 runs × 365 ≈ 22,000 run files a year (about 110k after 5 years). A folder per site per month gives about 230 files per folder, well under 5,000. Querying by metadata across the library still needs indexed columns (Site, Date, Template, Status), as in Option 1.
- **[Inference]** Concurrency: driveItems carry an eTag. The project's existing If-Match pattern can be applied to metadata updates (`PATCH driveItem/listItem` with `if-match`). But a file write replaces the whole JSON, so two staff editing different answers in one run have to merge in the function (read, merge, write with If-Match, retry on 412). That is the same pattern as the previous plan's AnswersJson-on-a-list-item. The file adds no concurrency benefit over a list column.
- **[Inference]** Reporting: "how many fridge temperatures failed across all sites last month" means downloading thousands of JSON files (1 RU each) or keeping a parallel answer table. Either way you rebuild Option 1's Responses list.
- **[Inference]** Human access: raw JSON isn't staff-friendly. Managers would need generated PDFs or XLSX files anyway (Option 5).
- **[Inference]** Files do have one strength: a run's file is a natural immutable **archive or snapshot** once it's finished (versioned and retention-friendly). It suits an audit record better than the live working store.

### Gaps
- I didn't re-fetch Graph `driveitem-update` to confirm the If-Match wording for driveItems. It is widely documented, but I didn't verify it this session.
- I didn't verify search crawl delay for new library files. It doesn't matter if the app queries by indexed metadata via the list API rather than Search.
- I didn't verify whether Sites.Selected (rather than Files.ReadWrite.All) covers driveItem content upload. It is expected to, because Sites.Selected grants are per site, but this needs checking in the tenant.

---

## Q4. SharePoint lists: re-verified key limits, throttling budget, Export to Excel behaviour

### Takeaway
The previous plan's assumptions hold. The verified figures are a 5,000 view threshold (fixed in SharePoint Online), 20 indexed columns per list, a 12-lookup join threshold, 30M items per list, an app budget of 1,250 RU/min and 1.2M RU/day for tenants with up to 1,000 licences, and If-Match/412 on list item updates. "Export to CSV" is capped at 30,000 rows. "Export to Excel" creates a refreshable, one-way query table.

### Cited Findings
- **[Verified]** 5,000 list view threshold. You're warned when a list exceeds 3,000 items, and the threshold can't be changed in SharePoint Online. The lookup threshold is 12 joins (lookup, person and workflow-status columns). The page also mentions an 8-column block, which contradicts this, so treat 12 as the documented default. The auditor/admin threshold is 20,000. — [Manage large lists and libraries](https://support.microsoft.com/en-us/office/manage-large-lists-and-libraries-b4038448-ec0e-49b7-b853-679d3d8fb784)
- **[Verified]** "You can add indexes on up to 20 columns on a list or library." Indexable types include single-line text, choice, number, currency, date, single person, managed metadata, yes/no and lookup. Multi-line text, calculated and multi-value columns are excluded. "In SharePoint, you can manually add an index to a list of any size", but creation "can be blocked if the whole list exceeds the threshold". The 20,000-item rule is documented only for SharePoint Server 2016/2019, not SharePoint Online. If no index can serve a query, the fallback shows "up to 1,250 of the newest items". — [Add an index to a list or library column](https://support.microsoft.com/en-us/office/add-an-index-to-a-list-or-library-column-f3f00554-b7dc-44d1-a2ed-d477eac463b0)
- **[Verified]** Lists hold up to 30 million items, with 2,000 lists and libraries per site collection. Unique permissions: 50,000 supported, 5,000 recommended. Attachments on list items are capped at 250 MB. — [SharePoint limits](https://learn.microsoft.com/en-us/office365/servicedescriptions/sharepoint-online-service-description/sharepoint-online-limits)
- **[Verified]** Per app per tenant, for tenants with 0–1,000 licences: **1,250 RU/min** and **1,200,000 RU/24 h**. Tenant-wide limit: 18,750 RU per 5 min. Per user: 3,000 requests per 5 min. RU costs: single item get = 1; multi-item query, create, update, delete or upload = 2; permission operations = 5. JSON batch sub-requests are counted individually. Throttled requests still count, so honour `Retry-After`. SharePoint Online doesn't return IETF RateLimit headers. Decorate traffic with a User-Agent such as `NONISV|Maginhawa|Ops/x.y`. — [Avoid getting throttled or blocked](https://learn.microsoft.com/en-us/sharepoint/dev/general-development/how-to-avoid-getting-throttled-or-blocked-in-sharepoint-online) (updated 10 Aug 2026)
- **[Verified]** List item update supports `if-match: etag`: "If… the eTag provided doesn't match the current eTag on the item, a `412 Precondition Failed` response is returned and the item will not be updated." — [Update listItem](https://learn.microsoft.com/en-us/graph/api/listitem-update?view=graph-rest-1.0) (updated Jun 2026)
- **[Verified]** Graph list items `$filter` supports eq, ne, lt, gt, le, ge and startswith. "When filtering on indexed fields, the service can only filter one indexed field at a time." "Filtering works best on indexed columns." — [List items](https://learn.microsoft.com/en-us/graph/api/listitem-list?view=graph-rest-1.0)
- **[Verified – search summary of Microsoft Support]** Export to CSV gives "a maximum of 30,000 rows". Export to Excel "creates a workbook with an Excel table with a one-way data connection based on a web query file" that can be updated with Refresh All, and it exports only the current view. No row cap is stated for the Excel export. — [Export to Excel from SharePoint or Lists](https://support.microsoft.com/en-us/office/export-to-excel-from-sharepoint-or-lists-bfb2ea48-6118-4fa9-abb6-cced9424e5d9)

### Inferences
- **[Inference] Throttling headroom.** 1,250 RU/min is about 600 writes a minute at 2 RU each. A realistic peak is all 8 sites syncing a 10-person run at once: say 8 × 20 autosaves a minute = 160 writes ≈ 320 RU/min, plus reads. That is about 25–40% of budget. Daily: about 60 runs × (say 40 autosaves + 80 Responses rows at finish) × 2 RU ≈ 14,400 RU, against a 1.2M/day budget. Writing 80 Responses rows *individually* at finish is the largest single cost. Batching via JSON `$batch` doesn't reduce RU, because each sub-request is counted.
- **[Inference] Threshold.** At about 410k Responses a year, a year-split `Responses_{yyyy}` list passes 5,000 in about 4–5 days. Every app query must therefore lead with an indexed, selective filter (for example a RunId or SiteDate key) that returns fewer than 5,000 rows. Human views must also be filtered on an indexed column. Create the indexes **before** the list grows; Microsoft says index creation can be blocked once the list exceeds the threshold.
- **[Inference] Single indexed filter.** "Only one indexed field at a time" for Graph `$filter` favours composite key columns, for example `SiteDayKey = "SITE03|2026-11-09"` and `RunId`, over multi-column filters.
- **[Inference] Excel live connection.** "Export to Excel" (an .iqy one-way refresh) gives managers a familiar spreadsheet without the app ever writing to Excel. The 30,000-row CSV cap means bulk exports should be filtered views or generated by the function.

### Gaps
- I didn't confirm the exact row ceiling, if any, of an "Export to Excel" .iqy refresh against a list over 5,000 items. Community experience suggests filtered and indexed views are needed. Not verified.
- I didn't verify whether SharePoint Online now auto-creates indexes on large lists (there are older claims of "auto-indexing" for sort and filter in modern UI). The Support page doesn't say it does.

---

## Q5. Dataverse and Dataverse for Teams (reference point)

### Takeaway
**Dataverse for Teams is being retired.** New environments can't be created from 15 Nov 2026, unupgraded environments are suspended on 15 Sep 2027, and they are decommissioned on 30 Oct 2027. It also has **no API access**, so Netlify Functions couldn't use it. Full Dataverse has an API, but it brings Power Platform licensing and capacity costs. It is a reference point only.

### Cited Findings
- **[Verified]** "You can't create new Dataverse for Teams environments starting November 15, 2026. Existing Dataverse for Teams environments that aren't upgraded to Dataverse are suspended on September 15, 2027 and decommissioned on October 30, 2027." After an upgrade, "apps, flows, and agents in the environment require Power Apps, Power Automate, or Copilot Studio licenses", and consumption counts toward tenant Dataverse capacity. — [Important changes coming in Power Platform](https://learn.microsoft.com/en-us/power-platform/important-changes-coming)
- **[Verified]** Dataverse for Teams: professional-developer "API access | No", plug-ins No, webhooks No. Maximum size "1 million rows or 2 GB" per team environment. No auditing, no mobile offline. Full Dataverse: API access Yes, auditing Yes, mobile offline Yes, unlimited size (capacity-billed). — [Dataverse for Teams vs. Dataverse](https://learn.microsoft.com/en-us/power-apps/teams/data-platform-compare) (ms.date 8 Oct 2026)

### Inferences
- **[Inference]** Dataverse for Teams is ruled out on two counts: it has no API for the Node back end, and it is being deprecated.
- **[Inference]** Full Dataverse would give relational tables, row-level concurrency and auditing. But it needs Power Platform per-user or per-app licences or capacity add-ons for staff using it, and it moves the system of record away from SharePoint, which is the decided platform. It isn't worth it for this volume.

### Gaps
- I didn't retrieve current UK Dataverse capacity or licence prices (2026). Pricing changes often; check Microsoft's licensing guide if this option is ever revisited.

---

## Q6. Hybrid, and which option gives the best mix of reliability, low cost, low build effort and easy human access

### Takeaway
The best fit is **Option 5: SharePoint lists as the system of record** (as previously planned, written app-only with If-Match), **plus generated human-friendly files**: a PDF per finished run, filed in the site/month library folder alongside photos, and optionally a monthly XLSX or CSV per site written as a whole file by the function. Add a list-backed "Export to Excel" or Power Query for live analysis. Excel stays a *view*, never the store.

### Cited Findings
- **[Verified]** Lists: app-only supported, If-Match/412 supported, 30M items, 5,000 threshold managed with 20 indexes. — [Update listItem](https://learn.microsoft.com/en-us/graph/api/listitem-update?view=graph-rest-1.0); [SharePoint limits](https://learn.microsoft.com/en-us/office365/servicedescriptions/sharepoint-online-service-description/sharepoint-online-limits); [Add an index](https://support.microsoft.com/en-us/office/add-an-index-to-a-list-or-library-column-f3f00554-b7dc-44d1-a2ed-d477eac463b0)
- **[Verified]** Whole-file uploads (PDF, XLSX, CSV) use the driveItem content API, which supports application permissions, rather than the Excel workbook API, which doesn't. — [Upload small files](https://learn.microsoft.com/en-us/graph/api/driveitem-put-content?view=graph-rest-1.0); [TableRowCollection: add](https://learn.microsoft.com/en-us/graph/api/tablerowcollection-add?view=graph-rest-1.0)
- **[Verified]** Storage: 1 TB + 10 GB per licence per tenant; 25 TB per site; 250 GB per file. — [SharePoint limits](https://learn.microsoft.com/en-us/office365/servicedescriptions/sharepoint-online-service-description/sharepoint-online-limits)
- **[Verified]** Export to Excel gives a refreshable one-way table from a list view; CSV export is capped at 30,000 rows. — [Export to Excel from SharePoint or Lists](https://support.microsoft.com/en-us/office/export-to-excel-from-sharepoint-or-lists-bfb2ea48-6118-4fa9-abb6-cced9424e5d9)

### Comparison matrix [Inference, built from the cited facts above]

| Criterion | 1. Lists | 2. Excel via workbook API | 3. JSON file per run | 4. Dataverse (Teams / full) | 5. Lists + generated files |
|---|---|---|---|---|---|
| Works app-only with Sites.Selected | Yes | **No (row add: "Application: Not supported")** | Yes | Teams: no API; full: yes, separate auth | Yes |
| Several staff on one run at once | Item eTag + If-Match, merge in function | One serialised writer per workbook; lock and merge-conflict errors | Whole-file eTag; read-merge-write | Row-level | As lists |
| Offline sync bursts | OK within 1,250 RU/min | Queues and 504s likely | OK | OK | OK |
| Query and reporting across sites | Indexed `$filter`, views, Export to Excel | Good once opened, but slow to write | Poor (JSON opaque) | Good | Good |
| Scale at 410k answers a year | Fine with year-split lists and indexes | Master workbook grows towards limits; per-month files multiply | ~22k files a year; fine | Teams: 1M rows / 2 GB cap | Fine |
| Extra cost | None | None (but needs a delegated service user) | None | Licences and capacity; Teams version retiring 2027 | None |
| Build effort | Medium (already designed) | High (sessions, locks, retries, auth workaround) | Medium, plus reporting rebuild | High; off-platform | Medium + small (PDF/XLSX generation) |
| Human access | SharePoint list UI, Excel export | Familiar | Poor without rendering | Power Apps | **Best: PDF per run + list views + Excel** |

### Inferences
- **[Inference]** Answer to the user's question: "Just store it in Excel" isn't viable as the store. The Graph API Maginhawa's back end uses can't add rows app-only, and Excel's single-writer model conflicts with concurrent, offline phone and iPad use. "A folder of files per restaurant" works technically, but reporting and concurrency are no better than lists. Its real value is as an archive (one PDF or JSON snapshot per finished run per site folder), which Option 5 already includes.
- **[Inference]** To keep human access simple, the function writes a monthly per-site XLSX as a whole file (built in Node with a library such as ExcelJS or SheetJS, uploaded via `PUT …/content`, which supports app-only). That gives managers "their spreadsheet" without the workbook API. If someone has the file open, the upload simply creates a new version; nothing is merged.
- **[Inference]** Folder layout for the files: `Checklists/{Site}/{yyyy}/{MM}/` for run PDFs, JSON snapshots and photos. That keeps every folder far below 5,000 items (about 230 runs a month per site, plus photos), and naturally gives managers "a folder per restaurant".
- **[Inference]** Photos at about 9 GB a year are trivial against 1 TB + 10 GB per licence. Five years is about 45 GB. Version history on frequently rewritten files (such as a monthly XLSX) also consumes storage and should be capped with library version limits.
- **[Inference]** RU budget: write the 80 Responses rows at finish sequentially or with small concurrency. Or store answers only in the run's AnswersJson plus one flattened monthly CSV/XLSX, if per-answer list rows turn out not to be needed for reporting. This is a design trade-off to decide, not a platform limit.

### Gaps
- I found no Microsoft or MVP case study benchmarking lists against files against Excel at this exact scale. The recommendation rests on documented limits plus arithmetic.
- I didn't verify that Sites.Selected grants cover every Graph call used (list items, driveItem upload) in Maginhawa's tenant. Sites.Selected with a `write` role on the site is the expected route, but test it during provisioning.
