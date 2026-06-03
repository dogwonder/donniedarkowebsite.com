#!/usr/bin/env node
// Probe the OPTIONAL Philosophy-of-Time-Travel chapter crosshairs on
// is_unstable.html. Drives the tu-* chain to the smurf-grid state (where the red
// chapter dots scatter down the LEFT edge), then detectClicks the left band a few
// times — capturing before/after each — to see whether a chapter reveals on the
// book page and whether it disturbs the smurf grid (which `tu-breathe` needs).
// Standalone (is_unstable.html autoplays philosophy.swf). Run: node src/test-chapters.js [--headed]
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { waitForRuffleReady, suppressRuffleOverlays } from "./canvas.js";
import { captureCanvas } from "./capture.js";
import { performAction } from "./input.js";
import { detectRed } from "./detect.js";
import { resolveUrl } from "./steps.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cfg = JSON.parse(readFileSync(join(root, "config.json"), "utf8"));
const doc = JSON.parse(readFileSync(join(root, "steps/donnie.steps.json"), "utf8"));
const outDir = join(root, "output", "chapters"); mkdirSync(outDir, { recursive: true });
const headed = process.argv.includes("--headed");
const BAND = { x0: 0, x1: 330, y0: 0, y1: 500 }; // left third — excludes the persistent right-side glow

const browser = await chromium.launch({ headless: !headed });
const ctx = await browser.newContext({ viewport: cfg.viewport, deviceScaleFactor: cfg.deviceScaleFactor ?? 1 });
const page = await ctx.newPage();

const url = resolveUrl(cfg.baseUrl, "/the/tangent/universe/is_unstable.html");
console.log(`▶ ${url}`);
await page.goto(url, { waitUntil: "load" });
let canvas = await waitForRuffleReady(page, cfg.ruffle, () => {});
await suppressRuffleOverlays(page);

// Drive the tu-* chain up to and including tu-smurf (NOT tu-breathe yet).
const chain = ["tu-window-1", "tu-window-2", "tu-window-3", "tu-window-4", "tu-open-book", "tu-smurf"];
for (const id of chain) {
  const step = doc.steps.find((s) => s.id === id);
  if (step.neutralizeOverlays) await page.evaluate(() => { if (!document.getElementById("__n")) { const s=document.createElement("style"); s.id="__n"; s.textContent="[data-popup]{pointer-events:none!important}"; document.head.appendChild(s);} });
  await performAction(page, canvas, cfg.ruffle, step.action, () => {});
  await suppressRuffleOverlays(page);
  await page.waitForTimeout(step.wait?.fixedMs ?? 2500);
}
let frame = await captureCanvas(page, canvas, cfg.ruffle);
writeFileSync(join(outDir, "00-after-smurf.png"), frame);
let reds = detectRed(frame, cfg.ruffle.canvasSize, { band: BAND, minPixels: 3 });
console.log(`after smurf: ${reds.length} red cluster(s) in left band: ${reds.slice(0,5).map(r=>`(${r.canvasX},${r.canvasY},${r.pixels}px)`).join(" ")}`);

// Try clicking chapter dots in the left band, a few rounds.
for (let i = 1; i <= 4; i++) {
  const desc = await performAction(page, canvas, cfg.ruffle, { type: "detectClick", band: BAND, minPixels: 2, maxPixels: 20, hoverMs: 400 }, (m) => console.log("  " + m));
  await suppressRuffleOverlays(page);
  await page.waitForTimeout(3500);
  frame = await captureCanvas(page, canvas, cfg.ruffle);
  writeFileSync(join(outDir, `${String(i).padStart(2,"0")}-chapter.png`), frame);
  reds = detectRed(frame, cfg.ruffle.canvasSize, { band: BAND, minPixels: 3 });
  console.log(`round ${i}: ${desc} | left-band reds now: ${reds.length}`);
}
console.log(`\nDone — inspect output/chapters/*.png (00-after-smurf, 01..04-chapter).`);
await ctx.close();
await browser.close();
