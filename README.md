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

### Try syncing on two devices (shared test mode)

Demo mode keeps everything in each browser, so a laptop and a phone never see each other. Shared test mode keeps the data on the laptop instead, so you can try real multi-device sync before Entra ID and SharePoint are connected.

```bash
npm run dev:shared
```

1. The terminal shows a **Network** address, e.g. `http://192.168.1.149:5180`. Your laptop and phone must be on the same Wi-Fi.
2. On the laptop, open that address (or http://localhost:5180) and sign in as, say, **Jo · Bunso · Manager**.
3. On the phone, open the same Network address and sign in as **Sam · Bunso · Supervisor**. Same site, different name.
4. Edit different parts of today's EOD (Jo: Wages, Sam: Dinner) or answer different checks on the same checklist. Each device shows the other's changes within about 10 seconds, with who is on which screen.

How it works: the dev server also runs the real functions in `apps/functions` (`eod-draft`, `submit-eod`, `checklist-sync`, `presence`), with in-memory stores in place of SharePoint. The demo sign-in is sent in a header the test server trusts. So:

- Data is lost when you stop the server, and "Send" writes the email to the terminal instead of sending it.
- It only runs under `vite dev` with `DEV_SHARED_STORE=1`, which `npm run dev:shared` sets. The functions refuse it if `NODE_ENV` or `CONTEXT` is `production`, or if they are running as a deployed function, and a production build leaves it out of the app altogether.
- Head office's overview and the timeline's EOD card still read this device only, so test sync from site screens.
- If the phone can't connect, allow incoming connections for Node in the Mac's firewall.

## Test it

```bash
npm test
```

| Suite | What it covers |
|---|---|
| `packages/core` (92 tests) | Checklist rules (pass/fail per answer type, due/late/missed, can't finish with an unfixed failure) and every rule in HANDOFF.md §5, the verified example (lunch £850.00, day £2,687.50, wages 29.8%), cash tolerance, trading day across BST/GMT, blocks vs warnings, duplicate protection, SharePoint mapping, email |
| `apps/eod-web` (26 tests) | The real screens: checklists through the day, fixing a failed check, a manager's own list, typing figures, food/drink check, cash reasons, discount lines, cash count, skipping services, wages colours, delivery, notes, review blocking, submit, head office approval |
| `apps/functions` (9 tests) | Sign-in, own-site only, bad input, blocked reports, email failure, retries, and the "not connected yet" answer |
| `apps/functions/test/dev-shared.test.ts` | Shared test mode: refused in production, the header sign-in, and a laptop and phone merging EOD sections and checklist answers through the function files |

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
