import { test } from "vitest";
import assert from "node:assert/strict";
import { PNG } from "pngjs";
import { analyzeAssetPng, parseHexColor } from "./asset-check.ts";

/** Build a PNG and paint it with a per-pixel callback returning [r,g,b,a]. */
function makePng(
  width: number,
  height: number,
  paint: (x: number, y: number) => [number, number, number, number],
): PNG {
  const png = new PNG({ width, height });
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const [r, g, b, a] = paint(x, y);
      png.data[i] = r; png.data[i + 1] = g; png.data[i + 2] = b; png.data[i + 3] = a;
    }
  }
  return png;
}

/** A centered orange disc on a transparent canvas (a well-formed sprite). */
const disc = (w: number, h: number, color: [number, number, number] = [230, 120, 40]) =>
  makePng(w, h, (x, y) => {
    const dx = x - w / 2, dy = y - h / 2;
    const r = Math.min(w, h) * 0.35;
    return dx * dx + dy * dy <= r * r ? [...color, 255] : [0, 0, 0, 0];
  });

test("well-formed transparent sprite passes with no issues", () => {
  const report = analyzeAssetPng(disc(200, 200), {
    source: "sprite.png",
    slot: { w: 100, h: 100 },
    expectTransparent: true,
    againstBg: "#1a1033",
  });
  assert.equal(report.backgroundKind, "transparent");
  assert.ok(report.occupancy > 0.3 && report.occupancy < 0.5);
  assert.ok(report.contentBox && report.contentBox.w > 100);
  assert.ok(report.edgeContrast! > 1.5, `edge contrast ${report.edgeContrast}`);
  assert.deepEqual(report.issues, []);
});

test("matted background is reported with its color and flagged under --expect-transparent", () => {
  const matted = makePng(120, 120, (x, y) => {
    const dx = x - 60, dy = y - 60;
    return dx * dx + dy * dy <= 30 * 30 ? [230, 120, 40, 255] : [255, 255, 255, 255];
  });
  const report = analyzeAssetPng(matted, { source: "matted.png", expectTransparent: true });
  assert.equal(report.backgroundKind, "matte");
  assert.equal(report.matteColor, "#ffffff");
  assert.equal(report.issues.filter((i) => i.kind === "opaque-background" && i.severity === "suspect").length, 1);
  // Without the expectation it is informational only.
  const informational = analyzeAssetPng(matted, { source: "matted.png" });
  assert.deepEqual(informational.issues, []);
});

test("near-empty canvas is a suspect (generation failure shape)", () => {
  const empty = makePng(100, 100, (x, y) => (x < 3 && y < 3 ? [255, 0, 0, 255] : [0, 0, 0, 0]));
  const report = analyzeAssetPng(empty, { source: "empty.png" });
  assert.equal(report.issues.filter((i) => i.kind === "near-empty").length, 1);
});

test("aspect mismatch and upscale fire against the slot", () => {
  const wide = disc(200, 100);
  const report = analyzeAssetPng(wide, { source: "wide.png", slot: { w: 100, h: 100 } });
  assert.equal(report.issues.filter((i) => i.kind === "aspect-mismatch" && i.severity === "suspect").length, 1);

  const tiny = disc(40, 40);
  const up = analyzeAssetPng(tiny, { source: "tiny.png", slot: { w: 200, h: 200 } });
  assert.equal(up.issues.filter((i) => i.kind === "upscale" && i.severity === "warn").length, 1);
});

test("silhouette melting into the backdrop is flagged; distinct silhouette is not", () => {
  const darkOnDark = analyzeAssetPng(disc(120, 120, [30, 22, 60]), {
    source: "dark.png",
    againstBg: "#1a1033",
  });
  assert.equal(darkOnDark.issues.filter((i) => i.kind === "low-figure-ground-contrast").length, 1);

  const litOnDark = analyzeAssetPng(disc(120, 120, [240, 200, 120]), {
    source: "lit.png",
    againstBg: "#1a1033",
  });
  assert.equal(litOnDark.issues.filter((i) => i.kind === "low-figure-ground-contrast").length, 0);
});

test("palette harmony compares asset dominants against the page palette", () => {
  const pagePalette = [
    { hex: "#1a1033", r: 26, g: 16, b: 51, share: 0.6, count: 600 },
    { hex: "#e67828", r: 230, g: 120, b: 40, share: 0.4, count: 400 },
  ];
  const matching = analyzeAssetPng(disc(120, 120, [230, 120, 40]), {
    source: "match.png", pagePalette,
  });
  assert.equal(matching.paletteHarmony, 1);
  assert.equal(matching.issues.filter((i) => i.kind === "palette-clash").length, 0);

  const clashing = analyzeAssetPng(disc(120, 120, [40, 230, 90]), {
    source: "clash.png", pagePalette,
  });
  assert.ok(clashing.paletteHarmony! < 0.25);
  assert.equal(clashing.issues.filter((i) => i.kind === "palette-clash" && i.severity === "warn").length, 1);
});

test("parseHexColor accepts #rrggbb and rejects junk", () => {
  assert.deepEqual(parseHexColor("#1a1033"), { r: 26, g: 16, b: 51 });
  assert.deepEqual(parseHexColor("FFffFF"), { r: 255, g: 255, b: 255 });
  assert.throws(() => parseHexColor("red"));
});
