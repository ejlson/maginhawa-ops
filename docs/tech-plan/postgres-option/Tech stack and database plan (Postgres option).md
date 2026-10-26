# Tech stack and database plan

This plan turns the UK product plan into an architecture you can build: **one TypeScript codebase** shipping a **kitchen tablet app, a phone app and a desktop web console**, on **PostgreSQL in a London region**, with **offline-first sync** and a traceable **AI layer** (Ask your logs, Ask the handbook, read-the-thermometer, snap-to-setup). Every choice below is driven by four product requirements from the research. Kitchens have bad Wi-Fi, so the tablet must work fully offline. Compliance records must be **tamper-evident** for EHOs. Staff turn over 38–47% a year, so **shared devices with PINs** must be fast. The **£19 entry tier** forces low running costs. The companion file `schema.sql` (v0.2) contains the full PostgreSQL schema: 67 tables, including the **trading / EOD finance module** that replaces Maginhawa's current Netlify form. It has been loaded into a real PostgreSQL 16 server and smoke-tested. The trading calculations, the cash-variance rule and the one-report-per-site-per-day rule all behave as designed. A companion PDF, **System design diagrams**, shows the architecture, flows, lifecycles, sequences and data model. Product-level details such as legal thresholds stay data in the database, never code, because many are still flagged **[unverified]** in the product plan.

## The stack at a glance

<svg viewBox="0 0 760 430" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;font-family:-apple-system,Helvetica,Arial,sans-serif">
  <defs><marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#5b6575"/></marker></defs>
  <rect x="10" y="10" width="740" height="92" rx="10" fill="#eef5f2" stroke="#1f6f5c"/>
  <text x="22" y="30" font-size="12" font-weight="700" fill="#1f6f5c">CLIENTS — one TypeScript monorepo</text>
  <rect x="25" y="40" width="225" height="52" rx="8" fill="#fff" stroke="#1f6f5c"/><text x="137" y="61" font-size="12" font-weight="700" text-anchor="middle">Tablet kiosk app</text><text x="137" y="78" font-size="10" text-anchor="middle" fill="#445">Expo / React Native · PIN · offline SQLite</text>
  <rect x="268" y="40" width="225" height="52" rx="8" fill="#fff" stroke="#1f6f5c"/><text x="380" y="61" font-size="12" font-weight="700" text-anchor="middle">Phone app</text><text x="380" y="78" font-size="10" text-anchor="middle" fill="#445">Same Expo codebase · push · biometrics</text>
  <rect x="511" y="40" width="225" height="52" rx="8" fill="#fff" stroke="#1f6f5c"/><text x="623" y="61" font-size="12" font-weight="700" text-anchor="middle">Desktop web console</text><text x="623" y="78" font-size="10" text-anchor="middle" fill="#445">Next.js · data grid · charts · Excel</text>
  <line x1="200" y1="102" x2="200" y2="140" stroke="#5b6575" marker-end="url(#a)"/><text x="206" y="125" font-size="10" fill="#5b6575">offline sync</text>
  <line x1="560" y1="102" x2="560" y2="140" stroke="#5b6575" marker-end="url(#a)"/><text x="566" y="125" font-size="10" fill="#5b6575">HTTPS API</text>
  <rect x="10" y="142" width="740" height="120" rx="10" fill="#f6f7f9" stroke="#5b6575"/>
  <text x="22" y="162" font-size="12" font-weight="700" fill="#333">BACKEND — UK region (London)</text>
  <rect x="25" y="172" width="170" height="78" rx="8" fill="#fff" stroke="#5b6575"/><text x="110" y="194" font-size="12" font-weight="700" text-anchor="middle">Sync service</text><text x="110" y="211" font-size="10" text-anchor="middle" fill="#445">PowerSync</text><text x="110" y="226" font-size="10" text-anchor="middle" fill="#445">per-site buckets</text>
  <rect x="207" y="172" width="170" height="78" rx="8" fill="#fff" stroke="#5b6575"/><text x="292" y="194" font-size="12" font-weight="700" text-anchor="middle">API service</text><text x="292" y="211" font-size="10" text-anchor="middle" fill="#445">Node + Hono + Zod</text><text x="292" y="226" font-size="10" text-anchor="middle" fill="#445">rules engine · uploads</text>
  <rect x="389" y="172" width="170" height="78" rx="8" fill="#fff" stroke="#5b6575"/><text x="474" y="194" font-size="12" font-weight="700" text-anchor="middle">Jobs &amp; schedules</text><text x="474" y="211" font-size="10" text-anchor="middle" fill="#445">pg-boss workers</text><text x="474" y="226" font-size="10" text-anchor="middle" fill="#445">runs · auto-close · EOD</text>
  <rect x="571" y="172" width="165" height="78" rx="8" fill="#fff" stroke="#5b6575"/><text x="653" y="194" font-size="12" font-weight="700" text-anchor="middle">AI service</text><text x="653" y="211" font-size="10" text-anchor="middle" fill="#445">Claude API · tools</text><text x="653" y="226" font-size="10" text-anchor="middle" fill="#445">citations · audit log</text>
  <line x1="380" y1="262" x2="380" y2="292" stroke="#5b6575" marker-end="url(#a)"/>
  <rect x="10" y="294" width="740" height="62" rx="10" fill="#fff8ec" stroke="#b7791f"/>
  <text x="22" y="314" font-size="12" font-weight="700" fill="#8a5a12">DATA</text>
  <text x="80" y="314" font-size="11" fill="#333">PostgreSQL 16+ (Supabase, London) · RLS per organisation &amp; site · pgvector · append-only compliance tables</text>
  <text x="80" y="336" font-size="11" fill="#333">Object storage (photos, certificates, invoices) · Video streaming for how-to clips · Nightly encrypted backups</text>
  <rect x="10" y="368" width="740" height="52" rx="10" fill="#f3f0fa" stroke="#6b5ca5"/>
  <text x="22" y="388" font-size="12" font-weight="700" fill="#4d3f8a">EXTERNAL</text>
  <text x="105" y="388" font-size="11" fill="#333">Expo Push · Twilio SMS (contractor links) · Postmark email · Stripe Billing (GBP/VAT) · FSA FHRS API</text>
  <text x="105" y="408" font-size="11" fill="#333">Phase 2–3: Epos Now / Square / Lightspeed · Deputy / RotaCloud · Xero / QuickBooks / Sage · Bluetooth probes</text>
</svg>

| Layer | Recommended choice | Why this one | Credible alternative |
|---|---|---|---|
| **Language & repo** | TypeScript everywhere; pnpm workspaces + Turborepo monorepo | One language for tablet, phone, web and API. Shared Zod schemas mean the rules engine and validation are written once | Separate repos (slower for a small team) |
| **Tablet + phone app** | **Expo (React Native)** with EAS Build and over-the-air updates | One codebase for iPad, Android tablets, iPhone and Android phones. Tablet and phone get different layouts and navigation from the same code. OTA updates fix kitchens without app-store waits | Flutter (also good, but it splits the language from the web console) |
| **Desktop console** | **Next.js** (React) + Tailwind + shadcn/ui; AG Grid or TanStack Table for the spreadsheet view; ECharts or Recharts; ExcelJS for exports | Shares components, types and API client with the mobile app. A grid component handles the "spreadsheet summary" requirement properly | React SPA with Vite |
| **On-device database** | SQLite (op-sqlite) managed by the sync SDK | The tablet reads and writes locally. Taps feel instant and work with no signal | WatermelonDB |
| **Offline sync** | **PowerSync** (Postgres-backed, sync rules per site) | Built for Postgres + React Native offline-first. Each tablet only downloads its own site's data, and uploads go through our API so rules are enforced server-side | ElectricSQL; or a custom outbox + delta sync (more work) |
| **Primary database** | **PostgreSQL 16+ on Supabase, London region** | Postgres row-level security for multi-tenancy, pgvector for AI search, and managed auth and storage in one UK-hosted bill. Plain Postgres means no lock-in | AWS RDS (eu-west-2) + Cognito + S3 for more control later |
| **API** | Node.js + **Hono** (or NestJS) with Zod validation, on Fly.io (London) or AWS ECS (eu-west-2) | Small, fast, typed. It holds the rules engine (pass/fail against nation thresholds), upload validation, contractor links and integrations | Supabase Edge Functions only (harder to test and grow) |
| **Background jobs** | **pg-boss** (job queue inside Postgres) + cron | Generates checklist runs from schedules, auto-closes overdue lists, sends end-of-day reports, certificate expiry reminders, FHRS sync and AI batch summaries. No extra vendor | Inngest or Trigger.dev |
| **Auth** | Supabase Auth: email magic link + password for managers; Google/Microsoft SSO later. **Kiosk PIN** verified on the device against an argon2 hash | Staff without email can still sign in by PIN on a registered tablet | Clerk |
| **Files & media** | Supabase Storage (S3-compatible, London) for photos and documents; **Mux** or Cloudflare Stream for how-to videos | Videos need streaming and transcoding for kitchen tablets on weak Wi-Fi | AWS S3 + CloudFront |
| **Notifications** | Expo Push; **Twilio** SMS (UK numbers) for contractor work-order links; Postmark for email | Contractors get a no-login link by SMS. Managers get exception-only push notifications | Vonage, Resend |
| **PDF generation** | Headless Chromium (Playwright) rendering HTML templates | EHO packs, end-of-day reports and allergen matrices print exactly like the screen | react-pdf |
| **Billing** | **Stripe Billing**: GBP, VAT, per-site quantity, monthly rolling | Matches the £0 / £19 / £39 / £59–69 / estate pricing model | Paddle (merchant of record) |
| **AI** | **Anthropic Claude API** via the official TypeScript SDK; embeddings from a separate provider (e.g. Voyage AI) | Strong vision for thermometer and photo reading, tool use for Ask-your-logs, document citations for Ask-the-handbook | Claude via Amazon Bedrock or Google Vertex if a specific cloud region is required |
| **Observability** | Sentry (crashes and errors), PostHog EU (product analytics), Better Stack (logs, uptime) | Need to see sync failures on real kitchen devices | Datadog |
| **Kiosk lockdown** | iPad Guided Access / Apple Business Manager; Android Lock Task mode via an MDM (e.g. Esper, Hexnode) | Keeps the shared tablet in the app | — |

## Offline-first and the shared kitchen tablet

The tablet must never block on the network. The design follows a few rules:

- **Records are created on the device.** Every record gets a **UUIDv7** generated on the device, so IDs never clash when several offline devices sync later.
- **Writes are local first.** Each write lands in on-device SQLite immediately. The sync layer uploads queued writes in order when the connection returns and shows a "3 records waiting to sync" badge so managers trust it.
- **Two timestamps per record.** `client_recorded_at` is when the person did it, from the device clock. `server_received_at` is the trusted server time. A large gap between them is flagged to managers, which defeats changing the tablet clock to backdate checks.
- **Pass or fail is worked out twice.** It is evaluated on the device for instant feedback (red, plus a prompt for a corrective action), then **re-evaluated on the server** against the site's rules pack. The server result is authoritative and stored with a frozen copy of the threshold used.
- **Records are append-only.** A correction is a new record pointing at the old one (`supersedes_id`); nothing is edited or deleted. Database triggers enforce this. That makes the record tamper-evident for an EHO.
- **Each tablet syncs only its own site.** Sync rules download only that site's templates, today's runs, recent history and assets, which keeps the local database small.
- **Kiosk PIN login.** Staff tap their name and enter a 4-digit PIN, which is checked offline against an argon2 hash synced to the device. The session auto-locks after inactivity. Every response is stamped with both the person and the device.
- **Media uploads in the background.** Photos are compressed on the device and uploaded by a background task. The record syncs straight away with a placeholder link, and the photo follows.
- **AI features need a connection; logging does not.** If the tablet is offline, "read the thermometer" falls back to manual entry and queues the photo for checking later.

## AI layer design

**Model and API choices.** Use the official Anthropic TypeScript SDK (`@anthropic-ai/sdk`) from the AI service only; devices never hold API keys. Default to `claude-opus-5-5`. Once you have usage data, evaluate whether a cheaper model holds quality on high-volume routes such as translation or classification, and decide per route. The Claude API features each AI capability relies on:

| Capability | Claude API feature used | Notes |
|---|---|---|
| **Ask your logs** (search and analysis) | **Tool use with strict schemas**: the model chooses from the app's own query tools rather than writing SQL | Tools run on the server **as the asking user**, so Postgres row-level security limits what they can see. Every tool returns record IDs, which become clickable citations |
| **Ask the handbook** | Document input with **citations enabled** on the operator's approved policies and SFBB safe methods | Answers quote the source passage. If nothing relevant is found, the assistant says so |
| **Read the thermometer, snap-to-setup, fault photos, invoices, allergen labels** | **Vision** (image and PDF input) + **structured outputs** (`output_config.format`) for a guaranteed JSON shape | Extracted data is always a *suggestion* a person confirms |
| **End-of-day and weekly summaries, nightly early warnings** | **Message Batches API** | Asynchronous and half price; reports aren't time-critical to the minute |
| **Cost control** | **Prompt caching** of the fixed system prompt, tool definitions and the site's handbook | Plus a monthly AI quota per organisation (`organisations.ai_monthly_quota`), metered from `ai_interactions` |
| **Robustness** | Check `stop_reason` (including `refusal`) before using output; retry 429/5xx with backoff | Show "couldn't answer, here's the manual search" rather than failing silently |

**Ask-your-logs tool set (first version).** Each tool is a typed server function with strict JSON schemas:

| Tool | What it does |
|---|---|
| `search_records(entity, filters, date_range, site_ids, text?)` | Finds checks, responses, corrective actions, work orders, invoices, certificates and visitor entries |
| `aggregate(metric, group_by, filters, date_range)` | Counts, rates, sums and averages, for example the missed-closing rate by site and weekday |
| `timeseries(subject, interval, date_range)` | Temperature trend for one fridge, or failures per week |
| `semantic_search(query, sources)` | pgvector plus full-text search across notes, handover logs, policy text and photo captions |
| `get_record(entity, id)` | Fetches one record with its photos and history |
| `render_chart(spec)` | Returns a chart spec the console and phone draw natively |
| `save_query(question, query_spec, schedule?)` | Turns a good question into a scheduled report (`saved_queries` table) |

**Traceability.** Every AI call writes an `ai_interactions` row: feature, model, tools called with their parameters, records cited, output, whether the person accepted or edited it, and token usage.

**Data protection.** Sign Anthropic's data processing terms and check what processing locations and retention options they offer; don't assume UK-only processing. If an enterprise customer needs AI processing pinned to a specific cloud region, Claude is also available through Amazon Bedrock and Google Vertex AI; confirm which regions those offer for the models you use. Send the model only the fields a feature needs. Never send `fitness_to_work_records` or `harassment_reports` to the model.

## Database schema

### Domain map

<svg viewBox="0 0 760 352" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;font-family:-apple-system,Helvetica,Arial,sans-serif">
  <defs><marker id="b" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#1f6f5c"/></marker></defs>
  <g font-size="10.5">
  <rect x="10" y="10" width="230" height="92" rx="8" fill="#eef5f2" stroke="#1f6f5c"/><text x="20" y="28" font-weight="700" font-size="12" fill="#1f6f5c">Tenancy &amp; people</text><text x="20" y="46">organisations · sites · areas</text><text x="20" y="62">users · memberships (role + site)</text><text x="20" y="78">devices (kiosk tablets, phones)</text><text x="20" y="94">rules_packs · rule_thresholds</text>
  <rect x="265" y="10" width="230" height="92" rx="8" fill="#eef5f2" stroke="#1f6f5c"/><text x="275" y="28" font-weight="700" font-size="12" fill="#1f6f5c">Checklist builder</text><text x="275" y="46">checklist_templates → _versions</text><text x="275" y="62">checkpoints (+ media, translations)</text><text x="275" y="78">checklist_schedules (RRULE)</text><text x="275" y="94">immutable once published</text>
  <rect x="520" y="10" width="230" height="92" rx="8" fill="#fff8ec" stroke="#b7791f"/><text x="530" y="28" font-weight="700" font-size="12" fill="#8a5a12">Compliance record (append-only)</text><text x="530" y="46">checklist_runs · checkpoint_responses</text><text x="530" y="62">corrective_actions</text><text x="530" y="78">day_closures · periodic_reviews</text><text x="530" y="94">shift_handover_notes</text>
  <rect x="10" y="147" width="230" height="92" rx="8" fill="#eef5f2" stroke="#1f6f5c"/><text x="20" y="165" font-weight="700" font-size="12" fill="#1f6f5c">Repairs &amp; maintenance</text><text x="20" y="183">assets (QR) · contractors</text><text x="20" y="199">work_orders → work_order_events</text><text x="20" y="215">statutory_requirements · compliance_items</text><text x="20" y="231">invoices · visitor_log</text>
  <rect x="265" y="147" width="230" height="92" rx="8" fill="#eef5f2" stroke="#1f6f5c"/><text x="275" y="165" font-weight="700" font-size="12" fill="#1f6f5c">Handbook &amp; people records</text><text x="275" y="183">policies → policy_versions</text><text x="275" y="199">policy_acknowledgements</text><text x="275" y="215">staff_certificates · fitness_to_work</text><text x="275" y="231">tip_allocations · harassment_reports</text>
  <rect x="520" y="147" width="230" height="92" rx="8" fill="#eef5f2" stroke="#1f6f5c"/><text x="530" y="165" font-weight="700" font-size="12" fill="#1f6f5c">Allergens</text><text x="530" y="183">suppliers · ingredients</text><text x="530" y="199">ingredient_allergens (14 UK)</text><text x="530" y="215">dishes · dish_ingredients</text><text x="530" y="231">allergen_matrix_versions</text>
  <rect x="10" y="262" width="230" height="80" rx="8" fill="#eef5f2" stroke="#1f6f5c"/><text x="20" y="280" font-weight="700" font-size="12" fill="#1f6f5c">Inspections</text><text x="20" y="298">fhrs_ratings (FSA API)</text><text x="20" y="314">inspections (EHO, pubco, AI mock)</text><text x="20" y="330">inspector_share_links</text>
  <rect x="265" y="262" width="230" height="80" rx="8" fill="#f3f0fa" stroke="#6b5ca5"/><text x="275" y="280" font-weight="700" font-size="12" fill="#4d3f8a">AI &amp; reporting</text><text x="275" y="298">search_chunks (pgvector + FTS)</text><text x="275" y="314">ai_interactions · saved_queries</text><text x="275" y="330">notifications · reporting views</text>
  <rect x="520" y="262" width="230" height="80" rx="8" fill="#f6f7f9" stroke="#5b6575"/><text x="530" y="280" font-weight="700" font-size="12" fill="#333">Shared</text><text x="530" y="298">media (sha256, captured_live)</text><text x="530" y="314">audit_log (hash chain)</text><text x="530" y="330">RLS on every tenant table</text>
  </g>
  <path d="M495 56 L520 56" stroke="#1f6f5c" stroke-width="1.5" marker-end="url(#b)"/>
  <path d="M630 102 L630 128 L125 128 L125 145" fill="none" stroke="#1f6f5c" stroke-width="1.5" stroke-dasharray="4 3" marker-end="url(#b)"/>
  <text x="380" y="122" font-size="10" text-anchor="middle" fill="#1f6f5c" style="paint-order:stroke" stroke="#fff" stroke-width="3">failed check → corrective action → work order (the closed loop)</text>
</svg>

### Core tables by domain

| Domain | Tables | Key design points |
|---|---|---|
| **Tenancy & people** | `organisations`, `sites`, `areas`, `users`, `memberships`, `devices` | `sites.nation` (England/Wales/Scotland/NI) selects the rules pack. `memberships` holds role + optional site scope (NULL = all sites), which supports your Staff / Manager / Admin / Finance roles plus Owner/Area Manager and read-only Inspector. `users.pin_hash` supports kiosk login; email is optional for staff |
| **Rules packs** | `rules_packs`, `rule_thresholds`, `site_threshold_overrides` | Legal thresholds (8°C, 63°C, 82°C reheat in Scotland, cooling times) are **data with a `legal_basis` and a `verified` flag**, versioned and consultant-reviewed. Sites may only set *stricter* house standards |
| **Checklist builder** | `checklist_templates`, `checklist_template_versions`, `checkpoints`, `checkpoint_media`, `checkpoint_translations`, `checklist_schedules` | Your **customisable checkpoints**: any response type (yes/no, temperature, number, photo, signature, select), each with **guidance text and images/videos**. Published versions are immutable, so old records always show the question as it was asked. Schedules use iCal RRULEs and can be paused for closures |
| **Compliance record** | `checklist_runs`, `checkpoint_responses`, `corrective_actions`, `day_closures`, `periodic_reviews`, `shift_handover_notes` | Responses store the value, pass/fail, **frozen threshold snapshot**, capture source (manual, probe, camera OCR), photo, person, device and both timestamps. `day_closures` stores the **end-of-day report**. `periodic_reviews` stores the SFBB 4-weekly review |
| **Repairs & maintenance** | `assets`, `contractors`, `work_orders`, `work_order_events`, `invoices`, `statutory_requirements`, `compliance_items`, `visitor_log` | **The closed loop:** `corrective_actions.work_order_id` and `work_orders.source_response_id` link a failed check to the repair. `compliance_items` is the statutory calendar (gas CP42, TR19, EICR, fire alarm and others) with certificate uploads. `invoices` feeds the **Finance role** and accounting exports |
| **Handbook & people** | `policies`, `policy_versions`, `policy_media`, `policy_acknowledgements`, `staff_certificates`, `fitness_to_work_records`, `tip_allocations`, `harassment_reports` | Publishing a new version triggers re-acknowledgement. Signatures are append-only. The sensitive tables are restricted to owner/admin and never sent to AI |
| **Allergens** | `suppliers`, `ingredients`, `ingredient_allergens`, `dishes`, `dish_ingredients`, `allergen_matrix_versions` | The 14 UK allergens are an enum. AI-suggested allergens need `confirmed_by` before they count. Each published matrix is a frozen, printable snapshot |
| **Inspections** | `fhrs_ratings`, `inspections`, `inspector_share_links` | FHRS ratings are synced from the FSA open-data API. The read-only, time-limited EHO pack link needs no login |
| **AI & reporting** | `search_chunks`, `ai_interactions`, `saved_queries`, `notifications` | Hybrid search: Postgres full-text + pgvector (HNSW index). `search_chunks.visible_to_roles` mirrors permissions. `saved_queries` turns Ask-your-logs questions into scheduled reports |
| **Shared** | `media`, `audit_log` | `media.sha256` detects a reused photo and `captured_live` marks in-app camera shots, both anti-pencil-whipping signals. `audit_log` is a **hash chain**, so any tampering with history is detectable |

**Reporting views** in the schema feed the spreadsheet summary and the Ask-your-logs tools. `v_current_responses` takes the latest correction. `v_daily_site_summary` gives one row per site per day: the manager grid. `v_asset_spend` gives cost per asset for Finance. At scale, materialise these views or move analytics to a read replica.

### Multi-tenancy and permissions

Every tenant table carries `organisation_id`. The API sets `app.org_id` and `app.user_id` per transaction, and **Postgres row-level security** policies filter by organisation and by `visible_site_ids()`, the sites the user's memberships allow. Role checks for actions (who can sign off a corrective action or approve an invoice) live in the API. A shared permission map mirrors the role matrix in the product plan. Because Ask-your-logs tools run under the same database session, **the AI can never see more than the person asking**.

### Retention (to confirm with a solicitor)

| Data | Suggested retention | Basis |
|---|---|---|
| Food-safety records (responses, corrective actions, reviews) | 2 years minimum, configurable up to 6 | SFBB requires the diary to be kept until the next inspection; the longer period is a defence against claims **[unverified]** |
| Holiday and pay-related records | 6 years | ERA 2025 holiday-records duty (from April 2026) |
| Tip allocation records | 3 years | Tipping Act 2023 **[unverified period]** |
| Statutory certificates (gas, EICR, TR19…) | Life of the asset + 2 years | Evidence for insurers and the EHO |
| Fitness-to-work and harassment records | Minimal; reviewed annually | UK GDPR data minimisation |
| AI interaction logs | 12 months | Debugging and audit; trimmed to essentials |

Deletion of personal data (for example a leaver's account) **pseudonymises the user record** rather than deleting it, so compliance records stay intact.

## Trading / EOD finance module (replacing the current form)

Maginhawa's finance team currently uses a single static page on Netlify. It calculates totals in the browser and posts JSON to a **public Power Automate URL**, which appends a row to an **Excel table on SharePoint**. Two further flows look up daily targets in Excel and send emails. A code review of that page found five problems:

- The Power Automate signature is exposed in the page source, and nobody has to log in.
- **Net sales ignores discounts and comps**, even though the form says it includes them.
- Delivery net is hard-coded as `gross ÷ 1.2 × 0.55`, and the wage target is hard-coded at 35%.
- Lunch managers are dropped from the submission.
- Discounts, comps, voids and refunds are flattened into text strings that cannot be analysed.

The new module keeps everything useful in it, including the **23 discount/comp reasons**, the **15 W/NW void codes** and the staff positions, and fixes the rest:

| Area | Old form | New module |
|---|---|---|
| Identity | Typed "Submitted by" / "Approved by" names | Logged-in user; approvers are real users; audit log |
| Calculations | In the browser; net omits discounts | On the server; `net_sales` is a generated column (gross − service charge − tax − discounts); totals in `v_trading_day_summary` |
| Settings | 20% VAT, 55% delivery retention, 35%/30% wage thresholds hard-coded | `site_finance_settings` and `delivery_platforms` per site/platform; `site_targets` per day |
| Line items | Text blobs | `trading_adjustments` rows with `reason_codes`, amounts, approver, time |
| Cash | Warning only; variance not stored | `cash_reconciliations.variance` generated; database refuses a variance without an explanation |
| Delivery | Estimated net only | Estimated net **and** `actual_payout` from platform statements; refunds with status |
| Staff & wages | Names in text; one manual wage figure | `shift_staff` rows (user or name, position, hours, cost); wage cost from rota when integrated |
| Duplicates | Same site and date can be sent twice | `UNIQUE (site_id, business_date)`; drafts saved, then submitted, then approved by finance |
| Maintenance notes | Free text in an email | `trading_feedback.work_order_id` links to a real work order |
| Excel | The only store | Synced copy via **Microsoft Graph** (`integration_connections`, idempotent `outbound_sync_jobs`) |

**Migration (see diagrams 4–6):**

1. **Stage 1:** the app replaces the form and writes the same row into finance's workbook, so Flows 2 and 3 keep working.
2. **Stage 2:** the app becomes the source of truth, with targets imported from Excel and a finance dashboard.
3. **Stage 3:** EPOS, rota and delivery integrations fill the report automatically, and scheduled reports replace the Power Automate emails.

**Immediate action, independent of the app:** regenerate the exposed Power Automate trigger URL.

**Microsoft 365 integration** adds Microsoft Graph (application permissions scoped to the one workbook or site, e.g. `Sites.Selected`) and optional "Sign in with Microsoft" for the finance team. Credentials live in the secret manager and are referenced by `integration_connections.secret_ref`.

## Security, privacy and UK compliance for the platform itself

- **Data location:** host the database, storage and backups in UK (London) regions, with EU fallback documented. Register with the **ICO** as a data controller and publish a DPA and sub-processor list for customers.
- **Certifications:** get **Cyber Essentials** before the first paid customer (pub companies and insurers ask for it). Aim for ISO 27001 in phase 3 for estates and enterprise.
- **Encryption:** TLS everywhere; encryption at rest from the providers. The device SQLite database is encrypted (SQLCipher), and the device can be revoked remotely via `devices.revoked_at`.
- **Backups:** point-in-time recovery on Postgres, plus nightly logical backups to a second UK provider, with restores tested quarterly.
- **Secrets:** API keys (Anthropic, Twilio, Stripe) live only in the server's secret manager, never in apps.
- **Contractor links:** single-use or expiring tokens scoped to one work order.

## Engineering workflow

- **Environments:** local (Supabase CLI + Expo dev client) → staging (London) → production. Each pull request gets a preview of the web console.
- **CI:** GitHub Actions to lint, type-check, run unit tests (Vitest) and database tests (pgTAP for RLS policies, triggers and views), then build the Expo app and the web app.
- **Testing priorities:**
  - the rules engine (threshold edge cases per nation)
  - offline sync conflicts (two devices, same run)
  - RLS isolation between organisations and sites
  - append-only triggers
  - evaluations for AI features: a fixed set of questions and photos with expected answers, re-run whenever prompts or models change
- **Releases:** Expo OTA updates for JavaScript-only fixes, and store releases for native changes. Database migrations use a migration tool (e.g. the Supabase CLI or dbmate), with forward-only migrations.

## Build order mapped to the MVP

| Sprint block (2 weeks each) | Build |
|---|---|
| 1–2 | Monorepo, auth, organisations, sites, memberships, the rules-pack model, the UK template library seeded |
| 3–4 | Checklist builder (desktop), tablet kiosk with PIN, offline sync, responses + server-side pass/fail, photo capture |
| 5–6 | Corrective actions, schedules + auto-close, manager phone app with exception push notifications, end-of-day report, spreadsheet grid + Excel export |
| 7–8 | Assets + QR, fault reports → work orders, contractor SMS links, EHO pack PDF + inspector link |
| 9–10 | Handbook builder, e-signed acknowledgements, staff certificates; AI: snap-to-setup, read-the-thermometer, Ask the handbook |
| 7–10 (parallel track) | **Trading / EOD module**: trading days and sessions, reason codes, cash reconciliation, delivery, staff, targets, Excel sync via Graph (Stage 1), finance dashboard (Stage 2) |
| 11–12 | **Ask your logs** (tools + citations + saved queries), AI end-of-day summary, Stripe billing, Cyber Essentials, pilot launch |

Phase 2 adds the statutory calendar, invoices and Finance exports, the allergen module, EPOS and rota integrations, and Bluetooth probes, in line with the module plan in the product report.

## Decisions to confirm

1. **Supabase or raw AWS.** Supabase is faster to build on now. Raw AWS gives more control for later enterprise deals. Because everything is plain Postgres, moving later is feasible.
2. **PowerSync or custom sync.** PowerSync saves months but is a paid dependency. Prototype it with one tablet in a real kitchen basement before committing.
3. **Embedding provider and dimension.** Anthropic doesn't offer an embeddings model. Choose one (e.g. Voyage AI) and set the `vector(...)` dimension in `search_chunks` to match.
4. **AI data processing terms.** Confirm Anthropic's (or a cloud provider's) processing locations and retention options against UK GDPR expectations before pilots.
5. **Threshold verification.** Every `rule_thresholds` and `statutory_requirements` row starts `verified = false`. A food-safety consultant signs them off before launch.
