import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { parsePngDiffArgs, runPngDiff, runPngDiffCli } from "./png-diff.ts";
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

/**
 * A flat frame with one rectangle painted a different colour — the shape of a
 * game frame whose only variance is a particle burst or a timer readout
 * (vlmkit#118). 160px short side puts `adaptiveRegionCellSize` on the 8px grid,
 * and every rect used below is 8px-aligned so the detected region bbox is
 * exactly the painted rect and the assertions are on real numbers, not on
 * whatever the grid rounded to.
 */
function createFramePng(
  width: number,
  height: number,
  background: [number, number, number],
  rect?: { x: number; y: number; w: number; h: number; color: [number, number, number] },
): { width: number; height: number; data: Uint8Array } {
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = background[0];
    data[i * 4 + 1] = background[1];
    data[i * 4 + 2] = background[2];
    data[i * 4 + 3] = 255;
  }
  if (rect) {
    for (let y = rect.y; y < rect.y + rect.h; y++) {
      for (let x = rect.x; x < rect.x + rect.w; x++) {
        const offset = (y * width + x) * 4;
        data[offset] = rect.color[0];
        data[offset + 1] = rect.color[1];
        data[offset + 2] = rect.color[2];
      }
    }
  }
  return { width, height, data };
}

const NOISY = { x: 96, y: 112, w: 32, h: 32 } as const;
const FRAME = 160;
const FRAME_PIXELS = FRAME * FRAME;
const NOISY_PIXELS = NOISY.w * NOISY.h;

/** Two 160x160 frames differing only inside NOISY. */
async function writeNoisyFramePair(dir: string): Promise<{ baselinePath: string; currentPath: string }> {
  const baselinePath = join(dir, "frame-baseline.png");
  const currentPath = join(dir, "frame-current.png");
  await encodePng(baselinePath, createFramePng(FRAME, FRAME, [30, 30, 30], { ...NOISY, color: [30, 30, 30] }));
  await encodePng(currentPath, createFramePng(FRAME, FRAME, [30, 30, 30], { ...NOISY, color: [220, 40, 40] }));
  return { baselinePath, currentPath };
}

describe("png-diff --ignore-region", () => {
  it("parses repeated --ignore-region into rects", () => {
    const options = parsePngDiffArgs([
      "a.png", "b.png",
      "--ignore-region", "0,300,640x60",
      "--ignore-region", " 12 , 4 , 8x8 ",
    ]);
    assert.deepEqual(options.ignoreRegions, [
      { x: 0, y: 300, width: 640, height: 60 },
      { x: 12, y: 4, width: 8, height: 8 },
    ]);
  });

  it("rejects malformed --ignore-region values with exit code 2", () => {
    for (const bad of ["0,300,640", "0,300,640x0", "abc", "0,300x640,60", ""]) {
      assert.throws(
        () => parsePngDiffArgs(["a.png", "b.png", "--ignore-region", bad]),
        (error: Error & { exitCode?: number }) => {
          assert.equal(error.exitCode, 2, `"${bad}" should be a usage error, not a silent no-mask`);
          assert.match(error.message, /--ignore-region/);
          return true;
        },
        `"${bad}" should be rejected`,
      );
    }
  });

  it("reports the diff without a mask, and drops it when the noisy rect is ignored", async () => {
    await rm(TMP, { recursive: true, force: true });
    await mkdir(TMP, { recursive: true });
    try {
      const { baselinePath, currentPath } = await writeNoisyFramePair(TMP);
      const base = { baselinePath, currentPath, outputDir: TMP, threshold: 0.1, skipHeatmap: true, json: false };

      const unmasked = await runPngDiff(base);
      assert.equal(unmasked.diff.diffPixels, NOISY_PIXELS);
      assert.equal(unmasked.diff.totalPixels, FRAME_PIXELS);
      assert.equal(unmasked.diff.mask, undefined, "no mask key without --ignore-region");
      assert.equal(unmasked.diff.regions.length, 1);
      assert.deepEqual(
        { x: unmasked.diff.regions[0]!.x, y: unmasked.diff.regions[0]!.y },
        { x: NOISY.x, y: NOISY.y },
      );

      const masked = await runPngDiff({
        ...base,
        ignoreRegions: [{ x: NOISY.x, y: NOISY.y, width: NOISY.w, height: NOISY.h }],
      });
      // Both halves: no diff pixels left, and no region either. A region with
      // diffPixelCount 0 would still be attributed to an element downstream.
      assert.equal(masked.diff.diffPixels, 0);
      assert.equal(masked.diff.regions.length, 0);
      assert.equal(masked.diff.diffRatio, 0);
      // Denominator excludes the ignored area: imagePixels - ignoredPixels.
      assert.equal(masked.diff.totalPixels, FRAME_PIXELS - NOISY_PIXELS);
      assert.equal(masked.diff.mask!.ignoredPixels, NOISY_PIXELS);
      assert.equal(masked.diff.mask!.ignoredDiffPixels, NOISY_PIXELS);
      assert.equal(masked.diff.mask!.imagePixels, FRAME_PIXELS);
      assert.deepEqual(masked.diff.mask!.regions, [
        { x: NOISY.x, y: NOISY.y, width: NOISY.w, height: NOISY.h, pixels: NOISY_PIXELS, diffPixels: NOISY_PIXELS },
      ]);
    } finally {
      await rm(TMP, { recursive: true, force: true });
    }
  });

  it("leaves the diff alone when an unrelated rect is ignored, and does not dilute the ratio", async () => {
    await rm(TMP, { recursive: true, force: true });
    await mkdir(TMP, { recursive: true });
    try {
      const { baselinePath, currentPath } = await writeNoisyFramePair(TMP);
      const result = await runPngDiff({
        baselinePath, currentPath, outputDir: TMP, threshold: 0.1, skipHeatmap: true, json: false,
        ignoreRegions: [{ x: 0, y: 0, width: 32, height: 32 }],
      });

      assert.equal(result.diff.diffPixels, NOISY_PIXELS, "a mask elsewhere must not hide this change");
      assert.equal(result.diff.regions.length, 1);
      assert.equal(result.diff.mask!.ignoredDiffPixels, 0, "the mask swallowed nothing — say so");
      assert.equal(result.diff.mask!.regions[0]!.diffPixels, 0);
      // The point of shrinking the denominator: masking a quiet corner must not
      // make an unrelated regression read as *less* severe than it did before.
      assert.ok(
        result.diff.diffRatio > NOISY_PIXELS / FRAME_PIXELS,
        `ratio ${result.diff.diffRatio} should exceed the full-frame ratio ${NOISY_PIXELS / FRAME_PIXELS}`,
      );
      assert.equal(result.diff.totalPixels, FRAME_PIXELS - 32 * 32);
    } finally {
      await rm(TMP, { recursive: true, force: true });
    }
  });

  it("counts overlapping rects once and reports an off-frame rect as masking nothing", async () => {
    await rm(TMP, { recursive: true, force: true });
    await mkdir(TMP, { recursive: true });
    try {
      const { baselinePath, currentPath } = await writeNoisyFramePair(TMP);
      const result = await runPngDiff({
        baselinePath, currentPath, outputDir: TMP, threshold: 0.1, skipHeatmap: true, json: false,
        ignoreRegions: [
          { x: NOISY.x, y: NOISY.y, width: NOISY.w, height: NOISY.h },
          { x: NOISY.x + 16, y: NOISY.y, width: NOISY.w, height: NOISY.h }, // half overlaps the first
          { x: 1000, y: 1000, width: 50, height: 50 }, // entirely off-frame
        ],
      });

      const mask = result.diff.mask!;
      // Union: all 1024 of the first rect plus the 512 px of the second that lie
      // outside it. Per-rect diff counts sum to 1536 — the deduplicated total is
      // 1024, which is what keeps imagePixels - ignoredPixels === totalPixels.
      assert.equal(mask.ignoredPixels, NOISY_PIXELS + 16 * 32);
      assert.equal(mask.ignoredDiffPixels, NOISY_PIXELS);
      assert.equal(mask.regions[0]!.diffPixels + mask.regions[1]!.diffPixels, NOISY_PIXELS + 16 * 32);
      assert.equal(result.diff.totalPixels, mask.imagePixels - mask.ignoredPixels);
      assert.deepEqual(
        { pixels: mask.regions[2]!.pixels, diffPixels: mask.regions[2]!.diffPixels },
        { pixels: 0, diffPixels: 0 },
        "an off-frame rect masks nothing and must report so rather than look applied",
      );
    } finally {
      await rm(TMP, { recursive: true, force: true });
    }
  });

  it("prints the masked-pixel accounting next to the verdict, not only in --json", async () => {
    await rm(TMP, { recursive: true, force: true });
    await mkdir(TMP, { recursive: true });
    const lines: string[] = [];
    const original = console.log;
    console.log = (...args: unknown[]) => { lines.push(args.map(String).join(" ")); };
    try {
      const { baselinePath, currentPath } = await writeNoisyFramePair(TMP);
      await runPngDiffCli([
        baselinePath, currentPath, "--no-heatmap",
        "--ignore-region", `${NOISY.x},${NOISY.y},${NOISY.w}x${NOISY.h}`,
      ]);
      const text = lines.join("\n");
      assert.match(text, /diff:\s+0\.00% \(0 \/ 24576 px measured\)/);
      assert.match(text, /ignored:\s+1 region\(s\), 1024 px \(4\.0% of the 25600 px compared area\) — never measured/);
      assert.match(text, /\(96,112\) 32x32 — 1024 px, 1024 of them differed/);
      assert.match(text, /1024 diff px discarded; denominator 25600 - 1024 = 24576/);
    } finally {
      console.log = original;
      await rm(TMP, { recursive: true, force: true });
    }
  });
});

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
