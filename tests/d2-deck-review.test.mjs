/**
 * `deck-review`'s scoring half, driven over the v3 round's frozen readings.
 *
 * The shooting half needs Playwright and a browser; the scoring half is
 * deliberately dependency-free, so a reading can be re-scored anywhere — which
 * is what makes it testable here, against the four readings the v3 round
 * actually produced (`fixtures/d2-slides-scenario/v3/`).
 *
 * What is being pinned is the separation itself: the two readers shown the deck
 * as writer `f` delivered it score 0.70 and get their split named; the two shown
 * the same `deck.md` rebuilt score 1.00 with nothing to report. If that gap ever
 * closes, the measurement has stopped measuring.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "vitest";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const REVIEW = join(repoRoot, ".claude/skills/d2-slides/assets/deck-review.mjs");
const v3 = join(repoRoot, "fixtures/d2-slides-scenario/v3");
const SHEET = join(v3, "slides.json");

/** Score one frozen reading. No build directory is read: `--sheet` supplies the truth. */
function score(reading) {
  return execFileSync(process.execPath, [REVIEW, v3, "--answers", join(v3, reading), "--sheet", SHEET], {
    encoding: "utf8",
  });
}

const summary = (out) => out.match(/^read .*/m)?.[0] ?? "";

describe("deck-review: scoring a reading", () => {
  for (const reading of ["reading-r1.json", "reading-r2.json"]) {
    it(`${reading} read the deck as delivered: fidelity 0.70, and the split is named`, () => {
      const out = score(reading);
      assert.match(summary(out), /read 19\/21, invented 6, fidelity 0\.70/);
      assert.match(out, /⚠ SPLIT:/);
      assert.match(out, /every word is on the slide, the sentence is not/);
      assert.match(out, /1 sentence\(s\) rendered as two or more blocks/);
    });
  }

  for (const reading of ["reading-r3.json", "reading-r4.json"]) {
    it(`${reading} read the rebuilt deck: fidelity 1.00, nothing to name`, () => {
      const out = score(reading);
      assert.match(summary(out), /read 21\/21, invented 0, fidelity 1\.00/);
      assert.doesNotMatch(out, /SPLIT/);
      assert.doesNotMatch(out, /rendered as two or more blocks/);
    });
  }

  /**
   * r2 reported the defect as `clipped` — the right slides, the wrong
   * mechanism. The diagnosis must not depend on the reader having the word for
   * it, so this asserts the line comes out of a reading that never says "split".
   */
  it("names the split even when the reader called it something else", () => {
    const reading = JSON.parse(
      execFileSync("node", ["-e", `process.stdout.write(require("fs").readFileSync(${JSON.stringify(join(v3, "reading-r2.json"))}, "utf8"))`], { encoding: "utf8" }),
    );
    const kinds = reading.slides.flatMap((s) => (s.issues ?? []).map((i) => i.kind));
    assert.ok(kinds.length > 0, "r2 did report issues");
    assert.ok(!kinds.includes("split"), `r2 never used the word: ${kinds.join(", ")}`);
    assert.match(score("reading-r2.json"), /⚠ SPLIT:/);
  });

  it("counts a figure's labels apart from text the reader invented", () => {
    // r3 transcribed every figure label; r4 transcribed none. Both read all the
    // prose, so both must score 1.00 — reading the figure is not inventing.
    assert.match(score("reading-r3.json"), /figures: 1[0-9] label\(s\) read of \d+ drawn/);
    assert.match(score("reading-r4.json"), /figures: 0 label\(s\) read of \d+ drawn/);
    for (const r of ["reading-r3.json", "reading-r4.json"]) assert.match(summary(score(r)), /fidelity 1\.00/);
  });

  it("an order swap moves the order score and leaves fidelity alone", () => {
    const sheet = JSON.parse(execFileSync("node", ["-e", `process.stdout.write(require("fs").readFileSync(${JSON.stringify(SHEET)}, "utf8"))`], { encoding: "utf8" }));
    const reversed = {
      slides: sheet.slides.map((s) => ({ index: s.index, lines: [...s.lines].reverse(), issues: [] })),
    };
    const tmp = join(v3, ".reversed.tmp.json");
    execFileSync("node", ["-e", `require("fs").writeFileSync(${JSON.stringify(tmp)}, ${JSON.stringify(JSON.stringify(reversed))})`]);
    try {
      const out = execFileSync(process.execPath, [REVIEW, v3, "--answers", tmp, "--sheet", SHEET], { encoding: "utf8" });
      // Every line is present, so completeness is perfect and only order moves.
      assert.match(summary(out), /read 21\/21, invented 0, fidelity 1\.00/);
      assert.doesNotMatch(summary(out), /order 1\.00/);
    } finally {
      execFileSync("node", ["-e", `require("fs").rmSync(${JSON.stringify(tmp)}, { force: true })`]);
    }
  });
});
