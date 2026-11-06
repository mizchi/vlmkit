/**
 * `inspect motion --baseline` (issue #214): a passing run is written down, and a later run is held
 * to it. The references of fixtures/motion-authoring (v1 and v2) pass against their own baseline,
 * and each mutant whose motion differs fails by `baseline-mismatch`, naming what changed. The
 * canvas slide of fixtures/motion-track is held the same way through --track.
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "vite-plus/test";
import { runMotionCli } from "./motion-cli.ts";

const root = join(import.meta.dirname, "../../../../fixtures");
const v1 = (kind: string, name: string) => join(root, "motion-authoring", kind, `${name}.html`);
const v2 = (kind: string, name: string) => join(root, "motion-authoring", "v2", kind, `${name}.html`);

const motion = async (page: string, args: string[]) => {
  const lines: string[] = [];
  const log = console.log;
  const error = console.error;
  console.log = (m: string) => lines.push(String(m));
  console.error = (m: string) => lines.push(String(m));
  try {
    const frames = await mkdtemp(join(tmpdir(), "vlmkit-baseline-"));
    return { code: await runMotionCli([page, ...args, "--frames", frames, "--no-ledger"]), out: lines.join("\n") };
  } finally {
    console.log = log;
    console.error = error;
  }
};
const T = { timeout: 300_000 };
const file = async (name: string) => join(await mkdtemp(join(tmpdir(), "vlmkit-baseline-file-")), name);

/** Write the baseline from the reference, pass against it, and fail the mutant with `changed`. */
async function held(reference: string, mutant: string, args: string[], changed: RegExp) {
  const path = await file("b.json");
  const first = await motion(reference, [...args, "--baseline", path]);
  assert.equal(first.code, 0, first.out);
  assert.match(first.out, /baseline: written to .*\(1 target\)/, first.out);
  const again = await motion(reference, [...args, "--baseline", path]);
  assert.equal(again.code, 0, again.out);
  assert.match(again.out, /baseline: held to .* nothing changed past its tolerances/, again.out);
  const bad = await motion(mutant, [...args, "--baseline", path]);
  assert.equal(bad.code, 1, bad.out);
  assert.match(bad.out, changed, bad.out);
  return path;
}

describe("inspect motion --baseline: a motion held to the run that was approved", () => {
  it("tabs: the indicator's curve", T, async () => {
    await held(
      v1("reference", "tabs"),
      v1("mutants", "tabs-ease"),
      ["--click", "button.tab:nth-child(4)", "--selector", "span.indicator"],
      /FAIL baseline-mismatch .*follows ease-in-out → ease — if the change is meant, write it again with --update-baseline/,
    );
  });

  it("bell: the point it swings about", T, async () => {
    await held(
      v1("reference", "bell"),
      v1("mutants", "bell-centre"),
      ["--selector", ".bell-icon"],
      /turns about top → center/,
    );
  });

  it("gauge and label (v2): where the needle turns and how far the button widens", T, async () => {
    await held(
      v2("reference", "gauge"),
      v2("mutants", "gauge-origin"),
      ["--selector", ".needle"],
      /turns about right → \(/,
    );
    await held(
      v2("reference", "label"),
      v2("mutants", "label-wrap"),
      ["--click", ".add", "--selector", ".add"],
      /travels 52px → 27px; rests at \(114,62\) → \(89,62\)/,
    );
  });

  it("a canvas slide through --track, named so its region can be redrawn", T, async () => {
    const slide = (kind: string) => `${join(root, "motion-track", "slide.html")}?kind=${kind}`;
    const args = (r: string) => ["--track", r, "--target", "square", "--start", "200", "--end", "800"];
    const path = await held(slide("intact"), slide("linear"), args("800,360,80,80"), /follows ease-out → linear/);
    const left = await motion(slide("left"), [...args("200,360,80,80"), "--baseline", path]);
    assert.match(left.out, /moves right → left; rests at \(840,400\) → \(240,400\)/, left.out);
  });

  it("writes nothing from a failing run, and --update-baseline rewrites from a passing one", T, async () => {
    const path = await file("b.json");
    const failing = await motion(v1("mutants", "bell-centre"), [
      "--selector",
      ".bell-icon",
      "--expect-origin",
      "top",
      "--baseline",
      path,
    ]);
    assert.equal(failing.code, 1, failing.out);
    assert.match(failing.out, /baseline: not written .*a failing run is not one to hold later runs to/);
    await assert.rejects(stat(path));
    await motion(v1("reference", "bell"), ["--selector", ".bell-icon", "--baseline", path]);
    const moved = await motion(v1("mutants", "bell-centre"), [
      "--selector",
      ".bell-icon",
      "--baseline",
      path,
      "--update-baseline",
    ]);
    assert.equal(moved.code, 0, moved.out);
    assert.match(moved.out, /baseline: rewritten to/);
    assert.equal(JSON.parse(await readFile(path, "utf-8")).targets[0].pivot.name, "center");
  });

  it("refuses what it cannot do", async () => {
    const page = v1("reference", "bell");
    assert.equal((await motion(page, ["--selector", ".bell-icon", "--update-baseline"])).code, 2);
    const every = await motion(page, [
      "--click",
      "a",
      "--click",
      "b",
      "--every-action",
      "--selector",
      "x",
      "--baseline",
      "b.json",
    ]);
    assert.equal(every.code, 2);
    assert.match(every.out, /one baseline holds one sampled motion/);
  });
});
