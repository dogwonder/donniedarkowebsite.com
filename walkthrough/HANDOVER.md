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

**▶ YOU ARE HERE (2026-06-03): FULL GAME VALIDATED END-TO-END — 42 steps, clean run to "time is up,
donnie."** A complete `node src/cli.js --headed` run drives all steps with ZERO action failures,
ZERO popup warnings, all steps settled, and captures the true ending. `output/walkthrough.html` +
session video regenerated. Now includes the OPTIONAL Philosophy-of-Time-Travel chapter crosshairs
(tu-chapter-1/2). THREE core bugs fixed this session + the chapter feature — see below.

**WHAT WAS BROKEN & FIXED (2026-06-03):**
1. **Tangent derail (the "new tabs taking us back" bug).** `l1-timetravel` repeat-clicked 5× through
   the getURL chain (book.swf → `/the/index.html` → meta-refresh → `/the/tangent/index.html` smurf.swf),
   blowing the smurf page through to `is_unstable.html` where philosophy.swf auto-played past every
   calibrated coord — bouncing the main tab to `/menu.html` and spawning runaway level-gateway tabs.
   FIX: new `stopOnNav:true` click option (`src/input.js`) halts the repeat the instant the first click
   navigates. Steps 13–22 now land correctly (smurf remember/one/word → Frank → philosophy windows →
   smurf grid → breathe → "password to level 2").
2. **L3 telephone never advanced (the real "last mile").** The OLD steps had the wrong telephone coord
   AND were MISSING the launch-document step. Owner manual-demo recorder (`src/record-sky.js` →
   `output/record-sky.log`) caught the truth: middlesex=`(665,295)`→lamp.swf, telephone=`(663,244)`→pop6,
   and the ADVANCE is a SEPARATE ">>> LAUNCH THE DOCUMENT" click at the BOTTOM `(365,452)` → phone.swf
   transcript. NEW step `l3-launch-document` + new `clickUntilNet` action (`src/input.js`) that re-clicks
   until the awaited SWF loads over the network. ✅ Works HEADLESS too — the old "HEADED-only" belief was
   a wrong-coordinate artifact, NOT a Ruffle stall.
3. **Three crash sites on nav/close races** (`suppressRuffleOverlays`, the `awaitNavMs` wait loop, and
   `settle` fixed-mode) all threw uncaught "Target page has been closed" exceptions — closing the browser
   or an auto-forward killed the whole run. FIXED: each now swallows nav/close races; `settle` fixed-mode
   polls in chunks and keeps the last good frame. Plus a generate.js EISDIR bug (empty `before` filename
   for captureBefore:false steps resolved to the screenshots DIR) — fixed in `dataUri`.

**OPTIONAL NEXT:** (a) ~~Tune `l3-ending` `fixedMs`~~ ✅ DONE 2026-06-04: converted the guessed
fixedMs:145000 to **match-reference** (reference=`assets/l3-ending-reference.png`, matchThreshold 0.15,
diffThreshold 0.01, pollIntervalMs 2000, minWait 60s, maxWait 145s fallback). Ground truth via swfdump:
phone.swf = 2739 frames @ 25fps = 109.5s; its last frame fires `_level0.gotoAndPlay('out')` → trampolin
frame 164 Stops instantly — so the ending lands ~105-110s after phone.swf is requested (measured 105.4s
and 109.7s across probe runs; `src/probe-l3-timing.js`). Threshold data: transcript-vs-reference 20-21%,
ending-vs-reference 8-10% (the red-circle cluster varies ACROSS runs but is 0.0% stable WITHIN a run;
even the 'time is up, donnie.' flicker doesn't register at pixelmatch 0.12) — 0.15 cleanly separates.
Validated end-to-end by `src/test-l3-ending.js` (drives the L3 tail standalone, then runs the REAL
resolveWait+settle with the real step config): ✅ PASS, matched at 99.7s of settle (diff 8.2%), saving
~40s/run vs the old ceiling. On a slow run (heavy capture load CAN stretch Ruffle playback well past
nominal — observed in probe run 1) it polls to the 145s fallback instead of clipping the finale.
GOTCHA for future match-reference steps here: the ending is mostly WHITE (luma ~190) — darkness/diff-
spike heuristics do NOT work; and dense polling itself slows playback (keep pollIntervalMs ≥2000).
(b′) **GOLF-TAB BEATS 28–31 — ✅ ENCODED & VALIDATED 2026-06-03 (owner-recorded, then probe-calibrated).**
Seven new steps between l2-mono-tv2 and l2-sparkle-enter (50 steps total): `l2-window-forward` (click
inside a WAKE UP DONNIE window (426,406); wait = **diff-stable freeze-settle** minWait 12s — the
sleepgolfing letters assemble then FREEZE; clicking during ASSEMBLY resets the whole sequence to
10-02-1988) → **`l2-donnie`** (the aid's literal beat-28 'click on donnie' — the blue figure (417,403) at
the frozen scene; THE missing trigger that made every earlier replay diverge) → `l2-sleepgolf-arrow`
(detectClick **color:"white"** band x735-790 — the WHITE ARROW slides along the right edge during the
crawl, y varies (seen y357/y185); poll up to 16× with a hover **sweep**, click only when detected, stop on
the wallet-question titlebar) → `l2-wallet-question-forward` (596,308; answer = `ling ling`, skippable) →
`l2-sidewalk-wallet` (597,396, titlebar-gated) → `l2-wallet-forward` (566,206 → the red-lines scene) →
`l2-redlines-article` (domClick `[data-url]` → pop4 Cunning Visions article; the 'blinking dot at the
line tip' is visually the SWF but the click target is the viewport-positioned exit overlay). GOTCHAS
BANKED: detectTitlebars gained **minWidth=110** (night scenes false-positive narrow navy runs: jeans
figure ≈11px, golf cart ≈91px) and the gates take **titlebarMaxY** (Donnie's blue shirt reads as wide
navy rows at y≥400 — real windows here are top-half). Validated end-to-end headless via
`src/test-golf-tail.js` (drives golfing/main.html standalone → pop4 opens ✓). Owner trail:
`src/record-session.js` → output/record-golf.log.
(c′) **ALL CHAPTERS — ✅ DONE 2026-06-03 (owner-driven guided capture).** AUTO-capture of all 10 crosshairs
is NOT feasible (probe `src/probe-allchapters.js`: dots are dim, random, and the SET CHANGES on every click;
detection conflates them with the scattered word-text + red zigzag). SOLUTION: `src/record-chapters.js` —
the OWNER drives is_unstable.html from the first click (NO auto-drive; early auto-drive versions kept dying
to page-close races) while every canvas click saves a brightened (3×) capture. The owner clicked all the
crosshairs (dragging Frank's password window aside by its title bar — the Win98 windows are DRAGGABLE) →
30 captures, from which the COMPLETE 12-page book was curated into **`assets/chapters/`** (committed; titles
in `index.json`): title page, Foreword, Ch 1/2/4/6/7/10/12, Appendix A, Appendix B, Notes (the names). NEW
**gallery step support**: `step.gallery` (dir rel. to the steps file) → runner passes it straight to the
manifest (no browser action); generator renders a captioned grid from index.json. Encoded as step 25
`tu-chapters-gallery` (43 steps total). FULL RUN VALIDATED 2026-06-03: 43/43, zero failures, gallery + the
"time is up, donnie" ending in `output/walkthrough.html` (19MB). To RE-capture pages: run the recorder, play
to the crosshairs, click each; copy the settled frames into assets/chapters/.
(c) **Philosophy-of-Time-Travel CHAPTER CROSSHAIRS (2-step taster) — ✅ DONE 2026-06-03 (owner-requested).** Two OPTIONAL
narrative steps `tu-chapter-1`/`tu-chapter-2` now sit between tu-breathe and l2-enter (42 steps total). The
chapter dots are SMALL red clusters (~2–6px, RANDOM position) on the LEFT, competing with a big persistent
red zigzag (~60px, lower-left); `maxPixels:20` (new on `detectRed`/`detectClick`) keeps the detector on the
dot. Owner confirmed the crosshairs stay visible with the "password to level 2" window open, so we do NOT
close it (the book renders on the RIGHT; the window's lower-left). KEY GOTCHAS solved: (1) the book renders
ALMOST BLACK → new **`brighten`** step option (`src/capture.js brightenPng` + runner) triples the after-frame
RGB so the title page / Foreword text is legible (game render unchanged); (2) clicking the SAME dot just
re-shows the same page — each click spawns a NEW dot which becomes the largest, so tu-chapter-2 uses DEFAULT
(largest) pick to land on the fresh dot → a DIFFERENT page. Result: tu-chapter-1 = title page ("THE
PHILOSOPHY OF TIME TRAVEL — Roberta Sparrow"), tu-chapter-2 = the Foreword ("I pray that this book is merely
a work of fiction…"). Which page lands is somewhat run-random (dots are random); captions cover the book
generally. New `detectClick` option `pick:"smallest"|<index>` also added. Validate fast with
`src/test-chapters.js` (drives tu-* through breathe → runs the real tu-chapter-* step actions + brighten).
Full book text: `THE-PHILOSOPHY-OF-TIME-TRAVEL.md`.
(d) Commit: 40-step flow + L3 fix on `walkthrough-full-game-fix` (`69687589`); maxPixels groundwork
(`07742301`); the chapter steps + brighten are a further commit on the same branch.

(History: 2026-06-02 = "all 3 levels encoded, 39 steps" but the full run had never completed — the
tangent derail + L3 telephone + crash races blocked it. This session closed all of them.)

(History: the 2026-06-01 milestone was "end of Level 1, 22 steps → the tangent 'password to level 2'
window"; steps `tu-window-1`…`tu-breathe` — see "BLOCKER SOLVED" + "ENCODED IN THE RUNNER".)

**Earlier checkpoint (15 steps) — reaches the Tangent Universe:**
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

**✅ BLOCKER SOLVED (2026-06-01 PM): the grid-of-4 → open-book transition.**
Two compounding causes, both now understood (probe: `src/probe-grid-book.js`):
1. **The advance is a single hidden button, `id 0104`.** The windows scene (`pop1`)
   does NOT auto-play — each click summons the NEXT window (dad → donnie → straight →
   gran-donnie; one `.swf` loads per click). After the **4th** window (gran-donnie),
   `philosophy.swf` places button `0104` on the main timeline (frame 108) and STOPS.
   That button's only action (on release) is `_root.gotoAndStop("words")` → the book
   sequence → `thebook.swf` loads → Frank's "remember the word?" prompt. Its hit-rect
   (shape 0087, a 20×20 cover scaled 8.87× at translate 346.25,378.25) is canvas
   **x[258–435], y[290–467] — center (346,378)**. Earlier `grid-BR` coords (236,358)
   missed left of it; (320,370) was inside it but failed for cause #2 ↓.
2. **The `gran-donnie` HTML overlay eats the click.** The canvas occupies viewport
   x512–1280; `[data-popup="gran-donnie.swf"]` is `right:0; width:60%` = x512–1280 at
   z-index 999 — it covers the canvas EXACTLY once gran-donnie loads (i.e. right when
   button 0104 appears). A `page.mouse.click` at button 0104 lands on this transparent
   span, never the SWF. FIX in the probe: inject `[data-popup]{pointer-events:none}`
   (`--neutralize`) so canvas clicks pass through. While gran-donnie loops, it reloads
   `gran-donnie.swf` every frame (~30/s) — that loop is just the idle windows scene
   waiting for the advance; it stops the instant button 0104 fires.
   ⚠️ **OPEN: does the REAL site (normal browser) have this same overlay-block bug?**
   A human clicking button 0104 would also hit the z-999 transparent span. If so the
   live site needs `[data-popup="gran-donnie.swf"]{pointer-events:none}` (or similar)
   — confirm with the owner / test in a real browser.

**Validated sequence (full runner-style, `src/probe-grid-book.js --neutralize --br 346,378 --extra 2`):**
crosshair (12,330) → win1 (125,360) → win2 (562,350) → win3 (406,375) [gran-donnie +
button 0104 appear] → **click button 0104 (346,378) with overlay neutralized** →
`thebook.swf` loads → **Frank "you found me… remember the word?" + password field**
(screenshot `output/gridbook/obs-06.png`). ~12s later the `level2.swf` overlay
(`<a href="/menu.html">`) reveals = the Level 2 gateway. NEXT: type `smurf` in Frank's
field → Donnie's letter → click red word `breathe` (= L2 password) → Level 2.

**Owner's video confirms the post-windows flow** (`~/Desktop/CleanShot 2026-06-01 at
11.22.00.mp4`, frames `/tmp/ddvid3`): windows → words fly in → Philosophy book builds →
Frank "remember the word?" window → after `smurf`, the **chapters** are browsable as
**red crosshair dots on the LEFT** of the canvas; click/hover a dot → its chapter NAME
shows as a tooltip (e.g. "The Artifact And The Living") and that chapter's text renders
on the book page (right). Chapter dots are at RANDOM positions (detect at runtime, per
the top-of-file tip) — `probe-tangent-universe.js --chapters --band <left region>` is the
tool. Chapter names/text match `THE-PHILOSOPHY-OF-TIME-TRAVEL.md`.

**✅ SMURF SOLVED — typing `smurf` into Frank's field commits the password.**
- The password field is **EditText id 0165** (`pass`, password); a per-frame check
  `if (this.pass eq "smurf") _root.gotoAndPlay("smurf")` advances — NO Enter needed.
- The book opens with a **~12s intro** (words → book → Frank slides in). Must WAIT for
  Frank's window before typing (`--prewait 13000`), else keystrokes are lost.
- Frank's window is **animated/repositioned**; this run titlebar was canvas x278–423,
  y~108, and the EditText box center was **(377,294)** (NOT (350,305) — that hit the
  field's bottom edge and missed). The window position can vary → **detect the navy
  titlebar at runtime** and take field center ≈ (titlebar-mid-x, titlebar-y + ~186).
- Focus was never the problem: after clicking the field `document.activeElement` is
  already `RUFFLE-PLAYER`. The ONLY bug was the click landing off the EditText hit rect.
- Proven: `node src/probe-grid-book.js --neutralize --br 346,378 --extra 1 --smurf
  --field 377,294 --focusmode none` → the 4 Smurf windows + chapter dots appear
  (`output/gridbook/obs-06.png`, matches owner's screenshot). press-per-char @150ms;
  no Ctrl+A/Delete needed (fresh field).

**Owner's videos confirm the FULL ending (clips `11.31.45`, `11.57.46` → /tmp/ddvid4,5):**
smurf → **4 Smurf windows** (+ chapter crosshair dots, left) → **click a Smurf window
several times → the grid clears to Donnie's LETTER** to Roberta Sparrow → the red word
**`breathe`** in *"I can breathe a sigh of relief"* is clickable = the **Level 2
password** → a Roberta window: *"the word you just saw is your password to level 2 …
or go on to level 2 …"* → **"go on to level 2"** navigates out (Level 2 / `/menu.html`
via the `level2.swf` overlay). Closing that window instead lets you browse the book
chapters (Level 3 clue = `rose`).

**✅ SMURFS → LETTER → BREATHE SOLVED — full tangent flow validated end-to-end.**
The letter sits UNDERNEATH the Smurf grid. Clicking a Smurf window flashes the grid
hidden for <0.5s, exposing Donnie's letter with the red word `breathe` (owner's tip).
- Smurf windows RENDER at canvas x~400–640 (button 0176 placements are parent-relative
  +~305): TL≈(415,120) TR≈(620,120) BL≈(415,385) BR≈(620,385).
- `breathe` (red) is centered canvas **(433,406)** — but it OVERLAPS the bottom-left
  Smurf window, so flash with a DIFFERENT window (top-right (620,120)) then click
  breathe, else the breathe click re-hits the window you flashed.
- Proven (works on try 1): flash-click (620,120) → wait ~120ms → click breathe
  (433,406) → the **"the word you just saw is your password to level 2 … or go on to
  level 2"** Roberta window appears (internal SWF transition — URL does NOT change, so
  don't gate on navigation). Owner's robustness tip: use a QUICK click and repeat every
  ~0.1s up to 10–20× to beat the <0.5s flash timing.
- breathe = button id 0188 (`getURL ../../../further.html`)? No — it triggers the
  internal "password to level 2" window; the actual Level-2 hop is the `level2.swf` HTML
  overlay (`<a href="/menu.html">`), already revealed ~12s after thebook. (`further.html`
  is the "read the book / close window" branch.)

**FULL VALIDATED CHAIN** (`src/probe-grid-book.js`, single run):
`--neutralize --br 346,378 --extra 1 --smurf --field 377,294 --focusmode none --letter
--smurfwin 415,385 --clickbreathe --breathe 433,406 --flashwin 620,120 --breathedelay 120`
crosshair(12,330) → win1(125,360) → win2(562,350) → win3(406,375) → button0104(346,378)
[overlay neutralized] → book → wait → smurf@(377,294) → smurf grid → flash+breathe(433,406)
→ "password to level 2" window → `level2.swf`→`/menu.html` = Level 2.

**✅ ENCODED IN THE RUNNER (2026-06-01).** 7 steps `tu-window-1…4`, `tu-open-book`,
`tu-smurf`, `tu-breathe` appended to `steps/donnie.steps.json`, validated twice via
`node src/test-tu-actions.js` (drives the REAL `performAction` against is_unstable.html
→ reaches the "password to level 2" window every run). New reusable capabilities added
for the patterns this game keeps reaching for:
- **`src/detect.js`** (NEW): `detectRed` (crosshairs / red words / chapter dots; `loose`
  mode for dim red TEXT, `band` to exclude the persistent glow) and `detectTitlebars` /
  `locateWindowField` (find a Win98 window by its navy titlebar → derive its field).
- **`src/input.js`**: new actions `detectClick` (click a runtime-detected red feature),
  `flashClick` (click-to-reveal-then-click-fast, owner's repeat-burst), and `type`
  upgraded with `locateField` (POLLS up to 18s for the window titlebar, then types into
  centre+`fieldYOffset`) + `clearFirst`/`charDelayMs`.
- **`src/runner.js`**: `step.neutralizeOverlays` injects `[data-popup]{pointer-events:none}`.
GOTCHAS baked into the step notes: the book intro time VARIES (smurf must poll for
Frank, not wait a fixed time); the Smurf-grid windows ALSO have navy titlebars so the
breathe step uses a fixed 8-tap burst, NOT `until:navytitlebar`.

**NEXT FRONTIER: Level 2** — entered via the `level2.swf` overlay (`<a href="/menu.html">`,
revealed ~12s after the book). Level 2's own puzzles (lifeline `aid/lev2g.jpg`, etc.) and
Level 3 (`rose`, via the book chapters) are not yet calibrated. A full
`node src/cli.js` run now drives homepage → … → the tangent "password to level 2" window.

---

## LEVEL 2 — first section ("sleep golfing" / the Lifeline Exercise) — MAPPED 2026-06-01

Owner-provided briefing + video (`~/Desktop/CleanShot 2026-06-01 at 11.40.20.mp4`,
87s, frames in `/tmp/ddL2`). NOT yet calibrated into steps — this is the recon map.

### ★ FULL LEVEL 2 FLOW (the aid guide is ground truth — `src/aid/aid5-7.html`, steps 23-36)

The owner pointed at `aid/`: the original walkthrough. Level 2 is FAR longer than the
golf/lifeline intro — it runs all the way to the "burn it down" Sparkle Motion ending and
back to the main menu. Per-screen reference stills are `docs/images/aid/lev2*.jpg` + `lburn*.jpg`.

- **23** golf course — red square ("don't be a prisoner of fear") → Cunningham popup.  ✅ `l2-news`
- **24** "wake up donnie!" square → stripes + 2 golfers; click the square then **the 2 golfers**.  ✅ `l2-wake`+`l2-go-level2`
- **25** chalkboard — TV → exercise #1, #2 (correct mark required; both = FEAR).  ✅ `l2-tv-exercise1`/`ex1`/`ex2`
- **26** teacher confrontation — click TV-Frank, ascii bunny, **click TV-Frank again**.  ✅ `l2-mono-tv1`/`tv2`
- **27** Frank popups spell **WAKE UP DONNIE** — **click INSIDE one of the windows → screen forwards**.  ⚠️ NOT the overlay (see below) — TODO
- **28** back to golf course, "do you think he was sleepgolfing?" — **click on donnie**.  ❌ TODO
- **29** donnie waking up — **click the white arrow** → popup "who found the wallet?" = **`ling ling`** (auto-forwards even if skipped).  ❌ TODO
- **30** sidewalk, "i've been waiting for you" — **click the o dot** → wallet popup → **click inside it**.  ❌ TODO
- **31** red lines — **click the blinking red dot at the tip of the longest line** → Cunning Visions article.  ❌ TODO → "go to next section"
- **32** **Sparkle Motion / "burn it down"** (`sparkle/motion/main.html`, `fire.swf`, `phase2_end.swf`) — click dot at top → donnie walking home; **RIGHT-CLICK → play/forward**.  ❌ TODO
- **33** auto popup of Jim's license w/ rollovers of his address (**45a rose street**, middlesex va 23245 — note `rose` = the L3 password) — **click inside the window**.  ❌ TODO
- **34** Sparkle Motion dancers / fire popups / "burn it down now you know where he lives" — **click inside popups**.  ❌ TODO
- **35** popup of donnie at the fire — **click inside popup**.  ❌ TODO
- **36** "burn it down donnie." → **auto-forwards back to the main menu** = Level 2 COMPLETE.  ❌ TODO

⚠️ **`l2-exit` (the `[data-url]` overlay → `/sparkle/motion/`) is a SHORTCUT, not the faithful path.**
It skips steps 28-31 (sleepgolfing payoff, the `ling ling` wallet, the sidewalk). The real
step-27 advance is an IN-GAME **window click** ("click inside one of the windows"); the earlier
"E-click does nothing" hunt was poking near this but used coords off the window buttons / partly
under the 44×44 `[data-url]` overlay. CALIBRATION PLAN (owner-chosen 2026-06-02): headed probe,
beat-by-beat, owner has a reference video for 28-36 (to be provided). When 28-36 are calibrated,
REVISE `l2-exit` into the proper window-click forward + the 28-36 step chain ending at `/menu.html`.

### ★★ ARCHITECTURE BREAKTHROUGH (2026-06-02 PM) — LEVEL 2 IS TWO TABS

Owner-provided reference videos: `~/Desktop/CleanShot 2026-06-02 at 12.06.56.mp4` (V1, 34s,
golf tail steps ~27-31; frames `/tmp/ddL2a4`) and `…12.07.45.mp4` (V2, 19s, sparkle/motion
finale 32-36; frames `/tmp/ddL2b`). Owner steer: **"the new tab `sparkle/motion/main.html`
gets closed by the runner."**

- **Level 2 spans TWO browser tabs.** TAB 1 = `…/golfing/main.html` (golf.swf + draw.swf lifeline
  + WAKE UP DONNIE + the red-lines scene, steps 23-31). The `[data-url]` exit overlay opens
  **TAB 2 = `/sparkle/motion/main.html`** (the "burn it down" finale, steps 32-36 → back to
  `/menu.html`). The runner/probe CLOSE popups by default (`drainPopups`) → they kill tab 2.
  Two ways to handle in the runner: (a) a new `followPopup`/`keepPopup` step flag that switches the
  active page to the popup, OR (b) **just `navigate` to `/sparkle/motion/main.html`** as its own
  step — it's drivable standalone (below), and we already drive sections by navigation (cf `l2-enter`).
  Option (b) is simpler and matches the existing pattern — RECOMMENDED.
- **`sparkle/motion/main.html` is DRIVABLE STANDALONE.** It `<embed>`s `phase2_end.swf` (800×500,
  autoplay) with NO `[data-url]`/`[data-popup]` overlay. Canvas sits **bottom-right** (`flex
  items-end justify-end`) — the coord mapper uses getBoundingClientRect so it adapts; coords are
  still canvas-local 0..800×0..500. Probe directly: `node src/calibrate.js --url
  /sparkle/motion/main.html --grid 50 --wait 7000` (output/calibrate/sparkle_motion_*). Opening is
  near-black at 7s (faint corner marks ~(215,250),(700,250)); it builds up like the other scenes.
  Section assets: `phase2_end.swf` (main) + `fire.swf`.
- **`phase2_end.swf` mechanic (aid 32-36):** click "dot at top" → donnie walking home → ~~RIGHT-CLICK
  → play~~ → Jim's license popup (45a **rose** st — L3 password) click inside → Sparkle Motion dancers
  + fire popups "burn it down" click inside → donnie-at-fire popup click inside → "burn it down donnie"
  → auto-forward to `/menu.html`.
- **✅ OPEN-Q3 RESOLVED (2026-06-02): "right-click → play" is just A LEFT-CLICK to START in the Ruffle
  rebuild.** phase2_end.swf loads PAUSED (Ruffle gates autoplay on a user gesture); a plain left-click
  on the canvas starts playback (verified `src/probe-sparkle.js --observe --clickstart 400,250`: red
  beams bloom from the bottom-right within ~2s). Right-click surfaces NO Ruffle menu here (the SWF sets
  `fscommand showmenu=false`), so the original Flash right-click→Play is N/A — the left-click gesture
  replaces it. The movie then **plays ~12s (red "burn it down" beams build) and STOPS** on the
  "donnie/red-beams" frame (date 10-21-1988; donnie bottom-right ~canvas (700,380)).
- ✅ **RESOLVED (2026-06-02): the finale AUTOPLAYS in a HEADED browser — headless was the only blocker.**
  After the start left-click, a headed run plays the WHOLE finale with NO further clicks: beams →
  Jim's license popup (45a **rose** st = L3 pw) → BURN DOWN p1-p6 grid + Sparkle Motion dancers →
  **auto-forward (getURL) to `/menu.html`** = end of Level 2. Verified: `probe-sparkle.js --observe
  --clickstart 400,250 --headed` → reds bloom bottom-right, spread across the dancers ~t16s, `url→
  /menu.html` ~t26s (owner confirmed "it appeared on its own"). ⚠️ HEADLESS Playwright-Ruffle STALLS
  on the donnie/beams frame and never advances (every click/key tried, `--resumetest`) — so **the
  walkthrough generation run MUST be headed** (`cli.js --headed`). So beats 33-36 need NO per-click
  calibration; just start-click + wait for the nav. ✅ ENCODED as `l2-sparkle-enter` (navigate to
  /sparkle/motion/main.html) + `l2-sparkle-burn` (left-click (400,250) start, `awaitNavMs:30000` →
  /menu.html). Replaced the old `l2-exit` overlay-shortcut step.
- **`src/probe-sparkle.js` (NEW):** standalone probe for the finale — `--observe [--clickstart x,y
  --startbtn left|right]`, `--rightclick` (inspects Ruffle context menu — confirmed none), and a CLICKS
  array. Writes output/sparkle/*.
- **GOLF TAB tail (steps 28-31) — partly observed:** after WAKE UP DONNIE the windows are STATIC and
  wait (tail-observe: unchanged for 18s). A window/forward click advances to the **red-lines scene**
  (black + red diagonal lines + a white dot at the line-tip ~canvas **(475,85)** = aid step 31's
  "blinking red dot at the tip of the longest line"). Whether steps 28-30 (sleepgolfing donnie-click,
  white-arrow/`ling ling` wallet, sidewalk "i've been waiting for you") are REQUIRED clicks or
  auto-pass in the rebuild is NOT yet pinned — V1 shows them as distinct screens. STILL TO CALIBRATE.
- **Probe crashes on the exit popup** (`Target page… has been closed`) because `clickCanvas` runs after
  the [data-url] click opens/navigates tab 2 and `drainPopups` tears it down — same harness bug as
  before; not a game issue. Don't drive canvas clicks after the exit.

**ENTRY FLOW (owner's notes, confirmed against the HTML):**
1. `/menu.html` → the **Level 2** crosshair is now active (clouds.swf).
2. A **Win98 modal** opens asking for a password → **`breathe`** (the L1 reward word).
3. Submitting opens a NEW TAB: `/are/you/sleep/golfing/index.html` — a **large red cross**
   centred on screen. It's a plain HTML link: `<a href="main.html" target="_blank"
   class="red-cross">`. Click it.
4. NEW TAB: `/are/you/sleep/golfing/main.html` — **this is the real Level 2.** The golf.swf
   player is positioned **bottom-left** of the viewport (`flex items-start justify-end`).

**`main.html` mechanics (read from the page source):**
- Loads `golf.swf` (800×500, renders 768×480) into `#swf` via JS, autoplay on. **DRIVABLE
  STANDALONE** — `node src/calibrate.js --url /are/you/sleep/golfing/main.html --wait 6000`
  works with no warm-start (capture in `output/calibrate/are_you_sleep_golfing_main_html-*`).
- An overlay `<a data-url href="/news/pop4.html" target="_blank">` sits at **right:36%,
  top:12.95%, 44×44, z-index 999** — hidden until **5 s after `license.swf` loads**, then
  revealed. It is the **Level-2 EXIT gateway**: **1st click** opens the pop4.html news popup
  (new tab); **2nd click** rewrites its href to **`/sparkle/motion/index.html`** and navigates
  there = the next section. (Same overlay-eats-canvas-clicks risk as the tangent — may need
  `[data-popup]/[data-url]{pointer-events:none}` neutralize for canvas clicks underneath it.)

**`golf.swf` internals (swfdump -a):** v5, 122 frames @25fps, 800×500.
- The puzzle is **Jim Cunningham's Lifeline Exercise** (`aid/lev2g.jpg` = "Welcome to the
  Jim Cunningham's Lifeline Exercise", a **FEAR |⊢———————⊣| LOVE** chalkboard spectrum with
  tick marks + a TV showing "Lifeline Exercise #N"). Instructions: *"You will be presented
  with several situations … asked to make an X on the lifeline as to the appropriate position
  between Love and Fear. Click on 'X' arrow to continue."*
- Clips: `bar` (id 0007, the spectrum), `controller` (id 0010 — the draggable X), `dates`
  (id 0016 — the ticking date counter, bottom-left). Letter-placement uses spring physics
  (`acc/vx/vy/tx/ty`, `attachMovie`+`substring`) — the sentence flies into place letter by
  letter as the X is positioned. The `id`/`_x` comparison branches pick which sentence shows.
- Sentence pool (from button constantpools): "place an x on the lifeline", "do you think he
  was sleepgolfing?", "i'm not afraid anymore", "don't be a prisoner of fear", "wake up,
  donnie!". Advance buttons: **0091** (`getURL ../../../../news/pop3.html` + part2), **0093**
  (donnie), **0122** (`go _level2` → `getURL draw.swf` into `_level2`), **0124** (`go _level3`
  → `getURL birds.swf` into `_level3`). So in-SWF there are `draw.swf` (level-2 continue) and
  `birds.swf` (level-3) branches, plus `street.swf`/`love.swf`/`fear.swf` sub-movies.

**VIDEO walkthrough beats (the intended first-section solution):**
1. ~0–10s: golf course at night, golf cart bottom-left, **date counter ticking** (10-02-1988…).
2. ~12–21s: blackboard slides up → **Lifeline instructions** (FEAR⟷LOVE bar + TV).
3. ~25–40s: **"Lifeline Exercise #2"** — situation text ("Lisa Ling finds a wallet…"); the
   **X is placed on the FEAR side** of the bar (video shows the cursor placing it left of centre).
   Multiple exercises; the video demonstrates each intended X position.
4. ~50–60s: payoff — **Donnie sleepgolfing** (figures in blue lying on the green) while the
   sentence ("do you think he was sleepgolfing?" / "wake up donnie") assembles in flying letters.
5. ~60–80s: **WAR** (big red stacked letters) + Win98 windows (wallet `sleepgolfing-wallet.jpg`,
   a fire/explosion image), a **news popup** (woman's photo → `pop3.html`/`pop4.html`).
6. ~84s: a popup/onward page (blue + orange logo) — the exit (pop4.html, then sparkle/motion).

**PROBE FINDINGS (2026-06-01, `src/probe-golf.js`, headless on main.html — drivable standalone):**
- golf.swf does NOT auto-advance — it sits on the golf-course frame waiting for clicks.
  It PRELOADS draw.swf + birds.swf at startup.
- **ARCHITECTURE (multi-SWF / multi-`_level`):** `golf.swf` (main.html) = the atmospheric
  INTRO (golf course at night, ticking `dates` counter, scattered-letter sentences, red
  "Wake Up Donnie!" text, news popups). It loads **`draw.swf` into `_level2`** (button 0122
  "go _level2") = the REAL Lifeline puzzle (FEAR↔LOVE blackboard). `draw.swf` frame labels:
  `go`/`in`/`out`/`exercise1`/`fear`/`love`/`exercise2`… ; loads `love.swf`→holder1 +
  `fear.swf`→holder2; question text from `texts.html` (`revealtext`); finishes
  `getURL street.swf`→`_level4`. `birds.swf` = ambient sound (`_level3`), not a puzzle.
  So the lev2g.jpg / video blackboard = **draw.swf**, NOT golf.swf.
- **CALIBRATED in golf.swf (intro):** a solid red **square button** is the advance/news
  control. Round 1 = **(347,364)** → opens `news/pop3.html` popup + advances to frame "part2".
  Round 2 = **(457,316)** → scene becomes red **"Wake Up Donnie!"** text over figures on the
  course. After that the simple red-square advance STOPS (no small red square appears) — the
  next interaction is the gated lifeline X placement (likely the golf→draw "go _level2" hop).
  Detector tip: red sentence text = HUGE clusters (250–340px); the advance square is ~4px —
  filter `--maxpx 40`.
- **EXIT overlay stayed hidden** the whole intro: `[data-url]` href=/news/pop4.html,
  `hidden=true` (license.swf hadn't loaded — it loads deeper in, probably during draw.swf).
- Video answer keys readable so far: **Exercise #2** ("Lisa Ling finds a wallet…") → X placed
  at the **far-left / FEAR** end of the bar (frame `/tmp/ddL2/ex_30.png`).

**✅ FULL CHAIN CALIBRATED to the post-exercise monologue (2026-06-01 PM, `src/probe-golf.js`
CLICKS array, all canvas coords, headless on main.html). Validated end-to-end in one run:**
1. golf.swf intro — click red square **(347,364)** [button 0091] → opens `news/pop3.html`
   popup + advances to frame "part2".
2. click red square **(457,316)** [button 0093] → frame "donnie" = red "Wake Up Donnie!" scene.
3. click **(277,407)** [button 0122 "go _level2"] → loads **draw.swf** into `_level2` (triggers
   love.swf/fear.swf/street.swf loads) → the **FEAR↔LOVE blackboard** instruction screen renders.
4. click the **TV** at **(623,418)** [button 0084 `_root.gotoAndPlay("exercise1")`] → **Exercise #1**
   ("Juanita … cheat on the math test").
5. **Exercise #1 = FEAR** → click the **LEFT half of the bar at (260,323)** [button 0101 →
   `_root.lifeline="fear"`] then **move the mouse off the bar (e.g. (700,120))** → `evaluate()`
   on rollOut → correct → **Exercise #2** ("Ling Ling … keeps the wallet money").
6. **Exercise #2 = FEAR** → click **(260,323)** + move away → correct → **Donnie's rebuttal
   monologue** ("well, life isn't that simple … you can't just lump everything into these 2
   categories … the whole spectrum of human emotion").
- **MECHANIC (decoded from draw.swf buttons 0101/0102):** the bar is BINARY, not positional —
  left half = button 0101 = FEAR, right half = button 0102 = LOVE. RollOver shows a "chalk" X
  that drag-follows the mouse (Mouse.hide + StartDrag); PRESS sets `_root.lifeline="fear"/"love"`;
  rollOut fires `lifeline_control.evaluate()` → `correct`/`wrong` frames (Frank "bunny" frames
  exist for feedback). So ANY click on the correct half passes — exact x doesn't matter, just
  the half. Both exercises = FEAR (owner-confirmed; video `/tmp/ddL2` ex_25=#1, ex_30=#2).

**OWNER'S FLOW for the monologue → exit tail (2026-06-01, told live):**
7. Donnie's monologue → **click the TV (623,418)** → "text filters in" → **click the TV again
   (623,418)** → advances to the **"WAKE UP DONNIE" letter-windows** screen (a 4×3 grid of Win98
   windows each holding a big red letter spelling W A K E / U P D O / N N I E).
8. **Click the "E" of DONNIE** (bottom-right of the grid) → "advances the scene" = the **exit**.

**✅ "E-CLICK BLOCKER" RESOLVED — it was a PHANTOM (2026-06-02, headed run + owner confirm).**
The earlier "E-click does not register" reading was a measurement error: the advance opens a
**NEW TAB** (sparkle/motion), so the *canvas* stays on WAKE UP DONNIE and the before/after canvas
screenshots looked identical — but it HAD proceeded. The WAKE UP DONNIE windows are just a
**backdrop**; "clicking the E" actually clicks the timed **`[data-url]` HTML exit overlay** layered
over the canvas right where DONNIE's E sits (`main.html` CSS: `right:36%; top:12.95%; 44×44; z-index:999`).
Proven in the headed run: after `mono-tv2` the overlay went `hidden=false`, then the click at canvas
**(640,220)** opened `sparkle/motion/main.html` in a new tab + rewrote the exit href to
`/sparkle/motion/index.html` (run log `output/golf/` + task log). So there is NO `_level`
click-routing bug and NO assembly-timing issue to solve.

**EXIT mechanic (verified against `main.html:151-191`):**
- The overlay is `hidden` until **5 s after `license.swf` loads** (`PerformanceObserver` → `fetch` ok →
  `setTimeout(…removeAttribute('hidden'), 5000)`). `license.swf` only loads during the **monologue TV
  clicks** (`mono-tv1`), so the exit is unavailable until after `mono-tv2`. WAIT for `[data-url]`
  `hidden=false` before clicking — don't click the E region early.
- Click handler (`clickCount`): **1st** click opens `/news/pop4.html` (news popup, new tab); **2nd+**
  click `preventDefault()`s and sets href to `/sparkle/motion/index.html` → next section. (In the run
  the click landed as a 2nd-click → went straight to sparkle/motion.)
- ⚠️ The probe CRASHED on the *next* click (exit 1, `Target page… has been closed`) only because the
  popup/navigation tore down the context mid-`drainPopups` — a probe-harness bug, NOT a game blocker.
  When encoding this step: treat the overlay click as the terminal L2 action (expect a new tab / nav),
  and stop driving canvas clicks after it.

**TO ENCODE L2 into `steps/donnie.steps.json`:** intro squares → `go-level2` (draw.swf) → TV →
ex1 FEAR → ex2 FEAR → monologue → **TV ×2 (loads license.swf)** → **poll `[data-url]` until
`hidden=false`, then DOM-click `[data-url]` (or canvas ≈(640,220)) → `/sparkle/motion/index.html`**.
Reuse `detectClick`/`type`/overlay-neutralize; bar half-click = plain canvas click + move-off; the
TV-twice are plain canvas clicks. Prefer a real **DOM click on `[data-url]`** over a canvas coord so
it's robust to canvas geometry.

The full working CLICKS chain (steps 1–6 + TV-twice) lives in `src/probe-golf.js`.

**OPEN QUESTIONS for the owner before calibrating the X placements:**
1. **The lifeline answer.** Is each X position gated to a *correct* spot (wrong = no advance),
   or does any placement advance? The video shows specific positions — need to confirm those
   are required vs. illustrative. (Open-question #2 from the top of this doc, now actionable.)
2. **Exit:** confirm the intended path out of Level 2 is the `data-url` overlay → 2nd click →
   `/sparkle/motion/index.html` (Sparkle Motion = the next/Level-3 area), not the in-SWF
   `draw.swf`/`birds.swf` `_level2`/`_level3` branches.
3. Headed vs. headless for the X-coordinate last mile (per the doc's standing recommendation).

**Probe `src/probe-grid-book.js`** now drives the whole chain with flags:
`--neutralize --br 346,378 --extra 1 --smurf --field 377,294 --letter --smurfwin X,Y
--letterclicks N`. Writes `output/gridbook/{NN-*,obs-*,smurf-*,letter-*}.png`.

**(historical) earlier blocker notes — the grid-of-4 → open-book transition:**
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

## LEVEL 3 — "from the sky" / the engine mystery (the game's ENDING) — IN PROGRESS 2026-06-02

Owner-provided reference video: `~/Desktop/CleanShot 2026-06-02 at 16.53.08.mp4` (167s; 1fps
frames `/tmp/ddL3`, 4fps `/tmp/ddL34`). Aid guide = `src/aid/aid8-9.html` (steps 37-43). Probe:
`src/probe-sky.js` (observe/clickstart/rightclick/CLICKS), output `output/sky/`.

**ENTRY:** menu → click the Level 3 "o" crosshair → password popup ("the name of the street he
lives in… like the flower") = **`rose`** → red-cross gateway `/from/the/sky/index.html` (new tab,
`<a href="main.html">`) → **`/from/the/sky/main.html`** (new tab). Two-tab pattern like L2 — drive
the finale by navigating to main.html directly (drivable standalone).

**`main.html` / `trampolin.swf`** (185f@30fps, 800×500, `<embed>` autoplay; canvas BOTTOM-LEFT via
`flex items-end`; mapper adapts). Click-driven (many Stops): autoplays a ~1.5s intro then STOPS on
the **"they made me do it"** scene (police car + men, a red figure holding a chandelier, the
date/location block center-right). Loads `lamp.swf` (chandelier) + `phone.swf` (transcript, into
`_level1`). getURL targets: `../../../news/pop6.html` (article) + `phone.swf`→`_level1`.

**CALIBRATED (standalone, probe-sky.js):**
- **`middlesex`** — click the **"Middlesex, Virginia" line** in the date/location block @ canvas
  **(615,285)** → loads `lamp.swf` = the **chandelier popup** window (canvas ~x510-660, y130-205).
  (Video g_080: cursor on Middlesex; block reads date 10-02-1990 / 2310 Powderham Drive / Sarasota
  Heights / Middlesex, Virginia.)
- **`phone`** — click the **telephone icon = CENTER of the chandelier popup** @ canvas **(610,180)**
  → opens **`news/pop6.html`** ("MISSING PLANE LOSES ENGINE" article + a JS "WARNING!" spoiler
  dialog), NEW TAB. (Owner: "click anywhere on the win98 window / the telephone in the center.")
  ⚠️ The center is ~(610,180); (600,150) was too high — hit the title bar, no-op.

**FLOW (owner-confirmed) + remaining gap:**
1. middlesex (615,285) → chandelier popup.
2. telephone center (610,180) → `pop6.html` article opens (new tab). **CLOSE pop6** (runner auto-drains).
3. **"launch the document"** (owner-shown: the red `>>> LAUNCH THE DOCUMENT` text at the BOTTOM, to the
   RIGHT of the FAA document block that appears on the canvas after the telephone click). In HEADED mode
   the trampolin movie AUTO-PROCEEDS through this — the FAA doc + launch-document appear and `phone.swf`
   loads into `_level1` (the transcript) without a separate click. `phone.html`/`transcript.html` hold the
   FAA transcript text (flashvars for phone.swf) = the engine call ("exact-replica engine fell from a
   plane that landed safely Oct 2 1988"; owner pasted full text — used for the l3-ending caption).
4. transcript plays (phone.swf in `_level1`, ~2min) → auto-changes →
5. **"time is up, donnie."** (engine + red spirals; video g_640 ~t160s) = THE END of the game.

⚠️ **FLAKY in automation (2026-06-02):** the telephone click is double-action — it ALWAYS opens pop6,
but only SOMETIMES advances trampolin to the FAA doc/transcript. One headed run (settle 12s) showed the
FAA doc + "[CALLER 1]: Hello?"; another (settle 150s) loaded NO phone.swf and stayed on the chandelier
popup the whole time. And HEADLESS never advances (like the L2 finale). So the post-telephone advance is
HEADED + non-deterministic — needs hardening (maybe wait for pop6 to fully close, or a precise/second
click, or detect the FAA doc and retry). Validate in the full headed runner, which may behave differently.

✅ **ENCODED into `steps/donnie.steps.json` (2026-06-02):** 4 steps `l3-enter` (navigate
/from/the/sky/main.html) → `l3-middlesex` (615,285) → `l3-telephone` (610,180) → `l3-ending` (none, long
wait → "time is up"). 39 steps total. The l3-ending `fixedMs:145000` (transcript duration) is a guess —
TUNE from a clean headed validation run, and HARDEN the flaky l3-telephone advance.

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
3. ~~**Right-click "play"** is needed in Sparkle Motion (step ~32); confirm.~~ ✅ RESOLVED 2026-06-02:
   it's just a LEFT-CLICK to start the paused phase2_end.swf (Ruffle autoplay gate; no context menu —
   `showmenu=false`). See the LEVEL 2 "ARCHITECTURE BREAKTHROUGH" section.

---

## File map

- `steps/donnie.steps.json` — the calibrated, actual-flow steps (grows as we go).
- `steps/donnie.guide.steps.json` — the original 43-step guide (reference).
- `src/` — cli, runner, settle, input, canvas, capture, diff, grid, scan, words,
  wordclick, calibrate, generate.
- `output/` — screenshots, video, manifest.json, walkthrough.html (gitignored).
- `GUIDE.md` — field manual. `README.md` — architecture.
