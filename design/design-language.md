# Design language: Maginhawa EOD

**In short:** one dark card, then just lists. Apple-like, calm, premium and simple to follow.

## How we got here
The user's reactions, in order:

1. iOS grouped cards on grey: *"make it more premium"*.
2. Premium cards with a dark hero card: liked the hero card. Asked for it to look like Monzo, Revolut and Things 3.
3. Editorial, no boxes, bold rules: **rejected** ("go back").
4. **Current:** one dark hero card per screen, then Monzo/Revolut-style lists, with Things 3 progress circles. **Approved direction.**
5. Cash count as a tile grid with a custom keypad: **rejected**. Now one row per note or coin with a typed count.

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
- Colour means status only. Ink is for the main action and blue for links.
- One obvious next step per screen; screens show where you are and what's left.
- Use words rather than signs: "£20.00 short", not "−20".
- Unusual figures get a warning with an "It's right" option; only real errors block.
- Follow the device's light/dark setting. The iPad night-mode board is a demonstration.
- Touch targets at least 44px, larger on the kitchen iPad.
- Avoid emoji, gradients and coloured left borders on cards.
