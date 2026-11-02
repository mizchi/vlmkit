/**
 * Whether two renders of one box differ only in edge rendering. Pure: RGBA arrays in, an answer
 * out. Shared by the pixel diff's region labels (`diff png`) and the storyboard's events.
 */
/**
 * A region's pixels compared for what kind of difference they are: the largest per-channel
 * delta, and whether it is only glyph-edge rendering. Two captures of one page whose
 * animated text was composited on a layer differ on every glyph edge (up to 111 levels) and
 * read `4 element-added, 1 icon-change` (motion-repair round 5). Such a difference has two
 * signatures together: a 5x5 average removes most of it (its largest blurred delta is under
 * 0.4 of the raw one; a recoloured block keeps ~0.95, a changed digit ~0.8), and it lightens
 * as much as it darkens (|signed sum| / |sum| under 0.5; a 1px border recoloured blurs as
 * much but is all one sign, -1.00).
 */
export function edgeOnlyDelta(
  baseline: { width: number; height: number; data: Uint8Array },
  current: { width: number; height: number; data: Uint8Array },
  region: { x: number; y: number; width: number; height: number },
): { max: number; edgeOnly: boolean } {
  const x0 = Math.max(0, region.x);
  const y0 = Math.max(0, region.y);
  const x1 = Math.min(region.x + region.width, baseline.width, current.width);
  const y1 = Math.min(region.y + region.height, baseline.height, current.height);
  const w = x1 - x0;
  const h = y1 - y0;
  if (w <= 0 || h <= 0) return { max: 0, edgeOnly: false };
  let max = 0;
  let signed = 0;
  let abs = 0;
  // Luminance difference per pixel, then a summed-area table for the 5x5 average.
  const d = new Float64Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = ((y + y0) * baseline.width + x + x0) * 4;
      const j = ((y + y0) * current.width + x + x0) * 4;
      let lb = 0;
      let lc = 0;
      for (let k = 0; k < 3; k++) {
        const a = baseline.data[i + k]!;
        const b = current.data[j + k]!;
        const dd = Math.abs(a - b);
        if (dd > max) max = dd;
        lb += a;
        lc += b;
      }
      const v = (lc - lb) / 3;
      d[y * w + x] = v;
      signed += v;
      abs += Math.abs(v);
    }
  }
  if (abs === 0) return { max, edgeOnly: false };
  const sat = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += d[y * w + x]!;
      sat[(y + 1) * (w + 1) + x + 1] = sat[y * (w + 1) + x + 1]! + row;
    }
  }
  let rawMax = 0;
  let blurMax = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      rawMax = Math.max(rawMax, Math.abs(d[y * w + x]!));
      const ax = Math.max(0, x - 2);
      const ay = Math.max(0, y - 2);
      const bx = Math.min(w, x + 3);
      const by = Math.min(h, y + 3);
      const sum = sat[by * (w + 1) + bx]! - sat[ay * (w + 1) + bx]! - sat[by * (w + 1) + ax]! + sat[ay * (w + 1) + ax]!;
      blurMax = Math.max(blurMax, Math.abs(sum / ((bx - ax) * (by - ay))));
    }
  }
  const edgeOnly = rawMax > 0 && blurMax / rawMax < 0.4 && Math.abs(signed) / abs < 0.5;
  return { max, edgeOnly };
}
