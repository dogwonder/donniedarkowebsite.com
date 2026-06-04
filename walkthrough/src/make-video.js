// Stitch the full-run video: take the main-page webm Playwright recorded
// (full viewport — game canvas plus surrounding page) and composite each
// popup tab as a FULL-FRAME CUTAWAY at the real moment it was open, using
// the tOpenMs/tCloseMs offsets the runner stamps into manifest.json.
// Output: a single H.264 MP4 of the entire playthrough.
//
// Usage: node src/make-video.js [manifestPath] [outPath]
//   defaults: output/manifest.json → output/walkthrough.mp4
// Requires ffmpeg on PATH.

import { readFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const manifestPath = resolve(process.argv[2] ?? "output/manifest.json");
const outPath = resolve(process.argv[3] ?? join(dirname(manifestPath), "walkthrough.mp4"));

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
if (!manifest.video) {
  console.error("✖ manifest has no video — run with output.video: true in config.json");
  process.exit(1);
}
if (!existsSync(manifest.video)) {
  console.error(`✖ video file missing: ${manifest.video}`);
  process.exit(1);
}

const shotsDir = join(dirname(manifestPath), manifest.screenshotsSubdir ?? "screenshots");
const { width: W, height: H } = manifest.viewport ?? { width: 1280, height: 800 };

// Collect cutaways from every step's popups. Lead-in skips the blank tab-load
// moment; popups without a close stamp (keepPopup) get a fixed 3s cutaway.
const LEAD_IN_S = 0.25;
const MIN_DUR_S = 1.0;
const cutaways = [];
for (const step of manifest.steps ?? []) {
  for (const p of step.popups ?? []) {
    if (p.tOpenMs == null) continue; // pre-timestamp manifest — re-run the playthrough
    const file = join(shotsDir, p.file);
    if (!existsSync(file)) { console.warn(`⚠ popup image missing, skipping: ${p.file}`); continue; }
    const start = p.tOpenMs / 1000 + LEAD_IN_S;
    const end = p.tCloseMs != null ? p.tCloseMs / 1000 : start + 3;
    cutaways.push({ file, url: p.url, step: step.id, start, end: Math.max(end, start + MIN_DUR_S) });
  }
}

console.log(`stitching ${cutaways.length} popup cutaway(s) into ${manifest.video}`);
for (const c of cutaways) console.log(`  ${c.start.toFixed(1)}s–${c.end.toFixed(1)}s  [${c.step}] ${c.url}`);

// Build the filtergraph: scale/pad each popup PNG to the viewport, then chain
// overlays gated by enable='between(t,start,end)'. Still inputs use -loop 1
// (infinite); the graph ends when the main video ends.
const args = ["-y", "-i", manifest.video];
const filters = [];
for (let i = 0; i < cutaways.length; i++) {
  args.push("-loop", "1", "-i", cutaways[i].file);
  filters.push(`[${i + 1}:v]scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:black,setsar=1[p${i}]`);
}
let chain = "[0:v]";
for (let i = 0; i < cutaways.length; i++) {
  const out = i === cutaways.length - 1 ? "[vout]" : `[v${i}]`;
  // shortest=1 is ESSENTIAL: the -loop 1 still inputs are infinite, and without
  // it the overlay keeps producing frames forever after the main video ends
  // (verified: a 2s clip ran past 900s). With it, output ends at main EOF.
  filters.push(`${chain}[p${i}]overlay=0:0:enable='between(t,${cutaways[i].start.toFixed(3)},${cutaways[i].end.toFixed(3)})':shortest=1${out}`);
  chain = `[v${i}]`;
}

if (cutaways.length) {
  args.push("-filter_complex", filters.join(";"), "-map", "[vout]");
} else {
  console.log("no cutaways — transcoding main video only.");
}
args.push("-an", "-c:v", "libx264", "-crf", "18", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-r", "30", "-movflags", "+faststart", outPath);

console.log("\nffmpeg", args.map((a) => (/[ '()]/.test(a) ? JSON.stringify(a) : a)).join(" "), "\n");
const res = spawnSync("ffmpeg", args, { stdio: ["ignore", "inherit", "inherit"] });
if (res.status !== 0) { console.error(`✖ ffmpeg exited ${res.status}`); process.exit(res.status ?? 1); }
console.log(`\n✔ wrote ${outPath}`);
