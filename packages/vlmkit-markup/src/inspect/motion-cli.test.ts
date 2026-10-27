import assert from "node:assert/strict";
import { describe, it } from "vite-plus/test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

describe("inspect motion on fixtures/motion-repair (round 1 passed all three broken pages)", () => {
  const dir = join(import.meta.dirname, "../../../../fixtures/motion-repair");
  const run = async (file: string, args: string[]) => {
    const lines: string[] = [];
    const log = console.log;
    console.log = (m: string) => lines.push(m);
    try {
      const frames = await mkdtemp(join(tmpdir(), "vlmkit-motion-repair-"));
      return { code: await runMotionCli([join(dir, file), ...args, "--frames", frames]), out: lines.join("\n") };
    } finally {
      console.log = log;
    }
  };
  const cases: [string, string[], RegExp][] = [
    ["notify.html", ["--selector", ".notice"], /FAIL target-hidden .*clipped by header\.topbar \(overflow: hidden\)/],
    [
      "menu.html",
      ["--selector", ".menu"],
      /FAIL target-hidden .*covered by section\.hero: nav makes a stacking context \(a transform\)/,
    ],
    [
      "toast.html",
      ["--selector", ".toast", "--exits", "--expect-easing", "ease-out,ease-in"],
      /FAIL snap-back .*in the hold after 660ms/,
    ],
    // Round 12: an SVG gear turning about its viewBox's centre, and a button whose label wraps
    // while its width eases.
    [
      "gear.html",
      ["--selector", ".gear", "--expect-still", "--expect-direction", "clockwise"],
      /turns clockwise \d+° \(180°\/s, a turn every 2000ms\)[\s\S]*FAIL still-mismatch .*it turns about a point that is not its own centre .*transform-box: fill-box/,
    ],
    [
      "label.html",
      ["--selector", ".add", "--click", ".add"],
      /FAIL size-jump at \d+ms: its height steps 64 → 44px .*text wrapping while the box is still narrow/,
    ],
    // Round 11: a hover gradient that steps, a quote re-rendered every second, and a banner taken
    // out of rendering before its exit can play.
    [
      "gradient.html",
      ["--selector", ".upgrade", "--hover", ".upgrade"],
      /FAIL snapped: \.upgrade: its colour, by up to \d+ of 255 a channel, in one frame: only its colour changed, .*two gradients, which do not interpolate/,
    ],
    [
      "quote.html",
      ["--selector", ".price"],
      /FAIL replayed: \.price after it came to rest: the page replaced it with a new element by 1000ms, 2000ms/,
    ],
    [
      "dismiss.html",
      ["--selector", ".consent", "--click", ".dismiss", "--exits"],
      /FAIL snapped: \.consent: .* → 0x0 .*: the action took it out of rendering \(it is display: none \(the hidden attribute\)\) in the same frame/,
    ],
    // Round 10: a notice whose margin-top shoves the article, a spinner one turn short of a loop,
    // and a check mark whose dash is shorter than its line.
    [
      "push.html",
      ["--selector", ".notice", "--selector", "article h1", "--still", "article h1"],
      /FAIL still-mismatch .*it has no animation of its own, .*div\.notice animates margin-top/,
    ],
    [
      "seam.html",
      ["--selector", ".spinner"],
      /FAIL loop-seam: \.spinner `spin` turns 10\.\d° in one step at every loop/,
    ],
    [
      "draw.html",
      ["--selector", ".tick path"],
      /FAIL stroke-incomplete .*its stroke ends 54% drawn .*stroke-dasharray 40px/,
    ],
    // Round 9: a flip card's faces with their back faces drawn, and a second click that lands
    // while the menu is still unfolding.
    [
      "flip.html",
      ["--click", ".flip", "--selector", ".back", "--selector", ".front"],
      /FAIL mirrored .*give it backface-visibility: hidden/,
    ],
    [
      "interrupt.html",
      ["--selector", ".menu", "--click", ".filters", "--wait", "100", "--click", ".filters", "--exits"],
      /FAIL interrupt-jump: \.menu jumps the moment --click \.filters lands .*a @keyframes animation always starts from its `from`/,
    ],
    // Round 8: a keyframe transform replacing the centring, a :hover-only transition, a reveal
    // whose observer never fires for a section taller than the screen.
    [
      "dialog.html",
      ["--click", ".delete", "--selector", ".dialog", "--expect-still", "--expect-origin", "center"],
      /FAIL still-mismatch [\s\S]*FAIL origin-mismatch .*no point of its box \(it moves as well as it scales\), not its centre[\s\S]*FAIL jump .*sits 223px off where it rests .*translate\(-50%, -50%\)/,
    ],
    [
      "hover.html",
      ["--selector", "#c2", "--hover", "#c2", "--leave", "--expect-duration", "150", "--expect-easing", "ease-out"],
      /after --hover #c2, --leave, no animation[\s\S]*FAIL snapped: #c2: .*a transition declared only in the :hover rule/,
    ],
    ["reveal.html", ["--selector", ".studio", "--scroll", ".studio"], /FAIL target-hidden .*rendered at opacity 0\.00/],
    // Round 7: a panel from the wrong side, and a click that snaps a panel open.
    [
      "slidein.html",
      ["--selector", ".panel", "--expect-direction", "left"],
      /FAIL direction-mismatch .*moves rightwards .*not leftwards/,
    ],
    [
      "accordion.html",
      ["--click", ".toggle", "--selector", ".panel", "--selector", ".after"],
      /FAIL snapped: \.panel: 592x0 .* → 592x116 .*in one frame/,
    ],
    // Round 6: an exit not held (no target-lost beside it), a run 5x too long, a pulse that never stops.
    [
      "banner.html",
      ["--selector", ".banner", "--exits", "--expect-easing", "ease-in"],
      /^(?![\s\S]*target-lost)[\s\S]*FAIL snap-back at 2600ms/,
    ],
    [
      "sheet.html",
      ["--selector", ".sheet", "--expect-duration", "280ms"],
      /FAIL duration-mismatch .*one run takes 1400ms, not 280ms \(5\.0x\)/,
    ],
    [
      "badge.html",
      ["--selector", ".badge", "--expect-iterations", "3"],
      /every animation repeats forever[\s\S]*FAIL iterations-mismatch .*it runs forever, not 3 times/,
    ],
    // Round 5: a scaleY drop-down (one axis), a wave in reverse, and a start held back.
    [
      "tooltip.html",
      ["--selector", ".tip", "--expect-origin", "top"],
      /FAIL origin-mismatch .*grows from its bottom edge .*transform-origin: top/,
    ],
    [
      "tiles.html",
      [
        "--selector",
        ".t1",
        "--selector",
        ".t2",
        "--selector",
        ".t3",
        "--selector",
        ".t4",
        "--expect-start",
        "240",
        "--expect-stagger",
        "60",
      ],
      /FAIL start-mismatch .*begins at 420ms, not 240ms/,
    ],
    [
      "chips.html",
      ["--selector", ".chips", "--expect-start", "0"],
      /FAIL start-mismatch .*begins at 1200ms, not 0ms: late by 1200ms/,
    ],
    // Round 3: an ancestor's opacity 0 named, a scale's fixed point, and a stagger that is not one.
    [
      "drawer.html",
      ["--selector", ".drawer"],
      /FAIL target-hidden .*transparent: div\.shell renders at opacity 0\.00, and nothing animates it/,
    ],
    [
      "popover.html",
      ["--selector", ".pop", "--expect-origin", "left bottom"],
      /FAIL origin-mismatch .*grows from its top-right corner .*transform-origin: bottom left/,
    ],
    [
      "stagger.html",
      [
        "--selector",
        "li.a1",
        "--selector",
        "li.a2",
        "--selector",
        "li.a3",
        "--selector",
        "li.a4",
        "--expect-stagger",
        "80",
      ],
      /FAIL start-mismatch .*begins at 200ms, not 280ms.*; set by `li:nth-child\(2\) \{ animation-delay: 200ms \}`[\s\S]*begins: li\.a1 200ms, li\.a2 200ms, li\.a3 200ms, li\.a4 200ms — all within one frame/,
    ],
    [
      "stagger.html",
      [
        "--selector",
        "li.a1",
        "--selector",
        "li.a2",
        "--selector",
        "li.a3",
        "--selector",
        "li.a4",
        "--expect-start",
        "200,280,360,440",
      ],
      /FAIL start-mismatch .*begins at 200ms, not 440ms/,
    ],
  ];
  for (const [file, args, expected] of cases) {
    it(`fails broken/${file} with its cause and passes reference/${file}`, { timeout: 120_000 }, async () => {
      const broken = await run(`broken/${file}`, args);
      assert.equal(broken.code, 1, broken.out);
      assert.match(broken.out, expected);
      const fixed = await run(`reference/${file}`, args);
      assert.equal(fixed.code, 0, fixed.out);
    });
  }

  it("judges a scroll-driven bar against the scroll, and names a 0s animation", { timeout: 120_000 }, async () => {
    // Round 12: the reading bar on a scroll timeline, and the one whose shorthand reset it.
    const fixed = await run("reference/reading.html", ["--selector", ".progress"]);
    assert.equal(fixed.code, 0, fixed.out);
    assert.match(
      fixed.out,
      /driven by the scroll[\s\S]*progress 0\.00 at 0%, 0\.20 at 20%, 0\.50 at 50%, 0\.80 at 80%, 1\.00 at 100%; back at 50% 0\.50, at 0% 0\.00; scaleX 0\.00 → 1\.00/,
    );
    const errors: string[] = [];
    const error = console.error;
    console.error = (m: string) => errors.push(m);
    try {
      const broken = await run("broken/reading.html", ["--selector", ".progress"]);
      assert.equal(broken.code, 2);
    } finally {
      console.error = error;
    }
    assert.match(
      errors.join("\n"),
      /`grow` has a duration of 0s, .*`animation-timeline` has to come after the `animation` shorthand/,
    );
  });

  it("names a turn off its centre without --expect-still", { timeout: 120_000 }, async () => {
    const broken = await run("broken/gear.html", ["--selector", ".gear"]);
    assert.match(broken.out, /warn turn-off-centre .*carried up to \d+px .*transform-box: fill-box/);
    const fixed = await run("reference/gear.html", ["--selector", ".gear"]);
    assert.doesNotMatch(fixed.out, /turn-off-centre/);
  });

  it("samples the hold between two segments", () => {
    const plan = motionPlan([
      { startMs: 300, durationMs: 360, iterations: 1 },
      { startMs: 2660, durationMs: 300, iterations: 1 },
    ]);
    assert.ok(
      plan.motion.some((t) => t > 660 && t < 2660),
      JSON.stringify(plan.motion),
    );
  });

  it("takes --out as --frames", () => {
    // Refused with "did you mean --frames", it was still the flag an agent reached for (round 11).
    assert.equal(parseMotionArgs(["p.html", "--selector", ".a", "--out", "x"]).frames, "x");
  });
});

describe("inspect motion after motion-repair round 3", () => {
  it(
    "names whose fade a target's opacity follows when its own never changes (round 4)",
    { timeout: 120_000 },
    async () => {
      const lines: string[] = [];
      const log = console.log;
      console.log = (m: string) => lines.push(m);
      try {
        const frames = await mkdtemp(join(tmpdir(), "vlmkit-motion-fade-"));
        const page = join(import.meta.dirname, "../../../../fixtures/motion-repair/reference/drawer.html");
        assert.equal(await runMotionCli([page, "--selector", ".drawer", "--frames", frames]), 0);
      } finally {
        console.log = log;
      }
      assert.match(lines.join("\n"), /in its opacity \(div\.shell's fade: its own opacity does not change\)/);
    },
  );

  it("parses --expect-origin in either word order, and checks the counts", () => {
    assert.deepEqual(parseMotionArgs(["p.html", "--selector", ".t", "--expect-origin", "left bottom"]).expectOrigin, [
      "bottom-left",
    ]);
    assert.deepEqual(parseMotionArgs(["p.html", "--selector", ".t", "--expect-origin", "centre"]).expectOrigin, [
      "center",
    ]);
    assert.throws(() => parseMotionArgs(["p.html", "--selector", ".t", "--expect-origin", "middle"]), MotionUsageError);
    assert.throws(() => parseMotionArgs(["p.html", "--selector", ".t", "--expect-stagger", "80"]), MotionUsageError);
    // In the order given, duplicates kept: parseInstants sorted "400,0" into "0,400" (round 4).
    assert.deepEqual(
      parseMotionArgs([
        "p.html",
        "--selector",
        ".a",
        "--selector",
        ".b",
        "--selector",
        ".c",
        "--expect-start",
        "400,0,0",
      ]).expectStartMs,
      [400, 0, 0],
    );
    assert.throws(
      () => parseMotionArgs(["p.html", "--selector", ".t", "--expect-start", "200,280"]),
      /2 --expect-start times for 1 targets/,
    );
  });
});

describe("inspect motion after motion-repair round 2", () => {
  it("takes any in --expect-easing to leave a segment unchecked", () => {
    assert.deepEqual(parseMotionArgs(["p.html", "--selector", ".t", "--expect-easing", "ease-out,any"]).expectEasing, [
      ["ease-out", undefined],
    ]);
    assert.throws(() => parseMotionArgs(["p.html", "--selector", ".t", "--expect-easing", "any"]), MotionUsageError);
  });

  it(
    "names the entrance's easing when the snap-back is in the hold, and the first fail's frame",
    { timeout: 120_000 },
    async () => {
      const lines: string[] = [];
      const log = console.log;
      console.log = (m: string) => lines.push(m);
      try {
        const frames = await mkdtemp(join(tmpdir(), "vlmkit-motion-r2-"));
        const page = join(import.meta.dirname, "../../../../fixtures/motion-repair/broken/toast.html");
        assert.equal(await runMotionCli([page, "--selector", ".toast", "--exits", "--frames", frames]), 1);
      } finally {
        console.log = log;
      }
      const out = lines.join("\n");
      assert.match(out, /300\.\.660ms: travels \d+px( \w+wards)?, follows ease-in/, out);
      assert.match(out, /the first fail's own frame \(1160ms, [^)]*\): .*0\d{3}-t001160\.png/);
    },
  );
});
