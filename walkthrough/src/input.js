// Execute a step's action against the canvas. All pointer coordinates are
// canvas-local and converted to page coordinates via the mapper.
//
// Beyond the primitive pointer/keyboard actions, this game keeps reaching for a few
// COMPOUND mechanics, captured here as reusable action types so steps stay declarative:
//   • detectClick — click a runtime-DETECTED red feature (menu crosshair, the
//     "time travel?" question, a chapter dot, the red `breathe` word). Robust to the
//     feature drifting / fading in; falls back to a fixed coord.
//   • flashClick — click a "flash" point to briefly reveal something, then quickly
//     click a target underneath. The Smurf grid hides for <0.5s on click, exposing
//     Donnie's letter where the red `breathe` word lives; repeat fast to beat the
//     timing (owner's tip: tap every ~0.1s up to ~15×). Optionally stops as soon as
//     the result window (a navy Win98 titlebar) appears.
//   • type — into a Ruffle EditText; can LOCATE the field from the window's navy
//     titlebar at runtime (windows reposition between runs), so coords don't drift.
//
// Keyboard note: Ruffle routes key events to the focused player element. Clicking a
// field focuses the <ruffle-player> host (activeElement === RUFFLE-PLAYER), after
// which keystrokes reach the EditText — provided the click lands on its hit rect.

import { makeCoordMapper, canvasLocator } from "./canvas.js";
import { captureCanvas } from "./capture.js";
import { detectRed, detectTitlebars, locateWindowField } from "./detect.js";

/**
 * @param {import('playwright').Page} page
 * @param {import('playwright').Locator} canvas
 * @param {object} ruffleCfg
 * @param {object} action  step.action
 * @returns {Promise<string>} a human-readable description of what was done
 */
export async function performAction(page, canvas, ruffleCfg, action, log = () => {}) {
  if (!action || action.type === "none") return "(no input — navigate/observe only)";

  if (action.delayBeforeMs) await page.waitForTimeout(action.delayBeforeMs);

  const map = await makeCoordMapper(canvas, ruffleCfg);

  switch (action.type) {
    case "click":
    case "doubleclick": {
      const { x, y } = map(action.x, action.y);
      const button = action.button ?? "left";
      const opts = { button };
      const repeat = Math.max(1, action.repeat ?? 1);
      const interval = action.repeatIntervalMs ?? 2000;
      // Flash buttons often need a rollover (mouseover) to activate before the
      // release fires. hoverMs moves the pointer onto the target and dwells there
      // so the button enters its "over" state before we click.
      const hoverMs = action.hoverMs ?? 0;
      // stopOnNav: for fade-in hotspots that need several taps to register but then
      // NAVIGATE (e.g. a Flash getURL chain). Once the URL changes, further taps would
      // land on the NEXT page and blow it through — so halt the repeat the moment the
      // first click takes effect. The clicks themselves may also race the navigation
      // tearing down the context; swallow that and stop.
      const startUrl = action.stopOnNav ? page.url() : null;
      for (let r = 0; r < repeat; r++) {
        if (action.stopOnNav && r > 0 && page.url() !== startUrl) break;
        try {
          if (hoverMs) {
            await page.mouse.move(x, y);
            await page.waitForTimeout(hoverMs);
          }
          if (action.type === "doubleclick") await page.mouse.dblclick(x, y, opts);
          else await page.mouse.click(x, y, opts);
        } catch (err) {
          if (action.stopOnNav && /closed|navigation|context was destroyed/i.test(err.message)) break;
          throw err;
        }
        if (r < repeat - 1) await page.waitForTimeout(interval);
      }
      log(`${action.type} ${button} @ canvas(${action.x},${action.y})${repeat > 1 ? ` ×${repeat}` : ""} → page(${Math.round(x)},${Math.round(y)})`);
      const verb = action.type === "doubleclick" ? "double-click" : "click";
      return `${button === "left" ? "" : button + "-"}${verb}${repeat > 1 ? ` ×${repeat}` : ""} at (${action.x}, ${action.y})`;
    }

    case "clickUntilNet": {
      // Click a hotspot that fires an unreliable Flash getURL/loadMovie, RETRYING
      // until the awaited resource actually loads (detected via a network request).
      // The L3 telephone is the case this exists for: every click opens the pop6
      // news tab, but the `getURL phone.swf → _level1` (the FAA transcript) only
      // fires SOMETIMES — so we re-click until `phone.swf` is requested. Each click
      // spawns a pop6 tab; we close stray tabs between attempts (the owner's "click
      // again with pop6 closed"). The runner's own popup drain captures pop6 once.
      const { x, y } = map(action.x, action.y);
      const target = action.until;                 // substring matched against request URLs
      const maxClicks = Math.max(1, action.maxClicks ?? 6);
      const gapMs = action.gapMs ?? 4000;
      const hoverMs = action.hoverMs ?? 0;
      const ctx = page.context();
      let hit = false;
      const onReq = (req) => { if (target && req.url().includes(target)) hit = true; };
      page.on("request", onReq);
      let clicks = 0;
      try {
        for (let r = 0; r < maxClicks && !hit; r++) {
          // Close stray popup tabs from the previous attempt (keep the main page).
          for (const p of ctx.pages()) if (p !== page) { try { await p.close(); } catch { /* gone */ } }
          if (hoverMs) { await page.mouse.move(x, y); await page.waitForTimeout(hoverMs); }
          try { await page.mouse.click(x, y); } catch (e) { if (!/closed|navigation|destroyed/i.test(e.message)) throw e; }
          clicks++;
          try {
            for (let w = 0; w < gapMs && !hit; w += 200) await page.waitForTimeout(200);
          } catch (e) {
            if (/closed|navigation|destroyed/i.test(e.message)) break; // page torn down between clicks
            throw e;
          }
        }
      } finally {
        page.off("request", onReq);
      }
      log(`clickUntilNet @ canvas(${action.x},${action.y}) ×${clicks} → ${target} ${hit ? "loaded ✓" : "NOT loaded ✗ (gave up)"}`);
      return `click (${action.x}, ${action.y}) until ${target} loads${hit ? "" : " (did not load)"}`;
    }

    case "move": {
      const { x, y } = map(action.x, action.y);
      await page.mouse.move(x, y);
      log(`move @ canvas(${action.x},${action.y})`);
      return `move cursor to (${action.x}, ${action.y})`;
    }

    case "drag": {
      const from = map(action.x, action.y);
      const to = map(action.to.x, action.to.y);
      await page.mouse.move(from.x, from.y);
      await page.mouse.down();
      await page.mouse.move(to.x, to.y, { steps: action.dragSteps ?? 12 });
      await page.mouse.up();
      log(`drag canvas(${action.x},${action.y}) → (${action.to.x},${action.to.y})`);
      return `drag from (${action.x}, ${action.y}) to (${action.to.x}, ${action.to.y})`;
    }

    case "key": {
      await focusIfRequested(page, canvas, ruffleCfg, action, map);
      await page.keyboard.press(action.key);
      log(`key press: ${action.key}`);
      return `press “${action.key}”`;
    }

    case "type": {
      // Optionally locate the field from the window's navy titlebar at runtime, so a
      // repositioning pop-up doesn't break a hard-coded focus coord. POLL for it —
      // the target window can take a variable few seconds to animate in (e.g. Frank's
      // password window after the book's ~12-18s build), so a fixed wait is fragile.
      if (action.locateField) {
        const deadline = Date.now() + (action.waitForFieldMs ?? 18000);
        let f = null;
        do {
          const frame = await captureCanvas(page, canvas, ruffleCfg);
          f = locateWindowField(frame, ruffleCfg.canvasSize, {
            yOffset: action.fieldYOffset ?? 186,
            pick: action.fieldPick ?? 0,
          });
          if (!f && Date.now() < deadline) await page.waitForTimeout(500);
        } while (!f && Date.now() < deadline);
        if (f) { action = { ...action, focusX: f.x, focusY: f.y }; log(`type: located field via titlebar → (${f.x},${f.y})`); }
        else if (typeof action.focusX !== "number") {
          throw new Error(`type: no window titlebar found within ${action.waitForFieldMs ?? 18000}ms and no static focusX/focusY fallback`);
        } else log(`type: no titlebar found; using static focus (${action.focusX},${action.focusY})`);
      }
      await focusIfRequested(page, canvas, ruffleCfg, action, map);
      // A Flash EditText that auto-checks `pass eq "..."` every frame fails if earlier
      // keystrokes left text behind, so clear first by default. Then press each char
      // individually with a Flash-friendly dwell — keyboard.type's fast batched input
      // can drop keystrokes on a Ruffle EditText. Per-frame-check fields commit on
      // match (no Enter needed); set pressEnter for fields that require it.
      if (action.clearFirst !== false) {
        await page.keyboard.press("Control+a");
        await page.keyboard.press("Delete");
        await page.waitForTimeout(120);
      }
      for (const ch of action.text) {
        await page.keyboard.press(ch);
        await page.waitForTimeout(action.charDelayMs ?? 120);
      }
      if (action.pressEnter) await page.keyboard.press("Enter");
      log(`type: "${action.text}"${action.pressEnter ? " + Enter" : ""}`);
      return `type “${action.text}”${action.pressEnter ? " and press Enter" : ""}`;
    }

    case "detectClick": {
      // Click a runtime-detected red feature. `detect` defaults to red; `band`
      // restricts the search (canvas coords) so a persistent glow elsewhere doesn't
      // win; `loose` catches dim red TEXT. Falls back to (x,y) if nothing detected.
      const repeat = Math.max(1, action.repeat ?? 1);
      const interval = action.repeatIntervalMs ?? 0;
      const hoverMs = action.hoverMs ?? 250;
      let desc = "(no red feature found)";
      for (let r = 0; r < repeat; r++) {
        const frame = await captureCanvas(page, canvas, ruffleCfg);
        const reds = detectRed(frame, ruffleCfg.canvasSize, {
          band: action.band ?? null,
          loose: action.loose ?? false,
          minPixels: action.minPixels ?? 4,
          maxPixels: action.maxPixels ?? Infinity, // cap so a big persistent red graphic (zigzag/glow) doesn't outrank a small chapter dot
        });
        // `pick` chooses WHICH detected cluster: default largest (reds[0]); "smallest"
        // (reds[last]) deliberately targets a DIFFERENT feature than a largest-pick step
        // would — used so a second chapter-crosshair click lands on a fresh dot (a new
        // page) instead of re-hitting the same dominant one. A number indexes directly.
        let target = reds[0];
        if (reds.length) {
          if (action.pick === "smallest") target = reds[reds.length - 1];
          else if (typeof action.pick === "number") target = reds[Math.min(action.pick, reds.length - 1)];
        }
        if (!target && (typeof action.x === "number")) target = { canvasX: action.x, canvasY: action.y };
        if (target) {
          const { x, y } = map(target.canvasX, target.canvasY);
          if (hoverMs) { await page.mouse.move(x, y); await page.waitForTimeout(hoverMs); }
          await page.mouse.click(x, y);
          desc = `click detected red at (${target.canvasX}, ${target.canvasY})`;
          log(`detectClick → canvas(${target.canvasX},${target.canvasY}) [${reds.length} cluster(s)]`);
        } else {
          log(`detectClick: nothing detected and no fallback coord`);
        }
        if (r < repeat - 1) await page.waitForTimeout(interval);
      }
      return desc;
    }

    case "flashClick": {
      // Click `flash` to briefly hide an overlay, then click `target` underneath.
      // Repeat fast to beat a sub-second reveal. Optionally stop early once a result
      // window appears (`until: "navytitlebar"`), to avoid over-clicking past success.
      const flash = action.flash;       // {x,y} — the thing you click to reveal
      const repeat = Math.max(1, action.repeat ?? 12);
      const gapMs = action.gapMs ?? 90;      // reveal → target-click delay
      const intervalMs = action.intervalMs ?? 110; // between attempts (owner: ~0.1s)
      let resolvedTarget = action.target ?? null;   // {x,y} or null → detect red
      let did = 0, stopped = false;
      for (let r = 0; r < repeat; r++) {
        const fp = map(flash.x, flash.y);
        await page.mouse.click(fp.x, fp.y);
        await page.waitForTimeout(gapMs);
        // Resolve the target: a fixed coord, or detect the red word during the flash.
        let t = resolvedTarget;
        if (!t) {
          const frame = await captureCanvas(page, canvas, ruffleCfg);
          const reds = detectRed(frame, ruffleCfg.canvasSize, { band: action.band ?? null, loose: action.loose ?? true });
          if (reds[0]) t = { x: reds[0].canvasX, y: reds[0].canvasY };
        }
        if (t) {
          const tp = map(t.x, t.y);
          await page.mouse.click(tp.x, tp.y);
          did++;
        }
        if (action.until === "navytitlebar") {
          const frame = await captureCanvas(page, canvas, ruffleCfg);
          if (detectTitlebars(frame, ruffleCfg.canvasSize).length > 0) { stopped = true; }
        }
        if (stopped) { log(`flashClick: result window detected after ${r + 1} attempt(s)`); break; }
        if (r < repeat - 1) await page.waitForTimeout(intervalMs);
      }
      log(`flashClick: flash(${flash.x},${flash.y}) → target${resolvedTarget ? `(${resolvedTarget.x},${resolvedTarget.y})` : "(detected)"} ×${did}${stopped ? " (stopped early)" : ""}`);
      return `reveal-and-click (${did} taps)`;
    }

    case "domClick": {
      // Click a real HTML element (CSS selector), NOT a canvas coord. Some sections
      // gate progress on a transparent HTML <a> overlay floated over the Ruffle stage
      // (z-index 999) — e.g. Level 2's `[data-url]` exit link, revealed a few seconds
      // after license.swf loads. Clicking the DOM element is robust to canvas geometry
      // and to the overlay sitting on top of the SWF. `waitVisibleMs` polls for the
      // element to become visible first (it starts `hidden`); `repeat` re-clicks (the
      // exit link rewrites its own href on the 2nd click).
      const selector = action.selector;
      if (!selector) throw new Error("domClick: action.selector is required");
      if (action.waitVisibleMs) {
        await page.waitForSelector(selector, { state: "visible", timeout: action.waitVisibleMs })
          .catch(() => log(`domClick: ${selector} not visible within ${action.waitVisibleMs}ms — clicking anyway`));
      }
      const repeat = Math.max(1, action.repeat ?? 1);
      const interval = action.repeatIntervalMs ?? 600;
      for (let r = 0; r < repeat; r++) {
        await page.click(selector, { timeout: action.timeoutMs ?? 5000, force: action.force ?? false });
        if (r < repeat - 1) await page.waitForTimeout(interval);
      }
      log(`domClick ${selector}${repeat > 1 ? ` ×${repeat}` : ""}`);
      return `click the “${selector}” element${repeat > 1 ? ` ×${repeat}` : ""}`;
    }

    default:
      throw new Error(`Unknown action type: ${action.type}`);
  }
}

async function focusIfRequested(page, canvas, ruffleCfg, action, map) {
  if (typeof action.focusX === "number" && typeof action.focusY === "number") {
    const { x, y } = map(action.focusX, action.focusY);
    // Ruffle only delivers keystrokes when the player element holds DOM focus, so
    // focus the player FIRST, then click the field so Flash sets EditText focus last.
    // Clicking before focusing can leave the player unfocused → text never lands.
    try { await canvasLocator(page, ruffleCfg).focus({ timeout: 1000 }); } catch { /* best-effort */ }
    await page.mouse.click(x, y);
    await page.waitForTimeout(300);
  } else {
    try { await canvasLocator(page, ruffleCfg).focus({ timeout: 1000 }); } catch { /* best-effort */ }
  }
}
