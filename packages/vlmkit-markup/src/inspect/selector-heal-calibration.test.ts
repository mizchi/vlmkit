import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";
import { chromium } from "playwright";
import { healSelector } from "../heal/selector-heal.ts";
import {
  classifyHealTier,
  STRONG_HEAL_THRESHOLD,
  WEAK_HEAL_THRESHOLD,
} from "./selector-heal-calibration.ts";

type CalibrationCase = {
  fixture: string;
  brokenSelector: string;
  expectedSelector: string | null;
  actualSelector: string | null;
  confidence: number;
  label: "true-positive" | "false-positive" | "true-negative";
};

const root = resolve(process.cwd(), "../..");
const corpusPath = resolve(root, "docs/reports/data/2026-07-30-selector-heal-calibration.json");

test("selector-heal calibration corpus has 20+ labeled real fixture cases", async () => {
  const corpus = JSON.parse(await readFile(corpusPath, "utf8")) as { cases: CalibrationCase[] };
  assert.ok(corpus.cases.length >= 20);

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    for (const entry of corpus.cases) {
      await page.goto(`file://${resolve(root, "fixtures/interact", entry.fixture)}`);
      const actual = (await healSelector(page, entry.brokenSelector, { maxCandidates: 1 }))[0];
      assert.equal(actual?.selector ?? null, entry.actualSelector, entry.brokenSelector);
      assert.ok(Math.abs((actual?.confidence ?? 0) - entry.confidence) < 1e-9, entry.brokenSelector);
      assert.equal(entry.actualSelector === entry.expectedSelector, entry.label !== "false-positive", entry.brokenSelector);
    }
    await page.close();
  } finally {
    await browser.close();
  }
});

test("calibrated tiers suppress the measured 10-13% noise and keep strong precision", () => {
  assert.equal(STRONG_HEAL_THRESHOLD, 0.4);
  assert.equal(WEAK_HEAL_THRESHOLD, 0.15);
  assert.equal(classifyHealTier(0.4), "strong");
  assert.equal(classifyHealTier(0.325), "weak"); // wrong sibling in corpus
  assert.equal(classifyHealTier(0.125), "none");
});
