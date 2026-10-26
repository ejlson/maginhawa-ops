# Maginhawa Ops: instructions for Claude

This folder is the handoff for an internal restaurant operations app for **Maginhawa** (a London group, 9 sites). The first module is the managers' **end-of-day (EOD) report**.

## Before doing anything
1. Read `HANDOFF.md` in full. It holds the decisions, stack, calculation rules, screens, design language, research, timeline and open questions.
2. For design work, also read `design/design-language.md` and look at `design/eod-canvas/`.
3. For research context, read `research/2026-10-research-findings.md`.

## Hard rules
- **Never reproduce the old Power Automate trigger URL or its signature**, even though it appears in the live Netlify form. Refer to it only as "the exposed trigger URL (to be regenerated)".
- Do not re-open the decisions in `HANDOFF.md` §3 unless the user asks. In particular:
  - SharePoint is the data store; our own Netlify Functions are the back end (no Power Automate, changed 26 Oct 2026).
  - We code our own apps.
  - Managers type the figures in (no EPOS integration in v1).
  - React Router v7 SPA on Vite + TypeScript.
  - The "one dark hero card + Monzo-style lists + Things 3 circles" design.
- Use UK English and £, and keep UK law in mind (Tips Act 2023, Employment Rights Act 2025, UK GDPR).
- All figures in the designs are examples. Never present them as real data.
- Calculations live in one shared, unit-tested `packages/core` module (rules in `HANDOFF.md` §5). Test against the verified example: lunch net £850.00, day total net £2,687.50, wages 29.8%.

## Working with this user
- Keep answers concise, with tables where they help. They like visual previews and PDF/shareable-page deliverables.
- Aim for simple, intuitive and premium. When they dislike something, change only that part and keep what they liked.
- Their supplied "Gena Data Model" PDF was a **format reference only**. It belongs to another project, so don't use its content.

## Likely next tasks
- Update the tech plan PDF so it says React Router v7 rather than Next.js, and Netlify Functions rather than Power Automate.
- Scaffold `apps/eod-web` + `apps/functions` + `packages/core`, with Vitest tests for the calculations.
- Write a SharePoint provisioning script from `docs/tech-plan/sharepoint/sharepoint-lists.json`.
- Design the remaining sections (Dinner, Delivery, Promotions & other, Wages, Tips & service charge, Feedback, Handover) in the established style.
