import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PNG } from "pngjs";
import {
  enrichRegionColorsWithBboxSamples,
  parseVlmResponse,
} from "./vlm-region-diff.ts";

describe("parseVlmResponse", () => {
  it("parses a strict JSON response with regions", () => {
    const raw = JSON.stringify({
      verdict: "diff",
      regions: [
        { region: "background", baselineColor: "#050505", variantColor: "#070707", description: "darker on baseline" },
      ],
      summary: "One color shift detected",
    });
    const result = parseVlmResponse(raw);
    assert.equal(result.verdict, "diff");
    assert.equal(result.regions.length, 1);
    assert.equal(result.regions[0]?.baselineColor, "#050505");
    assert.equal(result.regions[0]?.bbox, null);
    assert.equal(result.summary, "One color shift detected");
  });

  it("parses bbox coordinates when the VLM provides them", () => {
    const raw = JSON.stringify({
      verdict: "diff",
      regions: [
        {
          region: "primary accent",
          bbox: { left: 10, top: 20, width: 30, height: 40 },
          baselineColor: "#ff0000",
          variantColor: "#ee0000",
          description: "accent is darker",
        },
      ],
      summary: "One sampled region",
    });
    const result = parseVlmResponse(raw);
    assert.deepEqual(result.regions[0]?.bbox, { left: 10, top: 20, width: 30, height: 40 });
  });

  it("strips markdown fences around the JSON block", () => {
    const raw = "Sure! Here's the analysis:\n\n```json\n" +
      JSON.stringify({ verdict: "no-diff", regions: [], summary: "looks the same" }) +
      "\n```\n";
    const result = parseVlmResponse(raw);
    assert.equal(result.verdict, "no-diff");
  });

  it("falls back to uncertain when the JSON is malformed", () => {
    const result = parseVlmResponse("not json at all");
    assert.equal(result.verdict, "uncertain");
  });

  it("normalizes unrecognized verdicts to 'uncertain'", () => {
    const raw = JSON.stringify({ verdict: "weird", regions: [], summary: "x" });
    const result = parseVlmResponse(raw);
    assert.equal(result.verdict, "uncertain");
  });

  it("drops malformed region entries", () => {
    const raw = JSON.stringify({
      verdict: "diff",
      regions: [
        { region: "ok", baselineColor: "#aaa", variantColor: "#bbb", description: "good" },
        "not-an-object",
        { region: 42 },
      ],
      summary: "",
    });
    const result = parseVlmResponse(raw);
    assert.equal(result.regions.length, 2, "string entry dropped, missing-fields entry produces a partial");
    assert.equal(result.regions[0]?.region, "ok");
    assert.equal(result.regions[1]?.region, "(unnamed)");
    assert.equal(result.regions[1]?.bbox, null);
  });
});

describe("enrichRegionColorsWithBboxSamples", () => {
  it("overwrites VLM color literals with client-side bbox average samples", () => {
    const baseline = solidPng(4, 4, 255, 0, 0);
    const variant = solidPng(4, 4, 0, 0, 255);

    const result = enrichRegionColorsWithBboxSamples(
      {
        verdict: "diff",
        regions: [
          {
            region: "panel",
            bbox: { left: 1, top: 1, width: 2, height: 2 },
            baselineColor: "#000000",
            variantColor: "#000000",
            description: "VLM guessed the colors",
          },
        ],
        summary: "diff",
      },
      baseline,
      variant,
    );

    assert.equal(result.regions[0]?.baselineColor, "#ff0000");
    assert.equal(result.regions[0]?.variantColor, "#0000ff");
    assert.deepEqual(result.regions[0]?.colorSample, {
      source: "bbox-average",
      pixelCount: 4,
      totalPixelCount: 4,
      changedPixelCount: 4,
      averageChannelDelta: 170,
    });
  });

  it("samples only changed pixels inside a broad bbox before falling back to the full bbox", () => {
    const baseline = solidPng(4, 4, 255, 0, 0);
    const variant = solidPng(4, 4, 255, 0, 0);
    paintRect(variant, 4, 1, 1, 2, 2, 0, 0, 255);

    const result = enrichRegionColorsWithBboxSamples(
      {
        verdict: "diff",
        regions: [
          {
            region: "small changed patch",
            bbox: { left: 0, top: 0, width: 4, height: 4 },
            baselineColor: null,
            variantColor: null,
            description: "bbox includes unchanged surroundings",
          },
        ],
        summary: "diff",
      },
      baseline,
      variant,
    );

    assert.equal(result.regions[0]?.baselineColor, "#ff0000");
    assert.equal(result.regions[0]?.variantColor, "#0000ff");
    assert.deepEqual(result.regions[0]?.colorSample, {
      source: "bbox-average",
      pixelCount: 4,
      totalPixelCount: 16,
      changedPixelCount: 4,
      averageChannelDelta: 170,
    });
  });

  it("falls back to full-bbox sampling when the bbox has no changed pixels", () => {
    const baseline = solidPng(3, 3, 10, 20, 30);
    const variant = solidPng(3, 3, 10, 20, 30);

    const result = enrichRegionColorsWithBboxSamples(
      {
        verdict: "diff",
        regions: [
          {
            region: "same patch",
            bbox: { left: 0, top: 0, width: 3, height: 3 },
            baselineColor: null,
            variantColor: null,
            description: "no local pixel delta",
          },
        ],
        summary: "uncertain",
      },
      baseline,
      variant,
    );

    assert.equal(result.regions[0]?.baselineColor, "#0a141e");
    assert.equal(result.regions[0]?.variantColor, "#0a141e");
    assert.deepEqual(result.regions[0]?.colorSample, {
      source: "bbox-average",
      pixelCount: 9,
      totalPixelCount: 9,
      changedPixelCount: 0,
      averageChannelDelta: 0,
    });
  });

  it("leaves region colors unchanged when bbox is missing", () => {
    const baseline = solidPng(2, 2, 255, 0, 0);
    const variant = solidPng(2, 2, 0, 0, 255);
    const result = enrichRegionColorsWithBboxSamples(
      {
        verdict: "diff",
        regions: [
          {
            region: "panel",
            bbox: null,
            baselineColor: "#111111",
            variantColor: "#222222",
            description: "no bbox",
          },
        ],
        summary: "diff",
      },
      baseline,
      variant,
    );

    assert.equal(result.regions[0]?.baselineColor, "#111111");
    assert.equal(result.regions[0]?.variantColor, "#222222");
  });
});

function solidPng(width: number, height: number, r: number, g: number, b: number): PNG {
  const png = new PNG({ width, height });
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = r;
    png.data[i + 1] = g;
    png.data[i + 2] = b;
    png.data[i + 3] = 255;
  }
  return png;
}

function paintRect(
  png: PNG,
  imageWidth: number,
  left: number,
  top: number,
  width: number,
  height: number,
  r: number,
  g: number,
  b: number,
): void {
  for (let y = top; y < top + height; y++) {
    for (let x = left; x < left + width; x++) {
      const i = (y * imageWidth + x) * 4;
      png.data[i] = r;
      png.data[i + 1] = g;
      png.data[i + 2] = b;
      png.data[i + 3] = 255;
    }
  }
}
