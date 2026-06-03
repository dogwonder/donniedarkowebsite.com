#!/usr/bin/env node
// Validate the FULL Level-2 golf chain — including the 2026-06-03 tail (aid beats
// 28-31: sleepgolfing → ling-ling wallet → sidewalk → red-lines dot → pop4 article)
// — by driving the REAL l2-* step actions from steps/donnie.steps.json against
// golfing/main.html standalone. Success = the [data-url] domClick opens
// /news/pop4.html. Run: node src/test-golf-tail.js [--headed]
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { waitForRuffleReady, suppressRuffleOverlays } from "./canvas.js";
import { captureCanvas } from "./capture.js";
import { performAction } from "./input.js";
import { settle } from "./settle.js";
import { resolveWait } from "./steps.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cfg = JSON.parse(readFileSync(join(root, "config.json"), "utf8"));
const doc = JSON.parse(readFileSync(join(root, "steps/donnie.steps.json"), "utf8"));
const outDir = join(root, "output", "golf-tail"); mkdirSync(outDir, { recursive: true });
const headed = process.argv.includes("--headed");

const CHAIN = ["l2-news", "l2-wake", "l2-go-level2", "l2-tv-exercise1", "l2-ex1-fear", "l2-ex1-eval",
  "l2-ex2-fear", "l2-ex2-eval", "l2-mono-tv1", "l2-mono-tv2",
  "l2-window-forward", "l2-donnie", "l2-sleepgolf-arrow", "l2-wallet-question-forward", "l2-sidewalk-wallet",
  "l2-wallet-forward", "l2-redlines-article"];

const browser = await chromium.launch({ headless: !headed });
const ctx = await browser.newContext({ viewport: cfg.viewport, deviceScaleFactor: cfg.deviceScaleFactor ?? 1 });
const page = await ctx.newPage();
let gotPop4 = false;
ctx.on("page", async (p) => {
  if (p === page) return;
  try { await p.waitForLoadState("domcontentloaded", { timeout: 3000 }).catch(() => {}); } catch {}
  const u = p.url();
  if (/pop4/.test(u)) gotPop4 = true;
  console.log(`  ↗ popup: ${u} — closing`);
  try { await p.close(); } catch {}
});

await page.goto(cfg.baseUrl + "/are/you/sleep/golfing/main.html", { waitUntil: "load" });
const canvas = await waitForRuffleReady(page, cfg.ruffle, () => {});
await suppressRuffleOverlays(page);
await page.waitForTimeout(4000); // golf.swf intro settle

for (const id of CHAIN) {
  const step = doc.steps.find((s) => s.id === id);
  if (!step) { console.log(`✖ missing step ${id}`); process.exit(1); }
  const desc = await performAction(page, canvas, cfg.ruffle, step.action, (m) => console.log("   " + m));
  await suppressRuffleOverlays(page);
  // Mirror the runner: honour the step's wait block (diff-stable OR fixed).
  const waitCfg = resolveWait(step, cfg.settle, doc.defaults, join(root, "steps/donnie.steps.json"));
  const result = await settle(page, canvas, cfg.ruffle, waitCfg, (m) => console.log("   " + m));
  writeFileSync(join(outDir, `${id}.png`), result.frame);
  console.log(`✔ ${id}: ${desc}`);
}
console.log(gotPop4 ? `\n✅ pop4 (Cunning Visions article) opened — golf tail beats 28-31 validated.` : `\n⚠️ pop4 did NOT open — inspect output/golf-tail/*.png`);
await ctx.close();
await browser.close();
