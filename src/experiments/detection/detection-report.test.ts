import assert from "node:assert/strict";
import { afterAll, beforeAll, describe, it } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runDetectionReport } from "./detection-report.ts";
import type { DetectionRecord } from "./detection-db.ts";
import type { BenchHistoryRecord } from "../benchmark/bench-history.ts";

/**
 * `vlmkit report` against fixture data.
 *
 * This was 203 statements at 0% coverage for two compounding reasons: the module
 * ran its command on import, and the runner read the developer's own
 * `data/detection-patterns.jsonl` with no way to say otherwise. Both readers
 * already accepted a path; the runner simply never passed one through.
 *
 * With both as parameters the report is checkable against data chosen for the
 * test, which is the only way an aggregate report can be asserted on at all — the
 * numbers are meaningless unless you know what went in.
 */

const dir = mkdtempSync(join(tmpdir(), "vlmkit-detection-report-"));

const viewport = (over: Record<string, unknown> = {}) => ({
  width: 1280,
  height: 900,
  visualDiffDetected: false,
  visualDiffRatio: 0,
  a11yDiffDetected: false,
  a11yChangeCount: 0,
  computedStyleDiffCount: 0,
  hoverDiffDetected: false,
  paintTreeDiffCount: 0,
  ...over,
});

const record = (over: Partial<DetectionRecord> = {}): DetectionRecord => ({
  runId: "2026-08-14T00:00:00.000Z",
  fixture: "page",
  backend: "chromium",
  selector: ".hero",
  property: "padding",
  value: "32px",
  category: "spacing",
  selectorType: "class",
  isInteractive: false,
  mediaCondition: null,
  viewports: [viewport({ visualDiffDetected: true, visualDiffRatio: 0.04 })],
  detected: true,
  undetectedReason: null,
  ...over,
} as DetectionRecord);

const history = (over: Partial<BenchHistoryRecord> = {}): BenchHistoryRecord => ({
  runId: "2026-08-14T00:00:00.000Z",
  fixture: "page",
  backend: "chromium",
  trials: 10,
  startSeed: 1,
  elapsedMs: 12_000,
  avgMsPerTrial: 1_200,
  llmEnabled: false,
  strict: false,
  suggestApproval: false,
  visualDetected: 7,
  computedDetected: 9,
  hoverDetected: 1,
  paintTreeDetected: 2,
  a11yDetected: 3,
  eitherDetected: 9,
  neitherDetected: 1,
  detectionRate: 0.9,
  metadataOnly: null,
  prescanner: null,
  ...over,
} as BenchHistoryRecord);

function jsonl(name: string, rows: unknown[]): string {
  const file = join(dir, name);
  writeFileSync(file, rows.map((r) => JSON.stringify(r)).join("\n") + (rows.length ? "\n" : ""));
  return file;
}

/** The report writes to stdout; capture it to assert on what a reader sees. */
let lines: string[] = [];
const realLog = console.log;
beforeAll(() => {
  console.log = (...args: unknown[]) => { lines.push(args.map(String).join(" ")); };
});
afterAll(() => { console.log = realLog; });

const output = () => lines.join("\n").replace(/\[[0-9;]*m/g, "");

describe("runDetectionReport", () => {
  it("says there is no data rather than rendering an empty report", async () => {
    lines = [];
    await runDetectionReport({ dbPath: jsonl("empty.jsonl", []), historyPath: jsonl("empty-h.jsonl", []) });
    assert.match(output(), /No data found/);
  });

  it("renders detection counts from the records it was given", async () => {
    lines = [];
    await runDetectionReport({
      dbPath: jsonl("some.jsonl", [
        record(),
        record({ selector: ".card", property: "border-radius", detected: false, undetectedReason: "hover-only", viewports: [viewport()] }),
        record({ fixture: "dashboard", selector: "nav a", property: "color" }),
      ]),
      historyPath: jsonl("some-h.jsonl", [history()]),
    });
    const text = output();
    assert.doesNotMatch(text, /No data found/);
    // Three records went in, so the report has to account for three.
    assert.match(text, /3/, "the record count reaches the output");
    // Both fixtures are named, since a rate averaged across fixtures hides which
    // one is failing.
    assert.match(text, /page/);
    assert.match(text, /dashboard/);
  });

  it("renders bench history even with no per-property records", async () => {
    // The two data sources are independent: a run that recorded history but no
    // per-property detail must still produce a report rather than "no data".
    lines = [];
    await runDetectionReport({
      dbPath: jsonl("none.jsonl", []),
      historyPath: jsonl("hist-only.jsonl", [history(), history({ runId: "2026-08-14T01:00:00.000Z", detectionRate: 0.95 })]),
    });
    const text = output();
    assert.doesNotMatch(text, /No data found/);
    assert.ok(text.length > 0);
  });

  it("survives a malformed line instead of failing the whole report", async () => {
    // A JSONL history is appended to by long-running benches; a truncated final
    // line is the normal way it breaks, and losing every prior run to it would be
    // the wrong trade.
    const file = join(dir, "broken.jsonl");
    writeFileSync(file, `${JSON.stringify(record())}\n{"runId": "truncated`);
    lines = [];
    await runDetectionReport({ dbPath: file, historyPath: jsonl("broken-h.jsonl", []) });
    assert.doesNotMatch(output(), /No data found/, "the intact record still counts");
  });
});
