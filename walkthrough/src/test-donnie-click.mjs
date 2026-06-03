// Probe: at the FROZEN sleepgolfing scene, try the aid guide's literal beat 28 —
// "click on donnie" (the figures on the green) — and report whether anything advances.
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { waitForRuffleReady, suppressRuffleOverlays } from "./canvas.js";
import { captureCanvas } from "./capture.js";
import { performAction } from "./input.js";
import { detectTitlebars } from "./detect.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cfg = JSON.parse(readFileSync(join(root, "config.json"), "utf8"));
const doc = JSON.parse(readFileSync(join(root, "steps/donnie.steps.json"), "utf8"));
const outDir = join(root, "output", "donnie-click"); mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: cfg.viewport });
const page = await ctx.newPage();
ctx.on("page", async (p) => { if (p !== page) { console.log("popup:", p.url()); try { await p.close(); } catch {} } });
await page.goto(cfg.baseUrl + "/are/you/sleep/golfing/main.html", { waitUntil: "load" });
const canvas = await waitForRuffleReady(page, cfg.ruffle, () => {});
await suppressRuffleOverlays(page);
await page.waitForTimeout(4000);
for (const id of ["l2-news", "l2-wake", "l2-go-level2", "l2-tv-exercise1", "l2-ex1-fear", "l2-ex1-eval", "l2-ex2-fear", "l2-ex2-eval", "l2-mono-tv1", "l2-mono-tv2", "l2-window-forward"]) {
  const step = doc.steps.find((s) => s.id === id);
  await performAction(page, canvas, cfg.ruffle, step.action, () => {});
  await page.waitForTimeout(id === "l2-window-forward" ? 2500 : (step.wait?.fixedMs ?? 3000));
}
await page.waitForTimeout(20000); // reach the FROZEN standing scene
writeFileSync(join(outDir, "0-frozen.png"), await captureCanvas(page, canvas, cfg.ruffle));
console.log("at frozen scene — trying figure clicks");
for (const [n, cx, cy] of [[1, 417, 403], [2, 278, 382], [3, 300, 290]]) {
  await performAction(page, canvas, cfg.ruffle, { type: "click", x: cx, y: cy, hoverMs: 400 }, (m) => console.log("  " + m));
  await page.waitForTimeout(4000);
  const f = await captureCanvas(page, canvas, cfg.ruffle);
  writeFileSync(join(outDir, `${n}-after-${cx}x${cy}.png`), f);
  console.log(`click (${cx},${cy}) → titlebars: ${detectTitlebars(f, cfg.ruffle.canvasSize).length}`);
}
await browser.close();
