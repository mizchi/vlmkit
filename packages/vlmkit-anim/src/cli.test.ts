/**
 * `vlmkit-anim` through the real dispatcher: the verbs an agent's loop runs,
 * their exit codes, and that the schema sheet's own examples pass `check`.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, describe, it } from "vitest";
import { EXAMPLES } from "./schema-sheet.ts";

const CLI = resolve(import.meta.dirname!, "cli.ts");
const FIXTURES = resolve(import.meta.dirname!, "../fixtures");
const dir = mkdtempSync(join(tmpdir(), "vlm-anim-cli-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

function run(args: string[]): { stdout: string; stderr: string; status: number } {
  const r = spawnSync(process.execPath, ["--experimental-strip-types", CLI, ...args], {
    encoding: "utf-8",
    env: { ...process.env, NO_COLOR: "1" },
    timeout: 60_000,
  });
  return { stdout: r.stdout ?? "", stderr: r.stderr ?? "", status: r.status ?? 1 };
}

describe("vlmkit-anim", () => {
  it("--help exits 0 and lists the verbs", () => {
    const r = run(["--help"]);
    assert.equal(r.status, 0);
    for (const verb of ["check", "validate", "compile", "explain", "render", "frames", "html", "eval", "schema"]) assert.match(r.stdout, new RegExp(`^  ${verb}`, "m"));
  });

  it("accepts a TypeScript module whose default export is a scene, and names the fix when a module exports none", () => {
    const r = run(["check", join(FIXTURES, "sort-insertion.scene.ts")]);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /✓ sort-insertion\.scene\.ts \(sort\): 0 error\(s\)/);
    const e = run(["explain", join(FIXTURES, "sort-insertion.scene.ts")]);
    assert.match(e.stdout, /Insertion sort/);
    const empty = join(dir, "no-scene.mjs");
    writeFileSync(empty, "export const other = 1;\n");
    const bad = run(["check", empty]);
    assert.equal(bad.status, 1);
    assert.match(bad.stdout, /exports no scene/);
    assert.match(bad.stdout, /export default scene\.sort/);
  });

  it("eval measures an emitted page with the shared evaluator and exits 0 when nothing is suspect", () => {
    const page = join(dir, "eval-sort.html");
    assert.equal(run(["html", join(FIXTURES, "sort-bubble.json"), "--out", page]).status, 0);
    const r = run(["eval", page, "--samples", "2", "--viewport", "800x500"]);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /animations: \d+ \(evaluated \d+/);
    assert.match(r.stdout, /reduced-motion: honored/);
    const j = run(["eval", page, "--samples", "2", "--json"]);
    assert.equal(j.status, 0, j.stderr);
    const report = JSON.parse(j.stdout);
    assert.ok(report.animationCount > 0);
    assert.deepEqual(report.issues.filter((i: { severity: string }) => i.severity === "suspect"), []);
    const missing = run(["eval"]);
    assert.equal(missing.status, 1);
    assert.match(missing.stderr, /eval needs a page/);
    const badViewport = run(["eval", page, "--viewport", "wide"]);
    assert.equal(badViewport.status, 1);
    assert.match(badViewport.stderr, /--viewport takes WxH/);
  }, 120_000);

  it("check passes every fixture and every schema example, printing stats", () => {
    const files = readdirSync(FIXTURES).filter((f) => f.endsWith(".json")).map((f) => join(FIXTURES, f));
    for (const [kind, ex] of Object.entries(EXAMPLES)) {
      const p = join(dir, `example-${kind}.json`);
      writeFileSync(p, JSON.stringify(ex, null, 2));
      files.push(p);
    }
    for (const f of files) {
      const r = run(["check", f]);
      assert.equal(r.status, 0, `${f}\n${r.stdout}${r.stderr}`);
      assert.match(r.stdout, /✓ .*: 0 error\(s\)/);
      assert.match(r.stdout, /\d+ms · \d+ steps/);
    }
  });

  it("check on a broken scene exits 1 with path, message and hint, and --json carries the same", () => {
    const p = join(dir, "bad.json");
    writeFileSync(p, JSON.stringify({ ...EXAMPLES.sort, algorithm: "buble", valeus: [1] }));
    const r = run(["check", p]);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /✗ algorithm: .*"buble".*\n\s+→ did you mean "bubble"\?/);
    assert.match(r.stdout, /✗ valeus: unknown key/);
    const j = run(["check", p, "--json"]);
    assert.equal(j.status, 1);
    const parsed = JSON.parse(j.stdout);
    assert.equal(parsed.ok, false);
    assert.ok(parsed.diagnostics.some((d: { path: string }) => d.path === "algorithm"));
  });

  it("invalid JSON is a one-line diagnostic, not a stack trace", () => {
    const p = join(dir, "syntax.json");
    writeFileSync(p, '{"format": "vlmkit-anim/scene@1", "kind": "sort",}');
    const r = run(["check", p]);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /not valid JSON/);
    assert.doesNotMatch(r.stdout + r.stderr, /at JSON\.parse/);
  });

  it("compile → the timeline passes check on its own; explain lists the steps", () => {
    const scene = join(FIXTURES, "state-tcp.json");
    const out = join(dir, "tcp.timeline.json");
    assert.equal(run(["compile", scene, "--out", out]).status, 0);
    const tl = JSON.parse(readFileSync(out, "utf-8"));
    assert.equal(tl.format, "vlmkit-anim/timeline@1");
    const chk = run(["check", out]);
    assert.equal(chk.status, 0, chk.stdout);
    const ex = run(["explain", scene]);
    assert.equal(ex.status, 0);
    assert.match(ex.stdout, /on connect: CLOSED → SYN_SENT/);
  });

  it("render --step N writes an SVG for that step; frames writes one per step plus an index", () => {
    const scene = join(FIXTURES, "heap-min.json");
    const svg = join(dir, "step4.svg");
    const r = run(["render", scene, "--step", "4", "--out", svg]);
    assert.equal(r.status, 0, r.stderr);
    assert.match(readFileSync(svg, "utf-8"), /^<svg xmlns/);
    const bad = run(["render", scene, "--step", "999"]);
    assert.equal(bad.status, 1);
    assert.match(bad.stderr + bad.stdout, /out of range/);
    const framesDir = join(dir, "frames");
    const f = run(["frames", scene, "--out", framesDir]);
    assert.equal(f.status, 0, f.stderr);
    const index = JSON.parse(readFileSync(join(framesDir, "frames.json"), "utf-8"));
    assert.ok(index.frames.length >= 10);
    for (const fr of index.frames) assert.ok(existsSync(join(framesDir, fr.file)));
  });

  it("html writes a self-contained page: runtime inline, timeline inline, no external requests", () => {
    const out = join(dir, "page.html");
    assert.equal(run(["html", join(FIXTURES, "diagram-cdn.json"), "--out", out]).status, 0);
    const html = readFileSync(out, "utf-8");
    assert.match(html, /customElements\.define\("vlm-anim"/);
    assert.match(html, /<vlm-anim autoplay><script type="application\/json">\{"format":"vlmkit-anim\/timeline@1"/);
    assert.doesNotMatch(html, /<script src=|<link /);
  });

  it("sheet --out x.html writes a labelled contact sheet without a browser", () => {
    const out = join(dir, "sheet.html");
    const r = run(["sheet", join(FIXTURES, "state-tcp.json"), "--out", out, "--cols", "4", "--tile", "300"]);
    assert.equal(r.status, 0, r.stderr);
    const html = readFileSync(out, "utf-8");
    const tiles = html.match(/<figure>/g)?.length ?? 0;
    assert.ok(tiles >= 7, `expected one tile per step, got ${tiles}`);
    assert.match(html, /grid-template-columns: repeat\(4, 300px\)/);
    assert.match(html, /step 2 · \d+ms<\/b><span>on connect: CLOSED → SYN_SENT/);
    assert.doesNotMatch(html, /data-caption="true"/, "frames on the sheet carry no in-frame caption; the label under the tile has it");
    const missing = run(["sheet", join(FIXTURES, "state-tcp.json")]);
    assert.equal(missing.status, 1);
    assert.match(missing.stderr + missing.stdout, /needs --out/);
  });

  it("schema prints a sheet whose example is valid JSON and passes check", () => {
    const r = run(["schema", "--kind", "distributed"]);
    assert.equal(r.status, 0);
    const start = r.stdout.indexOf("Example\n") + "Example\n".length;
    const end = r.stdout.indexOf("\n\nThen:");
    const example = JSON.parse(r.stdout.slice(start, end));
    const p = join(dir, "from-schema.json");
    writeFileSync(p, JSON.stringify(example));
    assert.equal(run(["check", p]).status, 0);
    const unknown = run(["schema", "--kind", "trie"]);
    assert.equal(unknown.status, 1);
    assert.match(unknown.stderr + unknown.stdout, /unknown kind "trie"/);
  });
});
