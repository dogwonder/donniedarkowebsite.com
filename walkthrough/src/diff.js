// Pixel-diff helpers built on pngjs + pixelmatch.
// Everything here operates on PNG Buffers (what Playwright's screenshot returns).

import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";

/** Decode a PNG Buffer into a pngjs image ({ width, height, data }). */
export function decode(buffer) {
  return PNG.sync.read(buffer);
}

/**
 * Fraction of pixels that differ between two PNG buffers (0..1).
 * Mismatched dimensions count as fully different (1).
 *
 * @param {Buffer} bufA
 * @param {Buffer} bufB
 * @param {{ pixelmatchThreshold?: number }} [opts]
 * @returns {number}
 */
export function diffRatio(bufA, bufB, { pixelmatchThreshold = 0.12 } = {}) {
  const a = decode(bufA);
  const b = decode(bufB);
  if (a.width !== b.width || a.height !== b.height) return 1;

  const { width, height } = a;
  const changed = pixelmatch(a.data, b.data, null, width, height, {
    threshold: pixelmatchThreshold,
  });
  return changed / (width * height);
}
