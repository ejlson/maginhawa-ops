# Research findings, October 2026

Three research passes were run on 12 Oct 2026: UX, the UK market, and competitors. A lot of the evidence is vendor or trade-body material, so treat the numbers as indicative and check primary sources before quoting them externally.

---

## A. UX research

### Form and flow
- **Use a hub of sections, not a strict wizard.** NN/g says wizards suit novice or infrequent tasks; managers close every night. https://www.nngroup.com/articles/wizards/
- **Group questions per screen** for frequent internal users; use a task list with statuses. https://design-system.service.gov.uk/patterns/question-pages/ · https://design-system.service.gov.uk/patterns/complete-multiple-tasks/
- **Fewer fields matter more than fewer steps** (Baymard). https://baymard.com/blog/checkout-flow-average-form-fields
- **Money inputs:**
  - Use `type="text" inputmode="decimal"`, never `type="number"`.
  - Accept and strip "£" and commas.
  - Use tabular numerals.
  - Sources: https://technology.blog.gov.uk/2020/02/24/why-the-gov-uk-design-system-team-changed-the-input-type-for-numbers/ · https://design-system.service.gov.uk/components/text-input/
- **Soft vs hard validation:**
  - Hard errors only for things that are definitely wrong.
  - Warnings should offer "Fix" or "It's right", and the acknowledgement should be logged.
  - Validate on blur; clear errors as soon as they are fixed.
  - Sources: https://baymard.com/blog/validations-vs-warnings · https://www.smashingmagazine.com/2022/09/inline-validation-web-forms-ux/
- **Check-answers page:**
  - Group answers by section, each with a change link.
  - Use a specific submit label.
  - Put warnings first.
  - Source: https://design-system.service.gov.uk/patterns/check-answers/
- **Colour never alone.** Add an icon and words, and announce totals with `role="status"`. https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html · https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html
- **Undo instead of confirm,** except for the final irreversible submit. https://www.nngroup.com/articles/confirmation-dialog/
- **Empty states** should show status and the next action, e.g. "All 9 sites closed on time". https://www.nngroup.com/articles/empty-state-interface-design/

### Devices and people
- **Shared iPad login:**
  - Photo grid of today's rota, then a PIN, with auto-lock and "Not you?".
  - Add a badge/QR alternative to meet WCAG 2.2 3.3.8. https://www.w3.org/WAI/WCAG22/Understanding/accessible-authentication-minimum.html
  - Kiosk pattern references: https://help.connecteam.com/en/articles/6135619-the-kiosk-app
- **Targets:** WCAG asks for at least 24px; aim for 44–64px for wet or gloved hands. https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
- **Offline/sync states:**
  - Saved on device, then sending, then a tick, then "couldn't send, tap to retry".
  - Distinguish "queued" from "received".
  - Source: https://developers.google.com/open-health-stack/design/offline-sync-guideline
- **Dark mode:** follow the system setting. Light mode reads better for most people. https://www.nngroup.com/articles/dark-mode/
- **Plain English** at about reading age 9, with numerals and icons. The workforce is multilingual, so plan translations.

### Dashboards, motivation, AI
- **Exception-first head office view:**
  - Each item shows its threshold, value vs last week/target, owner and an action.
  - Items get resolved states.
  - Thresholds can be set per site.
- **Alert fatigue:** push only missed closes and big cash differences; everything else goes in the 07:00 digest.
- **Charts:** bullet graphs for vs-target, sparklines for trend. https://www.nngroup.com/videos/data-visualizations-dashboards/
- **Streaks backfire when broken** (Silverman & Barasch, JCR 2023). Use "on time X of Y this month" and recognition instead, with no manager-facing leaderboard. https://www.colorado.edu/business/news/2023/04/20/research-streaks-marketing-tech-barasch
- **AI summaries:**
  - Every claim links to its source entry.
  - Say "nothing unusual" when that's true.
  - Rule-style anomaly explanations are preferred.
  - AI actions are drafts that a person confirms; Toast IQ's pattern does this. https://support.toasttab.com/en/article/Toast-IQ-Overview · https://arxiv.org/pdf/2312.10968

---

## B. UK market and compliance

### Labour
- **Employer NICs:** 15% from April 2025, with the threshold down to £5,000.
- **National Living Wage:** £12.21 (Apr 2025), then **£12.71 (Apr 2026)**.
- UKHospitality estimates about £3.4bn extra cost a year. https://www.restaurantonline.co.uk/Article/2025/11/26/national-living-wage-to-increase-by-41-to-1271/
- **Employment Rights Act 2025 (from Apr 2026):**
  - Statutory sick pay from day one.
  - A new duty to keep **holiday records for 6 years**.
  - Source: https://www.bakermckenzie.com/en/insight/publications/2026/04/united-kingdom-new-record-keeping-obligations-for-annual-leave
- **Burnout:** 53% of UK hospitality managers report it (Axonify, 2024). https://cateringtoday.co.uk/news/business/over-50-of-hospitality-managers-say-staff-are-burning-out

### Payments and delivery
- **Cash** was **8% of all UK payments in 2025**. Its share is small, but it is still the riskiest step. https://www.ukfinance.org.uk/news-and-insight/press-release/digital-payments-continue-grow-mobile-wallets-become-more-popular
- **DoorDash completed its Deliveroo takeover** on 2 Oct 2025, so expect term changes. Commission typically runs 15–35%. https://secure.businesswire.com/news/home/20251002060133/en/DoorDash-Completes-Acquisition-of-Deliveroo

### Tips
**Employment (Allocation of Tips) Act 2023**, in force from 1 Oct 2024:
- All tips must be passed on.
- A **written policy** is required.
- **Records must be kept for 3 years.**
- Workers can request their own record.

HMRC's E24 guidance covers tronc and NICs. https://www.gov.uk/guidance/employee-gets-tips-gratuities-or-service-charges-through-a-tronc

### Other rules
- **Making Tax Digital for VAT** requires digital links, so re-keying figures by hand between systems could break it. Check with the accountant.
- **Right to work:** fines are £45k per worker, or £60k for a repeat.
- **Martyn's Law** (Royal Assent Apr 2025): sites holding 200–799 people are in the standard tier, with enforcement around 2027. https://www.footanstey.com/our-insights/articles-news/martyns-law-an-update-following-final-statutory-guidance/

### Technology adoption
- 72% of leaders expect to adopt AI within 12 months; 49% already use it for data and reporting (CGA).
- 37% spend 1–2 hours a day switching between systems (Access Group).

---

## C. Competitors

| Product | What's relevant | Weakness / complaint |
|---|---|---|
| **Restaurant365 DSS** | Till data arrives as a daily summary. Swipeable mobile cards. Must open each section before Complete. Web-only approval; mass review grid | Heavy and hard to learn; re-pulling till data wipes edits |
| **Toast IQ agents** | End-of-day closeout, morning briefing with "one fix for tomorrow", loss prevention, labour running hot. Agents recommend; they don't act | Early access only |
| **Tenzo** (UK) | Daily reports, forecasts, TenzoGPT, and an MCP connector that searches **manager logs and shift notes** | No reviews; from about $600 per user per year |
| **Nory** (UK/IE) | Live P&L, forecasts | "Overpromised"; slow support |
| **7shifts Log Book** | Required categories; daily digest; sales and labour attached | Rolls over at midnight; no drafts |
| **Access EPOS / Trail** | Cash declaration per business date; checklists with photos | Clunky on mobile |
| **Bizimply, Tevalis, Mapal CashRec** | Shift log; cash-up; reconciliation per till | Little detail published |
| **Check65, Jolt, Navitas** | Checklists with Bluetooth probes and overdue alerts | |
| **Crunchtime / Yoobic** | Ops tasks | Opening each store one at a time; Yoobic wants 100+ stores |

**Gaps we can own:**
- Numbers and narrative together.
- Cash by denomination.
- Delivery payout reconciliation (nobody does it).
- Late-night and offline closes.
- Smooth head-office review.
- AI that explains *why* using the manager's notes.
- A good fit for a 9-site group.

**Borrow (high impact, low effort):**
- Required sections and reason codes (R365, 7shifts).
- Late-night business date and drafts.
- Head-office queue with bulk approve (R365).
- Cash count with expected cash (Access, Tevalis).
- Morning digest (Toast, Tenzo).
- Handover categories → repair job (7shifts).
- Photo evidence (Trail).
