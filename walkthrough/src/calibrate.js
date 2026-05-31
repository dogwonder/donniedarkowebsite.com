#!/usr/bin/env node
// Calibration helper — load a page, wait for Ruffle, and screenshot the canvas
// with a CANVAS-LOCAL coordinate grid overlaid, so you can read click
// coordinates straight off the image.
//
// Usage:
//   node src/calibrate.js                                  # homepage (config.startUrl)
//   node src/calibrate.js --url /are/you/sleep/golfing/index.html
//   node src/calibrate.js --grid 50 --wait 4000            # grid spacing / extra settle
//   node src/calibrate.js --click 400,250                  # also perform a test click, capture after
//   node src/calibrate.js --headed
//
// Writes output/calibrate/<name>-grid.png (with overlay) and -clean.png.

import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

import { waitForRuffleReady, makeCoordMapper } from "./canvas.js";
import { captureCanvas } from "./capture.js";
import { resolveUrl } from "./steps.js";
import { drawGrid, clearGrid } from "./grid.js";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const opt = (name, def) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : def;
};
const has = (name) => argv.includes(name);

const config = JSON.parse(readFileSync(join(projectRoot, "config.json"), "utf8"));
const url = resolveUrl(config.baseUrl, opt("--url", config.startUrl)) ?? config.baseUrl;
const grid = parseInt(opt("--grid", "50"), 10);
const extraWait = parseInt(opt("--wait", "0"), 10);
const clickArg = opt("--click", null);
const headed = has("--headed");

const outDir = join(projectRoot, "output", "calibrate");
mkdirSync(outDir, { recursive: true });
const name = (opt("--url", "home") || "home").replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "home";

const browser = await chromium.launch({ headless: !headed });
const context = await browser.newContext({ viewport: config.viewport, deviceScaleFactor: config.deviceScaleFactor ?? 1 });
const page = await context.newPage();
page.on("console", (m) => { if (/ruffle/i.test(m.text())) console.log(`  [page] ${m.text()}`); });

try {
  console.log(`▶ ${url}`);
  await page.goto(url, { waitUntil: "load" });
  const canvas = await waitForRuffleReady(page, config.ruffle, console.log);
  await page.waitForTimeout(config.settle.initialSettleMs + extraWait);

  // Clean shot first.
  writeFileSync(join(outDir, `${name}-clean.png`), await captureCanvas(page, canvas, config.ruffle));

  // Grid shot.
  await drawGrid(page, canvas, config.ruffle, grid);
  writeFileSync(join(outDir, `${name}-grid.png`), await captureCanvas(page, canvas, config.ruffle));
  await clearGrid(page);
  console.log(`✔ wrote ${name}-clean.png and ${name}-grid.png (grid every ${grid} canvas units)`);

  if (clickArg) {
    const [cx, cy] = clickArg.split(",").map(Number);
    const map = await makeCoordMapper(canvas, config.ruffle);
    const p = map(cx, cy);
    await page.mouse.click(p.x, p.y);
    await page.waitForTimeout(config.settle.initialSettleMs + extraWait);
    writeFileSync(join(outDir, `${name}-after-click-${cx}_${cy}.png`), await captureCanvas(page, canvas, config.ruffle));
    console.log(`✔ clicked canvas(${cx},${cy}); wrote ${name}-after-click-${cx}_${cy}.png`);
  }
} finally {
  await context.close();
  await browser.close();
}
