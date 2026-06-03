#!/usr/bin/env node
// GUIDED RECORDER for the 10 Philosophy-of-Time-Travel chapter crosshairs.
// NO auto-drive — the OWNER plays is_unstable.html from the start (windows → book →
// "remember the word?" → chapter crosshairs). EVERY canvas click logs its coord and,
// ~1.8s later, saves a BRIGHTENED capture → output/chapter-pages/click-NN.png. The
// chapter pages (each shows its own title) are picked from the set afterwards.
// Popups auto-close; overlays are neutralized. Run: node src/record-chapters.js [--seconds 480]
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { waitForRuffleReady, suppressRuffleOverlays } from "./canvas.js";
import { captureCanvas, brightenPng } from "./capture.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cfg = JSON.parse(readFileSync(join(root, "config.json"), "utf8"));
const outDir = join(root, "output", "chapter-pages"); mkdirSync(outDir, { recursive: true });
const opt = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
const seconds = parseInt(opt("--seconds", "480"), 10);

const browser = await chromium.launch({ headless: false });
const ctx = await browser.newContext({ viewport: cfg.viewport, deviceScaleFactor: cfg.deviceScaleFactor ?? 1 });
const page = await ctx.newPage();
const t0 = Date.now();
const ts = () => `+${((Date.now() - t0) / 1000).toFixed(1)}s`;

// Diagnostics: report exactly what tears the session down.
page.on("close", () => console.log(`  ⚠️ [${ts()}] MAIN PAGE CLOSED`));
browser.on("disconnected", () => console.log(`  ⚠️ [${ts()}] BROWSER DISCONNECTED`));
page.on("framenavigated", (f) => { if (f === page.mainFrame()) console.log(`  [nav ${ts()}] ${f.url()}`); });
ctx.on("page", async (p) => { if (p !== page) { try { await p.waitForLoadState("domcontentloaded", { timeout: 2500 }).catch(() => {}); console.log(`  [popup ${ts()}] ${p.url().split("/").pop()} — auto-closing`); await p.close(); } catch {} } });

await page.goto("http://localhost:8080/the/tangent/universe/is_unstable.html", { waitUntil: "load" });
const canvas = await waitForRuffleReady(page, cfg.ruffle, () => {});
await suppressRuffleOverlays(page);
await page.evaluate(() => { if (!document.getElementById("__n")) { const s = document.createElement("style"); s.id = "__n"; s.textContent = "[data-popup]{pointer-events:none!important}"; document.head.appendChild(s); } });

// Capture queue: every canvas click → one brightened capture after the page turns.
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
      writeFileSync(join(outDir, name), brightenPng(raw, 3));
      console.log(`  📸 ${ts()} saved ${name}  (click canvas(${cx},${cy}))`);
    } catch (e) { console.log(`  ⚠️ capture failed: ${e.message}`); break; }
  }
  busy = false;
}
await page.exposeFunction("__chapterClick", (cx, cy) => { console.log(`  [CLICK ${ts()}] canvas(${cx},${cy})`); queue.push({ cx, cy }); drain(); });
await page.evaluate(({ w, h }) => {
  const findCanvas = () => { for (const host of document.querySelectorAll("ruffle-object, ruffle-embed, ruffle-player")) { const c = host.shadowRoot && host.shadowRoot.querySelector("canvas"); if (c) return c; } return document.querySelector("canvas"); };
  document.addEventListener("click", (e) => {
    const c = findCanvas(); if (!c) return; const r = c.getBoundingClientRect();
    const cx = Math.round(((e.clientX - r.left) / r.width) * w), cy = Math.round(((e.clientY - r.top) / r.height) * h);
    if (cx >= 0 && cy >= 0 && cx <= w && cy <= h) window.__chapterClick(cx, cy);
  }, true);
}, { w: cfg.ruffle.canvasSize.width, h: cfg.ruffle.canvasSize.height });

console.log(`\n  ✋ READY — YOU drive. Play through to the chapter crosshairs, then click each of the 10`);
console.log(`     (~2s apart). Every click saves a brightened capture to output/chapter-pages/.`);
console.log(`     ${seconds}s on the clock. Type smurf when Frank asks — typing is yours too.\n`);
try { await page.waitForTimeout(seconds * 1000); } catch { console.log(`  (session ended early — page/browser closed)`); }
console.log(`\n⏹ done — saved ${n} capture(s) → output/chapter-pages/`);
try { await ctx.close(); } catch {}
try { await browser.close(); } catch {}
