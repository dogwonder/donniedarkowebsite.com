# SWF Analysis — Donnie Darko

Reference notes for the 38 Flash files preserved from the original 2001 site. Authored after a swftools sweep on 2026-05-18.

## Overview

- **38 SWFs**, all **Flash 5** format (one generation newer than Requiem's Flash 4 — cleaner ActionScript).
- Mixed framerates: 25fps default; 30fps for the *tangent universe* character clips and a few others; **120fps** for `iseeyou.swf` and `draw.swf`.
- Built by **hi-res!** (London) — same studio as Requiem for a Dream, same `_levelN` stacking pattern.

## Architecture — multi-SWF level stacking

Same pattern as Requiem: each "section" is a *stack* of SWFs loaded concurrently into z-layers via `loadMovieNum`.

```
_level0   page-level SWF (e.g. clouds.swf served from menu.swf bootstrap)
_level1   intro / clouds
_level2   book.swf when "the book" is opened
_level3   golfing/birds.swf
_level4   golfing/street.swf
```

`menu.swf` is a 178-byte stub that immediately does `GetUrl URL:"clouds.swf" Label:"_level1"`. The visible "menu" UI is actually `clouds.swf`.

## Architecture — frameset frame targets

Same frameset legacy as Requiem. Several SWFs target named frames:

```
GetUrl URL:"pop/pop_level2.html"   Label:"top"
GetUrl URL:"go_level2.html"         Label:"top"
GetUrl URL:"close.html"             Label:"_self"
```

`top` is a custom frame name (would need suppression or a frame-named iframe in any rebuild). `_self` and `_top` are real browser targets and work fine in Ruffle.

## FSCommand calls

Donnie's SWFs explicitly request runtime config via FSCommand (Requiem doesn't):

```
GetUrl URL:"FSCommand:showmenu"    Label:"false"   # disable right-click menu
GetUrl URL:"FSCommand:allowscale"  Label:"false"   # disable Flash scaling
```

Ruffle handles both natively — no action required.

## External / out-of-flow links

| URL | Source |
|---|---|
| `http://www.hi-res.net` (target=`_blank`) | `clouds.swf`, `clouds_old.swf` |
| `mailto:cvisions@hi-res.net` | `CV/iseeyou.swf` |
| `mailto:donnie@hi-res.net` | `news/iseeyou.swf` |
| `404.html` (intentional) | `news/files/{top,side}.swf` — Easter egg, not a bug |

## Section navigation map

| Hub | Loads on `_level1` | Destinations |
|---|---|---|
| `menu.swf` | `clouds.swf` | (none — bootstrap only) |
| `intro.swf` | `clouds.swf` | `further.html` (_top) |
| `clouds.swf` | `book.swf` (level 2) | `pop/pop_level{2,3}.html` (top) |
| `book.swf` | (none) | `the/index.html` (_top) |
| `are/you/sleep/linker.swf` | (none) | `golfing/` (_top) |
| `golf.swf` | `draw.swf` (level 2), `birds.swf` (level 3) | `../../../../news/pop3.html` (top) |
| `street.swf` | (none) | `../../../../sparkle/` (_top) |
| `trampolin.swf` | `phone.swf` (level 1) | `../../../news/pop6.html` (top) |
| `philosophy.swf` | (none) | `../../../further.html` (_top) |
| `phase2_end.swf` | (none) | `../../further.html` (_top) |
| `smurf.swf` | (none) | `universe/is_unstable.html` |

## Heaviest interactive SWFs

| File | Size | Shapes | MovieClips | JPEGs | Embedded MP3s |
|---|---:|---:|---:|---:|---:|
| `from/the/sky/phone.swf` | 216KB | 0 | 17 | 0 | 17 |
| `sparkle/motion/phase2_end.swf` | 199KB | — | — | — | — |
| `intro.swf` | 198KB | 79 | 47 | 32 | 47 |
| `the/tangent/universe/thebook.swf` | 189KB | 14 | 13 | 12 | — |
| `the/tangent/universe/philosophy.swf` | 175KB | 69 | 42 | 8 | 42 |
| `clouds.swf` | 151KB | 61 | 23 | 21 | 23 |
| `from/the/sky/trampolin.swf` | 124KB | — | — | — | — |
| `book.swf` | 99KB | 73 | 23 | 8 | — |

`phone.swf` is unusual — pure MP3 dialog playback, no shapes. `intro.swf` is the most production-heavy.

## Re-running the analysis

```bash
brew install swftools           # one-time

swfdump src/swf/intro.swf | head            # header
swfextract src/swf/intro.swf                # asset inventory
swfdump -a src/swf/clouds.swf | grep -i get # navigation actions
```

Ruffle bundled via `@ruffle-rs/ruffle` (kept on whatever stable is current).
