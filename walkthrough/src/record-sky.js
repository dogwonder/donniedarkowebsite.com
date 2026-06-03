#!/usr/bin/env node
// MANUAL-DEMO RECORDER for the L3 "from the sky" telephone → FAA transcript beat.
// Opens from/the/sky/main.html headed, lets YOU drive, and logs every click's
// canvas-local coordinate + every .swf/.html network load (with timestamps) so we
// can see EXACTLY which click loads phone.swf (the transcript). Auto-closes the
// pop6 news tabs as they open so there's no tab spam — just keep driving the game
// tab. Run: node src/record-sky.js [--seconds 120]
import { readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { waitForRuffleReady, suppressRuffleOverlays } from "./canvas.js";
import { resolveUrl } from "./steps.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cfg = JSON.parse(readFileSync(join(root, "config.json"), "utf8"));
const opt = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
const seconds = parseInt(opt("--seconds", "120"), 10);

const browser = await chromium.launch({ headless: false });
const ctx = await browser.newContext({ viewport: cfg.viewport, deviceScaleFactor: cfg.deviceScaleFactor ?? 1 });
const page = await ctx.newPage();
const t0 = Date.now();
const ts = () => `+${((Date.now() - t0) / 1000).toFixed(1)}s`;

// Log every .swf / news popup load with a timestamp.
page.on("requestfinished", (r) => {
  const u = r.url();
  if (/\.swf(\?|$)/i.test(u) || /pop\d+\.html/i.test(u)) console.log(`  [net ${ts()}] ${u.split("/").pop()}`);
});
// Auto-close the pop6 news tabs so the demo isn't buried in tabs.
ctx.on("page", async (p) => {
  if (p === page) return;
  try { await p.waitForLoadState("domcontentloaded", { timeout: 3000 }); } catch {}
  console.log(`  [popup ${ts()}] ${p.url().split("/").pop()} — auto-closing`);
  try { await p.close(); } catch {}
});

const url = resolveUrl(cfg.baseUrl, "/from/the/sky/main.html");
console.log(`▶ ${url}\n  Driving for ${seconds}s. Click the date 'Middlesex, Virginia', then the telephone, etc.`);
await page.goto(url, { waitUntil: "load" });
const canvas = await waitForRuffleReady(page, cfg.ruffle, () => {});
await suppressRuffleOverlays(page);

// Install a click listener that reports canvas-LOCAL coordinates (0..800 × 0..500).
await page.exposeFunction("__logClick", (cx, cy) => console.log(`  [CLICK ${ts()}] canvas(${cx}, ${cy})`));
await page.evaluate(({ w, h }) => {
  const findCanvas = () => {
    for (const host of document.querySelectorAll("ruffle-object, ruffle-embed, ruffle-player")) {
      const c = host.shadowRoot && host.shadowRoot.querySelector("canvas");
      if (c) return c;
    }
    return document.querySelector("canvas");
  };
  document.addEventListener("click", (e) => {
    const c = findCanvas();
    if (!c) return;
    const r = c.getBoundingClientRect();
    const cx = Math.round(((e.clientX - r.left) / r.width) * w);
    const cy = Math.round(((e.clientY - r.top) / r.height) * h);
    if (cx >= 0 && cy >= 0 && cx <= w && cy <= h) window.__logClick(cx, cy);
  }, true);
}, { w: cfg.ruffle.canvasSize.width, h: cfg.ruffle.canvasSize.height });

console.log("  ✋ Recorder ready — drive the game now. Watch this log for CLICK coords + phone.swf load.\n");
await page.waitForTimeout(seconds * 1000).catch(() => {});
console.log("\n⏹ recording window ended.");
try { await ctx.close(); } catch {}
try { await browser.close(); } catch {}
