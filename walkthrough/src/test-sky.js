#!/usr/bin/env node
// Validate the L3 telephone retry (input.js `clickUntilNet`) against the real
// from/the/sky/main.html. Drives: middlesex → clickUntilNet(phone.swf) and reports
// whether phone.swf (the FAA transcript) loaded. Captures after each. Standalone
// (main.html is drivable directly). Run: node src/test-sky.js [--headed]
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { waitForRuffleReady, suppressRuffleOverlays } from "./canvas.js";
import { captureCanvas } from "./capture.js";
import { performAction } from "./input.js";
import { resolveUrl } from "./steps.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cfg = JSON.parse(readFileSync(join(root, "config.json"), "utf8"));
const outDir = join(root, "output", "sky-test"); mkdirSync(outDir, { recursive: true });
const headed = process.argv.includes("--headed");

const browser = await chromium.launch({ headless: !headed });
const ctx = await browser.newContext({ viewport: cfg.viewport, deviceScaleFactor: cfg.deviceScaleFactor ?? 1 });
const page = await ctx.newPage();
let phoneLoaded = false;
page.on("requestfinished", (r) => { if (/\.swf(\?|$)/i.test(r.url())) { const n = r.url().split("/").pop(); console.log(`  [net] ${n}`); if (/phone\.swf/i.test(n)) phoneLoaded = true; } });

const url = resolveUrl(cfg.baseUrl, "/from/the/sky/main.html");
console.log(`▶ ${url}`);
await page.goto(url, { waitUntil: "load" });
const canvas = await waitForRuffleReady(page, cfg.ruffle, () => {});
await suppressRuffleOverlays(page);
await page.waitForTimeout(6000); // let trampolin settle/stop on "they made me do it"

const steps = [
  { id: "middlesex", action: { type: "clickUntilNet", x: 665, y: 295, hoverMs: 350, until: "lamp.swf", maxClicks: 5, gapMs: 3000 }, after: 3000 },
  { id: "telephone", action: { type: "clickUntilNet", x: 663, y: 244, hoverMs: 400, until: "pop6", maxClicks: 4, gapMs: 3000 }, after: 5000 },
  { id: "launch-document", action: { type: "clickUntilNet", x: 365, y: 452, hoverMs: 350, until: "phone.swf", maxClicks: 6, gapMs: 4000 }, after: 6000 },
];

for (const s of steps) {
  console.log(`\n▶ ${s.id}`);
  await performAction(page, canvas, cfg.ruffle, s.action, (m) => console.log("  " + m));
  await page.waitForTimeout(s.after);
  // close stray tabs
  for (const p of ctx.pages()) if (p !== page) { try { await p.close(); } catch {} }
  await suppressRuffleOverlays(page);
  writeFileSync(join(outDir, `${s.id}.png`), await captureCanvas(page, canvas, cfg.ruffle));
}

await page.waitForTimeout(4000);
writeFileSync(join(outDir, `final.png`), await captureCanvas(page, canvas, cfg.ruffle));
console.log(`\n${phoneLoaded ? "✅ phone.swf LOADED — advance succeeded" : "❌ phone.swf NOT loaded — still stuck"}`);
await ctx.close();
await browser.close();
