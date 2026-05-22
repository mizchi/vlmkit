import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  discoverViewports,
  extractBreakpoints,
  extractBreakpointsFromHtmlWithStylesheets,
  extractResponsiveBreakpointsFromHtml,
  extractResponsiveBreakpointsFromHtmlWithStylesheets,
  extractStylesheetHrefsFromHtml,
  generateViewports,
  mergeResponsiveBreakpoints,
  toResponsiveBreakpoints,
} from "./viewport-discovery.ts";

describe("extractBreakpoints", () => {
  it("should extract min-width breakpoints", () => {
    const css = `
      @media (min-width: 640px) { .a { display: block; } }
      @media (min-width: 768px) { .b { display: block; } }
      @media (min-width: 1024px) { .c { display: block; } }
    `;
    const bps = extractBreakpoints(css);
    assert.equal(bps.length, 3);
    assert.equal(bps[0].value, 640);
    assert.equal(bps[0].type, "min-width");
    assert.equal(bps[1].value, 768);
    assert.equal(bps[2].value, 1024);
  });

  it("should extract max-width breakpoints", () => {
    const css = `@media (max-width: 768px) { .a { display: none; } }`;
    const bps = extractBreakpoints(css);
    assert.equal(bps.length, 1);
    assert.equal(bps[0].type, "max-width");
    assert.equal(bps[0].value, 768);
  });

  it("should handle rem units", () => {
    const css = `@media (min-width: 48rem) { .a {} }`;
    const bps = extractBreakpoints(css);
    assert.equal(bps[0].value, 768); // 48 * 16
  });

  it("should deduplicate identical breakpoints", () => {
    const css = `
      @media (min-width: 768px) { .a {} }
      @media (min-width: 768px) { .b {} }
    `;
    const bps = extractBreakpoints(css);
    assert.equal(bps.length, 1);
  });

  it("should return empty for no media queries", () => {
    const bps = extractBreakpoints("body { color: red; }");
    assert.equal(bps.length, 0);
  });
});

describe("generateViewports", () => {
  it("should generate boundary viewports for breakpoints", () => {
    const bps = [
      { value: 640, type: "min-width" as const, raw: "(min-width: 640px)" },
      { value: 768, type: "min-width" as const, raw: "(min-width: 768px)" },
    ];
    const vps = generateViewports(bps, { includeStandard: false });
    const widths = vps.map((v) => v.width);
    assert.ok(widths.includes(639), "should include 640-1 = 639");
    assert.ok(widths.includes(640), "should include 640");
    assert.ok(widths.includes(767), "should include 768-1 = 767");
    assert.ok(widths.includes(768), "should include 768");
  });

  it("should generate boundary for max-width", () => {
    const bps = [{ value: 768, type: "max-width" as const, raw: "(max-width: 768px)" }];
    const vps = generateViewports(bps, { includeStandard: false });
    const widths = vps.map((v) => v.width);
    assert.ok(widths.includes(768), "should include 768");
    assert.ok(widths.includes(769), "should include 768+1 = 769");
  });

  it("should include standard viewports by default", () => {
    const vps = generateViewports([]);
    const widths = vps.map((v) => v.width);
    assert.ok(widths.includes(375));
    assert.ok(widths.includes(1280));
    assert.ok(widths.includes(1440));
  });

  it("should add random samples when requested", () => {
    const bps = [
      { value: 640, type: "min-width" as const, raw: "(min-width: 640px)" },
      { value: 1024, type: "min-width" as const, raw: "(min-width: 1024px)" },
    ];
    const vps = generateViewports(bps, { includeStandard: false, randomSamples: 2, seed: 1 });
    assert.ok(vps.length > 4, `expected > 4 viewports, got ${vps.length}`);
    // Random samples should be within ranges
    const samples = vps.filter((v) => v.reason.includes("random"));
    assert.ok(samples.length > 0, "should have random samples");
  });

  it("should respect maxViewports", () => {
    const bps = [
      { value: 480, type: "min-width" as const, raw: "(min-width: 480px)" },
      { value: 640, type: "min-width" as const, raw: "(min-width: 640px)" },
      { value: 768, type: "min-width" as const, raw: "(min-width: 768px)" },
      { value: 1024, type: "min-width" as const, raw: "(min-width: 1024px)" },
    ];
    const vps = generateViewports(bps, { maxViewports: 5 });
    assert.ok(vps.length <= 5);
  });

  it("should generate boundary viewports for canonical gt/lt breakpoints", () => {
    const vps = generateViewports([
      {
        axis: "width",
        op: "gt",
        valuePx: 768,
        raw: "(width > 768px)",
        normalized: "(width > 768px)",
        guards: [],
        ruleCount: 1,
      },
      {
        axis: "width",
        op: "lt",
        valuePx: 1024,
        raw: "(width < 1024px)",
        normalized: "(width < 1024px)",
        guards: [],
        ruleCount: 1,
      },
    ], { includeStandard: false });
    const widths = vps.map((v) => v.width);
    assert.ok(widths.includes(768), "should include 768 at gt boundary");
    assert.ok(widths.includes(769), "should include 769 above gt boundary");
    assert.ok(widths.includes(1023), "should include 1023 below lt boundary");
    assert.ok(widths.includes(1024), "should include 1024 at lt boundary");
  });
});

describe("discoverViewports", () => {
  it("should discover from HTML", () => {
    const html = `<html><head><style>
      body { color: red; }
      @media (min-width: 640px) { .a { display: flex; } }
      @media (min-width: 1024px) { .b { display: grid; } }
    </style></head><body></body></html>`;
    const result = discoverViewports(html);
    assert.equal(result.breakpoints.length, 2);
    assert.ok(result.viewports.length >= 5); // standard + boundaries
    const widths = result.viewports.map((v) => v.width);
    assert.ok(widths.includes(639));
    assert.ok(widths.includes(640));
    assert.ok(widths.includes(1023));
    assert.ok(widths.includes(1024));
    assert.equal(result.backend, "regex");
    for (const v of result.viewports) {
      assert.ok(v.source, "regex discovery should tag each viewport with a source");
    }
  });
});

describe("discoverViewportsViaCrater", () => {
  it("collects required-test-viewports and css-rule-viewport-map widths", async () => {
    const { discoverViewportsViaCrater } = await import("./viewport-discovery.ts");
    const result = await discoverViewportsViaCrater({
      getRequiredTestViewports: async () => ({
        viewports: [
          { width: 640, reason: "(min-width: 640px)" },
          { width: 1024, reason: "(min-width: 1024px)" },
        ],
      }),
      getCssRuleViewportMap: async () => ({
        rules: [
          { activeAtWidths: [1024, 1280], inactiveAtWidths: [639] },
        ],
      }),
    });

    const widths = result.viewports.map((v) => v.width).sort((a, b) => a - b);
    assert.deepEqual(widths, [639, 640, 1024, 1280]);
    const requiredSources = result.viewports
      .filter((v) => v.source === "crater-required")
      .map((v) => v.width)
      .sort((a, b) => a - b);
    assert.deepEqual(requiredSources, [640, 1024]);
    const ruleMapSources = result.viewports
      .filter((v) => v.source === "crater-rule-map")
      .map((v) => v.width)
      .sort((a, b) => a - b);
    assert.deepEqual(ruleMapSources, [639, 1280]);
  });

  it("ignores RPC failures gracefully", async () => {
    const { discoverViewportsViaCrater } = await import("./viewport-discovery.ts");
    const result = await discoverViewportsViaCrater({
      getRequiredTestViewports: async () => { throw new Error("boom"); },
    });
    assert.equal(result.viewports.length, 0);
  });
});

describe("discoverViewportsWithBackend", () => {
  it("returns regex output when no crater client is provided", async () => {
    const { discoverViewportsWithBackend } = await import("./viewport-discovery.ts");
    const html = `<html><head><style>
      @media (min-width: 640px) { .a { color: red; } }
    </style></head><body></body></html>`;
    const result = await discoverViewportsWithBackend(html, { includeStandard: false });
    assert.equal(result.backend, "regex");
    assert.ok(result.viewports.length >= 2);
  });

  it("prefers crater intelligence and marks the backend as crater when regex adds nothing new", async () => {
    const { discoverViewportsWithBackend } = await import("./viewport-discovery.ts");
    const html = ""; // no inline CSS → regex produces only standard viewports
    const result = await discoverViewportsWithBackend(html, {
      includeStandard: false,
      craterClient: {
        getRequiredTestViewports: async () => ({
          viewports: [{ width: 720, reason: "crater" }],
        }),
      },
    });
    assert.equal(result.backend, "crater");
    assert.deepEqual(result.viewports.map((v) => v.width), [720]);
    assert.equal(result.viewports[0]?.source, "crater-required");
  });

  it("merges regex widths and reports hybrid when both contribute", async () => {
    const { discoverViewportsWithBackend } = await import("./viewport-discovery.ts");
    const html = `<html><head><style>
      @media (min-width: 480px) { .a { color: red; } }
    </style></head><body></body></html>`;
    const result = await discoverViewportsWithBackend(html, {
      includeStandard: false,
      craterClient: {
        getRequiredTestViewports: async () => ({
          viewports: [{ width: 1024, reason: "crater" }],
        }),
      },
    });
    assert.equal(result.backend, "hybrid");
    const widths = result.viewports.map((v) => v.width).sort((a, b) => a - b);
    assert.ok(widths.includes(479));
    assert.ok(widths.includes(480));
    assert.ok(widths.includes(1024));
    const sources = result.viewports.map((v) => v.source);
    assert.ok(sources.includes("crater-required"));
    assert.ok(sources.includes("regex-boundary"));
  });
});

describe("external stylesheet helpers", () => {
  it("should extract stylesheet hrefs from link tags", () => {
    const html = `
      <link rel="preload" href="/ignored.css">
      <link href="./base.css" rel="stylesheet">
      <link rel="stylesheet alternate" href="theme.css?version=1">
    `;

    assert.deepEqual(
      extractStylesheetHrefsFromHtml(html),
      ["./base.css", "theme.css?version=1"],
    );
  });

  it("should extract breakpoints from HTML plus stylesheet texts", () => {
    const html = `<style>@media (min-width: 640px) { .a {} }</style>`;
    const breakpoints = extractBreakpointsFromHtmlWithStylesheets(html, [
      "@media (min-width: 960px) { .b {} }",
    ]);

    assert.deepEqual(
      breakpoints.map((bp) => bp.value),
      [640, 960],
    );
  });

  it("should extract responsive breakpoints from HTML plus stylesheet texts", () => {
    const responsive = extractResponsiveBreakpointsFromHtmlWithStylesheets(
      `<style>@media (max-width: 40rem) { .a {} }</style>`,
      ["@media (min-width: 60rem) { .b {} }"],
    );

    assert.deepEqual(
      responsive.map((bp) => ({ op: bp.op, valuePx: bp.valuePx })),
      [
        { op: "le", valuePx: 640 },
        { op: "ge", valuePx: 960 },
      ],
    );
  });
});

describe("responsive breakpoint helpers", () => {
  it("should convert regex breakpoints into canonical responsive breakpoints", () => {
    const responsive = toResponsiveBreakpoints([
      { value: 768, type: "min-width", raw: "(min-width: 768px)" },
      { value: 640, type: "max-width", raw: "(max-width: 640px)" },
    ]);

    assert.deepEqual(
      responsive.map((bp) => ({ op: bp.op, valuePx: bp.valuePx })),
      [
        { op: "le", valuePx: 640 },
        { op: "ge", valuePx: 768 },
      ],
    );
  });

  it("should merge responsive breakpoints across documents", () => {
    const merged = mergeResponsiveBreakpoints(
      [
        {
          axis: "width",
          op: "ge",
          valuePx: 768,
          raw: "(min-width: 768px)",
          normalized: "(width >= 768px)",
          guards: [],
          ruleCount: 1,
        },
      ],
      [
        {
          axis: "width",
          op: "ge",
          valuePx: 768,
          raw: "(min-width: 48rem)",
          normalized: "(width >= 768px)",
          guards: [],
          ruleCount: 1,
        },
        {
          axis: "width",
          op: "le",
          valuePx: 640,
          raw: "(max-width: 640px)",
          normalized: "(width <= 640px)",
          guards: [],
          ruleCount: 1,
        },
      ],
    );

    assert.deepEqual(
      merged.map((bp) => ({ op: bp.op, valuePx: bp.valuePx, ruleCount: bp.ruleCount })),
      [
        { op: "le", valuePx: 640, ruleCount: 1 },
        { op: "ge", valuePx: 768, ruleCount: 2 },
      ],
    );
  });

  it("should extract canonical responsive breakpoints from HTML", () => {
    const html = `<style>
      @media (min-width: 48rem) { .a { display: block; } }
      @media (max-width: 640px) { .b { display: none; } }
    </style>`;

    const responsive = extractResponsiveBreakpointsFromHtml(html);

    assert.deepEqual(
      responsive.map((bp) => ({ op: bp.op, valuePx: bp.valuePx })),
      [
        { op: "le", valuePx: 640 },
        { op: "ge", valuePx: 768 },
      ],
    );
  });
});
