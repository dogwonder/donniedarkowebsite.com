# Ruffle Walkthrough

Drives the Ruffle/Flash Donnie Darko playthrough with Playwright and auto-generates
a single self-contained illustrated HTML walkthrough — one section per step with
before/after screenshots, the action taken, and a caption. The whole session is
also recorded as video.

Because Playwright can't see *into* Flash, **all input is canvas-coordinate +
keyboard based**, and progression is **gated on canvas image-diff** (wait until the
canvas stops changing, or matches a reference still) rather than on fixed sleeps.

> **Calibrating or resuming this project? Read [`GUIDE.md`](GUIDE.md) first** — it
> has the field notes (menu crosshair mechanic, overlay suppression, the
> `intro_short.html` warm-start, section URL map, settle gotchas, and progress).

## What you're actually automating

Spare a thought for the ghost in this machine. Strip away the coordinates and the
image-diffs and what Playwright is *really* doing is playing a haunted website from
2001 — a Flash fever-dream that Hi-ReS! built to sell a film about a boy, a
doomsday rabbit, and the physics of a collapsing universe. The bot doesn't know any
of that. It just clicks where we tell it and waits for the screen to stop moving.
But the route it walks is pure Donnie Darko:

- It opens on a **bullseye** and a carousel of distorted faces, and clicks the
  target until the montage coughs up a sentence: *the Tangent Universe collapsed
  8,981 days ago.* A live counter ticks the seconds. (We can't diff a screen that
  never holds still, so we just trust the clock and move on.)
- A detention affidavit assembles itself out of drifting type — **DARKO, DONALD J.**,
  offence: *attempted escape* — and answers `Y` / `Y` to a blinking `MORE? (Y/N)`
  prompt like a kid poking at a school computer after hours.
- Then the **cloudscape**: drifting words that are pure decoration, and three red
  crosshairs that are not. Click the right cross and the sky tears open —
  *THINGS AREN'T THAT SIMPLE!*
- A thin red line leads to two obituaries. A woman's name *was that of a bird*; the
  paper says **Sparrow**. Type the bird, and a librarian's letter unfurls, forwarding
  *The Philosophy of Time Travel* with instructions to hide it where it can never be
  found. **Do you believe in time travel?**
- Click the question and the room goes dark. Three Win98 pop-ups blink awake spelling
  **remember / one / word**, and behind them — rabbit-eared, patient — stands
  **Frank**. Close a window and they all vanish; Frank leans in and gives you the
  word. The word is `smurf`. (It is always `smurf`.)
- Past Frank lies the **Tangent Universe**: a destabilised mirror-world of scan-lined
  windows that snap into a 2×2 grid; click the bottom-right and Roberta Sparrow's
  *Philosophy of Time Travel* unspools across the screen in drifting type — a Foreword
  dated **October 1944**, chapters with names like *Water and Metal* and *Dreams* that
  you reach by clicking little red dots scattered left to right (their position is
  randomised every time, so the bot has to *hunt* each one). At the end of the book,
  Frank asks again: *you found me… remember the word?* You type `smurf` —
  and the site, with a completely straight face, fills the screen with actual cartoon
  **Smurfs**. Then a handwritten letter from Donnie to Roberta, where the word
  **breathe** glows red: the key to Level 2. *(This stretch is the frontier the
  calibration is currently mapping — see `HANDOVER.md`.)* The whole book — *The
  Tangent Universe*, *Water and Metal*, *The Living Receiver*, *The Manipulated
  Dead*, *Dreams*, and the handwritten cast list — is transcribed in
  [`THE-PHILOSOPHY-OF-TIME-TRAVEL.md`](THE-PHILOSOPHY-OF-TIME-TRAVEL.md).

None of it explains itself. That was the point in 2001, and it's still the point now —
which is exactly why every step here is earned by hand, one crosshair at a time. The
passwords, for the record, are `breathe`, `sparrow`, `smurf`, `ling ling`, and `rose`;
say them in the wrong order and the universe stays sealed.

## Why screenshots, not `canvas.toDataURL`

Ruffle renders via a WebGL/wgpu backend whose drawing buffer is cleared after
compositing, so `toDataURL()` returns blank frames. We diff **Playwright element
screenshots clipped to the canvas region** instead — renderer-agnostic and reliable.
The canvas lives in the shadow DOM of `<ruffle-player>`; Playwright's CSS engine
pierces open shadow roots, so a bare `canvas` selector finds it.

## Install

```bash
cd walkthrough
npm install
npm run install:browser   # downloads the pinned Chromium
```

## Run

Serve the site first (from the repo root) so there's a URL to drive — e.g.
`npx http-server docs -p 8080`, or point `baseUrl` at your live deploy.

```bash
npm run        run            # headless, full run + HTML
npm run        run:headed     # visible browser — best while calibrating coordinates
node src/cli.js --steps steps/donnie.steps.json --out output
node src/cli.js --generate-only   # rebuild HTML from an existing output/manifest.json
```

Outputs land in `output/`:

```
output/
  screenshots/   NN-<id>-before.png / NN-<id>-after.png
  video/         <hash>.webm  (full session)
  manifest.json  machine-readable run record
  walkthrough.html   ← the deliverable (images inlined)
```

## How it works

```
config.json ─┐
             ├─► cli.js ─► runner.js ─► (per step) navigate? → action → settle → capture
steps/*.json ┘                              │            │         │          │
                                            │            │         │          └ capture.js  (clip to canvas)
                                            │            │         └ settle.js   (diff.js: pixelmatch)
                                            │            └ input.js   (canvas→page coord mapping)
                                            └ canvas.js   (wait for Ruffle ready)
                                                         ▼
                                                   manifest.json ─► generate.js ─► walkthrough.html
```

## The steps file

`steps/donnie.steps.json` is the tunable, calibrated-against-the-media part. It's
validated against `schema/steps.schema.json`. Each step:

```jsonc
{
  "id": "23",
  "section": "Level 2 — Sleep Golfing",     // groups steps under a heading
  "caption": "Click the red square…",         // shown in the walkthrough
  "navigate": "/are/you/sleep/golfing/index.html", // optional: load a URL first (page/SWF boundary)
  "action": { "type": "click", "x": 400, "y": 250 }, // canvas-LOCAL coords (0..800 x 0..500)
  "wait":   { "mode": "diff-stable", "maxWaitMs": 12000 }
}
```

**Action types:** `click` · `doubleclick` (with `button: left|right`) · `move` ·
`drag` (with `to`) · `key` (`key: "Enter"`) · `type` (`text`, optional `focusX/Y`
to click a field first, `pressEnter`) · `none` (navigate/observe-only).

**Wait modes:**
- `diff-stable` — proceed once the canvas is unchanged for `stableFrames`
  consecutive samples (within `diffThreshold`), or `maxWaitMs` elapses.
- `match-reference` — proceed once the canvas matches `reference` (a PNG of the
  settled end-state) within `matchThreshold`. Drop your reference stills next to
  the steps file and point `reference` at them.
- `fixed` — just wait `fixedMs` (avoid; use only where diffing is impractical).
- `none` — don't wait.

Thresholds layer: `config.json` `settle` ◄ steps `defaults` ◄ per-step `wait`.

## Calibrating

The current `steps/donnie.steps.json` is **pre-filled from the 43-step guide
(`src/aid/aid1.html … aid9.html`)** with real captions, section grouping, and
best-guess `navigate` URLs — but **every coordinate is a placeholder** and several
steps need splitting (notes in each step say which). To calibrate:

1. `npm run run:headed` and watch where clicks land.
2. Read coordinates off the stills/video (canvas-local, 0..800 × 0..500).
3. For animation-gated steps, drop a reference still and switch `wait.mode` to
   `match-reference`, or tune `diffThreshold` / `stableFrames` / `maxWaitMs`.
4. Re-run; iterate on layout with `--generate-only`.

> Multi-page note: the playthrough crosses several page/SWF boundaries (the
> original site uses URL redirects as a game mechanic). Those are handled by
> `navigate` on the first step of each section; within a section, clicks drive the
> in-Flash navigation. Verify each `navigate` URL against the running site.
