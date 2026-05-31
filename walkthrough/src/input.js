// Execute a step's action against the canvas. All pointer coordinates are
// canvas-local and converted to page coordinates via the mapper.
//
// Keyboard note: Ruffle routes key events to the focused player element. For
// key/type actions you can supply focusX/focusY to click a text field first.

import { makeCoordMapper, canvasLocator } from "./canvas.js";

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
      for (let r = 0; r < repeat; r++) {
        if (hoverMs) {
          await page.mouse.move(x, y);
          await page.waitForTimeout(hoverMs);
        }
        if (action.type === "doubleclick") await page.mouse.dblclick(x, y, opts);
        else await page.mouse.click(x, y, opts);
        if (r < repeat - 1) await page.waitForTimeout(interval);
      }
      log(`${action.type} ${button} @ canvas(${action.x},${action.y})${repeat > 1 ? ` ×${repeat}` : ""} → page(${Math.round(x)},${Math.round(y)})`);
      const verb = action.type === "doubleclick" ? "double-click" : "click";
      return `${button === "left" ? "" : button + "-"}${verb}${repeat > 1 ? ` ×${repeat}` : ""} at (${action.x}, ${action.y})`;
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
      await focusIfRequested(page, canvas, ruffleCfg, action, map);
      // Clear any residual content first — a Flash EditText that auto-checks
      // `pass eq "sparrow"` every frame fails if earlier keystrokes left text in
      // the field. Then press each char individually with a Flash-friendly dwell;
      // keyboard.type's fast batched input can drop keystrokes on a Ruffle
      // EditText. (Proven sequence from probe-l1-xhair3, which commits reliably.)
      await page.keyboard.press("Control+a");
      await page.keyboard.press("Delete");
      await page.waitForTimeout(120);
      for (const ch of action.text) {
        await page.keyboard.press(ch);
        await page.waitForTimeout(120);
      }
      if (action.pressEnter) await page.keyboard.press("Enter");
      log(`type: "${action.text}"${action.pressEnter ? " + Enter" : ""}`);
      return `type “${action.text}”${action.pressEnter ? " and press Enter" : ""}`;
    }

    default:
      throw new Error(`Unknown action type: ${action.type}`);
  }
}

async function focusIfRequested(page, canvas, ruffleCfg, action, map) {
  if (typeof action.focusX === "number" && typeof action.focusY === "number") {
    const { x, y } = map(action.focusX, action.focusY);
    // Ruffle only delivers keystrokes when the player element holds DOM focus,
    // so focus the canvas FIRST, then click the field so Flash sets EditText
    // focus last (proven order from probe-l1-xhair3). Clicking before focusing
    // can leave the canvas unfocused → typed text never reaches the field.
    try { await canvasLocator(page, ruffleCfg).focus({ timeout: 1000 }); } catch { /* best-effort */ }
    await page.mouse.click(x, y);
    await page.waitForTimeout(300);
  } else {
    // Best-effort: focus the player element so key events reach Ruffle.
    try {
      await canvasLocator(page, ruffleCfg).focus({ timeout: 1000 });
    } catch {
      /* focus is best-effort; some Ruffle builds focus the inner canvas only */
    }
  }
}
