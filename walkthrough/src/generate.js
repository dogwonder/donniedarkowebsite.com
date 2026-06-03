// HTML generator: turn a run manifest + captured screenshots into a single
// self-contained walkthrough.html (images inlined as base64 data URIs).

import { readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// `name` is the bare screenshot filename (may be null/empty for steps with
// captureBefore:false). Guard against empty — join(dir, "") would resolve to the
// directory itself, which exists but isn't a file (EISDIR on read).
function dataUri(dir, name) {
  if (!name) return null;
  const file = join(dir, name);
  if (!existsSync(file) || !statSync(file).isFile()) return null;
  return "data:image/png;base64," + readFileSync(file).toString("base64");
}

export function generateHtml({ manifest, outDir, htmlName, title }) {
  const shotsDir = join(outDir, manifest.screenshotsSubdir);
  const pageTitle = title ?? manifest.title ?? "Playthrough";

  let lastSection = null;
  const sections = [];

  for (const step of manifest.steps) {
    if (step.section && step.section !== lastSection) {
      sections.push(`<h2 class="section">${esc(step.section)}</h2>`);
      lastSection = step.section;
    }

    // Curated GALLERY step (e.g. the complete Philosophy-of-Time-Travel book):
    // `step.gallery` is a dir holding an index.json of { file, title } pages —
    // render them as a captioned grid instead of before/after shots.
    if (step.gallery) {
      let pages = [];
      try { pages = JSON.parse(readFileSync(join(step.gallery, "index.json"), "utf8")).pages ?? []; }
      catch { /* missing index — render the caption alone */ }
      const figs = pages
        .map((p) => ({ uri: dataUri(step.gallery, p.file), title: p.title }))
        .filter((p) => p.uri)
        .map((p) => `<figure><img loading="lazy" src="${p.uri}" alt="${esc(p.title)}"><figcaption>${esc(p.title)}</figcaption></figure>`);
      sections.push(`
<section class="step">
  <div class="step__head">
    <span class="step__num">${String(step.index).padStart(2, "0")}</span>
    <div class="step__meta">
      <p class="step__caption">${esc(step.caption)}</p>
      <p class="step__action">${esc(step.actionDesc)}</p>
    </div>
  </div>
  <div class="gallery">${figs.join("")}</div>
</section>`);
      continue;
    }

    const before = dataUri(shotsDir, step.before);
    const after = dataUri(shotsDir, step.after);
    const popups = (step.popups ?? []).map((p) => ({ uri: dataUri(shotsDir, p.file), url: p.url })).filter((p) => p.uri);
    const flags = [];
    if (step.navigate) flags.push(`<span class="flag nav">↪ ${esc(step.navigate)}</span>`);
    if (step.wait && !step.wait.settled) flags.push(`<span class="flag warn">settle timed out</span>`);
    const waitInfo = step.wait
      ? `${esc(step.wait.mode)} · ${step.wait.waitedMs}ms · ${step.wait.samples} samples${step.wait.finalDiff != null ? " · diff " + (step.wait.finalDiff * 100).toFixed(2) + "%" : ""}`
      : "";

    sections.push(`
<section class="step">
  <div class="step__head">
    <span class="step__num">${String(step.index).padStart(2, "0")}</span>
    <div class="step__meta">
      <p class="step__caption">${esc(step.caption)}</p>
      <p class="step__action">${esc(step.actionDesc)}</p>
    </div>
    <div class="step__flags">${flags.join(" ")}</div>
  </div>
  <div class="shots">
    <figure>${before ? `<img loading="lazy" src="${before}" alt="before step ${step.index}">` : `<div class="noimg">no before frame</div>`}<figcaption>before</figcaption></figure>
    <figure>${after ? `<img loading="lazy" src="${after}" alt="after step ${step.index}">` : `<div class="noimg">no after frame</div>`}<figcaption>after</figcaption></figure>
  </div>
  ${popups.length ? `<div class="popups">${popups.map((p) => `<figure><img loading="lazy" src="${p.uri}" alt="popup"><figcaption>↗ opened tab — ${esc(p.url.replace(/^https?:\/\/[^/]+/, ""))} (read &amp; close to continue)</figcaption></figure>`).join("")}</div>` : ""}
  <p class="wait">${esc(waitInfo)}</p>
</section>`);
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(pageTitle)}</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; font: 15px/1.5 ui-monospace, "DepartureMono", Menlo, monospace; background: #0b0b0d; color: #e6e6e6; }
  header { padding: 2rem 1.5rem 1rem; border-bottom: 1px solid #222; }
  header h1 { margin: 0 0 .25rem; font-size: 1.4rem; }
  header .sub { color: #888; font-size: .8rem; }
  main { max-width: 980px; margin: 0 auto; padding: 1.5rem; }
  h2.section { margin: 2.5rem 0 1rem; padding-bottom: .35rem; border-bottom: 1px solid #333; color: #ff5a5a; font-size: 1.05rem; letter-spacing: .04em; text-transform: uppercase; }
  .step { border: 1px solid #1c1c20; border-radius: 8px; padding: 1rem 1.1rem; margin: 1rem 0; background: #111114; }
  .step__head { display: flex; gap: .9rem; align-items: flex-start; }
  .step__num { font-size: 1.3rem; color: #ff5a5a; font-weight: 700; min-width: 2.2ch; }
  .step__meta { flex: 1; }
  .step__caption { margin: .1rem 0; }
  .step__action { margin: .1rem 0; color: #7fd1ff; font-size: .85rem; }
  .step__flags { display: flex; flex-direction: column; gap: .25rem; align-items: flex-end; }
  .flag { font-size: .7rem; padding: .1rem .4rem; border-radius: 4px; white-space: nowrap; }
  .flag.nav { background: #16233a; color: #7fd1ff; }
  .flag.warn { background: #3a1616; color: #ff9a9a; }
  .shots { display: grid; grid-template-columns: 1fr 1fr; gap: .8rem; margin: .9rem 0 .3rem; }
  figure { margin: 0; }
  figure img { width: 100%; display: block; border: 1px solid #2a2a30; border-radius: 4px; background: #000; }
  figcaption { color: #777; font-size: .72rem; text-transform: uppercase; letter-spacing: .08em; margin-top: .3rem; }
  .noimg { aspect-ratio: 8/5; display: grid; place-items: center; color: #555; border: 1px dashed #2a2a30; border-radius: 4px; }
  .gallery { margin: .9rem 0 .3rem; display: grid; grid-template-columns: 1fr 1fr; gap: .9rem; }
  .gallery figcaption { color: #c9a7e8; text-transform: none; letter-spacing: 0; font-size: .78rem; }
  .popups { margin: .6rem 0 .2rem; display: grid; gap: .6rem; }
  .popups figure img { width: 100%; display: block; border: 1px solid #3a2a16; border-radius: 4px; background: #fff; }
  .popups figcaption { color: #d8a24a; font-size: .72rem; margin-top: .3rem; }
  .wait { color: #666; font-size: .72rem; margin: .2rem 0 0; }
  footer { color: #555; font-size: .72rem; text-align: center; padding: 2rem; }
</style>
</head>
<body>
<header>
  <h1>${esc(pageTitle)}</h1>
  <p class="sub">${manifest.steps.length} steps · stage ${manifest.canvasSize?.width}×${manifest.canvasSize?.height} · auto-generated from a Ruffle playthrough</p>
</header>
<main>
${sections.join("\n")}
</main>
<footer>Generated by ruffle-walkthrough · ${esc(manifest.generatedFrom)}</footer>
</body>
</html>`;

  const outPath = join(outDir, htmlName);
  writeFileSync(outPath, html);
  return outPath;
}
