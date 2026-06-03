// Playwright runner: load the Ruffle page, drive each step, gate on
// animation-settle, capture before/after screenshots, and record video.
// Produces a manifest (output/manifest.json) consumed by the HTML generator.

import { chromium } from "playwright";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join, resolve, dirname } from "node:path";

import { waitForRuffleReady, suppressRuffleOverlays } from "./canvas.js";
import { captureCanvas, brightenPng } from "./capture.js";
import { settle } from "./settle.js";
import { performAction } from "./input.js";
import { resolveWait, resolveUrl } from "./steps.js";
import { drawGrid, clearGrid } from "./grid.js";

export async function runPlaythrough({ config, stepsDoc, stepsPath, headed, outDir, log = console.log, grid = false, until = null, continueOnError = false }) {
  const ruffleCfg = config.ruffle;
  const shotsDir = join(outDir, config.output.screenshotsSubdir);
  const videoDir = join(outDir, "video");

  // Fresh output tree.
  rmSync(shotsDir, { recursive: true, force: true });
  mkdirSync(shotsDir, { recursive: true });
  if (config.output.video) mkdirSync(videoDir, { recursive: true });

  const browser = await chromium.launch({ headless: !headed });
  const context = await browser.newContext({
    viewport: config.viewport,
    deviceScaleFactor: config.deviceScaleFactor ?? 1,
    recordVideo: config.output.video ? { size: config.viewport, dir: videoDir } : undefined,
  });
  const page = await context.newPage();
  page.on("console", (m) => {
    const t = m.text();
    if (t.includes(ruffleCfg.readyConsoleText) || /ruffle/i.test(t)) log(`  [page] ${t}`);
  });

  const records = [];
  let videoPath = null;

  try {
    // Initial load.
    const startUrl = resolveUrl(config.baseUrl, config.startUrl) ?? config.baseUrl;
    log(`\n▶ loading ${startUrl}`);
    await page.goto(startUrl, { waitUntil: "load" });
    let canvas = await waitForRuffleReady(page, ruffleCfg, log);
    await page.waitForTimeout(config.settle.initialSettleMs);

    for (let i = 0; i < stepsDoc.steps.length; i++) {
      const step = stepsDoc.steps[i];
      const n = String(i + 1).padStart(2, "0");
      log(`\n── Step ${n}/${stepsDoc.steps.length} [${step.id}] ${step.section ? "• " + step.section : ""}`);
      log(`   ${step.caption}`);

      // Static GALLERY step: a curated set of pre-captured images (e.g. the complete
      // Philosophy-of-Time-Travel book, owner-recorded) — no browser interaction.
      // `step.gallery` is a dir (relative to the steps file) holding an index.json
      // of { file, title } pages; the generator embeds them.
      if (step.gallery) {
        records.push({ index: i + 1, id: step.id, section: step.section ?? null, caption: step.caption, gallery: resolve(dirname(resolve(stepsPath)), step.gallery), actionDesc: "(curated gallery — no live action)", before: null, after: null, popups: [], wait: null });
        log(`   🖼 gallery: ${step.gallery}`);
        if (until && step.id === until) { log(`\n⏹  stopping after step ${step.id} (--until).`); break; }
        continue;
      }

      // Optional navigation at a page/SWF boundary.
      const navUrl = resolveUrl(config.baseUrl, step.navigate);
      if (navUrl) {
        log(`   ↪ navigate ${navUrl}`);
        await page.goto(navUrl, { waitUntil: "load" });
        canvas = await waitForRuffleReady(page, ruffleCfg, (m) => log("   " + m));
        await page.waitForTimeout(config.settle.initialSettleMs);
      }

      // Before screenshot.
      let beforeFile = null;
      if (step.captureBefore !== false) {
        const beforeBuf = await captureCanvas(page, canvas, ruffleCfg);
        beforeFile = `${n}-${step.id}-before.png`;
        writeFileSync(join(shotsDir, beforeFile), beforeBuf);
      }

      // Calibration aid: also save a grid-overlaid view of the pre-action state.
      if (grid) {
        await drawGrid(page, canvas, ruffleCfg, 50);
        writeFileSync(join(shotsDir, `${n}-${step.id}-before-grid.png`), await captureCanvas(page, canvas, ruffleCfg));
        await clearGrid(page);
      }

      // Collect any browser tabs the action opens. Several steps trigger Flash
      // getURL calls that open a news article / info popup in a NEW TAB; reading
      // it then CLOSING it continues the game.
      const popups = [];
      const onPopup = (p) => popups.push(p);
      context.on("page", onPopup);

      // Track in-page navigation triggered BY the action (e.g. a Flash getURL
      // that loads the next section's SWF in the same tab). When it happens we
      // must wait for the fresh Ruffle instance and re-suppress its overlays
      // before capturing/continuing. We do NOT reload via `navigate` for these —
      // section SWFs are inert when loaded standalone; they only work reached
      // through the live flow.
      let actionNavigated = false;
      const onNav = (f) => { if (f === page.mainFrame()) actionNavigated = true; };
      page.on("framenavigated", onNav);

      // Some pages float transparent HTML overlays (z-index 999 `[data-popup]`
      // spans) ON TOP of the Ruffle canvas — e.g. is_unstable.html's `gran-donnie`
      // overlay covers the whole stage and EATS canvas clicks. A step sets
      // `neutralizeOverlays: true` to make those spans click-through so pointer
      // events reach the SWF. Idempotent; persists until the next page navigation.
      if (step.neutralizeOverlays) {
        await page.evaluate(() => {
          if (document.getElementById("__wt_overlay_neutralize")) return;
          const s = document.createElement("style");
          s.id = "__wt_overlay_neutralize";
          s.textContent = "[data-popup]{pointer-events:none!important}";
          document.head.appendChild(s);
        });
        log(`   ⊘ neutralized HTML overlays ([data-popup]{pointer-events:none})`);
      }

      // Action. In calibration we tolerate failures so one run reaches as far as
      // the currently-calibrated coordinates allow.
      let actionDesc;
      try {
        actionDesc = await performAction(page, canvas, ruffleCfg, step.action, (m) => log("   " + m));
      } catch (err) {
        if (!continueOnError) throw err;
        log(`   ✖ action failed: ${err.message} — continuing (calibration mode).`);
        actionDesc = `(action failed: ${err.message})`;
      }

      // A Flash getURL navigation fires a FEW FRAMES AFTER the triggering click,
      // not synchronously — so a step that navigates needs a grace window for the
      // framenavigated to arrive before we give up and treat it as same-page.
      // Steps opt in with `awaitNavMs`; non-navigating steps skip this (no delay).
      const awaitNavMs = step.awaitNavMs ?? 0;
      for (let waited = 0; awaitNavMs > 0 && !actionNavigated && waited < awaitNavMs; waited += 150) {
        // The action may navigate the same tab (or, on a getURL/_self to /menu.html,
        // tear it down) DURING this grace window. page.waitForTimeout then throws
        // "Target page … has been closed". That's an expected end-of-section race,
        // not a runner bug — stop waiting and let the post-nav handling below run.
        try {
          await page.waitForTimeout(150);
        } catch (err) {
          if (/closed|navigation/i.test(err.message)) { actionNavigated = true; break; }
          throw err;
        }
      }

      // If the action navigated the tab to a new SWF, wait for the fresh Ruffle
      // instance and re-suppress overlays before settling/capturing.
      page.off("framenavigated", onNav);
      if (actionNavigated) {
        log(`   ↪ action navigated to ${page.url()} — waiting for new Ruffle…`);
        canvas = await waitForRuffleReady(page, ruffleCfg, (m) => log("   " + m));
        await page.waitForTimeout(config.settle.initialSettleMs);
      }
      await suppressRuffleOverlays(page); // idempotent; also kills overlays after nav

      // Settle, then capture "after" from the settled frame.
      const waitCfg = resolveWait(step, config.settle, stepsDoc.defaults, stepsPath);
      const result = await settle(page, canvas, ruffleCfg, waitCfg, (m) => log("   " + m));

      // Process popups: screenshot each (it's a walkthrough artifact — an article
      // / obituary / password hint), then close to continue (unless keepPopup).
      context.off("page", onPopup);
      const popupFiles = [];
      for (let k = 0; k < popups.length; k++) {
        const pop = popups[k];
        try {
          await pop.waitForLoadState("domcontentloaded", { timeout: 5000 });
          await pop.waitForTimeout(800);
          const pf = `${n}-${step.id}-popup${popups.length > 1 ? "-" + (k + 1) : ""}.png`;
          writeFileSync(join(shotsDir, pf), await pop.screenshot());
          popupFiles.push({ file: pf, url: pop.url() });
          log(`   ↗ popup tab: ${pop.url()}`);
          if (!step.keepPopup) await pop.close();
        } catch (e) {
          log(`   ⚠️  popup handling failed: ${e.message}`);
        }
      }
      if (popups.length && !step.keepPopup) await page.waitForTimeout(1200); // let the game resume after close

      const afterFile = `${n}-${step.id}-after.png`;
      writeFileSync(join(shotsDir, afterFile), step.brighten ? brightenPng(result.frame, step.brighten) : result.frame);

      records.push({
        index: i + 1,
        id: step.id,
        section: step.section ?? null,
        caption: step.caption,
        navigate: navUrl,
        actionDesc,
        before: beforeFile,
        after: afterFile,
        popups: popupFiles,
        wait: { mode: result.mode, settled: result.settled, waitedMs: result.waitedMs, samples: result.samples, finalDiff: result.finalDiff },
      });
      if (popupFiles.length) log(`   captured ${popupFiles.length} popup tab(s)${step.keepPopup ? " (left open)" : " and closed"}.`);

      if (!result.settled) log(`   ⚠️  proceeding without confirmed settle.`);

      if (until && step.id === until) {
        log(`\n⏹  stopping after step ${step.id} (--until).`);
        break;
      }
    }
  } finally {
    // Close the page first so Playwright finalises the video file.
    try {
      const video = page.video();
      await page.close();
      if (video) videoPath = await video.path();
    } catch { /* video disabled or already closed */ }
    await context.close();
    await browser.close();
  }

  const manifest = {
    generatedFrom: resolve(stepsPath),
    title: stepsDoc.meta?.title ?? config.output.title,
    viewport: config.viewport,
    canvasSize: ruffleCfg.canvasSize,
    video: videoPath ? videoPath : null,
    screenshotsSubdir: config.output.screenshotsSubdir,
    steps: records,
  };
  writeFileSync(join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
  log(`\n✔ manifest written (${records.length} steps).`);
  return manifest;
}
