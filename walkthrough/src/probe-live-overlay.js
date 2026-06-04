#!/usr/bin/env node
// LIVE-SITE check of the [data-popup="gran-donnie.swf"] overlay click-block
// (the open question in tangent-open-book-solved): once the 4th window summons
// gran-donnie.swf, the 60%×100% z-999 span un-hides over the canvas. The
// walkthrough neutralizes it with pointer-events:none to click the hidden
// book-advance button 0104 @ canvas(346,378) — does a HUMAN's click on the
// real site get eaten by the span instead (= progression deadlock)?
//
// Drives https://donniedarkowebsite.com/the/tangent/universe/is_unstable.html
// standalone (read-only GETs, same as a visitor): intro → 4 window clicks →
// PHASE A: click 0104 like a human (no hacks) → did thebook.swf load?
// PHASE B (only if A failed): inject [data-popup]{pointer-events:none}, click
// again → if thebook.swf NOW loads, the overlay is proven to be the blocker.
// Run: node src/probe-live-overlay.js [--headed] [--base <url>]
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { waitForRuffleReady, suppressRuffleOverlays } from "./canvas.js";
import { captureCanvas } from "./capture.js";
import { performAction } from "./input.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cfg = JSON.parse(readFileSync(join(root, "config.json"), "utf8"));
const outDir = join(root, "output", "live-overlay"); mkdirSync(outDir, { recursive: true });
const headed = process.argv.includes("--headed");
const baseIdx = process.argv.indexOf("--base");
const base = baseIdx > -1 ? process.argv[baseIdx + 1] : "https://donniedarkowebsite.com";

const browser = await chromium.launch({ headless: !headed });
const ctx = await browser.newContext({ viewport: cfg.viewport, deviceScaleFactor: cfg.deviceScaleFactor ?? 1 });
const page = await ctx.newPage();
const swfSeen = new Set();
page.on("request", (r) => { if (/\.swf(\?|$)/i.test(r.url())) { const n = r.url().split("/").pop(); if (!swfSeen.has(n)) console.log(`  [net] ${n}`); swfSeen.add(n); } });

console.log(`▶ ${base}/the/tangent/universe/is_unstable.html`);
await page.goto(`${base}/the/tangent/universe/is_unstable.html`, { waitUntil: "load" });
const canvas = await waitForRuffleReady(page, cfg.ruffle, () => {});
await suppressRuffleOverlays(page);
console.log("  intro playing (9s)…");
await page.waitForTimeout(10000);

// Summon the 4 windows (dad → donnie → straight → gran-donnie), same coords as
// the runner's tu-window-1..4. Each click summons the next sub-swf.
for (const [i, [x, y]] of [[12, 330], [125, 360], [562, 350], [406, 375]].entries()) {
  console.log(`▶ window ${i + 1} @ canvas(${x},${y})`);
  await performAction(page, canvas, cfg.ruffle, { type: "click", x, y, hoverMs: 300 }, (m) => console.log(`  ${m}`));
  await page.waitForTimeout(6000);
}
writeFileSync(join(outDir, "after-windows.png"), await captureCanvas(page, canvas, cfg.ruffle));
if (!swfSeen.has("gran-donnie.swf")) console.log("⚠ gran-donnie.swf not seen on the network — overlay phase may not have armed; results below may not be representative.");

// Inspect the overlay + what a click at button 0104 would actually hit.
const probe = await page.evaluate(() => {
  const span = document.querySelector('[data-popup="gran-donnie.swf"]');
  const r = span?.getBoundingClientRect();
  return {
    exists: !!span,
    hidden: span?.hasAttribute("hidden") ?? null,
    rect: r ? { x: r.x, y: r.y, w: r.width, h: r.height } : null,
    zIndex: span ? getComputedStyle(span).zIndex : null,
    pointerEvents: span ? getComputedStyle(span).pointerEvents : null,
  };
});
console.log(`\noverlay state: ${JSON.stringify(probe)}`);
const box = await canvas.boundingBox();
const vx = box.x + (346 / cfg.ruffle.canvasSize.width) * box.width;
const vy = box.y + (378 / cfg.ruffle.canvasSize.height) * box.height;
const hit = await page.evaluate(([x, y]) => {
  const el = document.elementFromPoint(x, y);
  return el ? `${el.tagName.toLowerCase()}${el.dataset?.popup ? `[data-popup="${el.dataset.popup}"]` : ""}` : "(none)";
}, [vx, vy]);
console.log(`elementFromPoint @ button-0104 viewport(${vx.toFixed(0)},${vy.toFixed(0)}): ${hit}`);

// PHASE A — the human click, no hacks.
console.log(`\n▶ PHASE A: human click on button 0104 @ canvas(346,378)`);
for (let i = 0; i < 3 && !swfSeen.has("thebook.swf"); i++) {
  await performAction(page, canvas, cfg.ruffle, { type: "click", x: 346, y: 378, hoverMs: 300 }, (m) => console.log(`  ${m}`));
  await page.waitForTimeout(5000);
}
const humanBlocked = !swfSeen.has("thebook.swf");
console.log(humanBlocked
  ? "❌ thebook.swf did NOT load — the human click is eaten (overlay block confirmed so far)."
  : "✅ thebook.swf loaded — humans are NOT blocked; the overlay worry was unfounded.");
writeFileSync(join(outDir, "after-human-click.png"), await captureCanvas(page, canvas, cfg.ruffle));

// PHASE B — prove causality: same click with the overlay disabled.
if (humanBlocked) {
  console.log(`\n▶ PHASE B: inject [data-popup]{pointer-events:none} and click again`);
  await page.addStyleTag({ content: "[data-popup]{pointer-events:none !important}" });
  for (let i = 0; i < 3 && !swfSeen.has("thebook.swf"); i++) {
    await performAction(page, canvas, cfg.ruffle, { type: "click", x: 346, y: 378, hoverMs: 300 }, (m) => console.log(`  ${m}`));
    await page.waitForTimeout(5000);
  }
  console.log(swfSeen.has("thebook.swf")
    ? "❌➡✅ thebook.swf loads ONLY with the overlay disabled — LIVE-SITE BUG CONFIRMED: the gran-donnie span blocks the required click for human visitors."
    : "⚠ thebook.swf still didn't load — the block (if any) isn't (only) the overlay; needs a closer look.");
  writeFileSync(join(outDir, "after-neutralized-click.png"), await captureCanvas(page, canvas, cfg.ruffle));
}
console.log(`\nSWFs seen: ${[...swfSeen].join(", ")}`);
await browser.close();
