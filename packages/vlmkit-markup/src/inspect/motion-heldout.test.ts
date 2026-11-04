/**
 * The held-out motion pages (fixtures/motion-heldout): written by an agent that never saw this
 * code, ten defect classes in other forms than the rounds' fixtures, each with a correct page
 * built to look like the defect. Every broken page must fail as recorded, and every correct page
 * must pass `inspect motion` and get no `check animation` issue beyond what its brief leaves open.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "vite-plus/test";
import { runAnimationEval } from "@mizchi/vlmkit-animation-eval";
import { runMotionCli } from "./motion-cli.ts";

interface HeldOutCase {
  id: string;
  file: string;
  intent: "broken" | "correct";
  args: string[];
  expect: { motion: { exit: number; rule?: string }; animation: string[] };
}

const dir = join(import.meta.dirname, "../../../../fixtures/motion-heldout");
const cases = JSON.parse(readFileSync(join(dir, "cases.json"), "utf8")) as HeldOutCase[];
// Not about the motion the briefs describe: no brief sets a reduced-motion policy, and a loader
// is meant to run forever.
const OUT_OF_BRIEF = new Set(["reduced-motion-ignored", "infinite-animation"]);

const quiet = async <T>(f: () => Promise<T>) => {
  const lines: string[] = [];
  const log = console.log;
  const error = console.error;
  console.log = (m: string) => lines.push(String(m));
  console.error = (m: string) => lines.push(String(m));
  try {
    return { value: await f(), out: lines.join("\n") };
  } finally {
    console.log = log;
    console.error = error;
  }
};

describe("the held-out motion pages", () => {
  for (const c of cases) {
    it(`${c.id} (${c.intent}): inspect motion and check animation as recorded`, { timeout: 240_000 }, async () => {
      const page = join(dir, c.file);
      const frames = await mkdtemp(join(tmpdir(), "vlmkit-heldout-"));
      const motion = await quiet(() => runMotionCli([page, ...c.args, "--frames", frames]));
      assert.equal(motion.value, c.expect.motion.exit, motion.out);
      if (c.expect.motion.rule) assert.match(motion.out, new RegExp(`FAIL ${c.expect.motion.rule}\\b`), motion.out);
      if (c.intent === "correct") assert.doesNotMatch(motion.out, /FAIL /, motion.out);
      const report = await runAnimationEval({ source: page });
      const kinds = [...new Set(report.issues.map((i) => i.kind).filter((k) => !OUT_OF_BRIEF.has(k)))].sort();
      assert.deepEqual(kinds, [...c.expect.animation].sort(), JSON.stringify(report.issues));
    });
  }
});
