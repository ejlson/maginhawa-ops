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
| `--bg` | `#FFFFFF` | `#000000` |
| `--text` | `#1D1D1F` | `#F5F5F7` |
| `--sec` | `#6E6E73` | `#A1A1A6` |
| `--fill` | `#F2F2F5` | `#1C1C1E` |
| `--sep` | `rgba(0,0,0,.08)` | `rgba(255,255,255,.10)` |
| `--ink` / `--onink` | `#1D1D1F` / `#FFFFFF` | `#F5F5F7` / `#000000` |
| `--hero` / `--onhero` / `--herosec` | `#1D1D1F` / `#F5F5F7` / `rgba(245,245,247,.6)` | `#1C1C1E` / same / same |
| `--link` | `#0066CC` | `#2997FF` |
| `--ok` / `--okbg` | `#1F7A35` / `rgba(52,199,89,.14)` | `#30D158` / `rgba(48,209,88,.16)` |
| `--warn` / `--warnbg` | `#B25000` / `rgba(255,149,0,.16)` | `#FF9F0A` / `rgba(255,159,10,.16)` |
| `--bad` / `--badbg` | `#D70015` / `rgba(255,59,48,.12)` | `#FF453A` / `rgba(255,69,58,.16)` |

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
