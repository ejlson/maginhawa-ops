# Human-friendly outputs for completed checklists (PDFs, Excel, folders, Microsoft 365 views)

Researched 9 November 2026. Labels used throughout:
- **[Verified]**: official vendor documentation (Microsoft Learn, Netlify docs) read directly.
- **[Community]**: blogs, forums, comparison sites, MVP posts. Plausible but not authoritative.
- **[Inference]**: my own reasoning from the cited findings, applied to Maginhawa.
- **(older)**: source dated before 2025, or its date is unclear.

---

## 1. PDF generation in Node serverless (Netlify)

### Takeaway
Use a pure-JS library (PDFKit or pdf-lib for full control, or @react-pdf/renderer if the team wants to reuse React/JSX skills) running in a **background function**. Avoid Puppeteer/Chromium on Netlify: it is near the bundle limit, has 3–6 s cold starts and needs 400–600 MB. Graph's own `?format=pdf` conversion is a poor fit, because the source is capped at 2 MB, the app-only permission is broad, and we would have to write a .docx/.xlsx first anyway.

### Cited Findings
**Netlify limits [Verified]**
- Default limits: synchronous execution **60 s** (not configurable), scheduled **30 s**, background **15 min**; memory defaults to **1024 MB**, configurable from 1024 to 4096 MB; buffered request/response payload **6 MB** (binary uploads effectively 4.5 MB because of Base64); streamed response **20 MB**; **background request/response payload 256 KB**. — [Netlify: Functions configuration](https://docs.netlify.com/build/functions/configuration/)
  - Note: the brief assumes a "~10 s synchronous limit". Netlify's current docs say 60 s. The 10 s figure was the older default. Check the account/plan before relying on either.
- Streaming functions have a 60-second execution limit and a 20 MB response limit. Memory and vCPU (0.5–2) are set per function and can't be combined. — [Netlify: Functions API](https://docs.netlify.com/build/functions/api/)
- `external_node_modules`, `included_files` and `node_bundler = "esbuild"` are the knobs for keeping heavy binaries (fonts, Chromium) out of the bundle. — [Netlify: Functions configuration](https://docs.netlify.com/build/functions/configuration/)

**Puppeteer/Chromium [Community]**
- Netlify Functions run on AWS Lambda. The usual blocker is the bundle size (about 50 MB zipped / 250 MB unzipped), not memory. Full `puppeteer` ships Chrome and goes over 250 MB, so people use `puppeteer-core` with `@sparticuz/chromium` (or `-min`, which downloads the binary at runtime). Some users still hit about 53 MB. — [Netlify forum (older)](https://answers.netlify.com/t/is-it-possible-to-run-the-full-puppeteer-node-package-in-next-js-api-route-on-netlify/102415/2); [Netlify forum: 69905067-byte CreateFunction error (older)](https://answers.netlify.com/t/lighthouse-background-function-request-must-be-smaller-than-69905067-bytes-for-the-createfunction-operation/42993); [Sparticuz/chromium](https://www.github.com/Sparticuz/chromium)
- Production comparison: Puppeteer with @sparticuz/chromium has about 100 MB of Chromium (≈50 MB added to the deploy), takes **2–5 s per PDF (2.8 s average)**, **3–6 s cold start** and **400–600 MB peak memory**. @react-pdf/renderer adds about 2 MB and generates in **under 500 ms**. `networkidle0` can hang on a missing image, so assets should be inlined as base64. — [dev.to: Puppeteer vs @react-pdf/renderer (year not shown)](https://dev.to/iurii_rogulia/pdf-generation-on-the-server-puppeteer-vs-react-pdfrenderer-a-production-comparison-44cg)
- A hosted headless browser (e.g. Browserless) avoids the size limit but adds a third-party processor. — [Netlify forum summary (older)](https://answers.netlify.com/t/memory-usage-puppeteer-function-or-repo-based/5613)

**Pure-JS libraries [Community]**
- pdf-lib is best for creating *and modifying* PDFs (merge, fill, stamp). `save()` returns the whole byte array in memory. It can embed JPG/PNG at exact positions. PDFKit is aimed at drawing documents from primitives (text, images, tables). @react-pdf/renderer has its own layout engine (flexbox-like, no browser) but a much larger unpacked size than PDFKit. — [npm-compare: pdf-lib vs pdfkit](https://npm-compare.com/pdf-lib,pdfkit); [npm-compare: react-pdf/renderer vs pdfkit etc.](https://npm-compare.com/@react-pdf/renderer,jspdf,pdf-lib,pdfkit,pdfmake,react-pdf)
- I found no neutral benchmark of the three on Lambda with image-heavy documents.

**Graph conversion (`GET /drives/{id}/items/{id}/content?format=pdf`) [Verified]**
- Supported PDF sources include doc/docx, xls/xlsx/xlsm, ppt/pptx, htm/html, md, rtf, odt/ods/odp, eml/msg, tif/tiff and loop. **csv is not listed.** — [Microsoft Learn: Convert to other formats (updated Oct 2026)](https://learn.microsoft.com/en-us/graph/api/driveitem-get-content-format)
- **"The maximum size limit for files to use format conversion is 2 MB."** The call returns a 302 redirect to a short-lived (minutes) pre-authenticated URL. The least-privileged *application* permission is **Files.ReadWrite.All** (higher: Sites.ReadWrite.All). — same source
- Community reports: encrypted/IRM/sensitivity-labelled files fail, and CSV returned `InputFormatNotSupported`. — [Microsoft Q&A (older)](https://learn.microsoft.com/en-us/answers/questions/372005/graph-api-convert-from-csv-to-pdf-reporting-inputf); [Microsoft Q&A docx encryption](https://learn.microsoft.com/en-us/answers/questions/1080666/convert-a-encrypted-word-docx-file-to-pdf-using-api)

### Inferences
- [Inference] Text-and-ticks checklists with a few thumbnails are small (tens to hundreds of KB). PDFKit or @react-pdf/renderer should generate one in well under a second, so even a synchronous call would fit in 60 s. A **background function triggered after "Finish"** is still the more reliable pattern: it keeps the manager's save fast and allows retries. Its 256 KB payload cap means we should pass **IDs only** and have the function read the answers from SharePoint itself.
- [Inference] Photos: resize/compress to thumbnails (e.g. ~800 px JPEG) before embedding. Original phone photos (2–5 MB each) would bloat PDFs and memory. Keep originals in the library and link to them from the PDF instead of embedding them at full size.
- [Inference] HTML-to-PDF via Graph (`.html` source → `format=pdf`) is technically possible. It needs an upload, conversion and re-upload (3 Graph calls), has the 2 MB cap and gives limited control of styling. It's also unclear whether **Sites.Selected** is honoured (the docs list Files.ReadWrite.All), so test before considering it.
- [Inference] A shared React component between the web app and the PDF (react-pdf) suits the "premium" design goal. It would be the natural choice if the team already writes React, at the cost of a larger bundle than PDFKit.

### Gaps
- No authoritative timing or memory benchmark of pdf-lib/PDFKit/react-pdf on Netlify with embedded photos. Measure with our own largest checklist.
- Whether Graph format conversion works under Sites.Selected app-only was not confirmed.
- Netlify's maximum function bundle size isn't stated on the current docs pages I read. The 50/250 MB figures come from AWS Lambda via community posts.

---

## 2. XLSX generation and uploading via Graph

### Takeaway
Use **ExcelJS** (MIT, styling, tables, freeze panes) to **rebuild the whole monthly file from SharePoint list data** on a schedule (or after each finish), and upload it with a simple PUT. Don't download, append and re-upload: rebuilding is idempotent and self-healing. Expect every re-write to create a new file version, so set the library's version limits on purpose.

### Cited Findings
- ExcelJS is consistently described as stronger than the SheetJS Community Edition for **styling and streaming writes**. SheetJS CE lacks fonts, borders and fills (Pro features). The npm `xlsx` package is stuck at **0.18.5 (2022) with known vulnerabilities**, and newer CE builds (0.20.x) come from SheetJS's own CDN. [Community] — [npm-compare: exceljs vs xlsx](https://npm-compare.com/exceljs,xlsx); [issoh.co.jp comparison](https://www.issoh.co.jp/tech/details/19141/); [pkgpulse 2026 guide](https://www.pkgpulse.com/guides/sheetjs-vs-exceljs-vs-node-xlsx-excel-files-node-2026)
- Even ExcelJS's streaming writer buffers significant worksheet state. [Community] — [typed-xlsx comparison](https://typed-xlsx.vercel.app/getting-started/comparison)
- **Simple upload (PUT …/content) supports files up to 250 MB**. Use an upload session for larger files. The same endpoint replaces an existing item's content. App permission: Files.ReadWrite.All (or Sites.ReadWrite.All). **Replacing a file protected with a sensitivity label isn't supported app-only.** [Verified] — [Microsoft Learn: Upload small files (updated Aug 2026)](https://learn.microsoft.com/en-us/graph/api/driveitem-put-content)
- Netlify's buffered payload is 6 MB. This doesn't limit what the function *sends to Graph*, only what clients send to or get back from the function. [Verified] — [Netlify configuration](https://docs.netlify.com/build/functions/configuration/)

**Versioning [Verified]**
- SharePoint offers **Automatic** version limits (recommended) and **Manual** limits (count plus optional expiration). Under Automatic, SharePoint keeps all versions for the first 30 days (within 500), then hourly versions for 30–60 days, daily for 60–180 days and weekly after that, capped at 500. Microsoft cites about 94–96% less version storage than count-only limits. — [Microsoft Learn: Plan version storage (updated Jul 2026)](https://learn.microsoft.com/en-us/sharepoint/plan-version-storage)
- Org defaults only apply to *new* libraries. Admins can set limits per library, and a job can trim existing versions. — same source; [Set default org version limits](https://learn.microsoft.com/sharepoint/set-default-org-version-limits)
- Conflict: one 2026 community guide says new libraries now default to Automatic, while Microsoft's org-defaults article still describes Manual with 500 major versions and no expiry as the default. [Community vs Verified] — [Microsoft Learn: Set default org version limits](https://learn.microsoft.com/sharepoint/set-default-org-version-limits); [Orchestry](https://www.orchestry.com/insight/sharepoint-version-history-limits)

### Inferences
- [Inference] Size: 8 sites × ~30 days × a few checklists × ~30–80 answers is a few thousand rows per site per month, so the XLSX will be well under 1 MB. A simple PUT is fine and upload sessions are unnecessary.
- [Inference] Re-writing daily gives about 30 versions per month per file, which is harmless under either setting. Re-writing on *every* finish could give hundreds. Prefer **one scheduled nightly rebuild** (scheduled functions have a 30 s limit, so have it trigger a **background function**) plus an on-demand "rebuild now".
- [Inference] Do not let people edit the generated workbook. Edits are lost on the next rebuild, and a user who has the file open can cause co-authoring or lock conflicts on PUT. Make the folder read-only (see §4) and put a "generated: do not edit" note on a cover sheet.
- [Inference] CSV vs XLSX: CSV is simpler, but on iPhone/iPad it opens without formatting, UK dates can be misread and leading zeros are lost. XLSX with typed date/number cells, a frozen header, an Excel *Table* (for filters) and column widths is far friendlier for non-technical managers. Offer CSV only as a power-user export.
- [Inference] Avoid sensitivity labels on this library: app-only replacement of labelled files fails.

### Gaps
- No primary source found on PUT behaviour when the target workbook is open for co-authoring in Excel (lock/423 errors). Test this.
- The ExcelJS memory profile at this scale wasn't benchmarked. It's likely trivial.

---

## 3. Native Microsoft 365 views as an alternative

### Takeaway
Native options are good for **head office on desktop/web** (filtered/grouped list views, Excel for the web with a Power Query connection, Power BI). They are weak for **managers on iPhone/iPad**: the Excel iPad app can't refresh connections, Export to Excel's .iqy doesn't work on Mac/iOS, and custom JSON formatting has historically not rendered in the Lists mobile app. Generated PDFs and static XLSX remain the most predictable "open it and read it" outputs for phone and tablet users.

### Cited Findings
- **Export to Excel** downloads a `.iqy` web query: a **one-way** live connection that is refreshed with Data > Refresh All. Changes in Excel aren't sent back. It is **not supported on Excel for Mac** (the .iqy just downloads). Trust Center prompts may appear. Only the filtered view exports. [Verified, older] — [Microsoft Support: Export to Excel from SharePoint or Lists](https://eus.prod.support.services.microsoft.com/en-gb/office/export-to-excel-from-sharepoint-or-lists-bfb2ea48-6118-4fa9-abb6-cced9424e5d9); [Microsoft Support: Can't export to Excel for Mac (2017)](https://support.microsoft.com/en-gb/topic/can-t-export-a-sharepoint-list-to-excel-for-mac-641b0eab-2b7d-490e-9f42-c216b053edb9)
- Large-list exports can be slow ("Reading Data") and can hit memory errors. A report from Dec 2025 says the .iqy re-queries the whole library rather than the filtered results. [Community] — [Microsoft Q&A](https://learn.microsoft.com/en-us/answers/questions/5395256/missing-columns-when-exporting-to-excel-from-share)
- **Excel for the web can refresh Power Query** from authenticated sources, including **SharePoint Online List** (announced July 2025). [Verified announcement] — [Tech Community: Excel for the web Power Query refresh](https://techcommunity.microsoft.com/t5/excel-blog/new-in-excel-for-the-web-power-query-refresh-data-source/ba-p/4422757)
- The native **Excel app for iPad/iPhone doesn't support refreshing external connections or Power Query**. The workaround is to refresh on the desktop or the web, save to SharePoint, then open on iPad. Some web refreshes still fail with "COULDN'T REFRESH DATA". [Community] — [Microsoft Q&A: data refresh](https://learn.microsoft.com/en-us/answers/questions/5780996/data-refresh-functionality-in-excel); [Fabric community](https://community.fabric.microsoft.com/t5/Power-Query/Refresh-Power-Query-on-Excel-Web/m-p/3407009)
- **View formatting** (JSON) supports row formatting in List/Compact layouts and card formatting in **Gallery** and **Board** layouts. Anyone who can manage views can apply it, and it only works in SharePoint Online. [Verified, page dated 2022] — [Microsoft Learn: View formatting](https://learn.microsoft.com/en-us/sharepoint/dev/declarative-customization/view-formatting)
- **Microsoft Lists iOS app**: launched Jan 2021 and iPad-optimised from Apr 2021. It supports sort, filter and group-by, and offline viewing. At launch, **custom JSON view/column formatting and column totals weren't shown in the mobile app**. [Community, older; current status unverified] — [handsontek: Meet the Lists iOS app](https://lists.handsontek.net/meet-microsoft-lists-application-ios/); [Windows Central: iPad update](https://windowscentral.com/microsoft-lists-optimized-ipad-part-latest-update); [Tech Community: Lists app for iOS](https://techcommunity.microsoft.com/blog/microsoft_365blog/get-the-microsoft-lists-app-for-ios/2072844)
- List views over **5,000 items** can fail unless they're filtered on indexed columns. A warning appears at 3,000. Lists hold up to 30 million items. The modern experience handles large views best. [Verified] — [Microsoft Support: Manage large lists and libraries](https://support.microsoft.com/en-us/office/manage-large-lists-and-libraries-b8588dae-9387-48c2-9248-c24122f07c59)

### Inferences
- [Inference] Head office: give them a **Power Query workbook in Excel for the web** (or Power BI if licensed) pointed at the answers list, filtered by Site/Date. It's live, needs no code, and reuses the data as it is. Power BI needs Pro/Fabric licences for sharing, which I didn't research here.
- [Inference] Managers: a **"This week" list view** filtered to their site (e.g. `[Me]`-based audiences can't filter by site, so use a per-site view or a Site column with an index) is readable in the Lists app. Don't rely on JSON formatting to make it look good on iPhone. Generated PDFs are what managers should open and share.
- [Inference] Native views can replace the *head office* monthly Excel (via Power Query), but not the per-checklist PDF, which acts as the immutable "record as signed off" for audits and EHO visits.
- [Inference] Index the `Site`, `ChecklistDate` and `Status` columns from day one. At 8 sites × daily checklists × many answer rows, the answers list will pass 5,000 items within weeks.

### Gaps
- Current (2026) Lists mobile app support for JSON formatting, calendar views and offline editing was not confirmed from an official source.
- Power BI licensing and costs for the group weren't researched.
- Whether Excel for the web Power Query refresh works in Safari on iPad specifically wasn't confirmed.

---

## 4. Permissions, read-only folders and external sharing (EHO)

### Takeaway
Have the app write into a library that staff can only **read**, using a SharePoint group per site, or better, a **library per access boundary** rather than broken inheritance on many folders. For an EHO inspector, prefer a **specific-people ("users") view link with an expiry date** on the single PDF, or an emailed PDF attachment. Avoid "Anyone" links for documents containing staff names or photos.

### Cited Findings
- `createLink` supports `type: view|edit`, `scope: anonymous|organization|users` and `expirationDateTime`. Passwords are OneDrive Personal only. Without an explicit expiry, **links don't expire unless the organisation enforces a default expiration policy**. Links always point to the *current* version of the item. App permission: Files.ReadWrite.All (Sites.ReadWrite.All). [Verified] — [Microsoft Learn: driveItem createLink (updated Aug 2026)](https://learn.microsoft.com/en-us/graph/api/driveitem-createlink)
- "Anyone" links are only available if external sharing is set to Anyone at both tenant and site level. Expiry for Anyone links can be enforced tenant-wide. Guest access can be set to expire after N days (Policies > Sharing). [Community / Microsoft Q&A] — [SharePoint Maven](https://sharepointmaven.com/how-to-configure-expiration-and-permissions-options-for-anyone-links-in-sharepoint-online/); [Microsoft Q&A](https://learn.microsoft.com/en-us/answers/questions/5852639/how-to-share-a-sharepoint); [Microsoft Learn training: external sharing](https://learn.microsoft.com/en-us/training/modules/manage-sharepoint-online-use-windows-powershell/5-manage-sharepoint-online-external-user-sharing)
- The guest expiration policy doesn't apply to guests who already had access before the policy was set. [Community] — [Practical365](https://practical365.com/guest-expiration-policy-sharepoint-online-onedrive/)
- CIS Microsoft 365 benchmark: ensure an expiration time is set for external sharing links. [Community/benchmark] — [Tenable CIS M365 v2.0.0 6.3](https://tenable.com/audits/items/CIS_Microsoft_365_v2.0.0_E3_Level_1.audit:ea95c07bfbcda6fa99829abd18391f26)
- Unique permissions: up to 50,000 per list/library, **recommended general limit 5,000**. [Verified] — [Microsoft Support: Manage large lists and libraries](https://support.microsoft.com/en-us/office/manage-large-lists-and-libraries-b8588dae-9387-48c2-9248-c24122f07c59)
- **Fine-grained app access**: `Files.SelectedOperations.Selected` grants app-only access to a specific library folder, and access to a folder covers all files inside it. `ListItems.SelectedOperations.Selected` grants access to specific items. Grants are made per resource (e.g. `New-MgDriveItemPermission` with the app ID and role). The app can't see anything else, including the site via search. [Community, Feb 2026; preview/GA status unconfirmed] — [Office365ITPros: scoped access to files and folders](https://office365itpros.com/2026/02/18/scoped-access-files-and-folders/amp/); [dev.to: Making SharePoint Online more secure](https://dev.to/kkazala/making-sharepoint-online-even-more-secure-3le1)
- Sites.Selected works at whole-site level, and the app has no access until an admin grants it via `sites/{id}/permissions`. [Community] — [michev.info](https://www.michev.info/?p=3256)

### Inferences
- [Inference] Folder-level read-only: break inheritance once per **site folder** (8 folders plus head office), granting "Read" to that site's manager group and to head office. That's well under the 5,000 unique-permission guidance. Leave year/month subfolders inheriting. Only the app identity (and a couple of admins) should have write access, so nobody can edit or delete a signed-off PDF.
- [Inference] Alternatively, one library with *no* broken inheritance where everyone reads everything is simplest. Choose it if the group is happy for managers to see other sites' checklists. Decide this with the user. The current Sites.Selected grant already scopes the app to the one site, so either layout works for the app.
- [Inference] Graph sharing link creation lists Files.ReadWrite.All as least privilege for app-only. If we must stay on Sites.Selected, test whether `createLink` works under it. If it doesn't, have a **manager share from the SharePoint/OneDrive app** (delegated, with the org's expiry policy) rather than broadening the app's rights.
- [Inference] UK GDPR: checklist PDFs may contain staff names, signatures, temperature logs and photos (possibly of people). For an EHO, share **only the relevant records**, use a **view-only, specific-people or expiring link** (or attach a PDF to an email from a business account), record what was shared and when (accountability, Art. 5(2)), and avoid photos of identifiable staff or customers in the PDFs where possible (data minimisation, Art. 5(1)(c)). Set a retention period for the library that matches food-safety record needs. This needs confirmation against FSA/EHO guidance, which I didn't research here.

### Gaps
- Whether `createLink` and format conversion work with Sites.Selected app-only wasn't verified in official docs.
- The preview/GA status of the `*.SelectedOperations.Selected` permissions as of Nov 2026 wasn't confirmed.
- UK food-safety record retention periods and ICO guidance on sharing with regulators weren't researched here.

---

## 5. Folders vs metadata in libraries (navigation, thresholds, mobile)

### Takeaway
A **shallow folder tree (Site/yyyy/mm) plus metadata columns** (Site, Date, ChecklistType, Status) is the pragmatic hybrid. Folders give non-technical users something to tap through in the OneDrive/SharePoint iOS apps and Files app, and give a natural permission boundary per site. Indexed metadata powers filtered views and search, and keeps views under the 5,000 threshold.

### Cited Findings
- The list view threshold is 5,000. Indexing, filtering, **folders** and personal views are all listed as ways to keep queries under it. Lists can hold up to 30 million items. [Verified] — [Microsoft Support: Manage large lists and libraries](https://support.microsoft.com/en-us/office/manage-large-lists-and-libraries-b8588dae-9387-48c2-9248-c24122f07c59)
- Folders count as items toward the 5,000 limit. A Microsoft Q&A answer says folders don't raise the threshold itself, but browsing within a folder reduces what a view returns. [Community] — [Microsoft Q&A: large data threshold](https://learn.microsoft.com/en-ca/answers/questions/5770307/microsoft-list-large-data-reach-threshold); [SharePoint Maven: 5000 limit](https://sharepointmaven.com/how-to-overcome-sharepoint-5000-item-limit-threshold/)
- MVP guidance: metadata is better for filtering, sorting and views, folders are better for security boundaries and simple navigation, and a hybrid is common. A flat view without folders that returns more than 5,000 items breaks the view. [Community] — [SharePoint Maven: Folders vs metadata](https://sharepointmaven.com/sharepoint-folders-vs-metadata/); [Tech Community: flat libraries vs folders (older)](https://techcommunity.microsoft.com/discussions/sharepoint_general/flat-document-libraries-vs-folders/301866/replies/302200); [Insight: features that use both](https://eum.insight.com/en_US/content-and-resources/tech-tutorials/3-sharepoint-features-that-use-both-folders-and-metadata.html)

### Inferences
- [Inference] Volume estimate: 8 sites × (say) 5 checklists/day + 1 day summary × 365 ≈ 17,500 PDFs a year. A flat library would pass 5,000 within about 3–4 months, so folders by Site/yyyy/mm keep each folder at around 150–200 files, which is ideal for scrolling on iPhone.
- [Inference] Still set `Site`, `ChecklistDate`, `ChecklistType` and `Status` as indexed columns on the library (via Graph `fields` after upload). That lets head office build cross-site views ("all failed fridge checks this month", with "show items without folders" plus filters on indexed columns) without depending on the folder tree.
- [Inference] File naming matters on mobile, where only the name shows: e.g. `2026-11-09 Opening checks - Soho - completed 08-42.pdf` sorts chronologically and reads well in the Files app and OneDrive app.
- [Inference] Put the monthly Excel at `Site/yyyy/mm/` (or `Site/yyyy/` for a year view) so each manager has everything for a month in one place.

### Gaps
- Microsoft's own current guidance page comparing folders and metadata wasn't found. The evidence is MVP/community material plus the large-lists support article.
- No official source on how OneDrive/SharePoint iOS apps behave with deep folders or large folders. Usability is inferred.
