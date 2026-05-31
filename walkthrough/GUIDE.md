# Calibration Guide — for future sessions

Hard-won notes on driving the Ruffle/Flash Donnie Darko playthrough with this tool.
Read this **before** calibrating new steps. See `README.md` for the architecture;
this file is the field manual.

> *"28 days, 6 hours, 42 minutes, 12 seconds. That is when the world will end."*
> Calibrating this thing feels a little like Donnie's own predicament: you are
> following a guide left by someone who has already seen how it ends, clicking
> crosshairs in a precise order to keep a fragile timeline from collapsing. Miss the
> hotspot, mistype the password, and the Tangent Universe stays sealed. Get it right
> and a dead woman's philosophy book opens, a man in a rabbit suit hands you a word,
> and the screen tears open onto the next puzzle. Have fun. Trust the clock.

---

## TL;DR workflow

1. **Serve the site:** site must be reachable at `config.json` `baseUrl` (default
   `http://localhost:8080`). e.g. `npx http-server ../docs -p 8080`.
2. **Warm-start fast:** to calibrate anything from the menu onward, load
   **`/intro_short.html`** (reaches the menu in ~5s) instead of replaying the
   real intro (~60s). For section content, `navigate` straight to the section URL.
3. **See the screen + read coords:** `node src/calibrate.js --url <page> --grid 25`
   draws a canvas-local coordinate grid over the stage → `output/calibrate/`.
4. **Find unknown buttons:** `node src/scan.js` (grid of hover+clicks, flags any
   coordinate that changes the screen) or, for the kinetic menu, the crosshair /
   word detectors (below).
5. **Wire the step** into `steps/donnie.steps.json`, then validate statefully:
   `node src/cli.js --until <stepId> --grid --continue-on-error`.
6. **Inspect** `output/screenshots/NN-<id>-before-grid.png` and `-after.png`.
7. **Generate:** the full run writes `output/walkthrough.html` (self-contained).

> Coordinates are **canvas-local** (authored stage `0..800 × 0..500`). The stage
> renders smaller on screen (e.g. 768×480, or 550×400 on some pages) — the coord
> mapper scales automatically, so always think in 0..800 × 0..500.

---

## Non-obvious facts (the stuff that cost hours)

- **Canvas is in shadow DOM.** The homepage uses the `<object><embed>` polyfill →
  `<ruffle-object>`, NOT `<ruffle-player>`. Target a bare `canvas` selector
  (Playwright pierces open shadow roots). Config `ruffle.playerSelector` is "".
- **Screenshot, don't `toDataURL`.** Ruffle's wgpu/WebGL buffer reads back blank.
  We diff Playwright element screenshots clipped to the canvas.
- **Kill the Ruffle overlays.** Headless = software rendering → Ruffle pops a
  "hardware acceleration is disabled" **modal that dims the stage AND intercepts
  clicks**. `suppressRuffleOverlays()` (auto-called in `waitForRuffleReady`)
  injects shadow-DOM CSS to hide it + the save/volume/unmute/context modals.
  If clicks mysteriously do nothing, check this first.
- **Many screens animate forever** (scanlines, a live-ticking counter, drifting
  clouds). Pure `diff-stable` can't settle on them — use `mode:fixed`, or a
  looser `diffThreshold` (0.02), or diff a sub-`region`.
- **Slow auto-forwards need `minWaitMs`.** Some screens hold a brief static moment
  *before* a long animation (the detention collage). Without a `minWaitMs` floor,
  `diff-stable` latches onto that early gap and fires ~2s in. Set `minWaitMs` to
  just under the real settle time (e.g. 42000 for the ~44s detention forward).
- **`aid/*.html` are the source of truth.** `src/aid/aid1.html … aid9.html` is the
  43-step guide; **`src/images/aid/*.jpg` are per-screen reference stills**. Always
  check the still for the screen you're calibrating (e.g. `no2c.jpg` = the menu).
  The rebuild mostly matches the 2001 guide but not always 1:1.
- **`swfdump -a docs/<file>.swf`** (swftools, installed) reveals real navigation:
  `Stop` frames (click-gated), `GetUrl … Label:"…"`, `loadMovie`/`_levelN`,
  and `DEFINEBUTTON2` ids. Invaluable for understanding a screen's logic.

---

## The menu (clouds.swf) — how it actually works

The cloudscape menu is the trickiest screen. Findings:

- The **drifting `+word` labels are decoration.** The **three FIXED red
  crosshairs are the level buttons.** Hover (to trigger the Flash rollover) then
  click **precisely** at the crosshair centre.
- Detect crosshair centres by red pixels (`R>150, G<110, B<110`) — eyeballing is
  too imprecise and a few px off misses the hit area.
- **Level 1 = crosshair (547,416)** → "THINGS AREN'T THAT SIMPLE!". Reproducible.
  `clouds.swf` button `0092` ("level 1 is active") fires an internal
  `go → _level2` that loads `book.swf` — no frame dependency, so it works.
- **Levels 2 & 3** (crosshairs ~`463,351` and ~`668,387`) use
  `getURL … Label:"top"` — a named frame from the original frameset that **does
  not exist** in the single-page rebuild, so the click goes nowhere here. Reach
  those sections via **direct section URLs** instead (see below).
- `clouds.swf` auto-loads `book.swf` into `_level2` on startup; `book.swf`'s one
  button → `the/index.html` (`_top`).

---

## Popups open in NEW BROWSER TABS (important!)

Many actions fire a Flash `getURL` that **opens a news article / obituary / info
popup in a new browser tab** — and **closing that tab continues the game**. These
are NOT canvas changes, so a canvas image-diff shows ~0% and the click looks
"inert". The runner now handles this: it listens for `context.on("page")`, and
for each opened tab it screenshots it (a walkthrough artifact), then **closes it**
(set step `"keepPopup": true` to leave open). Examples confirmed:

- Menu crosshair `(463,351)` → opens `/pop/pop_level3.html` (Level 3 password hint:
  "…the street he lives in … like the flower" = `rose`).
- The obituaries (Roberta Sparrow, Monnitoff), the Cunning Visions / engine
  articles, the FAA "launch the document", and the Level 3 hint are all tabs.

If a click seems to do nothing, **check for a popup tab** before assuming the
coordinate is wrong.

## Section pages are INERT when loaded standalone

Loading a section URL directly (e.g. `the/tangent/universe/main.html`,
`the/tangent/index.html`) shows the screen but it does **not respond to hover or
clicks** (hover-diff ≈ drift). These SWFs expect game-state/level context set by
the real flow (same reason `clouds.html` renders blank). So `navigate`-to-section
is fine for *viewing* but to *drive* a section you generally must arrive via the
in-game flow. **Level 1 is enterable** via the menu crosshair `(547,416)`; the
Levels 2/3 entry mechanism via the menu still needs mapping (the L2/L3 crosshairs
open article tabs, not gameplay).

## Section URL map (the fast path)

Each section page loads its SWF directly — `navigate` to these instead of
fighting in-Flash level navigation:

| Section | URL | SWF |
|---|---|---|
| Intro | `/` (real) or `/intro_short.html` (fast) | intro.swf / intro_short.swf |
| Menu | (loaded by intro) | clouds.swf + book.swf |
| Level 1 / book | `/the/index.html` | (book) |
| Tangent | `/the/tangent/index.html` | smurf.swf |
| Tangent Universe | `/the/tangent/universe/main.html` | philosophy.swf |
| Level 2 — sleep golfing | `/are/you/sleep/golfing/main.html` | golf.swf (+ draw/birds) |
| Sparkle Motion | `/sparkle/motion/main.html` | phase2_end.swf |
| Level 3 — from the sky | `/from/the/sky/main.html` | trampolin.swf (+ phone/lamp) |
| News popups | `/pop/pop_level2.html`, `/news/popN.html` | pass2.swf etc. |

---

## Action & wait reference (calibrated patterns)

- **Repeated advance clicks:** `{"type":"click","x":..,"y":..,"repeat":4,"repeatIntervalMs":2300}`
  (intro montage — each click steps one frame; extra clicks on the end-state are no-ops).
- **Rollover buttons (menu crosshairs):** add `"hoverMs":400` so the pointer dwells
  to trigger the rollover before clicking. (For *moving* targets you'd click fast,
  but the crosshairs are fixed, so dwell is fine.)
- **Keyboard:** `{"type":"key","key":"y"}` — Ruffle gets it via the focused player
  (input.js focuses the canvas first). `{"type":"type","text":"breathe","pressEnter":true}`
  for password fields (passwords: L1 `breathe`, obituary `sparrow`, frank `smurf`,
  wallet `ling ling`, L3 `rose`).
- **Animated screens:** `mode:fixed` (montage, terminal cursor) or `diff-stable`
  with `diffThreshold:0.02`.
- **Long auto-forwards:** `diff-stable` + `minWaitMs` floor + big `maxWaitMs`.

---

## Progress (2026-05-30)

**Done & validated end-to-end (9 steps in `steps/donnie.steps.json`):** Intro (7)
→ Menu→Level 1 (crosshair 547,416) → Level 1 obituary 1 (45,45 → news/pop1.html)
→ obituary 2 (270,135 → news/pop2.html). Popup tabs captured + closed by the
runner. The original 43-step guide is preserved in `steps/donnie.guide.steps.json`.
See `HANDOVER.md` for the exact resume point and next actions.

**Level 1 content — calibration findings (warm-start via `intro_short.html` →
click crosshair (547,416)):** the screen shows a skeleton figure with a thin red
line leading to **circles at the TOP-LEFT** (not on the figure). Clicking them
opens news-article TABS (the popup mechanic):
- Circle 1 ≈ `(45,45)` → `news/pop1.html` (Roberta Sparrow obituary → `sparrow`). DONE/in steps.
- Circle 2 ≈ `(270,135)` → `news/pop2.html` (Monnitoff obituary). DONE/in steps.
- After both, a 3rd crosshair appears ≈ `(490,152)` → reveals more line text
  ("let no one know…", "a guide in a time of great danger") → leads to the
  `sparrow` password prompt. STILL TO CALIBRATE: sparrow prompt → Karen
  Monnitoff's letter → "DO YOU BELIEVE IN TIME TRAVEL?" → tangent area
  (`the/index.html`, 3 boxes "remember/one/word" + frank `smurf`) → tangent
  universe (`philosophy.swf`, nested popups, `smurf`, breathe, philosophy dots).
  NOTE: section pages are inert standalone, so calibrate these IN the live L1 flow.

**Remaining (use direct-URL navigation + fast probes):**
- Level 1 content: 3rd circle → `sparrow` / letter → tangent (see above)
- Tangent Universe: nested popups / `smurf` / philosophy dots
- Level 2: golf course red squares + **the lifeline puzzle (answer-marks need the
  video/stills to verify — flag if guessing)** + chalkboard + sidewalk
- Sparkle Motion: top dot, right-click "play", licence (Rose St), fire popups
- Level 3: middlesex location, chandelier, telephone, FAA "launch the document", fin

**Known risks for remaining work:** the lifeline puzzle requires *correct* marks
(wrong ones won't advance) — read from `aid/lev2g.jpg` + the playthrough video.
Sparkle Motion needs a **right-click** ("play" the animation). Some Level 3 steps
are audio-gated (phone.swf dialogue) — use long `maxWaitMs`.

---

## Gotchas checklist when a step misbehaves

1. Clicks do nothing → overlay not suppressed? coordinate off? rollover needed (`hoverMs`)?
2. Settle fires too early → add/raise `minWaitMs`.
3. Settle times out → screen animates forever; switch to `mode:fixed` or loosen `diffThreshold`.
4. Wrong screen after a step → a prior step derailed; re-run with `--until` + `--grid` and inspect each `-after.png`.
5. `cd` drift: run node commands from `walkthrough/` (the shell cwd can reset to the repo root between calls).
