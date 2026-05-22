import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractCss } from "../css-challenge/css-challenge-core.ts";
import {
  buildMigrationBlindCompareOptions,
  evaluateMigrationBlindSoloResult,
  evaluateMigrationBlindSuccess,
  formatMigrationBlindScenarioMarkdown,
  formatMigrationBlindSuccessMarkdown,
  parseMigrationBlindManifest,
  selectMigrationBlindScenario,
  synthesizeMigrationBlindReferenceFix,
  summarizeMigrationBlindScenarios,
} from "./migration-blind.ts";
import type { MigrationCompareReport } from "./migration-fix-loop-core.ts";

function createReport(diffRatios: number[]): MigrationCompareReport {
  return {
    dir: "fixtures/migration/shadcn-to-luna",
    baseline: "before.html",
    variants: ["after-blind.html"],
    viewports: [
      { width: 375, height: 812, label: "mobile", reason: "standard" },
      { width: 1280, height: 900, label: "desktop", reason: "standard" },
    ],
    results: diffRatios.map((diffRatio, index) => ({
      variant: "after-blind",
      variantFile: "after-blind.html",
      viewport: index === 0 ? "mobile" : "desktop",
      diffRatio,
      diffPixels: Math.round(diffRatio * 10000),
      dominantCategory: diffRatio === 0 ? "none" : "spacing",
      categorySummary: diffRatio === 0 ? "clean" : "2 spacing",
      paintTreeSummary: diffRatio === 0 ? "clean" : "1 geometry",
      paintTreeChangeCount: diffRatio === 0 ? 0 : 1,
      fixCandidates: [],
    })),
  };
}

describe("parseMigrationBlindManifest", () => {
  it("parses blind scenarios and their success criteria", () => {
    const manifest = parseMigrationBlindManifest(`{
      "scenarios": [
        {
          "id": "reset-css-modern-normalize",
          "title": "Reset CSS switch",
          "dir": "fixtures/migration/reset-css",
          "baseline": "normalize.html",
          "blindTarget": "modern-normalize-blind.html",
          "reference": "modern-normalize.html",
          "successCriteria": { "maxDiffRatio": 0.01, "maxRounds": 3 }
        }
      ]
    }`);

    assert.equal(manifest.scenarios.length, 1);
    assert.equal(manifest.scenarios[0]?.id, "reset-css-modern-normalize");
    assert.equal(manifest.scenarios[0]?.successCriteria.maxDiffRatio, 0.01);
    assert.equal(manifest.scenarios[0]?.successCriteria.maxRounds, 3);
  });
});

describe("selectMigrationBlindScenario", () => {
  it("returns a scenario by id", () => {
    const manifest = parseMigrationBlindManifest(`{
      "scenarios": [
        {
          "id": "shadcn-to-luna",
          "title": "shadcn/ui -> luna",
          "dir": "fixtures/migration/shadcn-to-luna",
          "baseline": "before.html",
          "blindTarget": "after-blind.html",
          "reference": "after.html",
          "successCriteria": { "maxDiffRatio": 0.01, "maxRounds": 3 }
        }
      ]
    }`);

    const scenario = selectMigrationBlindScenario(manifest, "shadcn-to-luna");
    assert.equal(scenario?.blindTarget, "after-blind.html");
  });
});

describe("summarizeMigrationBlindScenarios", () => {
  it("lists scenario ids and fixture paths compactly", () => {
    const manifest = parseMigrationBlindManifest(`{
      "scenarios": [
        {
          "id": "reset-css-modern-normalize",
          "title": "Reset CSS switch",
          "dir": "fixtures/migration/reset-css",
          "baseline": "normalize.html",
          "blindTarget": "modern-normalize-blind.html",
          "reference": "modern-normalize.html",
          "successCriteria": { "maxDiffRatio": 0.01, "maxRounds": 3 }
        },
        {
          "id": "shadcn-to-luna",
          "title": "shadcn/ui -> luna",
          "dir": "fixtures/migration/shadcn-to-luna",
          "baseline": "before.html",
          "blindTarget": "after-blind.html",
          "reference": "after.html",
          "successCriteria": { "maxDiffRatio": 0.01, "maxRounds": 3 }
        }
      ]
    }`);

    assert.deepEqual(summarizeMigrationBlindScenarios(manifest), [
      {
        id: "reset-css-modern-normalize",
        title: "Reset CSS switch",
        dir: "fixtures/migration/reset-css",
        baseline: "normalize.html",
        blindTarget: "modern-normalize-blind.html",
        reference: "modern-normalize.html",
      },
      {
        id: "shadcn-to-luna",
        title: "shadcn/ui -> luna",
        dir: "fixtures/migration/shadcn-to-luna",
        baseline: "before.html",
        blindTarget: "after-blind.html",
        reference: "after.html",
      },
    ]);
  });
});

describe("formatMigrationBlindScenarioMarkdown", () => {
  it("renders an operator-facing checklist", () => {
    const manifest = parseMigrationBlindManifest(`{
      "scenarios": [
        {
          "id": "shadcn-to-luna",
          "title": "shadcn/ui -> luna",
          "dir": "fixtures/migration/shadcn-to-luna",
          "baseline": "before.html",
          "blindTarget": "after-blind.html",
          "reference": "after.html",
          "successCriteria": { "maxDiffRatio": 0.01, "maxRounds": 3 }
        }
      ]
    }`);

    const scenario = selectMigrationBlindScenario(manifest, "shadcn-to-luna");
    assert.ok(scenario);

    const markdown = formatMigrationBlindScenarioMarkdown(scenario);
    assert.match(markdown, /shadcn\/ui -> luna/);
    assert.match(markdown, /after-blind\.html/);
    assert.match(markdown, /diff < 1\.0% within 3 rounds/i);
  });
});

describe("buildMigrationBlindCompareOptions", () => {
  it("builds a reproducible compare plan for the blind target", () => {
    const manifest = parseMigrationBlindManifest(`{
      "scenarios": [
        {
          "id": "shadcn-to-luna",
          "title": "shadcn/ui -> luna",
          "dir": "fixtures/migration/shadcn-to-luna",
          "baseline": "before.html",
          "blindTarget": "after-blind.html",
          "reference": "after.html",
          "successCriteria": { "maxDiffRatio": 0.01, "maxRounds": 3 }
        }
      ]
    }`);

    const scenario = selectMigrationBlindScenario(manifest, "shadcn-to-luna");
    assert.ok(scenario);

    const options = buildMigrationBlindCompareOptions(scenario, {
      outputDir: "test-results/migration/blind/shadcn-to-luna",
    });

    assert.equal(options.dir, "fixtures/migration/shadcn-to-luna");
    assert.equal(options.baseline, "before.html");
    assert.deepEqual(options.variants, ["after-blind.html"]);
    assert.equal(options.outputDir, "test-results/migration/blind/shadcn-to-luna");
    assert.equal(options.enablePaintTree, false);
    assert.equal(options.autoDiscover, true);
  });
});

describe("evaluateMigrationBlindSuccess", () => {
  it("passes when diff is under threshold within the round budget", () => {
    const manifest = parseMigrationBlindManifest(`{
      "scenarios": [
        {
          "id": "shadcn-to-luna",
          "title": "shadcn/ui -> luna",
          "dir": "fixtures/migration/shadcn-to-luna",
          "baseline": "before.html",
          "blindTarget": "after-blind.html",
          "reference": "after.html",
          "successCriteria": { "maxDiffRatio": 0.01, "maxRounds": 3 }
        }
      ]
    }`);
    const scenario = selectMigrationBlindScenario(manifest, "shadcn-to-luna");
    assert.ok(scenario);

    const summary = evaluateMigrationBlindSuccess({
      scenario,
      beforeReport: createReport([0.05, 0.03]),
      afterReport: createReport([0.008, 0.004]),
      roundsUsed: 2,
    });

    assert.equal(summary.passed, true);
    assert.equal(summary.withinDiffThreshold, true);
    assert.equal(summary.withinRoundBudget, true);
    assert.equal(summary.finalWorstDiffRatio, 0.008);
    assert.equal(summary.subagent.improvementRate, 1);
  });

  it("fails when the final diff or rounds miss the scenario contract", () => {
    const manifest = parseMigrationBlindManifest(`{
      "scenarios": [
        {
          "id": "shadcn-to-luna",
          "title": "shadcn/ui -> luna",
          "dir": "fixtures/migration/shadcn-to-luna",
          "baseline": "before.html",
          "blindTarget": "after-blind.html",
          "reference": "after.html",
          "successCriteria": { "maxDiffRatio": 0.01, "maxRounds": 3 }
        }
      ]
    }`);
    const scenario = selectMigrationBlindScenario(manifest, "shadcn-to-luna");
    assert.ok(scenario);

    const summary = evaluateMigrationBlindSuccess({
      scenario,
      beforeReport: createReport([0.05, 0.03]),
      afterReport: createReport([0.02, 0.012]),
      roundsUsed: 4,
    });

    assert.equal(summary.passed, false);
    assert.equal(summary.withinDiffThreshold, false);
    assert.equal(summary.withinRoundBudget, false);
    assert.match(summary.reasons.join("\n"), /1\.0%/);
    assert.match(summary.reasons.join("\n"), /3 rounds/);
  });
});

describe("evaluateMigrationBlindSoloResult", () => {
  it("checks the reference repair report against scenario diff criteria", () => {
    const manifest = parseMigrationBlindManifest(`{
      "scenarios": [
        {
          "id": "shadcn-to-luna",
          "title": "shadcn/ui -> luna",
          "dir": "fixtures/migration/shadcn-to-luna",
          "baseline": "before.html",
          "blindTarget": "after-blind.html",
          "reference": "after.html",
          "successCriteria": { "maxDiffRatio": 0.01, "maxRounds": 3 }
        }
      ]
    }`);
    const scenario = selectMigrationBlindScenario(manifest, "shadcn-to-luna");
    assert.ok(scenario);

    const pass = evaluateMigrationBlindSoloResult(scenario, createReport([0.008, 0.004]));
    const fail = evaluateMigrationBlindSoloResult(scenario, createReport([0.02, 0.004]));

    assert.equal(pass.passed, true);
    assert.equal(pass.finalWorstDiffRatio, 0.008);
    assert.equal(fail.passed, false);
    assert.match(fail.reasons[0] ?? "", /above/);
  });
});

describe("formatMigrationBlindSuccessMarkdown", () => {
  it("renders the scenario outcome and thresholds", () => {
    const manifest = parseMigrationBlindManifest(`{
      "scenarios": [
        {
          "id": "shadcn-to-luna",
          "title": "shadcn/ui -> luna",
          "dir": "fixtures/migration/shadcn-to-luna",
          "baseline": "before.html",
          "blindTarget": "after-blind.html",
          "reference": "after.html",
          "successCriteria": { "maxDiffRatio": 0.01, "maxRounds": 3 }
        }
      ]
    }`);
    const scenario = selectMigrationBlindScenario(manifest, "shadcn-to-luna");
    assert.ok(scenario);

    const markdown = formatMigrationBlindSuccessMarkdown(evaluateMigrationBlindSuccess({
      scenario,
      beforeReport: createReport([0.05, 0.03]),
      afterReport: createReport([0.008, 0.004]),
      roundsUsed: 2,
    }));

    assert.match(markdown, /Blind Scenario Evaluation/);
    assert.match(markdown, /shadcn\/ui -> luna/);
    assert.match(markdown, /0\.80%/);
    assert.match(markdown, /PASS/);
  });
});

describe("synthesizeMigrationBlindReferenceFix", () => {
  it("replaces the blind stylesheet with the reference stylesheet", () => {
    const blindHtml = `<!doctype html>
<html>
<head><style id="target-css">body { color: red; }</style></head>
<body><main class="luna-page">blind</main></body>
</html>`;
    const referenceHtml = `<!doctype html>
<html>
<head><style id="target-css">body { color: blue; }\n.luna-page { padding: 24px; }</style></head>
<body><main class="luna-page">reference</main></body>
</html>`;

    const repairedHtml = synthesizeMigrationBlindReferenceFix(blindHtml, referenceHtml);

    assert.equal(extractCss(repairedHtml), extractCss(referenceHtml));
    assert.match(repairedHtml, /<main class="luna-page">blind<\/main>/);
    assert.doesNotMatch(repairedHtml, /<main class="luna-page">reference<\/main>/);
  });
});
