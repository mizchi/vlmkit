import assert from "node:assert/strict";
import { describe, it } from "vite-plus/test";
import {
  compareVerissClaims,
  describeBranchSet,
  enumerateBranches,
  findingKey,
  judgeResetMatrix,
  mergeWidths,
  summarizeResetMatrix,
  type BranchRun,
} from "./reset-matrix.ts";

const space = { uas: ["chromium", "firefox", "webkit"], resets: ["none", "normalize", "destyle"] };
const finding = (kind: string, selector?: string, severity: "fail" | "warn" = "fail") => ({
  kind,
  severity,
  ...(selector ? { selector } : {}),
  message: `${kind} on ${selector ?? "the page"} by 2px`,
  widths: [1280],
});
const run = (id: string, findings: BranchRun["findings"], status: BranchRun["status"] = "measured"): BranchRun => {
  const [ua, reset] = id.split(":") as [string, string];
  return { id, ua, reset, status, findings, ...(status === "measured" ? {} : { error: "boom" }) };
};

describe("describeBranchSet", () => {
  const cases: [string[], string][] = [
    [["firefox:none"], "firefox × none"],
    [enumerateBranches(space).map((b) => b.id), "every branch"],
    [["chromium:none", "firefox:none", "webkit:none"], "none (any UA)"],
    [["firefox:none", "firefox:normalize", "firefox:destyle"], "firefox (any reset)"],
    [["firefox:none", "webkit:none", "firefox:normalize", "webkit:normalize"], "firefox, webkit × none, normalize"],
    [["firefox:none", "chromium:normalize", "firefox:normalize"], "firefox × none; chromium, firefox × normalize"],
  ];
  for (const [ids, summary] of cases)
    it(`${ids.join(" ")} → ${summary}`, () => assert.equal(describeBranchSet(ids, space).summary, summary));

  it("is veriss's describeBranchSet, output for output", async () => {
    const veriss = (await import(/* @vite-ignore */ "veriss/reset-matrix")) as {
      describeBranchSet: typeof describeBranchSet;
    };
    const all = enumerateBranches(space).map((b) => b.id);
    // Every subset of a 3 × 3 space: 511 sets.
    for (let mask = 1; mask < 1 << all.length; mask++) {
      const ids = all.filter((_, i) => mask & (1 << i));
      assert.deepEqual(describeBranchSet(ids, space), veriss.describeBranchSet(ids, space), ids.join(" "));
    }
  });
});

describe("summarizeResetMatrix", () => {
  it("splits findings into every branch and only some, and never counts an unmeasured branch as absent", () => {
    const runs = enumerateBranches(space).map((b) =>
      b.id === "webkit:destyle"
        ? run(b.id, [], "failed")
        : run(b.id, [
            finding("page-overflow-x"),
            ...(b.reset !== "destyle" ? [finding("container-protrusion", "div.chip out of li.item")] : []),
            ...(b.id === "firefox:none" ? [finding("text-clipped", "p.meta", "warn")] : []),
          ]),
    );
    const s = summarizeResetMatrix(runs, space);
    assert.deepEqual(
      s.holdsEverywhere.map((f) => f.kind),
      ["page-overflow-x"],
    );
    const chip = s.onlyIn.find((f) => f.kind === "container-protrusion")!;
    assert.equal(chip.summary, "none, normalize (any UA)");
    assert.deepEqual(chip.absent, ["chromium:destyle", "firefox:destyle"]);
    assert.deepEqual(chip.unmeasured, ["webkit:destyle"]);
    assert.equal(chip.withoutReset, true);
    assert.equal(s.onlyIn.find((f) => f.kind === "text-clipped")!.summary, "firefox × none");
    assert.deepEqual(s.unmeasured, [{ id: "webkit:destyle", status: "failed", error: "boom" }]);
    assert.deepEqual(
      s.equivalent.map((g) => g.length),
      [5, 2, 1],
    );
  });

  it("a finding with no selector is one finding whatever its numbers", () => {
    assert.equal(
      findingKey({ kind: "page-overflow-x", message: "The page scrolls by 2px at 1280px" }),
      findingKey({ kind: "page-overflow-x", message: "The page scrolls by 6px at 1280px" }),
    );
    assert.notEqual(
      findingKey({ kind: "text-clipped", selector: "a", message: "x" }),
      findingKey({ kind: "text-clipped", selector: "b", message: "x" }),
    );
  });

  it("merges a finding seen at several widths, keeping the worst severity", () => {
    const merged = mergeWidths([
      { kind: "k", severity: "warn", selector: "a", message: "m", viewport: 375 },
      { kind: "k", severity: "fail", selector: "a", message: "m", viewport: 1280 },
    ]);
    assert.deepEqual(merged, [{ kind: "k", severity: "fail", selector: "a", message: "m", widths: [1280, 375] }]);
  });
});

describe("judgeResetMatrix", () => {
  const judge = (runs: BranchRun[]) =>
    judgeResetMatrix({
      summary: summarizeResetMatrix(runs, { uas: ["chromium", "firefox"], resets: ["none", "destyle"] }),
    });

  it("a defect a branch with no reset has keeps its severity; one only resets bring is a warn", () => {
    const f = judge([
      run("chromium:none", []),
      run("chromium:destyle", [finding("container-protrusion", "x")]),
      run("firefox:none", [finding("page-overflow-x", "t")]),
      run("firefox:destyle", []),
    ]);
    assert.deepEqual(
      f.map((x) => [x.rule, x.severity, x.selector]),
      [
        ["branch-defect", "warn", "x"],
        ["branch-defect", "suspect", "t"],
      ],
    );
    assert.match(f[1]!.message, /only in firefox × none \(1 of 4 branches\)/);
  });

  it("a failed branch is a suspect, a missing engine a warn", () => {
    const f = judge([
      run("chromium:none", []),
      run("chromium:destyle", []),
      run("firefox:none", [], "skipped"),
      run("firefox:destyle", [], "failed"),
    ]);
    assert.deepEqual(
      f.map((x) => [x.rule, x.severity]),
      [
        ["branch-unmeasured", "warn"],
        ["branch-unmeasured", "suspect"],
      ],
    );
  });
});

describe("compareVerissClaims", () => {
  const claim = (id: string, decided: boolean, paths: string[]) => ({
    id,
    width: 1280,
    status: decided ? (paths.length ? "violated" : "verified") : "unknown",
    decided,
    overflows: paths.map((path) => ({ path, label: ".s", message: ".s requires 108px but receives 106px" })),
  });
  const drawn = (id: string, paths: string[], unmapped: string[] = []) => ({
    id,
    width: 1280,
    overflows: paths.map((path) => ({ path, label: ".s", amount: 2 })),
    unmapped,
  });

  it("agrees where both say the same, including nothing at all in a decided branch", () => {
    const c = compareVerissClaims(
      [claim("firefox:none", true, ["Document/0/0"]), claim("chromium:none", true, [])],
      [drawn("firefox:none", ["Document/0/0"]), drawn("chromium:none", [])],
    );
    assert.deepEqual(
      [c.pairs, c.decided, c.agreedPairs, c.compared, c.agreed, c.disagreements.length],
      [2, 2, 2, 1, 1, 0],
    );
  });

  it("disagrees both ways: a claim the browser does not draw, and an overflow a decided branch does not claim", () => {
    const c = compareVerissClaims(
      [claim("firefox:none", true, ["Document/0/0"]), claim("webkit:none", true, [])],
      [drawn("firefox:none", []), drawn("webkit:none", ["Document/0/0"])],
    );
    assert.deepEqual(
      c.disagreements.map((d) => [d.id, d.veriss, d.browser]),
      [
        ["firefox:none", "overflows", "fits"],
        ["webkit:none", "fits", "overflows"],
      ],
    );
    assert.equal(c.agreedPairs, 0);
  });

  it("an Unknown branch's silence is not compared, and a box whose element veriss's label does not name is left out", () => {
    const c = compareVerissClaims(
      [claim("firefox:normalize", false, []), claim("firefox:none", true, ["Document/0/1"])],
      [drawn("firefox:normalize", ["Document/0/0"]), drawn("firefox:none", [], ["Document/0/1"])],
    );
    assert.deepEqual([c.decided, c.compared, c.disagreements.length], [1, 0, 0]);
  });
});
