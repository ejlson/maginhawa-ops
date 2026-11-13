# Cloudflare hosting and email sign-in: plan

*Status: planned 12 Nov 2026 (Pages chosen over Workers the same day for the domain), not built. Replaces two earlier decisions (HANDOFF §3 #3 and #9) at the user's request.*


## Built so far (12 Nov 2026)

| Part | Where | State |
|---|---|---|
| Email code sign-in (codes, sessions, kitchen iPad, sign out, limits) | `apps/functions/src/sign-in.ts` | Built, 29 tests |
| One router for every `/api/*` route (replaces the 9 Netlify functions) | `apps/functions/src/api.ts`, Pages entry `apps/eod-web/functions/api/[[path]].ts` | Built; existing tests pass through it |
| Timed jobs Worker | `apps/functions/src/jobs.ts`, `worker/jobs.ts`, `wrangler.jsonc` | Built, not deployed |
| KV instead of Netlify Blobs | `kvVersionIndex`, `kvCounters` | Built |
| Sign-in screens (email → code) | `apps/eod-web/app/routes/sign-in.tsx`, `lib/session.ts` | Built; on with `VITE_SIGN_IN=email` |
| Practice mode with email sign-in | `VITE_SIGN_IN=email npm run dev:shared`: any email, code printed in the terminal | Built |
| Cloudflare Pages project `maginhawa-app` | Cloudflare account info@mgnhw.com | Created, empty. Test builds go to the `dev` branch only, after Access is on |
| Still to do | SharePoint store (Graph), Graph sendMail, kitchen iPad screen, `SignInLog` / `Devices` writes, KV namespace | Not started |

## In one line

The app moves from Netlify to **Cloudflare Pages**, with one small **Cloudflare Worker** for the timed and slow jobs. It runs at `app.mgnhw.com`, so the email DNS doesn't move. People sign in with **any email address on the Staff list, proved with a 6-digit code**, instead of a Microsoft work account. SharePoint stays the only record.

## What changes and what stays

| Part | Before | Now |
|---|---|---|
| Web app (React Router SPA) | Netlify | **Cloudflare Pages**, at `app.mgnhw.com` through one CNAME record at the current DNS provider |
| Back end (9 functions) | Netlify Functions | **Pages Functions**, under `/api/*` |
| Timed jobs (nightly snapshot, nightly forecast, email retry every 15 minutes, checklist morning and night jobs) | Netlify `schedule` | **Cron Triggers on a separate jobs Worker** (Pages can't run timed jobs) |
| Slow work (`Responses_{yyyy}` writer, day PDFs, monthly Excel) | Netlify background functions | **Cloudflare Queues.** Pages adds the job to the queue and the jobs Worker does it (Pages can't process a queue) |
| Fast shared cache (report versions, access cache) | Netlify Blobs | **Workers KV** |
| User sign-in | Entra ID (MSAL), Microsoft work accounts | **Our own email code sign-in.** Any verified email, but only if it's on the Staff list |
| Shared kitchen iPad | Rota photo grid + 4-digit PIN | **Unchanged.** The iPad is signed in once by a manager, then staff use their PIN |
| Record store | SharePoint lists and libraries | **Unchanged** |
| Back end's access to SharePoint | Entra app registration, `Sites.Selected` | **Unchanged.** Already registered on 12 Nov 2026 ("Maginhawa App") |
| Emails (EOD summary, sign-in codes) | Graph `sendMail` from a shared mailbox | **Unchanged route, one new use:** sign-in codes are sent the same way |
| Power Automate add-on (FlowOutbox) | Optional | **Unchanged** |

**Entra ID stays, but only behind the scenes.** The app registration is the back end's key to SharePoint and to the shared mailbox. Nobody signs in with it.

## Sign-in design

### Who can sign in

- **Invite only.** A person can sign in only if an **active row on the Staff list** has their email. Head office or a manager adds the person and their email in the app (People → Add person). Any provider works: Gmail, iCloud, Outlook or work email.
- **Proving the email.** The first code they type in proves the address. The Staff row then records `EmailVerifiedAt`.
- **Staff who only use the kitchen iPad don't need an email.** They need a PIN only. This matches how the Staff list already allows "kiosk-only staff".
- **Role and sites still come from the Staff list,** never from the browser. That logic already exists (`apps/functions/src/access.ts`).

### The sign-in steps

1. The person types their email and taps **Send code**.
2. If the email belongs to an active Staff row, the server emails a 6-digit code from the shared mailbox. The screen says the same thing either way ("If this email is on the team, a code is on its way"), so it never reveals who works there.
3. The person types the code. The server checks it and sets a session cookie.
4. They stay signed in on that device for **30 days**. Each visit extends this, up to 90 days at most, after which they enter a new code.

**Codes, not links.** On an iPhone, a link in an email opens Safari, not the installed app (PWA). A code works in any app and on any device.

### Kitchen iPad

1. A manager signs in on the iPad with their own email code, then taps **Use as kitchen iPad for Bunso**.
2. The iPad gets a **device session** for that site only, lasting 90 days. Managers can see it and turn it off under People → Devices.
3. Staff then pick their photo and enter their PIN for each sign-off, as already designed (`packages/core/src/pin.ts`).

### Security settings

| Setting | Value |
|---|---|
| Code | 6 digits, random, stored only as a hash in KV, expires in **10 minutes**, works once |
| Wrong tries | 5 per code, then a new code is needed |
| Code requests | At most 3 per email per 15 minutes and 20 per network address per hour (Workers Rate Limiting or KV counters) |
| Session | Signed cookie (HMAC key held as a Cloudflare secret): `HttpOnly`, `Secure`, `SameSite=Lax`, holds the staff id and expiry only |
| Changes from other sites | Every `POST` is checked against the app's own address (Origin check), on top of `SameSite` |
| Leavers and role changes | The server re-reads the Staff row at least every 5 minutes (`ACCESS_TRUST_MS`), so a leaver is locked out within 5 minutes |
| Sign out everywhere | A `SessionsValidAfter` time on the Staff row. Changing it ends every session that started earlier |
| Changing someone's email | Only head office or their manager can do it. It ends their sessions, and the new address must be proved with a code |
| Audit | Sign-ins, failed codes, device enrolments and sign-outs go to a new `SignInLog` list (kept 12 months) |

### UK GDPR

- **Email addresses are personal data.** A personal Gmail is fine, but the privacy notice must say why we hold it (sign-in and app emails only). Staff must also be able to use a work address instead. Don't make a personal email a condition of the job.
- **No new processor** if codes go out through Microsoft 365, which is what's planned. A provider such as Resend or Postmark would need adding to the processor list.

## Options considered for sign-in

| Option | Verdict | Why |
|---|---|---|
| **Our own email code sign-in on the Worker** | ✓ Recommended | No per-user fee and no new company handling staff data. Fits the existing access check (`identify` → email → Staff row). Works with the PIN iPad |
| Cloudflare Access with one-time PIN | ✗ | Free only up to 50 users. You already have 60 Microsoft users plus kitchen staff, and it's $7 per user per month beyond that. It guards the whole site but knows nothing about our roles |
| Hosted sign-in service (Clerk, Auth0, Supabase Auth) | Fallback | Works, but it's another company holding staff emails (a GDPR processor), a monthly cost as staff numbers grow, and another dashboard to look after |
| Microsoft work accounts (Entra ID) | ✗ User's decision | Not every staff member has, or should need, a Microsoft account |

## Hosting details

```
Cloudflare Pages    app.mgnhw.com      the app + /api/*   (sign-in, saving, reading)
        │  puts slow work on a queue
        ▼
Cloudflare Worker   "maginhawa-jobs"   no web address: Cron Triggers + queue jobs
        │                              (nightly jobs, day PDFs, monthly Excel, answer rows, email retry)
        ▼
SharePoint "Maginhawa App" site
```

- **Two deploy targets from one codebase.** Both use the handlers in `apps/functions`. Pages calls them from `functions/api/[[path]].ts`, and the Worker from its `scheduled()` and `queue()` handlers. The two share the KV namespace and the queue.
- **Domain:** `app.mgnhw.com` is added as a custom domain on the Pages project, with a **CNAME** to `<project>.pages.dev` at whoever runs mgnhw.com DNS today. Microsoft 365 email records are untouched. (Only the bare `mgnhw.com` would need its DNS moved to Cloudflare, and we don't need that.)
- **Plan:** Workers Paid, about **$5 a month**. It covers Pages Functions too, and Queues and the longer limits need it.
- **Limits** (Pages Functions are billed and limited as Workers):
  - **CPU time:** 30 seconds by default. The jobs Worker can raise it to 5 minutes for PDFs. Waiting on SharePoint doesn't count.
  - **SharePoint calls:** 10,000 per request by default.
  - **Free plan:** only 50 calls and 10 ms, so it isn't enough.
- **Node code:** Turn on `nodejs_compat` on both, and check the PDF and Excel tools on the jobs Worker:
  - **PDFs:** pdf-lib is known to work. PDFKit needs testing.
  - **Excel:** test ExcelJS first, with a lighter writer as the fallback.
- **Previews:** each branch gets its own Pages preview address. Previews get no SharePoint secrets, so they run in practice mode.
- **Trade-off:** Cloudflare puts new features into Workers first. Pages is still supported, and everything here works on it. If we move later, the handlers don't change; only the wrappers do.

## Code changes (when we build)

| Area | Change |
|---|---|
| `apps/functions` | Move from `netlify/functions/*` to Pages Functions (`functions/api/[[path]].ts` with a small router) plus a `jobs` Worker for cron and queue work. The handlers already take a standard `Request` and return a `Response`, so they move as they are |
| `src/access.ts` | Replace the Entra token check in `identify()` with a session-cookie check. The Staff list lookup stays the same |
| New: `src/sign-in.ts` | Send code, check code, sign out, sign out everywhere, kitchen iPad enrolment. Unit tests for expiry, retries, rate limits and leavers |
| `src/version-index.ts` | Netlify Blobs → KV, behind the same interface |
| Scheduled jobs | `email-retry`, `nightly-snapshot` and `nightly-forecast` move to Cron Triggers on the jobs Worker |
| `src/dev-shared.ts` | Practice mode stays. It must refuse to run on the deployed production site, as it does on Netlify now; previews may use it |
| `apps/eod-web` | Replace the demo picker and the planned MSAL with: email screen → code screen → app. `auth-provider.tsx` reads the session from `/api/me`. The PIN screens stay |
| `packages/core` | `Person` gets `emailVerifiedAt` and `sessionsValidAfter`. "Entra object id" fields become our own `StaffId` |
| SharePoint spec | Staff: `Email` becomes "any verified email", plus `EmailVerifiedAt` and `SessionsValidAfter`. Every `*ById` column that says "Entra object id" becomes "Staff id". New `SignInLog` and `Devices` lists |
| Config | `wrangler.jsonc` for the Pages project (KV, queue producer) and for the jobs Worker (KV, queue consumer, Cron).  Secrets set on both: Secrets: `ENTRA_TENANT_ID`, `ENTRA_CLIENT_ID`, `ENTRA_CLIENT_SECRET`, `SHAREPOINT_SITE_ID`, `MAIL_FROM`, `SESSION_SECRET` |
| Docs | HANDOFF §3 and §4, the tech plan, the team email ("on Netlify" → "on Cloudflare") |

## Order of work

1. **Microsoft side.** Partly done: the app is registered and the site is created. Still to do:
   - give the app access to the site (Graph Explorer);
   - add `Mail.Send`, limited to the shared mailbox with Exchange RBAC for Applications. Remove the organisation-wide Mail.Send grant afterwards, otherwise the limit doesn't apply.
2. **Cloudflare account.** Create it and choose the Workers Paid plan. Create the Pages project and the jobs Worker, add the secrets to both, and add the `app.mgnhw.com` CNAME at the current DNS provider.
3. **Move hosting.** Same features, same practice mode. Check every existing test still passes.
4. **Email sign-in.** Server first, with tests, then the screens. Then kitchen iPad enrolment.
5. **SharePoint setup script.** Create the lists, including the new Staff columns and `SignInLog`, then run the tenant tests on the empty site.
6. **Trial at one restaurant.**

## Decisions needed

| # | Question | My suggestion |
|---|---|---|
| 1 | Which address does the app use? | `app.mgnhw.com`, via a CNAME at the current DNS provider. Use `<project>.pages.dev` until that's added |
| 2 | Which mailbox sends the codes? | A shared mailbox such as `ops@mgnhw.com` (free in M365, no licence) |
| 3 | Can kitchen-iPad-only staff have no email? | Yes: PIN only |
| 4 | How long do people stay signed in? | 30 days, extended on each visit, 90 days at most. Kitchen iPad 90 days |
| 5 | Who can add people and their emails? | Managers for their own restaurant, head office for all (matches `can.managePeople`) |

## Tests before go-live

- A code email reaches Gmail, iCloud and Outlook inboxes, not junk. Check SPF, DKIM and DMARC on the sending domain.
- Mail.Send is truly limited to the shared mailbox (`Test-ServicePrincipalAuthorization`).
- The PDF and Excel tools run on Workers under the CPU limit.
- A leaver is locked out within 5 minutes.
- The PIN still works offline on the kitchen iPad.

## Sources

- [Cloudflare: Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [5-minute CPU](https://developers.cloudflare.com/changelog/post/2025-03-25-higher-cpu-limits/), [subrequest limit raised, Feb 2026](https://developers.cloudflare.com/changelog/post/2026-02-11-subrequests-limit/)
- [Cloudflare: Workers best practices (Cloudflare favours Workers for new projects; Pages is still supported)](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/), [Migrate from Pages to Workers](https://developers.cloudflare.com/workers/static-assets/migration-guides/migrate-from-pages/) (for later, if needed)
- [Cloudflare Pages: custom domains](https://developers.cloudflare.com/pages/configuration/custom-domains/) (a subdomain can use a CNAME at another DNS provider)
- [Cloudflare Access](https://www.cloudflare.com/en-gb/sase/products/access/) (free to 50 users, $7 per user per month after)
- [Microsoft: RBAC for Applications in Exchange Online](https://learn.microsoft.com/en-us/exchange/permissions-exo/application-rbac)
