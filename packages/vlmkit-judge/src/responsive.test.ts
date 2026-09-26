import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { createRng, shrinkRecord } from "./pbt.ts";
import {
  anchorInterval,
  breakpointMoves,
  caseShrinkers,
  edgeCases,
  failureKey,
  generateCase,
  groupFailures,
  heightCandidates,
  judgeStarvedText,
  moveCondition,
  regimesFromSamples,
  unvariedFeatures,
  widthCandidates,
  type CaseOutcome,
  type ResponsiveFinding,
  type ResponsiveSpace,
  type StarvedTextSample,
} from "./responsive.ts";

const space: ResponsiveSpace = {
  minWidth: 320,
  maxWidth: 1440,
  minHeight: 400,
  maxHeight: 1000,
  defaultHeight: 900,
  textScales: [1, 1.25, 1.5],
  colorSchemes: ["light", "dark"],
  reducedMotions: ["no-preference"],
};

/** A page with (max-width: 699px) and (min-width: 700px) and (min-width: 1100px). */
const matchAt = (w: number): string[] => [
  ...(w <= 699 ? ["(max-width: 699px)"] : []),
  ...(w >= 700 ? ["(min-width: 700px)"] : []),
  ...(w >= 1100 ? ["(min-width: 1100px)"] : []),
];

describe("widthCandidates", () => {
  it("lands a sample on both sides of px, em and range-syntax boundaries", () => {
    const c = widthCandidates(["(max-width: 767.98px)", "(min-width: 48em)", "(width > 1024px)", "(orientation: portrait)"]);
    for (const w of [767, 768, 1024, 1025]) assert.ok(c.includes(w), `${w} in ${c}`);
    assert.ok(!c.some((w) => w < 700), "orientation contributes no numbers");
  });

  it("reads height features separately", () => {
    assert.deepEqual(heightCandidates(["(max-height: 500px)", "(min-width: 700px)"]), [499, 500, 501]);
  });
});

describe("regimesFromSamples", () => {
  it("turns 1px-apart changes into exact transitions and names what changed", () => {
    const widths = [320, 698, 699, 700, 701, 1099, 1100, 1440];
    const { transitions, regimes, unresolved } = regimesFromSamples(
      widths.map((width) => ({ width, matches: matchAt(width) })),
      320,
      1440,
    );
    assert.deepEqual(unresolved, []);
    assert.deepEqual(transitions.map((t) => t.width), [700, 1100]);
    assert.deepEqual(transitions[0]!.entering, ["(min-width: 700px)"]);
    assert.deepEqual(transitions[0]!.leaving, ["(max-width: 699px)"]);
    assert.deepEqual(regimes.map((r) => [r.from, r.to]), [[320, 699], [700, 1099], [1100, 1440]]);
  });

  it("reports a change between distant samples as unresolved instead of guessing", () => {
    const { transitions, unresolved } = regimesFromSamples(
      [320, 500, 900, 1440].map((width) => ({ width, matches: matchAt(width) })),
      320,
      1440,
    );
    assert.deepEqual(transitions, []);
    assert.deepEqual(unresolved, [[500, 900], [900, 1440]]);
  });
});

describe("unvariedFeatures", () => {
  it("names the features the generator cannot reach, and only those", () => {
    const got = unvariedFeatures([
      "(hover: hover) and (pointer: fine)",
      "(min-width: 700px)",
      "(prefers-color-scheme: dark)",
      "(400px <= width <= 700px)",
      "(prefers-contrast: more)",
    ]);
    assert.deepEqual(got.map((g) => g.feature).sort(), ["hover", "pointer", "prefers-contrast"]);
  });
});

describe("generation", () => {
  const { regimes, transitions } = regimesFromSamples(
    [320, 699, 700, 1099, 1100, 1440].map((width) => ({ width, matches: matchAt(width) })),
    320,
    1440,
  );

  it("starts from both sides of every transition and both ends", () => {
    assert.deepEqual(edgeCases(space, transitions).map((c) => c.width), [320, 699, 700, 1099, 1100, 1440]);
    assert.ok(edgeCases(space, transitions).every((c) => c.height === 900 && c.textScale === 1));
  });

  it("visits every regime and stays inside the space", () => {
    const rng = createRng(7);
    const perRegime = [0, 0, 0];
    for (let i = 0; i < 300; i++) {
      const c = generateCase(rng, space, regimes, i, [500]);
      assert.ok(c.width >= 320 && c.width <= 1440);
      assert.ok(c.height >= 400 && c.height <= 1000);
      assert.ok(space.textScales.includes(c.textScale));
      perRegime[regimes.findIndex((r) => c.width >= r.from && c.width <= r.to)]!++;
    }
    assert.deepEqual(perRegime, [100, 100, 100]);
  });

  it("is reproducible from the seed", () => {
    const run = (seed: number) => {
      const rng = createRng(seed);
      return Array.from({ length: 10 }, (_, i) => generateCase(rng, space, regimes, i));
    };
    assert.deepEqual(run(42), run(42));
  });

  it("shrinks every non-width dimension to the base case when the failure is width-only", async () => {
    const result = await shrinkRecord(
      { width: 813, height: 655, textScale: 1.5, colorScheme: "dark" as const, reducedMotion: "no-preference" as const },
      caseShrinkers(space),
      async (c) => c.width >= 700 && c.width <= 871,
    );
    assert.deepEqual(result.value, { width: 813, height: 900, textScale: 1, colorScheme: "light", reducedMotion: "no-preference" });
  });

  it("keeps the dimension a failure actually needs", async () => {
    const result = await shrinkRecord(
      { width: 390, height: 655, textScale: 1.5, colorScheme: "light" as const, reducedMotion: "no-preference" as const },
      caseShrinkers(space),
      async (c) => c.textScale >= 1.25,
    );
    assert.equal(result.value.textScale, 1.25);
    assert.equal(result.value.height, 900);
  });
});

describe("moveCondition", () => {
  it("moves the boundary number whichever side of it the condition names", () => {
    assert.equal(moveCondition("(min-width: 700px)", 700, 872), "(min-width: 872px)");
    assert.equal(moveCondition("(max-width: 699px)", 700, 872), "(max-width: 871px)");
    assert.equal(moveCondition("(width >= 700px)", 700, 872), "(width >= 872px)");
    assert.equal(moveCondition("(min-width: 43.75em)", 700, 872), "(min-width: 54.5em)");
    assert.equal(moveCondition("(min-width: 1100px)", 700, 872), null);
  });
});

describe("anchorInterval", () => {
  const { transitions } = regimesFromSamples(
    [320, 699, 700, 1099, 1100, 1440].map((width) => ({ width, matches: matchAt(width) })),
    320,
    1440,
  );

  it("names a breakpoint switched on before its layout fits, and the width it needs", () => {
    const a = anchorInterval(700, 871, transitions, 320, 1440);
    assert.equal(a.kind, "starts-at-breakpoint");
    assert.match(a.diagnosis, /starts exactly at the 700px breakpoint/);
    assert.match(a.suggestion ?? "", /\(min-width: 700px\) → \(min-width: 872px\)/);
  });

  it("names a narrow layout kept too long", () => {
    const a = anchorInterval(612, 699, transitions, 320, 1440);
    assert.equal(a.kind, "ends-at-breakpoint");
    assert.match(a.suggestion ?? "", /down to 612px/);
    assert.match(a.suggestion ?? "", /\(min-width: 700px\) → \(min-width: 612px\)/);
  });

  it("does not suggest moving a breakpoint when the failure reaches the narrowest width", () => {
    const a = anchorInterval(320, 699, transitions, 320, 1440);
    assert.equal(a.kind, "ends-at-breakpoint");
    assert.match(a.suggestion ?? "", /cannot help/);
  });

  it("recognises a failure bounded on both sides by transitions", () => {
    assert.equal(anchorInterval(700, 1099, transitions, 320, 1440).kind, "whole-regime");
  });

  it("calls a failure that touches no transition a size that does not follow the viewport", () => {
    const a = anchorInterval(320, 345, transitions, 320, 1440);
    assert.equal(a.kind, "inside-regime");
    assert.match(a.diagnosis, /something keeps a size/);
    assert.equal(anchorInterval(801, 850, transitions, 320, 1440).kind, "inside-regime");
  });

  it("does not invent a width past the range for a failure that reaches the widest one", () => {
    const a = anchorInterval(1100, 1440, transitions, 320, 1440);
    assert.equal(a.kind, "whole-regime");
    assert.doesNotMatch(a.diagnosis, /1441/);
    assert.deepEqual(breakpointMoves(a, 1100, 1440, 320), []);
  });

  it("says when the failure is not responsive at all", () => {
    assert.equal(anchorInterval(320, 1440, transitions, 320, 1440).kind, "every-width");
  });

  it("treats a one-pixel orphan width as a whole regime", () => {
    // max-width: 767px + min-width: 769px leaves 768 in neither: transitions at 768 and 769.
    const orphan = regimesFromSamples(
      [320, 767, 768, 769, 1440].map((width) => ({
        width,
        matches: [...(width <= 767 ? ["(max-width: 767px)"] : []), ...(width >= 769 ? ["(min-width: 769px)"] : [])],
      })),
      320,
      1440,
    );
    assert.equal(anchorInterval(768, 768, orphan.transitions, 320, 1440).kind, "whole-regime");
  });
});

describe("groupFailures", () => {
  const f = (kind: ResponsiveFinding["kind"], selector: string, severity: "fail" | "warn" = "warn"): ResponsiveFinding => ({
    kind, severity, selector, targets: [selector], message: `${kind} ${selector}`,
  });
  const c = (width: number) => ({ width, height: 900, textScale: 1, colorScheme: "light" as const, reducedMotion: "no-preference" as const });

  it("merges findings that fail in exactly the same cases, and only those", () => {
    const outcomes: CaseOutcome[] = [
      { index: 0, case: c(700), findings: [f("text-starved", "a.one"), f("text-starved", "a.two"), f("text-starved", "p.lede")] },
      { index: 1, case: c(800), findings: [f("text-starved", "a.one"), f("text-starved", "a.two")] },
      { index: 2, case: c(320), findings: [f("page-overflow-x", "div.row", "fail")] },
      { index: 3, case: c(330), findings: [f("page-overflow-x", "input.email", "fail")] },
    ];
    const groups = groupFailures(outcomes);
    assert.equal(groups[0]!.kind, "page-overflow-x", "fail-level groups first");
    assert.deepEqual(groups[0]!.cases, [2, 3], "page overflow is one failure whatever element is blamed");
    const nav = groups.find((g) => g.selectors.includes("a.one"))!;
    assert.deepEqual(nav.selectors, ["a.one", "a.two"]);
    assert.deepEqual(nav.cases, [0, 1]);
    assert.ok(groups.some((g) => g.selectors.length === 1 && g.selectors[0] === "p.lede"));
  });

  it("keys page overflow by the property alone", () => {
    assert.equal(failureKey({ kind: "page-overflow-x", selector: "div.a" }), failureKey({ kind: "page-overflow-x", selector: "div.b" }));
    assert.notEqual(failureKey({ kind: "text-starved", selector: "a" }), failureKey({ kind: "text-starved", selector: "b" }));
  });
});

describe("judgeStarvedText", () => {
  const s = (over: Partial<StarvedTextSample>): StarvedTextSample => ({
    selector: "a.nav",
    text: "暮らし",
    chars: 3,
    lines: 3,
    authoredLines: 1,
    contentWidth: 16,
    fontSize: 16,
    ...over,
  });

  it("reports the magazine masthead: a character per line", () => {
    const [finding] = judgeStarvedText([s({})]);
    assert.equal(finding?.kind, "text-starved");
    assert.match(finding!.message, /3 lines of ~1\.0 characters/);
  });

  it("reports the docs phase cards: several lines under 6em", () => {
    assert.equal(judgeStarvedText([s({ text: "Copies rows in ranges", chars: 60, lines: 6, contentWidth: 69, fontSize: 14 })]).length, 1);
  });

  it("reports a short word broken across lines even in a wider box", () => {
    const [finding] = judgeStarvedText([s({ text: "--config path", chars: 13, lines: 2, contentWidth: 120, fontSize: 14, brokenWord: "config" })]);
    assert.match(finding!.message, /breaks "config"/);
  });

  it("leaves a long URL broken on purpose alone", () => {
    const word = "https://example.com/a/very/long/path/that/must/wrap";
    assert.deepEqual(judgeStarvedText([s({ text: word, chars: word.length, lines: 2, contentWidth: 200, fontSize: 14, brokenWord: word })]), []);
  });

  it("leaves a display headline set in short lines alone, but not a crushed one", () => {
    // The magazine's 42px title at 1000px: four lines of five characters in 236px (5.6em).
    const title = s({ text: "海辺の町の古本屋が、夜だけ店を開ける理由", chars: 20, lines: 4, contentWidth: 236, fontSize: 42 });
    assert.deepEqual(judgeStarvedText([title]), []);
    assert.equal(judgeStarvedText([{ ...title, contentWidth: 120 }]).length, 1, "under 4em is starved at any size");
  });

  it("does not report text that fits, or lines the author asked for", () => {
    assert.deepEqual(judgeStarvedText([s({ lines: 1 })]), [], "one line is never starved");
    assert.deepEqual(judgeStarvedText([s({ lines: 2, authoredLines: 2, text: "Mon 12" })]), [], "a <br> date badge");
    assert.deepEqual(judgeStarvedText([s({ lines: 2, contentWidth: 90, fontSize: 16 })]), [], "two lines at 5.6em");
    assert.deepEqual(judgeStarvedText([s({ lines: 4, contentWidth: 300, fontSize: 16 })]), [], "a paragraph");
  });
});

describe("neutralOverride", () => {
  it("neutralises what sizes a box and leaves the neutral values alone", async () => {
    const { neutralOverride } = await import("./responsive.ts");
    assert.equal(neutralOverride("min-width", "38rem"), "auto");
    assert.equal(neutralOverride("flex-wrap", "nowrap"), "wrap");
    assert.equal(neutralOverride("grid-template-columns", "repeat(4, 1fr)"), "none");
    assert.equal(neutralOverride("flex", "0 0 11rem"), "0 1 auto");
    assert.equal(neutralOverride("flex-wrap", "wrap"), null);
    assert.equal(neutralOverride("flex-shrink", "1"), null);
    assert.equal(neutralOverride("width", "auto"), null);
    assert.equal(neutralOverride("padding", "0"), null);
    assert.equal(neutralOverride("color", "red"), null, "paint is never a layout cause");
    assert.equal(neutralOverride("display", "flex"), null, "display is structure, not a size to neutralise");
  });
});
