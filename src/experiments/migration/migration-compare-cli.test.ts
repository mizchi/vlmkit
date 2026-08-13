import assert from "node:assert/strict";
import { resolve } from "node:path";
import { describe, it } from "vitest";
import { DEFAULT_BIDI_URL } from "@mizchi/vlmkit-capture/crater-client.ts";
import {
  parseMigrationCompareArgs,
  summarizeMigrationRegionDiffOutput,
} from "./migration-compare.ts";

describe("parseMigrationCompareArgs", () => {
  it("should parse explicit flags into reusable options", () => {
    const options = parseMigrationCompareArgs([
      "--dir", "fixtures/migration/reset-css",
      "--baseline", "normalize.html",
      "--variants", "modern-normalize.html", "destyle.html",
      "--output-dir", "artifacts/migration-report",
      "--approval", "approval.json",
      "--strict",
      "--no-discover",
      "--max-viewports", "7",
      "--random-samples", "2",
      "--paint-tree-url", "ws://127.0.0.1:9333",
      "--no-paint-tree",
    ]);

    assert.equal(options.dir, "fixtures/migration/reset-css");
    assert.equal(options.baseline, "normalize.html");
    assert.deepEqual(options.variants, ["modern-normalize.html", "destyle.html"]);
    assert.equal(options.outputDir, resolve("artifacts/migration-report"));
    assert.equal(options.approvalPath, "approval.json");
    assert.equal(options.strict, true);
    assert.equal(options.autoDiscover, false);
    assert.equal(options.discoverBackend, "auto");
    assert.equal(options.maxViewports, 7);
    assert.equal(options.randomSamples, 2);
    assert.equal(options.paintTreeUrl, "ws://127.0.0.1:9333");
    assert.equal(options.enablePaintTree, false);
  });

  it("should support positional before/after arguments", () => {
    const options = parseMigrationCompareArgs(["before.html", "after.html"]);

    assert.equal(options.dir, ".");
    assert.equal(options.baseline, "before.html");
    assert.deepEqual(options.variants, ["after.html"]);
    assert.equal(options.approvalPath, "");
    assert.equal(options.strict, false);
    assert.equal(options.autoDiscover, true);
    assert.equal(options.discoverBackend, "auto");
    assert.equal(options.maxViewports, 15);
    assert.equal(options.randomSamples, 1);
    assert.equal(options.paintTreeUrl, DEFAULT_BIDI_URL);
    assert.equal(options.enablePaintTree, true);
  });

  it("should parse explicit discover backend", () => {
    const options = parseMigrationCompareArgs([
      "--discover-backend", "crater",
      "before.html",
      "after.html",
    ]);

    assert.equal(options.discoverBackend, "crater");
  });

  it("should reject unsupported discover backend", () => {
    assert.throws(
      () => parseMigrationCompareArgs([
        "--discover-backend", "unsupported",
        "before.html",
        "after.html",
      ]),
      /invalid --discover-backend/i,
    );
  });

  it("should accept --output as alias for --output-dir", () => {
    // Agents typed `--output` first; the typo'd flag was silently swallowed
    // and reports always landed at the default location. See #22.
    const options = parseMigrationCompareArgs([
      "--output", "/tmp/agent-output",
      "before.html",
      "after.html",
    ]);
    assert.equal(options.outputDir, resolve("/tmp/agent-output"));
  });

  it("should prefer --output-dir over --output when both passed", () => {
    const options = parseMigrationCompareArgs([
      "--output", "/tmp/alias",
      "--output-dir", "/tmp/explicit",
      "before.html",
      "after.html",
    ]);
    assert.equal(options.outputDir, resolve("/tmp/explicit"));
  });

  it("should default computed-style and dom-position-diff to ON", () => {
    // Playwright-driven, no Crater BiDi dependency. Agents need these
    // property-level signals by default — they were being silently
    // skipped before, leaving font-family / padding / gap deltas
    // invisible. See #25.
    const options = parseMigrationCompareArgs(["before.html", "after.html"]);
    assert.equal(options.computedStyleDiff, true);
    assert.equal(options.domPositionDiff, true);
  });

  it("should respect --no-computed-style / --no-dom-position-diff opt-outs", () => {
    const options = parseMigrationCompareArgs([
      "--no-computed-style",
      "--no-dom-position-diff",
      "before.html",
      "after.html",
    ]);
    assert.equal(options.computedStyleDiff, false);
    assert.equal(options.domPositionDiff, false);
  });

  it("should default triptych to ON and honor --no-triptych", () => {
    const def = parseMigrationCompareArgs(["before.html", "after.html"]);
    assert.equal(def.triptych, true);

    const optOut = parseMigrationCompareArgs([
      "--no-triptych",
      "before.html",
      "after.html",
    ]);
    assert.equal(optOut.triptych, false);
  });

  it("should parse optional VLM region diff handoff flags", () => {
    const options = parseMigrationCompareArgs([
      "--region-diff",
      "--region-diff-format", "markdown",
      "--region-diff-model", "anthropic/custom",
      "--region-diff-max-tokens", "900",
      "--region-diff-max-viewports", "2",
      "before.html",
      "after.html",
    ]);

    assert.equal(options.regionDiff, true);
    assert.equal(options.regionDiffFormat, "markdown");
    assert.equal(options.regionDiffModel, "anthropic/custom");
    assert.equal(options.regionDiffMaxTokens, 900);
    assert.equal(options.regionDiffMaxViewports, 2);
  });

  it("should reject invalid VLM region diff formats", () => {
    assert.throws(
      () => parseMigrationCompareArgs([
        "--region-diff-format", "xml",
        "before.html",
        "after.html",
      ]),
      /invalid --region-diff-format/i,
    );
  });

  it("summarizes VLM region diff outputs for the migration report", () => {
    const summary = summarizeMigrationRegionDiffOutput(
      "desktop",
      {
        model: "anthropic/claude-haiku-4-5",
        mode: "split",
        usage: null,
        verdict: "diff",
        regions: [],
        summary: "CTA color changed.",
        changes: [
          {
            type: "CHANGE",
            source: "vlm-region-diff",
            selector: ".cta",
            selectorHint: "primary action",
            selectorConfidence: "high",
            property: "background-color",
            from: "#2563eb",
            to: "#ef4444",
            delta: { kind: "color", averageChannelDelta: 128.67 },
            bbox: { left: 170, top: 338, width: 156, height: 50 },
            region: "primary action",
            description: "The CTA fill changed from blue to red.",
            confidence: "high",
            evidence: {},
          },
        ],
      },
      {
        jsonPath: "out/after-desktop-region-diff.json",
        markdownPath: "out/after-desktop-region-diff.md",
      },
    );

    assert.deepEqual(summary, {
      viewport: "desktop",
      jsonPath: "out/after-desktop-region-diff.json",
      markdownPath: "out/after-desktop-region-diff.md",
      verdict: "diff",
      summary: "CTA color changed.",
      changeCount: 1,
      changes: [
        {
          selector: ".cta",
          selectorHint: "primary action",
          selectorConfidence: "high",
          property: "background-color",
          from: "#2563eb",
          to: "#ef4444",
          averageChannelDelta: 128.67,
          bbox: { left: 170, top: 338, width: 156, height: 50 },
          confidence: "high",
        },
      ],
    });
  });
});
