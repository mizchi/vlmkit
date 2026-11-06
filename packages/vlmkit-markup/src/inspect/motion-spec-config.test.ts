/**
 * Issue #215: what each motion-authoring brief asks, written once in
 * fixtures/motion-authoring/vlmkit.gates.json as { "motion": ... } entries, and run as the config
 * compiles them. Every reference page passes, and every mutant whose slip the brief names fails
 * (grid-backwards-ok is a correct page written another way, and passes).
 */
import assert from "node:assert/strict";
import { readFile, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "vite-plus/test";
import { tokenizeCommand } from "@mizchi/vlmkit-core/arg-reader.ts";
import { parseGateConfig, resolveGatePlan } from "@mizchi/vlmkit-core/gate-config.ts";
import { runMotionCli } from "./motion-cli.ts";

const dir = join(import.meta.dirname, "../../../../fixtures/motion-authoring");

async function run(gate: string, page: string): Promise<{ code: number; out: string }> {
  const lines: string[] = [];
  const log = console.log;
  const error = console.error;
  console.log = (m: string) => lines.push(String(m));
  console.error = (m: string) => lines.push(String(m));
  try {
    const frames = await mkdtemp(join(tmpdir(), "vlmkit-spec-"));
    const args = [...tokenizeCommand(gate).slice(2), join(dir, page), "--frames", frames];
    return { code: await runMotionCli(args), out: lines.join("\n") };
  } finally {
    console.log = log;
    console.error = error;
  }
}

describe("fixtures/motion-authoring/vlmkit.gates.json: the briefs, declared", async () => {
  const config = parseGateConfig(await readFile(join(dir, "vlmkit.gates.json"), "utf-8"));
  const plan = resolveGatePlan(config);
  it("declares every reference page of v1 and v2, and their mutants", () => {
    const pages = new Set(plan.jobs.map((j) => j.source));
    for (const name of ["tabs", "grid", "bell", "marquee", "modal", "skeleton"])
      assert.ok(pages.has(`reference/${name}.html`), name);
    for (const name of ["badge", "gauge", "label", "lift", "menu", "reveal"])
      assert.ok(pages.has(`v2/reference/${name}.html`), name);
    assert.ok(plan.jobs.every((j) => j.gate.startsWith("inspect motion ")));
  });
  for (const job of plan.jobs) {
    const broken = /(^|\/)mutants\//.test(job.source) && !job.source.includes("grid-backwards-ok");
    it(`${job.pageId}: ${broken ? "fails" : "passes"}`, { timeout: 120_000 }, async () => {
      const r = await run(job.gate, job.source);
      assert.equal(r.code, broken ? 1 : 0, r.out);
    });
  }
});
