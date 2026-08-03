/**
 * Triptych composer: stitches the three PNGs that `vlmkit diff html` already
 * emits into a single `baseline | variant | heatmap` image with labeled
 * header bands. Cuts "read each PNG in turn" iteration cost in agent
 * loops (see 2026-05-15 design-md scenario report § F3).
 *
 * Composition is done via a transient Playwright page so we avoid
 * pulling in a text-rendering library — the three source PNGs are
 * loaded as `<img>` tags and the resulting page is screenshotted.
 */

import { access, readFile, writeFile, unlink } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import type { Browser } from "playwright";
import { PNG } from "pngjs";

async function readPngDimensions(path: string): Promise<{ width: number; height: number }> {
  const buf = await readFile(path);
  const png = PNG.sync.read(buf);
  return { width: png.width, height: png.height };
}

export interface ComposeTriptychOptions {
  baselinePath: string;
  variantPath: string;
  /** May be undefined when the viewport had zero diff. */
  heatmapPath?: string;
  outputPath: string;
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Compose a 3-panel triptych. Returns the output path on success, or
 * `undefined` when the heatmap is missing (zero-diff viewport — a
 * triptych would offer no extra information over the variant alone).
 */
export async function composeTriptych(
  browser: Browser,
  opts: ComposeTriptychOptions,
): Promise<string | undefined> {
  if (!opts.heatmapPath || !(await exists(opts.heatmapPath))) return undefined;
  if (!(await exists(opts.baselinePath)) || !(await exists(opts.variantPath))) return undefined;

  // Read source PNG dimensions so we can size the viewport to the
  // actual composed width up front. Setting a tiny viewport first and
  // resizing after `setContent` failed to relayout reliably (a previous
  // attempt produced 74×45 px screenshots).
  const [bDim, vDim, hDim] = await Promise.all([
    readPngDimensions(opts.baselinePath),
    readPngDimensions(opts.variantPath),
    readPngDimensions(opts.heatmapPath),
  ]);
  const BORDER = 2;
  const HEADER = 28; // .label height (12px font + 6px*2 padding + 1px line-height slack)
  const totalWidth = bDim.width + vDim.width + hDim.width + BORDER * 2;
  const maxImgHeight = Math.max(bDim.height, vDim.height, hDim.height);
  const totalHeight = maxImgHeight + HEADER;

  const html = `<!doctype html>
<html><head><style>
  *,*::before,*::after { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #0b0e14; }
  .row { display: flex; align-items: stretch; gap: 0; }
  .col { display: flex; flex-direction: column; min-width: 0; }
  .label {
    font: 700 12px/1.4 ui-monospace, "SF Mono", Menlo, Consolas, monospace;
    color: #fff;
    padding: 6px 10px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .label.baseline { background: #10b981; }
  .label.variant  { background: #3b82f6; }
  .label.heatmap  { background: #ef4444; }
  .col + .col { border-left: 2px solid #0b0e14; }
  img { display: block; max-width: none; }
</style></head>
<body>
  <div class="row">
    <div class="col"><div class="label baseline">BASELINE</div><img src="${pathToFileURL(opts.baselinePath).href}" /></div>
    <div class="col"><div class="label variant">VARIANT</div><img src="${pathToFileURL(opts.variantPath).href}" /></div>
    <div class="col"><div class="label heatmap">HEATMAP</div><img src="${pathToFileURL(opts.heatmapPath).href}" /></div>
  </div>
</body></html>`;

  // Write the composer HTML to a temp file alongside the output PNG so
  // that file:// `<img>` sources resolve. `page.setContent()` would render
  // the document with an about:blank base URL, which blocks file://
  // images via same-origin policy (same root cause as the false-PASS
  // bug fixed in #22).
  const composerPath = `${opts.outputPath}.compose.html`;
  await writeFile(composerPath, html);

  const page = await browser.newPage({
    viewport: { width: totalWidth, height: totalHeight },
  });
  try {
    await page.goto(pathToFileURL(composerPath).href, { waitUntil: "networkidle" });
    await page.screenshot({ path: opts.outputPath, fullPage: true });
    return opts.outputPath;
  } finally {
    await page.close();
    await unlink(composerPath).catch(() => {});
  }
}
