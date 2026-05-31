#!/usr/bin/env node
// Entry point. Usage:
//   node src/cli.js [--config config.json] [--steps steps/donnie.steps.json]
//                   [--out output] [--headed] [--generate-only]
//
//   --headed         run a visible browser (useful while calibrating coords)
//   --generate-only  skip the browser run; rebuild walkthrough.html from an
//                    existing output/manifest.json (fast iteration on layout)

import { readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { loadSteps } from "./steps.js";
import { generateHtml } from "./generate.js";
// runner.js (and therefore playwright) is imported lazily, so --generate-only
// works without the browser dependency installed.

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(argv) {
  const args = { config: "config.json", steps: "steps/donnie.steps.json", out: "output", headed: false, generateOnly: false, grid: false, until: null, continueOnError: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--headed") args.headed = true;
    else if (a === "--generate-only") args.generateOnly = true;
    else if (a === "--grid") args.grid = true;
    else if (a === "--continue-on-error") args.continueOnError = true;
    else if (a === "--until") args.until = argv[++i];
    else if (a === "--config") args.config = argv[++i];
    else if (a === "--steps") args.steps = argv[++i];
    else if (a === "--out") args.out = argv[++i];
    else if (a === "-h" || a === "--help") { printHelp(); process.exit(0); }
    else { console.error(`Unknown argument: ${a}`); process.exit(1); }
  }
  return args;
}

function printHelp() {
  console.log(`ruffle-walkthrough
  --config <path>     runner config        (default config.json)
  --steps  <path>     steps definition     (default steps/donnie.steps.json)
  --out    <dir>      output directory      (default output)
  --headed            run a visible browser
  --generate-only     rebuild HTML from an existing manifest, no browser
  --grid              also save a coordinate-grid overlay of each step's before-state (calibration)
  --until <stepId>    stop after the given step id (calibration)
  --continue-on-error don't abort when an action fails (calibration)`);
}

const args = parseArgs(process.argv);
const abs = (p) => (p && (p.startsWith("/") ? p : join(projectRoot, p)));

const configPath = abs(args.config);
const stepsPath = abs(args.steps);
const outDir = abs(args.out);

const config = JSON.parse(readFileSync(configPath, "utf8"));

if (args.generateOnly) {
  const manifest = JSON.parse(readFileSync(join(outDir, "manifest.json"), "utf8"));
  const out = generateHtml({ manifest, outDir, htmlName: config.output.html, title: config.output.title });
  console.log(`✔ regenerated ${out}`);
} else {
  const stepsDoc = loadSteps(stepsPath);
  const { runPlaythrough } = await import("./runner.js");
  const manifest = await runPlaythrough({ config, stepsDoc, stepsPath, headed: args.headed, outDir, grid: args.grid, until: args.until, continueOnError: args.continueOnError });
  const out = generateHtml({ manifest, outDir, htmlName: config.output.html, title: config.output.title });
  console.log(`✔ walkthrough written to ${out}`);
}
