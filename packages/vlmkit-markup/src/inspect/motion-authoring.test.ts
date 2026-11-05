/**
 * What the motion-authoring A/B (docs/reports/2026-11-05-motion-authoring-ab-v1.md) found: on pages
 * written from a brief, correct motion read as a fail, and some briefs had no flag to say what they
 * asked. Each case is a reference page from fixtures/motion-authoring (correct by its hidden oracle)
 * or one of its mutants (a planted slip the oracle fails).
 */
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "vite-plus/test";
import { runAnimationEval } from "@mizchi/vlmkit-animation-eval";
import { runMotionCli } from "./motion-cli.ts";

const dir = join(import.meta.dirname, "../../../../fixtures/motion-authoring");
const ref = (name: string) => join(dir, "reference", `${name}.html`);
const mutant = (name: string) => join(dir, "mutants", `${name}.html`);

const motion = async (page: string, args: string[]) => {
  const lines: string[] = [];
  const log = console.log;
  const error = console.error;
  console.log = (m: string) => lines.push(String(m));
  console.error = (m: string) => lines.push(String(m));
  try {
    const frames = await mkdtemp(join(tmpdir(), "vlmkit-authoring-"));
    return { code: await runMotionCli([page, ...args, "--frames", frames, "--no-ledger"]), out: lines.join("\n") };
  } finally {
    console.log = log;
    console.error = error;
  }
};
const T = { timeout: 240_000 };

describe("motion-authoring v1: correct motion is not a fail", () => {
  it("nine tiles growing in place: no size-jump, and their centre origin is judged", T, async () => {
    const tiles = Array.from({ length: 9 }, (_, i) => ["--selector", `.tile:nth-child(${i + 1})`]).flat();
    const r = await motion(ref("grid"), [...tiles, "--expect-easing", "ease-out", "--expect-origin", "center"]);
    assert.equal(r.code, 0, r.out);
    assert.doesNotMatch(r.out, /size-jump|not judged/, r.out);
    assert.match(r.out, /held: .*--expect-origin center/, r.out);
  });

  it("a bell swinging from its top: the way it first turns, its turning points and its pivot", T, async () => {
    const args = ["--selector", ".bell-icon", "--expect-direction", "clockwise", "--expect-origin", "top"];
    const r = await motion(ref("bell"), args);
    assert.equal(r.code, 0, r.out);
    // Turning points at the frames shot (11 over the swing), so near the peaks, not on them.
    assert.match(
      r.out,
      /swings clockwise first about the middle of its top edge: \+1\d°, -1\d°, \+\d°, -\d°, then upright/,
      r.out,
    );
    assert.match(r.out, /held: --expect-direction clockwise, --expect-origin top/, r.out);
    const wrong = await motion(ref("bell"), ["--selector", ".bell-icon", "--expect-direction", "counterclockwise"]);
    assert.match(wrong.out, /FAIL direction-mismatch .*it turns clockwise \(1\d° first\)/, wrong.out);
  });

  it("the same bell swinging about its centre fails origin-mismatch", T, async () => {
    const r = await motion(mutant("bell-centre"), ["--selector", ".bell-icon", "--expect-origin", "top"]);
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /FAIL origin-mismatch .*it turns about its centre/, r.out);
    assert.doesNotMatch(r.out, /size-jump/, r.out);
  });

  it("a ticker one copy long and a shimmer clipped at both ends: no loop-seam in either gate", T, async () => {
    for (const [page, sel] of [
      [ref("marquee"), ".track"],
      [ref("skeleton"), ".shimmer"],
    ] as const) {
      const r = await motion(page, ["--selector", sel]);
      assert.doesNotMatch(r.out, /loop-seam/, r.out);
      const report = await runAnimationEval({ source: page });
      const kinds = report.issues.map((i) => i.kind);
      assert.ok(!kinds.includes("loop-seam"), JSON.stringify(report.issues));
      assert.ok(!kinds.includes("no-visible-effect"), JSON.stringify(report.issues));
    }
  });

  it("a marquee paused under the pointer stays still on the held clock; one that is not, fails", T, async () => {
    const args = ["--selector", ".track", "--hover", ".strip", "--expect-still"];
    const paused = await motion(ref("marquee"), args);
    assert.equal(paused.code, 0, paused.out);
    assert.match(paused.out, /held: --expect-still/, paused.out);
    const runs = await motion(mutant("marquee-nopause"), args);
    assert.match(runs.out, /FAIL still-mismatch .*animation-play-state: paused/, runs.out);
  });

  it("a button under a 50% backdrop is dimmed, not hidden; --still names it as a target", T, async () => {
    const r = await motion(ref("modal"), ["--click", ".delete", "--selector", ".dialog", "--still", ".delete"]);
    assert.equal(r.code, 0, r.out);
    assert.doesNotMatch(r.out, /hidden-at-once|covered-edge|target-unchanged/, r.out);
  });
});

describe("motion-authoring v1: what the briefs asked, as flags", () => {
  it("--expect-span-of holds the indicator to its tab's edges at rest", T, async () => {
    const base = ["--click", "button.tab:nth-child(4)", "--selector", "span.indicator"];
    const under = await motion(ref("tabs"), [...base, "--expect-span-of", "button.tab:nth-child(4)"]);
    assert.equal(under.code, 0, under.out);
    assert.match(under.out, /held: --expect-span-of button\.tab:nth-child\(4\)/, under.out);
    const off = await motion(ref("tabs"), [...base, "--expect-span-of", "button.tab:nth-child(3)"]);
    assert.equal(off.code, 1, off.out);
    assert.match(off.out, /FAIL span-mismatch/, off.out);
  });

  it("--reduced-motion: going at once is what is asked, not snapped", T, async () => {
    const r = await motion(ref("tabs"), [
      "--reduced-motion",
      "--click",
      "button.tab:nth-child(4)",
      "--selector",
      "span.indicator",
    ]);
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /at once, with no motion: what reduced motion asks for/, r.out);
    assert.doesNotMatch(r.out, /FAIL/, r.out);
  });

  it("--expect-start +0 counts from the last action, and any leaves a target out", T, async () => {
    const r = await motion(ref("modal"), [
      "--click",
      ".delete",
      "--click",
      ".cancel",
      "--selector",
      ".backdrop",
      "--selector",
      ".dialog",
      "--exits",
      "--expect-start",
      "+0,any",
    ]);
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /held: --expect-start \+0,any/, r.out);
  });
});
