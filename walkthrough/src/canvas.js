// Locating Ruffle's canvas, waiting for it to be ready, and mapping
// canvas-local coordinates to absolute page coordinates.
//
// Ruffle renders into a <canvas> inside the shadow DOM of a <ruffle-player>
// custom element. Playwright's CSS engine pierces open shadow roots, so a bare
// `canvas` selector reaches it. We screenshot the canvas region (rather than
// reading canvas.toDataURL) because Ruffle uses a WebGL/wgpu backend whose
// drawing buffer is cleared after compositing — toDataURL would come back blank.

/**
 * Suppress Ruffle's UI overlay modals (hardware-acceleration warning, save
 * manager, volume, unmute, etc.) by injecting !important CSS into each player's
 * shadow root. The hardware-acceleration modal is a headless/software-rendering
 * artifact that dims the stage, pollutes screenshots, AND intercepts clicks as a
 * modal — so we kill it. Idempotent; safe to call after every (re)load.
 */
export async function suppressRuffleOverlays(page) {
  // Best-effort, cosmetic CSS injection. A click that triggers a Flash
  // loadMovie / getURL can momentarily destroy the page's execution context
  // (a fresh Ruffle instance, or a navigation), so this evaluate() can race and
  // throw "Execution context was destroyed". That must NOT abort the run — the
  // overlays are re-suppressed on the next step anyway. Swallow nav-destroyed
  // errors, with one short retry once the context has likely settled.
  const inject = () =>
    page.evaluate(() => {
      const hosts = document.querySelectorAll("ruffle-object, ruffle-embed, ruffle-player");
      for (const host of hosts) {
        const sr = host.shadowRoot;
        if (!sr || sr.getElementById("__wt_suppress")) continue;
        const s = document.createElement("style");
        s.id = "__wt_suppress";
        s.textContent =
          "#hardware-acceleration-modal,#save-manager,#volume-controls-modal," +
          "#video-modal,#clipboard-modal,#context-menu-overlay{display:none!important}" +
          "#unmute-overlay,.unmute-overlay{display:none!important}";
        sr.appendChild(s);
      }
    });
  try {
    await inject();
  } catch (err) {
    if (!/execution context was destroyed|navigation|page.*closed/i.test(err.message)) throw err;
    try {
      await page.waitForTimeout(300);
      await inject();
    } catch {
      /* still racing a (re)load — leave overlays; next step re-suppresses. */
    }
  }
}

/**
 * Does the current page run Ruffle at all? Pages built with `isRuffle = false`
 * (the HTML-native reconstructed scenes) never load ruffle.js, so `window.RufflePlayer`
 * is a deterministic signal — present before any async polyfill upgrade, absent
 * on pure-HTML pages. The element check is a belt-and-braces fallback.
 */
export async function hasRuffle(page) {
  return await page.evaluate(
    () => !!(window.RufflePlayer || document.querySelector("ruffle-object, ruffle-embed, ruffle-player"))
  );
}

/**
 * Resolve the page's "stage" — the thing we screenshot, diff, and map coords
 * against. On Ruffle pages that's the Flash canvas (waitForRuffleReady). On
 * HTML-native game pages (no Ruffle) it's the 800×500 `.aspect-ratio` stage div
 * (config.ruffle.htmlStageSelector), which shares the authored geometry — so
 * captureCanvas / makeCoordMapper / settle all work on it unchanged.
 */
export async function waitForStageReady(page, ruffleCfg, log = () => {}) {
  if (await hasRuffle(page)) return waitForRuffleReady(page, ruffleCfg, log);
  const sel = ruffleCfg.htmlStageSelector ?? ".aspect-ratio";
  const stage = page.locator(sel).first();
  log(`no Ruffle on this page — using HTML stage “${sel}”.`);
  await stage.waitFor({ state: "visible", timeout: ruffleCfg.readyTimeoutMs });
  return stage;
}

/**
 * Resolve the Playwright Locator for the Ruffle canvas.
 * @param {import('playwright').Page} page
 * @param {object} ruffleCfg  config.ruffle
 */
export function canvasLocator(page, ruffleCfg) {
  // Scope the canvas to the player when possible; fall back to a bare canvas.
  const sel = ruffleCfg.playerSelector
    ? `${ruffleCfg.playerSelector} ${ruffleCfg.canvasSelector}`
    : ruffleCfg.canvasSelector;
  return page.locator(sel).first();
}

/**
 * Wait until Ruffle has loaded and the canvas is on-screen at a plausible size.
 * Resolves with the canvas Locator.
 */
export async function waitForRuffleReady(page, ruffleCfg, log = () => {}) {
  const { readyTimeoutMs, canvasSize } = ruffleCfg;
  const canvas = canvasLocator(page, ruffleCfg);

  log("waiting for Ruffle canvas…");
  await canvas.waitFor({ state: "visible", timeout: readyTimeoutMs });

  // Wait for the canvas to reach a sane, non-zero size. Ruffle sizes the canvas
  // once it has parsed the SWF stage. We don't require an exact match (HiDPI /
  // responsive CSS can scale it) — just a stable, non-trivial box.
  const deadline = Date.now() + readyTimeoutMs;
  let last = null;
  let stable = 0;
  while (Date.now() < deadline) {
    const box = await canvas.boundingBox();
    if (box && box.width > 50 && box.height > 50) {
      if (last && Math.abs(box.width - last.width) < 1 && Math.abs(box.height - last.height) < 1) {
        if (++stable >= 3) {
          log(`Ruffle canvas ready (${Math.round(box.width)}×${Math.round(box.height)}px on screen).`);
          await suppressRuffleOverlays(page);
          return canvas;
        }
      } else {
        stable = 0;
      }
      last = box;
    }
    await page.waitForTimeout(150);
  }

  throw new Error(
    `Ruffle canvas did not stabilise within ${readyTimeoutMs}ms (expected ~${canvasSize.width}×${canvasSize.height} stage).`
  );
}

/**
 * Build a converter from canvas-local stage coords to absolute page coords.
 * Accounts for the canvas's on-screen position AND any scaling between the
 * authored stage size and the rendered CSS size.
 *
 * @returns {Promise<(x:number,y:number)=>{x:number,y:number}>}
 */
export async function makeCoordMapper(canvas, ruffleCfg) {
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Canvas has no bounding box (not visible?).");
  const { canvasSize } = ruffleCfg;
  const scaleX = box.width / canvasSize.width;
  const scaleY = box.height / canvasSize.height;
  return (x, y) => ({
    x: box.x + x * scaleX,
    y: box.y + y * scaleY,
  });
}

/** Current bounding box of the canvas (page coords). */
export async function canvasBox(canvas) {
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Canvas has no bounding box (not visible?).");
  return box;
}
