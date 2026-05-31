// Animation-settle gating. Instead of fixed sleeps, we poll the canvas and wait
// for it to stop changing (diff-stable) or to match a known end-state still
// (match-reference). Both have a hard max-timeout fallback.

import { readFileSync } from "node:fs";
import { captureCanvas } from "./capture.js";
import { diffRatio } from "./diff.js";

/**
 * Wait for the canvas animation to settle.
 *
 * @returns {Promise<{ settled: boolean, mode: string, waitedMs: number, samples: number, finalDiff: number|null, frame: Buffer }>}
 *   `settled` is false when we hit maxWaitMs without converging (step proceeds anyway, flagged).
 *   `frame` is the last captured canvas PNG (reusable as the step's "after" shot).
 */
export async function settle(page, canvas, ruffleCfg, cfg, log = () => {}) {
  const mode = cfg.mode ?? "diff-stable";
  const start = nowFn();

  if (mode === "none") {
    const frame = await captureCanvas(page, canvas, ruffleCfg, cfg.region);
    return { settled: true, mode, waitedMs: 0, samples: 0, finalDiff: null, frame };
  }

  if (mode === "fixed") {
    await page.waitForTimeout(cfg.fixedMs ?? 1000);
    const frame = await captureCanvas(page, canvas, ruffleCfg, cfg.region);
    return { settled: true, mode, waitedMs: nowFn() - start, samples: 1, finalDiff: null, frame };
  }

  const {
    pollIntervalMs,
    stableFrames,
    diffThreshold,
    pixelmatchThreshold,
    matchThreshold,
    maxWaitMs,
    region,
    minWaitMs = 0,
  } = cfg;

  const reference = mode === "match-reference" && cfg.referencePath
    ? readFileSync(cfg.referencePath)
    : null;
  if (mode === "match-reference" && !reference) {
    throw new Error(`match-reference step is missing a readable reference image (${cfg.reference}).`);
  }

  let prev = await captureCanvas(page, canvas, ruffleCfg, region);
  let consecutive = 0;
  let samples = 1;
  let lastDiff = null;

  while (nowFn() - start < maxWaitMs) {
    await page.waitForTimeout(pollIntervalMs);
    const cur = await captureCanvas(page, canvas, ruffleCfg, region);
    samples++;

    const minElapsed = nowFn() - start >= minWaitMs;

    if (mode === "match-reference") {
      lastDiff = diffRatio(cur, reference, { pixelmatchThreshold });
      // Require the match to also be momentarily stable, so we don't latch onto
      // a frame that merely passes through the target state mid-animation.
      const stableVsPrev = diffRatio(cur, prev, { pixelmatchThreshold }) <= diffThreshold;
      if (minElapsed && lastDiff <= matchThreshold && stableVsPrev) {
        log(`matched reference (diff ${(lastDiff * 100).toFixed(2)}%) after ${samples} samples.`);
        return { settled: true, mode, waitedMs: nowFn() - start, samples, finalDiff: lastDiff, frame: cur };
      }
    } else {
      // diff-stable
      lastDiff = diffRatio(cur, prev, { pixelmatchThreshold });
      if (lastDiff <= diffThreshold) {
        if (++consecutive >= stableFrames && minElapsed) {
          log(`settled (≤${(diffThreshold * 100).toFixed(2)}% for ${stableFrames} frames) after ${samples} samples.`);
          return { settled: true, mode, waitedMs: nowFn() - start, samples, finalDiff: lastDiff, frame: cur };
        }
      } else {
        consecutive = 0;
      }
    }
    prev = cur;
  }

  log(`⚠️  settle timed out at ${maxWaitMs}ms (last diff ${lastDiff == null ? "n/a" : (lastDiff * 100).toFixed(2) + "%"}); proceeding.`);
  return { settled: false, mode, waitedMs: nowFn() - start, samples, finalDiff: lastDiff, frame: prev };
}

// Wall-clock. Wrapped so it's obvious this is intentional runtime timing.
function nowFn() {
  return Date.now();
}
