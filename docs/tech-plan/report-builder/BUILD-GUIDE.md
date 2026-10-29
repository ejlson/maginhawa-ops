# Report builder: build guide

How to take the EOD report builder from the tested prototype to the live app, step by step. Steps 1 to 4 are **built and tested** in this repo. Steps 5 to 8 are **still to do**: the code below is a starting point that has not been run.

All figures are examples (the verified test day in HANDOFF.md §5).

## What exists today

| Piece | File | Status |
|---|---|---|
| Formula engine and edits (add, rename, delete, connect, disconnect) | `packages/core/src/report-definition.ts` | Built, 70+ unit tests |
| Today's EOD as a definition (v1.3), identical to `computeDay` | same file, `EOD_DEFINITION` | Built, figure-by-figure parity tests |
| Versions, approval, rollback, EOD → engine inputs | `packages/core/src/report-versions.ts` | Built, 18 unit tests |
| Server endpoint (`/report-definition`) | `apps/functions/src/report-definition-handler.ts` | Built, 9 tests; not connected to SharePoint |
| Prototype builder (map, pop-up editor, layers, history, comments, colours) | `design/report-builder/src/` → `index.html` | Built, 81 interaction tests |
| Live EOD uses the approved version (app, server, email) | `packages/core/src/report-live.ts` and step 6 | Built, 30+ tests |
| SharePoint store, builder route in `apps/eod-web` | (steps 5 and 7) | **Not started** |

## Step 0: set up

```bash
npm install
```

Node 20 or newer. Everything below runs from the repo root.

## Step 1: run every test

```bash
npm run test:all
```

This runs `packages/core` (326), `apps/eod-web` (134), `apps/functions` (32) and the prototype (81). All should pass before you change anything.

## Step 2: understand the engine

A report is data, not code:

```ts
interface ReportDefinition {
  version: string;
  figures: Figure[];   // inputs, settings, calculations, yes/no checks
  actions: Action[];   // what happens after submit (email, save, alerts)
}
```

- **Ids never change; names can.** Formulas use names (`[Lunch gross] − [Lunch VAT]`) so finance can read them. `renameFigure` rewrites every formula and action, and saved reports and test days use ids, so nothing breaks.
- **No `eval`.** `tokenize` → `parseFormula` → a small tree. Only `+ − × ÷`, brackets, comparisons and `round`, `min`, `max`, `abs`, `if` run. `if()` only works out the branch it takes.
- **Money is pence.** Money results are rounded to the penny; percentages are fractions (0.2 = 20%).
- **Edits are pure.** Each returns a new definition and throws `EditError` with a message written for finance.

```ts
import { EOD_DEFINITION, addFigure, connect, evaluateDefinition, testDayInputs, VERIFIED_TEST_DAY } from '@maginhawa/core';

let d = addFigure(EOD_DEFINITION, { id: 'pay.card', name: 'Card takings', kind: 'input', type: 'money', group: 'payments' });
d = addFigure(d, { id: 'cardFees', name: 'Card fees', kind: 'calc', type: 'money', formula: '[Card takings] × 1.75%' });
d = connect(d, 'Card fees', 'email');                 // adds it to the summary email
const ev = evaluateDefinition(d, { ...testDayInputs(d, VERIFIED_TEST_DAY), 'Card takings': 290000 });
ev.values['Card fees'];                                 // 5075 (£50.75)
```

To add a formula function, add it to `FUNCTIONS` and `run()` in `report-definition.ts`, then add a test in `packages/core/test/report-definition.test.ts`.

## Step 3: versions and approval

`report-versions.ts` follows the checklist builder's rules (`builder.ts`):

```
saveDefinitionDraft → submitDefinition (needs a summary, no broken formulas, all tests passing)
  → approveDefinition (a different person; live from the next trading day)
  or rejectDefinition (with a reason; back to draft) / withdrawDefinition (by the drafter)
rollbackDefinition (a new version copying an old one, from the next trading day)
definitionOn(record, date)  → the version for a trading day
officialFigures(record, eodDraft, settings, extra, target) → the official figures, by id
```

## Step 4: the server endpoint

`apps/functions/netlify/functions/report-definition.ts` answers 503 until SharePoint is connected. The handler takes its services as arguments, so it's tested with `MemoryDefinitionStore`.

| Request | Does |
|---|---|
| `GET` | Record, ETag, today's trading day, status, live version |
| `PUT { definition, testDays }` + `If-Match` | Save the draft |
| `POST { action: 'submit', summary }` | Send for approval |
| `POST { action: 'approve' }` | Approve (not the drafter) |
| `POST { action: 'reject', reason }` / `'withdraw'` / `'discard'` | |
| `POST { action: 'rollback', to, reason }` | Roll back |

Head office only (403 otherwise). A stale ETag gets 409 with the current record, so two people can't overwrite each other.

## Step 5 (to do): the SharePoint list and store

Add this list to `docs/tech-plan/sharepoint/sharepoint-lists.json` and provision it with the other lists:

```json
{
  "name": "ReportDefinitions",
  "description": "The report builder's versions, draft and approval state. One item per report.",
  "columns": [
    { "name": "Title", "type": "text", "note": "Report key, e.g. eod. Unique, indexed." },
    { "name": "Record", "type": "note", "note": "The DefinitionRecord as JSON (plain text, unlimited length)" },
    { "name": "LiveVersion", "type": "number" },
    { "name": "Status", "type": "choice", "choices": ["live", "draft", "waiting", "starts-tomorrow"] }
  ]
}
```

Also add a `DefinitionVersion` number column to the EOD reports list.

The store, using the Graph helper the other functions will share (untested sketch):

```ts
// apps/functions/src/sharepoint-definition-store.ts
import { ConflictError, type DefinitionStore } from './report-definition-handler';

export function sharePointDefinitionStore(graph: Graph, siteId: string, listId: string): DefinitionStore {
  const items = `/sites/${siteId}/lists/${listId}/items`;
  return {
    async get(key) {
      const res = await graph.get(`${items}?$filter=fields/Title eq '${key}'&$expand=fields`);
      const item = res.value[0];
      return item ? { record: JSON.parse(item.fields.Record), etag: item['@odata.etag'] } : null;
    },
    async save(record, ifMatch) {
      const res = await graph.patchItemFields(items, record.key, { Record: JSON.stringify(record) }, { 'If-Match': ifMatch ?? '*' });
      if (res.status === 412) throw new ConflictError('ETag mismatch');
      return res.etag;
    },
  };
}
```

Then fill in the connection point in `netlify/functions/report-definition.ts` (Entra ID sign-in, head-office group → `role: 'headoffice'`), as the other functions will.

## Step 6 (done): the live EOD uses the approved version

Built and tested. A manager's EOD is worked out with the version approved for its own trading day; with no approved version it is exactly today's `computeDay`.

| Piece | File |
|---|---|
| `computeDayWith`, `definitionIssues`, `addedInputs` | `packages/core/src/report-live.ts` |
| Inputs finance add, saved per report by figure id | `EodDraft.extra` in `packages/core/src/schema.ts` |
| Values for settings finance add, per site | `SiteSettings.definitionSettings` in `packages/core/src/settings.ts` |
| Submit uses it (server and demo) | `submitReport(…, { definitions })`, `SubmitDeps.definitions` in `apps/functions/src/handler.ts` |
| Managers read the live version (never drafts) | `GET /report-definition?date=YYYY-MM-DD` |
| The app: totals, added inputs in their section, figures on review | `apps/eod-web/app/lib/definition.ts`, `app/sections/AddedInputs.tsx` |

Tests: `packages/core/test/report-live.test.ts` (every field matches `computeDay` across 12 kinds of day), `apps/functions/test/submit-eod.test.ts`, `apps/eod-web/test/live-definition.test.tsx`.

**Still needed when SharePoint is connected:** fill the `definitions` connection point in `netlify/functions/submit-eod.ts`, store `extra` as a JSON column on the EOD reports list, and add a `DefinitionSettings` JSON column to the Sites list for settings finance add (e.g. a card fee rate).

## Step 7 (to do): the builder in `apps/eod-web`

1. Install the canvas library: `npm install @xyflow/react -w apps/eod-web`
2. Add the route in `apps/eod-web/app/routes.ts`, inside the signed-in layout:
   ```ts
   route('head-office/report-builder', 'routes/report-builder.tsx'),
   ```
3. Port the prototype screen by screen. Keep the same pieces:
   - `useReducer` holding the definition, with every change going through the engine (as `edit()` does in `design/report-builder/src/app.js`), each step kept for undo.
   - React Flow for the map: one custom node per card type, with handles for the connector dots, and `onConnect` → `connect()`.
   - The pop-up editor as a `<dialog>`; the layers panel and review panel as they are in the prototype.
4. Port the prototype's tests to `apps/eod-web/test/report-builder.test.tsx` using the existing `harness.tsx`.
5. Show the builder only to head office (finance) in `HeadOfficeShell.tsx`.
6. Make the EOD form draw any extra inputs from the live definition, so new inputs reach managers' phones once approved.

## Step 8 (to do): before going live

- [ ] Import the Excel history and check last month's reports against `officialFigures` (should match `computeDay` to the penny).
- [ ] Agree who in finance drafts and who approves.
- [ ] Decide whether changes apply to all 9 sites or per site (today: all sites, with site settings per site).
- [ ] Turn on the endpoint by setting the Netlify environment variables (`ENTRA_*`, `SHAREPOINT_SITE_ID`).

## Working on the prototype

```bash
npm run build:report-builder      # writes design/report-builder/index.html from src/ + the core engine
npm run test:report-builder       # builds, then clicks through it in jsdom
```

Edit `design/report-builder/src/page.html` (markup and styles) and `src/app.js` (behaviour), never `index.html`. To view it locally, start the `report-builder` preview server in `.claude/launch.json`.
