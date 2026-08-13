import assert from "node:assert/strict";
import { test } from "vitest";
import {
  buildOfflineGeneratedTest,
  buildOfflineLocatorInventory,
  buildOfflineStructuredPlan,
  renderOfflinePlanMarkdown,
} from "./run-offline-fixtures.mjs";

test("offline structured plan is a single smoke scenario with observed locators", () => {
  const plan = buildOfflineStructuredPlan();

  assert.equal(plan.scenarios.length, 1);
  assert.match(plan.scenarios[0]?.title ?? "", /Blocked filter/);
  assert.deepEqual(plan.locatorInventory?.testIds?.includes("release-row-invoice-export"), true);
  assert.equal(plan.locatorInventory?.roles?.some((role) => role.includes("Open Invoice Export details")), true);
});

test("offline markdown keeps the planner contract shape", () => {
  const markdown = renderOfflinePlanMarkdown();

  assert.match(markdown, /^# Release Queue VRT Smoke/m);
  assert.equal((markdown.match(/^### /gm) ?? []).length, 1);
  assert.match(markdown, /## Generation Notes/);
  assert.match(markdown, /release-row-invoice-export/);
});

test("offline locator inventory mirrors observed UI facts", () => {
  const locators = buildOfflineLocatorInventory();

  assert.deepEqual(locators.labels, ["Search releases"]);
  assert.equal(locators.roles?.length, 8);
  assert.equal(locators.testIds?.length, 7);
});

test("offline generated test satisfies the dogfood quality gates", () => {
  const source = buildOfflineGeneratedTest("../../../examples/markup-vrt-eval/support/goto-app");

  assert.match(source, /import \{ gotoApp \}/);
  assert.doesNotMatch(source, /page\.goto\(/);
  assert.doesNotMatch(source, /fullPage/);
  assert.equal((source.match(/toHaveScreenshot/g) ?? []).length, 2);
  assert.match(source, /getByTestId\("release-row-invoice-export"\)/);
  assert.equal(source.split(/\r?\n/).filter((line) => line.trim().startsWith("//")).length, 0);
});
