import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeCopy, parseCopyManifest, normalizeWhitespace } from "./copy-check.ts";

test("normalizeWhitespace collapses runs and trims", () => {
  assert.equal(normalizeWhitespace("  Ship\n  dashboards\tin  minutes "), "Ship dashboards in minutes");
});

test("parseCopyManifest strips list markers, headings, and blank lines", () => {
  const lines = parseCopyManifest([
    "# Hero",
    "- Ship dashboards in minutes",
    "* Start free",
    "3. Third item",
    "",
    "Plain line",
  ].join("\n"));
  assert.deepEqual(lines, ["Hero", "Ship dashboards in minutes", "Start free", "Third item", "Plain line"]);
});

test("placeholder text is a suspect even without a manifest", () => {
  const report = analyzeCopy({ source: "x.html", pageText: "Welcome!\nLorem ipsum dolor sit amet." });
  assert.ok(report.placeholders.includes("lorem ipsum"));
  assert.ok(report.issues.every((i) => i.severity === "suspect"));
  assert.equal(report.manifestLines, 0);
});

test("manifest lines present in the page pass; missing ones are suspects", () => {
  const report = analyzeCopy({
    source: "x.html",
    pageText: "Pulse.\nShip   dashboards\nin minutes\nStart free",
    manifestLines: ["Ship dashboards in minutes", "Start free", "Changelog"],
  });
  assert.deepEqual(report.missingLines, ["Changelog"]);
  assert.equal(report.issues.filter((i) => i.kind === "copy-missing").length, 1);
});

test("manifest comparison is case-sensitive", () => {
  const report = analyzeCopy({
    source: "x.html",
    pageText: "start free",
    manifestLines: ["Start free"],
  });
  assert.deepEqual(report.missingLines, ["Start free"]);
});

test("clean page with satisfied manifest reports no issues", () => {
  const report = analyzeCopy({
    source: "x.html",
    pageText: "Ship dashboards in minutes. Start free.",
    manifestLines: ["Ship dashboards in minutes"],
  });
  assert.deepEqual(report.issues, []);
});
