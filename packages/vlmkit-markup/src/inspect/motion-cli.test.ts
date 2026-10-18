import assert from "node:assert/strict";
import { describe, it } from "vite-plus/test";
import {
  DEFAULT_MOTION_FORBID,
  motionInstants,
  motionPlan,
  MotionUsageError,
  parseMotionArgs,
  runMotionCli,
} from "./motion-cli.ts";

describe("inspect motion arguments", () => {
  it("reads targets, statements, the easing and the default forbid", () => {
    const o = parseMotionArgs(["page.html", "--target", "the blue square", "--expect-easing", "ease-out", "--exits"]);
    assert.deepEqual(o.targets, ["the blue square"]);
    assert.deepEqual(o.forbid, [DEFAULT_MOTION_FORBID]);
    assert.deepEqual(o.expectEasing, ["ease-out"]);
    assert.deepEqual(parseMotionArgs(["p.html", "--target", "x", "--expect-easing", "ease-out,ease-in"]).expectEasing, [
      "ease-out",
      "ease-in",
    ]);
    assert.equal(o.exits, true);
    assert.deepEqual(parseMotionArgs(["page.html", "--target", "x", "--forbid", "a spinner"]).forbid, ["a spinner"]);
    assert.deepEqual(parseMotionArgs(["page.html", "--target", "x", "--no-forbid"]).forbid, []);
  });

  it("pairs each --selector with the --target in its position", () => {
    const o = parseMotionArgs(["p.html", "--target", "a", "--selector", ".a", "--target", "b"]);
    assert.deepEqual([o.targets, o.selectors], [["a", "b"], [".a"]]);
    assert.throws(
      () => parseMotionArgs(["p.html", "--target", "a", "--selector", ".a", "--selector", ".b"]),
      MotionUsageError,
    );
    assert.throws(
      () => parseMotionArgs(["f/frames.json", "--target", "a", "--selector", ".a", "--end", "500"]),
      MotionUsageError,
    );
  });

  it("refuses what cannot be checked", () => {
    const bad: string[][] = [
      ["page.html", "--no-forbid"],
      ["page.html", "--expect-easing", "bouncy", "--target", "x"],
      ["page.html", "--expect-easing", "linear"],
      ["out/frames.json", "--target", "x"],
      ["page.html", "--target", "x", "--at", "0..500/100"],
      ["a.html", "b.html", "--target", "x"],
      ["page.html", "--target", "x", "--forbid", "y", "--no-forbid"],
    ];
    for (const argv of bad) assert.throws(() => parseMotionArgs(argv), MotionUsageError, argv.join(" "));
    assert.equal(parseMotionArgs(["out/frames.json", "--target", "x", "--end", "900"]).endMs, 900);
  });

  it("samples 11 instants across the span, the last just inside it, and a rest past it", () => {
    const { motion, rest } = motionInstants(0, 900);
    assert.equal(motion.length, 11);
    assert.deepEqual([motion[0], motion[5], motion[10], rest], [0, 450, 899, 1200]);
  });

  it("plans a segment per span of motion: an entrance and, after a hold, an exit", () => {
    const plan = motionPlan([
      { startMs: 0, durationMs: 600, iterations: 1 },
      { startMs: 2100, durationMs: 300, iterations: 1 },
      { startMs: 100, durationMs: 200, iterations: 1 },
      { startMs: 0, durationMs: 1000, iterations: null },
    ]);
    assert.deepEqual(plan.segments, [
      { startMs: 0, endMs: 600 },
      { startMs: 2100, endMs: 2400 },
    ]);
    assert.equal(plan.motion.filter((t) => t <= 600).length, 11);
    assert.equal(plan.motion.filter((t) => t >= 2100).length, 11);
    assert.equal(plan.rest, 2700);
  });

  it("is refused without a key before a browser starts", async () => {
    const key = process.env.TYPESAFEAI_API_KEY;
    const alt = process.env.TYPESAFE_API_KEY;
    delete process.env.TYPESAFEAI_API_KEY;
    delete process.env.TYPESAFE_API_KEY;
    const errors: string[] = [];
    const original = console.error;
    console.error = (m: string) => errors.push(m);
    try {
      assert.equal(await runMotionCli(["does-not-exist.html", "--target", "x"]), 2);
      assert.match(errors.join("\n"), /TYPESAFEAI_API_KEY/);
    } finally {
      console.error = original;
      if (key !== undefined) process.env.TYPESAFEAI_API_KEY = key;
      if (alt !== undefined) process.env.TYPESAFE_API_KEY = alt;
    }
  });
});
