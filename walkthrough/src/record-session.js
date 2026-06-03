#!/usr/bin/env node
// GENERIC owner-driven session recorder (generalised from record-chapters.js).
// Opens any section page headed; the OWNER plays it. EVERY canvas click logs its
// canvas-local coord and, ~1.8s later, saves a capture → output/session-rec/click-NN.png
// (optionally brightened). Popups are captured+closed (their URL is logged — popups
// are part of the game's flow, e.g. the ling-ling wallet). Overlays neutralized.
//
//   node src/record-session.js --url /are/you/sleep/golfing/main.html [--seconds 480] [--brighten 1]
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { waitForRuffleReady, suppressRuffleOverlays } from "./canvas.js";
import { captureCanvas, brightenPng } from "./capture.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cfg = JSON.parse(readFileSync(join(root, "config.json"), "utf8"));
const outDir = join(root, "output", "session-rec"); mkdirSync(outDir, { recursive: true });
const opt = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
const url = opt("--url", "/");
const seconds = parseInt(opt("--seconds", "480"), 10);
const brighten = parseFloat(opt("--brighten", "1"));

const browser = await chromium.launch({ headless: false });
const ctx = await browser.newContext({ viewport: cfg.viewport, deviceScaleFactor: cfg.deviceScaleFactor ?? 1 });
const page = await ctx.newPage();
const t0 = Date.now();
const ts = () => `+${((Date.now() - t0) / 1000).toFixed(1)}s`;

page.on("close", () => console.log(`  ⚠️ [${ts()}] MAIN PAGE CLOSED`));
page.on("framenavigated", (f) => { if (f === page.mainFrame()) console.log(`  [nav ${ts()}] ${f.url()}`); });
let popN = 0;
ctx.on("page", async (p) => {
  if (p === page) return;
  try {
    await p.waitForLoadState("domcontentloaded", { timeout: 3000 }).catch(() => {});
    popN++;
    const pf = `popup-${String(popN).padStart(2, "0")}.png`;
    try { writeFileSync(join(outDir, pf), await p.screenshot()); } catch {}
    console.log(`  [popup ${ts()}] ${p.url()} → saved ${pf} — auto-closing`);
    await p.close();
  } catch {}
});

await page.goto(cfg.baseUrl + url, { waitUntil: "load" });
const canvas = await waitForRuffleReady(page, cfg.ruffle, () => {});
await suppressRuffleOverlays(page);
await page.evaluate(() => { if (!document.getElementById("__n")) { const s = document.createElement("style"); s.id = "__n"; s.textContent = "[data-popup]{pointer-events:none!important}"; document.head.appendChild(s); } });

let n = 0, busy = false;
const queue = [];
async function drain() {
  if (busy) return; busy = true;
  while (queue.length) {
    const { cx, cy } = queue.shift();
    try {
      await page.waitForTimeout(1800);
      await suppressRuffleOverlays(page);
      const raw = await captureCanvas(page, canvas, cfg.ruffle);
      n++;
      const name = `click-${String(n).padStart(2, "0")}.png`;
      writeFileSync(join(outDir, name), brighten > 1 ? brightenPng(raw, brighten) : raw);
      console.log(`  📸 ${ts()} saved ${name}  (click canvas(${cx},${cy}))`);
    } catch (e) { console.log(`  ⚠️ capture failed: ${e.message}`); break; }
  }
  busy = false;
}
await page.exposeFunction("__recClick", (cx, cy) => { console.log(`  [CLICK ${ts()}] canvas(${cx},${cy})`); queue.push({ cx, cy }); drain(); });
await page.evaluate(({ w, h }) => {
  const findCanvas = () => { for (const host of document.querySelectorAll("ruffle-object, ruffle-embed, ruffle-player")) { const c = host.shadowRoot && host.shadowRoot.querySelector("canvas"); if (c) return c; } return document.querySelector("canvas"); };
  document.addEventListener("click", (e) => {
    const c = findCanvas(); if (!c) return; const r = c.getBoundingClientRect();
    const cx = Math.round(((e.clientX - r.left) / r.width) * w), cy = Math.round(((e.clientY - r.top) / r.height) * h);
    if (cx >= 0 && cy >= 0 && cx <= w && cy <= h) window.__recClick(cx, cy);
  }, true);
}, { w: cfg.ruffle.canvasSize.width, h: cfg.ruffle.canvasSize.height });

console.log(`\n  ✋ READY — YOU drive ${url}. Every canvas click is logged + captured; popups are saved + auto-closed.`);
console.log(`     ${seconds}s on the clock.\n`);
try { await page.waitForTimeout(seconds * 1000); } catch { console.log(`  (session ended early — page/browser closed)`); }
console.log(`\n⏹ done — ${n} click capture(s) + ${popN} popup(s) → output/session-rec/`);
try { await ctx.close(); } catch {}
try { await browser.close(); } catch {}
