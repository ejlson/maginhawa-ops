# Prompt: rebuild Maginhawa Ops on Replit

*Paste everything below the line into Replit Agent. Build it in the phases shown and check each phase before starting the next. All figures are examples, not real data.*

---

## What to build

An internal operations web app for **Maginhawa**, a London restaurant group with 8 sites. It has two modules:

1. **End-of-day report (EOD):** after close, managers type in the night's figures. The app works out net sales, cash difference and wage %, checks the figures, and sends the report to head office.
2. **Checklists:** opening, closing, temperature and custom checklists that staff complete during the day on a shared iPad or their phone.

There's also a **Setup & design** area where head office can change how the app works and looks without a developer.

Use UK English, £ and the Europe/London timezone throughout. It must work on phones, a shared kitchen iPad and desktop, and be installable as a PWA.

## Tech

- **Front end:** React + TypeScript + Vite, React Router, TanStack Query, react-hook-form + zod.
- **Back end:** Node + Express (TypeScript) in the same Repl.
- **Database:** Replit's built-in **PostgreSQL**, using Drizzle ORM with migrations.
- **Photos:** Replit **Object Storage** in a private bucket, served only through the API. Compress images in the browser to about 1600px and 300 KB before upload.
- **Tests:** Vitest for all calculations and checklist rules.
- Put all business rules in one shared folder, `shared/` (calculations, zod schemas and checklist rules), used by both the browser and the server. The server always re-runs the calculations on submit and saves the official figures.
- Store money as **whole pence (integers)**, never floats.
- Put secrets in Replit Secrets only.

## People, roles and sign-in

| Role | Can do |
|---|---|
| Staff | Checklists at their site(s) |
| Supervisor | Checklists and the EOD |
| Manager | Checklists, the EOD, and editing their site's checklists. With 2 or more sites they get a "My sites" overview |
| Head office | Everything at every site, plus Setup & design and approving or sending back reports |

- Each person has a home site, other sites, or "All sites". Only head office changes anyone's sites. The server works out access from the database, never from the browser.
- **Sign-in:** email and password (hashed) for managers and head office. On the **shared iPad**, show a photo grid of today's staff, then a **4-digit PIN**, then a "Not you?" link. PINs are hashed, and the account locks after 5 wrong tries.
- Keep all permission checks in one function, `can(user, action, site)`, and use it on both client and server.

## Sites (seed data)

The open sites are Bintang (BIN), Guanabana (GUA), Belly (BEL), Hoodwood (HOO), Bunso (BUN), Cafe Mama & Sons (CAF), Mamasons Kentish Town (MKT) and Mamasons China Town (MCT).

Ramo (RAM) is **closed**. Keep it so that old records still show its name, but hide it from pickers, counts and access.

## EOD calculation rules (in `shared/`, unit-tested)

| Figure | Rule |
|---|---|
| Net sales (per service) | Gross − service charge − VAT − discounts & comps |
| Food % / Drink % | Food (or drink) ÷ **net**. Warn when food + drink ≠ net; the manager can tap "It's right" |
| Covers | Booked + walk-ins |
| Net a head | Net ÷ covers (dine-in only) |
| Cash taken | Counted in the drawer (entered by denomination: £50, £20, £10, £5, £2, £1, 50p, 20p, 10p, 5p, 2p, 1p) − float (£150 default, set per site) |
| Cash difference | Cash taken − cash on the till report. Within ±£1 counts as balanced. Outside that needs a **reason**: refund paid in cash, paid out (petty cash), float not reset, miscount/recounted, or other, plus an optional note |
| Delivery net | Gross ÷ (1 + VAT) × the platform's share, which is a **setting per platform** (e.g. Deliveroo 55%, Uber Eats 55%) |
| Day total net | Lunch net + dinner net + delivery net |
| Wage % | Wage cost ÷ day total net. Green < 30%, amber 30–35%, red > 35% (set per site) |
| Trading day | A report opened before 04:00 counts as the previous day |
| Discount lines | Itemised discount/comp lines must add up to the till's discounts total; show a warning if there's a gap |

**These tests must pass:**

| Input | Expected |
|---|---|
| Lunch: gross £1,200, service £120, VAT £180, discounts £50, 40 covers | net **£850.00** |
| Dinner: gross £2,400 (service £240, VAT £360, discounts £100), 65 covers | net **£1,700.00** |
| Deliveroo: gross £300, 55%, VAT 20% | net **£137.50** |
| Day total net | **£2,687.50** |
| Wages £800 | **29.8%**, green |

**Validation:**
- Block submit only for real errors: an unexplained cash difference, or a required section left empty.
- Everything unusual is a warning with "It's right" or "Fix".
- Submit stays disabled until the required sections are done and the confirmation box is ticked.

## EOD screens

1. **Today's close (hub):**
   - A dark hero card showing net so far and section progress.
   - Sections can be done in **any order**, each with a progress circle: Lunch, Dinner, Delivery, Promotions & other, Wages, Tips & service charge, Feedback, Handover.
   - "What ran today" toggles (lunch, dinner, delivery).
2. **Lunch / Dinner:**
   - The hero shows that service's live net.
   - Inputs: till figures, covers, and food & drink with a match check.
   - Cash, with a **Count the cash** sheet: one row per note or coin, a typed count, a live total and "less float".
   - Till cash, then the difference and reason chips.
   - Discount, comp and void lines as list rows, with a reason picked from a list.
3. **Delivery:** one row per active platform, with traded yes/no, gross, refund pending and a note.
4. **Promotions & other, Wages, Tips & service charge** (card tips, cash tips, goes to tronc), **Feedback** and **Handover**:
   - Feedback and Handover are notes with a category.
   - A maintenance note can be flagged "raise a repair".
5. **Review:**
   - The hero shows day net and key metrics.
   - "Check before sending" lists red blocks and amber warnings.
   - Breakdown rows open the matching section when tapped.
   - A confirm tick, then a button with a specific label, e.g. **"Submit Monday · £2,687.50"**.
6. **Submitted:** "Day closed · Received by head office 00:31", plus "On time 26 of 28 this month".
7. **Head office: all sites today:**
   - The hero shows group net, e.g. "7 of 8 in".
   - A table of sites: net, vs target, wage %, cash status and report status.
   - **Approve** or **Send back with a note**. Approving clean reports can be done in bulk, with Undo.
   - A site detail panel.
   - CSV export over a date range.

**Saving and sync:**
- Drafts **auto-save** to the device (IndexedDB) and to the server.
- Every report has a `clientId` UUID with a unique index, so a retried submit never creates a duplicate.
- Only one submit wins. Any shared write sends the version it started from; a stale write is refused and the screen shows who changed it ("Not saved: submitted by Jo at 22:04").
- Show honest sync states: **Saved on this device → Sending → Received by head office**.
- Email the summary to head office when a report is submitted.

## Checklists

**Templates** have:
- a title;
- a phase (opening / mid-shift / closing);
- due times (HH:MM, one run per time; none means "do when needed");
- a late window in minutes;
- who does it;
- a scope: group-wide, or one site.

**Checkpoints** can be **yes/no, temperature, number, text, photo, pick from a list, date, or signature**. Each has:
- required yes/no;
- min/max for temperatures and numbers;
- which answer fails, for yes/no;
- the options, for pick-from-a-list;
- "fail if the date has passed", for dates (use-by);
- "offer a repair job on fail".

**Rules (in `shared/`, unit-tested):**
- Each answer is checked against its rule, e.g. "Too warm: 9°C".
- A failed answer needs a **corrective action**: one or more picked actions (moved food to another fridge, closed the door, turned the thermostat down, reheated, threw the food away, called the manager), whether food was thrown away, a note, and a re-check time. The re-check then becomes its own task.
- A run can be **finished** only when every required answer is given and every failure has a fix.
- A **finished run is locked**. Supervisors and above can make a **correction**, which needs a reason. It adds a new version, and the original answer stays visible to head office.
- Task status: **upcoming → due** from 30 minutes before → **late** after the due time → **missed** once the window has passed. A completed run shows as **done** or **failed**.
- Times before 04:00 belong to the previous trading day.
- Several people can fill in one run at once. Each answer records who gave it and when, using the **server's clock**, and the latest answer wins.

**Screens:**
- **Today's checklists**, grouped by phase, with status circles and a "next check" pointer.
- **Run a checklist**:
  - big touch targets;
  - temperatures typed on the number pad, with a ± button (the iPhone decimal pad has no minus key);
  - Enter moves to the next field;
  - fix a failure inline in its row;
  - a "Finish" card.
- **Checklist builder** (managers for their site, head office for any site): add, edit and drag to reorder checkpoints, with a live preview.
- **Head office: checklist days:** every site's runs for a date, showing missed, failed and fixed, plus a PDF of one site's day for an inspector.

**Seed templates (examples):**
- **Opening checks, 09:30:** walk-in and reach-in fridges ≤ 8°C, freezer ≤ −18°C, door seals, food covered and labelled, hand-wash basins stocked, probe thermometer working.
- **Hot holding, 12:00 / 15:00 / 18:00:** pass, bain-marie and soup well ≥ 63°C.
- **Closing checks, 23:00:** fridges, kitchen cleaned, bins out, doors locked and alarm set.
- **Delivery check, when needed:** supplier, chilled goods ≤ 8°C, packaging undamaged.

## Setup & design (head office)

Everything here is stored in the database and takes effect straight away, with no code changes or redeploy. Every change is logged (who, when, before/after) and can be undone.

**Setup**
- **Sites:**
  - add a site, rename it, or mark it closed;
  - float, cash tolerance, VAT rate, wage amber/red %, trading-day end time (default 04:00);
  - which services run, and daily net targets (typed in or uploaded as CSV).
- **People & roles:** add people, set their role and sites, reset a PIN, upload a photo for the iPad grid, deactivate someone.
- **EOD form builder:**
  - switch sections on or off, rename them, reorder them, and mark them required or optional;
  - add **custom fields** to any section (money, number, %, yes/no, text or pick-from-list), with required yes/no and help text.
  - Custom fields are saved with the report and appear on Review, in the email and in the CSV export.
  - Built-in calculated figures can't be deleted, only hidden.
- **Lists:**
  - discount and comp reasons (seed a few, e.g. "Customer complaint · food", "Employee dining 20%"; head office will paste the full list of 23);
  - void codes, split into waste (W) and no-waste (NW) (seed e.g. "W2 Dropped plate", "NW1 Out of stock"; full list of 15 to follow);
  - cash difference reasons;
  - feedback and handover categories;
  - corrective actions;
  - delivery platforms and each one's share %.
- **Checklists:** the template library, which templates each site uses, due times and windows.
- **Emails:** who receives the EOD summary and the late-report reminder, and the reminder time.

**Design**
- **Brand:**
  - app name;
  - logo (uploaded to Object Storage) shown on sign-in and in the header;
  - an **accent colour** used for links, focus rings and the primary button;
  - a live preview of each change.
- **Appearance:** follow the device / always light / always dark. Density: comfortable or compact. Text size: standard or large, for the kitchen iPad.
- **Home screen:** choose and reorder the cards each role sees, e.g. Today's close, Checklists due, Handover notes, My sites.
- Build every visual value as a **CSS variable (design token)** loaded from the database at start-up, so that a change in Design restyles the whole app.
- **Status colours** (green, amber, red) stay fixed and aren't editable, because colour always means status. Warn if the chosen accent colour fails WCAG AA contrast on either theme.
- "Reset to Maginhawa default" restores the tokens below.

## Default design (follow exactly)

**Style:**
- Apple-like, calm and premium.
- **One dark "hero" card per screen**, then **Monzo/Revolut-style plain lists**: a 42px round icon, title, grey subtitle, amount on the right and hairline dividers.
- **Things 3-style progress circles**: empty = to do, orange half = in progress, green tick = done, dashed = skipped.
- Don't put every group in its own white card on a grey background. No emoji, gradients or coloured left borders.

**Tokens:**

| Token | Light | Dark |
|---|---|---|
| Page | `#FFFFFF` | `#121214` |
| Panel | `#F7F7F9` | `#1B1B1F` |
| Hero card | `#1D1D1F`, text `#F5F5F7` | `#232328` with a 1px `rgba(255,255,255,.07)` edge |
| Fill (inputs, icons) | `#F2F2F5` | `#2A2A2F` |
| Text / secondary | `#1D1D1F` / `#6E6E73` | `#F2F2F4` / `#A3A3AB` |
| Hairline | `rgba(0,0,0,.08)` | `rgba(255,255,255,.12)` |
| Link / accent | `#0066CC` | `#4AA3FF` |
| Good / warn / bad | `#1F7A35` / `#B25000` / `#D70015` | `#4CD964` / `#FFB340` / `#FF6B60` |

**Type:**
- Font stack: `-apple-system, BlinkMacSystemFont, 'Geist', sans-serif`, with `tabular-nums` for all money.
- Hero figure: 56–60px, weight 600, tracking −0.055em, with the **pence smaller and lighter**.
- Large title 34px bold; section title 20px bold in sentence case; body 17px; captions 13–14px grey.

**Components:**
- Hero card: radius 24px.
- List rows: 56–68px tall.
- Inputs: grey filled boxes, radius 10px, numbers right-aligned, accept "£1,200.00".
- Primary button: an ink pill, 54px tall and fully rounded. One per screen.
- iOS-style green toggles.
- A thin 8px custom scrollbar.

**Rules:**
- Status is always shown in words, e.g. "£20.00 short", not "−20".
- One obvious next action per screen.
- Plain English (reading age about 9).
- Touch targets at least 44px, bigger on the iPad.
- Use Undo toasts rather than confirm dialogs, except for the final Submit.

**Desktop:**
- A sidebar with live counts (red for late, orange for needs a look).
- Content on the left with the hero card at the top right, in a 1120px frame.
- ⌘K / Ctrl+K to search and jump.
- Checklists show the list on the left and the open checklist on the right.

## Database (Drizzle, PostgreSQL)

**Tables:**
- `sites`, `people`, `person_sites`, `sessions`
- `settings_site`, `delivery_platforms`, `targets`, `reason_lists`
- `eod_form_sections`, `eod_custom_fields`
- `design_settings` (one row with JSON tokens and a version), `audit_log`
- `eod_reports` (unique `client_id`, unique `(site_code, business_date)`, `version`, `status`: draft / submitted / approved / sent back, the draft as JSONB, and the official figures in typed columns)
- `eod_events` (submit, approve, send back, with who and when), `email_log`
- `checklist_templates`, `checkpoints`, `site_templates`
- `checklist_runs` (unique `run_key` = `date|template|time`), `responses` (who and when, server time), `corrective_actions`, `corrections`
- `photos` (object key, run, checkpoint and who; links go by photo ID, never by path)

**Indexes:**
- `site_code`, `business_date` and `status` on reports and runs.
- Back up the database nightly. Keep checklist records for 3 years and photos for 12 months; both are settings.

## Build in phases (stop after each one so I can check)

1. **Foundations:** database schema and seed data, sign-in (email + PIN), roles and site access, design tokens loaded from the DB, and the app shell for phone, iPad and desktop. Vitest set up, with the calculation tests above passing.
2. **EOD:** the hub, every section, cash count, review, submit, the Submitted screen, offline drafts, the summary email, and the head office Today view with approve / send back and CSV export.
3. **Checklists:** today's tasks, running a checklist, fixes and re-checks, photos, locking and corrections, the builder, the head office checklist days view and the inspector PDF.
4. **Setup & design:** every screen in that section, with the audit log, undo and live preview.

## Don't

- Don't integrate a till/EPOS system. Managers type the figures in.
- Don't hard-code thresholds, platforms, reasons or colours; they all come from Setup.
- Don't put real names or figures in the seed data; label everything as an example.
- Don't store anything sensitive in the browser apart from drafts.
- Check where Replit stores the database and photos: staff names and photos are personal data under UK GDPR.
