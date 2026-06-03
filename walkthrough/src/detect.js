// Pixel-pattern detectors shared by the runner actions and the calibration probes.
//
// This Flash game reaches for the same visual mechanics over and over, and two of
// them are far more robust to detect at runtime than to hard-code (coords drift as
// scenes animate / reposition):
//   • RED FEATURES — the menu crosshairs, the "DO YOU BELIEVE IN TIME TRAVEL?"
//     question, the chapter dots, and the red `breathe` word are all bright-red
//     marks/text on a dark stage.
//   • WIN98 TITLEBARS — pop-up windows (tangent boxes, Frank's password window, the
//     Smurf grid) carry a navy active-title bar; finding it locates the window even
//     after it slides to a new resting position between runs.
//
// All inputs are PNG Buffers (Playwright screenshots clipped to the canvas); all
// outputs are in CANVAS-LOCAL coords (authored stage, e.g. 800×500).

import { decode } from "./diff.js";

/**
 * Find clusters of bright "red" pixels. Returns centroids in canvas coords, largest
 * first: [{ canvasX, canvasY, pixels }].
 * @param {Buffer} pngBuf
 * @param {{width:number,height:number}} canvasSize  authored stage size
 * @param {object} [opts]
 * @param {{x0:number,x1:number,y0:number,y1:number}} [opts.band]  restrict to this
 *   canvas-coord region (keeps a persistent glow/zigzag elsewhere from winning).
 * @param {number} [opts.minPixels=4]  drop clusters smaller than this.
 * @param {boolean} [opts.loose=false]  looser threshold (catches dim red TEXT like
 *   the `breathe` word, not just saturated crosshairs).
 */
export function detectRed(pngBuf, canvasSize, opts = {}) {
  // `color:"white"` repurposes the same cluster machinery for BRIGHT features —
  // e.g. the sleepgolfing WHITE ARROW that slides along the right edge (its y is
  // animated, so it must be detected at runtime like the red chapter dots).
  const { band = null, minPixels = 4, maxPixels = Infinity, loose = false, color = "red" } = opts;
  const img = decode(pngBuf);
  const { width, height, data } = img;
  const sx = canvasSize.width / width, sy = canvasSize.height / height;
  const inBand = (cx, cy) => !band || (cx >= band.x0 && cx <= band.x1 && cy >= band.y0 && cy <= band.y1);
  const isRed = color === "white"
    ? (r, g, b) => r > 185 && g > 185 && b > 185
    : loose
      ? (r, g, b) => r > 110 && g < 85 && b < 85 && r - g > 45 && r - b > 45
      : (r, g, b) => r > 150 && g < 90 && b < 90 && r - g > 70 && r - b > 70;
  const pts = [];
  for (let y = 0; y < height; y += 2) for (let x = 0; x < width; x += 2) {
    const i = (y * width + x) * 4;
    if (isRed(data[i], data[i + 1], data[i + 2])) {
      const cx = Math.round(x * sx), cy = Math.round(y * sy);
      if (inBand(cx, cy)) pts.push([x, y]);
    }
  }
  const clusters = [];
  for (const [x, y] of pts) {
    let c = clusters.find((c) => Math.abs(c.cx - x) < 30 && Math.abs(c.cy - y) < 18);
    if (!c) { c = { sumX: 0, sumY: 0, n: 0, cx: x, cy: y }; clusters.push(c); }
    c.sumX += x; c.sumY += y; c.n++; c.cx = c.sumX / c.n; c.cy = c.sumY / c.n;
  }
  return clusters.filter((c) => c.n >= minPixels && c.n <= maxPixels)
    .map((c) => ({ canvasX: Math.round(c.cx * sx), canvasY: Math.round(c.cy * sy), pixels: c.n }))
    .sort((a, b) => b.pixels - a.pixels);
}

/**
 * Find Win98 navy active-title bars. Returns horizontal bands (one per title-bar row;
 * two side-by-side windows share a row) in canvas coords, top-first:
 *   [{ canvasY, x0, x1, pixels }].
 */
export function detectTitlebars(pngBuf, canvasSize, opts = {}) {
  // minWidth: a REAL Win98 titlebar spans its window's full width (~140-200 canvas
  // px in this game). Dark night scenes false-positive NARROW navy-ish runs (a
  // blue-jeans figure ≈11px wide, the golf cart ≈91px) — the width floor rejects
  // them while keeping every real window (narrowest observed: 144px).
  const { minRow = 15, rowBucket = 8, minWidth = 110 } = opts;
  const img = decode(pngBuf);
  const { width, height, data } = img;
  const sx = canvasSize.width / width, sy = canvasSize.height / height;
  const rows = new Map();
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 4, r = data[i], g = data[i + 1], b = data[i + 2];
    if (b > 90 && b - r > 40 && b - g > 20 && r < 120 && g < 120) {
      const ky = Math.round(y / rowBucket) * rowBucket;
      let rec = rows.get(ky);
      if (!rec) { rec = { xs: [], n: 0 }; rows.set(ky, rec); }
      rec.xs.push(x); rec.n++;
    }
  }
  return [...rows.entries()]
    .filter(([, rec]) => rec.n > minRow)
    .map(([ky, rec]) => ({
      canvasY: Math.round(ky * sy),
      x0: Math.round(Math.min(...rec.xs) * sx),
      x1: Math.round(Math.max(...rec.xs) * sx),
      pixels: rec.n,
    }))
    .filter((b) => b.x1 - b.x0 >= minWidth)
    .sort((a, b) => a.canvasY - b.canvasY);
}

/**
 * Locate a single pop-up window's editable field / content centre from its navy
 * titlebar. The field sits a fixed offset BELOW the titlebar, horizontally centred
 * on it. Used to type into password windows (Frank/smurf) that reposition per run.
 * Returns { x, y } in canvas coords, or null if no titlebar found.
 * @param {number} [opts.yOffset=186]  px below the titlebar row to the field centre.
 * @param {number} [opts.pick=0]  which titlebar band (0=topmost).
 */
export function locateWindowField(pngBuf, canvasSize, opts = {}) {
  const { yOffset = 186, pick = 0 } = opts;
  const bars = detectTitlebars(pngBuf, canvasSize);
  if (!bars.length) return null;
  const bar = bars[Math.min(pick, bars.length - 1)];
  return { x: Math.round((bar.x0 + bar.x1) / 2), y: bar.canvasY + yOffset, bar };
}
