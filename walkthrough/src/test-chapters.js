#!/usr/bin/env node
// Probe the OPTIONAL Philosophy-of-Time-Travel chapter crosshairs on
// is_unstable.html. Drives the tu-* chain ALL THE WAY through tu-breathe (so the
// Smurf grid is gone and the book page is clear), CLOSES the "password to level 2"
// window via its titlebar X, then detectClicks the left-band chapter dots — capturing
// before/after each — to see whether a chapter renders LEGIBLY on the book page.
// Standalone. Run: node src/test-chapters.js [--headed] [--rounds 5]
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { waitForRuffleReady, suppressRuffleOverlays, makeCoordMapper } from "./canvas.js";
import { captureCanvas, brightenPng } from "./capture.js";
import { performAction } from "./input.js";
import { detectRed, detectTitlebars } from "./detect.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cfg = JSON.parse(readFileSync(join(root, "config.json"), "utf8"));
const doc = JSON.parse(readFileSync(join(root, "steps/donnie.steps.json"), "utf8"));
const outDir = join(root, "output", "chapters"); mkdirSync(outDir, { recursive: true });
const headed = process.argv.includes("--headed");
const ri = process.argv.indexOf("--rounds"); const ROUNDS = ri >= 0 ? parseInt(process.argv[ri + 1], 10) : 5;
const BAND = { x0: 0, x1: 330, y0: 0, y1: 500 }; // left third — excludes the persistent right-side glow

const browser = await chromium.launch({ headless: !headed });
const ctx = await browser.newContext({ viewport: cfg.viewport, deviceScaleFactor: cfg.deviceScaleFactor ?? 1 });
const page = await ctx.newPage();
const url = "http://localhost:8080/the/tangent/universe/is_unstable.html";
console.log(`▶ ${url}`);
await page.goto(url, { waitUntil: "load" });
let canvas = await waitForRuffleReady(page, cfg.ruffle, () => {});
await suppressRuffleOverlays(page);

async function shot(name) { const f = await captureCanvas(page, canvas, cfg.ruffle); writeFileSync(join(outDir, `${name}.png`), f); return f; }

// Drive the full tu-* chain (through tu-breathe).
const chain = ["tu-window-1", "tu-window-2", "tu-window-3", "tu-window-4", "tu-open-book", "tu-smurf", "tu-breathe"];
for (const id of chain) {
  const step = doc.steps.find((s) => s.id === id);
  if (step.neutralizeOverlays) await page.evaluate(() => { if (!document.getElementById("__n")) { const s=document.createElement("style"); s.id="__n"; s.textContent="[data-popup]{pointer-events:none!important}"; document.head.appendChild(s);} });
  await performAction(page, canvas, cfg.ruffle, step.action, () => {});
  await suppressRuffleOverlays(page);
  await page.waitForTimeout(step.wait?.fixedMs ?? 2500);
}
await shot("00-after-breathe");

// Run the REAL tu-chapter-* step actions from the steps file (faithful validation),
// applying each step's `brighten` to the saved frame exactly as the runner does.
for (const id of ["tu-chapter-1", "tu-chapter-2"]) {
  const step = doc.steps.find((s) => s.id === id);
  await page.evaluate(() => { if (!document.getElementById("__n")) { const s=document.createElement("style"); s.id="__n"; s.textContent="[data-popup]{pointer-events:none!important}"; document.head.appendChild(s);} });
  const desc = await performAction(page, canvas, cfg.ruffle, step.action, (m) => console.log("  " + m));
  await suppressRuffleOverlays(page);
  await page.waitForTimeout(step.wait?.fixedMs ?? 6000);
  const raw = await captureCanvas(page, canvas, cfg.ruffle);
  writeFileSync(join(outDir, `${id}.png`), step.brighten ? brightenPng(raw, step.brighten) : raw);
  const reds = detectRed(raw, cfg.ruffle.canvasSize, { band: BAND, minPixels: 2, maxPixels: 20 });
  console.log(`${id}: ${desc} | left-band dots: ${reds.length} ${reds.slice(0,4).map(r=>`(${r.canvasX},${r.canvasY},${r.pixels}px)`).join(" ")}`);
}
console.log(`\nDone — inspect output/chapters/*.png`);
await ctx.close();
await browser.close();
