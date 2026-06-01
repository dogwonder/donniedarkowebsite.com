#!/usr/bin/env node
// Focused experiment: the grid-of-4 → open-book transition (the current blocker).
// Drives the calibrated crosshair→win1→win2→win3→grid-BR sequence, then ENTERS A
// LONG OBSERVATION LOOP (capture every 2s for ~18s) while logging every .swf the
// page loads and every visible data-popup overlay. The decisive signal: does
// `thebook.swf` ever appear over the network? If yes, the SWF is advancing and the
// problem is rendering/overlay; if no, the SWF is stalled at a frame waiting for an
// interaction we haven't found.
//
// Usage:
//   node src/probe-grid-book.js                 # calibrated grid-BR (406,375 win3 → BR)
//   node src/probe-grid-book.js --br 284,375    # override the grid-BR click coord
//   node src/probe-grid-book.js --headed
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { waitForRuffleReady, makeCoordMapper, suppressRuffleOverlays, canvasBox, canvasLocator } from "./canvas.js";
import { captureCanvas } from "./capture.js";
import { drawGrid, clearGrid } from "./grid.js";
import { decode } from "./diff.js";
import { resolveUrl } from "./steps.js";

// Find clusters of bright red pixels in a canvas screenshot; centroids in canvas coords.
function detectRed(pngBuf, canvasSize) {
  const img = decode(pngBuf);
  const { width, height, data } = img;
  const sx = canvasSize.width / width, sy = canvasSize.height / height;
  const pts = [];
  for (let y = 0; y < height; y += 2) for (let x = 0; x < width; x += 2) {
    const i = (y * width + x) * 4, r = data[i], g = data[i + 1], b = data[i + 2];
    if (r > 150 && g < 90 && b < 90 && r - g > 70 && r - b > 70) pts.push([x, y]);
  }
  const clusters = [];
  for (const [x, y] of pts) {
    let c = clusters.find((c) => Math.abs(c.cx - x) < 30 && Math.abs(c.cy - y) < 18);
    if (!c) { c = { sumX: 0, sumY: 0, n: 0, cx: x, cy: y }; clusters.push(c); }
    c.sumX += x; c.sumY += y; c.n++; c.cx = c.sumX / c.n; c.cy = c.sumY / c.n;
  }
  return clusters.filter((c) => c.n >= 4)
    .map((c) => ({ canvasX: Math.round(c.cx * sx), canvasY: Math.round(c.cy * sy), pixels: c.n }))
    .sort((a, b) => b.pixels - a.pixels);
}

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const has = (n) => argv.includes(n);
const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const cfg = JSON.parse(readFileSync(join(projectRoot, "config.json"), "utf8"));
const outDir = join(projectRoot, "output", "gridbook");
mkdirSync(outDir, { recursive: true });
const W = (n, buf) => writeFileSync(join(outDir, n), buf);
const pad = (n) => String(n).padStart(2, "0");

const [brx, bry] = opt("--br", "236,358").split(",").map(Number);
// Calibrated path to the grid of 4 (from donnie.steps.json / handover).
// --skipwins: click ONLY the crosshair (which gotoAndPlay("pop1") auto-plays all
// windows) then wait, then click the --br point. Isolates the button-0104 advance.
const CLICKS = has("--skipwins")
  ? [
      { label: "crosshair", x: 12, y: 330, settle: 6000 },
      { label: "advance", x: brx, y: bry, settle: 3000 },
    ]
  : [
      { label: "crosshair", x: 12, y: 330, settle: 3500 },
      { label: "win1", x: 125, y: 360, settle: 4000 },
      { label: "win2", x: 562, y: 350, settle: 4000 },
      { label: "win3", x: 406, y: 375, settle: 9000 },
      { label: "grid-BR", x: brx, y: bry, settle: 3000 },
    ];

const browser = await chromium.launch({ headless: !has("--headed") });
const context = await browser.newContext({ viewport: cfg.viewport, deviceScaleFactor: cfg.deviceScaleFactor ?? 1 });
const page = await context.newPage();
page.on("requestfinished", (r) => { const u = r.url(); if (/\.swf(\?|$)/i.test(u)) console.log(`   [net] swf: ${u.split("/").pop()}`); });
const popups = [];
context.on("page", (p) => popups.push(p));

async function overlays() {
  return await page.evaluate(() =>
    [...document.querySelectorAll("[data-popup]")].filter((e) => !e.hasAttribute("hidden")).map((e) => e.getAttribute("data-popup")));
}

const url = resolveUrl(cfg.baseUrl, "/the/tangent/universe/is_unstable.html");
console.log(`▶ ${url}`);
await page.goto(url, { waitUntil: "load" });
const canvas = await waitForRuffleReady(page, cfg.ruffle, () => {});
// HYPOTHESIS: the gran-donnie overlay (right:0, 60% width, z-index 999) covers the
// canvas exactly and eats clicks meant for the SWF. Neutralise its pointer
// interception so canvas clicks reach Ruffle, while leaving the overlay visible.
if (has("--neutralize")) {
  await page.addStyleTag({ content: "[data-popup]{pointer-events:none!important}" });
  console.log("   [neutralize] [data-popup]{pointer-events:none}");
}
await page.waitForTimeout(9000);
await suppressRuffleOverlays(page);
const box = await canvasBox(canvas);
console.log(`   canvas box: x=${Math.round(box.x)} y=${Math.round(box.y)} w=${Math.round(box.width)} h=${Math.round(box.height)} (viewport ${cfg.viewport.width}x${cfg.viewport.height})`);
console.log(`   grid-BR canvas(${brx},${bry}) → viewport(${Math.round(box.x + brx*box.width/800)},${Math.round(box.y + bry*box.height/500)})`);

const map = await makeCoordMapper(canvas, cfg.ruffle);
const clickCanvas = async (x, y, { hover = 300, settle = 2000 } = {}) => {
  const p = map(x, y);
  await page.mouse.move(p.x, p.y);
  await page.waitForTimeout(hover);
  await page.mouse.click(p.x, p.y);
  await page.waitForTimeout(settle);
};

W("00-start.png", await captureCanvas(page, canvas, cfg.ruffle));
let i = 0;
for (const c of CLICKS) {
  i++;
  await clickCanvas(c.x, c.y, { settle: c.settle ?? 2000 });
  await suppressRuffleOverlays(page);
  console.log(`▶ ${i} '${c.label}' canvas(${c.x},${c.y})  overlays=[${(await overlays()).join(",")}]  url=${page.url()}`);
  W(`${pad(i)}-${c.label}.png`, await captureCanvas(page, canvas, cfg.ruffle));
}

// ─── Extra advance clicks: keep clicking the BR window to push pop1 → book ───
// (Owner flow says one BR click; but if the overlay had been eating clicks the SWF
// may need more to step through the remaining windows.)
const extra = parseInt(opt("--extra", "0"), 10) || 0;
for (let e = 1; e <= extra; e++) {
  await clickCanvas(brx, bry, { settle: 2500 });
  await suppressRuffleOverlays(page);
  console.log(`▶ extra-click ${e} canvas(${brx},${bry})  overlays=[${(await overlays()).join(",")}]`);
  W(`extra-${pad(e)}.png`, await captureCanvas(page, canvas, cfg.ruffle));
}

// ─── Type `smurf` into Frank's "remember the word?" field ───
// Field is the dark box in the centred Win98 window: canvas ~(225,277).
// Replicates the proven input.js fix: focus-click, clear, slow per-char type, Enter.
if (has("--smurf")) {
  // The book opens with a ~12s intro (words fly in → book forms → Frank window
  // slides in). Wait for Frank's field to exist before typing, else smurf is lost.
  const preWait = parseInt(opt("--prewait", "13000"), 10);
  console.log(`▶ waiting ${preWait}ms for the book intro → Frank window…`);
  await page.waitForTimeout(preWait);
  await suppressRuffleOverlays(page);
  W("smurf-frank.png", await captureCanvas(page, canvas, cfg.ruffle));
  const [fx, fy] = (opt("--field", "350,305")).split(",").map(Number);
  const fp = map(fx, fy);
  console.log(`▶ smurf: focus field canvas(${fx},${fy}) → viewport(${Math.round(fp.x)},${Math.round(fp.y)})`);
  // Focus the Ruffle PLAYER HOST (where Ruffle attaches key listeners), not the
  // inner shadow canvas. Then click the field so Flash sets EditText focus, then
  // press each char individually (keyboard.type batches too fast for Ruffle).
  const focusMode = opt("--focusmode", "host");
  if (focusMode === "host") {
    try { await page.locator("ruffle-player, ruffle-object, ruffle-embed").first().focus({ timeout: 1000 }); } catch {}
  } else if (focusMode === "canvas") {
    try { await canvasLocator(page, cfg.ruffle).focus({ timeout: 1000 }); } catch {}
  }
  await page.mouse.click(fp.x, fp.y);
  await page.waitForTimeout(300);
  const ae1 = await page.evaluate(() => { const a = document.activeElement; return a ? `${a.tagName}${a.id ? "#" + a.id : ""}` : "null"; });
  console.log(`   activeElement after field click: ${ae1}`);
  if (has("--clear")) { await page.keyboard.press("Control+a"); await page.keyboard.press("Delete"); await page.waitForTimeout(120); }
  if (has("--insert")) {
    await page.keyboard.insertText("smurf");
  } else {
    for (const ch of "smurf") { await page.keyboard.press(ch); await page.waitForTimeout(150); }
  }
  await page.waitForTimeout(500);
  W("smurf-typed.png", await captureCanvas(page, canvas, cfg.ruffle));
  if (has("--enter")) await page.keyboard.press("Enter");
  await page.waitForTimeout(2500);
  await suppressRuffleOverlays(page);
  console.log(`   after smurf+Enter: overlays=[${(await overlays()).join(",")}]`);
  W("smurf-after.png", await captureCanvas(page, canvas, cfg.ruffle));
}

// ─── Smurfs → Donnie's letter → red word `breathe` ───
// Clicking a Smurf window (button 0176, e.g. canvas (110,115)) steps all 4 windows
// toward the letter; takes several clicks (owner). Then the red word `breathe` in
// the letter is the Level-2 password — detect+capture it.
if (has("--letter")) {
  // Clicking a Smurf window flashes the grid hidden for <0.5s, exposing the letter
  // with the red word `breathe`. Capture FAST (≈150ms) to catch the flash, then
  // detect the red word and (optionally) click it.
  const [swx, swy] = (opt("--smurfwin", "415,385")).split(",").map(Number);
  const nClicks = parseInt(opt("--letterclicks", "8"), 10);
  const flashMs = parseInt(opt("--flashms", "150"), 10);
  console.log(`▶ letter: click smurf window (${swx},${swy}) ×${nClicks}, capture +${flashMs}ms`);
  let bestRed = null;
  for (let k = 1; k <= nClicks; k++) {
    const p = map(swx, swy);
    await page.mouse.click(p.x, p.y);
    await page.waitForTimeout(flashMs);
    const shot = await captureCanvas(page, canvas, cfg.ruffle);
    W(`letter-${pad(k)}.png`, shot);
    const reds = detectRed(shot, cfg.ruffle.canvasSize);
    console.log(`   click ${k}: red clusters: ${reds.length ? reds.map((d) => `(${d.canvasX},${d.canvasY})·${d.pixels}px`).join(" ") : "none"}`);
    // The `breathe` word = a wide reddish cluster in the letter body (exclude the
    // persistent left zigzag/glow by preferring clusters in the letter region x>120).
    const cand = reds.filter((d) => d.canvasX > 120 && d.canvasY > 120 && d.canvasY < 420).sort((a, b) => b.pixels - a.pixels)[0];
    if (cand && (!bestRed || cand.pixels > bestRed.pixels)) bestRed = cand;
    await page.waitForTimeout(700); // let the grid settle back before next click
  }
  console.log(`   breathe candidate: ${bestRed ? `(${bestRed.canvasX},${bestRed.canvasY})·${bestRed.pixels}px` : "none found"}`);
  if (has("--clickbreathe")) {
    // `breathe` red word ≈ (433,406) (override with --breathe). The grid covers it;
    // flash the grid hidden then click breathe fast. Retry a few times for timing.
    const [bx, by] = (opt("--breathe", "433,406")).split(",").map(Number);
    // Flash with a window FAR from breathe (default top-right 620,120) so the flash
    // click doesn't re-hit the window overlapping breathe.
    const [flx, fly] = (opt("--flashwin", "620,120")).split(",").map(Number);
    const bd = parseInt(opt("--breathedelay", "120"), 10);
    const b = map(bx, by);
    for (let t = 1; t <= 6; t++) {
      const p = map(flx, fly);
      await page.mouse.click(p.x, p.y);           // flash grid hidden
      await page.waitForTimeout(bd);
      await page.mouse.click(b.x, b.y);           // click breathe during flash
      await page.waitForTimeout(1200);
      await suppressRuffleOverlays(page);
      const ov = (await overlays()).join(",");
      console.log(`   breathe try ${t} @(${bx},${by}) → url=${page.url()} overlays=[${ov}] popups=${popups.length}`);
      W(`breathe-${pad(t)}.png`, await captureCanvas(page, canvas, cfg.ruffle));
      if (!page.url().includes("is_unstable")) { console.log("   ↳ NAVIGATED!"); break; }
    }
  }
}

// ─── Observation loop: did the book ever animate in? ───
console.log("▶ OBSERVE (capture every 2s for 18s, hover right side over the figure)…");
for (let t = 1; t <= 9; t++) {
  const hp = map(640, 220);
  await page.mouse.move(hp.x, hp.y);
  await page.waitForTimeout(2000);
  await suppressRuffleOverlays(page);
  console.log(`   obs ${t}: overlays=[${(await overlays()).join(",")}]  popups=${popups.length}`);
  W(`obs-${pad(t)}.png`, await captureCanvas(page, canvas, cfg.ruffle));
}
// one grid-overlaid final frame for coordinate reading
await drawGrid(page, canvas, cfg.ruffle, 25);
W("obs-final-grid.png", await captureCanvas(page, canvas, cfg.ruffle));
await clearGrid(page);

console.log(`\n✔ output/gridbook/  (read obs-*.png; watch for [net] swf: thebook.swf above)`);
await context.close();
await browser.close();
