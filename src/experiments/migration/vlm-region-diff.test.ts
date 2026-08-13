import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { PNG } from "pngjs";
import {
  buildStructuredRegionChanges,
  computeRegionImageScale,
  enrichRegionColorsWithBboxSamples,
  formatRegionDiffMarkdown,
  isTruncatedRegionDiffResponse,
  parseRegionElementsJson,
  parseRegionElementsViewport,
  parseVlmResponse,
  resolveRegionElementsTargetUrl,
  scaleRegionBboxesToOriginal,
} from "./vlm-region-diff.ts";

describe("isTruncatedRegionDiffResponse", () => {
  it("is true when the provider reports finish_reason=length", () => {
    const content = JSON.stringify({ verdict: "diff", regions: [], summary: "ok" });
    assert.equal(isTruncatedRegionDiffResponse(content, "length"), true);
  });

  it("is false for a complete response with finish_reason=stop", () => {
    const content = JSON.stringify({ verdict: "diff", regions: [], summary: "ok" });
    assert.equal(isTruncatedRegionDiffResponse(content, "stop"), false);
  });

  it("is true for unparseable JSON when finish_reason is missing", () => {
    const cutOff = '{"verdict": "diff", "regions": [{"region": "head';
    assert.equal(isTruncatedRegionDiffResponse(cutOff, undefined), true);
  });

  it("is false for prose without JSON when finish_reason is stop", () => {
    assert.equal(isTruncatedRegionDiffResponse("no differences found", "stop"), false);
  });
});

describe("computeRegionImageScale", () => {
  it("returns 1 when every dimension fits within the max edge", () => {
    const scale = computeRegionImageScale(
      [{ width: 1280, height: 800 }, { width: 375, height: 7000 }],
      7500,
    );
    assert.equal(scale, 1);
  });

  it("scales down to fit the tallest dimension", () => {
    const scale = computeRegionImageScale(
      [{ width: 375, height: 9541 }, { width: 375, height: 9377 }],
      7500,
    );
    assert.equal(scale, 7500 / 9541);
  });
});

describe("scaleRegionBboxesToOriginal", () => {
  it("returns the result unchanged when scale is 1", () => {
    const result = parseVlmResponse(JSON.stringify({
      verdict: "diff",
      regions: [{ region: "a", bbox: { left: 10, top: 20, width: 30, height: 40 }, description: "" }],
      summary: "",
    }));
    assert.deepEqual(scaleRegionBboxesToOriginal(result, 1), result);
  });

  it("maps bboxes from downscaled coordinates back to original pixels", () => {
    const result = parseVlmResponse(JSON.stringify({
      verdict: "diff",
      regions: [
        { region: "a", bbox: { left: 10, top: 20, width: 30, height: 40 }, description: "" },
        { region: "b", bbox: null, description: "" },
      ],
      summary: "",
    }));
    const scaled = scaleRegionBboxesToOriginal(result, 0.5);
    assert.deepEqual(scaled.regions[0]?.bbox, { left: 20, top: 40, width: 60, height: 80 });
    assert.equal(scaled.regions[1]?.bbox, null);
  });
});

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
        verification: {
          measuredDelta: 51,
          refuted: false,
          floor: 3,
        },
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

  it("refutes a region whose measured pixels show no change (draft 09)", () => {
    // The VLM placed the bbox in the wrong page area, so the measured
    // colorSample shows ~zero delta. The pixels refute the claim — it must
    // not stay a confident finding.
    const changes = buildStructuredRegionChanges({
      verdict: "diff",
      regions: [
        {
          region: "portfolio labels",
          bbox: { left: 0, top: 0, width: 40, height: 20 },
          baselineColor: "#252327",
          variantColor: "#252328",
          description: "labels white -> light blue",
          colorSample: {
            source: "bbox-average",
            pixelCount: 800,
            totalPixelCount: 800,
            changedPixelCount: 0,
            averageChannelDelta: 0.33,
          },
        },
      ],
      summary: "One claimed color change",
    });

    assert.equal(changes[0]?.confidence, "low");
    assert.equal(changes[0]?.verification?.refuted, true);
    assert.equal(changes[0]?.verification?.measuredDelta, 0.33);
  });

  it("keeps a region whose measured pixels confirm the change (draft 09)", () => {
    const changes = buildStructuredRegionChanges({
      verdict: "diff",
      regions: [
        {
          region: "hero panel",
          bbox: { left: 10, top: 20, width: 30, height: 40 },
          baselineColor: "#112233",
          variantColor: "#445566",
          description: "background is lighter",
          colorSample: {
            source: "bbox-average",
            pixelCount: 12,
            totalPixelCount: 20,
            changedPixelCount: 12,
            averageChannelDelta: 51,
          },
        },
      ],
      summary: "One confirmed color change",
    });

    assert.equal(changes[0]?.verification?.refuted, false);
    assert.equal(changes[0]?.confidence, "high");
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

  it("joins region bboxes to the most overlapping DOM selector candidate", () => {
    const changes = buildStructuredRegionChanges(
      {
        verdict: "diff",
        regions: [
          {
            region: "button label",
            bbox: { left: 120, top: 80, width: 40, height: 20 },
            baselineColor: "#111111",
            variantColor: "#333333",
            description: "The label is lighter.",
          },
        ],
        summary: "label changed",
      },
      {
        elements: [
          {
            path: "body[0]>main[0]>section[0]",
            tag: "section",
            classes: "hero",
            top: 40,
            left: 80,
            width: 300,
            height: 160,
          },
          {
            path: "body[0]>main[0]>section[0]>button[0]",
            tag: "button",
            classes: "cta primary",
            top: 70,
            left: 110,
            width: 80,
            height: 44,
          },
        ],
      },
    );

    assert.equal(changes[0]?.selector, ".cta");
    assert.equal(changes[0]?.selectorConfidence, "high");
    assert.equal(changes[0]?.evidence.selectorMatch?.path, "body[0]>main[0]>section[0]>button[0]");
  });

  it("prefers a concrete partial match over a huge ancestor container", () => {
    const changes = buildStructuredRegionChanges(
      {
        verdict: "diff",
        regions: [
          {
            region: "primary action button",
            bbox: { left: 399, top: 534, width: 150, height: 44 },
            baselineColor: "#366fed",
            variantColor: "#f15353",
            description: "The primary action button changed from blue to red.",
          },
        ],
        summary: "CTA color changed",
      },
      {
        elements: [
          {
            path: "body[0]>main[0]",
            tag: "main",
            classes: "launch-panel",
            top: 265.203125,
            left: 380,
            width: 680,
            height: 369.578125,
          },
          {
            path: "body[0]>main[0]>div[4]>button[0]",
            tag: "button",
            classes: "cta",
            top: 551.78125,
            left: 413,
            width: 156,
            height: 50,
          },
        ],
      },
    );

    assert.equal(changes[0]?.selector, ".cta");
    assert.equal(changes[0]?.selectorConfidence, "medium");
    assert.equal(changes[0]?.evidence.selectorMatch?.path, "body[0]>main[0]>div[4]>button[0]");
  });

  it("falls back from class to id to tag when building selector candidates", () => {
    const result = {
      verdict: "diff" as const,
      regions: [
        {
          region: "panel",
          bbox: { left: 0, top: 0, width: 10, height: 10 },
          baselineColor: "#000",
          variantColor: "#fff",
          description: "panel changed",
        },
      ],
      summary: "changed",
    };

    assert.equal(
      buildStructuredRegionChanges(result, {
        elements: [{ path: "main[0]", tag: "main", id: "page", classes: "shell", top: 0, left: 0, width: 10, height: 10 }],
      })[0]?.selector,
      ".shell",
    );
    assert.equal(
      buildStructuredRegionChanges(result, {
        elements: [{ path: "main[0]", tag: "main", id: "page", classes: "", top: 0, left: 0, width: 10, height: 10 }],
      })[0]?.selector,
      "#page",
    );
    assert.equal(
      buildStructuredRegionChanges(result, {
        elements: [{ path: "main[0]", tag: "main", classes: "", top: 0, left: 0, width: 10, height: 10 }],
      })[0]?.selector,
      "main",
    );
  });

  it("keeps selector null when no DOM rect overlaps the VLM bbox", () => {
    const changes = buildStructuredRegionChanges(
      {
        verdict: "diff",
        regions: [
          {
            region: "panel",
            bbox: { left: 0, top: 0, width: 10, height: 10 },
            baselineColor: "#000",
            variantColor: "#fff",
            description: "panel changed",
          },
        ],
        summary: "changed",
      },
      {
        elements: [{ path: "aside[0]", tag: "aside", classes: "sidebar", top: 100, left: 100, width: 20, height: 20 }],
      },
    );

    assert.equal(changes[0]?.selector, null);
    assert.equal(changes[0]?.selectorConfidence, undefined);
    assert.equal(changes[0]?.evidence.selectorMatch, undefined);
  });
});

describe("parseRegionElementsJson", () => {
  it("parses a raw element array and filters malformed rows", () => {
    const elements = parseRegionElementsJson(JSON.stringify([
      {
        path: "body[0]>main[0]",
        tag: "main",
        id: "page",
        classes: "shell",
        top: 0,
        left: 0,
        width: 100,
        height: 200,
      },
      { path: "bad", tag: "div", top: 0, left: 0, width: 100 },
    ]));

    assert.deepEqual(elements, [
      {
        path: "body[0]>main[0]",
        tag: "main",
        id: "page",
        classes: "shell",
        top: 0,
        left: 0,
        width: 100,
        height: 200,
      },
    ]);
  });

  it("parses an object with an elements array", () => {
    const elements = parseRegionElementsJson(JSON.stringify({
      elements: [
        { path: "button[0]", tag: "button", classes: "cta", top: 1, left: 2, width: 3, height: 4 },
      ],
    }));

    assert.equal(elements.length, 1);
    assert.equal(elements[0]?.path, "button[0]");
  });

  it("returns an empty list for malformed JSON", () => {
    assert.deepEqual(parseRegionElementsJson("not json"), []);
  });
});

describe("region elements capture helpers", () => {
  it("parses WIDTHxHEIGHT viewport specs", () => {
    assert.deepEqual(parseRegionElementsViewport("1280x900"), { width: 1280, height: 900 });
    assert.deepEqual(parseRegionElementsViewport(" 800X600 "), { width: 800, height: 600 });
  });

  it("rejects malformed viewport specs", () => {
    assert.throws(() => parseRegionElementsViewport("1280"), /--elements-viewport must be WIDTHxHEIGHT/);
    assert.throws(() => parseRegionElementsViewport("0x900"), /--elements-viewport must be WIDTHxHEIGHT/);
  });

  it("keeps URL targets and converts file paths to file URLs", () => {
    assert.equal(resolveRegionElementsTargetUrl("https://example.test/page"), "https://example.test/page");
    assert.match(resolveRegionElementsTargetUrl("fixtures/page.html"), /^file:\/\//);
    assert.match(resolveRegionElementsTargetUrl("fixtures/page.html"), /fixtures\/page\.html$/);
  });
});

describe("formatRegionDiffMarkdown", () => {
  it("renders selector-ready changes as an agent-facing table", () => {
    const markdown = formatRegionDiffMarkdown({
      model: "anthropic/claude-haiku-4-5",
      mode: "split",
      usage: null,
      verdict: "diff",
      regions: [],
      summary: "One changed region.",
      changes: [
        {
          type: "CHANGE",
          source: "vlm-region-diff",
          selector: ".cta",
          selectorHint: "primary action",
          selectorConfidence: "high",
          property: "background-color",
          from: "#112233",
          to: "#445566",
          delta: { kind: "color", averageChannelDelta: 51 },
          bbox: { left: 10, top: 20, width: 30, height: 40 },
          region: "primary action",
          description: "The CTA background is lighter.",
          confidence: "high",
          evidence: {
            selectorMatch: {
              path: "body[0]>button[0]",
              tag: "button",
              classes: "cta",
              bbox: { left: 8, top: 18, width: 36, height: 44 },
              regionCoverage: 1,
              elementCoverage: 0.76,
              iou: 0.76,
              score: 0.93,
            },
          },
        },
      ],
      rawContent: "{}",
    });

    assert.match(markdown, /# VLM region diff/);
    assert.match(markdown, /Model: `anthropic\/claude-haiku-4-5`/);
    assert.match(markdown, /\| Selector \| Property \| From \| To \| Delta \| Bbox \| Confidence \| Evidence \|/);
    assert.match(markdown, /\| `\.cta` \| `background-color` \| `#112233` \| `#445566` \| 51 \| `10,20 30x40` \| high \/ high \| `button` `body\[0\]>button\[0\]` /);
    assert.match(markdown, /The CTA background is lighter\./);
  });

  it("separates pixel-refuted changes from the confident table (drafts 06/09)", () => {
    const markdown = formatRegionDiffMarkdown({
      model: "anthropic/claude-haiku-4-5",
      mode: "split",
      usage: null,
      verdict: "diff",
      regions: [],
      summary: "One confirmed, one refuted.",
      changes: [
        {
          type: "CHANGE",
          source: "vlm-region-diff",
          selector: ".cta",
          selectorHint: "primary action",
          property: "background-color",
          from: "#112233",
          to: "#445566",
          delta: { kind: "color", averageChannelDelta: 51 },
          bbox: { left: 10, top: 20, width: 30, height: 40 },
          region: "primary action",
          description: "The CTA background is lighter.",
          confidence: "high",
          verification: { measuredDelta: 51, refuted: false, floor: 3 },
          evidence: {},
        },
        {
          type: "CHANGE",
          source: "vlm-region-diff",
          selector: ".masthead",
          selectorHint: "portfolio labels",
          property: "background-color",
          from: "#252327",
          to: "#252328",
          delta: { kind: "color", averageChannelDelta: 0.33 },
          bbox: { left: 0, top: 0, width: 40, height: 20 },
          region: "portfolio labels",
          description: "labels white -> light blue",
          confidence: "low",
          verification: { measuredDelta: 0.33, refuted: true, floor: 3 },
          evidence: {},
        },
      ],
      rawContent: "{}",
    });

    // Confident table holds only the confirmed change.
    assert.match(markdown, /`\.cta`/);
    // The refuted row is moved out of the confident table into a clearly
    // labeled unverified section that warns the pixels disagree.
    assert.match(markdown, /[Uu]nverified|pixels refute|measured pixels disagree/);
    assert.match(markdown, /`\.masthead`/);
    // The refuted selector must not appear in the confident table body.
    const confidentTable = markdown.split(/##/)[0]!;
    assert.doesNotMatch(confidentTable, /`\.masthead`/);
  });

  it("renders no-change results without an empty table", () => {
    const markdown = formatRegionDiffMarkdown({
      model: "model",
      mode: "split",
      usage: null,
      verdict: "no-diff",
      regions: [],
      summary: "No visible region diff.",
      changes: [],
      rawContent: "{}",
    });

    assert.match(markdown, /No structured region changes/);
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
