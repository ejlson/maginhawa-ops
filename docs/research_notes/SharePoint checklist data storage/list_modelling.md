# Modelling and querying daily checklist submissions in SharePoint Online lists via Microsoft Graph

Scope: 8 sites, at most one checklist per site per day, roughly 20–80 answers each, about 1,250 list items a day (about 410k a year), Netlify Functions (TypeScript) calling Graph app-only with Sites.Selected. Researched 6 Nov 2026. Sources are Microsoft Learn unless labelled **[community]**. Anything I state from prior knowledge that I could not re-check is labelled **(unverified)** and kept under Inferences or Gaps.

---

## 1. Header/detail design vs JSON-on-one-item vs hybrid; text and item size limits

### Takeaway
Use a **hybrid**: one `ChecklistDays` header item per site per date (unique compound key, a status, a few summary figures and a JSON snapshot of all answers), plus an `ChecklistAnswers` list with one row per answer for reporting. The header list grows by only about 2,920 items a year, so it stays under the 5,000 view threshold for about 20 months. The app reads and writes the header (one or two calls). Answer rows feed Excel and Power BI and can be written asynchronously. A plain-text multi-line column holds about 63,999 characters (community-sourced, not in Microsoft's limits page), which is enough for an 80-answer JSON snapshot without photos or signatures.

### Cited Findings
- A list can hold up to 30 million items. Once a list or folder has more than 100,000 items, you can't break or reinherit permissions on the list or folder itself, but you can still break them on individual items. — [SharePoint limits (Microsoft Learn, updated Oct 2026)](https://learn.microsoft.com/en-us/office365/servicedescriptions/sharepoint-online-service-description/sharepoint-online-limits)
- Supported limit of unique permissions per list is 50,000; recommended limit is 5,000. — [SharePoint limits](https://learn.microsoft.com/en-us/office365/servicedescriptions/sharepoint-online-service-description/sharepoint-online-limits)
- A file attached to a list item is limited to 250 MB. — [SharePoint limits](https://learn.microsoft.com/en-us/office365/servicedescriptions/sharepoint-online-service-description/sharepoint-online-limits)
- Item versions: 50,000 major and 511 minor. — [SharePoint limits](https://learn.microsoft.com/en-us/office365/servicedescriptions/sharepoint-online-service-description/sharepoint-online-limits)
- Microsoft's "Manage large lists" page gives a row size limit of 6 internal table rows and up to 8,000 bytes (excluding attachments). It says this applies to SharePoint Server, **not** SharePoint Online. — [Manage large lists and libraries (Microsoft Support)](https://support.microsoft.com/en-us/office/manage-large-lists-and-libraries-b4038448-ec0e-49b7-b853-679d3d8fb784)
- **[community]** Several sources put the multi-line text column (plain or enhanced rich text) at **63,999 characters**. One Microsoft Q&A answer says 350, which looks wrong. One Reddit report describes a plain-text column that stopped accepting input at 255 characters, with no resolution. — [lookbook365](https://lookbook365.com/features/multiple-lines-of-text-column-sharepoint/); [Tech Community thread](https://techcommunity.microsoft.com/discussions/sharepoint_general/sharepoint-column-character-limit/4008113); [Microsoft Q&A](https://learn.microsoft.com/en-us/answers/questions/5145019/sharepoint-multiple-lines-of-text-column-with-unli)
- **[community]** List views show only about 5 lines of a multi-line column per row. That is a display limit, not a storage limit. — [Microsoft Q&A](https://learn.microsoft.com/en-us/answers/questions/5159663/ms-lists-5-lines-maximum-visible-in-multiple-lines)
- The Graph listItem filter can use **only one indexed field at a time**. — [List items (Graph v1.0)](https://learn.microsoft.com/en-us/graph/api/listitem-list?view=graph-rest-1.0)

### Inferences
- **Header list volume:** 8 sites × 365 = 2,920 items a year at most. Even unindexed reads stay under 5,000 until about month 20, and with an indexed `DayKey` or `Date` they keep working long after.
- **Answers list volume:** about 1,250 rows a day (about 410k a year). It needs indexes from day one (see §3 and §6). Any query must narrow to fewer than 5,000 rows on its first indexed filter, for example "all answers for `SITE|2026-11-06`" returns at most 80 rows.

| Option | Reads in the app | Excel / Power BI | Concurrency | Write cost (RU) | Main risk |
|---|---|---|---|---|---|
| A. Header + one row per answer | Header + filter answers by key (≤80 rows) | Best: tidy, typed, one row per fact | Fine-grained: two people editing different answers don't collide | 80 creates × 2 RU = about 160 RU per full checklist | Burst writes at closing time; partial saves if a batch half-fails |
| B. JSON in one multi-line column | One GET | Poor: Power Query has to parse JSON; Power BI service refresh is slower; no list-view filtering | Coarse: every edit rewrites the whole blob, so you need ETag/If-Match and a merge on 412 | 1 PATCH = 2 RU | Lost updates without ETag; the about-64k-character ceiling (community figure); not searchable by field |
| C. Hybrid (A + JSON snapshot on header) | One GET of the header | Use the answers list | Header PATCH with If-Match; answer rows upserted by unique key | 2 RU per save + background answer rows | Two copies can drift, so treat the header JSON as the source of truth and rebuild rows from it |

- Recommendation: **C**. Keep the header as the authoritative record (status, `SubmittedAt`, `SubmittedBy`, `SchemaVersion`, summary counts such as failed checks, and the `AnswersJson` snapshot). Derive answer rows idempotently with a unique key per answer (see §5). Store photos and signatures as files in a document library (path `/{Site}/{yyyy}/{MM}/{DayKey}/{questionId}.jpg`) and keep only URLs or IDs in the answer row. Don't use list attachments, which aren't filterable or reportable.
- Keep the JSON compact. 80 answers × about 150 characters is about 12k characters, well under 63,999. Signatures as base64 SVG or PNG would blow the budget, so they must go to files.

### Gaps
- I found no official Microsoft Learn statement of the multi-line text limit for SharePoint Online. The 63,999 figure is community-sourced. Test it with a 60k-character write before relying on it.
- I found no official per-item total size limit for SPO list items (the 8,000-byte row limit is SharePoint Server only).

---

## 2. Typed value columns vs one text column; Graph field types and gotchas

### Takeaway
In the answers list, use **sparse typed value columns**: `ValueText`, `ValueNumber`, `ValueBool`, `ValueDate`, plus `AnswerType` and `QuestionId`. Each row fills only the one value column its `AnswerType` needs. Also write a `ValueDisplay` text column so Excel users can read any row. Typed columns let you filter and aggregate (for example fridge temperature above 5°C) in Graph, Power Query and Power BI without casting. Write dates as plain `yyyy-MM-dd` and treat every Graph DateTime as UTC.

### Cited Findings
- Column type facets on `columnDefinition` are mutually exclusive. Available types: boolean, calculated, choice, currency, dateTime, lookup, number, personOrGroup, text, term, hyperlinkOrPicture, thumbnail, contentApprovalStatus, geolocation. Some SPFieldTypes are missing from Graph, and such columns come back with no type facet. — [columnDefinition (Graph v1.0)](https://learn.microsoft.com/en-us/graph/api/resources/columndefinition?view=graph-rest-1.0)
- `columnDefinition` has `enforceUniqueValues` ("no two list items may have the same value for this column") and `indexed` properties, both settable via Graph. — [columnDefinition](https://learn.microsoft.com/en-us/graph/api/resources/columndefinition?view=graph-rest-1.0)
- Field values are written with `PATCH /sites/{site-id}/lists/{list-id}/items/{item-id}/fields` and a fieldValueSet body. Only the fields you supply change. — [Update listItem](https://learn.microsoft.com/en-us/graph/api/listitem-update?view=graph-rest-1.0)
- **[community]** SharePoint stores a Date-only column as midnight in the **site's** time zone. In a positive UTC offset that becomes the previous day in UTC. — [K2 KB](https://help.k2.com/kb001739)
- **[community]** REST and PnPjs (and in practice Graph) return dates as UTC ISO 8601 strings such as `...Z`. Running a date-only value through `new Date()` in local time can move it to the previous day. The advice is to take the date part of the string. — [SPGuides](https://www.spguides.com/?p=132866)
- **[community]** Writing a full DateTime with `Z` or an offset into a date-only field caused off-by-one dates in Power BI. The fix was to write a plain `yyyy-MM-dd` string. — [Fabric community](https://community.fabric.microsoft.com/discussions/power-bi-designer/suddenly-wrong-dates-in-powerbi/4905162)

### Inferences
- **London-specific:** in British Summer Time (UTC+1), a date-only "2026-07-01" is stored as 30 June 23:00Z. The **key** for a day must therefore never be a DateTime column. Use a **text** `DayKey` = `"2026-07-01"` (and the compound `SITE|2026-07-01`). Keep a separate DateTime `BusinessDate` only for Power BI date tables. Set the site's regional time zone to London.
- Number columns are double-precision floats (unverified). Store temperatures as Number with 1 decimal place, but **store money as integer pence** (Number) or text if exact arithmetic matters. This matches `packages/core` doing the calculations, not SharePoint.
- Choice columns reject values outside the choice set unless "allow fill-in" is on (unverified). For checklist answers whose options are defined in the template, write them to `ValueText` rather than a Choice column, so template changes don't need a schema change. Use Choice only for fixed system enums such as `Status` (Draft/Submitted/Reopened).
- Yes/No (boolean) columns default to No, so "unanswered" and "No" look the same (unverified). For checks where unanswered matters, use a nullable `ValueBool` plus an `IsAnswered` flag, or store `"yes"`/`"no"`/`"na"` in `ValueText`.
- Single-line text is capped at 255 characters (unverified, standard SharePoint). Use multi-line for free-text answers longer than that. Multi-line columns can't be indexed or used in Graph `$filter` (unverified).

### Gaps
- I couldn't fetch the Microsoft Learn `numberColumn` / `dateTimeColumn` / `textColumn` pages within budget to cite the exact precision, `format: dateOnly` behaviour and the `maxLength` 255 cap.

---

## 3. Finding records: $filter, indexes, Prefer header, 5,000 threshold, compound keys, paging, delta

### Takeaway
Find a day's checklist with **one equality filter on one indexed, unique text key**:
`GET /sites/{id}/lists/{ChecklistDays}/items?$expand=fields($select=...)&$filter=fields/DayKey eq 'SOHO|2026-11-06'`
Find its answers with `fields/DayKey eq 'SOHO|2026-11-06'` on the answers list (indexed, not unique). Create all indexes **before** the answers list grows (automatic indexing stops at 20,000 items). Don't rely on the `Prefer: HonorNonIndexedQueriesWarningMayFailRandomly` header in production. Use delta queries (`/items/delta`) to sync changes into any cache or reporting store.

### Cited Findings
- Graph listItem `$filter` supports `eq, ne, lt, gt, le, ge, startswith`. Both listItem properties and `fields/` can be filtered. "When filtering on indexed fields, the service can only filter one indexed field at a time." "Filtering works best on indexed columns." Results may be paged. — [List items (Graph v1.0)](https://learn.microsoft.com/en-us/graph/api/listitem-list?view=graph-rest-1.0)
- Use `expand=fields(select=Col1,Col2)` to return only the columns you need. — [List items](https://learn.microsoft.com/en-us/graph/api/listitem-list?view=graph-rest-1.0)
- The list view threshold is 5,000 and **can't be changed in SharePoint Online**. Operations over it are blocked. Users see a warning at 3,000 items. Auditors and admins get 20,000. — [Manage large lists](https://support.microsoft.com/en-us/office/manage-large-lists-and-libraries-b4038448-ec0e-49b7-b853-679d3d8fb784)
- **[community]** Filtering on an unindexed field returns `400 invalidRequest`, "Field 'X' cannot be referenced in filter or orderby as it is not indexed". Adding `Prefer: HonorNonIndexedQueriesWarningMayFailRandomly` lets it run, but it can fail on large lists. A related 422 `notSupported` case was fixed by the same header. — [Microsoft Q&A 1359977](https://learn.microsoft.com/en-us/answers/questions/1359977/error-received-on-request-with-400-status-code-inv); [Microsoft Q&A 1359190](https://learn.microsoft.com/en-us/answers/questions/1359190/unable-to-query-list-getting-field-title-cannot-be); [Microsoft Q&A 910731](https://learn.microsoft.com/en-us/answers/questions/910731/microsoft-graph-returns-422-error-on-querying-for)
- **[community]** Title and most custom columns are not indexed by default. — [Pipedream SharePoint action docs](https://pipedream.com/apps/sharepoint/actions/list-items.md)
- Microsoft community guidance says automatic indexing "will not automatically create indexes for lists/libraries with more than 20,000 items". **[community, 2017]** An MVP adds that you can't create new indexes manually above 20,000 items either. — [Large lists, large libraries (Microsoft 365 community docs)](https://learn.microsoft.com/microsoft-365/community/large-lists-large-libraries-in-sharepoint); [sympmarc (2017, older)](https://sympmarc.com/2017/11/08/predictive-indexing-comes-to-office-365-lists-and-libraries/)
- Delta: `GET /sites/{siteId}/lists/{listId}/items/delta` is v1.0. Follow `@odata.nextLink` until `@odata.deltaLink`. `?token=latest` returns just a fresh deltaLink. Deleted items arrive with `deleted: { state: "deleted" }`. The feed shows the latest state, not every change, and the same item can appear more than once (use the last occurrence). `410 Gone` with `resyncChangesApplyDifferences` / `resyncChangesUploadDifferences` means start a fresh enumeration. It supports `$select`, `$expand`, `$top`. — [listItem: delta](https://learn.microsoft.com/en-us/graph/api/listitem-delta?view=graph-rest-1.0)
- A delta call with a token costs 1 RU. Without a token it costs 2 RU. Microsoft calls delta "the most efficient way to scan content". — [Avoid getting throttled (SharePoint dev, updated Aug 2026)](https://learn.microsoft.com/en-us/sharepoint/dev/general-development/how-to-avoid-getting-throttled-or-blocked-in-sharepoint-online)

### Inferences
- **Index plan** (well under the 20-per-list cap, which I recall but did not re-verify this session):
  - `ChecklistDays`: `DayKey` (text, indexed, **enforce unique**), `Site` (text, indexed), `BusinessDateKey` (text `yyyy-MM-dd`, indexed), `Status` (indexed).
  - `ChecklistAnswers`: `AnswerKey` (text, indexed, unique: `SITE|DATE|questionId`), `DayKey` (indexed), `QuestionId` (indexed), `BusinessDateKey` (indexed).
- **Compound keys:** because only one indexed field is used per filter, put the query you need most into one key (`SITE|yyyy-MM-dd`). Text `yyyy-MM-dd` keys sort lexically, so `fields/BusinessDateKey ge '2026-11-01' and fields/BusinessDateKey le '2026-11-07'` works as a range. On the answers list a week is about 8,750 rows, **over 5,000**. Keep answers-list range queries to 3 days or less, or (better) run reporting from the header list or a Power BI dataset.
- **Use a dedicated `DayKey` column rather than `Title`** so Title stays human-readable ("Soho, Fri 6 Nov"). Either works technically.
- **Paging:** use `$top` (for example 200) and follow `@odata.nextLink` verbatim. `$orderby` on a non-indexed field falls under the same "cannot be referenced in filter or orderby" error. Order only by an indexed field, or sort client-side once you have at most 80 rows.
- Treat the Prefer header as a dev-only crutch. Once a list passes 5,000 items, a query that worked can start failing ("MayFailRandomly").

### Gaps
- I didn't re-check the "20 indexed columns per list" cap or "unique values requires an indexed column" on a current Microsoft Learn page. Both are long-standing SharePoint behaviour (unverified this session). Confirm while provisioning.
- I found no Microsoft documentation on `$orderby` support or limits for listItem in Graph v1.0. The listItem list page mentions only `$filter` and `$expand`.

---

## 4. Lookup columns vs plain text keys

### Takeaway
Use **plain indexed text keys** (`DayKey`, `Site`, `QuestionId`), not lookup columns. Lookups need you to resolve and write the integer item ID (`{Field}LookupId`), count towards the 12-join threshold, and add a dependency between lists. Text keys are idempotent (the client can compute them offline), filterable with one indexed equality filter, and simple to use in Power Query.

### Cited Findings
- Lookup fields aren't returned by default. Graph returns a companion `{FieldName}LookupId` field. You can request up to 12 lookup fields per query. — [fieldValueSet (Graph)](https://learn.microsoft.com/en-us/graph/api/resources/fieldvalueset)
- **[community, Microsoft staff answer]** To write a single lookup, PATCH `/items/{id}/fields` with `{"TestLookupId": "5"}`, where the value is the target item's ID. — [Microsoft Q&A 634931](https://learn.microsoft.com/en-us/answers/questions/634931/how-to-update-sharepoint-list-lookup-column-with-g)
- The list view lookup threshold is 12 join operations (lookup, person or group, and workflow status columns). — [Manage large lists](https://support.microsoft.com/en-us/office/manage-large-lists-and-libraries-b4038448-ec0e-49b7-b853-679d3d8fb784)

### Inferences
- An offline client can't know the header's SharePoint item ID before the first save, but it can compute `SOHO|2026-11-06`. Text keys remove a round trip and a race.
- Person columns (for example `SubmittedBy`) also count as joins and need site user IDs. With app-only auth, store the Entra object ID and display name as text instead.

### Gaps
- I didn't confirm the exact Graph body for multi-value lookups (`@odata.type: Collection(Edm.Int32)`). It isn't needed if you follow the recommendation.

---

## 5. Concurrency and idempotency

### Takeaway
(1) **Creation idempotency:** enforce unique values on `DayKey` (header) and `AnswerKey` (answers). An offline retry or a second device that POSTs the same key gets a conflict, which you then treat as "already exists": GET by key and PATCH. (2) **Edit concurrency:** PATCH with `If-Match: <eTag>`. On `412 Precondition Failed`, re-read, merge per answer (last-writer-wins per question with `answeredAt`) and retry. (3) **Batching:** up to 20 requests per `$batch`. Each sub-request is throttled and can fail on its own. (4) **Throttling:** honour `Retry-After` on 429 and 503. SharePoint says it does **not** send IETF RateLimit headers.

### Cited Findings
- `If-Match: etag` on listItem PATCH: if the eTag doesn't match, the API returns `412 Precondition Failed` and doesn't update the item. — [Update listItem](https://learn.microsoft.com/en-us/graph/api/listitem-update?view=graph-rest-1.0)
- listItems carry an `eTag` such as `"{GUID},756"`, visible in delta and list responses. — [listItem: delta](https://learn.microsoft.com/en-us/graph/api/listitem-delta?view=graph-rest-1.0)
- **[community]** Writing a duplicate into a SharePoint list via a Graph-based connector returned **409** with code `nameAlreadyExists`. The poster tied it to the Title column. It isn't confirmed to be the unique-values error. A ShareGate article describes "the value provided already exists in another list item" for unique-enforced columns. — [KNIME forum](https://forum.knime.com/t/sharepoint-online-list-writer-status-409-code-namealreadyexists/84980); [ShareGate help](https://help.sharegate.com/en/articles/10236832-the-value-provided-already-exists-in-another-list-item)
- `$batch`: at most 20 requests. `dependsOn` sequences requests, and if one fails, its dependants fail with **424**. Microsoft advises a batch be "either fully sequential or fully parallel". Responses may come back out of order (match them by `id`). An overall 200 doesn't mean the sub-requests succeeded. Sub-requests are throttled individually and may each return 429. — [JSON batching](https://learn.microsoft.com/en-us/graph/json-batching)
- In batches, "requests in a batch are evaluated individually by resource units". — [Avoid getting throttled](https://learn.microsoft.com/en-us/sharepoint/dev/general-development/how-to-avoid-getting-throttled-or-blocked-in-sharepoint-online)
- RU costs: 1 for a single-item GET or delta with a token; 2 for a multi-item query, create, update or delete; 5 for permission operations. Microsoft "reserve[s] the right to change" these. — [Avoid getting throttled](https://learn.microsoft.com/en-us/sharepoint/dev/general-development/how-to-avoid-getting-throttled-or-blocked-in-sharepoint-online)
- Per app per tenant (0–1,000 licences): **1,250 RU per minute** and **1,200,000 RU per 24 h**. Higher licence bands scale to 6,250 per minute and 6M per day. The tenant-wide limit is 18,750 RU per 5 min (0–1,000 licences). — [Avoid getting throttled](https://learn.microsoft.com/en-us/sharepoint/dev/general-development/how-to-avoid-getting-throttled-or-blocked-in-sharepoint-online)
- 429 and 503 both carry `Retry-After`. Throttled requests still count towards usage. "SharePoint Online does not return or support IETF RateLimit headers." Decorate traffic with User-Agent `NONISV|CompanyName|AppName/Version`, since undecorated traffic is deprioritised. — [Avoid getting throttled](https://learn.microsoft.com/en-us/sharepoint/dev/general-development/how-to-avoid-getting-throttled-or-blocked-in-sharepoint-online)

### Inferences
- **Volume against limits:** about 1,250 creates a day × 2 RU ≈ 2,500 RU a day, which is 0.2% of the 1.2M daily budget. **The per-minute budget is the real risk:** 8 sites closing around 23:00, each posting 80 answer rows = 640 creates ≈ 1,280 RU, already over 1,250 RU per minute for a tenant under 1,000 licences. The hybrid design (header PATCH = 2 RU per save, answer rows written by a background job or queue paced at about 300 RU per minute) avoids this. If you write rows synchronously, cap concurrency and back off on 429.
- **Save protocol (recommended):**
  1. The client sends `{dayKey, answers[], clientMutationId}`.
  2. The Function GETs the header by `DayKey` (1 indexed filter). If missing, it POSTs (unique key, so a race loser gets a conflict, then re-GETs).
  3. It merges answers per question by `answeredAt` and PATCHes `/fields` with `If-Match`. On 412 it repeats from the GET, up to N times.
  4. It enqueues answer-row upserts keyed by `AnswerKey`. A FlowOutbox-style list or job table fits the existing pattern.
- Treat any 409 on POST to a unique-key list as "exists", whatever the inner code, and confirm by GET. Don't parse the message text.
- Don't use `dependsOn` for "create header then create answers", because a header conflict would 424 all 19 dependants. Prefer independent parallel upserts.

### Gaps
- I found no official Graph documentation of the exact status and error code when `enforceUniqueValues` rejects a POST or PATCH. Community evidence points to 409 (`nameAlreadyExists` seen in one case). Confirm in a test tenant and assert on status only.
- I found no 2025–2026 change to the RU tables beyond the Aug 2026 page revision, which notably says RateLimit headers are **not** supported. Older guidance said they were sent in some cases (unverified).

---

## 6. Scale: about 410k items a year

### Takeaway
One answers list easily holds decades of data (30M cap, about 73 years at 410k a year), **if** every Graph query's first indexed filter returns fewer than 5,000 rows and the indexes exist before the list reaches 20,000 items (about 16 days of answers). For a cleaner admin experience, partition the answers list **by year** (`ChecklistAnswers_2026`, `_2027`). Keep the single small header list across years. Archive by leaving old year lists read-only rather than moving items.

### Cited Findings
- 30M items per list. 2,000 lists and libraries per site collection. Over 100,000 items you can't break or reinherit permissions on the list itself. — [SharePoint limits](https://learn.microsoft.com/en-us/office365/servicedescriptions/sharepoint-online-service-description/sharepoint-online-limits)
- The 5,000 view threshold can't be changed in SPO. The UI warns at 3,000. — [Manage large lists](https://support.microsoft.com/en-us/office/manage-large-lists-and-libraries-b4038448-ec0e-49b7-b853-679d3d8fb784)
- No automatic indexing above 20,000 items. — [Microsoft 365 community docs](https://learn.microsoft.com/microsoft-365/community/large-lists-large-libraries-in-sharepoint)
- **[community]** On large lists, Quick Edit can hit the 5,000 error and Export to Excel was reported to export only 100 items. Indexed views mostly work, though not always. — [Microsoft 365 community docs](https://learn.microsoft.com/microsoft-365/community/large-lists-large-libraries-in-sharepoint); [sympmarc (2017)](https://sympmarc.com/2017/11/08/predictive-indexing-comes-to-office-365-lists-and-libraries/)
- Microsoft recommends delta with a token for scanning content (1 RU). — [Avoid getting throttled](https://learn.microsoft.com/en-us/sharepoint/dev/general-development/how-to-avoid-getting-throttled-or-blocked-in-sharepoint-online)

### Inferences
- **Provisioning order matters:** create the columns, indexes and unique constraints in the provisioning script (`docs/tech-plan/sharepoint/sharepoint-lists.json`) **before** go-live. Adding an index later to a 400k-row list may be impossible without emptying it.
- **Year partitioning:** the Function resolves the list name from `BusinessDateKey`. Each list then holds about 410k items, but queries are by key, so performance is the same. Year lists also make "Excel export for 2026" and retention or deletion under UK GDPR (drop a whole year list once the retention period ends) simple.
- **Archiving pattern:** at the start of each year, provision the next year's list, set last year's to read permissions for the app, and optionally export it to CSV or Parquet in a document library for Power BI. Moving 400k items between lists would cost about 800k RU, about 2/3 of a day's app budget, so avoid it.
- **Reporting:** point Power BI at the header list (small) plus a monthly CSV extract built from delta, rather than at the full answers list through the SharePoint connector. Power Query against a 400k-row list will be slow and may hit throttling.

### Gaps
- I found no current official Microsoft guidance on Graph query latency against lists of hundreds of thousands of items with good indexes. Evidence is anecdotal. Load-test with synthetic data in a test site.
- The 20,000 manual-index ceiling comes from a 2017 community post and may have changed.

---

## 7. Microsoft Search API for list items

### Takeaway
Don't use `/search/query` to find checklists. App-only search needs a `region` value and Sites.Read.All or wider. It is reported **not to honour Sites.Selected** (500 errors or tenant-wide results). Results are subject to crawl latency and a 25 requests per second throttle for app-only. Indexed `$filter` on the list is exact, immediate and works with Sites.Selected.

### Cited Findings
- `POST /search/query` with `entityTypes: ["listItem"]` returns listItems with `sharepointIds.listItemId`. You can ask for custom fields through `fields`. KQL property restrictions need queryable managed properties, and the site-level search schema isn't supported. — [Search OneDrive and SharePoint content](https://learn.microsoft.com/en-us/graph/search-concept-files)
- `includeHiddenContent` works only with delegated permissions. — [Search OneDrive and SharePoint content](https://learn.microsoft.com/en-us/graph/search-concept-files)
- App-only search: you must set `region` (from `siteCollection.dataLocationCode`), it is limited to one geo, and private content is excluded unless you request it. — [Search all content (searchall)](https://learn.microsoft.com/en-us/graph/search-concept-searchall)
- App-only SharePoint search with Sites.Read.All or above is throttled at 25 requests per second (429). — [Avoid getting throttled](https://learn.microsoft.com/en-us/sharepoint/dev/general-development/how-to-avoid-getting-throttled-or-blocked-in-sharepoint-online)
- **[community]** Search with app-only Sites.Selected failed with 500 and worked only after adding Sites.ReadWrite.All (2024). A Jan 2026 report says `/v1.0/search/query` ignored the Sites.Selected restriction and returned all sites, with "no supported way" to enforce it. `GET /sites?search=` explicitly doesn't support Sites.Selected. — [Microsoft Q&A 2086794](https://learn.microsoft.com/en-us/answers/questions/2086794/graph-api-search-fails-with-app-only-selected-site); [Microsoft Q&A](https://learn.microsoft.com/en-us/answers/a/12532120); [site search (beta)](https://learn.microsoft.com/th-th/graph/api/site-search?view=graph-rest-beta)

### Inferences
- Asking for Sites.Read.All just to search would undo the least-privilege choice of Sites.Selected. If free-text search over notes is ever needed, build it in the app over the header JSON (small) or over a delta-synced cache.

### Gaps
- I found no official figure for SharePoint Online search crawl or indexing latency for list items. It is commonly said to be minutes, sometimes longer (unverified). Don't assume read-after-write consistency.
- No official Microsoft statement on whether `/search/query` supports Sites.Selected. The evidence is community reports only.

---

## Summary of concrete recommendations

| Topic | Recommendation |
|---|---|
| Lists | `ChecklistDays` (header, all years), `ChecklistAnswers_{yyyy}` (rows), document library `ChecklistMedia` for photos and signatures |
| Keys | Text `DayKey = SITE|yyyy-MM-dd` (indexed, unique) on the header; `AnswerKey = SITE|yyyy-MM-dd|questionId` (indexed, unique) plus `DayKey` (indexed) on answers |
| Dates | Text `BusinessDateKey` for keys and ranges; DateTime only for display and Power BI; site time zone London; never key on a Date column |
| Values | Sparse `ValueText` / `ValueNumber` / `ValueBool` / `ValueDate` plus `AnswerType` and `ValueDisplay`; money in pence |
| Lookups | None; plain text keys |
| Writes | Header PATCH with If-Match, retry on 412; unique-key conflict on POST treated as exists then GET and PATCH; answer rows written in the background, paced under 1,250 RU per minute |
| Reads | One indexed `eq` filter plus `expand=fields(select=…)`; no Prefer header in production; delta with a token for sync |
| Scale | Indexes provisioned before go-live; year-partitioned answers; archive by making the list read-only, not by moving items |
| Search | Don't use `/search/query` (Sites.Selected incompatibility) |
