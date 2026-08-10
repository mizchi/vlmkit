import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { healSelector } from "../heal/selector-heal.ts";
import {
  classifyHealTier,
  STRONG_HEAL_THRESHOLD,
  WEAK_HEAL_THRESHOLD,
} from "./selector-heal-calibration.ts";
import { withBrowser } from "@mizchi/vlmkit-core/browser-launch.ts";

type CalibrationCase = {
  fixture: string;
  brokenSelector: string;
  expectedSelector: string | null;
  actualSelector: string | null;
  confidence: number;
  label: "true-positive" | "false-positive" | "true-negative";
};

const corpusPath = fileURLToPath(new URL("../../../../docs/reports/data/2026-07-30-selector-heal-calibration.json", import.meta.url));

test("selector-heal calibration corpus has 20+ labeled real fixture cases", async () => {
  const corpus = JSON.parse(await readFile(corpusPath, "utf8")) as { cases: CalibrationCase[] };
  assert.ok(corpus.cases.length >= 20);

  return await withBrowser(async (browser) => {
    const page = await browser.newPage();
    for (const entry of corpus.cases) {
      await page.goto(`file://${fileURLToPath(new URL(`../../../../fixtures/interact/${entry.fixture}`, import.meta.url))}`);
      const actual = (await healSelector(page, entry.brokenSelector, { maxCandidates: 1 }))[0];
      assert.equal(actual?.selector ?? null, entry.actualSelector, entry.brokenSelector);
      assert.ok(Math.abs((actual?.confidence ?? 0) - entry.confidence) < 1e-9, entry.brokenSelector);
      assert.equal(entry.actualSelector === entry.expectedSelector, entry.label !== "false-positive", entry.brokenSelector);
    }
    await page.close();
  });
});

test("calibrated tiers suppress the measured 10-13% noise and keep strong precision", () => {
  assert.equal(STRONG_HEAL_THRESHOLD, 0.4);
  assert.equal(WEAK_HEAL_THRESHOLD, 0.15);
  assert.equal(classifyHealTier(0.4), "strong");
  assert.equal(classifyHealTier(0.325), "weak"); // wrong sibling in corpus
  assert.equal(classifyHealTier(0.125), "none");
});
