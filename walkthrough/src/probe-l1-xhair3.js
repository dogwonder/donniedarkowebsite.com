#!/usr/bin/env node
// Warm-start probe: drive the live Level-1 flow up to the post-obituary state
// and calibrate the 3rd red crosshair (the "sparrow" guide entry).
//
// Flow (per HANDOVER.md): /intro_short.html → menu → hover+click (547,416)
// → obituary1 (45,45) → obituary2 (270,135) → state where 3rd crosshair shows.
// We detect red crosshair centroids, save a grid overlay, then optionally click.
//
// Usage:
//   node src/probe-l1-xhair3.js                 # observe: detect red + grid, no probe click
//   node src/probe-l1-xhair3.js --click 490,152 # also click that canvas point, capture after

import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

import { waitForRuffleReady, makeCoordMapper, suppressRuffleOverlays } from "./canvas.js";
import { captureCanvas } from "./capture.js";
import { drawGrid, clearGrid } from "./grid.js";
import { decode } from "./diff.js";
import { resolveUrl } from "./steps.js";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const has = (n) => argv.includes(n);

const cfg = JSON.parse(readFileSync(join(projectRoot, "config.json"), "utf8"));
const headed = has("--headed");
const clickArg = opt("--click", null);

const outDir = join(projectRoot, "output", "xhair3");
mkdirSync(outDir, { recursive: true });
const W = (n, buf) => writeFileSync(join(outDir, n), buf);

/**
 * Find clusters of "red" pixels (crosshair markers) in a canvas screenshot.
 * Returns cluster centroids in CANVAS-LOCAL coords. Simple grid-bucket
 * clustering: red = high R, low G/B.
 */
function detectRed(pngBuf, canvasSize) {
  const img = decode(pngBuf);
  const { width, height, data } = img;
  const sx = canvasSize.width / width;
  const sy = canvasSize.height / height;
  const pts = [];
  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      const i = (y * width + x) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      if (r > 150 && g < 90 && b < 90 && r - g > 70 && r - b > 70) pts.push([x, y]);
    }
  }
  // cluster by 24px buckets, merge adjacent
  const clusters = [];
  for (const [x, y] of pts) {
    let c = clusters.find((c) => Math.abs(c.cx - x) < 28 && Math.abs(c.cy - y) < 28);
    if (!c) { c = { sumX: 0, sumY: 0, n: 0, cx: x, cy: y }; clusters.push(c); }
    c.sumX += x; c.sumY += y; c.n++;
    c.cx = c.sumX / c.n; c.cy = c.sumY / c.n;
  }
  return clusters
    .filter((c) => c.n >= 4)
    .map((c) => ({
      canvasX: Math.round(c.cx * sx),
      canvasY: Math.round(c.cy * sy),
      pixels: c.n,
    }))
    .sort((a, b) => b.pixels - a.pixels);
}

const browser = await chromium.launch({ headless: !headed });
const context = await browser.newContext({ viewport: cfg.viewport, deviceScaleFactor: cfg.deviceScaleFactor ?? 1 });
const page = await context.newPage();
page.on("console", (m) => { if (/ruffle/i.test(m.text())) console.log(`  [page] ${m.text()}`); });

// Auto-capture + close popup tabs (obituaries open new tabs).
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
  await page.waitForTimeout(800);
}

const url = resolveUrl(cfg.baseUrl, "/intro_short.html");
console.log(`▶ ${url}`);
await page.goto(url, { waitUntil: "load" });
const canvas = await waitForRuffleReady(page, cfg.ruffle, console.log);
await page.waitForTimeout(6000);
await suppressRuffleOverlays(page);

const map = await makeCoordMapper(canvas, cfg.ruffle);
const clickCanvas = async (x, y, { hover = 350, settle = 1800 } = {}) => {
  const p = map(x, y);
  await page.mouse.move(p.x, p.y);
  await page.waitForTimeout(hover);
  await page.mouse.click(p.x, p.y);
  await page.waitForTimeout(settle);
};

// 1) menu reached — capture
W("01-menu.png", await captureCanvas(page, canvas, cfg.ruffle));
console.log("menu red:", JSON.stringify(detectRed(await captureCanvas(page, canvas, cfg.ruffle), cfg.ruffle.canvasSize)));

// 2) Level 1 crosshair
await clickCanvas(547, 416, { settle: 2500 });
W("02-level1.png", await captureCanvas(page, canvas, cfg.ruffle));

// 3) obituary 1 + 2
await clickCanvas(45, 45, { settle: 1500 });
await drainPopups("ob1");
W("03-after-ob1.png", await captureCanvas(page, canvas, cfg.ruffle));
await clickCanvas(270, 135, { settle: 1500 });
await drainPopups("ob2");

// 4) post-obituary state — this is the resume point
const post = await captureCanvas(page, canvas, cfg.ruffle);
W("04-post-obituary.png", post);
const reds = detectRed(post, cfg.ruffle.canvasSize);
console.log("\nPOST-OBITUARY red crosshairs (canvas coords, by size):");
console.log(reds.length ? reds.map((r) => `  (${r.canvasX},${r.canvasY})  ${r.pixels}px`).join("\n") : "  none");

await drawGrid(page, canvas, cfg.ruffle, 25);
W("04-post-obituary-grid.png", await captureCanvas(page, canvas, cfg.ruffle));
await clearGrid(page);

// 5) optional probe click
if (clickArg) {
  const [cx, cy] = clickArg.split(",").map(Number);
  console.log(`\n▶ probe click canvas(${cx},${cy}) — the "guide" 3rd circle`);
  await clickCanvas(cx, cy, { settle: 2500 });
  await drainPopups("probe");
  await page.waitForTimeout(3000);
  W(`05-guide.png`, await captureCanvas(page, canvas, cfg.ruffle));
  await drawGrid(page, canvas, cfg.ruffle, 25);
  W(`05-guide-grid.png`, await captureCanvas(page, canvas, cfg.ruffle));
  await clearGrid(page);
}

// 6) sparrow password — the pass field auto-checks every frame (no Enter needed)
if (has("--sparrow")) {
  const [fx, fy] = (opt("--focus", "210,185")).split(",").map(Number);
  const word = opt("--word", "sparrow");
  const useTab = has("--tab");
  console.log(`\n▶ password '${word}' — focus ${useTab ? "via Tab" : `click(${fx},${fy})`}, type slowly, poll for auto-advance`);
  try { await canvas.focus({ timeout: 1000 }); } catch {}
  if (useTab) {
    for (let t = 0; t < (parseInt(opt("--tab", "1"), 10) || 1); t++) { await page.keyboard.press("Tab"); await page.waitForTimeout(150); }
  } else {
    const fp = map(fx, fy);
    await page.mouse.click(fp.x, fp.y);
  }
  await page.waitForTimeout(300);
  // clear any pre-fill, then type char-by-char
  await page.keyboard.press("Control+a"); await page.keyboard.press("Delete");
  await page.waitForTimeout(120);
  for (const ch of word) { await page.keyboard.press(ch); await page.waitForTimeout(120); }
  W("06-typed.png", await captureCanvas(page, canvas, cfg.ruffle));
  await page.keyboard.press("Enter");
  // poll several frames for the auto-advance (gotoAndStop(3) + spear.gotoAndPlay)
  for (let s = 1; s <= 5; s++) {
    await page.waitForTimeout(1200);
    await drainPopups(`sp${s}`);
    W(`07-poll${s}.png`, await captureCanvas(page, canvas, cfg.ruffle));
  }
}

// 7) continue past the letter → "DO YOU BELIEVE IN TIME TRAVEL?" → tangent
if (has("--continue")) {
  console.log(`\n▶ continue: click the Monnitoff letter to advance`);
  await clickCanvas(400, 250, { settle: 3000 });
  await drainPopups("letter");
  W("09-after-letter.png", await captureCanvas(page, canvas, cfg.ruffle));
  let reds = detectRed(await captureCanvas(page, canvas, cfg.ruffle), cfg.ruffle.canvasSize);
  console.log("post-letter red:", JSON.stringify(reds));
  await drawGrid(page, canvas, cfg.ruffle, 25);
  W("09-after-letter-grid.png", await captureCanvas(page, canvas, cfg.ruffle));
  await clearGrid(page);

  // "DO YOU BELIEVE IN TIME TRAVEL?" is red text (per aid l214). Click it if found.
  if (reds.length) {
    const r = reds[0];
    console.log(`▶ click time-travel question at red (${r.canvasX},${r.canvasY})`);
    await clickCanvas(r.canvasX, r.canvasY, { settle: 3000 });
    await drainPopups("ttq");
    W("10-after-timetravel.png", await captureCanvas(page, canvas, cfg.ruffle));
    await drawGrid(page, canvas, cfg.ruffle, 25);
    W("10-after-timetravel-grid.png", await captureCanvas(page, canvas, cfg.ruffle));
    await clearGrid(page);
  }
}

// 8) tangent area: close each Win98 window via its X (top-right of the title
//    bar) — per site owner, closing the windows is what advances the timeline.
//    smurf.swf button 0013 does: this._visible=0; this.gotoAndPlay(12); _root.play()
//    → hides the window, plays its close anim, advances the Stop-gated _root.
//    After all three close, _root reaches GetUrl "universe/is_unstable.html".
if (has("--tangent")) {
  console.log(`\n▶ tangent area: re-suppress overlay, close the three windows via their X`);
  await suppressRuffleOverlays(page); // hw-accel modal returns after the nav
  await page.waitForTimeout(800);
  W("11-tangent-arrival.png", await captureCanvas(page, canvas, cfg.ruffle));
  // X (close) button = rightmost of the _ □ X cluster in each title bar (y≈262).
  const closeX = { remember: [212, 262], one: [410, 262], word: [632, 262] };
  let i = 0;
  for (const [name, [bx, by]] of Object.entries(closeX)) {
    i++;
    console.log(`  close window '${name}' via X (${bx},${by})`);
    await clickCanvas(bx, by, { hover: 250, settle: 2200 });
    await suppressRuffleOverlays(page);
    await drainPopups(`close-${name}`);
    W(`11-closed-${i}-${name}.png`, await captureCanvas(page, canvas, cfg.ruffle));
  }
  // Frank/smurf window now showing (bottom-right). Per aid: close it → nav to
  // the tangent universe (smurf.swf final frame: GetUrl "universe/is_unstable.html").
  await page.waitForTimeout(1500);
  await suppressRuffleOverlays(page);
  console.log("  Frank/smurf revealed. url:", page.url());
  W("12-frank-smurf.png", await captureCanvas(page, canvas, cfg.ruffle));

  if (has("--close-frank")) {
    // Scan candidate points on the Frank window's title-bar X until the URL
    // changes (nav to is_unstable.html). The X is the rightmost _ □ X button.
    const startUrl = page.url();
    const candidates = (opt("--frank-x", null)
      ? [opt("--frank-x").split(",").map(Number)]
      : [[775, 262], [778, 262], [772, 263], [775, 258], [780, 264], [770, 261], [783, 262]]);
    let navd = false;
    for (const [fx, fy] of candidates) {
      console.log(`\n▶ try Frank X (${fx},${fy}) → expect nav to is_unstable.html`);
      await clickCanvas(fx, fy, { hover: 250, settle: 2500 });
      await page.waitForTimeout(1200);
      await drainPopups("frank");
      const u = page.url();
      console.log(`  url now: ${u}`);
      if (u !== startUrl) { navd = true; console.log("  ✔ NAVIGATED"); break; }
      await suppressRuffleOverlays(page);
    }
    if (!navd) console.log("  ⚠ no nav after all candidates — X hit area not found / different mechanic");
    await page.waitForTimeout(2000);
    console.log("  post-Frank url:", page.url());
    W("13-after-frank.png", await captureCanvas(page, canvas, cfg.ruffle));
    await drawGrid(page, canvas, cfg.ruffle, 25);
    W("13-after-frank-grid.png", await captureCanvas(page, canvas, cfg.ruffle));
    await clearGrid(page);
  } else {
    await drawGrid(page, canvas, cfg.ruffle, 25);
    W("12-frank-smurf-grid.png", await captureCanvas(page, canvas, cfg.ruffle));
    await clearGrid(page);
  }
}

console.log(`\n✔ wrote screenshots to output/xhair3/`);
await context.close();
await browser.close();
