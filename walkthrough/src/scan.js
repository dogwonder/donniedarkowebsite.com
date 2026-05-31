#!/usr/bin/env node
// Hotspot scanner. Hover+click a grid of canvas-local points; after each, diff
// the canvas against the pre-click frame. A large diff (or a page navigation)
// means that point is a live button. Inert points leave the screen unchanged
// (allowing for animation drift), so we keep scanning without reloading; when a
// point DOES change the screen we record it and reload to reset state.
//
// Usage:
//   node src/scan.js --url /intro_short.html --ready 6000 \
//        --x0 360 --x1 720 --y0 180 --y1 440 --step 40 \
//        --hover 300 --wait 1800 --threshold 0.18
//
// Writes output/scan/hit-<x>_<y>.png for each hotspot and prints the list.

import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

import { waitForRuffleReady, makeCoordMapper, suppressRuffleOverlays } from "./canvas.js";
import { captureCanvas } from "./capture.js";
import { diffRatio } from "./diff.js";
import { resolveUrl } from "./steps.js";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const num = (n, d) => parseInt(opt(n, d), 10);

const cfg = JSON.parse(readFileSync(join(projectRoot, "config.json"), "utf8"));
const url = resolveUrl(cfg.baseUrl, opt("--url", cfg.startUrl)) ?? cfg.baseUrl;
const ready = num("--ready", 6000);
const x0 = num("--x0", 360), x1 = num("--x1", 720), y0 = num("--y0", 180), y1 = num("--y1", 440);
const step = num("--step", 40);
const hover = num("--hover", 300);
const wait = num("--wait", 1800);
const threshold = parseFloat(opt("--threshold", "0.18"));

const outDir = join(projectRoot, "output", "scan");
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
let ctx, page, canvas, map;

async function fresh() {
  if (ctx) await ctx.close();
  ctx = await browser.newContext({ viewport: cfg.viewport, deviceScaleFactor: cfg.deviceScaleFactor ?? 1 });
  page = await ctx.newPage();
  page._navigated = false;
  page.on("framenavigated", (f) => { if (f === page.mainFrame()) page._navigated = true; });
  await page.goto(url, { waitUntil: "load" });
  canvas = await waitForRuffleReady(page, cfg.ruffle, () => {});
  await page.waitForTimeout(ready);
  await suppressRuffleOverlays(page);
  map = await makeCoordMapper(canvas, cfg.ruffle);
  page._navigated = false; // ignore the initial load nav
}

await fresh();
const hits = [];
const points = [];
for (let y = y0; y <= y1; y += step) for (let x = x0; x <= x1; x += step) points.push([x, y]);
console.log(`scanning ${points.length} points on ${url} (step ${step}, threshold ${threshold})`);

for (const [x, y] of points) {
  const before = await captureCanvas(page, canvas, cfg.ruffle);
  const p = map(x, y);
  await page.mouse.move(p.x, p.y);
  await page.waitForTimeout(hover);
  await page.mouse.click(p.x, p.y);
  await page.waitForTimeout(wait);

  const navigated = page._navigated;
  let d = 0;
  if (!navigated) {
    const after = await captureCanvas(page, canvas, cfg.ruffle);
    d = diffRatio(before, after, { pixelmatchThreshold: 0.12 });
  }

  if (navigated || d >= threshold) {
    const tag = navigated ? "NAV→" + page.url().replace(cfg.baseUrl, "") : `diff ${(d * 100).toFixed(1)}%`;
    console.log(`  HIT (${x},${y}) ${tag}`);
    if (!navigated) writeFileSync(join(outDir, `hit-${x}_${y}.png`), await captureCanvas(page, canvas, cfg.ruffle));
    hits.push({ x, y, navigated, url: page.url(), diff: d });
    await fresh(); // reset to the clean menu and continue
  }
}

console.log("\nHOTSPOTS:");
console.log(hits.length ? hits.map((h) => `  (${h.x},${h.y}) ${h.navigated ? "nav " + h.url.replace(cfg.baseUrl, "") : (h.diff * 100).toFixed(1) + "%"}`).join("\n") : "  none found");
await browser.close();
