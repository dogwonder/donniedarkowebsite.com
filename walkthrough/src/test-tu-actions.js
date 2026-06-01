#!/usr/bin/env node
// Validate the REAL runner action path (input.js performAction + the runner's
// neutralizeOverlays injection) for the tangent-universe (tu-*) steps, driven
// straight from steps/donnie.steps.json — no probe-inline logic. Loads
// is_unstable.html directly (it's drivable standalone) and runs the tu-* actions
// in order, capturing after each. Success = reaching the "password to level 2"
// (navy Microsoft Internet) window.
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { waitForRuffleReady, suppressRuffleOverlays } from "./canvas.js";
import { captureCanvas } from "./capture.js";
import { performAction } from "./input.js";
import { detectTitlebars } from "./detect.js";
import { resolveUrl } from "./steps.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cfg = JSON.parse(readFileSync(join(root, "config.json"), "utf8"));
const doc = JSON.parse(readFileSync(join(root, "steps/donnie.steps.json"), "utf8"));
const tuSteps = doc.steps.filter((s) => s.id.startsWith("tu-"));
const outDir = join(root, "output", "tu-runner"); mkdirSync(outDir, { recursive: true });
const headed = process.argv.includes("--headed");

const browser = await chromium.launch({ headless: !headed });
const ctx = await browser.newContext({ viewport: cfg.viewport, deviceScaleFactor: cfg.deviceScaleFactor ?? 1 });
const page = await ctx.newPage();
page.on("requestfinished", (r) => { if (/\.swf(\?|$)/i.test(r.url())) console.log(`  [net] ${r.url().split("/").pop()}`); });

const url = resolveUrl(cfg.baseUrl, "/the/tangent/universe/is_unstable.html");
console.log(`▶ ${url}`);
await page.goto(url, { waitUntil: "load" });
const canvas = await waitForRuffleReady(page, cfg.ruffle, () => {});
await suppressRuffleOverlays(page);

for (const step of tuSteps) {
  // Mirror the runner: neutralize overlays if the step asks.
  if (step.neutralizeOverlays) {
    await page.evaluate(() => {
      if (document.getElementById("__wt_overlay_neutralize")) return;
      const s = document.createElement("style"); s.id = "__wt_overlay_neutralize";
      s.textContent = "[data-popup]{pointer-events:none!important}"; document.head.appendChild(s);
    });
    console.log(`  ⊘ neutralized overlays`);
  }
  const desc = await performAction(page, canvas, cfg.ruffle, step.action, (m) => console.log("   " + m));
  await suppressRuffleOverlays(page);
  const fixedMs = step.wait?.fixedMs ?? 2500;
  await page.waitForTimeout(fixedMs);
  const frame = await captureCanvas(page, canvas, cfg.ruffle);
  writeFileSync(join(outDir, `${step.id}.png`), frame);
  const bars = detectTitlebars(frame, cfg.ruffle.canvasSize);
  console.log(`✔ ${step.id}: ${desc}  | navy titlebars: ${bars.length}${bars.length ? " @y[" + bars.map((b) => b.canvasY).join(",") + "]" : ""}`);
}

// Final verdict.
const finalFrame = await captureCanvas(page, canvas, cfg.ruffle);
const finalBars = detectTitlebars(finalFrame, cfg.ruffle.canvasSize);
console.log(finalBars.length ? `\n✅ Reached a navy Win98 window (likely "password to level 2"). tu-* actions validated.` : `\n⚠️ No navy window at end — inspect output/tu-runner/*.png`);
await ctx.close();
await browser.close();
