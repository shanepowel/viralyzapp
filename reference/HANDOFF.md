# Handoff: Viralyz App Redesign (Dashboard + Score Results)

## Overview
Redesign of the Viralyz creator app's core screens — Dashboard and Score Results — to match the warm "Signal" visual language of the marketing site (swaymegood.com/agency). These two screens are the **pattern library**: every other screen (Library, Hook Lab, Script Doctor, Thumbnails, Captions, Calendar, Trends, Competitors, Media Kit, Engage, Analytics) should reuse the same components.

## About the Design Files
The bundled file (`reference/Viralyz App.dc.html`) is a **design reference**, built in a proprietary internal prototyping format (custom template tags like `<sc-if>`/`<sc-for>`, and a `DCLogic` class) — it is **not** React, Vue, or plain HTML/JS and must not be copied verbatim. Treat it as a annotated visual/behavioral spec. Your job is to **recreate this design in the target codebase's actual stack** (React/Next.js, Vue, etc. — whatever Viralyz already runs on), using that codebase's existing component patterns, state management, and API layer. If you want to view it live, open the `.dc.html` file in a browser — it renders directly.

## Fidelity
**High-fidelity.** Exact colors, typography, spacing, and copy are final. Recreate pixel-perfectly using the design tokens below.

## Design Tokens

### Colors
- Paper (page bg): `#FAFAF7`
- Card (surface): `#FFFFFF`
- Tint (subtle fill / hover bg): `#F1EFEA`
- Ink (primary text): `#1B1826`
- Ink-2 (secondary text): `#5B5768`
- Ink-3 (tertiary text / labels): `#928FA0`
- Line (border): `#E7E4DD`
- Line-strong (stronger border): `#D6D2C8`
- Violet (brand primary): `#6C4CF1`
- Violet-deep (hover/active): `#5638D6`
- Violet-soft (tint bg): `#EFEBFF`
- Score green (s90): `#0FA968` / soft bg `#E3F6ED`
- Score lime (s70): `#7CA426` / soft bg `#F2F8E2`
- Score amber (s50): `#D9950B` / soft bg `#FCF3E1`
- Score red (s30): `#DE4E4E` / soft bg `#FBEAEA`

**Rule: score color is the only "loud" color in the UI.** Everything else stays in warm neutrals + violet. Never use s90/s70/s50/s30 decoratively — reserve them for score rings, chips, and deltas.

### Typography
- Display / headings: **Bricolage Grotesque** (500/600/700) — `h1`–`h4`, big numbers, card titles
- Body / UI: **Inter** (400/500/600) — default body font, buttons, labels
- Data / mono accents: **JetBrains Mono** (400/500) — nav group labels, score numbers, credits pill, table column headers, timestamps
- Base body size: 14px / line-height 1.55
- Load via Google Fonts: `Bricolage Grotesque:opsz,wght@12..96,500;12..96,600;12..96,700`, `Inter:wght@400;500;600`, `JetBrains Mono:wght@400;500`

### Radii
- Small (chips, nav items): 10px
- Medium (cards, panels): 14px
- Large: 20px
- Pill (buttons, badges): 999px

### Shadows
- Standard: `0 1px 2px rgba(27,24,38,.05), 0 6px 20px rgba(27,24,38,.05)`
- Lift (hover): `0 2px 4px rgba(27,24,38,.06), 0 16px 40px rgba(27,24,38,.1)`

### Spacing / Layout
- App shell: sidebar 232px fixed + fluid main content (max-width 1160px, 36px horizontal padding)
- Card grid gaps: 16–20px
- Card internal padding: 20px (16px for compact cards)

## Screens

### 1. App Shell (persists across all screens)
**Sidebar** (232px, sticky full height, white card bg, right border `--line`):
- Logo: 20px ring (3px border, violet with green top segment, rotated -45°) + "Viralyz" in Bricolage Grotesque 700 17px
- Primary CTA: full-width violet pill button "✦ Score content" — **always visible, top of sidebar, on every screen**. This is the one primary action of the whole app.
- Nav, grouped (not flat) by intent:
  - Ungrouped: Home, Library (badge "24")
  - "Create": Hook Lab, Script Doctor, Thumbnails, Captions
  - "Grow": Calendar, Trends, Competitors
  - "Earn": Media Kit, Engage, Analytics
- Nav item: 17px icon (stroke, 2px width, 75% opacity when inactive) + label, 13.5px/500. Active state: violet-soft bg, violet-deep text, 2.5px violet left border, 600 weight.
- Footer (pinned bottom, top border): avatar (34px circle, gradient initials) + name + a 6-bar momentum sparkline (last 3 bars highlighted green = recent upward trend) + settings gear icon. Below that, small "A Digiteq Holdings company" line, 10.5px, ink-3.

**Main content**: topbar (sticky, page bg) with H1 + subtitle on the left, contextual actions top-right (credits pill + secondary button). Content below scrolls under the sticky topbar.

### 2. Dashboard
**Above the fold — exactly 4 cards, no more:**
1. **Score this month**: big number (32px Bricolage) + delta badge (▲/▼ mono, green/red) + footnote + mini sparkline bottom-right (violet-soft bars, last bar solid violet)
2. **Predictions right**: same pattern, footnote includes an honest disclosure link ("Based on your last 34 posts · how we work this out")
3. **Next Best Action** (spans 2 columns): the *only* gradient surface in the app (violet → violet-deep). One computed, specific suggestion in a full sentence (never a checklist/list of nags) + one white pill CTA. Decorative ring in the corner (18px border, low-opacity white circle, bleeding off the card edge).

**Below the fold, two columns (1.7fr / 1fr):**
- Left: "Recent scores" table — columns: Content (thumbnail 44×32 rounded 7px + title + platform/duration), Score (34px ring, stroke-dasharray progress, color-coded by score band), Status (pill chip: Draft/Scheduled/Tracking/Posted, each with its own soft bg/text pair), Predicted vs real (mono figure + small note, explicitly shows the miss with a ▼ when the prediction was wrong — do not hide misses)
- Right column, stacked panels:
  - "What works for you": 3 rows, each a 26px icon badge (green-soft bg) + one bolded insight sentence + small note citing sample size
  - "Your media kit" mini-panel: 3 label/value rows + outline button "View orders"

Score ring color bands (apply consistently everywhere a score ring/number appears): ≥85 green (`s90`), 65–84 lime (`s70`), 45–64 amber (`s50`), <45 red (`s30`). Ring stroke-dashoffset formula: circumference × (1 − score/100).

### 3. Score Results
**Header card**: large 150px score ring (10px stroke) + big number (44px) + "Viral Score" mono label, next to a plain-English verdict sentence ("Ready to post. One small fix would make it great.") + platform chip + version-delta chip (green-soft, "Up 13 from version 1") + confidence sentence with sample size and a predicted view range. Right side: stacked primary (Schedule) + secondary (Score again) buttons.

**Component grid** (5 equal columns): Opening / Visuals / Pacing / Words / Timing. Each card: label + score fraction (mono), a thin progress bar (color matches score band), and exactly **one sentence** of finding. No more than one sentence per card — this is a hard rule.

**Fixes panel**: ordered by point value. Each fix card:
- Not-yet-applied: colored left rail (amber = medium value), title + "worth +N" mono tag, one-sentence explanation, an italic suggested-fix box (tint bg), and two actions: "Apply and score again" (violet) / "Skip" (ghost)
- Applied: green-soft card background, green left rail, "✓ Applied · earned +N" tag replacing the worth-tag, no action buttons (shows the suggestion that was used, on white bg within the green card)

**Retention/watch-curve panel**: SVG area chart (violet line + faded fill) with a single amber dot marking the risk moment, and a one-line callout below with a warning badge tying the flagged moment back to the fix that addresses it.

**Sticky action bar** (bottom, blurred glass bg, top border): Save draft (ghost) / Score again (outline) / Schedule for 6pm (violet primary) — right-aligned.

## Shared Components (build these once, reuse everywhere)
- `Panel` — white card, `--line` border, 14px radius, optional header row (title + right-aligned link/meta)
- `StatCard` — label + big number + optional delta + optional footnote + optional sparkline
- `ScoreRing` — two sizes: 34px (table/inline) and 150px (hero). Same color-band logic.
- `Chip` — status pill, 4 variants (posted/scheduled/draft/tracking) each with soft-bg + solid-text color pair
- `FixCard` — two states (pending / applied) as above
- `Button` — 3 variants: primary (violet fill), outline (bordered), ghost (text only). All pill radius.
- `StickyActionBar` — bottom-anchored row of buttons, used on any multi-step or scoring screen

## Interactions & Behavior
- Sidebar nav items: hover → tint bg; active item stays highlighted per current route
- Buttons: primary hover → deeper violet + lift (translateY(-1px)) + shadow; outline hover → border darkens to ink; ghost hover → tint bg
- Table rows: hover → tint bg, whole row clickable (opens that content's Score Results screen)
- "Apply and score again" on a Fix card: triggers a re-score, the fix flips to the applied/green state, and the hero score/ring should animate/update
- View transition between Dashboard ⇄ Score Results: simple fade + slight upward translate (~250–300ms, ease `cubic-bezier(.16,1,.3,1)`)
- Respect `prefers-reduced-motion`: disable transitions/animations

## State Management
- `currentScreen`: which screen/route is active (drives sidebar active state)
- `contentItem`: the content object being scored/viewed on Score Results (title, platform, duration, score, component scores, fixes[], retention curve data, version history)
- `fixes[]`: each with `{ id, title, description, suggestion, pointValue, applied, railColor }` — toggling `applied` re-triggers a score recompute
- `user`: name, avatar, momentum history (for sparkline), plan/credits
- Dashboard aggregates: monthly score average + delta, prediction accuracy % + delta, next-best-action (computed server-side — see Backend Spec), recent scores list, "what works for you" insights (computed insights, not hardcoded)

## Assets
No external image assets — thumbnails are gradient placeholders (swap for real video thumbnails/frames). Icons are hand-drawn inline SVG (24×24 viewbox, 2px stroke, no fill) — recreate with your icon library of choice (e.g., Lucide/Feather) matching the same stroke weight.

## Files
- `reference/Viralyz App.dc.html` — the interactive design reference (open in any browser; toggle button bottom-right switches Dashboard ⇄ Score Results)
- `BACKEND.md` — suggested data model, API endpoints, and computation notes for the features this UI implies
