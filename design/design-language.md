# Design language: Maginhawa EOD

**In short:** one main card per screen in the site's own moving colour gradient, then just lists. Apple-like, calm, premium and simple to follow.

> **Redesign, 12 Nov 2026 (user's direction; first pass built in `apps/eod-web` the same day).** Canvas: https://claude.ai/artifact/2SaS5mXwouxhbg23YspRVV ("Maginhawa Ops redesign", 13 boards). Local copy: `design/redesign-canvas/project/` (preview `redesign-canvas`, port 4195). The section "Redesign (Nov 2026)" below **overrides** older rules where they clash: the main card is no longer plain dark, gradients are now allowed on it, and each site has its own colour. Everything else (lists, circles, status words, light/dark, plain English) still holds.

## How we got here
The user's reactions, in order:

1. iOS grouped cards on grey: *"make it more premium"*.
2. Premium cards with a dark hero card: liked the hero card. Asked for it to look like Monzo, Revolut and Things 3.
3. Editorial, no boxes, bold rules: **rejected** ("go back").
4. **Current:** one dark hero card per screen, then Monzo/Revolut-style lists, with Things 3 progress circles. **Approved direction.**
5. Cash count as a tile grid with a custom keypad: **rejected**. Now one row per note or coin with a typed count.
6. **12 Nov 2026 redesign:** "too plain and not easy to follow". Asked for a colour per site (editable in settings), gradients with grain like their "Fire Gradients" references, good animation and easy navigation. Then, in order: vertical streaky gradient **rejected** ("a normal gradient"); **not black**, a mix of colours; the gradient **moves slowly**; **softer shadows**; **Apple-icon-style corners**; more whitespace and better sizing.

## Redesign (Nov 2026)

### Site colour
- **One seed colour per site**, stored in settings. Defaults (examples, editable by head office): Bintang Indigo `#3B5BDB`, Guanabana Leaf `#5C940D`, Belly Plum `#9C36B5`, Hoodwood Walnut `#A0612A`, Bunso Mango `#F59F00`, Cafe Mama & Sons Rose `#D6336C`, Kentish Town Teal `#0C8599`, China Town Lantern `#C92A2A`.
- Picker: 12 tested swatches (the 8 above plus Ocean `#1971C2`, Grape `#6741D9`, Olive `#868E2C`, Slate `#495057`) and a custom **hue slider** (lightness and chroma fixed, `oklch(.68 .15 h)`). Text on the colour (white or `#1D1D1F`) is **picked automatically** and checked for contrast in light and dark; a custom colour that needed it says "Adjusted for readability". Never a free RGB picker.
- **Where it goes:** site badge (rounded-square initials), the main card gradient, the selected tab pill (`color-mix(in oklch, site 24%, white)`), progress circles and segments, a faint wash behind the phone header, the head-office site cards.
- **Never:** body text, status pills, whole page backgrounds. **Never colour alone**: always with the site's initials. **Green, amber and red stay status-only** and always come with words.
- Switching site cross-fades badge, card and tab together (about 350 ms).

### Main card gradient
- All shades come from the one seed colour `C` with OKLCH relative colours, so custom colours always work:
  (Updated 12 Nov 2026 to match the user's references: big soft shapes, a deep dark area against a bright pale highlight, heavier grain.)
  - base, deep and tinted (not pure black): `oklch(from C .17 calc(c * .6) calc(h - 35))`
  - shadow pool (bottom left): `oklch(from C .1 calc(c * .4) calc(h - 35))`
  - the seed `C`, large (centre-right), solid in the middle before it fades
  - mix (bottom middle): `oklch(from C calc(l - .04) calc(c * 1.1) calc(h - 40))` (warm sites go red, cool sites go blue)
  - pale highlight (right edge, away from text): `oklch(from L .95 calc(c * .6) h)` where `L` is the site's light tint; weaker on small cards so white text stays readable
- Built from **blurred blobs** (`filter: blur(30px)`), not stripes. Each colour stays solid for about a quarter of its radius, so shapes read cleanly instead of blending into mud. Card text gets a soft `text-shadow`.
- **Grain:** an SVG `feTurbulence` (fractalNoise, baseFrequency 1.1) overlay, `mix-blend-mode: overlay`, opacity .75.
- In the app: `.hero` and `.hero::before` / `::after` in `apps/eod-web/app/styles.css` (Redesign blocks).
- **Slow drift:** blobs move, scale and turn on 12 s and 15 s loops. Small gradient chips pan their background over 9 s. All of it stops under `prefers-reduced-motion`.
- The "Up next" button on the card is a cream pill (`rgba(255,248,240,.92)`) with a black arrow circle.

### Shape, shadow, spacing
- **Corners:** Apple-style continuous corners, `corner-shape: superellipse(1.6)` (falls back to normal rounding). Icons, pills, chips and buttons stay fully round. Radii: main card 32–34px, tiles and cards 24–30px, badges 12–14px, inputs 14px, sheet tops 34px.
- **Shadows:** soft and tinted with the site colour, e.g. `0 18px 56px -28px color-mix(in oklch, site 36%, transparent)`. Neutral cards: `0 10px 36px -20px rgba(0,0,0,.12)`.
- **Spacing:** phone side margins 24px; 24–28px between sections; list rows 58–68px with 17px titles and 13px grey subtitles; page titles 34px. Desktop: page padding 40px / 56px, 32–40px between blocks. Dividers start where the text starts.

### Navigation
- **Phone tabs:** Today · Close · Checks · More (max 4–5; Temperatures or Repairs can be pinned). Search button at the top of every screen.
- **Today** reads top to bottom: main card with one "Up next" → **Needs you** (exact counts, "1 late · 1 failed") → **Later today**.
- **Close the day:** sections grouped Sales / Team / Wrap up with circles, plus a floating "what's left" bar that jumps to the next unfinished section.
- **Checks:** "Needs fixing" (fix in the row with quick answers), then grouped by time of day.
- **Search:** sites, past days ("Belly 3 Nov"), checklists, people and settings, plus quick actions.
- **Desktop sidebar** grouped under headings: Today · Records · Team · Site (head office: Tonight · Reports · Group), site switcher at the top, ⌘K.

### Motion tokens
| Use | Value |
|---|---|
| Press | `scale(.97)`, 120 ms |
| Screens and lists | 200–280 ms, `cubic-bezier(.23,1,.32,1)` |
| Sheets | in 360 ms `cubic-bezier(.32,.72,0,1)`, out about 220 ms |
| Progress fill | 700 ms `cubic-bezier(.34,1.56,.64,1)` (small overshoot) |
| List stagger | 30–40 ms each, max 6 rows |
| Rolling figures | digits slide up, 300 ms |
| Gradient drift | 12–15 s loops |
| Reduce motion | movement becomes a short fade; gradients hold still |

No animation on things used dozens of times a shift (⌘K open, typing). Celebration only for "Day sent" and "all checks done".

## Tokens

| Token | Light | Dark |
|---|---|---|
| `--bg` (page) | `#FFFFFF` | `#121214` |
| `--side` (panels) | `#F7F7F9` | `#1B1B1F` |
| `--hero` / `--onhero` / `--herosec` | `#1D1D1F` / `#F5F5F7` / `rgba(245,245,247,.6)` | `#232328` / `#F5F5F7` / `rgba(245,245,247,.66)` |
| `--fill` (inputs, icon circles, chips) | `#F2F2F5` | `#2A2A2F` |
| `--text` | `#1D1D1F` | `#F2F2F4` |
| `--sec` | `#6E6E73` | `#A3A3AB` |
| `--sep` | `rgba(0,0,0,.08)` | `rgba(255,255,255,.12)` |
| `--ink` / `--onink` | `#1D1D1F` / `#FFFFFF` | `#F2F2F4` / `#121214` |
| `--link` | `#0066CC` | `#4AA3FF` |
| `--ok` / `--okbg` | `#1F7A35` / `rgba(52,199,89,.14)` | `#4CD964` / `rgba(76,217,100,.16)` |
| `--warn` / `--warnbg` | `#B25000` / `rgba(255,149,0,.16)` | `#FFB340` / `rgba(255,179,64,.16)` |
| `--bad` / `--badbg` | `#D70015` / `rgba(255,59,48,.12)` | `#FF6B60` / `rgba(255,107,96,.16)` |

**Dark mode rules** (how Apple, Revolut and Material do it):
- **No pure black.** The page is a dark grey (`#121214`), not `#000000`.
- **Depth comes from lighter surfaces, not shadows:** page `#121214` → panel `#1B1B1F` → hero card `#232328` → inputs `#2A2A2F`. The hero card gets a faint 1px edge (`rgba(255,255,255,.07)`) instead of a shadow.
- **Text is off-white** (`#F2F2F4`), and status colours are a little lighter and softer than in light mode.

**Font stack:** `-apple-system, BlinkMacSystemFont, 'Geist', sans-serif`. Use `font-variant-numeric: tabular-nums` everywhere, and `letter-spacing: -0.012em` for body text.

## Type scale

| Use | Style |
|---|---|
| Hero figure | 56–60px / 600 / −0.055em. **Pence** at about half size, in `--herosec` |
| Large title | 34px / 700 / −0.035em |
| Section title | 20px / 700 / −0.025em, sentence case |
| Body | 17px (desktop 15–16px) |
| Subtitle / caption | 13–14px, `--sec` |

## Components
- **Hero card** (one per screen):
  - Radius 24–26px, padding 24px, shadow `0 24px 48px -24px rgba(0,0,0,.4)`.
  - Holds the key figure, a small meta row split by a `--heroline` hairline, and an optional chart.
- **List row** (Monzo-style):
  - 56–68px tall, with a 42px round icon in `--fill`.
  - Title plus grey subtitle, with the amount bold on the right.
  - Hairline separator inset 56px.
- **Section header:** 20px bold title on the left, grey meta on the right (count or total).
- **Input:** filled `--fill` box, radius 10px, height 40px, right-aligned (counts centred). Focus ring `0 0 0 2px var(--link)`.
- **Progress circles** (Things 3), 24px:
  - Empty ring: to do.
  - Half pie, orange: in progress.
  - Filled green with a tick: done.
  - Dashed ring: skipped.
- **Status:** a tinted pill or tinted round icon **plus words** ("£20.00 short", "Balanced", "Matches").
- **Primary button:** ink pill, 54px tall, radius 999px. The secondary is a plain blue text link. One primary per screen.
- **Toggles:** iOS style, green when on.
- **Charts:**
  - Solid line for actuals, dashed for the forecast, and a shaded band for the likely range.
  - Light grid lines, with a key underneath.
  - Sparklines in tables.
- **Scrollbar:** thin, 8px, rounded grey thumb, transparent track.

## Rules
- Colour means status, except the **site colour**, which only says which site you're in (see Redesign). Ink is for the main action and blue for links.
- One obvious next step per screen; screens show where you are and what's left.
- Use words rather than signs: "£20.00 short", not "−20".
- Unusual figures get a warning with an "It's right" option; only real errors block.
- Follow the device's light/dark setting. The iPad night-mode board is a demonstration.
- Touch targets at least 44px, larger on the kitchen iPad.
- Avoid emoji and coloured left borders on cards. Gradients only on the main card and site colour chips, as set out in Redesign (smooth blobs with grain; no stripes, no black base).
