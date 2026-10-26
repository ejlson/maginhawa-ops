# Maginhawa Ops

The managers' app for Maginhawa's 9 sites: daily checklists (any time of day) and the end-of-day (EOD) report. Background, decisions and rules are in [HANDOFF.md](HANDOFF.md); designs are in [design/eod-canvas](design/eod-canvas).

## What's here

| Folder | What it is |
|---|---|
| `packages/core` | All EOD maths and checks (money in whole pence), data shapes, the data-access interface, the summary email. Used by both the app and the server |
| `apps/eod-web` | The app: React Router v7 (SPA mode) on Vite. Sign-in, home, checklists (do, fix a failure, re-check), today's close, every section, cash count, review, submitted, head office |
| `apps/functions` | Netlify Function `submit-eod`: re-checks the report, stores the official figures, emails finance |

## Run it

```bash
npm install
npm run dev
```

Opens on http://localhost:5173. It runs in **demo mode**: you pick a name and site, and reports are saved on the device (browser storage).

## Test it

```bash
npm test
```

| Suite | What it covers |
|---|---|
| `packages/core` (92 tests) | Checklist rules (pass/fail per answer type, due/late/missed, can't finish with an unfixed failure) and every rule in HANDOFF.md §5, the verified example (lunch £850.00, day £2,687.50, wages 29.8%), cash tolerance, trading day across BST/GMT, blocks vs warnings, duplicate protection, SharePoint mapping, email |
| `apps/eod-web` (26 tests) | The real screens: checklists through the day, fixing a failed check, a manager's own list, typing figures, food/drink check, cash reasons, discount lines, cash count, skipping services, wages colours, delivery, notes, review blocking, submit, head office approval |
| `apps/functions` (9 tests) | Sign-in, own-site only, bad input, blocked reports, email failure, retries, and the "not connected yet" answer |

`npm run typecheck` checks types across all packages; `npm run build` builds the app into `apps/eod-web/build/client`.

## Connecting it later

Nothing needs rewriting. Fill in the settings and plug in three pieces:

1. **Entra ID (sign-in):** add `VITE_ENTRA_CLIENT_ID` and `VITE_ENTRA_TENANT_ID` to `apps/eod-web/.env` (see `.env.example`). Replace the demo sign-in screen with Microsoft sign-in behind the same `useAuth()` hook (`apps/eod-web/app/lib/auth.tsx`).
2. **SharePoint (data):** implement the `EodStore` interface (`packages/core/src/store.ts`) with Microsoft Graph. `toSharePointFields()` already maps a report to the list columns.
3. **Email:** send `eodSummaryEmail()` through Graph `sendMail` from the shared mailbox.

Then fill in `apps/functions/.env.example` on Netlify. Until then the function answers 503 with a clear message, and the app keeps working on the device.

## Deploy

`apps/eod-web/netlify.toml` builds the app, serves it as a single-page app and deploys the function.

## Not built yet

- Microsoft sign-in, the SharePoint store and sending email (waiting on the connections above)
- Install-to-home-screen and full offline caching (PWA)
- Shared iPad PIN sign-in, Trends and forecasts, head office settings
- Checklists: building and editing lists in the app (examples are built in for now), shared kitchen iPad mode, repairs and the head office checks views
