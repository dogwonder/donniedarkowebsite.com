#!/usr/bin/env node
// Probe for the Tangent Universe (philosophy.swf on is_unstable.html).
// This page is DRIVABLE STANDALONE — it loads philosophy.swf into #swf via JS
// on page load — so we can navigate straight to it (no warm-start needed).
//
// Owner's guide (2026-05-31):
//   click the crosshair → a Win98 window appears → click its MIDDLE → 2nd window
//   → click middle → 3rd window → click middle → a GRID OF 4 appears → click the
//   bottom-right one → (wait) → "Philosophy of Time" chapters: crosshairs left to
//   right → when the password prompt appears, it's `smurf`.
//
// Usage: edit the CLICKS array below (canvas-local 0..800 × 0..500), then:
//   node src/probe-tangent-universe.js            # applies CLICKS in order
//   node src/probe-tangent-universe.js --headed
// After each click it writes output/tu/NN-grid.png + NN-clean.png so you can read
// the next coordinate, then append it and re-run.

import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

import { waitForRuffleReady, makeCoordMapper, suppressRuffleOverlays } from "./canvas.js";
import { captureCanvas } from "./capture.js";
import { drawGrid, clearGrid } from "./grid.js";
import { decode } from "./diff.js";
import { resolveUrl } from "./steps.js";

/**
 * Find clusters of bright "red" pixels (crosshairs / the chapter dot) in a canvas
 * screenshot. Returns cluster centroids in CANVAS-LOCAL coords, largest first.
 * Optional `band` = {x0,x1,y0,y1} in canvas coords restricts the search region so
 * the persistent red zigzag/glow elsewhere doesn't drown out the dot.
 */
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

// ─── EDIT THIS: the click sequence to probe (canvas-local coords) ───
// label is just for the screenshot filename + log.
// Owner: click order is 1 → 3 → 2 (NOT sequential), then a 2×2 grid forms
// (1 2 / 3 4) → click window 4 (bottom-right).
// Crosshair = far-left red diamond (owner-confirmed arrow), canvas ~(12,330) —
// the hit-area is the tiny diamond at the very edge; (45,330) misses it.
const CLICKS = [
  { label: "crosshair", x: 12, y: 330, settle: 3500 },
  { label: "win1", x: 125, y: 360, settle: 4000 },   // 1st window (lower-left)
  { label: "win2", x: 562, y: 350, settle: 4000 },   // 2nd window (lower-right) — true middle y≈350
  { label: "win3", x: 406, y: 375, settle: 9000 },   // 3rd window → grid of 4 forms; WAIT — bottom-right cell only goes active after a delay (owner)
  { label: "grid-BR", x: 236, y: 358, settle: 6000 },   // grid of 4 → bottom-right CELL middle (windows span canvas x7-306)
];
// ────────────────────────────────────────────────────────────────────

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const has = (n) => argv.includes(n);
const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const cfg = JSON.parse(readFileSync(join(projectRoot, "config.json"), "utf8"));
const outDir = join(projectRoot, "output", "tu");
mkdirSync(outDir, { recursive: true });
const W = (n, buf) => writeFileSync(join(outDir, n), buf);
const pad = (n) => String(n).padStart(2, "0");

const browser = await chromium.launch({ headless: !has("--headed") });
const context = await browser.newContext({ viewport: cfg.viewport, deviceScaleFactor: cfg.deviceScaleFactor ?? 1 });
const page = await context.newPage();
page.on("console", (m) => { const t = m.text(); if (/ruffle|\.swf|loadMovie|available/i.test(t)) console.log(`  [page] ${t}`); });
page.on("requestfinished", (r) => { const u = r.url(); if (/\.swf(\?|$)/i.test(u)) console.log(`  [net] swf loaded: ${u.split("/").pop()}`); });

// Report which data-popup HTML overlays are currently visible (not [hidden]).
async function reportOverlays(tag) {
  const vis = await page.evaluate(() =>
    [...document.querySelectorAll("[data-popup]")]
      .filter((e) => !e.hasAttribute("hidden"))
      .map((e) => e.getAttribute("data-popup")));
  console.log(`  [overlays @${tag}] ${vis.length ? vis.join(", ") : "(none visible)"}`);
}

// is_unstable.html may reveal HTML overlay popups (data-popup spans) and the
// philosophy.swf can open article tabs — capture+close any popup tabs.
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

const url = resolveUrl(cfg.baseUrl, "/the/tangent/universe/is_unstable.html");
console.log(`▶ ${url}`);
await page.goto(url, { waitUntil: "load" });
const canvas = await waitForRuffleReady(page, cfg.ruffle, console.log);
await page.waitForTimeout(9000); // philosophy.swf intro (167f @30fps ≈ 5.5s) + load
await suppressRuffleOverlays(page);

const map = await makeCoordMapper(canvas, cfg.ruffle);
const clickCanvas = async (x, y, { hover = 300, settle = 2000 } = {}) => {
  const p = map(x, y);
  await page.mouse.move(p.x, p.y);
  await page.waitForTimeout(hover);
  await page.mouse.click(p.x, p.y);
  await page.waitForTimeout(settle);
};

// initial state
W("00-start-clean.png", await captureCanvas(page, canvas, cfg.ruffle));
await drawGrid(page, canvas, cfg.ruffle, 25);
W("00-start-grid.png", await captureCanvas(page, canvas, cfg.ruffle));
await clearGrid(page);

let i = 0;
for (const c of CLICKS) {
  i++;
  console.log(`▶ click ${i} '${c.label}' canvas(${c.x},${c.y})`);
  await clickCanvas(c.x, c.y, { settle: c.settle ?? 2000 });
  await suppressRuffleOverlays(page);
  await drainPopups(`${pad(i)}-${c.label}`);
  await reportOverlays(c.label);
  W(`${pad(i)}-${c.label}-clean.png`, await captureCanvas(page, canvas, cfg.ruffle));
  await drawGrid(page, canvas, cfg.ruffle, 25);
  W(`${pad(i)}-${c.label}-grid.png`, await captureCanvas(page, canvas, cfg.ruffle));
  await clearGrid(page);
  console.log(`   ↳ wrote ${pad(i)}-${c.label}-{clean,grid}.png  (url: ${page.url()})`);
}

// ─── Chapters phase ───
// After the grid-of-4 → bottom-right, the "Philosophy of Time" chapters appear.
// Each chapter is advanced by a "chapter dot": a lone red marker that sits along a
// vertical band at a RANDOM horizontal position each time (owner's tip). So we
// DETECT it (red cluster) and click wherever it currently is — never hard-code x.
//   --observe        : just wait + log red clusters (full canvas) + capture, no clicks
//   --chapters N     : detect+click the dot up to N times (default 6), left→right
if (has("--observe") || has("--chapters")) {
  const rounds = has("--chapters") ? (parseInt(opt("--chapters", "6"), 10) || 6) : 1;
  // Constrain detection to the chapter band if given (canvas coords), else full canvas.
  // (Tune once we see where the dots live — keeps the persistent zigzag/glow out.)
  const band = opt("--band", null)
    ? (([x0, x1, y0, y1]) => ({ x0, x1, y0, y1 }))(opt("--band").split(",").map(Number))
    : null;
  // Owner: after each crosshair/window activation the next element only reveals
  // while the pointer HOVERS the right side of the canvas. So dwell the mouse over
  // the right side (the book-page region) before detecting/capturing each round.
  const [hrx, hry] = (opt("--hover", "640,220")).split(",").map(Number);
  for (let r = 1; r <= rounds; r++) {
    const hp = map(hrx, hry);
    await page.mouse.move(hp.x, hp.y);
    await page.waitForTimeout(parseInt(opt("--chwait", "3000"), 10));
    await suppressRuffleOverlays(page);
    const shot = await captureCanvas(page, canvas, cfg.ruffle);
    const reds = detectRed(shot, cfg.ruffle.canvasSize, band);
    await reportOverlays(`ch${r}`);
    console.log(`  [chapters r${r}] red clusters${band ? " (in band)" : ""}: ` +
      (reds.length ? reds.map((d) => `(${d.canvasX},${d.canvasY})·${d.pixels}px`).join("  ") : "none"));
    W(`ch${pad(r)}-clean.png`, shot);
    await drawGrid(page, canvas, cfg.ruffle, 25);
    W(`ch${pad(r)}-grid.png`, await captureCanvas(page, canvas, cfg.ruffle));
    await clearGrid(page);
    if (has("--chapters") && reds.length) {
      const dot = reds[0]; // most prominent marker = the chapter dot
      console.log(`   ▶ click chapter dot (${dot.canvasX},${dot.canvasY})`);
      await clickCanvas(dot.canvasX, dot.canvasY, { settle: 2500 });
      await drainPopups(`ch${r}`);
    }
  }
}

console.log(`\n✔ wrote screenshots to output/tu/`);
await context.close();
await browser.close();
