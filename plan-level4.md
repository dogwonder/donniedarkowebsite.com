# Level 4 — "Cellar Door" (plan & as-built record)

> Status: **BUILT & VERIFIED** 2026-06-04 (standalone walkthrough green, ending
> ref-asserted at diff 0.00%). One item outstanding — see [Remaining work](#remaining-work).

## Context

The site's three Flash levels end terminally: `/from/the/sky/main.html` settles on
*"time is up, donnie"* with no exit. Level 4 is a proof of concept that the original's
game mechanics work in pure HTML/CSS/JS (no Flash/Ruffle), styled to be indistinguishable
from the 2001 Hi-ReS! original, and driven headless by the same Playwright walkthrough
harness.

**It is NOT canon.** The 2001 site had three levels. Level 4 is therefore:
- kept **out of** the canon walkthrough (`walkthrough/steps/donnie.steps.json` untouched);
- documented by its **own standalone walkthrough**: `walkthrough/steps/l4.steps.json`
  → `walkthrough/output-l4/walkthrough.html`.

## Design decisions (agreed)

| Decision | Choice |
|---|---|
| Theme | **Cellar Door** — post-collapse Primary Universe, Oct 2 1988; Roberta Sparrow half-remembers; Karen Pomeroy's "two most beautiful words" |
| Password | `cellar door` (joins breathe / ling ling / rose) |
| Entry | Hidden hotspot on the L3 ending (golf-page `[data-url]` pattern, no SWF edits) |
| Scope | 6 scenes, 12 walkthrough steps |
| Randomness | Real `Math.random` for visitors; `?seed=<n>` (mulberry32) pins it for the harness — seed propagated across scene links |

## The level (as built)

| # | URL | Mechanic | Beat |
|---|---|---|---|
| 1 | `/cellar/door/index.html` | Assembling type + fade-in red `.continue.` | `10 . 02 . 1988` — the reset |
| 2 | `/cellar/door/letter.html` | Drifting heading + assembling letter; `cellar door` ignites red on completion; seal hotspot reveals | Roberta Sparrow's letter |
| 3 | `/cellar/door/sparrow.html` | **Randomized** 44px hotspot hunt (band x 180–620, y 140–360); flicker on hover | Find the door — it moved |
| 4 | `/cellar/door/frank.html` | Win98 window chain (positioned **inside** the stage, not Alpine modals): WARNING! → FRANK (flicker + `28:06:42:12`) → `>> say the words` | Frank crosses over |
| 5 | `/cellar/door/whisper.html` | Password gate; wrong answer = native `alert` | "say the words" |
| 6 | `/cellar/door/end.html` | One-shot door-of-light reveal + assembling outro; holds perfectly static | Terminal state, ref-asserted |

Shared JS: `src/scripts/level4.js` (`mulberry32`, `placeHotspot`, `propagateSeed`,
`animateText` with tunable cadence — splits on `/\s+/`). Included per-page (not in the
`app.min.js` concat).

### L3 → L4 bridge

`src/pages/from/the/sky/main.html`: hidden `<a data-url hidden href="/cellar/door/index.html">`
(48×48, transparent, lower-left `left:5%; bottom:12%`), revealed by a `PerformanceObserver`
watching for **phone.swf** + a **108s** timer (the ending lands ~105s after phone.swf is
requested; phone.swf ≈ 109.5s). Deliberately **no blind fallback timer** — phone.swf only
loads near the endgame, so the hotspot can never appear mid-level.

## Harness changes (walkthrough/)

The harness now drives HTML-native pages; the Ruffle path is unchanged:

- `src/canvas.js` — `hasRuffle(page)` (checks `window.RufflePlayer`) and
  `waitForStageReady()`: Ruffle pages → canvas; HTML pages → the `.aspect-ratio` stage div
  (config `ruffle.htmlStageSelector`). Since the stage div shares the authored 800×500
  geometry, capture / coord-mapping / settle work unchanged (768×480 at the reference viewport).
- `src/runner.js` — three readiness call sites now route through `waitForStageReady`.
- `src/input.js` — new `domType` action (DOM input typing, optional `pressEnter` /
  `submitSelector`); coord-mapper skipped for `domClick`/`domType`.
- `schema/steps.schema.json` — action enum updated to reality (+ `domClick`, `domType`,
  `selector`, `waitVisibleMs`, `submitSelector`).
- `steps/smoke-html.steps.json` — harness regression smoke test against an existing
  HTML page (`/missing/from/the/sky/document.html`).

### Hard-won gotchas (encoded in steps/notes)

1. `.interlace` (`width/height: 100%`) fights the stage geometry → page-scoped scanline
   `::before` + explicit `aspect-ratio: 800/500` instead; `pointer-events: none` so the
   overlay never eats clicks.
2. `animateText` must split on `/\s+/` — HTML indentation becomes invisible "words" that
   stall assembly and fool diff-stable.
3. Tiny assembling words (<0.1% of stage pixels) slip under the default 0.25% settle
   threshold → `diffThreshold: 0.0008` on observe steps, or `fixed` waits where the tail
   tokens are sub-threshold (the letter).
4. `<span>`s don't survive word-splitting → recolor key words via post-assembly
   `innerHTML.replace`.
5. `body.dark` renders input text white-on-white → explicit `color: #000` on the field.
6. Typed-password money shot: `domType` **without** `pressEnter`, then a separate
   `key: Enter` step (focus persists in the input).

## Verification

```bash
npm run build
npx http-server docs -p 8090          # matches walkthrough/config.json baseUrl
cd walkthrough
node src/cli.js --steps steps/l4.steps.json --out output-l4
```

Last full run: 12/12 steps pass; `l4-ending` **matched reference (diff 0.00%)** against
`walkthrough/assets/l4-ending-reference.png` (captured from a verified seed=42 run).

## Discoverability (the level is a secret)

Audited; the cellar door is not discoverable through any normal surface:
- Site is globally `noindex` (`base.html`); no sitemap.xml is generated.
- `src/_data/sitemap.json` / `urls.html` list only legacy-site URLs — no cellar entries.
- No menu, nav, or page links to `/cellar/door/` anywhere.
- The bridge hotspot has the `hidden` attribute until the L3 ending completes — out of
  the tab order and accessibility tree, invisible, unclickable.
- Residual surface: view-source / the public repo — the same exposure as every other
  secret on this recreation (the level passwords are in the walkthrough README).

## Remaining work

- [ ] **Validate the bridge live**: play (or run) L3 to "time is up, donnie" with the
      hotspot in place; confirm the 108s reveal timing and tune the `left:5%/bottom:12%`
      position against the actual ending frame.
- [ ] Optional polish: photographic backdrops for letter/cellar scenes (currently pure CSS).
