/**
 * `vlmkit check mobile` (issue #219) on fixtures/mobile/: the intact phone page is silent, and
 * each mutant is named by the one rule its defect is about.
 */
import assert from "node:assert/strict";
import { join } from "node:path";
import { describe, it } from "vite-plus/test";
import { runMobileCheck } from "./mobile-check.ts";

const dir = join(import.meta.dirname, "../../../../fixtures/mobile");
const rulesOf = async (name: string) => {
  const r = await runMobileCheck({ source: join(dir, `${name}.html`) });
  return { r, rules: r.findings.map((f) => f.rule) };
};
const T = { timeout: 120_000 };

describe("check mobile on fixtures/mobile", () => {
  it(
    "the intact page: zoom allowed, the carousel snaps, the composer follows the keyboard, the header clears the notch",
    T,
    async () => {
      const { r } = await rulesOf("intact");
      assert.deepEqual(r.findings, [], JSON.stringify(r.findings, null, 2));
      assert.equal(r.carousels.length, 1);
      assert.equal(r.carousels[0]!.aligned, true);
      assert.ok(r.carousels[0]!.landedAt > 300, `the swipe moved it: ${r.carousels[0]!.landedAt}`);
      assert.equal(r.inputs.length, 1);
      assert.ok(r.safeArea);
    },
  );
  for (const [name, rule] of [
    ["zoom-disabled", "zoom-disabled"],
    ["carousel-unsnapped", "swipe-unsnapped"],
    ["keyboard-covered", "keyboard-covers-input"],
    ["notch-overlap", "safe-area-overlap"],
  ] as const)
    it(`${name}: ${rule} and nothing else`, T, async () => {
      const { r, rules } = await rulesOf(name);
      assert.ok(rules.length > 0, JSON.stringify(r, null, 2));
      assert.deepEqual([...new Set(rules)], [rule], JSON.stringify(r.findings, null, 2));
    });
});
