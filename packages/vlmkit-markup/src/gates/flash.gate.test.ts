import assert from "node:assert/strict";
import { describe, it } from "vite-plus/test";
import { UsageError } from "@mizchi/vlmkit-core/cli-error.ts";
import { flashGate } from "./flash.gate.ts";
import type { FlashReport, FlashTrackReport } from "../inspect/flash-check.ts";

const ctx = { cwd: process.cwd(), argv: [], json: false };
const parse = (argv: string[]) => flashGate.parse(argv, ctx);
const findingsOf = (r: FlashReport) => flashGate.findings(r, { source: "p.html" });

describe("check flash: arguments", () => {
  it("takes a page and its window in any time form", () => {
    assert.deepEqual(parse(["page.html", "--window", "2.5s"]), { source: "page.html", windowMs: 2500 });
    assert.deepEqual(parse(["--window", "4000", "page.html"]), { source: "page.html", windowMs: 4000 });
    assert.deepEqual(parse(["--frames", "out/f", "page.html", "--strip", "s.png"]), {
      source: "page.html",
      framesDir: "out/f",
      stripPath: "s.png",
    });
  });

  it("does not read a flag's value as the page", () => {
    assert.equal(parse(["--timeout", "5000", "page.html"]).source, "page.html");
    assert.equal(parse(["--har", "x.har", "page.html"]).source, "page.html");
  });

  it("refuses a window that is not one span", () => {
    assert.throws(() => parse(["page.html", "--window", "0,1s"]), UsageError);
    assert.throws(() => parse(["page.html", "--window", "0"]), UsageError);
  });

  it("refuses a window under a second (no failure fits in it) and over a minute", () => {
    assert.throws(() => parse(["page.html", "--window", "999"]), /1s to 60s/);
    assert.throws(() => parse(["page.html", "--window", "61s"]), /1s to 60s/);
    assert.equal(parse(["page.html", "--window", "1s"]).windowMs, 1000);
  });

  it("refuses an empty viewport (a 0-wide page is never shot)", () => {
    assert.throws(() => parse(["page.html", "--viewport", "0x300"]), /at least 1x1/);
  });

  it("judges a frames.json as it was captured: no page flags", () => {
    assert.deepEqual(parse(["out/frames.json"]), { source: "out/frames.json" });
    assert.throws(() => parse(["out/frames.json", "--window", "3s"]), UsageError);
    assert.throws(() => parse(["out/frames.json", "--viewport", "800x600"]), UsageError);
  });
});

const track = (over: Partial<FlashTrackReport>): FlashTrackReport => ({
  verdict: "pass",
  worst: null,
  peakTransitions: 0,
  largestBelowCss2: 0,
  withUnknownCss2: 0,
  failingWindows: 0,
  runs: 0,
  ...over,
});
const worst = {
  fromMs: 0,
  toMs: 1000,
  frame: 60,
  transitions: 8,
  flashesPerSecond: 4,
  areaCss2: 87_296,
  fieldShare: 1,
  field: { x: 0, y: 0, width: 341, height: 256 },
  bbox: { x: 0, y: 0, width: 341, height: 256 },
  frames: [8, 15, 23, 30, 38, 45, 53, 60],
  knifeEdge: false,
};
const report = (over: Partial<FlashReport>): FlashReport =>
  ({
    format: "vlmkit-flash/1",
    source: { kind: "page", path: "p.html", viewport: { width: 400, height: 300 }, cssPerPx: 1, clock: "held" },
    criteria: { areaLimitCss2: 21_824 },
    sampling: {
      frames: 91,
      spanMs: 1500,
      maxGapMs: 1000 / 60,
      complete: true,
      judgeable: true,
      still: false,
      windowMs: 1500,
      windowFrom: "option",
      truncated: false,
      unstableFrames: 0,
      navigations: 0,
    },
    general: track({}),
    red: track({}),
    unmeasured: [],
    unmeasuredAreaCss2: 0,
    timingMs: { capture: 0, judge: 0, classify: 0 },
    ...over,
  }) as FlashReport;

describe("check flash: findings", () => {
  it("a flash is a suspect, motion flicker a warn, and each names its window and field", () => {
    const fail = findingsOf(report({ general: track({ verdict: "fail", classification: "flash", worst }) }));
    assert.deepEqual(
      fail.map((f) => [f.rule, f.severity]),
      [["general-flash", "suspect"]],
    );
    assert.match(
      fail[0]!.message,
      /8 transitions \(4\.0 flashes\) in 0\.000–1\.000s over 87,296 CSS px², 100% of the 341x256 field/,
    );
    const motion = findingsOf(
      report({
        general: track({
          classification: "motion",
          worst,
          motion: [
            {
              fromMs: 0,
              toMs: 1000,
              region: worst.field,
              fieldTransitions: 0,
              residualArea: 0,
              explainedShare: 0.96,
              velocity: { x: -300, y: 0 },
            },
          ],
        }),
      }),
    );
    assert.deepEqual(
      motion.map((f) => [f.rule, f.severity]),
      [["motion-flicker", "warn"]],
    );
    assert.match(motion[0]!.message, /moving 300 px\/s/);
  });

  it("what cannot be measured is a suspect over the limit, info under it", () => {
    const big = findingsOf(
      report({
        unmeasured: [{ reason: "video", rect: { x: 0, y: 0, width: 400, height: 300 }, path: "video" }],
        unmeasuredAreaCss2: 87_296,
      }),
    );
    assert.deepEqual(
      big.map((f) => [f.rule, f.severity, f.selector]),
      [["flash-unmeasured", "suspect", "video"]],
    );
    const small = findingsOf(
      report({
        unmeasured: [{ reason: "animated-image", rect: { x: 0, y: 0, width: 32, height: 32 } }],
        unmeasuredAreaCss2: 1024,
      }),
    );
    assert.deepEqual(
      small.map((f) => [f.rule, f.severity]),
      [["flash-unmeasured", "info"]],
    );
  });

  it("a sequence that cannot hold 7 frames a second is unjudgeable; a pass on a gappy one is undersampled", () => {
    const sparse = findingsOf(report({ sampling: { ...report({}).sampling, judgeable: false, complete: false } }));
    assert.deepEqual(
      sparse.map((f) => f.rule),
      ["flash-unjudgeable"],
    );
    const gappy = findingsOf(report({ sampling: { ...report({}).sampling, complete: false, maxGapMs: 50 } }));
    assert.deepEqual(
      gappy.map((f) => f.rule),
      ["flash-undersampled"],
    );
    const cut = findingsOf(report({ sampling: { ...report({}).sampling, truncated: true, windowMs: 10_000 } }));
    assert.deepEqual(
      cut.map((f) => f.rule),
      ["flash-undersampled"],
    );
    assert.match(cut[0]!.message, /first 10\.0s only/);
  });

  it("names an element only when it covers half the flashing pixels' box", () => {
    const named = (cover: number) =>
      findingsOf(
        report({
          general: track({
            verdict: "fail",
            classification: "flash",
            worst,
            animations: [
              { path: "div#strobe", name: "k", properties: ["background"], cover },
              { path: "div#spinner", name: "spin", properties: ["transform"], cover: 0.02 },
            ],
          }),
        }),
      )[0]!.selector;
    assert.equal(named(0.9), "div#strobe");
    assert.equal(named(0.3), undefined, "a bystander in the field is not the finding");
  });

  it("an image whose bytes could not be read is reported as one that may animate", () => {
    const f = findingsOf(
      report({ unmeasured: [{ reason: "unreadable-image", rect: { x: 0, y: 0, width: 32, height: 32 } }] }),
    );
    assert.match(f[0]!.message, /could not be read \(it may animate\)/);
  });
});
