# Several people on one report or checklist

Staff, supervisors and managers at one site can work on the same end-of-day (EOD) report or the same checklist at the same time, from the kitchen iPad and their phones. Each person sees the others' changes within about 10 seconds. Edits are never lost, and a report is never submitted twice.

The rules live in `packages/core` and are unit-tested. The app and the functions are thin adapters.

## EOD report

| Rule | Where |
|---|---|
| Every stored report has a `version`, which is the SharePoint item ETag. A save sends the version it started from, and the store refuses a stale save (`SyncError 'conflict'`) and returns the newer report | `core/src/store.ts`, `sync.ts` |
| The 8 sections (lunch, dinner, delivery, promotions, wages, tips, feedback, handover) are independent. A stale save is merged section by section: their sections are kept, ours are applied, and only a section **both** people changed differently is a clash | `mergeDrafts` |
| The store stamps every changed section with who changed it and when, so the screen can say "Jo changed Dinner at 21:14" | `stampSections` |
| A clash keeps both versions: ours stays on screen and theirs stays stored. Saving pauses until the person taps **Keep mine** or **Use Jo's** | `EodSyncClient.resolve` |
| The confirmation tick only stands for the figures the person saw. It clears if someone else changes a section after it was ticked | `mergeDrafts` |
| Submit is one conditional write: the status must be draft or sent-back, and the version must match. Exactly one submit wins. Each press of Submit has a `submitId`, so a retry after lost signal is a no-op. The loser sees "Already sent by Jo at 23:48" with a link to the sent report. The server always recalculates the official figures | `submitReport`, `MemoryStore.submit` |
| Submitting figures you haven't seen is refused: "Jo changed Dinner at 21:14. Check it, then submit again." | `submitReport` (`conflict`) |

## Checklists

| Rule | Where |
|---|---|
| One record per answer (run + checkpoint, with who answered it and when), so two people answering different items never clash | `core/src/checklist-sync.ts` |
| The same item is last-write-wins by when it was answered, so a late upload from a phone that was offline can't overwrite a newer answer. The screen shows "Sam · 21:14" under answers given by someone else | `MemoryChecklistStore`, `checklist-run.tsx` |
| Finishing is a conditional update. A second Finish is a no-op that says "Finished by Jo at 21:02" | `applyOne('finish')` |
| Answers go in batches: one call per batch, never one per answer (scalability rule 1). In SharePoint each change appends a Responses row (append-only, `Supersedes`), and the current answer is the latest per `AnswerKey` | `ChecklistSyncClient`, `checklist-sync` function |

## Live updates and offline

- **Polling now, push later.** While an EOD or checklist screen is open it refreshes every 10 seconds, or every 30 seconds once nobody has touched it for 2 minutes. It also refreshes when the window gets focus and when the device comes back online. Refreshes are cheap: the EOD uses `If-None-Match`, which returns 304 when nothing changed, and checklists ask for changes since a cursor. Each site's current version is kept in Netlify Blobs (`functions/src/version-index.ts`), so a poll that finds nothing new is answered without calling Graph. Our own writes update it at once. An entry is trusted for 60 seconds, so changes made directly in SharePoint still show within about a minute. Everything goes through `LiveTransport` (`core/src/live.ts`), so a push service such as Azure Web PubSub can replace polling in `app/lib/sync.ts` without changing any screen.
- **Never overwrites typing.** Incoming changes are merged the same way as a stale save, so a section with unsent edits keeps them. Money and temperature fields keep what is being typed until the person leaves the field.
- **Presence.** Each refresh also says "I'm here" and returns who else is in the report: "Jo is in Dinner". This lasts 30 seconds. In production it belongs in Netlify Blobs, not SharePoint.
- **Offline.** Edits wait on the device (`mgh.sync.*` in local storage). When the device is back online they are replayed with the version check, so they merge rather than overwrite.

## Endpoints (Netlify Functions)

| Function | Does |
|---|---|
| `eod-draft` | `GET` with `If-None-Match` returns 200 or 304. `PUT { draft, baseVersion }` returns 200, or 409 `{ code, current }` |
| `submit-eod` | Also accepts `{ draft, baseVersion, submitId }`. Returns 409 `{ code: 'already-submitted' \| 'conflict', current }` |
| `checklist-sync` | `POST { siteCode, ops }` (a batch). `GET ?since=` returns changes since a cursor |
| `presence` | `POST { scope, deviceId, where }` returns who else is here |

Who did what always comes from the signed-in caller, never from the request body. Until Entra ID and SharePoint are connected, every function answers 503 and the app keeps working on the device.

## Trying it in demo mode

Demo mode keeps the "server" on the device, and every call re-reads shared storage. **Open the app in two tabs** and sign in as two different people: each tab acts as a separate device. In tests, `otherDevice('Sam')` (`apps/eod-web/test/harness.tsx`) is a second device that shares the same store, and `poke()` stands in for a poll tick.

## SharePoint columns added

- **TradingDays:** `DraftJson`, `SectionStamps`, `SubmitId`. The version is the item's own ETag, so no column is needed for it.
- **Responses:** `AnswerKey` (indexed).
