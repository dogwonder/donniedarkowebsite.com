// Screenshot helpers. We always clip to the canvas region (optionally a
// canvas-local sub-region) so diffs ignore page chrome around the Flash stage.

import { canvasBox } from "./canvas.js";

/**
 * Screenshot the canvas (or a canvas-local sub-region) and return a PNG Buffer.
 *
 * @param {import('playwright').Page} page
 * @param {import('playwright').Locator} canvas
 * @param {object} ruffleCfg
 * @param {{x:number,y:number,width:number,height:number}} [region]  canvas-local
 */
export async function captureCanvas(page, canvas, ruffleCfg, region) {
  const box = await canvasBox(canvas);
  const { canvasSize } = ruffleCfg;
  const scaleX = box.width / canvasSize.width;
  const scaleY = box.height / canvasSize.height;

  const clip = region
    ? {
        x: box.x + region.x * scaleX,
        y: box.y + region.y * scaleY,
        width: region.width * scaleX,
        height: region.height * scaleY,
      }
    : { x: box.x, y: box.y, width: box.width, height: box.height };

  // Round to whole pixels so consecutive captures share identical dimensions.
  clip.x = Math.round(clip.x);
  clip.y = Math.round(clip.y);
  clip.width = Math.round(clip.width);
  clip.height = Math.round(clip.height);

  return await page.screenshot({ clip });
}
