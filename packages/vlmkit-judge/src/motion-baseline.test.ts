import assert from "node:assert/strict";
import { describe, it } from "vite-plus/test";
import {
  compareMotionBaseline,
  MOTION_BASELINE_FORMAT,
  parseMotionBaseline,
  type MotionBaselineTarget,
} from "./motion-baseline.ts";

const menu: MotionBaselineTarget = {
  target: ".menu",
  startsAtMs: 0,
  durationMs: 250,
  iterations: 1,
  travelPx: 0,
  easing: { name: "ease-out", margin: 8 },
  origin: { fx: 0.5, fy: 0, name: "top" },
  rest: { x: 640, y: 200 },
};

describe("compareMotionBaseline: what changed since the approved run", () => {
  it("names nothing within the tolerances", () => {
    const now = { ...menu, durationMs: 260, rest: { x: 641, y: 201 }, origin: { fx: 0.52, fy: 0.01, name: "top" } };
    assert.deepEqual(compareMotionBaseline([menu], [now]), []);
  });

  it("names each change past its tolerance, as a phrase", () => {
    const now: MotionBaselineTarget = {
      ...menu,
      durationMs: 400,
      easing: { name: "linear", margin: 40 },
      origin: { fx: 0.5, fy: 0.5, name: "center" },
      rest: { x: 640, y: 230 },
    };
    assert.deepEqual(compareMotionBaseline([menu], [now]), [
      {
        target: ".menu",
        changes: [
          "runs 250ms → 400ms",
          "follows ease-out → linear",
          "scales about top → center",
          "rests at (640,200) → (640,230)",
        ],
      },
    ]);
  });

  it("holds an easing only when both runs name it clearly", () => {
    const vague = { ...menu, easing: { name: "ease", margin: 1.2 } };
    assert.deepEqual(compareMotionBaseline([menu], [vague]), []);
  });

  it("names a direction, a turn, a count and a travel", () => {
    const was: MotionBaselineTarget = { target: "a", travelPx: 600, direction: "right", turnDeg: 0, iterations: 1 };
    const now: MotionBaselineTarget = { target: "a", travelPx: 400, direction: "left", turnDeg: 90, iterations: null };
    assert.deepEqual(compareMotionBaseline([was], [now])[0]!.changes, [
      "runs x1 → forever",
      "travels 600px → 400px",
      "moves right → left",
      "turns 0° → 90°",
    ]);
  });

  it("names a target added or gone", () => {
    const out = compareMotionBaseline([menu], [{ target: ".toast", travelPx: 0 }]);
    assert.deepEqual(
      out.map((c) => [c.target, c.changes[0]!.split(":")[0]]),
      [
        [".toast", "not in the baseline"],
        [".menu", "in the baseline, not measured in this run"],
      ],
    );
  });

  it("reads its own format and refuses another", () => {
    const text = JSON.stringify({ format: MOTION_BASELINE_FORMAT, source: "p.html", expected: [], targets: [menu] });
    assert.equal(parseMotionBaseline(text, "b.json").targets[0]!.target, ".menu");
    assert.throws(() => parseMotionBaseline("{}", "b.json"), /not a motion baseline/);
    assert.throws(() => parseMotionBaseline("nope", "b.json"), /not JSON/);
  });
});
