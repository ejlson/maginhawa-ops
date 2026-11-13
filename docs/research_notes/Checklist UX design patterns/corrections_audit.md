# Correcting submitted checklist records: UK expectations and UX patterns

Researched 9 Nov 2026. Scope: how food-safety and operational checklist records should be corrected after submission, what UK regulators expect, and how products show corrections, late entries, missed checks, sign-off and history.

## 1. UK regulator expectations (FSA SFBB, HACCP, Food Standards Scotland, EHO view)

### Takeaway
UK food guidance is light on *how* to correct records, but clear on *what* records must show: daily manager sign-off, a note of anything that went wrong and what was done, and a periodic (4-weekly or weekly) management review that looks for repeat problems. No fixed retention period applies. Keep records until the next inspection, or longer if the EHO asks. Inspectors and courts treat pre-filled or back-filled records as falsification, so late entries must look late.

### Cited Findings
- SFBB diary: "The manager should sign the diary every day" to confirm that the opening and closing checks were done and the safe methods were followed. It should take "about one minute a day" — [FSA SFBB diary refill, Bromley Council copy](https://www.bromley.gov.uk/downloads/file/1315/sfbb-diary-refill-one-week-per-page)
- SFBB diary: if anything different happens or goes wrong, "make a note in the diary of what happened and what you did", so you can show you acted to keep food safe. Each day has a prompt: "Any problems or changes – what did you do?" — [same source](https://www.bromley.gov.uk/downloads/file/1315/sfbb-diary-refill-one-week-per-page)
- SFBB diary: if the manager is not in, they can give responsibility for the diary to another member of staff. The sign-off can be delegated, but someone named must own it — [same source](https://www.bromley.gov.uk/downloads/file/1315/sfbb-diary-refill-one-week-per-page)
- SFBB diary: there is an "Extra checks" section for checks done outside the routine. It is a precedent for logging an unscheduled check as its own entry — [same source](https://www.bromley.gov.uk/downloads/file/1315/sfbb-diary-refill-one-week-per-page)
- SFBB 4-weekly review: "Look back over the past 4 weeks' diary entries. If you had a serious problem, or the same thing went wrong three times or more, make a note of it here, find out why and do something about it." Yes/No questions follow, with a name and signature — [same source](https://www.bromley.gov.uk/downloads/file/1315/sfbb-diary-refill-one-week-per-page); [Torbay refill](https://www.torbay.gov.uk/media/19073/sfbb-diary-refill.pdf)
- SFBB retention: "store all your completed diary pages safely until your next visit from a local authority enforcement officer", and ask the officer how long they want them kept — [Bromley SFBB refill](https://www.bromley.gov.uk/downloads/file/1315/sfbb-diary-refill-one-week-per-page)
- FSA MyHACCP Principle 7: records should be "appropriate to the nature and size of the operation" and enough to verify that HACCP controls are in place. Examples include CCP monitoring, deviations and associated corrective actions, verification performed, and plan modifications. Retention depends on shelf life and possible misuse, with no fixed period. The guidance asks how document change and version control are managed, but gives no rules for correcting a record — [FSA MyHACCP](https://myhaccp.food.gov.uk/help/guidance/principle-7-establish-documentation-and-record-keeping)
- No UK legal fixed retention period was found. One commentary says it is left to each business to decide — [Croner (NI)](https://croner.co.uk/resources/managing-health-safety/hazard-analysis-and-critical-control-point-haccp)
- Food Standards Scotland CookSafe weekly record: the manager or proprietor checks "all your House Rules and Records" each working week and signs and dates the week. It has a column for deviations and the corrective action taken — [CookSafe record book, Aberdeenshire copy](https://www.aberdeenshire.gov.uk/media/yskfqls4/cooksaferecordbook.pdf)
- A Welsh council template uses a similar weekly pattern: a manager or senior member of staff verifies at the end of the week that the checks were done — [Gwynedd Cooks Log](https://www.gwynedd.llyw.cymru/en/Businesses/Documents-Busnes/Environmental-health-and-trading-standards/Environmental-health/Food-hygiene/Cooks-Log..pdf)
- Enforcement: a Salford takeaway was prosecuted after its hot-holding and freezer temperature records were found completed in advance — [Salford City Council news, June 2023](https://www.salford.gov.uk/your-council/news/news-archive/news-from-june-2023/takeaway-faked-hygiene-records/)
- Enforcement: an EHO visit found that staff at an Aberdeen hotel had been falsifying food safety records — [The Caterer](https://thecaterer.com/news/hotel/aberdeen-doubletree-accused-of-falsifying-food-safety-records)

### Inferences
- The SFBB "what went wrong / what did you do" pair maps directly onto a correction or exception screen: **What happened** plus **What we did** (corrective action), both required.
- The 4-weekly rule ("same thing went wrong three times or more") is a ready-made trigger for head office's exceptions view. It suggests flagging repeat failures per site and per check over a rolling 4 weeks.
- Because backdating is treated as falsification, the app should never let a user set the time a check was done. It should record the real entry time and show late entries clearly as late. A field that lets users choose the timestamp would be a liability.
- Daily sign-off belongs to one named person, who can be a delegate. Weekly or 4-weekly verification is a separate, later sign-off by a manager.

### Gaps
- I found no FSA or local authority guidance that specifically covers editing *digital* records after submission (for example, "an edit must show the original"). UK food law guidance is silent on this, so the data-integrity standard below is the best available benchmark.
- The FSA's Checkit digital-records feasibility study, in which a Cambridge City Council EHO compared digital records with reality, returned a 404 at `food.gov.uk/sites/default/files/media/document/checkitfeasibilitystudyreport.pdf`, so its findings are not included.
- The official FSA 4-weekly review PDF also returned a 404. I used council-hosted copies of the SFBB diary refill instead.

## 2. Good documentation practice: ALCOA+ and audit trails (MHRA)

### Takeaway
The MHRA's GXP Data Integrity Guidance (Rev 1, March 2018) is the clearest UK statement of what a correctable digital record should look like. It is written for medicines and labs, not food, but it is the accepted benchmark. In short: never overwrite, keep the original visible, record who, what, when and why, nobody can switch the audit trail off, and reviews are documented with a positive statement. Reviews may work by exception.

### Cited Findings
All findings in this section are from the [MHRA GXP Data Integrity Guidance and Definitions, Rev 1, March 2018](https://assets.publishing.service.gov.uk/government/uploads/system/uploads/attachment_data/file/687246/MHRA_GxP_data_integrity_guide_March_edited_Final.pdf).
- §6.1: data should be Attributable to the person generating it, Legible and permanent, Contemporaneous, Original (or certified true copy) and Accurate. The "+" adds Complete, Consistent, Enduring and Available.
- §3.10: there is "no difference in expectations" between ALCOA and ALCOA+.
- §6.13: an audit trail records creation, additions, deletions or alterations "without obscuring or overwriting the original record". It lets you reconstruct "the 'who, what, when and why' of the action".
- §6.13: systems should keep audit trails showing all changes "while retaining previous and original data". Changes are linked to a person and "dated and time stamped (time and time zone where applicable). The reason for any change, should also be recorded."
- §6.13: "Users should not be able to amend or switch off the audit trail". If an administrator does, that action is itself recorded.
- §6.13: audit trail review need not include every system activity (log-ins, keystrokes). Review can be "a list of relevant data, or by an 'exception reporting' process", meaning a search that flags predetermined abnormal data or actions for the reviewer.
- §6.15: data review "should include a positive statement regarding whether issues were found or not, the date that review was performed and the signature of the reviewer".
- §6.15: a procedure for errors found at review should "enable data corrections or clarifications to provide visibility of the original record, and traceability of the correction".
- §5.2: when one person records on behalf of another (a scribe), the record should "identify both the person performing the task and the person completing the record". The performer countersigns where possible, which may be retrospective.
- §6.14: electronic signatures must be attributable to one person, recorded so they cannot be altered without invalidating the signature, linked to the entry they sign, and usable only by their owner.
- Users should log in with unique credentials so that audit trail actions can be attributed (§6.16 area, page 16). Shared log-ins are "vulnerable to non-attributable data changes".

### Inferences
- **Correction model:** an edit creates a new version and never mutates the old one. The UI shows the current value with the old value struck through, the editor's name, the time and the reason. The reason is mandatory.
- **"Recorded by" vs "done by":** when a manager enters a check on behalf of a chef, store both people (from the scribe rule). The UI can read "Done by Ana · recorded by Ben, 21:40".
- **Sign-off needs a positive statement.** It should not be just a tick. Wording like "Reviewed, no issues" or "Reviewed, 2 issues noted" records whether problems were found. Editing a record after sign-off should visibly invalidate or flag the sign-off (from the e-signature rule).
- **Exceptions-first review is explicitly endorsed** by the regulator's own wording on "exception reporting". This justifies a head-office screen that shows only flagged items (late, missed, edited after submit, out-of-range, corrected after sign-off) rather than every entry.
- Logging individual, non-shared users is a precondition. Shared site tablets with one log-in undermine attributability, so a quick per-person PIN or identity step is worth designing for.

### Gaps
- I did not confirm whether MHRA has issued a newer revision than Rev 1 (2018). It appears to still be current. The PDF revision table lists only Rev 1.

## 3. How digital checklist products handle edits, late entries, missed checks and history

### Takeaway
The products surveyed share two patterns. Missed checks stay visible as "Missed", with a comment explaining why, rather than disappearing. History appears as a reverse-chronological "who changed what, when" log. Few vendors publicly document a mandatory *reason for change* on edits. Public help pages are thin for Jolt, Navitas, Kitchen Checks and Checkit.

### Cited Findings
- **SafetyCulture (now help.mitti.com):** "Inspection history records all the changes that users make to an inspection". It shows who made each change, what changed and when. The list runs newest first, back to the start of the inspection. Hovering a relative time shows the exact sync date and time. History can be exported as CSV, and a map shows where each answer was given. It is available on Premium and Enterprise plans. Retention is 12 months to 7 years. Annotation, Asset and Site responses are excluded — [SafetyCulture help 000066](https://help.mitti.com/en-US/000066/)
- **SafetyCulture:** the "Inspection started by" field shows the user who last edited the inspection. This is a confusing label, and an example of why "created by" and "last edited by" should be kept separate — [same source](https://help.mitti.com/en-US/000066/)
- **FoodDocs:** task statuses are Done (within the window), Not done, **Missed** ("the scheduled time slot expired before the task was completed"), Scheduled, **Unscheduled** (an entry added outside the scheduled slot) and Deviations — [FoodDocs: time slots](https://www.fooddocs.com/knowledge/timeslot)
- **FoodDocs:** completion time limits exist to stop staff filling in checks retrospectively or long after the required time. Users can add a comment to a missed task explaining why it was missed, for supervisors and auditors. Missed routines stay visible rather than being "silently overwritten". There is a Monitoring > Task history view, which includes unfilled tasks — [same source](https://www.fooddocs.com/knowledge/timeslot)
- **Trail:** timestamps are kept for the task, for each submitted checklist item and for each record-log row. A task shows "the last time that it was submitted", so reopening and resubmitting moves the time. Changing a record-log row updates that row's timestamp to now. Timestamps use device time, so offline work keeps the time it was done — [Trail: timestamps](https://answers.trailapp.com/en/articles/4622658-how-can-i-see-when-a-task-checklist-item-or-record-log-entry-was-done)
- **Trail:** some tasks can be "locked", meaning content editing is restricted. The suggested way to correct a comment is to delete it and repost — [Trail FAQ collection](https://answers.trailapp.com/en/collections/54905-faqs-troubleshooting)
- **Checkit:** listings say failed checks require the user to record the corrective action, dashboards show completion rates and late checks, and logs are "protected against manual editing". These are vendor or listing claims and not verified in documentation — [Techjockey Checkit listing](https://www.techjockey.com/detail/checkit); [G2 Checkit reviews](https://www.g2.com/products/checkit-checkit)
- **Jolt:** can send alerts when a task is missed or a reading is out of range, to prompt corrective action. Its marketing cites time-stamped completion logs as an inspection trail — [Jolt](https://get.jolt.com/?p=2250)

### Inferences
- Keep **status** and **correction** separate. A check has a time status (on time, late, missed, unscheduled or extra) and, independently, an edit state (original or edited). Missed should be a final state that can carry an explanation. A late completion should be a separate "late" entry, not a quiet fill-in of the missed slot.
- Trail's pattern of updating a row's timestamp to now on edit, which loses the original time, is the weak pattern to avoid. FoodDocs' "Unscheduled" and "Missed, with comment" is the stronger one.
- A required comment on a missed check works like SFBB's "what did you do?" and should be reused for edits ("reason for change") and failures ("corrective action").

### Gaps
- I found no public help documentation on post-submission editing for **Jolt, Navitas, Kitchen Checks or Checkit**. Nothing reliable surfaced, and Navitas and Kitchen Checks returned no relevant results. Whether they require a reason for change is unverified.
- I found no product that publicly documents strike-through of old values in its food-safety history UI. That pattern comes from paper good documentation practice (single line through, initial, date, reason) and from the MHRA "visibility of the original record" principle, not from a cited product.

## 4. UX patterns for version history, audit trails and day review

### Takeaway
Mainstream tools use three patterns. **Edited badges** on the item open its history (GitHub). **Version lists** can be filtered to named or significant versions, with highlighted diffs (Google Docs). **Activity feeds** run newest first, show the actor, action and relative time, and give the exact time on hover (SafetyCulture). For daily review, the regulator-endorsed model is exception reporting.

### Cited Findings
- **GitHub:** an edited comment shows an "edited" control at the top. Clicking it lists the revisions, and selecting one shows that change. Anyone with read access can view the history. Authors and writers can "Delete revision from history" for sensitive content. The editor and timestamp stay visible, but the content is removed — [GitHub Docs: Tracking changes in a comment](https://docs.github.com/en/communities/moderating-comments-and-conversations/tracking-changes-in-a-comment)
- **Google Docs:** version history (File > Version history, or the clock icon) is on by default. Versions can be named, and a toggle shows only named versions to hide small edits. "Show changes" highlights edits. Versions can be restored — [TechRepublic](https://www.techrepublic.com/article/version-history-essentials-for-google-docs-sheets-and-slides/); [Zapier](https://zapier.com/blog/google-docs-revision-history.md)
- **SafetyCulture:** history lists the most recent change first, uses relative times, and gives the exact time on hover — [SafetyCulture help](https://help.mitti.com/en-US/000066/)
- **MHRA:** audit-trail review may be done "by an 'exception reporting' process" that flags predetermined abnormal data or actions — [MHRA GXP DI guidance §6.13](https://assets.publishing.service.gov.uk/government/uploads/system/uploads/attachment_data/file/687246/MHRA_GxP_data_integrity_guide_March_edited_Final.pdf)
- **SFBB:** the 4-weekly review keys on serious problems or anything that went wrong three or more times — [SFBB refill](https://www.bromley.gov.uk/downloads/file/1315/sfbb-diary-refill-one-week-per-page)

### Inferences
Design suggestions for Maginhawa, derived from the above and not taken from any one source:
- **Row level (Monzo-style list):** show the current value, with a small "Edited" pill (GitHub pattern) and a "Late" or "Missed" pill where it applies. Tapping opens a history sheet.
- **History sheet:** a reverse-chronological timeline. Each entry shows the actor's avatar and name, the action, the old value struck through with the new value beside it, the reason in quotes, and a relative time with the exact time on tap. The original entry stays at the bottom as "Recorded". If the record was signed off, a "Signed off" marker sits in the timeline, and any edit after it is flagged "after sign-off".
- **Correction flow:** use an "Correct this entry" action, not inline editing. It opens a sheet with the new value and a required reason, offering quick-pick reasons (typo, wrong unit, re-checked, entered for someone else) plus free text, and a corrective action where the value was out of range. Save it as a new version and never overwrite.
- **Late entry flow:** a missed slot stays "Missed". "Add late entry" records the real time now and shows something like "Late · 2h 10m after window" with a required reason. No date or time picker for when the check was done.
- **Head-office day review (exceptions first):** the summary shows "38 of 41 on time · 2 late · 1 missed · 1 edited after submit · 1 out of range". Only the exceptions are listed, the rest collapse into "All other checks OK". It ends with a sign-off that requires a positive statement ("No issues" or "Issues noted: …"), records the reviewer's name and time, and is invalidated, with a flag, if anything changes afterwards.
- **Repeat-problem flag:** apply the SFBB "3 times in 4 weeks" rule per site and per check, to feed the 4-weekly review.
- **Filter like Google Docs:** the history defaults to meaningful events (recorded, corrected, signed off, reopened) and hides noise, matching MHRA's note that reviews need not include every system activity.

### Gaps
- I did not retrieve primary sources for **Notion page history** or the **Linear activity feed**, so they are not cited. Treat them only as familiar references.
- I found no UK hospitality-specific research on how EHOs actually navigate digital audit trails during an inspection.
