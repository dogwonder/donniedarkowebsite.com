#!/usr/bin/env node
// Observe the sleepgolfing scene's WHITE ARROW (aid beat 29): drive the golf chain
// through l2-window-forward, then capture every 2s for 30s WITHOUT clicking, to
// learn when the arrow appears and where it sits/moves. Run: node src/observe-arrow.js [--headed]
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { waitForRuffleReady, suppressRuffleOverlays } from "./canvas.js";
import { captureCanvas } from "./capture.js";
import { performAction } from "./input.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cfg = JSON.parse(readFileSync(join(root, "config.json"), "utf8"));
const doc = JSON.parse(readFileSync(join(root, "steps/donnie.steps.json"), "utf8"));
const outDir = join(root, "output", "arrow"); mkdirSync(outDir, { recursive: true });
const headed = process.argv.includes("--headed");

const CHAIN = ["l2-news", "l2-wake", "l2-go-level2", "l2-tv-exercise1", "l2-ex1-fear", "l2-ex1-eval",
  "l2-ex2-fear", "l2-ex2-eval", "l2-mono-tv1", "l2-mono-tv2", "l2-window-forward"];

const browser = await chromium.launch({ headless: !headed });
const ctx = await browser.newContext({ viewport: cfg.viewport, deviceScaleFactor: cfg.deviceScaleFactor ?? 1 });
const page = await ctx.newPage();
ctx.on("page", async (p) => { if (p !== page) { try { await p.close(); } catch {} } });

await page.goto(cfg.baseUrl + "/are/you/sleep/golfing/main.html", { waitUntil: "load" });
const canvas = await waitForRuffleReady(page, cfg.ruffle, () => {});
await suppressRuffleOverlays(page);
await page.waitForTimeout(4000);

for (const id of CHAIN) {
  const step = doc.steps.find((s) => s.id === id);
  await performAction(page, canvas, cfg.ruffle, step.action, () => {});
  await suppressRuffleOverlays(page);
  await page.waitForTimeout(step.wait?.fixedMs ?? 3000);
  console.log(`✔ ${id}`);
}
console.log("observing the sleepgolfing scene for 30s (no clicks)…");
for (let i = 0; i < 15; i++) {
  writeFileSync(join(outDir, `obs-${String(i).padStart(2, "0")}.png`), await captureCanvas(page, canvas, cfg.ruffle));
  await page.waitForTimeout(2000);
}
console.log("done → output/arrow/obs-*.png");
await ctx.close();
await browser.close();
