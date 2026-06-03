#!/usr/bin/env node
// Investigate the FULL set of Philosophy-of-Time-Travel chapter crosshairs.
// Owner: there are 10 crosshairs (Foreword, The Tangent Universe, … Appendix B),
// all visible at once on the left at the Frank "remember the word?" stage. This
// probe drives to that stage (tu-open-book), detects ALL crosshairs, then clicks
// each in turn — capturing a brightened frame per click — and re-detects after each
// to learn whether the set is STATIC (10 fixed dots) or DYNAMIC (clicking respawns).
// Run: node src/probe-allchapters.js [--headed]
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { waitForRuffleReady, suppressRuffleOverlays, makeCoordMapper } from "./canvas.js";
import { captureCanvas, brightenPng } from "./capture.js";
import { performAction } from "./input.js";
import { detectRed } from "./detect.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cfg = JSON.parse(readFileSync(join(root, "config.json"), "utf8"));
const doc = JSON.parse(readFileSync(join(root, "steps/donnie.steps.json"), "utf8"));
const outDir = join(root, "output", "allchapters"); mkdirSync(outDir, { recursive: true });
const headed = process.argv.includes("--headed");
const BAND = { x0: 0, x1: 360, y0: 0, y1: 500 };
const detOpts = { band: BAND, minPixels: 1, maxPixels: 40, loose: true }; // loose+min1 to catch ALL ~10 dim dots

const browser = await chromium.launch({ headless: !headed });
const ctx = await browser.newContext({ viewport: cfg.viewport, deviceScaleFactor: cfg.deviceScaleFactor ?? 1 });
const page = await ctx.newPage();
await page.goto("http://localhost:8080/the/tangent/universe/is_unstable.html", { waitUntil: "load" });
let canvas = await waitForRuffleReady(page, cfg.ruffle, () => {});
await suppressRuffleOverlays(page);

// Drive to the Frank "remember the word?" stage (tu-open-book).
for (const id of ["tu-window-1", "tu-window-2", "tu-window-3", "tu-window-4", "tu-open-book"]) {
  const step = doc.steps.find((s) => s.id === id);
  if (step.neutralizeOverlays) await page.evaluate(() => { if (!document.getElementById("__n")) { const s=document.createElement("style"); s.id="__n"; s.textContent="[data-popup]{pointer-events:none!important}"; document.head.appendChild(s);} });
  await performAction(page, canvas, cfg.ruffle, step.action, () => {});
  await suppressRuffleOverlays(page);
  await page.waitForTimeout(step.wait?.fixedMs ?? 3000);
}
await page.waitForTimeout(3000);

const fmt = (rs) => rs.map(r=>`(${r.canvasX},${r.canvasY},${r.pixels})`).join(" ");
let reds = detectRed(await captureCanvas(page, canvas, cfg.ruffle), cfg.ruffle.canvasSize, detOpts);
writeFileSync(join(outDir, "00-frank.png"), brightenPng(await captureCanvas(page, canvas, cfg.ruffle), 3));
console.log(`FRANK state: ${reds.length} crosshair(s): ${fmt(reds)}`);

const mapper = await makeCoordMapper(canvas, cfg.ruffle);
// Click each detected crosshair (by its INITIAL position), capture brightened, re-detect.
const initial = reds.slice();
for (let i = 0; i < initial.length; i++) {
  const c = initial[i];
  const pg = mapper(c.canvasX, c.canvasY);
  await page.mouse.move(pg.x, pg.y); await page.waitForTimeout(700); // hover (name tooltip?)
  writeFileSync(join(outDir, `${String(i+1).padStart(2,"0")}a-hover.png`), brightenPng(await captureCanvas(page, canvas, cfg.ruffle), 3));
  await page.mouse.click(pg.x, pg.y); await page.waitForTimeout(2500);
  await suppressRuffleOverlays(page);
  writeFileSync(join(outDir, `${String(i+1).padStart(2,"0")}b-click.png`), brightenPng(await captureCanvas(page, canvas, cfg.ruffle), 3));
  const now = detectRed(await captureCanvas(page, canvas, cfg.ruffle), cfg.ruffle.canvasSize, detOpts);
  console.log(`click ${i+1}/${initial.length} @ (${c.canvasX},${c.canvasY}) → now ${now.length} dot(s): ${fmt(now)}`);
}
console.log(`\nDone — inspect output/allchapters/*.png`);
await ctx.close();
await browser.close();
