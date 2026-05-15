import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildMarkdownSummary } from "./diff-pr.ts";
import { parseDiffPrConfig } from "./diff-pr-config.ts";

const config = parseDiffPrConfig(JSON.stringify({
  baseUrl: "http://localhost:3000",
  thresholds: { mobile: 0.01, desktop: 0.005, wide: 0.005 },
  routes: [
    "/",
    { name: "admin", path: "/admin", thresholds: { mobile: 0.03, desktop: 0.02, wide: 0.02 } },
  ],
}), "/example/vrt.config.json");

describe("buildMarkdownSummary", () => {
  it("declares PASS when every route is within threshold", () => {
    const md = buildMarkdownSummary(config, [
      {
        route: config.routes[0],
        viewports: [
          { viewport: "mobile", diffRatio: 0.001, diffPixels: 5, totalPixels: 5000, threshold: 0.01, pass: true },
        ],
        failed: false,
      },
    ]);
    assert.match(md, /Status: \*\*PASS\*\*/);
    assert.match(md, /✅/);
    assert.doesNotMatch(md, /❌/);
    assert.doesNotMatch(md, /Worst offenders/);
  });

  it("declares FAIL with route count when any route is over threshold", () => {
    const md = buildMarkdownSummary(config, [
      {
        route: config.routes[0],
        viewports: [
          { viewport: "mobile", diffRatio: 0.05, diffPixels: 250, totalPixels: 5000, threshold: 0.01, pass: false },
          { viewport: "desktop", diffRatio: 0.001, diffPixels: 5, totalPixels: 5000, threshold: 0.005, pass: true },
        ],
        failed: true,
      },
      {
        route: config.routes[1],
        viewports: [
          { viewport: "mobile", diffRatio: 0.005, diffPixels: 25, totalPixels: 5000, threshold: 0.03, pass: true },
        ],
        failed: false,
      },
    ]);
    assert.match(md, /Status: \*\*FAIL\*\* \(1 of 2 route\(s\)\)/);
    assert.match(md, /Worst offenders/);
    assert.match(md, /\/ mobile: 5\.00%/);
  });

  it("handles routes with no result (missing baseline) gracefully", () => {
    const md = buildMarkdownSummary(config, [
      {
        route: config.routes[0],
        viewports: [],
        failed: true,
        error: "no baseline at /tmp/.vrt/baselines/home",
      },
    ]);
    assert.match(md, /no baseline at/);
    assert.match(md, /Status: \*\*FAIL\*\*/);
  });

  it("ranks worst offenders by (diff - threshold) overage", () => {
    const md = buildMarkdownSummary(config, [
      {
        route: config.routes[0],
        viewports: [
          { viewport: "mobile", diffRatio: 0.015, diffPixels: 1, totalPixels: 1, threshold: 0.01, pass: false },
        ],
        failed: true,
      },
      {
        route: config.routes[1],
        viewports: [
          { viewport: "mobile", diffRatio: 0.04, diffPixels: 1, totalPixels: 1, threshold: 0.03, pass: false },
          { viewport: "wide", diffRatio: 0.5, diffPixels: 1, totalPixels: 1, threshold: 0.02, pass: false },
        ],
        failed: true,
      },
    ]);
    // wide is 0.48 over threshold; that should be first.
    const offenderIdx = md.indexOf("## Worst offenders");
    const tail = md.slice(offenderIdx);
    const firstLine = tail.split("\n").find((l) => l.startsWith("- "))!;
    assert.match(firstLine, /admin.*wide.*50\.00%/);
  });
});
