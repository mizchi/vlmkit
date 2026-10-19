import assert from "node:assert/strict";
import { describe, it } from "vite-plus/test";
import {
  DEFAULT_MOTION_FORBID,
  motionInstants,
  motionEasingOptions,
  motionPlan,
  MotionUsageError,
  parseMotionArgs,
  runMotionCli,
} from "./motion-cli.ts";

describe("inspect motion arguments", () => {
  it("reads targets, statements, the easing and the default forbid", () => {
    const o = parseMotionArgs([
      "page.html",
      "--jev",
      "--target",
      "the blue square",
      "--expect-easing",
      "ease-out",
      "--exits",
    ]);
    assert.deepEqual(o.targets, ["the blue square"]);
    assert.deepEqual(o.forbid, [DEFAULT_MOTION_FORBID]);
    assert.deepEqual(o.expectEasing, [["ease-out"]]);
    assert.deepEqual(
      parseMotionArgs(["p.html", "--jev", "--target", "x", "--expect-easing", "ease-out,ease-in"]).expectEasing,
      [["ease-out", "ease-in"]],
    );
    assert.equal(o.exits, true);
    assert.deepEqual(parseMotionArgs(["page.html", "--jev", "--target", "x", "--forbid", "a spinner"]).forbid, [
      "a spinner",
    ]);
    assert.deepEqual(parseMotionArgs(["page.html", "--jev", "--target", "x", "--no-forbid"]).forbid, []);
  });

  it("reads one --expect-easing as every target's and several as the targets' in order", () => {
    assert.deepEqual(motionEasingOptions([["ease-out", "ease-in"]]), { expectEasing: ["ease-out", "ease-in"] });
    assert.deepEqual(
      motionEasingOptions(
        parseMotionArgs([
          "p.html",
          "--jev",
          "--target",
          "a",
          "--expect-easing",
          "ease-out",
          "--target",
          "b",
          "--expect-easing",
          "ease-in-out",
        ]).expectEasing,
      ),
      { targetEasing: ["ease-out", "ease-in-out"] },
    );
    assert.throws(
      () =>
        parseMotionArgs(["p.html", "--jev", "--target", "a", "--expect-easing", "linear", "--expect-easing", "ease"]),
      MotionUsageError,
    );
  });

  it("pairs each --selector with the --target in its position", () => {
    const o = parseMotionArgs(["p.html", "--jev", "--target", "a", "--selector", ".a", "--target", "b"]);
    assert.deepEqual([o.targets, o.selectors], [["a", "b"], [".a"]]);
    assert.throws(
      () => parseMotionArgs(["p.html", "--jev", "--target", "a", "--selector", ".a", "--selector", ".b"]),
      MotionUsageError,
    );
    assert.throws(
      () => parseMotionArgs(["f/frames.json", "--jev", "--target", "a", "--selector", ".a", "--end", "500"]),
      MotionUsageError,
    );
  });

  it("refuses what cannot be checked", () => {
    const bad: string[][] = [
      ["page.html", "--jev", "--no-forbid"],
      ["page.html", "--jev", "--expect-easing", "bouncy", "--target", "x"],
      ["page.html", "--jev", "--expect-easing", "linear"],
      ["out/frames.json", "--jev", "--target", "x"],
      ["a.html", "b.html", "--jev", "--target", "x"],
      ["page.html", "--jev", "--target", "x", "--forbid", "y", "--no-forbid"],
      // Without --jev: every target measured, nothing read in words.
      ["page.html", "--target", "x"],
      ["page.html", "--selector", ".a", "--forbid", "y"],
      ["page.html", "--selector", ".a", "--target", "a", "--target", "b"],
      ["out/frames.json", "--selector", ".a", "--end", "900"],
    ];
    for (const argv of bad) assert.throws(() => parseMotionArgs(argv), MotionUsageError, argv.join(" "));
    assert.equal(parseMotionArgs(["out/frames.json", "--jev", "--target", "x", "--end", "900"]).endMs, 900);
  });

  it("without --jev measures each --selector, names it by itself, and asks nothing", () => {
    const o = parseMotionArgs(["p.html", "--selector", ".toast", "--selector", ".bar", "--expect-easing", "ease-out"]);
    assert.deepEqual([o.jev, o.targets, o.selectors, o.forbid], [false, [".toast", ".bar"], [".toast", ".bar"], []]);
    assert.deepEqual(parseMotionArgs(["p.html", "--target", "the toast", "--selector", ".toast"]).targets, [
      "the toast",
    ]);
    assert.equal(parseMotionArgs(["p.html", "--jev", "--target", "x"]).jev, true);
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

  it("cuts a single animation's keyframe hold out of its span", () => {
    // One 3300ms toast: in over 0-15%, held 15-90%, out 90-100%.
    const plan = motionPlan([{ startMs: 0, durationMs: 3300, iterations: 1, holds: [[0.15, 0.9]] }]);
    assert.deepEqual(
      plan.segments.map((g) => [Math.round(g.startMs), Math.round(g.endMs)]),
      [
        [0, 495],
        [2970, 3300],
      ],
    );
    assert.equal(plan.motion.filter((t) => t <= 495).length, 11);
  });

  it("is refused under --jev without a key before a browser starts, and needs none without it", async () => {
    const key = process.env.TYPESAFEAI_API_KEY;
    const alt = process.env.TYPESAFE_API_KEY;
    delete process.env.TYPESAFEAI_API_KEY;
    delete process.env.TYPESAFE_API_KEY;
    const errors: string[] = [];
    const original = console.error;
    console.error = (m: string) => errors.push(m);
    try {
      assert.equal(await runMotionCli(["does-not-exist.html", "--jev", "--target", "x"]), 2);
      assert.match(errors.join("\n"), /TYPESAFEAI_API_KEY/);
    } finally {
      console.error = original;
      if (key !== undefined) process.env.TYPESAFEAI_API_KEY = key;
      if (alt !== undefined) process.env.TYPESAFE_API_KEY = alt;
    }
  });
});

describe("inspect motion without --jev", () => {
  // The page alone, no key: the hit-test is what sees a clip or a cover, which only Jev's
  // reading of the pixels saw before. fixtures/motion-defects/ holds the known answers.
  const run = async (file: string, selector: string) => {
    const lines: string[] = [];
    const log = console.log;
    console.log = (m: string) => lines.push(m);
    try {
      const { mkdtemp } = await import("node:fs/promises");
      const { tmpdir } = await import("node:os");
      const { join } = await import("node:path");
      const frames = await mkdtemp(join(tmpdir(), "vlmkit-motion-nojev-"));
      const page = join(import.meta.dirname, "../../../../fixtures/motion-defects", file);
      return { code: await runMotionCli([page, "--selector", selector, "--frames", frames]), out: lines.join("\n") };
    } finally {
      console.log = log;
    }
  };

  it(
    "sees a menu that opens under the next card, and passes the one that opens above it",
    { timeout: 120_000 },
    async () => {
      const broken = await run("covered--broken.html", ".menu");
      assert.equal(broken.code, 1);
      assert.match(broken.out, /FAIL absent-at-rest/);
      assert.match(broken.out, /no model asked/);
      assert.equal((await run("covered--intact.html", ".menu")).code, 0);
    },
  );

  it("sees a card moved into a column that clips it", { timeout: 120_000 }, async () => {
    assert.match((await run("clipped--broken.html", ".task")).out, /FAIL absent-at-rest/);
    assert.equal((await run("clipped--intact.html", ".task")).code, 0);
  });
});
