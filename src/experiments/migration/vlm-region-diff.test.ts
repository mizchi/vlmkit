import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PNG } from "pngjs";
import {
  buildStructuredRegionChanges,
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

describe("buildStructuredRegionChanges", () => {
  it("maps sampled VLM regions into downstream CHANGE records", () => {
    const changes = buildStructuredRegionChanges({
      verdict: "diff",
      regions: [
        {
          region: "hero panel",
          bbox: { left: 10, top: 20, width: 30, height: 40 },
          baselineColor: "#112233",
          variantColor: "#445566",
          description: "The hero panel background is lighter.",
          colorSample: {
            source: "bbox-average",
            pixelCount: 12,
            totalPixelCount: 20,
            changedPixelCount: 12,
            averageChannelDelta: 51,
          },
        },
      ],
      summary: "One color change",
    });

    assert.deepEqual(changes, [
      {
        type: "CHANGE",
        source: "vlm-region-diff",
        selector: null,
        selectorHint: "hero panel",
        property: "background-color",
        from: "#112233",
        to: "#445566",
        delta: {
          kind: "color",
          averageChannelDelta: 51,
        },
        bbox: { left: 10, top: 20, width: 30, height: 40 },
        region: "hero panel",
        description: "The hero panel background is lighter.",
        confidence: "high",
        evidence: {
          colorSample: {
            source: "bbox-average",
            pixelCount: 12,
            totalPixelCount: 20,
            changedPixelCount: 12,
            averageChannelDelta: 51,
          },
        },
      },
    ]);
  });

  it("infers text and border properties from VLM region wording", () => {
    const changes = buildStructuredRegionChanges({
      verdict: "diff",
      regions: [
        {
          region: "button label text",
          bbox: { left: 0, top: 0, width: 4, height: 4 },
          baselineColor: "#000",
          variantColor: "#fff",
          description: "Text color changed.",
        },
        {
          region: "card border",
          bbox: { left: 4, top: 4, width: 2, height: 2 },
          baselineColor: "rgb(10, 20, 30)",
          variantColor: "rgb(20, 20, 20)",
          description: "The border stroke is darker.",
        },
      ],
      summary: "Two color changes",
    });

    assert.equal(changes[0]?.property, "color");
    assert.deepEqual(changes[0]?.delta, { kind: "color", averageChannelDelta: 255 });
    assert.equal(changes[0]?.confidence, "medium");

    assert.equal(changes[1]?.property, "border-color");
    assert.deepEqual(changes[1]?.delta, { kind: "color", averageChannelDelta: 6.67 });
  });

  it("uses explicit VLM selector/property hints when present", () => {
    const result = parseVlmResponse(JSON.stringify({
      verdict: "diff",
      regions: [
        {
          region: "primary action",
          selectorHint: ".cta",
          propertyHint: "background",
          bbox: [1, 2, 3, 4],
          baselineColor: "#123456",
          variantColor: "#654321",
          description: "The CTA gradient differs.",
        },
      ],
      summary: "CTA differs",
    }));

    const changes = buildStructuredRegionChanges(result);
    assert.equal(changes[0]?.selectorHint, ".cta");
    assert.equal(changes[0]?.property, "background");
  });

  it("does not emit CHANGE records when the VLM verdict is no-diff", () => {
    const changes = buildStructuredRegionChanges({
      verdict: "no-diff",
      regions: [
        {
          region: "contradictory row",
          bbox: { left: 0, top: 0, width: 1, height: 1 },
          baselineColor: "#000000",
          variantColor: "#ffffff",
          description: "Should be ignored because verdict is no-diff.",
        },
      ],
      summary: "no diff",
    });

    assert.deepEqual(changes, []);
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
