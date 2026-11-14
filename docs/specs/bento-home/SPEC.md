# Spec: widget (bento) home for staff, supervisors and managers

*13 Nov 2026 · status: agreed in interview, designs next, not built. Design: the canvas "Maginhawa Ops redesign", row "Home · widgets". Follows `design/design-language.md` › Redesign.*

## Why
Today each role's home is a long list. The user wants a home that shows the day at a glance as **widgets in a bento grid**, with everything else one tap away, and that each person can **tailor**.

## Decisions (from the interview)
| Question | Decision |
|---|---|
| Who customises | **Each person.** Head office sets a default layout per role; anyone can show, hide and reorder their own widgets. Saved to their account (on the device in demo mode). "Reset to default" always available. |
| How flexible | **Show, hide and reorder only.** Sizes are fixed by design so the grid always looks tidy. No resizing in v1. |
| Main card | **Depends on role.** Managers and supervisors: tonight's net, close progress and one "Up next". Staff: their checks done today and the next one due. |
| Stock widget | **Count due**, **running low** (with Order per supplier) and **deliveries today** (with Check in). No waste figure. |

## The home, top to bottom
1. **Header** (unchanged): site badge and switcher, search, account.
2. **Main card** (full width, the site's moving gradient). Always first; can't be hidden or moved.
3. **Widget grid**: 2 columns on phones, 4 on desktop and iPad. Fixed sizes: *wide* = 2 columns, *square* = 1.
4. **"Everything" button** at the bottom: opens the full list of every area (grouped Today / Records / Team), including those not shown as widgets. The same screen as **More**, with a **Customise home** button at the top.

## Widgets (v1)
| Widget | Size | Shows | Tap | Roles (default on) |
|---|---|---|---|---|
| Checklists | wide | Done today as a ring (5 of 9), the next due with its time, late or missed count in words | Opens Checks, or the late one | All |
| End of day | wide | Sections done (3 of 8) as Things circles, the next section, net so far | Opens Close the day | Supervisor, manager |
| Stock | wide | Count due and progress; items running low (count + top 2 names) with **Order**; deliveries due today with **Check in** | Opens Stock | Supervisor, manager |
| Recipes | square | Search box and the last 3 opened dishes *(assumed)* | Opens Recipes or that dish | All |
| Food safety | square | Four quick actions: **Log a temperature**, **Check in a delivery**, **Allergens**, **Report a problem** *(assumed)*; a red dot when something failed | Each action goes straight there | All |
| Handover | square | "From last night · not read yet" or "Nothing to read"; **Add to the handover** for anyone | Opens Handover | All (on by default since 14 Nov 2026) |
| Repairs | square | Open and urgent counts (supervisors and up); **Report a problem** for everyone | Opens Repairs | All (on by default since 14 Nov 2026) |

Widgets only offer what the person's role can use (`can` in `lib/auth`): staff never get End of day; Repairs shows "Report a problem" for staff.

## Customising
- **Customise home** (from Everything, or long-press / ⋯ on any widget) puts the grid in edit mode: widgets jiggle slightly, each gets a – (hide) badge, and drag handles reorder. A tray below lists hidden widgets with a + to add.
- **Done** saves; **Reset to default** restores the role's layout. Undo toast after hiding.
- Stored per person: `homeLayout: { order: WidgetId[]; hidden: WidgetId[] }`. Demo: localStorage `mgh.home-layout.v1.<person>`. Connected: a column on the Staff list (`HomeLayout`, JSON), read with the person's access.
- Defaults per role live in `packages/core` (`DEFAULT_HOME[role]`) with tests; head office can override them later (not in v1).

## Motion and look
- Widgets: `--side` panels, 28px continuous corners, soft shadows, no gradients (only the main card has one). Status always in words, green/amber/red only for status, site colour on rings and circles.
- Entry: widgets rise in, 30–40 ms apart (max 6). Edit mode: a gentle 2° wiggle; drag lifts with a 1.03 scale and soft shadow. Reduce motion: no wiggle or lift, fades only.

## Not in v1
Resizing widgets; head office editing role defaults in the app; widgets for head office's own home; live updating of other people's changes.

## Done means
Typecheck and tests pass (core defaults, layout save/restore, role filtering, edit mode), and the home is checked in the browser on phone and desktop for each role.
