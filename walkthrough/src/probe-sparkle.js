#!/usr/bin/env node
// Probe for LEVEL 2 FINALE — phase2_end.swf on /sparkle/motion/main.html (the
// "burn it down" / Sparkle Motion ending, aid steps 32-36). DRIVABLE STANDALONE
// (the page <embed>s phase2_end.swf with autoplay; canvas sits BOTTOM-RIGHT via
// `flex items-end justify-end` — the coord mapper adapts via getBoundingClientRect).
//
// Beats (aid 32-36 + swfdump labels getsdown/popwin/WIN/MAC/nowyou/out):
//   32 click "dot at top" → donnie walking home; RIGHT-CLICK → play/forward.
//   33 Jim's license popup (45a rose st) → click inside window.
//   34 dancers + p1-p6 fire popups "burn it down" → click inside popups.
//   35 donnie-at-fire popup → click inside.
//   36 "burn it down donnie" → auto-forward to /menu.html (end button getURL ../../further.html).
//
// Modes:
//   node src/probe-sparkle.js --observe [--interval 1500] [--frames 14]   # no clicks
//   node src/probe-sparkle.js --rightclick [--rcx 400 --rcy 250]          # test right-click → does it advance?
//   node src/probe-sparkle.js                                             # apply CLICKS array
//   add --headed to watch. Writes output/sparkle/NN-*-{clean,grid}.png.

import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

import { waitForRuffleReady, makeCoordMapper, suppressRuffleOverlays } from "./canvas.js";
import { captureCanvas } from "./capture.js";
import { drawGrid, clearGrid } from "./grid.js";
import { detectRed } from "./detect.js";
import { resolveUrl } from "./steps.js";

// ─── EDIT THIS: click sequence (canvas-local 0..800 × 0..500) ───
const CLICKS = [
  { label: "start-play", x: 400, y: 250, settle: 13000 },  // left-click STARTS phase2_end.swf; plays ~12s → stops on donnie/red-beams
  { label: "adv1", x: 700, y: 380, settle: 5000 },          // click donnie/scene → license popup? (discover)
  { label: "adv2", x: 110, y: 215, settle: 5000 },          // click inside license popup (V2: red bar ~top-left) → next
  { label: "adv3", x: 400, y: 250, settle: 5000 },          // generic advance → BURN DOWN grid?
];
// ────────────────────────────────────────────────────────────────

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const has = (n) => argv.includes(n);
const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const cfg = JSON.parse(readFileSync(join(projectRoot, "config.json"), "utf8"));
const outDir = join(projectRoot, "output", "sparkle");
mkdirSync(outDir, { recursive: true });
const W = (n, buf) => writeFileSync(join(outDir, n), buf);
const pad = (n) => String(n).padStart(2, "0");

const browser = await chromium.launch({ headless: !has("--headed") });
const context = await browser.newContext({ viewport: cfg.viewport, deviceScaleFactor: cfg.deviceScaleFactor ?? 1 });
const page = await context.newPage();
page.on("console", (m) => { const t = m.text(); if (/ruffle|\.swf|menu|further|available/i.test(t)) console.log(`  [page] ${t}`); });
page.on("requestfinished", (r) => { const u = r.url(); if (/\.swf(\?|$)/i.test(u)) console.log(`  [net] swf: ${u.split("/").pop()}`); });

const popups = [];
context.on("page", (p) => popups.push(p));
async function drainPopups(label) {
  for (const pop of popups.splice(0)) {
    try {
      await pop.waitForLoadState("domcontentloaded", { timeout: 5000 });
      await pop.waitForTimeout(400);
      W(`popup-${label}.png`, await pop.screenshot());
      console.log(`  ↗ popup ${label}: ${pop.url()}`);
      await pop.close();
    } catch (e) { console.log(`  ⚠ popup ${label}: ${e.message}`); }
  }
}

const url = resolveUrl(cfg.baseUrl, "/sparkle/motion/main.html");
console.log(`▶ ${url}`);
await page.goto(url, { waitUntil: "load" });
const canvas = await waitForRuffleReady(page, cfg.ruffle, console.log);
await page.waitForTimeout(cfg.settle.initialSettleMs);
await suppressRuffleOverlays(page);
const map = await makeCoordMapper(canvas, cfg.ruffle);

const snap = async (name, withGrid = true) => {
  await suppressRuffleOverlays(page);
  const shot = await captureCanvas(page, canvas, cfg.ruffle);
  W(`${name}-clean.png`, shot);
  if (withGrid) {
    await drawGrid(page, canvas, cfg.ruffle, 50);
    W(`${name}-grid.png`, await captureCanvas(page, canvas, cfg.ruffle));
    await clearGrid(page);
  }
  return shot;
};

// ─── OBSERVE: does it autoplay or sit paused (right-click-play needed)? ───
if (has("--observe")) {
  const interval = parseInt(opt("--interval", "1500"), 10);
  const frames = parseInt(opt("--frames", "14"), 10);
  console.log(`▶ observe: ${frames} frames every ${interval}ms`);
  if (opt("--clickstart", null)) {
    const [cx, cy] = opt("--clickstart").split(",").map(Number);
    const cp = map(cx, cy);
    console.log(`  ↳ initial ${opt("--startbtn", "left")}-click @ canvas(${cx},${cy}) before observing`);
    await page.mouse.click(cp.x, cp.y, { button: opt("--startbtn", "left") });
    await page.waitForTimeout(800);
  }
  for (let f = 0; f < frames; f++) {
    const shot = await snap(`obs-${pad(f)}`);
    const reds = detectRed(shot, cfg.ruffle.canvasSize, { minPixels: 4 }).slice(0, 5);
    console.log(`  [t=${(f * interval / 1000).toFixed(1)}s] reds: ` +
      (reds.length ? reds.map((d) => `(${d.canvasX},${d.canvasY})·${d.pixels}`).join("  ") : "none") +
      `  url=${page.url().split("/").slice(-2).join("/")}`);
    await drainPopups(`obs-${pad(f)}`);
    await page.waitForTimeout(interval);
  }
  console.log(`\n✔ observe shots in output/sparkle/`);
  await context.close(); await browser.close(); process.exit(0);
}

// ─── RIGHT-CLICK test: does a right-click → Ruffle "Play" advance the movie? ───
if (has("--rightclick")) {
  const rcx = parseInt(opt("--rcx", "400"), 10), rcy = parseInt(opt("--rcy", "250"), 10);
  await snap("rc-before");
  const p = map(rcx, rcy);
  console.log(`▶ right-click @ canvas(${rcx},${rcy}) → page(${Math.round(p.x)},${Math.round(p.y)})`);
  await page.mouse.click(p.x, p.y, { button: "right" });
  await page.waitForTimeout(800);
  // Inspect any Ruffle context menu in the DOM (it renders items as a list).
  const menu = await page.evaluate(() => {
    const els = [...document.querySelectorAll("*")].filter((e) => /context.?menu/i.test(e.className || "") || /context.?menu/i.test(e.id || ""));
    const items = [...document.querySelectorAll("li, .menu_item, [role=menuitem]")]
      .map((e) => (e.textContent || "").trim()).filter(Boolean).slice(0, 20);
    return { containers: els.map((e) => e.className || e.id), items };
  });
  console.log(`  context-menu containers: ${JSON.stringify(menu.containers)}`);
  console.log(`  context-menu items: ${JSON.stringify(menu.items)}`);
  W("rc-menu.png", await page.screenshot()); // full-page so the menu is visible
  // Try to click a "Play" item if present.
  let played = false;
  for (const label of ["Play", "Resume", "Forward"]) {
    const item = page.getByText(label, { exact: true });
    if (await item.count().catch(() => 0)) {
      try { await item.first().click({ timeout: 1500 }); played = true; console.log(`  ▶ clicked menu item "${label}"`); break; } catch {}
    }
  }
  if (!played) { console.log("  (no Play menu item clicked — pressing Escape)"); await page.keyboard.press("Escape"); }
  await page.waitForTimeout(2500);
  await snap("rc-after");
  // Also report whether the Ruffle player JS API can play() programmatically.
  const apiPlay = await page.evaluate(() => {
    const host = document.querySelector("ruffle-player, #swf ruffle-player, embed");
    const inst = host && (host.ruffle || host);
    try { if (inst && typeof inst.play === "function") { inst.play(); return "called inst.play()"; } } catch (e) { return "play() threw: " + e.message; }
    return "no .play() on player";
  });
  console.log(`  JS API: ${apiPlay}`);
  await page.waitForTimeout(2500);
  await snap("rc-after-apiplay");
  console.log(`\n✔ right-click shots in output/sparkle/ (rc-before, rc-menu, rc-after, rc-after-apiplay)`);
  await context.close(); await browser.close(); process.exit(0);
}

// ─── RESUME test: start the movie, let it stop, then try ways to advance ───
if (has("--resumetest")) {
  const c = map(400, 250);
  console.log("▶ left-click to START, wait 13s for the play→stop");
  await page.mouse.click(c.x, c.y);
  await page.waitForTimeout(13000);
  await snap("res-00-stopped");
  const tries = [
    ["rclick", async () => page.mouse.click(c.x, c.y, { button: "right" })],
    ["dblclick", async () => page.mouse.dblclick(c.x, c.y)],
    ["space", async () => page.keyboard.press(" ")],
    ["enter", async () => page.keyboard.press("Enter")],
    ["lclick2", async () => page.mouse.click(c.x, c.y)],
    ["click-donnie", async () => { const d = map(700, 360); return page.mouse.click(d.x, d.y); }],
  ];
  for (let k = 0; k < tries.length; k++) {
    const [name, act] = tries[k];
    console.log(`  ▶ try ${name}`);
    await act();
    await page.waitForTimeout(3000);
    const shot = await snap(`res-${pad(k + 1)}-${name}`);
    const reds = detectRed(shot, cfg.ruffle.canvasSize, { minPixels: 4 }).slice(0, 4);
    console.log(`     reds: ` + (reds.length ? reds.map((d) => `(${d.canvasX},${d.canvasY})·${d.pixels}`).join("  ") : "none"));
    await drainPopups(`res-${name}`);
  }
  console.log(`\n✔ resume-test shots in output/sparkle/res-*`);
  await context.close(); await browser.close(); process.exit(0);
}

// ─── CLICK sequence ───
await snap("00-start");
let i = 0;
for (const c of CLICKS) {
  i++;
  console.log(`▶ click ${i} '${c.label}' canvas(${c.x},${c.y})${c.button === "right" ? " [right]" : ""}`);
  const p = map(c.x, c.y);
  if (c.hoverMs) { await page.mouse.move(p.x, p.y); await page.waitForTimeout(c.hoverMs); }
  await page.mouse.click(p.x, p.y, { button: c.button ?? "left" });
  await page.waitForTimeout(c.settle ?? 2500);
  await drainPopups(`${pad(i)}-${c.label}`);
  await snap(`${pad(i)}-${c.label}`);
  console.log(`   ↳ wrote ${pad(i)}-${c.label}-{clean,grid}.png (url: ${page.url()})`);
}
console.log(`\n✔ wrote screenshots to output/sparkle/`);
await context.close();
await browser.close();
