import { deepStrictEqual, ok, strictEqual } from "node:assert";
import { describe, it } from "node:test";
import { PNG } from "pngjs";
import {
  buildContactSheets,
  canonicalizeForCompare,
  compareTranscript,
  cropRegion,
  type TextBlock,
} from "./copy-target.ts";

function solidPng(width: number, height: number, rgb: [number, number, number]): PNG {
  const png = new PNG({ width, height });
  for (let i = 0; i < width * height; i++) {
    png.data[i * 4] = rgb[0];
    png.data[i * 4 + 1] = rgb[1];
    png.data[i * 4 + 2] = rgb[2];
    png.data[i * 4 + 3] = 0xff;
  }
  return png;
}

function pixelAt(png: PNG, x: number, y: number): [number, number, number] {
  const o = (y * png.width + x) * 4;
  return [png.data[o]!, png.data[o + 1]!, png.data[o + 2]!];
}

describe("compareTranscript", () => {
  it("matches identical text", () => {
    ok(compareTranscript("© 2026 Atlas Guides", "© 2026 Atlas Guides").match);
  });

  it("catches the S9 year bug", () => {
    const cmp = compareTranscript("© 2025 Atlas Guides", "© 2026 Atlas Guides");
    strictEqual(cmp.match, false);
  });

  it("catches missing separator glyphs", () => {
    const cmp = compareTranscript("Instagram RSS Contact", "Instagram · RSS · Contact");
    strictEqual(cmp.match, false);
  });

  it("catches proper-noun typos", () => {
    strictEqual(compareTranscript("Imili and Setfi", "Imlil and Setti").match, false);
  });

  it("tolerates typographic variants VLMs normalize", () => {
    ok(compareTranscript("“The harbor” — at closing… time", '"The harbor" - at closing... time').match);
  });

  it("tolerates whitespace and NBSP differences", () => {
    ok(compareTranscript("Issue 14 —  Summer", "Issue 14 - Summer").match);
  });

  it("stays case-sensitive (casing is spec)", () => {
    strictEqual(compareTranscript("MERIDIAN", "Meridian").match, false);
  });
});

describe("canonicalizeForCompare", () => {
  it("unifies the dash family", () => {
    strictEqual(canonicalizeForCompare("a–b—c−d"), "a-b-c-d");
  });
});

describe("cropRegion", () => {
  it("crops the padded bbox with extra right-edge room for omitted trailing words", () => {
    const src = solidPng(200, 50, [10, 20, 30]);
    const crop = cropRegion(src, { x: 20, y: 10, width: 30, height: 12 }, 6);
    // left pad 6, right pad max(6, 32, 30*0.25) = 32
    strictEqual(crop.width, 6 + 30 + 32);
    strictEqual(crop.height, 24);
    deepStrictEqual(pixelAt(crop, 0, 0), [10, 20, 30]);
  });

  it("clamps at image edges", () => {
    const src = solidPng(100, 50, [10, 20, 30]);
    const crop = cropRegion(src, { x: 0, y: 0, width: 10, height: 10 }, 6);
    strictEqual(crop.width, 6 + 10 + 32 - 6); // left clamped to 0, right pad 32 fits
    strictEqual(crop.height, 16);
    const right = cropRegion(src, { x: 95, y: 45, width: 10, height: 10 }, 6);
    strictEqual(right.width, 11); // right clamped to image edge
    strictEqual(right.height, 11);
  });
});

describe("buildContactSheets", () => {
  const target = new PNG({ width: 60, height: 100 });
  // two distinguishable bands: red rows 0-19, blue rows 50-69
  for (let y = 0; y < 100; y++) {
    for (let x = 0; x < 60; x++) {
      const o = (y * 60 + x) * 4;
      const rgb: [number, number, number] = y < 20 ? [200, 0, 0] : y >= 50 && y < 70 ? [0, 0, 200] : [255, 255, 255];
      target.data[o] = rgb[0];
      target.data[o + 1] = rgb[1];
      target.data[o + 2] = rgb[2];
      target.data[o + 3] = 0xff;
    }
  }
  const blocks: TextBlock[] = [
    { text: "red line", x: 10, y: 5, width: 40, height: 10 },
    { text: "blue line", x: 10, y: 55, width: 40, height: 10 },
  ];

  it("stacks crops in block order with a gray separator", () => {
    const sheets = buildContactSheets(target, blocks, { pad: 2, maxRows: 12 });
    strictEqual(sheets.length, 1);
    const sheet = sheets[0]!;
    deepStrictEqual(sheet.rows, [0, 1]);
    // crop 1: rows 3..17 of target (y=5 pad 2, height 10+4=14), all red
    deepStrictEqual(pixelAt(sheet.png, 5, 5), [200, 0, 0]);
    // separator band after crop 1 (height 14) is gray
    deepStrictEqual(pixelAt(sheet.png, 5, 14 + 3), [0x80, 0x80, 0x80]);
    // crop 2 after 14px crop + 8px separator, all blue
    deepStrictEqual(pixelAt(sheet.png, 5, 14 + 8 + 5), [0, 0, 200]);
    strictEqual(sheet.png.height, 14 + 8 + 14);
  });

  it("splits into multiple sheets at maxRows", () => {
    const many: TextBlock[] = Array.from({ length: 5 }, (_, i) => ({
      text: `row ${i}`,
      x: 10,
      y: 5 + i * 12,
      width: 40,
      height: 8,
    }));
    const sheets = buildContactSheets(target, many, { pad: 1, maxRows: 2 });
    strictEqual(sheets.length, 3);
    deepStrictEqual(sheets[2]!.rows, [4]);
  });
});
