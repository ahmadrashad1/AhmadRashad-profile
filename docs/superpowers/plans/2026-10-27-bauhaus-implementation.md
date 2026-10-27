# Bauhaus UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the claymorphic visual system on the profile site with the Bauhaus system, component for component, with no clay artifact surviving.

**Architecture:** `css/styles.css` (1,968 lines) is retired and replaced by four ordered stylesheets linked from both pages — `tokens`, `primitives`, `components`, `application`. The split mirrors the spec's own three parts so each task maps to one file region. HTML changes are limited to class renames, the font link, the stylesheet links, and the hero/decoration markup. `js/main.js` keeps every mechanism; only two blocks change (photo tilt deletion, bird geometry constants).

**Tech Stack:** Static HTML/CSS/vanilla JS, no build step. Google Fonts (Jost, IBM Plex Mono). Playwright + Chrome headless for verification.

**Spec:** `docs/AhmadRashad-Bauhaus-UI-Spec.pdf` (source: `docs/design-spec/spec.html`)

## Global Constraints

- Palette is exactly: red `#CE4435`, blue `#1E4FA1`, yellow `#E9A92F`, ink `#15161A`, ink-soft `#5A564E`, paper `#EFE7D7`, paper-lift `#F7F2E7`, paper-deep `#E2D7C2`. No other color may appear in any stylesheet, except GitHub language colors in `.lang-dot` (spec p.14).
- `border-radius` is `0` everywhere. The only curve in the system is a `100%` radius forming a half or quarter circle on a shape primitive (spec p.10).
- No `box-shadow` may have a non-zero blur. Depth is `4px 4px 0` (pressable) or `8px 8px 0` (floating) only (spec p.11).
- No `filter: blur()` anywhere.
- Rule weights are `1px` / `2px` / `4px` / `8px`, always `--bq-ink`. Colored borders do not exist (spec p.11).
- Below `640px`, `--bq-rule-bold` is `6px` and `--bq-rule-mid` is `3px` (spec p.22).
- Jost for sentences, IBM Plex Mono for values (spec p.08). No italics anywhere.
- All eight existing breakpoints survive verbatim, including the three height-keyed ones (spec p.22).
- Every dialog mechanism in `js/main.js` is preserved unchanged: `showModal()`, `allow-discrete` on both `display` and `overlay`, the 110px drag threshold, the `close`-event transform reset (spec p.15).
- Decorative elements keep `aria-hidden="true"`; focus ring is `3px` blue, `2px` offset, radius `0` (spec p.23).

## Review Focus

Five conditions the spec implies that no task's happy path exercises. Each has its test pinned to the owning task.

1. **Windows High Contrast / forced-colors** strips `box-shadow`, which is the system's only "pressable" cue — buttons must stay distinguishable by border alone. → Task 3.
2. **Squaring the sheet panel changes its measured height**, and the bird's landing offset is computed from it at runtime — a stale overlap clips the bird into the heading. → Task 6.
3. **`prefers-reduced-motion` with the new `translate`-based reveal** — the clay build's reveal bug (animation `forwards` fill swallowing hover transform) recurs if reveal moves back onto `transform`. → Task 5.
4. **Landscape phone (844×390)** — the hero is a locked viewport with no vertical slack in that shape, and is deliberately excluded from the tall-phone tier. → Task 9.
5. **Red text on paper is 3.4:1** — any paragraph or caption that inherits red fails AA. → Task 2.

---

### Task 1: Verification harness

The spec's own correctness test (p.11) is mechanical: no blur, no non-zero shadow blur, no radius. Build it first so every later task has a failing-to-passing cycle.

**Files:**
- Create: `tests/bauhaus-check.mjs`
- Create: `tests/run.sh`

**Interfaces:**
- Produces: `node tests/bauhaus-check.mjs` exits non-zero on any violation and prints one line per violation as `<page> <viewport> <selector> <rule> <actual>`.

- [ ] **Step 1: Write the check script with these assertions, each over both pages at 1440×900, 820×1000, 390×844**

```
noBlurredShadow      every computed box-shadow's 3rd length === 0px
noRadius             every computed border-radius is 0px, OR exactly 50%/100% on [class*="bq-shape"]
paletteOnly          every computed color/background-color is in the 8-value palette (+ transparent, + .lang-dot)
noHorizontalOverflow documentElement.scrollWidth === clientWidth
focusRingSquare      :focus-visible outline-width 3px, outline-offset 2px, border-radius 0
targetSize           every <a>/<button> rect >= 44x44
contrastAA           computed color vs background >= 4.5 for font-size < 24px
noClayToken          getComputedStyle(root) exposes no --clay-* or --radius-* custom property
```

- [ ] **Step 2: Run it against the current clay site to confirm it fails**

Run: `node tests/bauhaus-check.mjs`
Expected: FAIL — many `noRadius`, `noBlurredShadow`, `noClayToken` violations (the clay build has 30 radius declarations, 6 blurred shadows).

- [ ] **Step 3: Commit**

```bash
git checkout -b bauhaus-redesign
git add tests/
git commit -m "test: add Bauhaus system conformance check"
```

---

### Task 2: Tokens, fonts, reset

**Files:**
- Create: `css/01-tokens.css`
- Modify: `index.html:14-17`, `work.html` (same `<link>` block) — font link and stylesheet links
- Test: `tests/bauhaus-check.mjs` (`paletteOnly`, `noClayToken`, `contrastAA`)

**Interfaces:**
- Produces: custom properties `--bq-red|blue|yellow|ink|ink-soft|paper|paper-lift|paper-deep`, `--bq-rule-hair|thin|mid|bold`, `--bq-1..7`, `--bq-sans`, `--bq-mono`, and the type scale `--bq-display|h1|h2|h3|body|small|label|value`. Every later task consumes these names.

- [ ] **Step 1: Add the `contrastAA` case that red body text fails**

Assert a `<p>` with `color: var(--bq-red)` on paper is reported as a violation (Review Focus 5) — the check must catch it, so red is never used for body copy.

- [ ] **Step 2: Write `css/01-tokens.css`** — the palette, rule weights, spacing (8/16/24/32/48/64/96), type scale from spec p.07, and the reset carried over from the clay build's lines 75–130 **minus** the `border-radius` on `:focus-visible`.

- [ ] **Step 3: Swap the font link** to `Jost:wght@300;400;500;600;700;800` + `IBM+Plex+Mono:wght@400;600` in both pages; replace the single `styles.css` link with the four ordered stylesheet links.

- [ ] **Step 4: Run the check**

Run: `node tests/bauhaus-check.mjs`
Expected: `noClayToken` and `paletteOnly` now pass; `noRadius`/`noBlurredShadow` still fail (components untouched).

- [ ] **Step 5: Commit**

---

### Task 3: Primitives — shapes, buttons, chips, offset depth

**Files:**
- Create: `css/02-primitives.css`
- Test: `tests/bauhaus-check.mjs` (`noRadius`, `noBlurredShadow`, `targetSize`, forced-colors case)

**Interfaces:**
- Produces: `.bq-shape` + modifiers `q1..q4`, `half-t|b|l|r`, `circle`, `tri-tl|tr|br|bl`; fills `.bq-fill-red|blue|yellow|ink|paper`; `.btn`/`.btn-primary`/`.btn-secondary`/`.icon-btn` restyled in place (class names unchanged so no HTML churn); `.bq-chip`.

- [ ] **Step 1: Add the forced-colors assertion** (Review Focus 1) — under `forced-colors: active`, `.btn` must retain a visible border; assert `border-width >= 2px` and that the rule does not rely on `box-shadow`.

- [ ] **Step 2: Run it — expect FAIL** (clay buttons are pill-shaped with blurred shadows).

- [ ] **Step 3: Write `css/02-primitives.css`** implementing spec p.10 (five primitives, four rotations, pure `border-radius`/`clip-path`, no SVG), p.11 (rule weights, `4px`/`8px` offsets), p.12 (button geometry: radius 0, `4px` border, `12px 28px` padding, `48px` min-height, the four states with their exact durations), p.14 (chip: `2px` border, `4px 10px`, mono 600 caps `+0.1em`).

- [ ] **Step 4: Run the check**

Expected: `noRadius`, `noBlurredShadow`, `targetSize`, forced-colors all PASS.

- [ ] **Step 5: Commit**

---

### Task 4: Header, sections, typography application

**Files:**
- Create: `css/03-components.css` (header + section regions)
- Modify: `work.html` — `.site-header` inner markup for the triangle back-arrow

- [ ] **Step 1: Write the header per spec p.16** — flat band, `72px`/`60px`, sticky, opaque `paper-lift`, `8px` ink bottom rule, **no** scroll-state change. Back arrow is the triangle primitive, not a glyph.
- [ ] **Step 2: Section headings, `.section-sub`, `.prod-label` → mono caps `+0.18em`, `8px` ink rules between sections, `.frontend-divider` → `4px`.**
- [ ] **Step 3: Hold the grid from spec p.09** — container stays `min(1100px, 100%)` and the 12-column / `24px` gutter rhythm is unchanged, so the migration restyles without reflowing the page.
- [ ] **Step 3: Run the check; commit.**

---

### Task 5: Cards

**Files:**
- Modify: `css/03-components.css`
- Test: reveal-animation case

**Interfaces:**
- Consumes: `.bq-chip`, offset tokens from Task 3.
- Produces: restyled `.repo-card`, `.live-card`, `.frontend-card`, `.engine-card`, `.platform-card`, `.featured-project` — class names unchanged.

- [ ] **Step 1: Add the reveal assertion** (Review Focus 3): after `.rise.is-visible` finishes, a hover must still move the card — assert the reveal animates `translate`, not `transform`, so the `forwards` fill cannot swallow the hover lift. This bug was already fixed once in the clay build; the test prevents its return.
- [ ] **Step 2: Run it — expect FAIL** if reveal is rewritten onto `transform`.
- [ ] **Step 3: Implement cards per spec p.13** — `4px` ink border, radius 0, three fills (`paper` default, `paper-deep` subordinate replacing `.clay-sunken`, blue/red feature), media flush to border at `8/5`, hover `4px → 6px` offset with `translate(-2px,-2px)`. Chips inside a `paper-deep` card take `paper-lift` (spec p.14).
- [ ] **Step 4: Run the check; commit.**

---

### Task 6: Dialogs and bottom sheets

**Files:**
- Modify: `css/03-components.css`
- Modify: `js/main.js:59-60` — only if the measured-height contract changes; otherwise untouched.
- Test: bird-overlap measurement

**Interfaces:**
- Consumes: offset tokens.
- Produces: no new JS API. `--sheet-panel-height` contract is unchanged.

- [ ] **Step 1: Write the bird-overlap test** (Review Focus 2): open the contact sheet at 1440×900, 640×900 and 1024×760; assert `contactBird.getBoundingClientRect().bottom` sits inside `.sheet-panel` by between 2px and the panel's own top padding, and that the bird's box does **not** intersect the `.contact-heading` box. Measure by rect — the clay build's notes record that this is invisible in a screenshot.
- [ ] **Step 2: Run it — expect FAIL** once corners are squared and the panel's height shifts.
- [ ] **Step 3: Restyle both sheets per spec p.15** — square panel, `4px` ink border, `8px` offset, backdrop `ink @ 55%` with no blur, `64×6px` ink drag bar, `44px` square red close. Retune the three `-44px`/`-30px`/`-22px` overlap overrides to the new measured clearance.
- [ ] **Step 4: Run the test at all three sizes; commit.**

---

### Task 7: Slideshow and media

**Files:** Modify `css/03-components.css`

- [ ] **Step 1: Per spec p.17** — `4px` ink frame, no radius, no inset; "View Live" badge becomes a red rectangle flush into the top-right corner; dots become `8×8` paper squares with a `16×8` yellow bar for active; remove the `scale(1.035)` hover zoom.
- [ ] **Step 2: Assert carried-over behavior still holds** — crossfade on opacity, dots generated from slide count, `data-autoplay="2000"`, pause on hover/focus/out-of-view, track is an `<a>` with dots as a sibling.
- [ ] **Step 3: Run the check; commit.**

---

### Task 8: Characters

**Files:**
- Create: `css/04-application.css`
- Modify: `index.html:23-42` — replace `.blob-field` and `.icon-field` with two tile columns
- Modify: `js/main.js:22-41` — **delete** the photo-tilt block (spec p.18: "a flat system cannot fake dimension and should not try")
- Modify: both pages' bird SVG → constructed form

- [ ] **Step 1: Rebuild the bird per spec p.18** — circle body, half-circle wing, triangle beak, quarter-circle tail. The wing is the only animated part, rotating `0°` to `-38°` about its flat edge. Keep the existing `--flap-duration` custom property and its `420ms`/`90ms`/`200ms` scroll-velocity mapping untouched in JS.
- [ ] **Step 2: Replace the three blobs and four icon chips** with one tile field of primitives in the hero margins. Drift is `translate` along **one axis only**, `<= 8px`, `8s` loop — tiles must still read as locked to the grid.
- [ ] **Step 3: Delete the photo-tilt listener block** and the `.photo-glow` element.
- [ ] **Step 4: Assert `aria-hidden="true"` on every tile and character; run the check; commit.**

---

### Task 9: Hero — index.html

Last, because it is the only locked-viewport layout and is sensitive to every preceding change (spec p.24).

**Files:**
- Modify: `index.html:45-70`, `css/04-application.css`
- Test: locked-viewport case

- [ ] **Step 1: Write the landscape-phone test** (Review Focus 4): at 844×390, 390×844, 1440×720 and 1440×900, assert `document.body.scrollHeight <= window.innerHeight` — the hero must not scroll at any of them, and nothing may clip.
- [ ] **Step 2: Run it — expect FAIL** at one or more sizes once the square frame changes the hero's height.
- [ ] **Step 3: Implement the hero per spec p.20** — square portrait frame with `4px` ink border replacing the blob; tile columns at both page edges, narrowing to one column under `1024px` and hidden under `640px`; `.eyebrow-role` → mono caps red `+0.18em`; square CTAs with `4px` offset. `body.single-screen` and the `max-height: 760px` compaction stay.
- [ ] **Step 4: Run the test at all four sizes; commit.**

---

### Task 10: Responsive, reduced motion, accessibility sweep

**Files:** Modify all four stylesheets

- [ ] **Step 1: Verify all eight breakpoints still exist** and govern what spec p.22 says they govern. Assert by parsing the stylesheets for the eight exact query strings.
- [ ] **Step 2: Add the below-640px rule-weight step-down** (`8px → 6px`, `4px → 3px`) and the `pointer: coarse` rule (offset stays at rest, no hover lift).
- [ ] **Step 3: Reduced motion** — drift and flap stop, reveals instant, sheet appears without rising, bird `display: none`.
- [ ] **Step 4: Run the full check at all three viewports; commit.**

---

### Task 11: Delete the clay build

**Files:** Delete `css/styles.css`

- [ ] **Step 1: Confirm nothing references it** — grep both pages for `styles.css`.
- [ ] **Step 2: Delete the file.**
- [ ] **Step 3: Run the spec's own migration test** (p.11): `grep -nE 'blur|box-shadow:[^;]*[0-9]+px +[0-9]+px +[1-9]' css/*.css` must return nothing. `grep -n 'radius-pill\|clay-' css/*.css` must return nothing.
- [ ] **Step 4: Run the full check on both pages at all three viewports.**

Expected: all assertions PASS.

- [ ] **Step 5: Commit.**

---

## Resolved decision — the hero avatar

`index.html:49-64` held a looping 3D clay video (`avatar.webm` / `avatar.mp4`, poster
`avatar-still.jpg`) of Ahmad waving, added in commit `8d28da1`. Spec p.18 replaces the avatar
with a square portrait built from primitives, and spec p.03 names "a Bauhaus skin bolted onto
clay geometry" as the explicit anti-goal — the two cannot both hold.

**Decided by Ahmad, 2026-10-27: replace it.** Task 9 builds the constructed avatar from spec
p.18 — square field, half-circle hair, circle eyes, half-circle shoulders, `4px` ink border,
radius 0. The `<video>` element and the `#avatarVideo` reference are removed; the asset files
stay in `assets/img/` (git history keeps them retrievable either way) but are no longer
referenced by either page.

**Execution: native** — implemented in-session, conformance check run per task, one
whole-branch review at the end.
