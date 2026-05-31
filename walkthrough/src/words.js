// Detect drifting menu word-labels by finding clusters of dark text pixels in
// a captured canvas PNG, returning their centroids (canvas-local coords).
// The menu words are near-black text on a light sky; cluster dark pixels into
// blobs via coarse grid-bucketing + neighbour merge.

import { decode } from "./diff.js";

/**
 * @param {Buffer} png  full-canvas screenshot
 * @param {object} ruffleCfg
 * @param {object} [opts] { region, lumaMax, minPixels, bucket }
 * @returns {Array<{x:number,y:number,n:number}>} centroids in CANVAS-LOCAL coords, largest first
 */
export function detectWords(png, ruffleCfg, opts = {}) {
  const img = decode(png);
  const { width: W, height: H } = img; // pixel dims of the screenshot (rendered size)
  const { canvasSize } = ruffleCfg;
  const sx = canvasSize.width / W;   // px → canvas-local
  const sy = canvasSize.height / H;

  const region = opts.region ?? { x: 60, y: 160, width: 680, height: 280 }; // canvas-local
  const lumaMax = opts.lumaMax ?? 95;
  const minPixels = opts.minPixels ?? 12;
  const maxPixels = opts.maxPixels ?? 300;  // exclude big solid shards
  const bucket = opts.bucket ?? 22; // canvas-local px per cluster cell
  const grayOnly = opts.grayOnly ?? true;   // exclude coloured marks (red crosshairs)

  // Region in pixel coords.
  const px0 = Math.max(0, Math.floor(region.x / sx));
  const py0 = Math.max(0, Math.floor(region.y / sy));
  const px1 = Math.min(W, Math.ceil((region.x + region.width) / sx));
  const py1 = Math.min(H, Math.ceil((region.y + region.height) / sy));

  // Bucket dark pixels.
  const cells = new Map(); // key -> {sx,sy,n}
  for (let y = py0; y < py1; y++) {
    for (let x = px0; x < px1; x++) {
      const i = (y * W + x) * 4;
      const r = img.data[i], g = img.data[i + 1], b = img.data[i + 2];
      const luma = 0.299 * r + 0.587 * g + 0.114 * b;
      if (luma > lumaMax) continue;
      if (grayOnly && (Math.abs(r - g) > 40 || Math.abs(g - b) > 40 || Math.abs(r - b) > 40)) continue;
      const cxl = x * sx, cyl = y * sy;       // canvas-local
      const key = `${Math.floor(cxl / bucket)},${Math.floor(cyl / bucket)}`;
      const c = cells.get(key) ?? { sx: 0, sy: 0, n: 0 };
      c.sx += cxl; c.sy += cyl; c.n++;
      cells.set(key, c);
    }
  }

  // Merge adjacent buckets (8-neighbourhood) into blobs.
  const cellList = [...cells.entries()].map(([k, v]) => {
    const [bx, by] = k.split(",").map(Number);
    return { bx, by, ...v };
  });
  const keyset = new Map(cellList.map((c) => [`${c.bx},${c.by}`, c]));
  const seen = new Set();
  const blobs = [];
  for (const c of cellList) {
    const k0 = `${c.bx},${c.by}`;
    if (seen.has(k0)) continue;
    // BFS merge
    const stack = [c];
    seen.add(k0);
    let sxSum = 0, sySum = 0, n = 0;
    while (stack.length) {
      const cur = stack.pop();
      sxSum += cur.sx; sySum += cur.sy; n += cur.n;
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        const nk = `${cur.bx + dx},${cur.by + dy}`;
        if (keyset.has(nk) && !seen.has(nk)) { seen.add(nk); stack.push(keyset.get(nk)); }
      }
    }
    if (n >= minPixels && n <= maxPixels) blobs.push({ x: Math.round(sxSum / n), y: Math.round(sySum / n), n });
  }
  return blobs.sort((a, b) => b.n - a.n);
}
