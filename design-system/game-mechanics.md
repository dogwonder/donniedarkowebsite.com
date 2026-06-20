# donniedarkowebsite.com — Game Mechanics Guide

The companion to [`design-system.md`](design-system.md). That document is the *look*;
this one is the *play*. It catalogs every mechanic in the game — distilled from the
fully calibrated 50-step walkthrough (`walkthrough/steps/donnie.steps.json`) and the
field notes (`walkthrough/GUIDE.md`, `walkthrough/HANDOVER.md`) — as reusable design
patterns for exploring this game, extending it, or building a new one in the same
genre.

> **Genre, in one line:** a cryptic exploration puzzle disguised as a broken website.
> No inventory, no score, no instructions. The player's only verbs are *click*,
> *type*, and *wait* — and the game's entire craft is in deciding when each one is
> rewarded, ignored, or punished.

---

## 1. The core loop

Every level runs the same five-beat loop:

```
ARRIVE      a cinematic owns the screen; the player can only watch (or tap to skip frames)
EXPLORE     the screen goes quiet; one red mark is the only invitation
LEARN       clicking yields lore — an obituary, a letter, a wallet — containing a secret
PROVE       a gate demands the secret back (password, correct choice, found hotspot)
PAYOFF      the world reacts big (screen tears, windows flood in, fire), then exits
```

The loop nests: levels contain scenes, scenes contain micro-loops. The crucial
property is that **LEARN and PROVE are separated in space and time** — the answer is
never next to the question (see §3, the knowledge economy).

### The macro-structure

```
INTRO (forced cinematic, est. tone) ──► MENU (hub: 3 crosshairs, levels gate each other)
  L1: learn the world  ──reward──►  breathe  ──unlocks──►  L2
  L2: learn the villain ──reward──►  rose     ──unlocks──►  L3
  L3: the ending (almost all cinematic — the player has earned the right to watch)
```

Note the interactivity curve: L1 is the densest puzzle, L3 is nearly a film. The game
*withdraws* agency as it approaches its ending — by the finale you click once and watch
the world end. That inversion (most games escalate challenge; this one escalates
inevitability) is the signature pacing move. Keep it in a new game.

---

## 2. The mechanic catalog

Each entry: what it is → where it's proven in this game → design rules → notes for
automation/testing (the walkthrough harness must be able to drive every mechanic —
see §6).

### 2.1 The red signpost

**The single load-bearing mechanic.** Red (`--highlight`) is the only color that ever
means "clickable/significant". Everything else on screen — drifting words, figures,
decorations — is inert.

- *Proven:* menu crosshairs; obituary circles; the third "guide" crosshair that only
  appears after both obituaries; the red word `breathe` inside the letter; the
  `>>> LAUNCH THE DOCUMENT` button.
- *Rules:* one red accent per screen, maximum. The hit area can be tiny (the L2 advance
  square is ~4px; the tangent crosshair diamond misses at 33px off). Red may *appear*
  as a consequence of progress (the third crosshair) — appearance is itself feedback.
- *Decoys are legal and encouraged:* the menu's drifting `+word` labels are pure
  decoration; the seven asterisks in "her name was that of a bird `*******`" are a
  static hint, not a live field. The contract is only that red *eventually* pays off —
  not that everything enticing is red.
- *Automation:* tiny/random reds need runtime detection, not hard-coded coords
  (`detectClick` with `R>150,G<110,B<110`, band-constrained, `maxPixels` to exclude
  large red zigzags/text).

### 2.2 Hidden hotspots & invisible buttons

Progression controls that are simply *not visible*. Two flavors:

1. **The invisible advance** — a transparent button placed over a region the player
   would plausibly click anyway. Flash: hidden button `0104` (hit-rect 177×177 px)
   appears only after the 4th tangent window; clicking the grid's bottom-right fires
   `gotoAndStop("words")`. HTML idiom: `<a data-url hidden>` (~44px, `z-index:999`),
   revealed by a game event via `removeAttribute('hidden')`.
2. **The earned exit** — the hotspot doesn't exist until a condition is met
   (L2's exit overlay reveals 5s *after* `license.swf` loads, which only happens
   during the monologue TV clicks).

- *Rules:* place invisible controls where curiosity already points (center of the new
  thing, the figure, the door). Reveal on event, never on timer alone. The `hidden`
  attribute keeps them out of the tab order until earned.
- *Automation:* DOM hotspots are the robust click target (`domClick` on `[data-url]`,
  `#mark`) — canvas-relative coords drift with geometry.

### 2.3 Password gates & the glowing key word

A bare input in a Win98 window; the answer was planted earlier as *story*, often as a
single red word inside body text (the hint **is** the secret).

- *The full chain:* `sparrow` (obituary → "her name was that of a bird"), `smurf`
  (Frank hands you the word; you repeat it back later), `breathe` (red word in
  Donnie's letter → Level 2 password), `ling ling` (wallet riddle — *optional*; the
  scene forwards even unanswered), `rose` (Jim's license, 45a Rose Street → "the name
  of the street he lives in… like the flower" → Level 3).
- *Commit styles vary deliberately:* `sparrow` needs Enter; `smurf` commits live via a
  per-frame check (no Enter — typing the last letter *is* the submission, which feels
  like the site reading your mind).
- *Wrong answers:* the originals do nothing — silence as judgment.
- *Rules:* the riddle restates the clue obliquely, never verbatim. One password per
  level, used exactly once. Always set explicit input `color` (white-on-white bug on
  dark stages).

### 2.4 The hunt (randomized hotspots)

The hotspot's *position* is random per visit, so knowledge of the mechanic doesn't
trivialize the act — you must still search.

- *Proven:* the Philosophy chapter dots (random x along the left band, each click
  spawns a new dot, the freshest dot is the largest).
- *Rules:* constrain randomness to a band so the search space is fair; make the mark
  faint but unmistakable once seen; hovering may reward with a name/tooltip (the
  chapter dots show chapter titles).
- **Real randomness for humans, seeds for machines** — randomized placement accepts
  `?seed=<n>` (mulberry32) so the walkthrough is deterministic while visitors get a
  true hunt. This rule is non-negotiable for any new random mechanic (§6).

### 2.5 Win98 windows as game objects

The desktop *is* the dungeon. Windows are summonable, closable, draggable, stackable —
and each affordance is a distinct verb:

| Verb | Effect (proven) |
|---|---|
| **Close (title-bar X)** | Advances: closing any of the remember/one/word windows collapses all three and summons Frank; closing Frank's window tears the screen into the Tangent Universe. *Closing as progress* — the system fights back by mattering. |
| **Click inside the body** | Advances: the WAKE UP DONNIE letter-grid, the wallet window, the license popup. |
| **Click the newest window** | Summons the next: the tangent chain (each click on the freshest window's middle loads another sub-movie; windows rearrange leftward). A breadcrumb conga. |
| **Drag by title bar** | Real: windows can be moved aside to see what's underneath (used to read book chapters behind Frank's password prompt). Never required, always honest. |
| **The grid** | Windows snap into a 2×2/4×3 grid as a *composition* — each holding a letter (W A K E / U P D O / N N I E) or a Smurf. The desktop becomes typography. |

- *Rules:* title bars navy, bodies silver (98.css); window titles are system-voice
  UPPERCASE. The minimize/maximize buttons are honest no-ops — only X does anything.
  Close-as-advance should fire *once* per scene, not be the default verb.

### 2.6 The flash-reveal (sub-second timing puzzle)

Clicking a foreground object hides it for <0.5s, exposing what's underneath; the
player must hit the revealed target inside the flash window.

- *Proven:* clicking a Smurf window flashes the grid hidden, exposing Donnie's letter
  with the red `breathe`; the practical solve is a rapid tap-burst (~0.1s interval) on
  the target position.
- *Rules:* the reveal must repeat infinitely (no punishment for missing); the target
  must not sit under the same object you flash (breathe overlaps the bottom-left
  Smurf — flash a *different* window). Use rarely — it's the game's only
  dexterity test, and it lands precisely because everything else is patient.
- *Automation:* `flashClick` (click reveal-source, gap ~120ms, burst on target).

### 2.7 The judged choice

The one mechanic with a *wrong answer*: Cunningham's Lifeline bar. The bar reads as an
analog spectrum (FEAR ⟷ LOVE) but is secretly binary — left half / right half — and
evaluation fires on **rollOut**, when you move your cursor away. Committing by
*leaving* is a beautiful, period-true touch (you mark your X, then step back from the
chalkboard).

- *Rules:* the presented fidelity (an analog slider) can exceed the real fidelity (a
  coin flip) — players never know. Wrong answers re-ask rather than punish. Cap at
  2–3 rounds, then subvert the mechanic itself in the fiction (Donnie's rebuttal:
  *"you can't just lump everything into these two categories"* — the game critiques
  its own puzzle).

### 2.8 Cinematics & the click-tax

Three grades of "watching":

1. **Click-stepped montage** — each click advances one frame (the intro bullseye:
   ~3 clicks to the proceed screen; extra clicks are harmless no-ops). The player
   *earns* the cinematic frame by frame.
2. **The long auto-forward** — a one-time, unskippable build (the ~44s detention
   collage assembling out of drifting type; L4's count-drain). Hold these for moments
   of bureaucratic dread; never twice in a row.
3. **The terminal cinematic** — the ending plays itself (phone.swf transcript: 2739
   frames @25fps = 109.5s, then *"time is up, donnie."*). One start-click, then the
   player's hands leave the keyboard.

- *Hard-won rule:* **clicking during an assembly may reset it** (the sleepgolfing
  letters reset the whole sequence to 10-02-1988 if clicked mid-assembly). If you keep
  that behavior, it's a stern but fair "be patient" teaching device — but the settled
  state must be visually distinct from the assembling state.

### 2.9 The popup-tab economy

Lore lives in **new browser tabs** (obituaries, news articles, the Level 3 hint), and
**closing the tab continues the game**. The browser itself is diegetic.

- *Proven everywhere:* pop1–pop6, the FAA article, the Cunning Visions piece, the
  L3 password hint tab.
- *Rules:* popups are read-only lore + exactly one secret each; the main stage either
  holds still or quietly advances underneath. Multi-tab *progression* also exists
  (L2 spans two tabs: golf tab → sparkle/motion tab) — use sparingly, it's the
  hardest pattern to automate and to keep accessible.
- *Click-counting exits:* the L2 `[data-url]` overlay opens the article on click 1 and
  rewrites its href to the next section on click 2 — the same door is first a window,
  then a door.

### 2.10 Keyboard as ritual

Sparse, diegetic keyboard moments: `Y` at the terminal's `C:\>MORE ? (Y/N)` (N does
nothing — the choice is fake, the ritual is real), passwords typed character by
character.

### 2.11 The signpost withdrawn

The endgame screens remove the red. The L3 finale still has red on screen but leaves
**nothing left to click** — "the signpost is spent because the journey is over."
Withholding the system's one promise is the strongest statement the system can make.
Use exactly once, at the end.

### 2.12 The in-page timeline (task > task > task > new page)

The original's structural rhythm, inherited from the Flash timeline itself: a level
is a **linear filmstrip with Stop frames**, and each Stop is a task. The movie plays,
halts, and waits for the player's act to press play again — three, four, six times on
one page — and then a **URL navigation is the chapter break**.

- *Proven:* golf.swf chains red square → red square → "go _level2" → TV → exercise 1
  → exercise 2 → TV ×2 → window-forward → arrow → sidewalk → wallet → red lines, ALL
  on one page, before the tab break to `/sparkle/motion/`. philosophy.swf chains
  crosshair → window ×3 → grid → hidden button → book → password → flash-reveal on
  one page. (`swfdump -a` shows the skeleton: `Stop` frames = task gates,
  `gotoAndPlay` = task rewards, `getURL` = the chapter break.)
- *Rules:* cluster 3–6 tasks per page so progress feels like *advancing a film*, not
  flipping pages; spend navigation sparingly — a new URL should feel like a chapter
  heading (and reads as one, since URLs are whispered phrases). The page boundary is
  also the *save point*: sections re-enterable by URL are the calibration/testing
  seams (§6).
- *Automation:* in-page tasks gate on canvas/DOM change (`diff-stable`,
  `waitVisibleMs`); the chapter break gates on navigation (`awaitNavMs`,
  `stopOnNav`) — mixing them up is how repeat-clicks blow through pages (the
  tangent-derail bug).

### 2.13 ASCII portraiture

Characters rendered *by the system, in the system's own medium* — text. The original
drops an **ascii bunny** Frank as the lifeline exercise's feedback; the figure who
haunts the videostore-grade JPEGs suddenly speaks in the same monospace the
terminal uses. It's the document mood (§design-system.md) wearing a face.

- *Rules:* reserve it for apparitions — a character manifesting *inside* the
  machine, not decoration. Monospace font, no anti-aliasing, the original glyph
  palette (` `, `` ` ``, `.,:~^<(/C3VXgG08%B$@`). Dark-on-light for paper/terminal
  scenes, light-on-dark for void scenes. Generate from a film still (luminance →
  glyph ramp, sample rows at ~2× column pitch for character aspect).
- *Asset:* `design-system/ascii-donnie.txt` (82×52, from the classroom frame at
  t≈37min).
- *Automation-friendly by nature:* pure static text — diff-settles instantly, needs
  no reference still.

### 2.14 Audio

The original plays sound as *atmosphere and testimony*, never as a required sense:

- **Ambient layers** — golf.swf loads `birds.swf` into `_level3` purely as sound
  (night air on the golf course); a whole Flash level reserved for tone.
- **Spoken testimony** — phone.swf voice-acts the FAA transcript over ~110s; the
  L3 ending is *paced by* the audio's duration.
- **The cardinal rule, kept everywhere:** nothing gates on *hearing*. The transcript
  renders its text on screen as it plays; the dialogue is duplicated visually. Audio
  deepens; it never holds the key. (This is also the accessibility floor.)
- *Rules for new work:* one ambient bed per level at most, started by the level's
  first click (autoplay requires a user gesture — in Ruffle *and* in modern
  browsers); voice/SFX only where the fiction produces them (a phone, a TV, a
  drive-through window). Silence is the default mood — the void screens should stay
  silent.
- *Automation:* audio is invisible to image-diff. Gate audio-paced beats on the
  **known duration** (phone.swf = 2739 frames @ 25fps = 109.5s) plus a
  `match-reference` of the visual end state — never on sound itself. Headless
  runs may not render audio at all; the walkthrough must complete with sound off
  (which the cardinal rule guarantees).

### 2.15 Atmosphere mechanics (non-interactive but load-bearing)

- **The ticking counter** — live dates/seconds (`10-02-1988`, the 8,981-days counter).
  Time pressure as *mood*, never as fail state.
- **Scanlines / noise / drift** — perpetual subtle motion so the screen feels alive
  (and never diff-settles — see §6).
- **URL as whisper** — paths are narrative: `/are/you/sleep/golfing/`,
  `/from/the/sky/`. Lowercase phrases, no hyphens. A new game's
  sitemap should read as a poem.
- **The fake-out reset** — screens tear, dissolve, "destabilize"; the game pretends
  to break (THINGS AREN'T THAT SIMPLE!, the red fracture). Damage as transition.

---

## 3. The knowledge economy

The game's real currency is *facts the player carries in their head*. Map for the
original game:

```
obituary tab (pop1) ──"Roberta Sparrow"──► bird riddle ──► sparrow ──► the letter
Frank's window ──────"smurf"───────────► Frank again, later ──► smurf ──► the book
Donnie's letter ─────red word──────────► (carried across levels) ──► breathe ──► L2
wallet window ───────Jim's ID──────────► (optional) ling ling
Jim's license ───────"45a rose street"─► flower riddle ──► rose ──► L3
```

Design rules extracted:

1. **Plant before you ask, always at least one screen apart.** The longer the gap, the
   more the gate feels like memory rather than lookup (breathe spans a level boundary).
2. **The clue names the answer obliquely** ("her name was that of a bird", "like the
   flower") — solvable in one inferential hop, never zero, never two.
3. **One mandatory secret per level + optional ones** (`ling ling` forwards even if
   skipped) — optional answers reward attention without gating progress.
4. **Secrets compound into character:** every password is a noun from the fiction.
   The player finishes the game knowing the story *because* they needed it to play.

---

## 4. Pacing grammar (per level)

The rhythm that makes the loop feel like dread rather than a scavenger hunt:

| Beat | Duration | Player verb | Proven by |
|---|---|---|---|
| Cold open | 5–45s | watch / tap | intro montage |
| First quiet screen | open-ended | hunt the red | obit circles |
| Lore drop | reading time | read, close | popup tabs, the letter |
| The gate | until solved | type / choose | every password |
| Eruption | 5–15s | watch | screen tear, smurf flood, fire |
| Exit | 1 click | click | crosshair, .continue., the door |

- Alternate **dense** screens (stacked windows, flooding letters) with **void**
  screens (one mark on black). Never two dense screens consecutively.
- Sound/animation builds toward gates and erupts after them.
- Each level should teach exactly **one new verb** (L1: close-to-advance; L2: the
  judged choice; L3: nothing new — it spends what you know).

---

## 5. Building a new level

The catalog above is the parts bin; this is the assembly order. Every mechanic in §2
is composable — a new level is a fresh arrangement of red signposts, hidden hotspots,
password gates, randomized hunts, and the five-beat loop, hung on a fiction the
interface can wear.

**New-level checklist:**

1. Pick the one **new verb** the level teaches.
2. Write the **secret** first (a noun from the fiction), then the clue that plants it,
   then the gate that asks for it — at least one screen apart.
3. Storyboard to the **pacing grammar** (§4): cold open → quiet → lore → gate →
   eruption → exit. Mark which beats are dense and which are void.
4. Choose each screen's **mood** (void / document / desktop — design-system.md §1) and
   obey *one red per screen*.
5. Name the **URL as a whispered phrase**.
6. Make every random element **seedable**, every ending **static**, every animation
   **deterministic in duration** (§6).
7. Write the walkthrough **steps file before building** — if you can't express a beat
   as a step (selector/coord + action + wait condition), the beat is under-specified.
8. Build, then run the harness headless. The walkthrough is the level's test suite.

---

## 6. The automation contract

This game has a property most games don't: **a machine must be able to play it
end-to-end** (`walkthrough/` — Playwright + canvas image-diff; 50 steps, validated to
the ending). That constraint turned out to be a *design discipline*, not a tax. Rules
any new mechanic must satisfy, and the harness primitive that consumes each:

| Design rule | Why / harness primitive |
|---|---|
| Random placement takes `?seed=<n>` (mulberry32) | deterministic runs, true hunt for humans — `domClick` on the seeded element |
| Terminal states hold perfectly still | asserted via `match-reference` against a reference PNG (L3: threshold 0.15 separates transcript 20% from ending 9.6%) |
| Reveals fire on **events**, not bare timers | the harness gates on visibility (`waitVisibleMs`), not sleeps |
| Animations have deterministic durations | `fixed` waits can be derived, not guessed (compute each beat from frame counts / line cadence, never eyeball it) |
| Perpetual ambience (scanlines, counters) is *subtle* | `diff-stable` needs loose thresholds or sub-regions; a violently animated idle screen is undrivable *and* unreadable |
| Progression controls are DOM elements where possible | `domClick`/`domType` are geometry-proof; canvas coords drift |
| Flaky/late-arriving advances must be retry-safe (extra clicks = no-ops) | `clickUntilNet` (re-click until the asset loads), `repeat` + `stopOnNav` (halt the instant a click navigates) |
| Detectable features are color-contracted (the red signpost) | `detectClick` red-cluster detection with band + `minPixels`/`maxPixels` filters |
| Overlays over the stage must not eat clicks | `pointer-events:none` on decorative `[data-popup]` layers (the gran-donnie deadlock cost a day — and would block *humans* too) |

**Pitfalls bank** (each cost real hours — don't re-pay them):

- A transparent full-stage overlay at `z-index:999` silently consumes every click
  underneath (the gran-donnie deadlock; fixed on the live site).
- Clicking during a letter-assembly can hard-reset the sequence — settle-detect the
  freeze before allowing input.
- A new tab opening looks like "the click did nothing" if you only watch the canvas.
- Two different things can share a signature (Smurf windows also have navy title
  bars; Donnie's blue shirt reads as a title bar) — detection needs minimum widths
  and band constraints.
- A long animation with a brief static moment early will fool "wait until stable" —
  floor the wait (`minWaitMs`) just under the real settle time.
- Mostly-white endings defeat darkness/diff-spike heuristics; dense screenshot
  polling itself slows Ruffle playback (poll ≥2s).

---

## 7. Porting the genre to a new game

The transferable core, stripped of Donnie Darko:

1. **A fiction the interface can wear.** Win98 was 2001's "the computer itself is
   haunted". A new game needs an equivalent diegetic system (a phone OS, a CCTV grid,
   a library terminal, an email client) where windows/alerts/URLs are story.
2. **One signpost color, absolute.** Whatever the red is, it is the *only* promise
   the game ever makes — which makes withdrawing it (§2.11) available as the ending.
3. **A knowledge economy** (§3): 4–6 secrets, planted as lore, asked as gates,
   compounding into the story.
4. **The five-beat loop** (§1) per level, with an interactivity curve that *falls*
   toward the ending.
5. **One new verb per level**, drawn from (or rhyming with) the catalog in §2.
6. **The automation contract** (§6) from day one: seedable randomness, static
   terminal states, event-driven reveals, a steps file as the spec. The walkthrough
   harness (`walkthrough/src/`) is game-agnostic above the Ruffle layer — `domClick`,
   `domType`, `detectClick`, `diff-stable`, `match-reference`, and the generator all
   work on any stage the config points at.
7. **Never name the mechanic** (design-system.md §7). The moment copy says "click",
   the spell breaks.

---

*Sources: `walkthrough/steps/donnie.steps.json` (50 calibrated steps + notes),
`walkthrough/GUIDE.md`, `walkthrough/HANDOVER.md`, `walkthrough/README.md`,
`design-system/design-system.md`, `walkthrough/THE-PHILOSOPHY-OF-TIME-TRAVEL.md`.*
