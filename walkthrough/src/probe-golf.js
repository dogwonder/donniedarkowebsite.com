#!/usr/bin/env node
// Probe for LEVEL 2 — golf.swf on /are/you/sleep/golfing/main.html (the Jim
// Cunningham "Lifeline Exercise" / "sleep golfing"). The page is DRIVABLE
// STANDALONE (loads golf.swf into #swf via JS on load, autoplay on) so no
// warm-start is needed — navigate straight here.
//
// Mechanic (from swfdump + owner video): a FEAR⟷LOVE chalkboard `bar` with a
// draggable `controller` (the X). Each "Lifeline Exercise #N" asks you to place
// the X at the appropriate spot, then continue. Positions are GATED (owner: the
// correct spot is required). Advance buttons: 0091 (news/pop3), 0122 (_level2→
// draw.swf), 0124 (_level3→birds.swf). Exit = the main.html `[data-url]` overlay
// (revealed 5s after license.swf): 1st click → pop4 popup; 2nd click → navigates
// to /sparkle/motion/index.html.
//
// Modes:
//   node src/probe-golf.js --observe                 # no clicks: time-series capture of the autoplay
//   node src/probe-golf.js --observe --interval 1500 --frames 16
//   node src/probe-golf.js                            # apply the CLICKS array below
//   node src/probe-golf.js --headed
// Writes output/golf/NN-*-{clean,grid}.png.

import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

import { waitForRuffleReady, makeCoordMapper, suppressRuffleOverlays } from "./canvas.js";
import { captureCanvas } from "./capture.js";
import { drawGrid, clearGrid } from "./grid.js";
import { decode } from "./diff.js";
import { resolveUrl } from "./steps.js";

// Bright-red detector (X arrow / red sentence letters / "WAR"). Returns cluster
// centroids in CANVAS-LOCAL coords, largest first. Optional band {x0,x1,y0,y1}.
function detectRed(pngBuf, canvasSize, band = null) {
  const img = decode(pngBuf);
  const { width, height, data } = img;
  const sx = canvasSize.width / width, sy = canvasSize.height / height;
  const inBand = (cx, cy) => !band || (cx >= band.x0 && cx <= band.x1 && cy >= band.y0 && cy <= band.y1);
  const pts = [];
  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      const i = (y * width + x) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      if (r > 150 && g < 90 && b < 90 && r - g > 70 && r - b > 70) {
        const cx = Math.round(x * sx), cy = Math.round(y * sy);
        if (inBand(cx, cy)) pts.push([x, y]);
      }
    }
  }
  const clusters = [];
  for (const [x, y] of pts) {
    let c = clusters.find((c) => Math.abs(c.cx - x) < 28 && Math.abs(c.cy - y) < 28);
    if (!c) { c = { sumX: 0, sumY: 0, n: 0, cx: x, cy: y }; clusters.push(c); }
    c.sumX += x; c.sumY += y; c.n++; c.cx = c.sumX / c.n; c.cy = c.sumY / c.n;
  }
  return clusters.filter((c) => c.n >= 4)
    .map((c) => ({ canvasX: Math.round(c.cx * sx), canvasY: Math.round(c.cy * sy), pixels: c.n }))
    .sort((a, b) => b.pixels - a.pixels);
}

// ─── EDIT THIS: the click sequence to probe (canvas-local coords 0..800 × 0..500) ───
const CLICKS = [
  { label: "sq1-pop3", x: 347, y: 364, settle: 4000 },   // button 0091 → news/pop3 + frame "part2"
  { label: "sq2-donnie", x: 457, y: 316, settle: 4000 },  // button 0093 → frame "donnie" (Wake Up Donnie!)
  { label: "go-level2", x: 277, y: 407, settle: 6000 },   // button 0122 "go _level2" → loads draw.swf blackboard
  { label: "go-level2b", x: 277, y: 407, settle: 6000 },  // retry (button fades in)
  { label: "tv-continue", x: 623, y: 418, settle: 4500 },  // button 0084 (on the TV) → _root.gotoAndPlay("exercise1")
  { label: "ex1-fear-left", x: 260, y: 323, settle: 3500 }, // button 0101 (LEFT half = FEAR) → _root.lifeline="fear" + evaluate()
  { label: "ex1-moveaway", x: 700, y: 120, settle: 4500 },  // move off the bar (rollOut) → evaluate → correct → Exercise #2
  { label: "ex2-fear-left", x: 260, y: 323, settle: 3500 }, // Exercise #2 answer = FEAR (left half)
  { label: "ex2-moveaway", x: 700, y: 120, settle: 5000 },  // evaluate → observe what follows exercise 2
  { label: "mono-tv1", x: 623, y: 418, settle: 6000 },   // monologue: click TV → text filters in
  { label: "mono-tv2", x: 623, y: 418, settle: 8000 },   // click TV again → WAKE UP DONNIE letter-windows
  // aid step 27: "click inside one of the windows → screen forwards". Test LEFT windows
  // (clear of the [data-url] overlay at right ~x640). If one forwards, the tail-observe
  // below shows step 28 (sleepgolfing "do you think he was sleepgolfing?" → click donnie).
  { label: "win-U", x: 55, y: 125, settle: 5000 },   // 'U' window (row2 far-left)
  { label: "win-W", x: 55, y: 60, settle: 5000 },    // 'W' window (row1 far-left)
];
// ────────────────────────────────────────────────────────────────────────────────

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const has = (n) => argv.includes(n);
const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const cfg = JSON.parse(readFileSync(join(projectRoot, "config.json"), "utf8"));
const outDir = join(projectRoot, "output", "golf");
mkdirSync(outDir, { recursive: true });
const W = (n, buf) => writeFileSync(join(outDir, n), buf);
const pad = (n) => String(n).padStart(2, "0");

const browser = await chromium.launch({ headless: !has("--headed") });
const context = await browser.newContext({ viewport: cfg.viewport, deviceScaleFactor: cfg.deviceScaleFactor ?? 1 });
const page = await context.newPage();
page.on("console", (m) => { const t = m.text(); if (/ruffle|\.swf|license|available/i.test(t)) console.log(`  [page] ${t}`); });
page.on("requestfinished", (r) => { const u = r.url(); if (/\.swf(\?|$)/i.test(u)) console.log(`  [net] swf: ${u.split("/").pop()}`); });

// golf.swf opens article tabs (pop3/pop4) and main.html reveals a [data-url] link.
const popups = [];
context.on("page", (p) => popups.push(p));
async function drainPopups(label) {
  for (const pop of popups.splice(0)) {
    try {
      await pop.waitForLoadState("domcontentloaded", { timeout: 5000 });
      await pop.waitForTimeout(500);
      W(`popup-${label}.png`, await pop.screenshot());
      console.log(`  ↗ popup ${label}: ${pop.url()}`);
      await pop.close();
    } catch (e) { console.log(`  ⚠ popup ${label}: ${e.message}`); }
  }
}
async function reportDataUrl(tag) {
  const info = await page.evaluate(() => {
    const a = document.querySelector("[data-url]");
    if (!a) return "(no [data-url])";
    return `hidden=${a.hasAttribute("hidden")} href=${a.getAttribute("href")}`;
  });
  console.log(`  [data-url @${tag}] ${info}`);
}

const url = resolveUrl(cfg.baseUrl, "/are/you/sleep/golfing/main.html");
console.log(`▶ ${url}`);
await page.goto(url, { waitUntil: "load" });
const canvas = await waitForRuffleReady(page, cfg.ruffle, console.log);
await page.waitForTimeout(cfg.settle.initialSettleMs);
await suppressRuffleOverlays(page);

const map = await makeCoordMapper(canvas, cfg.ruffle);
const clickCanvas = async (x, y, { hover = 300, settle = 2000 } = {}) => {
  const p = map(x, y);
  await page.mouse.move(p.x, p.y);
  await page.waitForTimeout(hover);
  await page.mouse.click(p.x, p.y);
  await page.waitForTimeout(settle);
};

// ─── OBSERVE: time-series capture of the autoplay (no clicks) ───
if (has("--observe")) {
  const interval = parseInt(opt("--interval", "1500"), 10);
  const frames = parseInt(opt("--frames", "16"), 10);
  console.log(`▶ observe: ${frames} frames every ${interval}ms`);
  for (let f = 0; f < frames; f++) {
    await suppressRuffleOverlays(page);
    const shot = await captureCanvas(page, canvas, cfg.ruffle);
    const reds = detectRed(shot, cfg.ruffle.canvasSize);
    console.log(`  [t=${(f * interval / 1000).toFixed(1)}s] red: ` +
      (reds.length ? reds.slice(0, 4).map((d) => `(${d.canvasX},${d.canvasY})·${d.pixels}`).join("  ") : "none") +
      `  url=${page.url().split("/").slice(-2).join("/")}`);
    W(`obs-${pad(f)}-clean.png`, shot);
    await drawGrid(page, canvas, cfg.ruffle, 50);
    W(`obs-${pad(f)}-grid.png`, await captureCanvas(page, canvas, cfg.ruffle));
    await clearGrid(page);
    await reportDataUrl(`t${f}`);
    await drainPopups(`obs-${pad(f)}`);
    await page.waitForTimeout(interval);
  }
  console.log(`\n✔ observe shots in output/golf/`);
  await context.close();
  await browser.close();
  process.exit(0);
}

// ─── ADVANCE: detect+click the red square each round, mapping the sequence ───
// The main timeline progresses sentence→sentence; each step shows a solid red
// square button (sq1, sq2, …) that advances (and opens a news popup). The square
// moves each step, so DETECT it (largest compact red cluster) rather than hard-code.
//   --advance N        : up to N rounds (default 8)
//   --band x0,x1,y0,y1 : restrict detection (exclude red sentence letters / WAR)
//   --minpx P          : min cluster size to treat as the square (default 3)
if (has("--advance")) {
  const rounds = parseInt(opt("--advance", "8"), 10) || 8;
  const band = opt("--band", null)
    ? (([x0, x1, y0, y1]) => ({ x0, x1, y0, y1 }))(opt("--band").split(",").map(Number))
    : null;
  const minpx = parseInt(opt("--minpx", "3"), 10);
  const maxpx = parseInt(opt("--maxpx", "40"), 10); // squares are small; red sentence text = huge clusters
  // initial state
  await suppressRuffleOverlays(page);
  W(`adv-00-clean.png`, await captureCanvas(page, canvas, cfg.ruffle));
  await drawGrid(page, canvas, cfg.ruffle, 50);
  W(`adv-00-grid.png`, await captureCanvas(page, canvas, cfg.ruffle));
  await clearGrid(page);
  for (let r = 1; r <= rounds; r++) {
    const shot = await captureCanvas(page, canvas, cfg.ruffle);
    const reds = detectRed(shot, cfg.ruffle.canvasSize, band).filter((d) => d.pixels >= minpx && d.pixels <= maxpx);
    console.log(`  [adv r${r}] url=${page.url().split("/").slice(-2).join("/")} reds: ` +
      (reds.length ? reds.slice(0, 5).map((d) => `(${d.canvasX},${d.canvasY})·${d.pixels}`).join("  ") : "NONE"));
    await reportDataUrl(`r${r}`);
    if (!reds.length) { console.log(`   ⛔ no red square — stopping`); break; }
    const sq = reds[0];
    console.log(`   ▶ click red square (${sq.canvasX},${sq.canvasY})`);
    await clickCanvas(sq.canvasX, sq.canvasY, { settle: 3500 });
    await suppressRuffleOverlays(page);
    await drainPopups(`adv-${pad(r)}`);
    W(`adv-${pad(r)}-clean.png`, await captureCanvas(page, canvas, cfg.ruffle));
    await drawGrid(page, canvas, cfg.ruffle, 50);
    W(`adv-${pad(r)}-grid.png`, await captureCanvas(page, canvas, cfg.ruffle));
    await clearGrid(page);
  }
  console.log(`\n✔ advance shots in output/golf/`);
  await context.close();
  await browser.close();
  process.exit(0);
}

// ─── CLICK sequence ───
W("00-start-clean.png", await captureCanvas(page, canvas, cfg.ruffle));
await drawGrid(page, canvas, cfg.ruffle, 50);
W("00-start-grid.png", await captureCanvas(page, canvas, cfg.ruffle));
await clearGrid(page);

let i = 0;
for (const c of CLICKS) {
  i++;
  console.log(`▶ click ${i} '${c.label}' canvas(${c.x},${c.y})`);
  await clickCanvas(c.x, c.y, { settle: c.settle ?? 2500 });
  await suppressRuffleOverlays(page);
  await drainPopups(`${pad(i)}-${c.label}`);
  await reportDataUrl(c.label);
  W(`${pad(i)}-${c.label}-clean.png`, await captureCanvas(page, canvas, cfg.ruffle));
  await drawGrid(page, canvas, cfg.ruffle, 50);
  W(`${pad(i)}-${c.label}-grid.png`, await captureCanvas(page, canvas, cfg.ruffle));
  await clearGrid(page);
  console.log(`   ↳ wrote ${pad(i)}-${c.label}-{clean,grid}.png  (url: ${page.url()})`);
}

// ─── TAIL OBSERVE: watch the scene evolve AFTER WAKE UP DONNIE (aid steps 28-31) ───
// The WAKE UP DONNIE windows are transient — they dissolve into the sleepgolfing /
// red-lines scene on their own. Capture gridded frames so the post-windows hotspots
// (click donnie / white arrow / sidewalk o-dot / blinking red line-tip) can be read
// against the owner's reference video. Default ON; the overlay EXIT is opt-in (--exit)
// because it SHORTCUTS straight to sparkle/motion and skips steps 28-31.
if (!has("--noTail")) {
  const tn = parseInt(opt("--tailFrames", "10"), 10);
  const ti = parseInt(opt("--tailInterval", "1500"), 10);
  console.log(`\n▶ TAIL observe: ${tn} frames every ${ti}ms (post-WAKE-UP-DONNIE)`);
  for (let f = 0; f < tn; f++) {
    await suppressRuffleOverlays(page);
    const shot = await captureCanvas(page, canvas, cfg.ruffle);
    const reds = detectRed(shot, cfg.ruffle.canvasSize).filter((d) => d.pixels <= 40);
    console.log(`  [tail t=${(f * ti / 1000).toFixed(1)}s] small-red: ` +
      (reds.length ? reds.slice(0, 5).map((d) => `(${d.canvasX},${d.canvasY})·${d.pixels}`).join("  ") : "none"));
    W(`tail-${pad(f)}-clean.png`, shot);
    await drawGrid(page, canvas, cfg.ruffle, 50);
    W(`tail-${pad(f)}-grid.png`, await captureCanvas(page, canvas, cfg.ruffle));
    await clearGrid(page);
    await reportDataUrl(`tail-t${f}`);
    await drainPopups(`tail-${pad(f)}`);
    await page.waitForTimeout(ti);
  }
  console.log(`   ↳ tail frames in output/golf/tail-*`);
}

// ─── EXIT (OPT-IN, --exit): the [data-url] HTML overlay shortcut to sparkle/motion ───
// 1st click opens the pop4 news popup; clicking it is the SHORTCUT Level-2 exit
// (a 2nd click rewrites href → /sparkle/motion/index.html). Skips aid steps 28-31.
if (has("--exit")) {
console.log(`\n▶ EXIT: waiting for [data-url] overlay to reveal…`);
try {
  await page.waitForSelector("[data-url]", { state: "visible", timeout: 12000 });
  await reportDataUrl("exit-pre");
  await page.click("[data-url]", { timeout: 5000 });
  await page.waitForTimeout(1500);
  await drainPopups("exit");
  await reportDataUrl("exit-post");
  W("99-exit-clean.png", await captureCanvas(page, canvas, cfg.ruffle));
  console.log(`   ↳ exit overlay clicked → wrote 99-exit-clean.png`);
} catch (e) {
  console.log(`   ⚠ exit overlay: ${e.message}`);
}
}

console.log(`\n✔ wrote screenshots to output/golf/`);
await context.close();
await browser.close();
