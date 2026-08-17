import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "vitest";
import {
  runMigrationCompare,
  type MigrationCompareOptions,
} from "./migration-compare.ts";

const FIXTURE_DIR = join(
  import.meta.dirname!,
  "..",
  "..",
  "..",
  "fixtures",
  "migration",
  "region-diff-handoff",
);

describe("migration compare region-diff dogfood", () => {
  it("writes region-diff artifacts and report summaries for a CTA paint regression", async () => {
    const outputDir = await mkdtemp(join(tmpdir(), "vlmkit-region-diff-dogfood-"));
    const oldKey = process.env.OPENROUTER_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    const analyzerCalls: Array<{
      baseline: string;
      variant: string;
      elements: Array<{ tag: string; classes?: string; left: number; top: number; width: number; height: number }>;
    }> = [];

    try {
      const options: MigrationCompareOptions = {
        dir: FIXTURE_DIR,
        baseline: "before.html",
        variants: ["after.html"],
        outputDir,
        fixedViewports: [{ width: 1440, height: 900, label: "wide", reason: "dogfood" }],
        autoDiscover: false,
        discoverBackend: "regex",
        maxViewports: 1,
        randomSamples: 0,
        approvalPath: "",
        strict: false,
        paintTreeUrl: "",
        enablePaintTree: false,
        baselineSanityCheck: false,
        domEquivalenceCheck: false,
        computedStyleDiff: false,
        domPositionDiff: false,
        componentBboxDiff: false,
        triptych: false,
        regionDiff: true,
        regionDiffFormat: "both",
        regionDiffModel: "offline/mock",
        regionDiffMaxTokens: 1,
        regionDiffAnalyzer: async (input) => {
          analyzerCalls.push({
            baseline: input.baseline,
            variant: input.variant,
            elements: input.elements ?? [],
          });
          assert.ok(input.elements?.some((element) => element.classes?.split(/\s+/).includes("cta")));
          return {
            model: input.model ?? "offline/mock",
            mode: "split",
            usage: null,
            verdict: "diff",
            regions: [],
            summary: "Primary CTA background changed from blue to red.",
            changes: [
              {
                type: "CHANGE",
                source: "vlm-region-diff",
                selector: ".cta",
                selectorHint: "primary CTA",
                selectorConfidence: "high",
                property: "background-color",
                from: "#2d69ec",
                to: "#f04b4b",
                delta: { kind: "color", averageChannelDelta: 128.67 },
                bbox: { left: 170, top: 338, width: 156, height: 50 },
                region: "Start review button",
                description: "The CTA fill changed from blue to red.",
                confidence: "high",
                evidence: {},
              },
            ],
          };
        },
      };

      const report = await runMigrationCompare(options);

      assert.equal(analyzerCalls.length, 1);
      assert.match(analyzerCalls[0].baseline, /before-wide\.png$/);
      assert.match(analyzerCalls[0].variant, /after-wide\.png$/);

      const regionReport = report.regionDiffs?.[0]?.perViewport[0];
      assert.ok(regionReport);
      assert.equal(regionReport.viewport, "wide");
      assert.equal(regionReport.verdict, "diff");
      assert.equal(regionReport.changeCount, 1);
      assert.equal(regionReport.changes[0].selector, ".cta");
      assert.equal(regionReport.changes[0].property, "background-color");
      assert.equal(regionReport.changes[0].from, "#2d69ec");
      assert.equal(regionReport.changes[0].to, "#f04b4b");
      assert.match(regionReport.jsonPath ?? "", /after-wide-region-diff\.json$/);
      assert.match(regionReport.markdownPath ?? "", /after-wide-region-diff\.md$/);

      const jsonArtifact = JSON.parse(await readFile(regionReport.jsonPath!, "utf-8"));
      const markdownArtifact = await readFile(regionReport.markdownPath!, "utf-8");
      assert.equal(jsonArtifact.changes[0].selector, ".cta");
      assert.match(markdownArtifact, /Primary CTA background changed/);
      assert.match(markdownArtifact, /\.cta/);
    } finally {
      if (oldKey === undefined) {
        delete process.env.OPENROUTER_API_KEY;
      } else {
        process.env.OPENROUTER_API_KEY = oldKey;
      }
      await rm(outputDir, { recursive: true, force: true });
    }
  });

  it("caps region-diff analyzer calls to the worst changed viewports", async () => {
    const outputDir = await mkdtemp(join(tmpdir(), "vlmkit-region-diff-cap-"));
    const oldKey = process.env.OPENROUTER_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    const analyzerViewports: string[] = [];

    try {
      const options: MigrationCompareOptions = {
        dir: FIXTURE_DIR,
        baseline: "before.html",
        variants: ["after.html"],
        outputDir,
        fixedViewports: [
          { width: 1440, height: 900, label: "wide", reason: "dogfood" },
          { width: 1280, height: 900, label: "desktop", reason: "dogfood" },
          { width: 375, height: 812, label: "mobile", reason: "dogfood" },
        ],
        autoDiscover: false,
        discoverBackend: "regex",
        maxViewports: 3,
        randomSamples: 0,
        approvalPath: "",
        strict: false,
        paintTreeUrl: "",
        enablePaintTree: false,
        baselineSanityCheck: false,
        domEquivalenceCheck: false,
        computedStyleDiff: false,
        domPositionDiff: false,
        componentBboxDiff: false,
        triptych: false,
        regionDiff: true,
        regionDiffFormat: "json",
        regionDiffModel: "offline/mock",
        regionDiffMaxTokens: 1,
        regionDiffMaxViewports: 1,
        regionDiffAnalyzer: async (input) => {
          const viewport = input.variant.match(/after-([^-]+)\.png$/)?.[1] ?? "unknown";
          analyzerViewports.push(viewport);
          return {
            model: input.model ?? "offline/mock",
            mode: "split",
            usage: null,
            verdict: "diff",
            regions: [],
            summary: `Mock diff at ${viewport}.`,
            changes: [{
              type: "CHANGE",
              source: "vlm-region-diff",
              selector: ".cta",
              selectorHint: "primary CTA",
              selectorConfidence: "high",
              property: "background-color",
              from: "#2d69ec",
              to: "#f04b4b",
              delta: { kind: "color", averageChannelDelta: 128.67 },
              bbox: { left: 170, top: 338, width: 156, height: 50 },
              region: "Start review button",
              description: "The CTA fill changed from blue to red.",
              confidence: "high",
              evidence: {},
            }],
          };
        },
      };

      const report = await runMigrationCompare(options);

      assert.deepEqual(analyzerViewports, ["mobile"]);
      assert.equal(report.results.length, 3);
      assert.equal(report.regionDiffs?.[0]?.perViewport.length, 1);
      assert.equal(report.regionDiffs?.[0]?.perViewport[0]?.viewport, "mobile");
      assert.equal(report.regionDiffs?.[0]?.maxViewports, 1);
      const skipped = report.regionDiffs?.[0]?.skippedViewports ?? [];
      assert.deepEqual(skipped.map((entry) => entry.viewport).sort(), ["desktop", "wide"]);
      assert.ok(skipped.every((entry) => entry.reason === "region-diff-max-viewports"));
      assert.ok(skipped.every((entry) => entry.diffRatio > 0));
      assert.ok(skipped.every((entry) => entry.diffPixels > 0));
    } finally {
      if (oldKey === undefined) {
        delete process.env.OPENROUTER_API_KEY;
      } else {
        process.env.OPENROUTER_API_KEY = oldKey;
      }
      await rm(outputDir, { recursive: true, force: true });
    }
  });
});
