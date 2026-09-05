/**
 * Scenes generated from a repository: the workspace map from package.json
 * files and the change map from a commit range. Checked like any scene, plus
 * the facts a reader would verify: which areas, which edges, which beats.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, describe, it } from "vitest";
import { checkAnimation, explain } from "../check.ts";
import { compileScene } from "../compile/index.ts";
import { formatDiagnostics } from "../validate.ts";
import { areaOf, changeMapScene, readWorkspace, workspaceScene } from "./git.ts";

const REPO = resolve(import.meta.dirname!, "../../../..");

describe("workspaceScene", () => {
  it("reads this workspace: core depends on nothing, anim on animation-eval, the CLI on everything; compiles clean", () => {
    const pkgs = readWorkspace(REPO);
    const by = new Map(pkgs.map((p) => [p.id, p]));
    assert.deepEqual(by.get("core")!.deps, []);
    assert.deepEqual(by.get("anim")!.deps, ["ai", "animation-eval"]);
    assert.ok(by.get("vlmkit (cli)")!.deps.includes("anim"));
    const scene = workspaceScene(REPO);
    const tl = compileScene(scene);
    const diags = checkAnimation(tl, scene);
    assert.deepEqual(diags.filter((d) => d.severity === "error"), [], formatDiagnostics(diags));
    const text = explain(tl);
    assert.match(text, /core: depends on nothing else in the workspace/);
    assert.match(text, /anim → (ai, )?animation-eval/);
    // One beat per layer, not one per package, and the readout rides each beat.
    assert.ok((tl.steps ?? []).filter((s) => /packages so far = \d+/.test(s.caption ?? "")).length >= 3);
  });
});

describe("areaOf", () => {
  it("groups paths at the granularity a reader can take in", () => {
    assert.equal(areaOf("packages/vlmkit-anim/src/compile/list.ts"), "anim/src");
    assert.equal(areaOf("packages/vlmkit-anim/fixtures/x.json"), "anim/fixtures");
    assert.equal(areaOf("packages/vlmkit-anim/package.json"), "anim");
    assert.equal(areaOf("docs/reports/2026-09-05-x.md"), "docs/reports");
    assert.equal(areaOf("docs/anim-ir.md"), "docs");
    assert.equal(areaOf("fixtures/anim-scenario/attempts/da/log.md"), "fixtures/anim-scenario");
    assert.equal(areaOf(".github/workflows/x.yml"), "ci");
    assert.equal(areaOf("package.json"), "root");
    assert.equal(areaOf("tests/x.test.mjs"), "tests");
  });
});

describe("changeMapScene", () => {
  const dir = mkdtempSync(join(tmpdir(), "vlm-anim-git-"));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));
  const git = (...args: string[]): string => execFileSync("git", args, { cwd: dir, encoding: "utf8", env: { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" } });
  const write = (rel: string, text: string): void => {
    mkdirSync(join(dir, rel, ".."), { recursive: true });
    writeFileSync(join(dir, rel), text);
  };

  it("one beat per commit, areas appear as they are touched, import edges between changed areas, running counts", () => {
    git("init", "-q", "-b", "main");
    write("packages/vlmkit-core/src/a.ts", "export const a = 1;\n");
    git("add", "-A");
    git("commit", "-q", "-m", "base");
    write("packages/vlmkit-markup/src/b.ts", 'import { a } from "@mizchi/vlmkit-core/a.ts";\nexport const b = a + 1;\n');
    write("docs/guide.md", "# guide\n");
    git("add", "-A");
    git("commit", "-q", "-m", "markup reads core; a guide");
    write("packages/vlmkit-core/src/a.ts", "export const a = 2;\nexport const c = 3;\n");
    write("tests/x.test.mjs", "// test\n");
    git("add", "-A");
    git("commit", "-q", "-m", "core grows, a test");

    const map = changeMapScene({ root: dir, base: "main~2", head: "main", title: "two commits" });
    assert.equal(map.commits, 2);
    assert.equal(map.files, 4);
    assert.deepEqual([...map.areas].sort(), ["core/src", "docs", "markup/src", "tests"]);
    assert.deepEqual(map.scene.edges?.map((e) => `${e.from}->${e.to}`), ["markup/src->core/src"]);
    const tl = compileScene(map.scene);
    const diags = checkAnimation(tl, map.scene);
    assert.deepEqual(diags, [], formatDiagnostics(diags)); // no off-canvas node, no silent warning: the canvas is sized to the areas
    const text = explain(tl);
    assert.match(text, /1\/2 markup reads core; a guide · files changed = 2 · lines = \+3 −0/);
    assert.match(text, /2\/2 core grows, a test · files changed = 4 · lines = \+6 −1/);
    assert.match(text, /2 commits · 4 files · \+6 −1 · 4 areas, 1 import edges/);
    // Beats: title, one per commit, the closing note, end — nothing merged.
    assert.equal((tl.steps ?? []).length, 5, text);
  });

  it("many long-named areas stay on the canvas (the grid is sized to them)", () => {
    for (let i = 0; i < 12; i++) write(`packages/vlmkit-package-number-${i}/src/index.ts`, `export const n = ${i};\n`);
    git("add", "-A");
    git("commit", "-q", "-m", "twelve packages");
    const map = changeMapScene({ root: dir, base: "main~1", head: "main" });
    const tl = compileScene(map.scene);
    const diags = checkAnimation(tl, map.scene);
    assert.deepEqual(diags, [], formatDiagnostics(diags));
    assert.ok(tl.canvas.width >= 640 && tl.canvas.height > 360, `canvas ${tl.canvas.width}×${tl.canvas.height}`);
    git("reset", "-q", "--hard", "main~1");
  });

  it("an empty range is a scene that says so", () => {
    const map = changeMapScene({ root: dir, base: "main", head: "main" });
    assert.equal(map.commits, 0);
    const tl = compileScene(map.scene);
    assert.match(explain(tl), /no commits in main\.\.main/);
  });
});
