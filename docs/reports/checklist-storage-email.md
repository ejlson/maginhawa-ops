**Subject:** How our new checklists will be saved and found (and what I need from you)

Hi [Name],

Quick update on the new checklists in the Maginhawa app. Below I explain where they'll be saved, what you'll see, what I'm doing, and a few things I need from you. You don't need any technical knowledge for this.

**Have a look at the pictures first:** [link to the examples page]
(Every name and number on it is made up, just to show the idea.)

---

### The idea in one line

**Staff fill in checks on a phone or iPad, the app saves them once in SharePoint, and everyone else sees them in the way that suits them.**

```
Staff app  →  SharePoint (the official record)  →  Head office grid
                                                 →  One PDF per day, in each restaurant's folder
                                                 →  A monthly Excel file for each restaurant
                                                 →  An inspection pack for the EHO
```

### What changes for each person

| Who | What they do / see |
|---|---|
| **Kitchen and floor staff** | Open the app, see today's checks in time order, and tick them off. For temperatures they type the reading, and the app says straight away if it's out of range. If it is, they pick what they did about it (and take a photo if needed) before they can move on. No paper, no typing names; they sign in with their own PIN. |
| **Managers** | See their restaurant's day at a glance: what's done, what's late, what's missed. Old days are in the restaurant's folder as PDFs (one per day, with all that day's checklists), plus one Excel file per month. They can open these in the OneDrive or SharePoint app on their phone. |
| **Head office** | One grid of every restaurant and every day. A green dot means done, orange late, red missed and grey not trading. A missed day is never just a blank. |
| **EHO inspector** | We pick the restaurant and dates, and the app makes one PDF covering every check, every problem and its fix, and anything missed or changed. We can show it on the iPad, print it, or send a view-only link that expires. |

### Why we're not just using one big Excel spreadsheet

I looked into this properly. Excel is great for *reading* the data, but not for *saving* it from an app:

- Microsoft doesn't let an app like ours add rows to an Excel file on its own.
- When two people save at the same time, the file locks or one person's answers get lost.
- Anyone with the file could change an old answer, and we couldn't prove what it said before. That matters if we ever need to show an inspector or a court that our checks were real.

So the app saves into **SharePoint lists**. These look and work like a spreadsheet, but they're built for many people saving at once and they keep a history of every change. The app then **makes the Excel files and PDFs for you automatically**, so you still get spreadsheets and folders, and nobody types anything twice.

### The folders you'll see in SharePoint

```
Maginhawa App Checklists
  └ Bunso
      └ 2026-11
          ├ 2026-11-04 Bunso – Wed.pdf
          ├ 2026-11-05 Bunso – Thu – MISSED.pdf
          ├ 2026-11-06 Bunso – Fri.pdf
          └ Bunso – Checklists – Nov 2026.xlsx
  └ Hoxton
  └ …one folder per restaurant

Photos
  └ Bunso
      └ 2026-11
          └ 2026-11-06
              ├ Opening checks
              │   ├ Walk-in chiller – 09:12.jpg
              │   └ Delivery – chicken – 09:40.jpg
              └ Closing checks
                  └ Fryer cleaned – 22:55.jpg
```

Each day's PDF is made automatically after closing and holds all of that day's checklists. A missed day still gets a PDF that says so, so a gap is never just a missing file. The Excel file is rebuilt every night.

Photos live in their own folders, one for each day and checklist, because we keep them for less time than the records. Small copies are also printed in each day's PDF, next to the check they belong to.

These folders are **read-only**. The app fills them in, and nobody needs to save or move files by hand. If a manager corrects a checklist later (they have to give a reason), the PDF is remade and SharePoint keeps the old version.

---

### What I'll do

1. Build the checklist screens in the app (today's list, temperatures with safe ranges, fixes, photos).
2. Set up the SharePoint lists and the "Maginhawa App Checklists" folders, with the right access for each role.
3. Make the app create the PDFs, the monthly Excel files and the inspection pack automatically.
4. Set up the morning and night jobs that mark each restaurant's day as done, late or missed.
5. Test it all on the new SharePoint site before any real checklists go in, clear the test data out, then run a trial at one restaurant before rolling it out.

### What I need from you

| # | What | Why |
|---|---|---|
| 1 | **The checklists each restaurant uses today** (opening, closing, cleaning, deliveries and so on), with every question on them. Photos of the paper sheets are fine. | So the app asks exactly the right questions. |
| 2 | **The safe ranges** for each fridge, freezer, hot-hold and cooking check (for example "chiller 0–5 °C"). | So the app can flag problems straight away. |
| 3 | **What time each check is due** at each restaurant, and the days each one is open or closed. | So late and missed checks are worked out correctly. |
| 4 | **Who does what.** Which roles fill in checks, who can correct one, and who at head office can delete one. | To set the right permissions. |
| 5 | **The usual fixes** for each kind of problem (for example "moved food to another fridge", "called engineer"). | Staff can then tap a fix instead of typing one. |
| 6 | **Which restaurant should go first** for the trial, and a manager there who's happy to give feedback. | A safe first rollout. |
| 7 | **Ask whoever manages our Microsoft 365** whether our licences are *Business Premium* or *E3* (or something else). | It decides how we lock and keep the records. |

### Three decisions for you

- **Who can see which restaurant's folder.** Either each manager sees only their own restaurant, or every manager can read every restaurant. Head office sees everything either way.

- **How long we keep checklist records.** The law doesn't set a number. Based on the time limits for prosecutions and injury claims, I'd suggest **at least 3 years**. Worth checking with our insurer.
- **How long we keep photos.** Either the same as the records, or about **12 months** unless a photo is tied to an incident. Photos can show people, so keeping them for less time is safer under GDPR.

---

If it's easier, we can go through the pictures together on a quick call. Just send me the bits above when you can; numbers 1–3 are the most urgent.

Thanks,
[Your name]
