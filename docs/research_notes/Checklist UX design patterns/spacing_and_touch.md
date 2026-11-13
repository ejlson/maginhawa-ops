# Spacing, touch targets, type and list design for a premium, minimal mobile/tablet ops app

Scope: general UI guidance with concrete numbers that a designer can apply to the Maginhawa EOD/checklist app (one dark hero card, Monzo-style lists, Things 3-style completion circles). Researched 9 Nov 2026.

Source note: Apple HIG figures were read from Apple's own HIG JSON data (developer.apple.com/tutorials/data/...), which is the source text behind the HIG pages. The m3.material.io pages render client-side and could not be read, so Material type values come from Google's own `material-web` token files on GitHub. Items marked "(not fetched this session)" are well-established primary references whose URLs are given but whose text was not re-read during this research. Treat them as needing a quick check before quoting.

## 1. Touch target minimums, spacing, and one-handed / gloved / wet use

### Takeaway
Use **44 × 44 pt/CSS px as the floor for every tappable thing** (Apple default, WCAG AAA), **48 px for primary actions and completion circles** (Material), and never go below WCAG 2.2 AA's 24 px even for tertiary icons. Spacing matters as much as size: about 8–12 px between bezelled controls, and bigger targets with more spacing at the top and bottom edges of the screen than in the centre.

### Cited Findings
- **WCAG 2.2 SC 2.5.8 Target Size (Minimum), Level AA:** pointer targets must be at least **24 × 24 CSS px**. The exceptions are spacing (a 24 px diameter circle centred on each target does not intersect another target or its circle), an equivalent control elsewhere, inline text links, user-agent controls, and essential presentation. — [W3C Understanding 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)
- **WCAG SC 2.5.5 Target Size (Enhanced), Level AAA:** uses **44 × 44 CSS px** as the threshold. W3C suggests aiming for it on important links and controls. — [W3C Understanding 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)
- **Apple HIG, iOS/iPadOS:** default control size **44 × 44 pt**, minimum **28 × 28 pt**. watchOS is 44/28, visionOS 60/28, macOS 28/20 and tvOS 66/56. — [Apple HIG Accessibility (data)](https://developer.apple.com/tutorials/data/design/human-interface-guidelines/accessibility.json)
- **Apple HIG spacing:** about **12 pt of padding around elements with a bezel** and about **24 pt around the visible edges of elements without a bezel**. HIG says "spacing is as important as size" for avoiding mis-taps. — [Apple HIG Accessibility (data)](https://developer.apple.com/tutorials/data/design/human-interface-guidelines/accessibility.json)
- **Apple developer forum:** "as a general rule, a button needs a hit region of at least 44x44 pt — in visionOS, 60x60 pt". — [Apple Developer Forums](https://developer.apple.com/forums/thread/739201)
- **Material / Android:** minimum touch target is **48 × 48 dp**. This came from search-result summaries because m3.material.io could not be rendered. Confirm it on [Material 3 accessibility: designing](https://m3.material.io/foundations/designing/structure).
- **Hoober, thumb and position accuracy:** in the centre of the screen, targets can be spaced "as close as **7 mm**, on center". At the **top and bottom edges** they should be larger and spaced **10–12 mm** apart. The sides are slightly harder to hit, so prefer full-width list rows to small side icons or checkboxes. — [Hoober, UXmatters 2013, "Design for fingers and thumbs instead of touch"](https://www.uxmatters.com/mt/archives/2013/11/design-for-fingers-and-thumbs-instead-of-touch.php)
- **Hoober, how people hold phones:** of 780 observed touches (1,333 observations in all), **49% were one-handed** (67% right thumb), **36% cradled** and **15% two-handed**. Hoober later said the "thumb reach" drawings were a mistake: people touch the **centre** of the screen faster, more accurately and by preference than the corners or edges. — [Hoober, UXmatters 2013, "How do users really hold mobile devices?"](https://www.uxmatters.com/mt/archives/2013/02/how-do-users-really-hold-mobile-devices.php)
- **Comfort-zone accuracy:** a Springer study found mean accuracy in the comfort zone significantly higher than elsewhere on the screen. The per-slot minimum sizes were not readable in the excerpt. — [Springer, HCII 2013 chapter](https://link.springer.com/content/pdf/10.1007/978-3-642-39241-2_6.pdf)

### Inferences
- **Completion circles:** draw the circle at about 22–26 px but make the hit area at least 44 × 44, and ideally the whole row (48–56 px tall). This matches Apple's point that the glyph can be smaller than the hit region, and Hoober's advice to prefer list rows at the screen sides.
- **Primary bottom action** ("Submit report", "Next section"): full width, at least 48–52 px tall. It sits in the bottom-edge zone, which needs larger targets (10–12 mm, about 40–48 pt) and more clearance.
- **Destructive or low-frequency actions:** keep them away from the primary button and out of the easiest-to-hit zone. Put them behind a confirmation sheet.
- **Gloved, wet or greasy hands in a kitchen:** these push towards the larger end of every range. Use 48–56 px rows, no adjacent small icons, and swipe gestures only as shortcuts, never as the only way to do something.

### Gaps
- I found no primary study giving numeric targets for **gloved or wet-finger** use on capacitive screens. The adjustment above is reasoned from edge-zone data, not measured.
- Material 3's exact touch-target wording could not be read from m3.material.io (client-rendered).

## 2. Spacing systems, list row heights, section spacing, and grouping

### Takeaway
Use a **4 px base with 8 px steps** (4, 8, 12, 16, 24, 32, 48). Inside a component, use 4–12 px. Between components and sections, use 24–48 px. Use 16 px side gutters on phones. List rows are **44 pt minimum (iOS)** and **56 / 72 / 88 px** for one-, two- and three-line rows (Material). Group with proximity and whitespace first, then with inset grouped cards, and use hairline dividers only inside a group.

### Cited Findings
- **Material list heights:** one-line rows **56 dp**, two-line **72 dp** and three-line **88 dp**. These were confirmed through Material-derived component libraries; Google's own Android docs give the line caps but not the heights in the excerpt seen. — [Material-inspired component library list README](https://app.unpkg.com/material-inspired-component-library@1.2.2/files/components/list/README.md); [Material Components Android List.md](https://gitea.com/784622644/material-components-android/src/branch/master/docs/components/List.md)
- **Material units:** dp and sp are density-independent units used to keep layouts consistent across screens. — [Android Developers: grids and units](https://developer.android.google.cn/design/ui/mobile/guides/layout-and-content/grids-and-units?hl=zh-tw)
- **Apple:** respect safe areas, system margins and layout guides. System layout guides "limit text width for readability". Full-screen backgrounds should extend under toolbars and tab bars. — [Apple HIG Layout (data)](https://developer.apple.com/tutorials/data/design/human-interface-guidelines/layout.json)
- **Apple:** place the most important items near the top and leading side, since people read top to bottom and leading to trailing. — [Apple HIG Layout (data)](https://developer.apple.com/tutorials/data/design/human-interface-guidelines/layout.json)
- **NN/g forms:** "Visually group related labels and fields", and "avoid ambiguous spacing, where labels are equidistant from multiple fields." The second rule is proximity in practice: a label should sit nearer its own field than the field before. — [NN/g, Website Forms Usability](https://www.nngroup.com/articles/web-form-design/)

### Inferences
- **Suggested scale for this app:** 4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48.
  - Row padding: 12–16 px vertical and 16 px horizontal.
  - Icon-to-text gap: 12 px.
  - Gap between grouped cards: 24 px.
  - Section header to its list: 8 px.
  - Hero card to first section: 24–32 px.
- **Row heights:** 56 px for single-line checklist rows (Material one-line, and over 44 pt) and 64–72 px for title plus subtitle rows.
- **Monzo-style lists:** inset rounded group containers, with 1 px hairline dividers inset to the text start and no divider after the last row. That gives three levels of separation (whitespace, then card, then hairline) without heavy borders.
- **Macro and micro spacing:** generous macro whitespace (24–48 px between sections) creates the "premium" feel. Tight micro spacing (4–8 px between a label and its value) keeps figures readable at a glance.

### Gaps
- I found no first-party Monzo, Linear or Things spacing specs. The third-party "Monzo design system" pages (for example skills.cat and webdesignhot) contradict each other on grid base (4 px or 5 px) and brand colours, so they are **not reliable**. See [webdesignhot Monzo](https://www.webdesignhot.com/design.md/monzo/).
- Apple's iOS list (inset grouped) row metrics and margins (16 pt on iPhone, 20 pt on larger widths) come from general knowledge and are not cited here.

## 3. Type scales, minimum sizes, tabular numerals and line length

### Takeaway
Adopt an iOS-like scale: 34 / 28 / 22 / 20 / 17 / 15 / 13 / 12 px with body text at **17 px** (16 px is acceptable on the web). Never go below **11 px**, and keep helper text at 13 px or more in practice. Use **tabular numerals** for every £ figure and percentage so columns line up and numbers do not shift as they change.

### Cited Findings
- **iOS Dynamic Type at the default "Large" setting (size / leading in pt):**

  | Style | Size / leading |
  |---|---|
  | Large Title | 34 / 41 |
  | Title 1 | 28 / 34 |
  | Title 2 | 22 / 28 |
  | Title 3 | 20 / 25 |
  | Headline (semibold) | 17 / 22 |
  | Body | 17 / 22 |
  | Callout | 16 / 21 |
  | Subhead | 15 / 20 |
  | Footnote | 13 / 18 |
  | Caption 1 | 12 / 16 |
  | Caption 2 | 11 / 13 |

  **Default size is 17 pt and minimum is 11 pt** on iOS and iPadOS. — [Apple HIG Typography (data)](https://developer.apple.com/tutorials/data/design/human-interface-guidelines/typography.json)
- **Material 3 type scale (size / line height, 1 rem = 16 px):**

  | Group | Large | Medium | Small |
  |---|---|---|---|
  | Display | 57 / 64 | 45 / 52 | 36 / 44 |
  | Headline | 32 / 40 | 28 / 36 | 24 / 32 |
  | Title | 22 / 28 | 16 / 24 | 14 / 20 |
  | Body | 16 / 24 | 14 / 20 | 12 / 16 |
  | Label | 14 / 20 | 12 / 16 | 11 / 16 |

  — [material-web typescale tokens](https://raw.githubusercontent.com/material-components/material-web/main/tokens/versions/v0_192/_md-sys-typescale.scss)
- **Contrast thresholds by text size** (used by Apple's Accessibility Inspector): **4.5:1** for text up to 17 pt, **3:1** for 18 pt and above, and **3:1** for bold text. — [Apple HIG Accessibility (data)](https://developer.apple.com/tutorials/data/design/human-interface-guidelines/accessibility.json)
- **Tabular figures:** CSS `font-variant-numeric: tabular-nums` gives each digit the same width. — [MDN font-variant-numeric](https://developer.mozilla.org/en-US/docs/Web/CSS/font-variant-numeric) (not fetched this session)
- **Line length:** Apple's layout guides "limit text width for readability". — [Apple HIG Layout (data)](https://developer.apple.com/tutorials/data/design/human-interface-guidelines/layout.json)

### Inferences
- **Hero card figure** (for example day total net): 34–40 px semibold with tabular numerals.
- **Section titles:** 20–22 px.
- **Row titles:** 17 px.
- **Row secondary text and helper text:** 13–15 px.
- **Avoid 11–12 px** for anything a manager has to read at a glance.
- **Tablet:** keep the same scale but cap content width at about 600–680 px, or use two columns. Do not stretch lists across the screen.
- **Text scaling:** support browser and OS text scaling by using rem units, and test at 200% (WCAG 1.4.4).

### Gaps
- I did not retrieve a primary figure for ideal characters per line (the common 45–75 characters range comes from typographic convention). Apple's guidance is qualitative.
- Apple's guidance on tabular or monospaced digits was not in the part of the typography page I read.

## 4. Information density and glanceability for frontline workers

### Takeaway
Use **comfortable density for data entry and checklists** (56 px rows, one decision per row) and keep **compact density for read-only review screens** (head office, history). Glanceability comes from one hero number, short labels and status shown by position and shape, not from packing in more rows.

### Cited Findings
- People touch the centre of the screen most often, fastest and most accurately. The edges need larger targets and spacing. — [Hoober, UXmatters 2013](https://www.uxmatters.com/mt/archives/2013/11/design-for-fingers-and-thumbs-instead-of-touch.php)
- Text fields should be about the size of the expected input, and fields that are too short hide entries users need to check. — [NN/g, Website Forms Usability](https://www.nngroup.com/articles/web-form-design/)
- Material defines one-, two- and three-line list densities, each with a fixed maximum number of text lines. — [Material Components Android List.md](https://gitea.com/784622644/material-components-android/src/branch/master/docs/components/List.md)

### Inferences
- **Managers at close of service** (tired, standing, possibly one-handed): a comfortable density is the right default.
- **Optional compact mode:** offer it only on tablet review screens. Material 3's density tokens use negative 4 px steps, but this was not verified this session.
- **One idea per row:** show the label on the left, and the value or status circle on the right.

### Gaps
- I found no primary research on density for hospitality or frontline workers specifically. NN/g's density articles were not fetched this session.

## 5. Status: colour plus icon plus text, dark mode contrast, and bright environments

### Takeaway
Never use colour alone. Pair every status colour with a **shape or icon and a word** (for example a filled circle with a tick and "Done", or an amber triangle with "Check"). Meet **4.5:1 for text** and **3:1 for icons, borders and focus rings**, in **both** light and dark themes.

### Cited Findings
- **Apple:** "Convey information with more than color." Red/green and blue/orange pairings are hard for colour-blind users. Use distinct shapes or icons; Apple's example is a green circle with a tick next to a red octagon with an X. — [Apple HIG Accessibility (data)](https://developer.apple.com/tutorials/data/design/human-interface-guidelines/accessibility.json)
- **Apple:** if you support Dark Mode, check contrast in both appearances. When the system Increase Contrast setting is on, provide a higher-contrast colour scheme, and prefer system colours that adapt automatically. Apple also mentions APCA as an alternative contrast model. — [Apple HIG Accessibility (data)](https://developer.apple.com/tutorials/data/design/human-interface-guidelines/accessibility.json)
- **NN/g:** "Errors should be signaled through a variety of cues, not solely through color", for example an outlined field, red text and heavier type. — [NN/g, Website Forms Usability](https://www.nngroup.com/articles/web-form-design/)
- **WCAG 1.4.1 Use of Color (A):** colour must not be the only visual means of conveying information. **WCAG 1.4.11 Non-text Contrast (AA):** UI components and graphical objects need 3:1 contrast. — [W3C Understanding 1.4.1](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html); [W3C Understanding 1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html) (not fetched this session)

### Inferences
- **Completion circle states:**
  - Empty: an outline at 3:1 or more against the surface.
  - Done: filled with a tick glyph.
  - Flagged: a different shape (triangle or "!"), plus a text label in the row.
- **Dark hero card:** check that secondary text (often grey at about 60% opacity) still reaches 4.5:1. Muted greys on near-black often fail.
- **Bright kitchens or front-of-house daylight:** offer a light theme by default for entry screens, or follow the OS setting. Avoid relying on subtle tints.

### Gaps
- I found no primary study of screen legibility in bright ambient light. The advice above is reasoned from contrast rules.

## 6. How Things 3, Monzo, Linear, Apple Reminders and Apple Health handle checklists, progress, completion, sheets and bottom bars

### Takeaway
Primary design write-ups from these companies are scarce. The only first-party evidence I found is from Cultured Code: animation should convey information, and it should not feel tiresome when repeated. Treat third-party breakdowns as illustrative only. For bottom bars and sheets, apply the safe-area rules.

### Cited Findings
- **Cultured Code (Things):** its features page describes the Magic Plus button as adding "some magic to every interaction", and dragging it to insert to-dos or headings. — [Cultured Code, Things features](https://culturedcode.com/things/features/)
- **Cultured Code interview (2017, Chinese):** the CEO said the team uses animation to convey information and clarify actions, and that animation which quickly feels tiresome is unnecessary. — [sspai interview](https://sspai.com/post/39724)
- **Third-party analysis of Things 3 completion:** the circle fills, a tick appears, then the row slides away, with a soft sound. The analysis frames this as a reward. This is an outside interpretation and its timings are not verified. — [Blake Crosley design study](https://blakecrosley.com/blog/design-study-things)
- **Launch reviews** praised Things 3's restraint and delight, including Magic Plus. — [MacStories review](https://www.macstories.net/reviews/things-3-beauty-and-delight-in-a-task-manager/)
- **Apple:** respect safe areas so system UI and hardware features (Dynamic Island, home indicator) do not cover controls, and extend backgrounds under bars. — [Apple HIG Layout (data)](https://developer.apple.com/tutorials/data/design/human-interface-guidelines/layout.json)
- **On the web:** pad sticky footers with `env(safe-area-inset-bottom)`, together with `viewport-fit=cover`. — [MDN env()](https://developer.mozilla.org/en-US/docs/Web/CSS/env) (not fetched this session)

### Inferences
- **Completion animation:**
  - Fill the circle and draw the tick in about 200–300 ms.
  - Keep the completed row in place, dimmed, rather than removing it. An end-of-day checklist is also an audit record, so managers should still see what they ticked.
  - Respect `prefers-reduced-motion`.
- **Sticky footer:** one primary action, with a 16 px gutter, 48–52 px height, 12 px top padding and bottom padding of max(12 px, safe-area inset). Add a subtle top hairline or blur only when content scrolls under it.
- **Sheets:** use them for focused sub-tasks (edit one figure, add a note). Keep the main action inside the sheet within thumb reach at the bottom.

### Gaps
- I found no first-party design write-ups from **Monzo**, **Linear**, **Apple Reminders** or **Apple Health** on list spacing, completion animation or progress rings. The third-party "Monzo design system" sites disagree with one another and are unreliable.
- Things 3's exact animation timings are not published by Cultured Code.

## 7. Form design: single column, labels, inline validation, errors, masks and numeric keyboards

### Takeaway
Use a **single column with labels above the fields** and no placeholder-as-label. **Validate when the user leaves a field** (or once a fixed-length entry is complete), clear errors as soon as the input becomes valid, and show positive confirmation. For £ figures, use `<input type="text" inputmode="decimal">`, **not** `type="number"`. Error messages should be specific and say what to do.

### Cited Findings
- **NN/g:** use a single column, because "multiple columns interrupt the vertical momentum". Short related fields may share a row. — [NN/g, Website Forms Usability](https://www.nngroup.com/articles/web-form-design/)
- **NN/g:** on mobile, place labels "immediately above the field". Placeholder text "causes many usability problems". Size each field to its expected input. — [NN/g, Website Forms Usability](https://www.nngroup.com/articles/web-form-design/)
- **NN/g:** error messages should be specific ("Now is not the time to be subtle"), should keep the user's input, and should use several cues beyond colour. — [NN/g, Website Forms Usability](https://www.nngroup.com/articles/web-form-design/)
- **Baymard, inline validation:**
  - **31%** of benchmarked e-commerce sites have no inline validation. The article's video says 32%, an internal inconsistency.
  - Validating while someone is still typing, or as soon as a field gets focus, frustrated test participants.
  - Validate on blur, or for fixed-length inputs once the length is reached.
  - Once an error is shown, clear it on the keystroke that makes the input valid.
  - Positive inline validation (ticks) reduces the load of reviewing the whole form.
  - Inline validation does not replace a good error summary on submit.

  — [Baymard, Inline form validation](https://baymard.com/blog/inline-form-validation)
- **GOV.UK Design System:**
  - "Do not use `<input type="number">` unless your user research shows that there's a need for it." It can increment values by accident and gives no feedback on non-numeric input.
  - Use `inputmode="numeric"` for whole numbers and `inputmode="decimal"` for decimals. Omit `inputmode` where negative numbers are needed, because some keypads cannot enter a minus sign.
  - Set `spellcheck="false"` on reference-type fields.
  - Use fixed-width inputs for content of known length.

  — [GOV.UK Design System, Text input](https://design-system.service.gov.uk/components/text-input/)
- **GOV.UK error wording patterns:**
  - Empty field: "Enter [x]".
  - Not a number: "[x] must be a number, like 30".
  - Out of range: "must be 16 or more".
  - Money: "must include pence, like 123.45 or 156.00".

  Labels should be short and in sentence case, with no colon. Hints should be one short sentence with no full stop. — [GOV.UK Design System, Text input](https://design-system.service.gov.uk/components/text-input/)
- **MDN:** `decimal` shows digits plus the locale's decimal separator, and a minus key may or may not appear. `numeric` shows digits 0–9. `inputmode` does not enforce validity. — [MDN inputmode](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/inputmode)

### Inferences
- **£ fields:**
  - Use `type="text" inputmode="decimal" autocomplete="off" spellcheck="false"`, with a fixed "£" prefix outside the editable text and right-aligned tabular numerals.
  - Format to 2 decimal places on blur, not while the user is typing.
  - Refunds and voids may need negative values, and `decimal` may not show a minus key. Use a separate "refund" field or a +/− toggle rather than typing a minus sign.
- **Percentages** (for example wages %): show them as calculated read-only values, not inputs, so managers cannot overtype the result from the shared calculation module.
- **Validation:** validate each section on "Next". Show an error summary at the top that links to each field, plus inline messages under the fields, using GOV.UK-style wording.

### Gaps
- Baymard's specific figure on the share of users who abandon forms over validation was not retrieved.
- I found no primary data on input masks for currency. GOV.UK's general caution favours formatting on blur rather than live masking, but that is an inference.
