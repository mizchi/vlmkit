import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, it } from "vitest";
import type { Browser } from "playwright";
import { launchBrowser } from "@mizchi/vlmkit-core/browser-launch.ts";
import { buildCases, caseSeed, type BuiltCase } from "./cases.ts";
import { oracleReply } from "./score.ts";
import { comparisons, report, selfCheck, type SavedAnswer } from "./zoom-accuracy.ts";

const FIXTURES = ["page.html", "dashboard.html"].map((f) => resolve("fixtures/css-challenge", f));

describe("zoom accuracy cases, built from real renders", () => {
  let browser: Browser;
  let dir: string;
  let cases: BuiltCase[];

  beforeAll(async () => {
    browser = await launchBrowser();
    dir = await mkdtemp(join(tmpdir(), "zoom-accuracy-"));
    ({ cases } = await buildCases(browser, {
      fixtures: FIXTURES, kinds: ["text", "color", "offset", "none"], seed: 1, deviceScaleFactor: 2, viewportWidth: 1440, outDir: dir,
    }));
  }, 120_000);
  afterAll(async () => {
    await browser?.close();
    if (dir) await rm(dir, { recursive: true, force: true });
  });

  it("plants one change per kind per fixture, each a small patch of the page", () => {
    assert.equal(cases.length, 8);
    for (const c of cases) {
      if (c.expected.kind === "none") { assert.equal(c.diffBox, null, c.id); continue; }
      const d = c.diffBox!;
      const share = ((d.x2 - d.x1) * (d.y2 - d.y1)) / (c.page.width * c.page.height);
      assert.ok(share > 0 && share < 0.01, `${c.id}: the change covers ${(share * 100).toFixed(3)}% of the page`);
    }
  });

  it("the pixels that changed are where the planted element was", () => {
    for (const c of cases) {
      if (!c.targetBox || !c.diffBox) continue;
      const t = c.targetBox, d = c.diffBox, slack = 8;
      const overlaps = d.x1 < t.x2 + slack && d.x2 > t.x1 - slack && d.y1 < t.y2 + slack && d.y2 > t.y1 - slack;
      assert.ok(overlaps, `${c.id}: diff ${JSON.stringify(d)} is not at target ${JSON.stringify(t)}`);
    }
  });

  it("text cases change exactly one digit, inside the token the scorer reads", () => {
    for (const c of cases) {
      if (c.expected.kind !== "text") continue;
      const { oldText, newText, oldToken, newToken } = c.expected;
      assert.equal(oldText.length, newText.length);
      assert.equal([...oldText].filter((ch, i) => ch !== newText[i]).length, 1, c.id);
      assert.notEqual(oldToken, newToken);
      assert.ok(newText.includes(newToken) && oldText.includes(oldToken));
    }
  });

  it("the self-check holds: the oracle scores every case, an always-unchanged reader only the none cases", () => {
    assert.deepEqual(selfCheck(cases), { oracle: 8, blind: 2, none: 2 });
  });

  it("scores saved answers per arm and pairs the two arms on the same cases", () => {
    const answer = (arm: "single" | "zoom", c: BuiltCase, text: string): SavedAnswer => ({
      model: "m", arm, caseId: c.id, answer: text, promptTokens: 0, completionTokens: 0, costUsd: 0, latencyMs: 0, zooms: arm === "zoom" ? 1 : 0, turns: 1,
    });
    const blind = JSON.stringify({ changed: false });
    const answers = [
      ...cases.map((c) => answer("single", c, blind)),
      ...cases.map((c) => answer("zoom", c, oracleReply(c))),
    ];
    const reports = report(cases, answers);
    assert.deepEqual(reports.map((r) => [r.arm, r.summary.correct]), [["single", 2], ["zoom", 8]]);
    const [comp] = comparisons(reports);
    assert.deepEqual([comp!.fixed, comp!.broke, comp!.bothRight], [6, 0, 2]);
    assert.ok(comp!.p < 0.05);
  });

  it("the seed per case depends only on the seed and the case id", () => {
    assert.equal(caseSeed(1, "page-text"), caseSeed(1, "page-text"));
    assert.notEqual(caseSeed(1, "page-text"), caseSeed(2, "page-text"));
    assert.notEqual(caseSeed(1, "page-text"), caseSeed(1, "page-color"));
  });
});
