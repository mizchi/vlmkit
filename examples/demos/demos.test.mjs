/**
 * The demo gallery is generated, and these hold it to what generated it — without a browser, so
 * they run in the ordinary suite. Re-capturing (running the commands, taking the screenshots) is
 * `capture.mjs`'s job; what can drift without it is checked here:
 *
 * - every page under test and every extra is a byte copy of its source, so a fixture edited after
 *   the capture fails here rather than publishing a page the output no longer describes;
 * - every capture exists, kept its output and exit code, and names every image it shows;
 * - every outline on a screenshot marks a selector the command itself printed;
 * - the committed HTML equals a fresh render of the manifest and the captures;
 * - the README links the gallery and every demo in it.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "vite-plus/test";
import { DEMOS, GROUPS, demoFiles } from "./demos.mjs";
import { readResult, renderGallery, renderReadmeBlock } from "./render.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../..");

test("ids are unique, and every demo sits in a group that exists", () => {
  assert.equal(new Set(DEMOS.map((d) => d.id)).size, DEMOS.length);
  for (const d of DEMOS)
    assert.ok(
      GROUPS.some((g) => g.id === d.group),
      `${d.id}: group ${d.group}`,
    );
  for (const g of GROUPS)
    assert.ok(
      DEMOS.some((d) => d.group === g.id),
      `group ${g.id} is empty`,
    );
});

test("every page under test and every extra is a byte copy of its source", () => {
  for (const d of DEMOS) {
    const copies = [{ from: d.page, as: d.pageAs ?? "page.html" }, ...(d.extras ?? [])];
    for (const { from, as } of copies) {
      assert.deepEqual(
        readFileSync(join(here, d.id, as)),
        readFileSync(join(repoRoot, from)),
        `${d.id}/${as} ← ${from}`,
      );
    }
  }
});

test("every demo was captured: output, exit code, and each image it names", () => {
  for (const d of DEMOS) {
    const r = readResult(d.id);
    assert.ok(r, `${d.id} has no result.json — run capture.mjs ${d.id}`);
    assert.equal(typeof r.exit, "number", `${d.id}: exit code`);
    assert.ok(r.output.trim().length > 0, `${d.id}: output`);
    if (d.then) assert.ok(r.thenOutput?.trim(), `${d.id}: second command's output`);
    assert.equal(
      r.images.length,
      (d.shots ?? []).length + (d.evidence ?? []).length + (d.special === "zoom" ? 3 : 0),
      `${d.id}: images`,
    );
    for (const f of demoFiles(d, r)) assert.ok(existsSync(join(here, d.id, f)), `${d.id}/${f}`);
    // No machine paths leak into a published page.
    assert.doesNotMatch(
      `${r.output}${r.thenOutput ?? ""}${r.report ?? ""}`,
      /\/home\/|\/tmp\/|\/Users\//,
      `${d.id}: output carries a local path`,
    );
  }
});

test("an outline only marks what the command itself named", () => {
  for (const d of DEMOS) {
    const r = readResult(d.id);
    const said = `${r.output}${r.thenOutput ?? ""}`;
    for (const shot of d.shots ?? [])
      for (const sel of shot.mark ?? []) assert.ok(said.includes(sel), `${d.id}: "${sel}"`);
  }
});

test("the committed pages equal a fresh render", () => {
  for (const [path, html] of Object.entries(renderGallery())) {
    assert.equal(readFileSync(join(here, path), "utf8"), html, `${path} is stale — run node examples/demos/render.mjs`);
  }
});

test("the README links the gallery and every demo, in the generated table", () => {
  const readme = readFileSync(join(repoRoot, "README.md"), "utf8");
  assert.ok(readme.includes(renderReadmeBlock()), "README's demo table is stale — run node examples/demos/render.mjs");
  assert.match(readme, /https:\/\/mizchi\.github\.io\/vlmkit\/demos\//);
  for (const d of DEMOS) assert.ok(readme.includes(`/demos/${d.id}/`), `README links ${d.id}`);
});
