#!/usr/bin/env node
// Validate the l3-ending match-reference wait (converted from the guessed
// fixedMs:145000 ceiling, 2026-06-04) against the real game tail. Drives
// /from/the/sky/main.html standalone (middlesex → telephone → launch-document,
// same as test-sky.js), mimics the l3-launch-document 10s wait, then runs the
// REAL settle() with the REAL l3-ending wait config from steps/donnie.steps.json.
// Pass = settled:true via reference match in well under the 145s fallback, and
// the returned frame is the 'time is up, donnie.' ending.
// Run: node src/test-l3-ending.js [--headed]
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { waitForRuffleReady, suppressRuffleOverlays } from "./canvas.js";
import { performAction } from "./input.js";
import { resolveWait, resolveUrl } from "./steps.js";
import { settle } from "./settle.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cfg = JSON.parse(readFileSync(join(root, "config.json"), "utf8"));
const stepsPath = join(root, "steps", "donnie.steps.json");
const stepsDoc = JSON.parse(readFileSync(stepsPath, "utf8"));
const endingStep = stepsDoc.steps.find((s) => s.id === "l3-ending");
if (!endingStep) { console.error("✗ l3-ending step not found"); process.exit(1); }
const waitCfg = resolveWait(endingStep, cfg.settle, stepsDoc.defaults, stepsPath); // same call shape as runner.js:163
console.log("l3-ending wait config:", JSON.stringify(waitCfg));

const outDir = join(root, "output", "l3-ending-test"); mkdirSync(outDir, { recursive: true });
const headed = process.argv.includes("--headed");

const browser = await chromium.launch({ headless: !headed });
const ctx = await browser.newContext({ viewport: cfg.viewport, deviceScaleFactor: cfg.deviceScaleFactor ?? 1 });
const page = await ctx.newPage();
ctx.on("page", async (p) => { try { await p.waitForLoadState(); console.log(`  [tab] ${p.url()} — closing`); await p.close(); } catch {} });
let phoneAt = 0;
page.on("request", (r) => { if (/phone\.swf/i.test(r.url()) && !phoneAt) phoneAt = Date.now(); });

console.log(`▶ ${resolveUrl(cfg.baseUrl, "/from/the/sky/main.html")}`);
await page.goto(resolveUrl(cfg.baseUrl, "/from/the/sky/main.html"), { waitUntil: "load" });
const canvas = await waitForRuffleReady(page, cfg.ruffle, () => {});
await suppressRuffleOverlays(page);
await page.waitForTimeout(6000);

for (const s of [
  { id: "middlesex", action: { type: "clickUntilNet", x: 665, y: 295, hoverMs: 350, until: "lamp.swf", maxClicks: 5, gapMs: 3000 }, after: 3000 },
  { id: "telephone", action: { type: "click", x: 663, y: 244, hoverMs: 450, repeat: 2, repeatIntervalMs: 1500 }, after: 5000 },
  { id: "launch-document", action: { type: "clickUntilNet", x: 365, y: 452, hoverMs: 350, until: "phone.swf", maxClicks: 6, gapMs: 4000 }, after: 10000 }, // after = the real step's fixedMs
]) {
  console.log(`\n▶ ${s.id}`);
  await performAction(page, canvas, cfg.ruffle, s.action, (m) => console.log(`  ${m}`));
  await page.waitForTimeout(s.after);
}
if (!phoneAt) { console.error("✗ phone.swf never requested — aborting."); await browser.close(); process.exit(1); }

console.log(`\n▶ settle() with the real l3-ending wait config (transcript playing, ${((Date.now() - phoneAt) / 1000).toFixed(1)}s in)…`);
const res = await settle(page, canvas, cfg.ruffle, waitCfg, (m) => console.log(`  ${m}`));
const sinceLoad = ((Date.now() - phoneAt) / 1000).toFixed(1);
writeFileSync(join(outDir, "settled.png"), res.frame);
console.log(`\nsettled=${res.settled} mode=${res.mode} waited=${(res.waitedMs / 1000).toFixed(1)}s samples=${res.samples} finalDiff=${res.finalDiff == null ? "n/a" : (res.finalDiff * 100).toFixed(1) + "%"}`);
console.log(`${res.settled && res.waitedMs < 130000 ? "✅ PASS" : "❌ FAIL"} — ending reached ${sinceLoad}s after phone.swf load (frame → output/l3-ending-test/settled.png)`);
await browser.close();
process.exit(res.settled && res.waitedMs < 130000 ? 0 : 1);
