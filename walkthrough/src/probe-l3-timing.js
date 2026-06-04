#!/usr/bin/env node
// Measure the TRUE l3-ending duration: phone.swf load → the transcript→ending
// scene change ("time is up, donnie."). Validates the trimmed fixedMs ceiling
// (110s, was a guessed 145s; swfdump math says 109.5s = 2739f @ 25fps, with the
// _level0.gotoAndPlay('out') transition firing instantly on the last frame).
// Drives /from/the/sky/main.html standalone (same path as test-sky.js), then
// polls 1fps captures watching for a BIG diff (white transcript → dark ending)
// followed by darkness. Run: node src/probe-l3-timing.js [--headed]
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { waitForRuffleReady, suppressRuffleOverlays } from "./canvas.js";
import { captureCanvas } from "./capture.js";
import { performAction } from "./input.js";
import { resolveUrl } from "./steps.js";
import { diffRatio } from "./diff.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cfg = JSON.parse(readFileSync(join(root, "config.json"), "utf8"));
const outDir = join(root, "output", "l3-timing"); mkdirSync(outDir, { recursive: true });
const headed = process.argv.includes("--headed");

const browser = await chromium.launch({ headless: !headed });
const ctx = await browser.newContext({ viewport: cfg.viewport, deviceScaleFactor: cfg.deviceScaleFactor ?? 1 });
const page = await ctx.newPage();
ctx.on("page", async (p) => { try { await p.waitForLoadState(); console.log(`  [tab] ${p.url()} — closing`); await p.close(); } catch {} }); // pop6 etc.

let phoneLoadedAt = 0;
page.on("request", (r) => { // "request" (start), matching clickUntilNet's gate — requestfinished races the post-action check
  if (/\.swf(\?|$)/i.test(r.url())) {
    const n = r.url().split("/").pop();
    console.log(`  [net] ${n}`);
    if (/phone\.swf/i.test(n) && !phoneLoadedAt) phoneLoadedAt = Date.now();
  }
});

const url = resolveUrl(cfg.baseUrl, "/from/the/sky/main.html");
console.log(`▶ ${url}`);
await page.goto(url, { waitUntil: "load" });
const canvas = await waitForRuffleReady(page, cfg.ruffle, () => {});
await suppressRuffleOverlays(page);
await page.waitForTimeout(6000); // trampolin settles on "they made me do it"

const steps = [
  { id: "middlesex", action: { type: "clickUntilNet", x: 665, y: 295, hoverMs: 350, until: "lamp.swf", maxClicks: 5, gapMs: 3000 }, after: 3000 },
  { id: "telephone", action: { type: "click", x: 663, y: 244, hoverMs: 450, repeat: 2, repeatIntervalMs: 1500 }, after: 5000 },
  { id: "launch-document", action: { type: "clickUntilNet", x: 365, y: 452, hoverMs: 350, until: "phone.swf", maxClicks: 6, gapMs: 4000 }, after: 0 },
];
for (const s of steps) {
  console.log(`\n▶ ${s.id}`);
  await performAction(page, canvas, cfg.ruffle, s.action, (m) => console.log(`  ${m}`));
  if (s.after) await page.waitForTimeout(s.after);
}
if (!phoneLoadedAt) { console.error("✗ phone.swf never loaded — aborting."); await browser.close(); process.exit(1); }
console.log(`\n⏱ phone.swf loaded — timing the transcript from here.`);

// Poll and compare each capture against the KNOWN ending still from the
// successful full run (output/screenshots/50-l3-ending-after.png — engine +
// red circles + 'time is up, donnie.'; NOTE it's mostly WHITE, luma ~190,
// so darkness/diff-spike heuristics don't work). The only animation on the
// stopped ending frame is the small flickering text sprite, so the full-frame
// diff vs reference collapses to ~0 when the ending lands.
const reference = readFileSync(join(root, "output", "screenshots", "50-l3-ending-after.png"));
let endingAt = 0;
const ceiling = 220000; // generous: headless Ruffle may run well under 25fps
while (Date.now() - phoneLoadedAt < ceiling) {
  await page.waitForTimeout(1000);
  let cur;
  try { cur = await captureCanvas(page, canvas, cfg.ruffle); } catch (e) { console.log(`  capture failed (${e.message}) — stopping.`); break; }
  const t = ((Date.now() - phoneLoadedAt) / 1000).toFixed(1);
  let refDiff;
  try { refDiff = diffRatio(cur, reference, { pixelmatchThreshold: 0.1 }); }
  catch (e) { console.log(`  [${t}s] diff vs reference failed (${e.message})`); break; }
  console.log(`  [${t}s] vs-ending diff ${(refDiff * 100).toFixed(1)}%`);
  if (refDiff < 0.10) {
    endingAt = Date.now();
    writeFileSync(join(outDir, "ending.png"), cur);
    console.log(`\n✅ ENDING at ${t}s after phone.swf load (matched the known ending still, diff ${(refDiff * 100).toFixed(1)}%).`);
    break;
  }
}
if (!endingAt) console.log(`\n✗ no ending transition detected within ${ceiling / 1000}s ceiling.`);
else {
  // dwell a moment and save a second still to show the flicker-loop text is up
  await page.waitForTimeout(3000);
  try { writeFileSync(join(outDir, "ending+3s.png"), await captureCanvas(page, canvas, cfg.ruffle)); } catch {}
  console.log(`Measured transcript duration: ${((endingAt - phoneLoadedAt) / 1000).toFixed(1)}s (swfdump predicts 109.5s).`);
}
await browser.close();
