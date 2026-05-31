// Canvas-local coordinate grid overlay, used by the calibration helper and by
// the runner's --grid mode. Draws an SVG aligned to the live canvas box so the
// labels read in authored stage units (0..W x 0..H), then can be cleared again.

import { makeCoordMapper } from "./canvas.js";

export async function drawGrid(page, canvas, ruffleCfg, spacing = 50) {
  const map = await makeCoordMapper(canvas, ruffleCfg);
  const { width: W, height: H } = ruffleCfg.canvasSize;
  const lines = [];
  const labels = [];
  for (let x = 0; x <= W; x += spacing) {
    const a = map(x, 0), b = map(x, H);
    lines.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, major: x % (spacing * 2) === 0 });
    labels.push({ x: a.x + 2, y: a.y + 11, text: String(x) });
  }
  for (let y = 0; y <= H; y += spacing) {
    const a = map(0, y), b = map(W, y);
    lines.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, major: y % (spacing * 2) === 0 });
    labels.push({ x: a.x + 2, y: a.y + 11, text: String(y) });
  }
  await page.evaluate(({ lines, labels }) => {
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.id = "__calib_grid";
    Object.assign(svg.style, { position: "fixed", left: "0", top: "0", width: "100vw", height: "100vh", zIndex: "2147483647", pointerEvents: "none" });
    svg.setAttribute("viewBox", `0 0 ${window.innerWidth} ${window.innerHeight}`);
    for (const l of lines) {
      const ln = document.createElementNS(ns, "line");
      ln.setAttribute("x1", l.x1); ln.setAttribute("y1", l.y1);
      ln.setAttribute("x2", l.x2); ln.setAttribute("y2", l.y2);
      ln.setAttribute("stroke", l.major ? "rgba(255,80,80,0.9)" : "rgba(120,200,255,0.55)");
      ln.setAttribute("stroke-width", l.major ? "1.2" : "0.6");
      svg.appendChild(ln);
    }
    for (const t of labels) {
      const tx = document.createElementNS(ns, "text");
      tx.setAttribute("x", t.x); tx.setAttribute("y", t.y);
      tx.setAttribute("fill", "#ffef5a"); tx.setAttribute("font-size", "10");
      tx.setAttribute("font-family", "monospace");
      tx.textContent = t.text;
      svg.appendChild(tx);
    }
    document.body.appendChild(svg);
  }, { lines, labels });
}

export async function clearGrid(page) {
  await page.evaluate(() => document.getElementById("__calib_grid")?.remove());
}
