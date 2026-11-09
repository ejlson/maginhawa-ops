# Storing checklist photos in SharePoint Online via Microsoft Graph (app-only, Sites.Selected)

Scope: 8 sites, daily checklists, photos compressed on device to about 300 KB, about 9 GB a year (about 30,000 photos a year, or about 80 a day, at 300 KB each; this is derived arithmetic, not a sourced figure). Back end: Node/TypeScript Netlify Functions using app-only Graph tokens. Research date: 6 Nov 2026. Microsoft Learn pages were fetched live; the "updated_at" date of each page is noted where it matters.

## 1. Options compared: document library vs list item attachments vs Image column

### Takeaway
Only option (a), a **document library with metadata columns**, is fully and officially supported for reading and writing through Graph v1.0. List item attachments are **still not supported in Graph** (v1.0 or beta) as of early 2026. The Image column has a `thumbnail` column facet in Graph, but there is **no documented way to write its value**. Its value is a JSON blob containing a server-generated token, and its files land in `Site Assets/Lists/<listId>/`. Use a library, and link each answer row to the photo by storing ids.

### Cited Findings
**(a) Document library + metadata columns: fully supported**
- Items in SharePoint document libraries "can be represented as listItem or driveItem resources". A driveItem has a `listItem` relationship ("For drives in SharePoint, the associated document library list item") and `sharepointIds` ("identifiers useful for SharePoint REST compatibility"). — [driveItem resource, v1.0 (updated Oct 2026)](https://learn.microsoft.com/en-us/graph/api/resources/driveitem?view=graph-rest-1.0)
- Column values on a list item (and so on a library file) are updated with `PATCH /sites/{site-id}/lists/{list-id}/items/{item-id}/fields`, which supports `If-Match` (412 on mismatch). — [Update listItem, v1.0](https://learn.microsoft.com/en-us/graph/api/listitem-update?view=graph-rest-1.0)

**(b) List item attachments: not in Graph**
- A Microsoft Q&A answer from Jan 2026 says Graph still doesn't support list item attachments. The `Attachments` field returns only true/false, and attaching files to list items via Graph is unsupported. The workaround is SharePoint REST `/_api/web/lists/getbytitle('…')/items({id})/AttachmentFiles`. (Community or moderator answer, not official docs.) — [Microsoft Q&A: Unable to retrieve SharePoint list item attachments using Graph](https://learn.microsoft.com/en-us/answers/questions/2157145/unable-to-retrieve-sharepoint-list-item-attachment); [Microsoft Q&A: uploading attachments to existing list items](https://learn.microsoft.com/en-us/answers/questions/5694846/microsoft-graph-uploading-attachments-to-existing)
- Service limit: "250 MB – File attached to a list item." — [SharePoint limits (updated 7 Oct 2026)](https://learn.microsoft.com/en-us/office365/servicedescriptions/sharepoint-online-service-description/sharepoint-online-limits)

**(c) Image column: readable, but no supported Graph write**
- Graph `columnDefinition` lists a `thumbnail` facet ("This column stores thumbnail values"). The same page notes that site and list column responses "won't contain … **thumbnail** …" properties, and that the API "is still missing some" field types. — [columnDefinition, v1.0](https://learn.microsoft.com/en-us/graph/api/resources/columndefinition?view=graph-rest-1.0)
- A Microsoft moderator answer (Jan 2021) gives these details:
  - In Graph, the Image column value is a JSON string: `fileName`, `serverRelativeUrl`, `id`, `serverUrl`, and `thumbnailRenderer` {`spItemUrl`, `fileVersion`, `sponsorToken`}.
  - The file is uploaded to `SiteAssets/Lists/<listId>/`.
  - The column "is intended for setting values through the UI".
  - The moderator recommends a Hyperlink column instead.
  - Note the age of this answer. — [Microsoft Q&A 215190](https://learn.microsoft.com/en-us/answers/questions/215190/upload-thousands-of-images-to-sharepoint-lists-ima)
- The PnP PowerShell sample sets an Image field by passing JSON with the server-relative URL and the file's UniqueId. That is PnP/CSOM, not Graph. — [PnP script sample: Add/Update image in SharePoint Image column](https://pnp.github.io/script-samples/spo-add-update-image-column/README.html)
- Community report: when list attachments are enabled, new Image column uploads are stored in the list (as attachments) rather than Site Assets. — [Tech Community discussion: Image column format](https://techcommunity.microsoft.com/discussions/sharepoint_general/image-column-format/4044652)
- Hyperlink/Picture columns via Graph:
  - A 2023 Q&A accepted answer said Graph could not PATCH them.
  - A March 2025 reply reports a `Prefer: apiversion=2.1` header workaround. This is unverified against official docs. — [Microsoft Q&A 1382210](https://learn.microsoft.com/en-us/answers/questions/1382210/how-to-make-post-patch-request-to-add-hyperlink-pi)

### Inferences
- Comparison table:

| | (a) Library + metadata | (b) List attachments | (c) Image column |
|---|---|---|---|
| Graph v1.0 write | Yes (PUT content + PATCH fields) | **No** | No documented way |
| Graph v1.0 read | Yes, plus thumbnails and downloadUrl | **No** (flag only) | JSON blob only; file sits in Site Assets |
| Beta | Same as v1.0 | No evidence of support | No evidence of support |
| Per-photo metadata (site/date/checklist/question/hash) | Yes, as indexed columns | No (attachments have no columns) | No (lives on the row, not the file) |
| Thumbnails API | Yes | No | Only via the Site Assets file |
| Fit for app-only Sites.Selected | Yes | REST only (separate auth path) | Fragile |
- Recommendation: **one dedicated document library ("ChecklistPhotos")** in the same site as the checklist lists. Each answer row stores the photo's `driveItem id` (and/or `listItemId` plus a stable `PhotoId` GUID). Each photo row stores `SiteCode`, `ChecklistDate`, `ChecklistId`, `QuestionId`, `AnswerItemId`, `Sha256`, `UploadedBy` and `CapturedAt`.

### Gaps
- No official Graph doc or changelog entry (2024–2026) was found that adds list item attachment support or Image column writes in v1.0 or beta. I did not search the Graph changelog exhaustively.
- I could not confirm whether the `Prefer: apiversion=2.1` workaround works for Image (thumbnail) columns.

## 2. Uploading to a document library via Graph (limits, sessions, conflictBehavior, metadata, ids)

### Takeaway
Simple upload (`PUT …:/{filename}:/content`) now officially supports files **up to 250 MB**, so a 300 KB photo needs one PUT. Setting custom columns takes a **second call** (PATCH the list item `fields`), because the simple PUT body is raw bytes. Use `@microsoft.graph.conflictBehavior=fail` in the URL with a UUID filename so nothing is ever overwritten.

### Cited Findings
- "This method only supports files up to 250 MB in size." The response is a driveItem (201 Created for new files). Paths include `PUT /drives/{drive-id}/items/{parent-id}:/{filename}:/content` and `PUT /sites/{site-id}/drive/items/{parent-id}:/{filename}:/content`. Application permission (least privileged) is `Files.ReadWrite.All`. "Replacing the contents of a file protected with a sensitivity label is not supported with app-only authentication." — [Upload small files, v1.0 (updated 11 Aug 2026)](https://learn.microsoft.com/en-us/graph/api/driveitem-put-content?view=graph-rest-1.0)
- `@microsoft.graph.conflictBehavior` takes "*fail*, *replace*, or *rename*. The default for PUT is *replace*." It "should be included in the URL instead of the body of the request." `eTag` = "eTag for the entire item (metadata + content)"; `cTag` = "An eTag for the content of the item… isn't changed if only the metadata is changed". `@microsoft.graph.sourceUrl` upload is "not supported" in SharePoint Online. — [driveItem resource](https://learn.microsoft.com/en-us/graph/api/resources/driveitem?view=graph-rest-1.0)
- Upload sessions:
  - `POST …:/{fileName}:/createUploadSession`; the body `item` takes `@microsoft.graph.conflictBehavior` ("fail (default) | replace | rename"), `name`, `driveItemSource` and `mediaSource`.
  - `description` and `fileSize` are OneDrive personal only, so **custom SharePoint columns cannot be set here**.
  - Fragments must be multiples of 320 KiB (327,680 bytes), each under 60 MiB, uploaded in order.
  - Don't send the `Authorization` header on the PUTs to `uploadUrl` (this can cause a 401).
  - Each fragment extends `expirationDateTime`.
  - `deferCommit: true` with a final zero-length POST to commit is supported on SharePoint.
  - Use resumable uploads for files over 10 MiB.
  - The `If-Match`/`If-None-Match` headers give 412 on an ETag mismatch.
  - A name conflict at commit gives 409 `nameAlreadyExists`.
  - The application permission column lists only `Sites.ReadWrite.All`. — [createUploadSession, v1.0 (updated 11 Aug 2026)](https://learn.microsoft.com/en-us/graph/api/driveitem-createuploadsession?view=graph-rest-1.0)
- Update listItem fields: `PATCH /sites/{site-id}/lists/{list-id}/items/{item-id}/fields` with a JSON fieldValueSet. It returns 200 with the updated fieldValueSet, and `if-match` is supported. The documented application permission is `Sites.ReadWrite.All`. — [Update listItem](https://learn.microsoft.com/en-us/graph/api/listitem-update?view=graph-rest-1.0)
- Community confirmation of the "upload then PATCH fields" pattern for library custom columns, with common errors: 400 for wrong internal column names, 404 for wrong ids (Sept 2024). — [Microsoft Q&A 2076876](https://learn.microsoft.com/en-us/answers/questions/2076876/how-to-update-a-sharepoint-online-document-library)

### Inferences
- **Concrete call sequence (recommended, 2 calls per photo):**
  1. `PUT https://graph.microsoft.com/v1.0/drives/{photosDriveId}/root:/{SiteCode}/{yyyy}/{mm}/{photoId}.jpg:/content?@microsoft.graph.conflictBehavior=fail&$select=id,eTag,cTag,sharepointIds,size,file`
     - Headers: `Authorization: Bearer …`, `Content-Type: image/jpeg`. Body: the bytes.
     - Returns 201 with the driveItem. Keep `id` (driveItem id), `eTag`, and `sharepointIds.listItemId`. Missing intermediate folders are normally created automatically by path-based PUT. That comes from experience, not from the fetched page, so verify it.
     - A 409 means the name already exists, which should never happen with UUID names. If it does, treat it as an idempotent retry and look up the existing item.
     - Whether `$select` is honoured on the PUT response is unverified. If it isn't, follow with `GET /drives/{driveId}/items/{id}?$select=sharepointIds,eTag`.
  2. `PATCH https://graph.microsoft.com/v1.0/sites/{siteId}/lists/{photosListId}/items/{listItemId}/fields`
     - Body: `{ "SiteCode":"…", "ChecklistDate":"2026-11-06", "ChecklistId":"…", "QuestionId":"…", "AnswerItemId":123, "Sha256":"…", "PhotoId":"…" }`.
     - The commonly used shortcut `PATCH /drives/{driveId}/items/{itemId}/listItem/fields` is widely used in the community, but I did not see it on the fetched official page.
  3. Write the photo's `driveItem id` and `PhotoId` back onto the checklist answer row (that is a separate list write that the app already does).
- Both calls can go in a single `POST /$batch` only if the PATCH doesn't need the listItemId from the PUT. It does, so in practice this is **two sequential calls**. Each photo costs about 4 resource units (see section 4).
- Make the upload idempotent: the client generates `photoId` (a UUID v4) before upload. A retry after a timeout reuses the same name, and with `conflictBehavior=fail` you get 409 and not a duplicate.
- Permissions conflict: the per-endpoint tables list `Files.ReadWrite.All` / `Sites.ReadWrite.All` and don't mention `Sites.Selected`. The Selected-scopes overview says scopes "now support" lists, items and files and that "any scopes presented in the token are honored". The practical reading is that `Sites.Selected` with a `write` role on the site covers these calls. That is how the existing EOD back end already works, but it is not stated on each endpoint page.

### Gaps
- When simple PUT moved from 4 MB to 250 MB: older Graph and OneDrive docs and SDK guides said 4 MB. The current v1.0 page says 250 MB, but I did not find the changelog date. Code that still caps at 4 MB is harmless for 300 KB photos.
- No official statement was found on whether `$select` works on the PUT content response.

## 3. Folder strategy, list view threshold, item counts, path length, naming

### Takeaway
The 5,000-item list view threshold applies to libraries as well as lists, and it can't be raised in SharePoint Online. At about 30k photos a year it will be crossed in the first year. Plan on **indexed columns from day one** (SiteCode, ChecklistDate, ChecklistId, PhotoId). Use **light folders (`/{SiteCode}/{yyyy}/{mm}/`)** so no folder ever comes near 5,000 items: one site-month is at most a few hundred photos. The library cap of 30 million items and the 400-character path limit don't come into play.

### Cited Findings
- "A list can have up to 30 million items and a library can have up to 30 million files and folders." Over 100,000 items, "you can't break permissions inheritance on the list, library, or folder". — [SharePoint limits](https://learn.microsoft.com/en-us/office365/servicedescriptions/sharepoint-online-service-description/sharepoint-online-limits)
- "The entire decoded file path, including the file name, can't contain more than 400 characters." — [SharePoint limits](https://learn.microsoft.com/en-us/office365/servicedescriptions/sharepoint-online-service-description/sharepoint-online-limits)
- 2,000 lists and libraries combined per site collection. — [SharePoint limits](https://learn.microsoft.com/en-us/office365/servicedescriptions/sharepoint-online-service-description/sharepoint-online-limits)
- The List View Threshold is "the maximum number of list or library items that a database operation, such as a query, can process at one time". "Operations that exceed this limit are blocked." The limit "can't be changed" in SharePoint Online. Microsoft recommends you "manage the number of items returned using indexing, filtering, folders". — [Manage large lists and libraries (Microsoft Support)](https://support.microsoft.com/en-us/office/manage-large-lists-and-libraries-b4038448-ec0e-49b7-b853-679d3d8fb784)
- `columnDefinition.indexed`: "Specifies whether the column values can be used for sorting and searching". `enforceUniqueValues` is available. — [columnDefinition](https://learn.microsoft.com/en-us/graph/api/resources/columndefinition?view=graph-rest-1.0)
- Sync guidance: no more than 300,000 files synced per library. This only matters if someone syncs the library with the OneDrive client. — [SharePoint limits](https://learn.microsoft.com/en-us/office365/servicedescriptions/sharepoint-online-service-description/sharepoint-online-limits)

### Inferences
- Path example: `ChecklistPhotos/SOHO/2026/11/7f3c…-uuid.jpg` is about 60 characters, well under 400.
- Name each file `{photoId-uuid}.jpg` (or `.webp`). Don't put question text or person names in file names: they leak personal data into URLs and logs and risk illegal characters. Store meaningful attributes in columns instead.
- Create indexes (via Graph `indexed: true` or the UI) **before** the library passes 5,000 items. Adding indexes to big lists is harder; this is commonly reported, but I did not verify it on this pass.
- Folders keep each folder small for browsing and `children` listing. The indexed columns let the app query across folders (for example, every photo for one checklist) with `$filter` on indexed fields. Graph list-item queries on non-indexed fields need the `Prefer: HonorNonIndexedQueriesWarningMayFailRandomly` header, which is known Graph behaviour (not fetched here), and are unreliable past 5,000.
- Better still, the app rarely needs to query the library at all. The checklist answer row already holds the photo's driveItem id, so a display needs only a direct GET by id (1 RU).
- `enforceUniqueValues` on `PhotoId` (which requires `indexed`) gives a server-side guard against duplicates.

### Gaps
- I did not fetch a page stating the per-folder 5,000 behaviour or the 20-indexes-per-list limit. The Support page fetched does not cover them.

## 4. Showing photos in the app: thumbnails, downloadUrl, proxy vs short-lived URLs, throttling

### Takeaway
Graph creates thumbnails for free: `small` (96px), `medium` (176px), `large` (800px), and custom sizes such as `c400x400`. Thumbnail URLs are "cache-safe", meaning they change only when the image changes. `@microsoft.graph.downloadUrl` is pre-authenticated (no auth header) but short-lived (about 1 hour) and "can't be cached". Users don't need SharePoint access if the Netlify Function (app-only) either **returns short-lived URLs** after its own authorisation check, or **streams the bytes**. Short-lived URLs are cheaper and faster. Proxying gives tighter control and allows a stable cacheable URL. At this scale, throttling is not a concern.

### Cited Findings
- Thumbnail sizes:
  - `small` is 96 longest, `medium` 176 longest, `large` 800 longest.
  - `smallSquare`, `mediumSquare` and `largeSquare` are 96, 176 and 800 square crops.
  - Custom `c300x400` fits inside the box; `c300x400_crop` is cropped.
  - `GET /drives/{drive-id}/items/{item-id}/thumbnails` returns metadata with `url`s.
  - `…/thumbnails/{thumb-id}/{size}/content` returns a 302 redirect to the image.
  - "Thumbnail URLs are cache-safe. The URL will change, if the item changes in a way that requires a new thumbnail to be generated."
  - In OneDrive for Business and SharePoint, `children?expand=thumbnails` and `expand=children(expand=thumbnails)` "will not work".
  - The returned size "may not exactly match" the request.
  - Application permission: `Files.Read.All` (least privileged). — [List thumbnails, v1.0](https://learn.microsoft.com/en-us/graph/api/driveitem-list-thumbnails?view=graph-rest-1.0)
- `@microsoft.graph.downloadUrl`: "A URL that can be used to download this file's content. Authentication isn't required with this URL." "…is a short-lived URL and can't be cached. The URL is invalidated after … a short period of time (1 hour). Removing file permissions for a user might not immediately invalidate the URL." — [driveItem resource](https://learn.microsoft.com/en-us/graph/api/resources/driveitem?view=graph-rest-1.0)
- "Preview item" gives "short-lived embeddable URLs for an item in order to render a temporary preview." — [driveItem resource (methods table)](https://learn.microsoft.com/en-us/graph/api/resources/driveitem?view=graph-rest-1.0)
- Throttling, resource units (RU):
  - 1 RU for single-item get or download from a driveItem.
  - 2 RU for multi-item queries and for create, update, delete or upload.
  - 5 RU for permission operations.
  - Per app per tenant, for 0–1,000 licences: **1,250 RU per minute** and **1,200,000 RU per 24 h**.
  - Ingress and egress are each **400 GB per hour** per app.
  - On 429 or 503, honour `Retry-After`.
  - SharePoint "does not return or support IETF RateLimit headers".
  - Decorate traffic with User-Agent `NONISV|CompanyName|AppName/Version`.
  - Requests in a `$batch` are each counted separately. — [Avoid getting throttled or blocked in SharePoint Online (updated Aug 2026)](https://learn.microsoft.com/en-us/sharepoint/dev/general-development/how-to-avoid-getting-throttled-or-blocked-in-sharepoint-online)

### Inferences
- Load estimate (derived):
  - Uploads: about 80 photos a day × about 4 RU (PUT plus PATCH) is about 330 RU a day.
  - Viewing: a manager opening a day's checklist with 20 photos, using one thumbnails call per photo at 1 RU each, is about 20 RU.
  - Even hundreds of views a day are far under 1,250 RU a minute. Egress at 300 KB a photo is negligible against 400 GB an hour.
- Recommended display pattern:
  1. The app asks our function `GET /api/photos/{photoId}?size=c600x600`.
  2. The function checks the user's role and site.
  3. The function calls `GET /drives/{d}/items/{id}/thumbnails/0/c600x600` (or `?select=c600x600`).
  4. The function either **302-redirects** the browser to the thumbnail `url`, or streams it.
  - For full-size images, use `GET /drives/{d}/items/{id}?$select=id,@microsoft.graph.downloadUrl` and redirect.
  - Never store `downloadUrl` in SharePoint or in long-lived client caches.
- Redirect vs proxy trade-off:
  - Redirect: lowest Netlify bandwidth and function time, and the image comes straight from SharePoint's CDN host. But for the URL's lifetime, anyone holding it can fetch the image.
  - Proxy: the URL never leaves our function, and we can set our own `Cache-Control: private, max-age=…` and ETag (from `cTag`). It costs function execution time and bandwidth (300 KB × views).
  - For a staff-only app, redirect-to-thumbnail is usually enough. Proxy if photos may show people (staff or customers) and you want tighter control under UK GDPR.
- Because `expand=thumbnails` on children doesn't work in SharePoint, fetch thumbnails per item. Use JSON `$batch` (up to 20 requests per batch is the standard Graph limit, from general Graph knowledge and not fetched here) to cut round trips; RU are still counted per request.

### Gaps
- Official lifetime of thumbnail `url`s for SharePoint: the docs say "cache-safe" but give no expiry. Community experience is that SharePoint thumbnail URLs carry a temporary token. I did not verify this.
- No official doc confirms that a thumbnail `url` returned to an app-only caller works in a browser without auth. It is widely relied on, but verify it in a spike.

## 5. Storage limits, version history, recycle bin

### Takeaway
At about 9 GB a year, photo storage is small next to the tenant pool (1 TB + 10 GB per licence). The only risks are uncontrolled version growth (avoid it by never overwriting) and the recycle bin, which counts against quota. Set the photo library to a low manual version limit. With write-once uploads, each photo has one version anyway.

### Cited Findings
- "Total storage per organization": **1 TB + 10 GB per license purchased** (Business, Enterprise and Office 365 plans). F1/F3: 1 TB. Max per site: **25 TB**. Extra storage is sold in 1 GB increments. Storage is in binary GB (2^30 bytes). A tenant over its limit risks being put into **read-only mode**. — [SharePoint limits](https://learn.microsoft.com/en-us/office365/servicedescriptions/sharepoint-online-service-description/sharepoint-online-limits)
- "We recommend monitoring the sites Recycle Bin and emptying it regularly. The storage space it uses is part of the organization's total storage limit." — [SharePoint limits](https://learn.microsoft.com/en-us/office365/servicedescriptions/sharepoint-online-service-description/sharepoint-online-limits)
- Maximum versions: 50,000 major and 511 minor. — [SharePoint limits](https://learn.microsoft.com/en-us/office365/servicedescriptions/sharepoint-online-service-description/sharepoint-online-limits)
- Version history limits can be set at organisation, site or library level:
  - "Automatic" setting: optimises storage.
  - "Manual" setting: a major-version count, with or without an expiry, for example 500 versions with a 365-day expiry.
  - The UI doesn't allow fewer than 100 versions or less than 30 days, but public APIs can set lower values.
  - Versions trimmed because they exceed limits are permanently deleted, bypassing the recycle bin.
  - Retention policies and holds override version limits. — [Version history limits overview (updated Jun 2026)](https://learn.microsoft.com/en-us/sharepoint/document-library-version-history-limits)

### Inferences
- 9 GB a year is under 1% of even the 1 TB base. A 25-licence tenant has about 1.25 TB. Ten years of photos (about 90 GB) is still small.
- Versions add storage only if a file's content changes. Overwrite is blocked (`conflictBehavior=fail`) and metadata PATCHes don't change content (cTag is unchanged). So photo versions should stay at about 1 per file. Note that SharePoint versioning stores metadata-only changes as new versions too; these are small.
- If photos are deleted (for example under a retention schedule), they sit in the recycle bins and still count against quota until purged.

### Gaps
- I did not fetch an official statement that each version is stored as a full copy and counts against quota. This is widely understood, but it was not verified on this pass.
- The recycle bin retention period (commonly 93 days across first and second stage) was not verified on this pass.

## 6. Integrity: hashes, preventing overwrite, versioning, read-only after upload

### Takeaway
Graph's `file.hashes.sha256Hash` is **explicitly unsupported** ("Don't use"). Compute SHA-256 on the device and again in the function, then store it in a `Sha256` text column. `quickXorHash` is the only Graph hash guaranteed in SharePoint and can be used as a second check. Prevent overwrite with UUID names plus `conflictBehavior=fail`. Make files effectively read-only by giving staff **no direct permission** on the library, so only the app identity writes, and optionally by applying a **retention label marked as a record**.

### Cited Findings
- `hashes`:
  - `sha256Hash`: "This property isn't supported. Don't use."
  - `sha1Hash` and `crc32Hash` are "if available".
  - "quickXorHash is the only value that is guaranteed to be available for both OneDrive for work or school and OneDrive for home", and a QuickXorHash snippet is linked. — [hashes resource, v1.0](https://learn.microsoft.com/en-us/graph/api/resources/hashes?view=graph-rest-1.0)
- Overwrite protection:
  - `conflictBehavior` fail/replace/rename, with PUT defaulting to *replace* — [driveItem resource](https://learn.microsoft.com/en-us/graph/api/resources/driveitem?view=graph-rest-1.0).
  - `If-Match` / `If-None-Match` give 412 — [createUploadSession](https://learn.microsoft.com/en-us/graph/api/driveitem-createuploadsession?view=graph-rest-1.0); [Update listItem](https://learn.microsoft.com/en-us/graph/api/listitem-update?view=graph-rest-1.0).
- The driveItem methods include "Set retention label", "Lock or unlock record" ("Lock or unlock a retention label on a driveItem that classifies content as records"), "Check in" and "Check out". — [driveItem resource](https://learn.microsoft.com/en-us/graph/api/resources/driveitem?view=graph-rest-1.0)
- "Version deletion on documents marked as records is blocked." Version limits are honoured on labelled items unless they are under a retention policy or hold. — [Version history limits overview](https://learn.microsoft.com/en-us/sharepoint/document-library-version-history-limits)
- Selected scopes can be granted at list level (`Lists.SelectedOperations.Selected`, via `POST /sites/{siteid}/lists/{listid}/permissions`) with roles read, write, owner or fullcontrol. "Assigning application permissions to lists, list items, folders, or files breaks inheritance". — [Selected permissions overview (updated Feb 2026)](https://learn.microsoft.com/en-us/graph/permissions-selected-overview)

### Inferences
- Integrity flow:
  1. The device computes SHA-256 (`crypto.subtle.digest`) after compression and sends it with the upload.
  2. The function recomputes SHA-256 on the received bytes and rejects on mismatch.
  3. The function PUTs with `conflictBehavior=fail`.
  4. The function stores `Sha256` in the column and on the answer row.
  5. Optionally, compare the response `size`, or compute QuickXorHash locally and compare it with `file.hashes.quickXorHash`.
- "Read-only" in practice:
  - (i) Break inheritance on the ChecklistPhotos library so staff have no or read-only access. Managers view only through the app.
  - (ii) The app never issues content PUTs to existing items.
  - (iii) Optionally, apply a Purview retention label configured as a record (this needs Purview licensing and setup, and the label must be published to the site) to block edits and deletions for the retention period.
  - Keep versioning on with a small manual limit (for example 100 versions, the UI minimum) as a safety net.
- Least privilege: the app could hold `Lists.SelectedOperations.Selected` on the photo library only. But the back end already uses `Sites.Selected` for the checklist lists, so a site-level `write` grant already covers it.

### Gaps
- Licensing needed for retention labels or records in this tenant (Business Premium vs E3/E5) was not researched.

## 7. Image handling on device: format, HEIC, EXIF/location stripping

### Takeaway
Re-encode on the device through `<canvas>` (or `createImageBitmap` + `OffscreenCanvas`) to **JPEG at about 0.7–0.8 quality, longest edge about 1600–2048 px**. That reaches about 300 KB and also **drops EXIF, including GPS**, which is good for UK GDPR data minimisation. Canvas can't output HEIC, so iPhone HEIC photos must be decoded and re-encoded anyway, and iOS often converts HEIC to JPEG at the file picker. Handle EXIF orientation explicitly. Prefer JPEG over WebP for maximum compatibility with SharePoint thumbnails and previews.

### Cited Findings
- WebKit bug 207088: with a file input set to `accept="image/jpeg"`, iOS converts HEIC selections to JPEG and **strips EXIF**, while macOS doesn't. Behaviour depends on the camera's "Most Compatible" setting. — [WebKit Bug 207088](https://bugs.webkit.org/show_bug.cgi?id=207088); [webkit-unassigned list, Dec 2022](https://lists.webkit.org/pipermail/webkit-unassigned/2022-December/1075175.html)
- An Apple Developer Forums thread reports EXIF stripping changing across iOS 16.4.x (anecdotal). — [Apple Developer Forums 678109](https://developer.apple.com/forums/thread/678109)
- Secondary sources say `canvas.toBlob` output carries no EXIF, XMP or IPTC, and that `toBlob` outputs only JPEG, PNG or WebP. These are blog-level sources, not the HTML spec. — [DEV Community: reading and stripping EXIF in the browser with exifr](https://dev.to/arhan_ahmad_a67ef7bd2b992/reading-and-stripping-exif-metadata-in-the-browser-with-exifr-19dg); [orthogonal.info: strip EXIF in the browser](https://orthogonal.info/how-to-strip-exif-data-from-photos/); [codegenes: mobile Safari image upload sizes](https://www.codegenes.net/blog/mobile-safari-image-upload-and-their-sizes/)
- Graph's driveItem exposes `photo` (taken date and camera) and `location` (geoCoordinates) facets derived from file metadata. So if EXIF is kept, SharePoint will surface the GPS location through the API. — [driveItem resource](https://learn.microsoft.com/en-us/graph/api/resources/driveitem?view=graph-rest-1.0)

### Inferences
- If capture time matters as evidence (for example, that a fridge-temperature photo was taken today), read `DateTimeOriginal` from the original file **before** re-encoding (for example with exifr) and store it in a `CapturedAt` column. Also record the server receive time.
- Don't keep GPS. The site is already known from the checklist context, so location adds privacy risk with no benefit.
- JPEG is the safe default. WebP saves about 25–35% (general knowledge, unsourced here), but SharePoint thumbnail and preview support for WebP was not verified, and 9 GB a year doesn't justify the risk.
- Use `capture="environment"` on the input to open the rear camera directly on phones and iPads.

### Gaps
- No authoritative (WHATWG or browser vendor) statement was found that canvas encoding never writes metadata. Verify with a test image in iOS Safari and Chrome.
- SharePoint Online thumbnail generation support for WebP and HEIC was not checked.
