#!/usr/bin/env node
// Find which drifting menu word opens a level. The words drift continuously, so
// a long hover lets the word slide off the cursor — we must click FAST: detect,
// move onto the word, dwell only briefly, click. One fresh load per word (by
// size rank) gives full, repeatable coverage and avoids cross-word drift.

import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

import { waitForRuffleReady, makeCoordMapper, suppressRuffleOverlays } from "./canvas.js";
import { captureCanvas } from "./capture.js";
import { detectWords } from "./words.js";
import { diffRatio } from "./diff.js";
import { resolveUrl } from "./steps.js";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cfg = JSON.parse(readFileSync(join(projectRoot, "config.json"), "utf8"));
const url = resolveUrl(cfg.baseUrl, "/intro_short.html");
const outDir = join(projectRoot, "output", "wordclick");
mkdirSync(outDir, { recursive: true });
const HOVER = parseInt(process.argv[2] || "70", 10);

const browser = await chromium.launch({ headless: true });

for (let rank = 0; rank < 12; rank++) {
  const ctx = await browser.newContext({ viewport: cfg.viewport, deviceScaleFactor: cfg.deviceScaleFactor ?? 1 });
  const page = await ctx.newPage();
  let nav = null;
  page.on("framenavigated", (f) => { if (f === page.mainFrame() && !/intro_short|about:blank/.test(f.url())) nav = f.url(); });
  await page.goto(url, { waitUntil: "load" });
  const canvas = await waitForRuffleReady(page, cfg.ruffle, () => {});
  await page.waitForTimeout(6000);
  await suppressRuffleOverlays(page);
  const map = await makeCoordMapper(canvas, cfg.ruffle);

  // Detect, then re-detect right before clicking to get the freshest position.
  let blobs = detectWords(await captureCanvas(page, canvas, cfg.ruffle), cfg.ruffle, { lumaMax: 130, minPixels: 10 }).filter((b) => b.y < 415);
  if (rank >= blobs.length) { console.log(`rank ${rank}: no word`); await ctx.close(); continue; }
  const target = blobs[rank];

  const before = await captureCanvas(page, canvas, cfg.ruffle);
  // refresh position of the same word (nearest blob to target)
  const fresh = detectWords(before, cfg.ruffle, { lumaMax: 130, minPixels: 10 }).filter((b) => b.y < 415);
  const cur = fresh.reduce((best, b) => (Math.hypot(b.x - target.x, b.y - target.y) < Math.hypot((best?.x ?? 1e9) - target.x, (best?.y ?? 1e9) - target.y) ? b : best), null) ?? target;

  const p = map(cur.x, cur.y);
  await page.mouse.move(p.x, p.y);
  await page.waitForTimeout(HOVER);
  await page.mouse.click(p.x, p.y);
  await page.waitForTimeout(2200);

  let d = 0;
  if (!nav) d = diffRatio(before, await captureCanvas(page, canvas, cfg.ruffle), { pixelmatchThreshold: 0.12 });
  const hit = nav || d >= 0.14;
  console.log(`rank ${rank} word @ (${cur.x},${cur.y}) n=${cur.n} → ${nav ? "NAV " + nav : (d * 100).toFixed(1) + "%"}${hit ? "  *** HIT ***" : ""}`);
  if (hit) writeFileSync(join(outDir, `hit-rank${rank}-${cur.x}_${cur.y}.png`), await captureCanvas(page, canvas, cfg.ruffle));
  await ctx.close();
}
await browser.close();
console.log("done");
