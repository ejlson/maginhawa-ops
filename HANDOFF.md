# Maginhawa Ops: project handoff

*Last updated 27 October 2026 (desktop redesign built, §6; food-safety module built and merged, §8a; Check65 review findings, §8; EHO brief, §10 and §13; on 26 Oct the back end changed from Power Automate to our own Netlify Functions, §3 and §4). This file is the single source of truth for picking the project up in a new Claude account or by a new person. Read it top to bottom before doing anything.*

---

## 1. What this project is

An internal operations app for **Maginhawa**, a London restaurant group with **9 sites**. The first module replaces the finance team's current **end-of-day (EOD) report**, a web form that managers fill in after close. Later modules add opening and closing checklists, food-safety logs, repairs and maintenance, a staff handbook, and AI search over all the logs ("Ask your logs").

It started as a "Check65-like" product idea (Food Alert's Check65 app; the comparison is in `docs/reports/`). It narrowed to: **build our own apps, with SharePoint (in the group's existing Microsoft 365) as the data store, starting with EOD.** All business logic is our own code; no Power Automate or other Microsoft apps are used day to day.

**Sites (9):** Bintang, Guanabana, Belly, Ramo, Hoodwood, Bunso, Cafe Mamasons, Mamasons Kentish Town, Mamasons China Town.

**Roles:**

| Role | Sees | Can do |
|---|---|---|
| Staff | Their site | Checklists |
| Supervisor | Their site | Checklists and the EOD |
| Manager (incl. assistant managers) | Their site | Checklists and the EOD; edit their site's checklists |
| Head office (finance, admin, operations managers) | All sites | Thresholds, targets, people; edit checklists; receives the reports |

Permissions live in one place: `can` in `apps/eod-web/app/lib/auth.tsx`.

---

## 2. Where things stand today (the "as is")

The finance team's current EOD form is a **single static page on Netlify**. It posts JSON to a **Power Automate HTTP trigger**, which writes a row to **Excel / SharePoint** and sends emails. Daily targets are read from an Excel sheet by date.

**Problems found in the live form** (code read on 6–10 Oct 2026; nothing was submitted):

**Security (urgent):**
- The Power Automate trigger URL, including its signature, is visible in the page source. **It must be regenerated.**
- **Never copy that URL into any document, code or chat.**

**Calculation bugs:**
- "Net" is calculated as gross − service charge − tax, so **discounts are not subtracted**, even though the label says they are.
- The food and drink % are worked out from **net** but labelled **gross**.
- Delivery net is hard-coded as `gross / 1.2 × 0.55`.
- The wage thresholds (35% / 30%) are hard-coded.

**Data handling:**
- The lunch managers field is dropped and never saved.
- The top-level staff field mixes lunch kitchen/FOH staff with dinner managers.
- Discount and void lines are flattened into one text string.
- The cash warning only shows when *both* cash values are above 0.

**Missing safeguards:** no validation, no duplicate protection, no draft saving, and dates are stored as Excel serial numbers.

**Reference lists in the form:**
- **23 discount/comp reasons** (e.g. "Customer complaint · check", "Employee dining 20%").
- **15 void codes**, split into waste (W) and no-waste (NW).
- **Staff position lists** for kitchen, front of house (FOH) and managers.

---

## 3. Decisions already made (do not re-open without the user)

| # | Decision | Notes |
|---|---|---|
| 1 | **UK market**, UK English, £, UK law | |
| 2 | **Devices: phone, tablet (iPad) and desktop** | Shared kitchen iPad plus managers' own phones and laptops |
| 3 | **SharePoint is the data store; our own Netlify Functions are the back end** (changed 26 Oct 2026, replacing Power Automate) | No Power Automate, Power Apps, Outlook or Teams connectors. Microsoft is used only for SharePoint (data), Graph (access) and Entra ID (sign-in). Logic lives in our repo, so calculations are written once in `packages/core`. No database of our own; the Postgres/Supabase design stays as the fallback (`docs/tech-plan/postgres-option/`) |
| 4 | **We code our own user-facing apps** | Not Power Apps |
| 5 | **Managers type the numbers in** | No till/EPOS integration in v1. The forecast works from the typed figures |
| 6 | **Web framework: React Router v7 in SPA mode (Vite, TypeScript)**, hosted on Netlify, installable as a PWA | Next.js was rejected: the app is a client-side SPA, and the only server code is a few small Netlify Functions. **Expo** (React Native) is only for a later native app, if one is needed |
| 7 | **Design direction:** Apple-like. **One dark "hero" card per screen**, then **Monzo/Revolut-style lists**, with **Things 3-style progress circles** | See §7. The user rejected other directions; don't drift back to them |
| 8 | **Sections can be filled in any order** from a hub ("Today's close"), not a strict wizard | Backed by research: same users every night |
| 9 | **Sign-in:** Microsoft 365 work account (Entra ID via MSAL) on phone and desktop; **shared iPad = photo grid of today's rota + 4-digit PIN**, plus a badge/QR alternative | A site device account sits underneath the shared-iPad login |
| 10 | **Forecasts:** same weekday over the last 6 weeks, nudged by bookings and the recent trend | Shown to managers (Trends) and to head office (Forecast tab). No AI needed |

---

## 4. Technology

| Layer | Choice |
|---|---|
| App | React + TypeScript, **React Router v7 (SPA mode, `ssr: false`)** on Vite. One codebase for phone, iPad and desktop |
| Libraries | react-hook-form + zod (forms and validation), TanStack Query (data), `@azure/msal-react` (sign-in), `vite-plugin-pwa` (offline and install), Vitest (tests) |
| Offline | Dexie (IndexedDB) on the device: drafts first, then an upload queue. Each record carries a `ClientId` UUID in a unique column, so a retry never creates a duplicate |
| Hosting | Netlify: the static app (catch-all redirect to `index.html`) plus our functions. Deploys from GitHub |
| Back end | **Netlify Functions** (TypeScript) replace Power Automate. `submit-eod` runs on submit: re-checks with `packages/core`, writes the official totals (*set by server* columns) and sends the summary email. **Netlify Scheduled Functions** run the 07:00 digest, late-report reminders and the nightly targets import |
| Server sign-in | `@azure/msal-node`, app-only (client credentials). Secret or certificate kept in Netlify environment variables, never in the repo |
| Identity | Microsoft Entra ID. Users sign in with MSAL (delegated access to the one site). The server uses app-only **`Sites.Selected`** granted on the "Maginhawa Ops" site, plus **`Mail.Send`** restricted to one shared mailbox (e.g. `ops@…`) |
| Data | **SharePoint site "Maginhawa Ops"**: 49 lists (16 of them food safety, §8a) and 7 document libraries, accessed only through the **Microsoft Graph API**. Use `$batch` (up to 20 requests per call) and honour `Retry-After` |
| Email | Graph `sendMail` from a shared mailbox (no licence needed). Resend is the fallback |
| Reporting | Head-office views and CSV export in our app; finance can also use Excel Power Query on the SharePoint lists. Power BI later, if wanted |
| Quality | Vitest (unit), Playwright (end-to-end), ESLint + Prettier, pnpm workspaces. Sentry optional for error alerts |
| Later | A Netlify Function "AI proxy" calling the Claude API (default model `claude-opus-5-5`) for Ask your logs and the summaries |

**Running cost:** about £0–£20 a month (SharePoint, Graph and Entra ID are included in M365; Netlify free plan to start, Pro about $20/month if needed). Check current Netlify pricing before committing.

**Monorepo layout (proposed):**

```
apps/eod-web     React Router v7 SPA → Netlify   (start here)
apps/functions   Netlify Functions: submit-eod, digest, reminders, import-targets
apps/kiosk       Expo (later, only if needed)
packages/core    calculations, zod schemas, Graph data module (shared, unit-tested)
```

**Scalability rules** (full version in the tech plan):
1. No server call per checkpoint answer; process a completed checklist or batch on a schedule.
2. Index `Site`, `BusinessDate` and `Status`.
3. Archive yearly.
4. Batch and cache Graph calls.
5. Compress photos.
6. Server secrets only in Netlify environment variables; least-privilege app permissions.
7. Honour `Retry-After`.
8. Reporting from scheduled exports, never live per-view queries over large lists.
9. All data access in one module.

**Limits to remember:**
- 5,000-item list view threshold.
- 20 indexes per list.
- 12 lookups per query.
- About 30M items per list.
- Graph throttling per app and per tenant (back off on HTTP 429).
- Netlify Functions: about 10 seconds per synchronous call (keep `submit-eod` short; use background functions for slow work).

**Volume estimate:** about 1,250 items a day across 9 sites, about 460k a year, and about 9 GB of photos a year.

---

## 5. EOD calculation rules (the `core` package)

These fix the current bugs. Every rule should have a unit test.

| Figure | Rule |
|---|---|
| Net sales (per service) | **Gross − service charge − VAT − discounts & comps** |
| Food % / Drink % | Food (or drink) sales ÷ **net** sales. Warn when food + drink ≠ net; the manager can confirm "It's right" |
| Covers | Booked + walk-ins |
| Net a head | Net ÷ covers (dine-in only) |
| Cash taken | Counted in drawer (by denomination) − float (**£150 default**, per site) |
| Cash difference | Cash taken − cash on till report. **Within ±£1 = balanced.** Outside that needs a **reason picked from a list** (refund paid in cash, paid out/petty cash, float not reset, miscount, other) plus an optional note |
| Delivery net | Gross × platform retention, a **setting per platform** (not hard-coded) |
| Day total net | Lunch net + dinner net + delivery net |
| Wage % | Wage cost ÷ day total net. **Green < 30%, amber 30–35%, red > 35%** (admin settings, per site) |
| Trading day | A report opened before **04:00** counts as the previous day |
| Discount lines | Lines must add up to the till's discounts & comps total; a gap gets a warning |

**Verified example** (tested on real Postgres during planning):

| Figure | Value |
|---|---|
| Lunch | gross £1,200, service charge £120, VAT £180, discounts £50 → **net £850.00** (40 covers) |
| Dinner | gross £2,400 → **net £1,700.00** (65 covers) |
| Deliveroo | gross £300 → **net £137.50** |
| Day total net | **£2,687.50** |
| Wages | £800 → **29.8%** |

**Validation philosophy:**
- **Hard block only for real errors:** an unexplained cash difference, or a required section left empty.
- **Everything unusual is a warning** with "It's right" or "Fix".
- Submit stays disabled until required sections are done and the confirmation is ticked.

### Forecasting v1 (built, `packages/core`)
Method chosen in `reports/Restaurant sales forecasting algorithms.md`. Per site, service (lunch, dinner, delivery) and metric (net, covers), 1–14 days ahead.

| Step | File | What it does |
|---|---|---|
| Clean | `data-quality.ts` `cleanSeries` | Fills calendar gaps; flags missing, closed, zero, negative, duplicate and unusual days (robust z-score against the same weekday ±8 weeks; a change that lasts isn't flagged). Raw figures are kept; flagged days are only left out of learning |
| Statistics | `profileSeries`, `qualityNotes` | Counts, gaps, weekday medians and spread, weekly swing, 4-week trend, readiness (not enough < 21 usable days, low < 42, ok < 365, good), plain-English notes for head office |
| Forecast | `forecast.ts` `forecastV1` | Median of last 6 same weekdays × capped trend nudge (half the trend, max ±10%); bank holidays from past bank holidays, else like a Sunday; little history → site level × group weekday pattern (low confidence); covers → bookings + usual pickup |
| Likely range | `likelyRange`, `updateAlpha` | 80% range from v1's own logged misses at each horizon; adaptive conformal update keeps coverage near 80% |
| Check | `backtest`, `accuracy` | Walk-forward, no leakage; MASE, WAPE, bias, coverage, width, pinball. Compared with same weekday last week and Holt-Winters (hidden challenger) |

**Nightly jobs** (`apps/functions`): `nightly-snapshot` (05:15 UTC) saves covers on the books for the next 14 days; `nightly-forecast` (05:30 UTC) logs v1 and both comparison methods. SharePoint lists: **BookingSnapshots**, **ForecastLog**. The snapshot must start before forecasting is shown, because past bookings can't be fetched again.

**Before trusting it on real data:** import the Excel history, run `cleanSeries` + `profileSeries` per site and service, review the flagged days with finance, then run `backtest` and record the figures.

---

## 6. Screens (designed, on the canvas)

The interactive design canvas is a claude.ai artifact: **https://claude.ai/artifact/A7wNFaUeBKBo2eDJjtXiRa** ("EOD UI design").

> These artifact links are **private to the account that made them**. To use them from a new account, open each link in the original account and use **Share** first. A local copy of every screen is in `design/eod-canvas/`.

An earlier low-fidelity version is at https://claude.ai/artifact/KxTcCMxEYiNPcvhfrXUcDk ("EOD input wireframes", superseded).

| Board | What it shows |
|---|---|
| Design language | Principles, colours, card and list samples |
| 0 · Sign in | Phone/desktop: one card, "Sign in with work account" (Microsoft 365), link to the PIN option |
| 1 · Today's close (hub) | Hero card with net so far vs the tonight forecast and section progress. A "Tomorrow" forecast card. Sections with Things-style circles (to do / in progress / done / skipped): Lunch, Dinner, Delivery, Promotions & other, Wages, **Tips & service charge**, Feedback, Handover. "What ran today" toggles; reporting identity |
| 2 · Lunch | Hero = lunch net (live), vs forecast. From the till (inputs), covers, food & drink with a match check, cash (drawer count → float → till → difference + reason chips), discounts/comps as Monzo-style rows, on shift |
| Sheet · Count the cash | One row per note/coin: badge, typed count (phone number pad), value. Live total and "less float" |
| 8 · Review | Hero = day net vs target plus 4 metrics. "Check before sending" (red blocks, amber warns). Breakdown rows (tap to edit). Confirm tick. Button reads **"Submit Monday · £2,687.50"** |
| Submitted | "Day closed", **"Received by head office 00:31"** (not just "sent"), "On time 26 of 28 this month", what happens next |
| Trends (manager) | Graph: last 2 weeks actual + 7-day dashed forecast with a likely-range band; switch Net / Covers / Wage %. Tomorrow card, rota wage warning, week-ahead list |
| iPad · Dinner, night mode | Sidebar with circles + two-column form |
| iPad · PIN sign-in | Photo grid of today's rota → 4-digit PIN → "Not you?"; "Scan your badge instead" |
| Desktop · Manager | Sidebar, hero, two-column form, right rail (day so far, still to do, ⌘↵ save) |
| Desktop · Admin, all sites today | Hero = group net (7 of 9 in), bars = 7 days actual + 7 forecast. Sites table (net, vs target, wages, cash, status). "Approve 4 clean closes" (with Undo). Needs attention with actions. Site detail panel |
| Desktop · Admin settings | Thresholds & checks: wage colours (live bar), cash tolerance, float, warn-only sales checks, trading-day end, late reminders. Menu: sites, people & roles, targets, discount reasons (23), void codes (15), delivery platforms, sections & questions |
| Desktop · Admin forecast | Group forecast next 7 days with graph (Net / Covers / Wage %), per-site sparkline + forecast + vs last week + watch note, "Watch this week", how it's worked out |

All figures in the designs are **made-up examples**.

**Desktop, as built (27 Oct 2026, [ejlson/maginhawa-ops#4](https://github.com/ejlson/maginhawa-ops/pull/4) and [#5](https://github.com/ejlson/maginhawa-ops/pull/5)):** every site screen uses one 1120px frame, with the content on the left and the dark card at the top right. A `Columns` component lays out Home and Today's EOD. The sidebar has live counts (red for late or urgent, orange for things that need a look) and a **⌘K / Ctrl+K** menu to search and jump from any site screen. Checklists show the list on the left and the open checklist on the right (J/K to move; ⌘↵ finishes and opens the next list). On touch screens, a thermometer button opens a big temperature entry with −/+, quick values, a live pass/fail and *Save and next*. Screens show loading skeletons. Managers can add their own checks to group lists. Phones are unchanged. **Still to do:** try the big temperature entry on a real iPad.

---

## 7. Design language (follow exactly)

**What the user liked:**
- Apple-like, minimal, sleek and premium.
- **One main dark card per screen**; everything else is **plain lists** like Monzo/Revolut (round icon, title, grey subtitle, amount on the right, hairline dividers).
- **Things 3 progress circles.**
- Intuitive and simple to follow.
- A thin custom scrollbar.

**What the user rejected:**
- An all-boxed iOS Settings look (grey background, every group in a white card).
- An "editorial, no boxes at all" version with bold rules.
- Tile grid plus custom keypad for the cash count.

| Token | Light | Dark |
|---|---|---|
| Background | `#FFFFFF` | `#121214` (dark grey, never pure black) |
| Panels | `#F7F7F9` | `#1B1B1F` |
| Text | `#1D1D1F` | `#F2F2F4` |
| Secondary text | `#6E6E73` | `#A3A3AB` |
| Fill (icons, inputs) | `#F2F2F5` | `#2A2A2F` |
| Hairline | `rgba(0,0,0,.08)` | `rgba(255,255,255,.12)` |
| Hero card | `#1D1D1F`, text `#F5F5F7`, secondary `rgba(245,245,247,.6)` | `#232328` with a faint 1px edge instead of a shadow |
| Primary button | Ink pill `#1D1D1F` / white text, 52px tall, fully rounded | Inverted |
| Links | `#0066CC` | `#4AA3FF` |
| Good / check / blocks | `#1F7A35` / `#B25000` / `#D70015` | `#4CD964` / `#FFB340` / `#FF6B60` |

In dark mode, depth comes from lighter surfaces rather than shadows: page → panel → hero card → inputs, each a step lighter. Full rules in `design/design-language.md`.

**Type:** system San Francisco (`-apple-system`), with **Geist** as the fallback; `tabular-nums` for all money.
- Hero figure 56–60px, weight 600, tracking −0.055em, **pence smaller and lighter**.
- Large title 34px bold.
- Section title 20px bold, sentence case.
- Body 17px; captions 13–14px grey.

**Components:**
- **Hero card:** radius 24–26px, soft shadow.
- **List rows:** 56–68px tall; 42px round icon; separators inset past the icon.
- **Inputs:** grey filled boxes with right-aligned numbers and a focus ring; accept "£1,200.00".
- **Status:** small tinted pills or tinted round icons, **always with words** ("£20.00 short", never just "−20").
- **iOS toggles** in green.

**Rules:**
- Colour only means status.
- One obvious next action per screen.
- Plain English (reading age about 9).
- Follow the device's light/dark setting.
- Touch targets at least 44px (bigger on the kitchen iPad).
- Undo instead of confirm, except the final Submit.

---

## 8. Research findings to build in (ranked)

Full detail with sources: `research/2026-10-research-findings.md`.

**Before launch:**
1. Reason codes and "None today" buttons.
2. Honest sync states (saved on device → sending → received by head office).
3. Tips & service charge section (Tips Act 2023: written policy, **3-year records**, worker statements).
4. Head office approve / send back, with resolution tracking.
5. 07:00 digest via a Netlify Scheduled Function.
6. Handover categories (a maintenance note can raise a repair job).
7. iPad photo-grid PIN sign-in with a badge alternative (WCAG 2.2 3.3.8).
8. Undo toasts.
9. Specific Submit label.

**Phase 2 differentiators:**
1. Forecast and wage warnings (done in the designs).
2. Rule-based anomaly flags (e.g. "comps 3× usual by one person after 21:00").
3. Delivery payout reconciliation (nobody does this; DoorDash bought Deliveroo in Oct 2025).
4. True labour cost incl. employer NIC 15% above £5k and the NLW of £12.71 (April 2026).
5. Per-site thresholds with a "would have flagged" preview.
6. "On time X of Y this month" (not streaks).
7. HO one-tap "Thanks".

**Later:**
- AI: "Ask your logs" + summary of last night, with **every sentence linked to its source entry**.
- Employment Rights Act 2025 record-keeping (day-one SSP, 6-year holiday records).
- Right-to-work expiry tracker.
- Martyn's Law (sites holding 200–799 people; enforcement about 2027).
- Food-safety checklists with Bluetooth probes.
- Cmd+K for head office (site screens have ⌘K since 27 Oct, §6).
- Translations, with "Free items" as an alias for "comps".

**Check65 (looked at again 27 Oct 2026):**
- The UK App Store listing has **87 ratings averaging 2.6★**. This replaces the "2 US ratings at 4.0" in `docs/reports/`, which used it to argue the app gets few downloads.
- The detailed reviews complain that **entering temperatures is slow** (a scroll wheel instead of the keyboard, one form per reading, no jump to the next item). We type temperatures on the keypad, Enter moves to the next field, and fields that can go below zero have a **±** button (the iPhone decimal keypad has no minus key).
- **What Check65 has that we don't:** Bluetooth probes; push reminders for due or missed checks; offline mode with background sync; HACCP plans and a risk-assessment library; health-and-safety and fire checks; a visitor log; Food Alert's advice line and consultancy. Push reminders and offline mode matter most for 9 sites, and both are already planned. HACCP and risk assessments are content, best bought or written with an EHO, not built.

**Where we beat competitors** (Tenzo, Nory, Restaurant365, Toast, 7shifts, Trail, Jolt, Check65 and others):
- Numbers and notes in one place.
- Cash counted by denomination.
- Late-night closes and offline use.
- Delivery reconciliation.
- Head-office review across all sites.
- AI that explains *why*, using the manager's own notes.
- A good fit for a 9-site group.

---

## 8a. Food-safety module scope (agreed 27 Oct 2026)

**Why:** under the Food Safety Act 1990, a business's main defence is **"due diligence"** (s.21): proving it "took all reasonable precautions". Inspectors can visit unannounced and inspect and copy records (s.32). The app's logs are that proof, so they must be trustworthy and quick to produce. Source: the FSA's guide to the Act at gov.uk "Key regulations" (2009 edition, read 27 Oct 2026). Rules marked *(beyond the guide)* come from other law or FSA guidance (Food Hygiene Regulations 2013, Food Information Regulations 2014 / Natasha's Law, General Food Law Arts 18–19, Safer Food Better Business). **Confirm them with an environmental health officer before launch.**

**Designs:** "Food safety screens" canvas, https://claude.ai/artifact/WG6Dirxd5TEV2ay6J2TcJU (11 phone screens plus an overview). All names and figures on it are examples.

| # | Feature | What it does | Who | Priority |
|---|---|---|---|---|
| 1 | **Records you can trust** | A finished checklist is locked (already built). A **correction** by a supervisor, manager or head office needs a reason and adds a new version; the old answer stays visible to head office and inspectors. Times come from the server | Supervisor and above | Before launch |
| 2 | **Records for an inspector** | Pick a site and dates, choose what's included, then get one printable PDF (temperatures and checks with corrections, faults and fixes, allergens, deliveries, training, complaints, cleaning). Health answers and customer details are always left out | Supervisor and manager (own site); head office (any site) | Before launch |
| 3 | **How long we keep records** | Keep period per log type, set by head office. Nothing is cleared without head office saying yes. Suggested: checks and fixes 2 years, allergen versions and complaints 3 years, training until leaving + 2 years, fit-to-work answers 6 months (UK GDPR: health data kept short), inspections and notices 6 years. **No fixed legal period; these are suggestions** | Head office | Later |
| 4 | **Allergens** | The 14 allergens per dish with every version kept, a change log, staff confirming they've read a change, and an allergen incident report. Full ingredient labels (Natasha's Law) only if a site sells food it pre-packs itself *(beyond the guide)* | Managers edit; everyone reads | Next |
| 5 | **Cooking and cooling** | Core temperature on cooking and reheating: **75°C or above** (FSA guidance). Cooling: a 90-minute timer to get food into the fridge, with checks. Fridges: **warn above 5°C, fail above 8°C** (legal limit) *(beyond the guide)* | Kitchen | Next |
| 6 | **Probe calibration** | Weekly readings per probe: iced water **−1 to 1°C**, boiling water **99 to 101°C**. A failed probe can't be picked for temperature checks until it passes | Kitchen | Next |
| 7 | **Tracing food and recalls** | Deliveries record each item's batch code and use-by date, from approved suppliers only. FSA food alerts are matched against the batches received, and someone records what was done (set aside, sent back, not in stock) (General Food Law Arts 18–19) | Whoever receives deliveries; managers | Later |
| 8 | **Customer complaints** | Foreign body, illness, allergic reaction, wrong dish, undercooked: photos, item kept, batch, what was done; sent to head office. The customer's contact is saved only with their OK (s.14) | Supervisor and above | Later |
| 9 | **Training and fitness to work** | Food hygiene certificates with expiry dates (warn 30 days before). A fit-to-work question at the start of a shift, with the **48-hour exclusion** after vomiting or diarrhoea *(beyond the guide)*. Only managers see health answers | Managers | Later |
| 10 | **Inspections and notices** | Per site: council registration, hygiene rating, inspector visits, and improvement notices with fix-by and appeal-by dates (appeals usually within 1 month). Head office is reminded 7 days before each deadline | Managers; head office | Later |
| 11 | **4-weekly review** | Repeat faults (the same check failing 3 or more times in 7 days) with suggested fixes, "anything changed?" questions (new dishes or suppliers, new staff, new equipment) and a signed review | Managers | Later |

**Status (27 Oct 2026):** all 11 features are built in demo mode and merged to `main` ([ejlson/maginhawa-ops#4](https://github.com/ejlson/maginhawa-ops/pull/4), with the desktop layout and loading skeletons). Tests: core 221, web app 101, functions 23, all passing on a clean checkout. **Not done:** connected mode (SharePoint), push reminders, offline sync, Bluetooth probes, and an EHO's sign-off on the rules (brief ready, see §10).

**Code:** rules in `packages/core/src/food-safety.ts` (unit-tested); screens under `/food-safety` in `apps/eod-web`; who can do what is in `can` in `apps/eod-web/app/lib/auth.tsx`. Demo mode keeps the data on the device, like repairs. Connected mode will use the SharePoint lists in `docs/tech-plan/sharepoint/sharepoint-lists.json`.

---

## 9. Plan and timeline

| When | Phase | Done when |
|---|---|---|
| 13–24 Oct 2026 | **Set-up and sign-off** | Designs walked through with finance + 2–3 GMs. Admin registers the app in Entra ID (admin consent), grants `Sites.Selected` on the site and `Mail.Send` for the shared mailbox; Netlify environment variables set. **Old Power Automate URL regenerated.** SharePoint lists provisioned from `docs/tech-plan/sharepoint/sharepoint-lists.json`. **Historic EOD rows imported from Excel** (forecasts need 6 weeks) |
| 27 Oct – 5 Dec | **Build v1** | Sign-in, hub, all sections, cash count, review/submit, offline drafts, `core` calcs with tests; `submit-eod` function (official totals + summary email) and CSV/Excel export; head office Today view and basic settings |
| 8–19 Dec | **Pilot at 2 sites** | Run alongside the old form; compare nightly |
| 22 Dec – 2 Jan | **Freeze** | No rollout during peak trading |
| Jan 2027 | **Roll out to all 9** | Training per site; retire the Netlify form after 2 clean weeks; add tips, iPad PIN, approve/send back, 07:00 digest |
| Feb 2027 | **Forecasts and insights** | Trends, Forecast tab, wage warnings, anomaly rules |
| Mar–Apr 2027 | **Next modules** | Checklists, food-safety logs (scope in §8a; first version built Oct 2026), repairs log |
| May 2027 → | **AI and extras** | Ask your logs, AI summary, handbook, delivery reconciliation; native app only if needed |

Assumes 1–2 developers.

**Main risks:**
- Entra admin consent for `Sites.Selected` and `Mail.Send` (start now).
- The exposed Power Automate URL (the old form's flow is retired once the new app is live).
- Every change to business logic needs a developer (no visual flow editor).
- The Christmas peak.
- SharePoint view limits (index and archive).

---

## 10. Open questions (need the client)

1. Which EPOS/till do the sites use? (v1 doesn't integrate, but VAT "digital links" under Making Tax Digital should be checked with the accountant if figures are re-keyed.)
2. Actual delivery contract terms per platform (commission/retention).
3. How long the EOD takes GMs today; interview the 9 GMs.
4. Each site's capacity (Martyn's Law tier).
5. Who owns tips/tronc, and is there an independent troncmaster?
6. Who builds it, and how many developers?
7. Probe hardware (Bluetooth probes?). The food-safety scope is now agreed and built (§8a); an EHO should confirm the *(beyond the guide)* rules and the keep periods. **The brief for that meeting is ready: `docs/eho/EHO brief.pdf`** (two pages with tick boxes; fill in the contact line before sending).
8. Which reservations system does each site use (SevenRooms, OpenTable, ResDiary…)? The nightly bookings snapshot needs read access to it.
9. Does each site have a written HACCP-based food safety management system (usually an SFBB pack)? The app records the checks but doesn't hold the plan.
10. Should we set up a **Primary Authority** partnership with one council? The 9 sites fall under more than one London council, and Primary Authority gives one consistent answer.

---

## 11. How the user likes to work

- Wants things **simple, intuitive and premium-looking**. Iterates visually; give options as quick previews when the direction is unclear.
- Prefers **concise answers** with clear tables, and deliverables as **PDFs or shareable pages**.
- Says plainly when they dislike something. Change only what they point at, and keep what they liked.
- The Gena data-model PDF they supplied was **only a style reference** (layout/format) from another project. Don't use its content.

---

## 12. What's in this folder

```
CLAUDE.md                     ← instructions a new Claude reads automatically
HANDOFF.md / HANDOFF.pdf      ← this brief
research/
  2026-10-research-findings.md   UX, market and competitor research (Oct 2026) with sources
design/
  design-language.md          tokens, components, do/don't
  eod-canvas/                 every screen's source (.dc.html) + canvas.json
docs/
  eho/                        brief for an environmental health officer (HTML + PDF)
  reports/                    product plans (UK plan is current; US-first plan is older)
  research_notes/             earlier market, competitor and regulation notes
  tech-plan/                  tech stack & architecture plan, system diagrams, data model,
                              SharePoint list spec (JSON + scripts), Postgres fallback option
```

## 13. Suggested next steps for whoever picks this up

1. Read this file, then open the canvas link (or `design/eod-canvas/`).
2. Update `docs/tech-plan/Tech stack and architecture plan` to match §3–§4: React Router v7 SPA instead of Next.js, and Netlify Functions instead of Power Automate flows F01–F12.
3. Scaffold the monorepo (`apps/eod-web`, `apps/functions`, `packages/core`), write the §5 calculations with Vitest tests using the verified example, then build the routes for each section.
4. Write the SharePoint provisioning script from `sharepoint-lists.json`.
5. Book an EHO (or a former EHO working as a consultant) using `docs/eho/EHO brief.pdf`, then update the rule values in `packages/core/src/food-safety.ts` and the keep periods from their answers.
6. Food safety next: push reminders and offline sync (the main gaps against Check65, §8), then connected mode on the SharePoint lists.
