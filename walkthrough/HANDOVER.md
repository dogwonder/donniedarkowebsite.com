# Handover — Ruffle walkthrough calibration

**Read `GUIDE.md` first** (the field manual). This file is the "you are here"
snapshot: what's done, the exact resume point, and the next concrete actions.
Last updated 2026-05-31.

> **Server note:** port 8080 is currently taken by Docker. This session served
> the built site on **8090** (`npx http-server ../docs -p 8090 -c-1`) and set
> `config.json` baseUrl to `http://localhost:8090`. Revert to 8080 if Docker frees it.

> **Chapter-navigation tip (from the site owner, for later levels):** a "chapter
> dot" appears somewhere along a vertical line — its horizontal position is
> RANDOM left-to-right each time. Clicking that dot advances to the next chapter.
> So chapter-advance hotspots are NOT fixed coords: detect the dot (it's the lone
> marker on the vertical band) and click wherever it currently is, rather than
> hard-coding x.

---

## Where we are

A complete, working tool (`walkthrough/`) drives the Ruffle/Flash Donnie Darko
playthrough with Playwright and generates a self-contained `output/walkthrough.html`
(before/after canvas captures + popup-tab panels) plus a session video.

**Validated end-to-end (15 steps, `steps/donnie.steps.json`) — full runner run
2026-05-31 reaches the Tangent Universe:**
1–7. **Intro** — bullseye montage → `.proceed.` → "otherwise proceed here" →
   ~30s auto-forward to the detention document → click → `Y` → `Y` → main menu.
8. **Menu → Level 1** — hover+click the fixed red crosshair `(547,416)` → "THINGS
   AREN'T THAT SIMPLE!".
9–10. **L1 obituaries** `(45,45)` Sparrow + `(270,135)` Monnitoff tabs → 3rd
   crosshair `(490,151)` "her name was that of a bird *******".
11–13. **L1 guide** — type `sparrow` @`(235,221)` → Monnitoff letter → click letter
   `(400,250)` → "DO YOU BELIEVE IN TIME TRAVEL?" → repeat-click `(646,311)` →
   **page nav** to `/the/tangent/index.html` (remember/one/word boxes).
14–15. **Tangent** — close window 1 X `(212,262)` → Frank/"smurf" → close Frank X
   `(775,262)` → **page nav** to `/the/tangent/universe/is_unstable.html`.

Run it: `node src/cli.js` (serves nothing — start the site first, see below).

---

## Resume point — next action

**DONE this session (2026-05-31), all in `steps/donnie.steps.json`:**
- `l1-guide-circle` — 3rd crosshair `(490,151)` → "her name was that of a bird *******".
- `l1-sparrow` — type `sparrow` into the pass field at **`(235,221)`** + Enter →
  Monnitoff's letter. (The field is book.swf EditText 0120 inside the `box` clip
  placed at root (211.95,209); earlier y≈155-185 clicks hit the readonly hint
  ABOVE the real field. A per-frame loop auto-checks `pass eq "sparrow"`.)
- `l1-letter-continue` — click letter `(400,250)` → "DO YOU BELIEVE IN TIME TRAVEL ?".
- `l1-timetravel` — click the red question `(646,311)` → **NAVIGATES** to the
  tangent area (new SWF; remember/one/word boxes + Frank). runner.js now waits for
  the fresh Ruffle + re-suppresses overlays after an action-triggered nav.

Warm-start probe used: `node src/probe-l1-xhair3.js --click 490,151 --sparrow
--focus 235,221 --continue` (drives intro_short → menu → obituaries → guide →
sparrow → letter → time-travel question → tangent). Screenshots in `output/xhair3/`.

**DONE — Tangent boxes SOLVED & calibrated (2026-05-31, owner-guided + video):**
two new steps in `steps/donnie.steps.json`, both verified through the full runner.
- `tangent-remember-one-word` — close the **first** Win98 window ("remember") via
  its title-bar **X at canvas `(212,262)`**. smurf.swf has ONE Stop at the 3-window
  frame (39); closing ANY window fires button `0013` (`_visible=0; gotoAndPlay(12);
  _root.play()`) and frame 40 REMOVEs all three at once → builds the **Frank window
  (JPEG 0023) + "smurf"** (frame 48 Stop). So a single close reveals Frank — there
  is NO intermediate "only window 3 left" state in this rebuild (confirmed by the
  owner's screen recording: cursor on window-1 X → next frame all gone + Frank).
- `tangent-frank-smurf` — close the Frank window via its **X at canvas `(775,262)`**
  (≈13px left of the right border; the rightmost of `_ □ X`. NB `x≈745-758` hits
  minimize/maximize — no-op; the X is further right at ~775). Fires `_root.play()`
  → frames 49-54 → `GetUrl "universe/is_unstable.html"` → the Tangent Universe.

Two supporting runner fixes were needed to reach these in a full (non-warm-start)
run — both general, not tangent-specific:
- **`src/input.js` `type` action** now clears the field (Ctrl+A/Delete) and presses
  each char individually @120ms (was `keyboard.type` @40ms, no clear). The cold-run
  `sparrow` field needs this or `pass eq "sparrow"` never matches → flow stalled at
  the guide screen. Matches the proven probe sequence.
- **`src/runner.js`** added opt-in `step.awaitNavMs` — a grace window after the
  action for a delayed Flash `getURL` framenavigated to arrive before we treat the
  step as same-page. `l1-timetravel` also repeat-clicks the question (it fades in;
  a single early click misses the hotspot).

---

## NEXT — Tangent Universe (philosophy.swf on `is_unstable.html`) — IN PROGRESS

**Good news: this page is DRIVABLE STANDALONE.** `is_unstable.html` loads
`philosophy.swf` into `#swf` via JS on page load (autoplay on), so you can probe it
directly — NO 60s warm-start. Use `src/probe-tangent-universe.js` (edit its `CLICKS`
array, re-run; writes `output/tu/NN-{clean,grid}.png` after each click). Calibrate
fast with `node src/calibrate.js --url /the/tangent/universe/is_unstable.html
--grid 25 --wait 9000 [--click x,y]`.

**Owner's guide (2026-05-31), the intended flow:**
1. Click the **crosshair** → a Win98 window appears.
2. Click the **middle** of that window → a 2nd window appears.
3. Click the **middle** of the 2nd → a 3rd window appears.
4. Click the **middle** of the 3rd → a **GRID OF 4** windows appears.
5. Click the **bottom-right** one of the grid of 4 → *wait*.
6. The **"Philosophy of Time" chapters** appear — crosshairs **left to right**.
7. When the **password** prompt appears, it is **`smurf`**.

(`philosophy.swf` is 167f@30fps, 175KB; loads `dad/donnie/straight.swf` sub-movies
via loadMovie; has a "words" system + readonly EditText fields. The HTML also has
overlay popups: `thebook.swf` 44×44 @right39%/top20%, `gran-donnie.swf` 60%×100%
@right0, and `level2.swf` 154×44 @right80%/top64% which is an `<a href="/menu.html">`
revealed ~12s after thebook — likely the **Level 2 entry**.)

**CALIBRATED so far (probe-tangent-universe.js — all standalone, no warm-start):**
Owner confirmed the crosshair is the far-left red **diamond** (its arrow), and the
windows render in the lower-left of the canvas (the *canvas* sits top-right in the
viewport — that's what "top right" referred to). Click order is **1 → 3 → 2**, i.e.
just keep clicking each newest window's middle; they rearrange leftward each time.
- `crosshair` — far-left red diamond at canvas **(12,330)** (hit-area is tiny — (45,330)
  MISSES it) → Window 1 (lower-left).
- `win1` — **(125,360)** → Window 2 (lower-right).
- `win2` — **(562,350)** → Window 3. NB the right window's true middle is **y≈350**;
  earlier y≈375–385 clicks missed and looked like "no 3rd window appeared".
- `win3` — **(406,375)** → the **GRID OF 4** scan-lined windows forms (canvas ~x7-306,
  y21-469; 2×2).
- `grid-BR` — bottom-right of the grid **(320,370)** → philosophy.swf loads
  **gran-donnie.swf** and the HTML `[data-popup="gran-donnie.swf"]` overlay (right 60%
  of viewport) reveals. This is the gateway to the chapters.

**Dot-detector BUILT (probe-tangent-universe.js):** `detectRed()` + modes
`--observe` (wait, log red clusters, capture — no clicks) and `--chapters N`
(detect the lone red **chapter dot** and click wherever it currently is, N times).
`--band x0,x1,y0,y1` constrains detection to the chapter band so the persistent
red zigzag/glow (e.g. the (543,202) glow) doesn't win. This implements the owner's
**chapter-dot tip**: the dot's x is RANDOM each chapter, so it MUST be detected at
runtime, never hard-coded — true in the probe AND any future runner step.

**FULL remaining flow — mapped from owner's screen recording (2026-06-01,
`CleanShot…00.19.34.mp4`, frames in `/tmp/ddvid2`):**
1. After grid-BR the grid dissolves → a new "Microsoft Internet" window (centre) +
   the gran-donnie overlay, then the screen becomes the **Philosophy of Time Travel
   book**: large scattered words (*every / earth / living long / extinction /
   universe*) with the book page on the RIGHT (this is where the persistent red glow
   ~ (543,202) lives — exclude it via `--band`).
2. **Chapters** = small **red dots** that appear on the **dark LEFT side** of the
   canvas (the book page is on the right); hovering shows the chapter name. From the
   owner's page captures the dots land at varying spots but almost all on the left
   (far-left mid-height, lower-left, left edge ~x50, mid-left ~x290 over Appendix A's
   bullseye) — only *The Living Receiver* had one near the RIGHT edge. So set
   **`--band 0,330,0,500`** (left third-ish) so the detector locks the dot and
   ignores the persistent right-side glow (543,202) + zigzag. Each dot's x is random
   → MUST detect at runtime (`--chapters`), never hard-code. Full book transcribed in
   **`THE-PHILOSOPHY-OF-TIME-TRAVEL.md`** (Foreword + Ch 1,2,4,6,7,10,12 + Appendix
   A/B + Notes — chapter names there match the hover tooltips).
3. **Frank window** appears (centre): *"you found me… remember the word ?"* + a
   password field → type **`smurf`** (use the input.js `type` action w/ focusX/Y;
   the clear+slow-type fix already landed).
4. **Donnie's letter** to Roberta Sparrow unfurls, ending *"…I can **breathe** a sigh
   of relief"* — the word **breathe** is RED and clickable = the **Level 2 password**.
   Detect the red word + click it.
5. → Roberta popup / onward to **Level 2** (recall the `level2.swf` overlay is an
   `<a href="/menu.html">` revealed ~12s after thebook — likely the L2 gateway).

Detector (`detectRed` + `--observe`/`--chapters N`/`--band`) is BUILT & verified; the
chapter screen just needs to be reached, then `--chapters --band <left region>`
should hunt the dots. Frank/smurf + breathe are clear from the video above.

**⚠️ CURRENT BLOCKER (2026-06-01): the grid-of-4 → open-book transition.**
In the videos, clicking the grid's bottom-right cell makes the book ("never just die"
text → Foreword → chapters) animate in within ~4-8s. In the probe it does NOT — the
screen stays on the 4 scan-lined windows + figure (persistent reds at (543,202) glow,
(482,146), etc.; gran-donnie overlay stays up). Tried grid-BR at (320,370) and
(236,358); neither opened the book. Likely causes to investigate next session:
- The window click ORDER/middles (1→3→2) may not reproduce the exact grid end-state
  that auto-advances — coordinate reading off the dark, scaled, repositioning panels
  is imprecise and each probe run is ~90s.
- The transition may need a click on the **gran-donnie HTML overlay** (DOM click on
  `[data-popup="gran-donnie.swf"]`), not a canvas coord.
**Recommendation:** do this stretch in a HEADED browser (`npm run run:headed` or the
probe `--headed`) so coords can be read live / confirmed with the owner, rather than
blind 90s headless iterations. The detector + full flow map are ready; it's the
last-mile coordinates that need eyes-on.
- Watch the HTML overlay state machine (instrumented in the probe via `reportOverlays`):
  philosophy → loads `gran-donnie.swf` (overlay) → loads `thebook.swf` (overlay, hides
  gran-donnie) → +12s reveals `level2.swf` overlay, which is an `<a href="/menu.html">`
  — almost certainly the **Level 2 entry**. These overlays are HTML elements (z-index
  999) on top of the canvas, so they may need real DOM clicks, not canvas-coord clicks.

**Then (aid step 14 → tangent universe / Levels 2 & 3):**
- Tangent universe (`philosophy.swf`): nested popups → fading boxes →
  "remember the word?" = `smurf` → Donnie's letter → click word `breathe` →
  Roberta popup → close → Philosophy of Time Travel red dots.
- Chapter advance uses the **random "chapter dot"** (see tip at top) — detect, don't hardcode.
- Then **Levels 2 & 3** (see "Open questions").

---

## How to run / resume

```bash
cd walkthrough
npm install && npm run install:browser     # first time only
# serve the built site (separate shell):
npx http-server ../docs -p 8080            # must match config.json baseUrl

node src/cli.js                            # full run → output/walkthrough.html (+ video)
node src/cli.js --until <stepId> --grid --continue-on-error   # stateful calibration
node src/cli.js --generate-only            # rebuild HTML from output/manifest.json
node src/calibrate.js --url /intro_short.html --grid 25       # grid overlay to read coords
```

Calibration helpers: `src/scan.js` (hotspot grid), `src/words.js`+`wordclick.js`
(drifting text), red-crosshair detection is inline in several `output/` probe
scripts (grep `detectRed`). **`intro_short.html` reaches the menu in ~5s** — use
it for all menu-and-after calibration instead of the ~60s real intro.

---

## Hard-won mechanics (full detail in GUIDE.md)

- **Crosshairs, not words** are the menu buttons (words drift, are decoration).
  Click the precise red-detected centre; hover first (`hoverMs`).
- **Popups open NEW TABS**; closing them continues the game. The runner captures
  + closes them automatically. If a click seems inert, check for a popup tab.
- **Suppress Ruffle overlays** (done automatically) — the headless hardware-accel
  modal dims the stage and blocks clicks.
- **Animated screens** (scanlines, ticking counter, drifting clouds) never
  diff-settle → use `mode:fixed` or loosen `diffThreshold`. Long auto-forwards
  need a `minWaitMs` floor (e.g. detention = 42000).
- **Section pages are inert standalone** — drive sections via the live in-game flow.
- `src/images/aid/*.jpg` are per-screen reference stills; `swfdump -a docs/<f>.swf`
  reveals real navigation/buttons.

---

## Open questions for the site owner

1. **Levels 2 & 3 entry.** They're gated until the prior level is completed, and
   there are `pop/level-*.html` pages that require earlier-level passwords
   (`breathe` for L2, `rose` for L3). Need to confirm the exact entry path:
   does completing L1 unlock the L2 crosshair, or do you go via a password page?
2. **Lifeline puzzle (Level 2).** Requires the *correct* marks (wrong ones don't
   advance) — read the answer positions from `aid/lev2g.jpg` + the playthrough
   video before calibrating.
3. **Right-click "play"** is needed in Sparkle Motion (step ~32); confirm.

---

## File map

- `steps/donnie.steps.json` — the calibrated, actual-flow steps (grows as we go).
- `steps/donnie.guide.steps.json` — the original 43-step guide (reference).
- `src/` — cli, runner, settle, input, canvas, capture, diff, grid, scan, words,
  wordclick, calibrate, generate.
- `output/` — screenshots, video, manifest.json, walkthrough.html (gitignored).
- `GUIDE.md` — field manual. `README.md` — architecture.
