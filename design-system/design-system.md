# donniedarkowebsite.com — Design System

A faithful recreation of the 2001 Donnie Darko promotional website, originally built by
Hi-ReS! in Flash. This document is the source of truth for extending the site (new levels,
scenes, popups) in HTML/CSS/JS so additions are **indistinguishable from the 2001 original**.

> Intended use: upload this folder (doc + `screenshots/`) as design-system source material
> for Claude (Design) or any agent building new scenes. The screenshots are real rendered
> frames from the site, not mockups — treat them as ground truth for feel.

---

## 1. Brand essence

- **A haunted website, not a web page.** The site is a puzzle-game artifact from 2001:
  cryptic, unexplained, hostile to skimming. Nothing announces itself. Progress is earned
  through hidden hotspots, passwords, and patience.
- **Register:** lowercase, terse, oracular. The site speaks in fragments
  (*"the tangent universe collapsed"*, *"time is up, donnie"*). It never instructs,
  never apologises, never uses marketing language.
- **Era:** Flash-era minimalism + Windows 98 desktop vernacular. Pop-up windows, system
  fonts, alert dialogs, and browser chrome are *diegetic* — part of the fiction.
- **Three moods**, used deliberately:
  1. **The void** — flat white or flat black stages with sparse type and one red accent.
  2. **The document** — scanned paper, typewritten/terminal text, bureaucratic dread.
  3. **The desktop** — Win98 silver windows stacked on darkness, navy title bars.

## 2. Color

Tokens live in `src/scss/partials/_vars.scss` as CSS custom properties.

| Token | Value | Use |
|---|---|---|
| `--dark` | `#000000` | Stage/void backgrounds (`body.dark`) |
| `--light` | `#ffffff` | White-void stages, letter paper |
| `--highlight` | `hsl(356, 98%, 52%)` ≈ `#fc0d1b` | **The** red: crosshairs, glowing key words, links, secrets. The single most important color — red means *clickable / significant* |
| `--hover` | `hsl(356, 98%, 42%)` | Link hover |
| `--focus` | `#ffdd00` | Focus outline (accessibility) |
| `--red` | `#ea3323` | Secondary red (legacy art) |
| `--green` | `#00ff00` | Terminal green — system/document text (detention affidavit) |
| Paper | `#ddddcc → #ffffff` vertical gradient | "Daylight" scenes (L3, the letter); see `from/the/sky/main.html` |
| Win98 silver | `#c0c0c0` (from 98.css) | Window bodies |
| Win98 navy | `#000080 → #1084d0` gradient (from 98.css) | Title bars |
| Muted greys | `#333` / `#555` / `#777` / `#999` | Body type on dark; the darker, the more atmospheric |

**Rules:** one red accent per screen, maximum. Large fields of a single value (black,
white, or paper) dominate every composition. No gradients except the paper gradient and
Win98 title bars. No rounded corners on stage elements.

## 3. Typography

Fonts in `src/fonts/`, declared in `src/_includes/layouts/base.html`:

| Token | Font | Use |
|---|---|---|
| `--mono` | **Pixelated MS Sans Serif** (400/700) | Primary game type: assembling text, captions, prompts, dates. Bitmap-crisp, period-perfect |
| `--mono-alt` | **DepartureMono** | Window body copy, secondary mono |
| `--body` | Arial | Plain HTML pages only (credits, articles) |
| `--times` | Times New Roman | Newspaper articles in popups |

**Rules:** game copy is lowercase (exception: Win98 window titles like `WARNING!` and
system documents, which are UPPERCASE). Generous `letter-spacing` (0.12–0.5em) on sparse
type. Small sizes — `clamp(0.7rem … 0.95rem)` — text should feel found, not presented.
Fluid scale tokens (`--font-size-sm … --font-size-xl`, `--space-xs … --space-xl`) exist
in `_vars.scss` for non-game pages.

## 4. Layout

- **The stage:** every game scene is an **800×500** frame (the original Flash stage).
  HTML scenes use `<div class="aspect-ratio">` (`aspect-ratio: 800/500`, `width: 60vw`
  at ≥1280px, `position: relative`), bottom-aligned via `class="flex items-end h-full"`.
  All in-scene placement is absolute, in percentages of the stage.
- **Everything outside the stage is void** — the page background color, nothing else.
- Pop-up content (articles, hints) opens in **separate small windows/tabs** styled as
  Win98 windows — never inline modals over content (exception: stacked windows *inside*
  the stage as a game beat).

## 5. Components

| Component | Where | Anatomy |
|---|---|---|
| **Win98 window** | `src/scss/vendor/98/98.css` | `.window` > `.title-bar` (`.title-bar-text`, `.title-bar-controls` with `button[aria-label="Close"]`) > `.window-body`. Position absolutely inside the stage for game beats (see `cellar/door/frank.html`); the original stacked them the same way |
| **Hidden hotspot** | site-wide idiom | `<a data-url hidden href="…">` — transparent, absolute, `z-index: 999`, ~44–48px square, revealed by `removeAttribute('hidden')` on a game event. THE core mechanic (see `are/you/sleep/golfing/main.html`, `from/the/sky/main.html`, `cellar/door/*.html`) |
| **Red crosshair / mark** | menu, hunts | Small red (`--highlight`) target; the only invitation to click the site ever offers. Flicker on hover: `@keyframes flicker { 50% { opacity: 0 } }` 0.1s ×5 |
| **Assembling type** | `missingScripts.animateText` / `level4Scripts.animateText` | Text builds word-by-word (90–240ms cadence), fires `wordsFinished`; reveals come *after* assembly. Source element starts `display:none`. Split on `/\s+/` (indentation = invisible words). Spans don't survive word-splitting — recolor key words via post-assembly `innerHTML.replace` |
| **Glowing key word** | letters | A password rendered in `--highlight` red inside body text (`breathe`, `cellar door`) — the hint *is* the secret |
| **Scanlines** | `_effects.scss` `.interlace` | `repeating-linear-gradient` 1px dark lines. For stage overlays prefer a page-scoped `::before` with `pointer-events: none` (the shared class fights stage geometry and can eat clicks) |
| **Noise/grain** | `partials/svg.html` filters | SVG turbulence filters `#noise1–4` + `animation: noise`. Use sparingly; never on frames that must hold still |
| **Password gate** | `missing/are/you/sleep/golfing/5.html`, `cellar/door/whisper.html` | Bare `<input>` in a window; JS `checkPassword()`; wrong answer = native `alert()` (diegetic Win98). Always set explicit input `color` — `body.dark` makes text white-on-white |
| **Terminal document** | intro, transcripts | Green or black monospace over a scanned-paper image; `C:\>` prompts, `MORE? (Y/N)` |

## 6. Interaction principles

1. **Never explain.** No tooltips, no "click here", no onboarding. Discovery is the game.
2. **Hide the exits.** Progression links are invisible until earned, then *barely* visible.
3. **Red is the only signpost.**
4. **Real randomness for humans, seeds for machines.** Randomised elements (hotspot hunts)
   accept `?seed=<n>` (mulberry32 PRNG, `src/scripts/level4.js`) so the Playwright
   walkthrough is deterministic while visitors get a true hunt.
5. **The system is the fiction.** Alerts, title bars, browser windows and URLs
   (`/are/you/sleep/golfing/`, `/cellar/door/`) are narrative devices. New URLs read as
   whispered phrases, lowercase, no hyphens.
6. **Terminal states hold still.** Endings settle to a perfectly static frame (they're
   asserted against reference stills by the walkthrough harness).
7. **Accessibility floor, period feel:** `visually-hidden` labels on inputs, `aria-label`
   on icon buttons/hotspots, `--focus` yellow outlines. `hidden` attribute (not
   `opacity: 0`) for unrevealed elements so they're out of the tab order. Site is
   `noindex` by design.

## 7. Voice & copy

- lowercase. short. full stops as rhythm.
- second person, present tense: *"you said the words."*
- dates as ritual: `10 . 02 . 1988`
- system voice is UPPERCASE and bureaucratic: `AFFIDAVIT FOR WARRANT OF ARREST AND DETENTION`
- never name the mechanic. (*"find the door. it is not where you left it."* — not
  "click the hidden hotspot")

## 8. Screenshots (`screenshots/`)

Real rendered frames, 768×480 (the stage at the reference viewport). Ground truth for feel.

| File | What it conveys |
|---|---|
| `01-intro-bullseye.png` | The white void mood: grey shards, one red target |
| `02-detention-affidavit.png` | The document mood: terminal green over scanned paper |
| `03-cloud-menu-crosshairs.png` | The menu: drifting words, photographic montage, red crosshairs as the only UI |
| `04-frank-win98-window.png` | The desktop mood: a single IE-chrome window on darkness; Frank; `smurf` |
| `05-l3-ending-time-is-up.png` | A terminal state: *"time is up, donnie"* |
| `06-l4-collapse-intro.png` | (L4) black void + assembled type + red `.continue.` |
| `07-l4-sparrow-letter.png` | (L4) paper mood + glowing red key words in a letter |
| `08-l4-cellar-hunt.png` | (L4) the hunt: one faint red mark in near-total darkness |
| `09-l4-frank-countdown.png` | (L4) Win98 window beat: red system voice + countdown |
| `10-l4-cellar-door-end.png` | (L4) terminal state: door of light, words held static |

## 9. Building a new scene — checklist

1. Page in `src/pages/<phrase>/<word>/…` with `permalink`, `{% set isDark %}` as needed,
   `{% set isRuffle = false %}` (HTML scenes), `{% set hasCredit = false %}`.
2. Stage: `flex items-end h-full` > `.aspect-ratio` with page-scoped
   `aspect-ratio: 800/500; position: relative` (+ optional scanline `::before`,
   `pointer-events: none`).
3. Per-page CSS in the `{% css %}` block; shared JS via `<script src="/scripts/…">`
   (don't add to the `app.min.js` concat).
4. One red accent. Lowercase copy. Hidden `[data-url]` exits revealed by events.
5. Verify headless: add steps to a standalone walkthrough file
   (`walkthrough/steps/*.steps.json`) — `domClick`/`domType` actions, `?seed=` for
   anything random, `match-reference` for the terminal frame.
