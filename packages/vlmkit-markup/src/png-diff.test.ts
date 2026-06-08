import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { parsePngDiffArgs, runPngDiff } from "./png-diff.ts";
import { encodePng } from "@mizchi/vlmkit-core/png-utils.ts";

const TMP = join(import.meta.dirname!, "..", "..", "..", "test-results", "png-diff-test");

function createPalettePng(
  width: number,
  height: number,
  colors: Array<[number, number, number]>,
): { width: number; height: number; data: Uint8Array } {
  const data = new Uint8Array(width * height * 4);
  const cols = 3;
  const rows = Math.ceil(colors.length / cols);
  const cellWidth = Math.floor(width / cols);
  const cellHeight = Math.floor(height / rows);

  for (let i = 0; i < colors.length; i++) {
    const [r, g, b] = colors[i];
    const col = i % cols;
    const row = Math.floor(i / cols);
    const startX = col * cellWidth;
    const startY = row * cellHeight;
    const endX = col === cols - 1 ? width : startX + cellWidth;
    const endY = row === rows - 1 ? height : startY + cellHeight;

    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const offset = (y * width + x) * 4;
        data[offset] = r;
        data[offset + 1] = g;
        data[offset + 2] = b;
        data[offset + 3] = 255;
      }
    }
  }

  return { width, height, data };
}

describe("png-diff", () => {
  it("parses CLI flags for direct PNG comparison", () => {
    const options = parsePngDiffArgs([
      "before.png",
      "after.png",
      "--output-dir",
      "tmp/out",
      "--threshold",
      "0.2",
      "--json",
      "--no-heatmap",
    ]);

    assert.equal(options.baselinePath, "before.png");
    assert.equal(options.currentPath, "after.png");
    assert.equal(options.outputDir, "tmp/out");
    assert.equal(options.threshold, 0.2);
    assert.equal(options.json, true);
    assert.equal(options.skipHeatmap, true);
  });

  it("parses --crop-regions into an output directory", () => {
    const options = parsePngDiffArgs([
      "before.png",
      "after.png",
      "--crop-regions",
      "tmp/crops",
    ]);
    assert.equal(options.cropRegions, "tmp/crops");
  });

  it("writes a baseline/current/diff crop triple per region (draft 05)", async () => {
    const baselinePath = join(TMP, "baseline-crop.png");
    const currentPath = join(TMP, "current-crop.png");
    const cropDir = join(TMP, "crops");

    await rm(TMP, { recursive: true, force: true });
    await mkdir(TMP, { recursive: true });

    try {
      const colors: Array<[number, number, number]> = Array.from({ length: 9 }, () => [255, 255, 255]);
      const changed = [...colors];
      changed[8] = [10, 20, 200];
      await encodePng(baselinePath, createPalettePng(120, 120, colors));
      await encodePng(currentPath, createPalettePng(120, 120, changed));

      const result = await runPngDiff({
        baselinePath,
        currentPath,
        outputDir: TMP,
        threshold: 0.1,
        skipHeatmap: false,
        json: false,
        cropRegions: cropDir,
      });

      assert.ok(result.crops && result.crops.length > 0, "expected at least one region crop");
      const first = result.crops![0]!;
      assert.ok(existsSync(first.baseline), "baseline crop should exist");
      assert.ok(existsSync(first.current), "current crop should exist");
      assert.ok(existsSync(first.diff), "diff crop should exist");
      assert.deepEqual(first.bbox, {
        x: result.diff.regions[0]!.x,
        y: result.diff.regions[0]!.y,
        width: result.diff.regions[0]!.width,
        height: result.diff.regions[0]!.height,
      });
    } finally {
      await rm(TMP, { recursive: true, force: true });
    }
  });

  it("compares two PNG files without Playwright", async () => {
    const baselinePath = join(TMP, "baseline.png");
    const currentPath = join(TMP, "current.png");

    const baselineColors: Array<[number, number, number]> = [
      [40, 80, 140],
      [60, 120, 160],
      [80, 160, 120],
      [120, 160, 80],
      [140, 120, 60],
      [100, 100, 160],
      [60, 140, 120],
      [120, 120, 120],
      [80, 80, 80],
    ];
    const currentColors = [...baselineColors];
    currentColors[4] = [90, 150, 210];

    await rm(TMP, { recursive: true, force: true });
    await mkdir(TMP, { recursive: true });

    try {
      await encodePng(baselinePath, createPalettePng(120, 120, baselineColors));
      await encodePng(currentPath, createPalettePng(120, 120, currentColors));

      const result = await runPngDiff({
        baselinePath,
        currentPath,
        outputDir: TMP,
        threshold: 0.1,
        skipHeatmap: false,
        json: false,
      });

      assert.ok(result.diff.diffPixels > 0);
      assert.equal(result.diff.snapshot.baselinePath, baselinePath);
      assert.equal(result.diff.snapshot.screenshotPath, currentPath);
      assert.ok(result.semantic.summary.length > 0);
      assert.ok(result.diff.heatmapPath, "heatmap should be generated by default");
      assert.ok(existsSync(result.diff.heatmapPath!), "heatmap file should exist");
    } finally {
      await rm(TMP, { recursive: true, force: true });
    }
  });

  it("attaches deterministic selector candidates from an elements JSON", async () => {
    const baselinePath = join(TMP, "baseline-sel.png");
    const currentPath = join(TMP, "current-sel.png");
    const elementsPath = join(TMP, "elements.json");

    await rm(TMP, { recursive: true, force: true });
    await mkdir(TMP, { recursive: true });

    try {
      // Single-color page; bottom-right cell recolors.
      const colors: Array<[number, number, number]> = Array.from({ length: 9 }, () => [255, 255, 255]);
      const changed = [...colors];
      changed[8] = [180, 209, 250];
      await encodePng(baselinePath, createPalettePng(120, 120, colors));
      await encodePng(currentPath, createPalettePng(120, 120, changed));
      const { writeFile } = await import("node:fs/promises");
      await writeFile(elementsPath, JSON.stringify([
        { path: "div.portfolio-caption", tag: "div", classes: "portfolio-caption", left: 80, top: 80, width: 40, height: 40 },
        { path: "header.masthead", tag: "header", classes: "masthead", left: 0, top: 0, width: 120, height: 40 },
      ]));

      const result = await runPngDiff({
        baselinePath,
        currentPath,
        outputDir: TMP,
        threshold: 0.1,
        skipHeatmap: true,
        json: false,
        elementsJson: elementsPath,
      });

      const withSelector = result.diff.regions.filter((r) => r.selectorCandidate);
      assert.ok(withSelector.length > 0, "at least one region should get a selector candidate");
      assert.equal(withSelector[0]!.selectorCandidate!.selector, ".portfolio-caption");
    } finally {
      await rm(TMP, { recursive: true, force: true });
    }
  });

  it("reports baseline/current dimensions and their delta", async () => {
    const baselinePath = join(TMP, "baseline-size.png");
    const currentPath = join(TMP, "current-size.png");

    await rm(TMP, { recursive: true, force: true });
    await mkdir(TMP, { recursive: true });

    try {
      await encodePng(baselinePath, createPalettePng(64, 96, [[17, 34, 51]]));
      await encodePng(currentPath, createPalettePng(64, 64, [[17, 34, 51]]));

      const result = await runPngDiff({
        baselinePath,
        currentPath,
        outputDir: TMP,
        threshold: 0.1,
        skipHeatmap: true,
        json: false,
      });

      assert.deepEqual(result.baselineSize, { width: 64, height: 96 });
      assert.deepEqual(result.currentSize, { width: 64, height: 64 });
      assert.deepEqual(result.sizeDelta, { width: 0, height: -32 });
    } finally {
      await rm(TMP, { recursive: true, force: true });
    }
  });

  it("samples baseline/current colors for diff regions", async () => {
    const baselinePath = join(TMP, "baseline-color.png");
    const currentPath = join(TMP, "current-color.png");

    await rm(TMP, { recursive: true, force: true });
    await mkdir(TMP, { recursive: true });

    try {
      await encodePng(baselinePath, createPalettePng(64, 64, [[17, 34, 51]]));
      await encodePng(currentPath, createPalettePng(64, 64, [[68, 85, 102]]));

      const result = await runPngDiff({
        baselinePath,
        currentPath,
        outputDir: TMP,
        threshold: 0.1,
        skipHeatmap: true,
        json: false,
      });
      const sample = result.diff.regions[0]?.colorSample;
      assert.equal(sample?.baseline.hex, "#112233");
      assert.equal(sample?.current.hex, "#445566");
    } finally {
      await rm(TMP, { recursive: true, force: true });
    }
  });
});
