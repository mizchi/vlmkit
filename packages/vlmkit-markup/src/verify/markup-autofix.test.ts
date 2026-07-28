import assert from "node:assert";
import { test } from "node:test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyFixBlock,
  extractKickbackSelectors,
  extractStyleText,
  parseFixProposals,
  removeFixBlock,
  runMarkupAutofix,
  serializeFixBlock,
  type FixProposal,
} from "./markup-autofix.ts";

// ---------------------------------------------------------------------------
// parseFixProposals

test("parseFixProposals: bare array", () => {
  const fixes = parseFixProposals('[{"selector": ".hero", "declarations": {"background": "#0b1220"}}]');
  assert.equal(fixes.length, 1);
  assert.equal(fixes[0]!.selector, ".hero");
  assert.equal(fixes[0]!.declarations["background"], "#0b1220");
});

test("parseFixProposals: fixes wrapper inside a json fence with prose around it", () => {
  const text = 'Sure! Here is the fix:\n```json\n{"fixes": [{"selector": ".footer", "declarations": {"padding-top": "22px"}, "note": "gap"}]}\n```\nGood luck!';
  const fixes = parseFixProposals(text);
  assert.equal(fixes.length, 1);
  assert.equal(fixes[0]!.note, "gap");
});

test("parseFixProposals: numbers coerce, junk entries drop, garbage yields []", () => {
  const fixes = parseFixProposals('[{"selector": ".a", "declarations": {"z-index": 5}}, {"selector": "", "declarations": {"x": "1"}}, {"nope": true}]');
  assert.equal(fixes.length, 1);
  assert.equal(fixes[0]!.declarations["z-index"], "5");
  assert.deepEqual(parseFixProposals("I cannot help with that."), []);
  assert.deepEqual(parseFixProposals("[]"), []);
});

// ---------------------------------------------------------------------------
// apply / rollback

test("applyFixBlock inserts before </head> and removeFixBlock restores the original", () => {
  const html = "<!doctype html><html><head><style>.a{color:red}</style></head><body><p>x</p></body></html>";
  const fixes: FixProposal[] = [{ selector: ".a", declarations: { color: "blue", "margin-top": "4px" } }];
  const patched = applyFixBlock(html, fixes, 1);
  assert.match(patched, /<style data-vlmkit-autofix="1">[\s\S]*\.a \{\n {2}color: blue;\n {2}margin-top: 4px;\n\}[\s\S]*<\/style>\n<\/head>/);
  assert.equal(removeFixBlock(patched, 1), html);
});

test("serializeFixBlock neutralizes style-closing and markup injection in values", () => {
  const block = serializeFixBlock(
    [{ selector: ".x</style><script>", declarations: { background: "url(a)</style><b>" } }],
    2,
  );
  assert.doesNotMatch(block.slice("<style ".length), /<\/style>(?![\s]*$)/i);
  assert.doesNotMatch(block, /<script>/);
});

test("stacked blocks from different rounds remove independently", () => {
  const html = "<html><head></head><body></body></html>";
  const r1 = applyFixBlock(html, [{ selector: ".a", declarations: { color: "red" } }], 1);
  const r2 = applyFixBlock(r1, [{ selector: ".b", declarations: { color: "blue" } }], 2);
  const without2 = removeFixBlock(r2, 2);
  assert.match(without2, /data-vlmkit-autofix="1"/);
  assert.doesNotMatch(without2, /data-vlmkit-autofix="2"/);
});

// ---------------------------------------------------------------------------
// context helpers

test("extractKickbackSelectors pulls attributed selectors in order, deduped", () => {
  const kickback = [
    "desktop: ROOT-CAUSE CANDIDATE — matched #6 ... [rendered by `.fab`]",
    "desktop: missing #5 ... [target box falls in your `.container`]",
    "desktop: gap #6 -> #0 ... [the gap sits above `.footer`]",
    "desktop: matched #1 IoU 0.891 ... [rendered by `.fab`]",
    "desktop: rendered page height 1228px vs target 1187px",
  ];
  assert.deepEqual(extractKickbackSelectors(kickback), [".fab", ".container", ".footer"]);
});

test("extractStyleText joins stylesheet text but skips autofix blocks", () => {
  const html = '<head><style>.a{}</style><style data-vlmkit-autofix="1">.b{}</style><style>.c{}</style></head>';
  const css = extractStyleText(html);
  assert.match(css, /\.a\{\}/);
  assert.match(css, /\.c\{\}/);
  assert.doesNotMatch(css, /\.b\{\}/);
});

// ---------------------------------------------------------------------------
// E2E with a fake LLM (Playwright; the edit fixture is small and fast).
// A known single-property defect is injected into the DONE-verified
// redesign page; the fake proposer returns the exact repair. This proves
// the whole loop — context pack, apply, verify, gate — without an API key.

const REPO_ROOT = fileURLToPath(new URL("../../../..", import.meta.url));
const FIXTURE = join(REPO_ROOT, "fixtures/auto-markup-proof/edit/redesign.html");
const TARGET = join(REPO_ROOT, "fixtures/auto-markup-proof/edit/target-desktop.png");

function brokenCopy(dir: string): string {
  const src = readFileSync(FIXTURE, "utf8");
  assert.match(src, /\.hero \{ height: 260px; background: #0b1220;/);
  const broken = src.replace(
    ".hero { height: 260px; background: #0b1220;",
    ".hero { height: 260px; background: #f1f5f9;",
  );
  const file = join(dir, "attempt.html");
  writeFileSync(file, broken);
  return file;
}

test("E2E: fake LLM repairs an injected defect and the loop reaches DONE", { timeout: 300_000 }, async () => {
  const dir = mkdtempSync(join(tmpdir(), "autofix-"));
  const attempt = brokenCopy(dir);
  const seen: string[][] = [];
  const report = await runMarkupAutofix({
    attempt,
    targets: [TARGET],
    maxRounds: 2,
    propose: async (context) => {
      seen.push(context.kickback);
      return [{ selector: ".hero", declarations: { background: "#0b1220" }, note: "restore dark hero" }];
    },
  });
  assert.equal(report.done, true);
  assert.equal(report.stopReason, "done");
  assert.equal(report.rounds.length, 1);
  assert.equal(report.rounds[0]!.outcome, "accepted");
  // The context pack carried the residuals and the attempt CSS.
  assert.ok(seen[0]!.length > 0);
  // The original attempt is untouched; the working copy has the block.
  assert.doesNotMatch(readFileSync(attempt, "utf8"), /data-vlmkit-autofix/);
  assert.match(readFileSync(report.workingFile, "utf8"), /data-vlmkit-autofix="1"/);
});

test("E2E: a destructive proposal is rolled back and the loop stops after two rollbacks", { timeout: 300_000 }, async () => {
  const dir = mkdtempSync(join(tmpdir(), "autofix-"));
  const attempt = brokenCopy(dir);
  const before = readFileSync(attempt, "utf8");
  const report = await runMarkupAutofix({
    attempt,
    targets: [TARGET],
    maxRounds: 4,
    propose: async () => [{ selector: "body", declarations: { display: "none" }, note: "over-correction" }],
  });
  assert.equal(report.done, false);
  assert.equal(report.stopReason, "consecutive-rollbacks");
  assert.equal(report.rounds.length, 2);
  assert.ok(report.rounds.every((r) => r.outcome === "rolled-back"));
  // Rollback restored the working copy to the (still broken) input.
  assert.equal(readFileSync(report.workingFile, "utf8"), before);
});

test("E2E: --in-place patches the attempt file itself", { timeout: 300_000 }, async () => {
  const dir = mkdtempSync(join(tmpdir(), "autofix-"));
  const attempt = brokenCopy(dir);
  const report = await runMarkupAutofix({
    attempt,
    targets: [TARGET],
    maxRounds: 1,
    inPlace: true,
    propose: async () => [{ selector: ".hero", declarations: { background: "#0b1220" } }],
  });
  assert.equal(report.workingFile, attempt);
  assert.equal(report.done, true);
  assert.match(readFileSync(attempt, "utf8"), /data-vlmkit-autofix="1"/);
});
