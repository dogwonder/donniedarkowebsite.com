// Load + lightly validate a steps file, and resolve each step's effective
// wait config by layering: config.settle  <  steps.defaults  <  step.wait.

import { readFileSync } from "node:fs";
import { dirname, resolve, isAbsolute } from "node:path";

export function loadSteps(stepsPath) {
  const raw = JSON.parse(readFileSync(stepsPath, "utf8"));
  if (!raw || !Array.isArray(raw.steps) || raw.steps.length === 0) {
    throw new Error(`Steps file has no "steps" array: ${stepsPath}`);
  }
  const seen = new Set();
  for (const s of raw.steps) {
    if (!s.id) throw new Error(`Every step needs an "id" (caption: ${s.caption ?? "?"}).`);
    if (seen.has(s.id)) throw new Error(`Duplicate step id: ${s.id}`);
    seen.add(s.id);
    if (!s.caption) throw new Error(`Step ${s.id} is missing a caption.`);
  }
  return raw;
}

/**
 * Compute the wait config the runner should use for a step.
 * Reference image paths are resolved relative to the steps file.
 */
export function resolveWait(step, settleDefaults, stepsDefaults, stepsPath) {
  const merged = {
    mode: "diff-stable",
    ...settleDefaults,
    ...(stepsDefaults ?? {}),
    ...(step.wait ?? {}),
  };
  // Drop documentation keys (config.json uses "$comment" annotations).
  for (const k of Object.keys(merged)) if (k.startsWith("$")) delete merged[k];
  if (merged.mode === "match-reference" && merged.reference) {
    const base = dirname(stepsPath);
    merged.referencePath = isAbsolute(merged.reference)
      ? merged.reference
      : resolve(base, merged.reference);
  }
  return merged;
}

/** Resolve a step's navigate target against the base URL. */
export function resolveUrl(baseUrl, navigate) {
  if (!navigate) return null;
  if (/^https?:\/\//i.test(navigate)) return navigate;
  return baseUrl.replace(/\/+$/, "") + "/" + navigate.replace(/^\/+/, "");
}
