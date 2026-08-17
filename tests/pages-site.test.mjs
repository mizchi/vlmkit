/**
 * The composed GitHub Pages site: what gets published, and at which URL.
 *
 * This used to live in `examples/vlmkit-intro-page/page.test.mjs`, when the site WAS the intro
 * page. It moved here when solitaire joined it, because the layout is now a repo-level fact and
 * a test inside one example is the wrong owner of "the other example is at /solitaire/".
 *
 * What is worth asserting here is narrow but load-bearing:
 *
 * - The allowlist publishes browser runtime files and NOTHING else. An example directory holds
 *   tests, a README and Playwright baselines; the deploy is the one place where accidentally
 *   publishing them is a public mistake rather than a local one.
 * - Every published `index.html` reaches its own assets by a relative path, because the site is
 *   served from `/vlmkit/` and not from a domain root. An absolute `/styles.css` renders
 *   perfectly on `file://` and 404s on Pages, which is the failure this catches.
 * - The two pages link to each other. Deploying solitaire to a URL nothing points at is a
 *   separate site that happens to share a host.
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { onTestFinished, test } from "vitest";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));

async function buildIntoTempDir() {
  const { buildSite, siteSections } = await import("../scripts/build-pages.mjs");
  const temporaryDir = await mkdtemp(join(tmpdir(), "vlmkit-pages-"));
  onTestFinished(() => rm(temporaryDir, { recursive: true, force: true }));
  const outputDir = join(temporaryDir, ".pages");
  const result = await buildSite({ sourceRoot: repoRoot, outputDir });
  return { outputDir, result, siteSections };
}

test("the site manifest declares the intro page at the root and solitaire under /solitaire/", async () => {
  const { siteSections } = await import("../scripts/build-pages.mjs");

  assert.deepEqual(
    siteSections.map(({ id, sourceDir, basePath }) => ({ id, sourceDir, basePath })),
    [
      { id: "intro", sourceDir: "examples/vlmkit-intro-page", basePath: "" },
      { id: "solitaire", sourceDir: "examples/solitaire", basePath: "solitaire" },
    ],
  );
  assert.deepEqual(siteSections[0].assets, [
    "app.js",
    "content.js",
    "demo-solitaire.png",
    "index.html",
    "preferences.js",
    "proof-diff.png",
    "proof-implementation.png",
    "proof-target.png",
    "scenarios.js",
    "styles.css",
  ]);
  // Four files and no build step is why solitaire can be published as-is.
  assert.deepEqual(siteSections[1].assets, [
    "game.js",
    "index.html",
    "rules.js",
    "solitaire.css",
  ]);
});

test("the build publishes only browser runtime assets, byte-identical to the sources", async () => {
  const { outputDir, result, siteSections } = await buildIntoTempDir();

  assert.deepEqual((await readdir(outputDir)).sort(), [
    ".nojekyll",
    "app.js",
    "content.js",
    "demo-solitaire.png",
    "index.html",
    "preferences.js",
    "proof-diff.png",
    "proof-implementation.png",
    "proof-target.png",
    "scenarios.js",
    "solitaire",
    "styles.css",
  ]);
  assert.deepEqual((await readdir(join(outputDir, "solitaire"))).sort(), [
    "game.js",
    "index.html",
    "rules.js",
    "solitaire.css",
  ]);
  assert.equal(await readFile(join(outputDir, ".nojekyll"), "utf8"), "");
  assert.deepEqual(
    result.sections.map(({ id, basePath }) => ({ id, basePath })),
    [
      { id: "intro", basePath: "" },
      { id: "solitaire", basePath: "solitaire" },
    ],
  );

  for (const section of siteSections) {
    for (const asset of section.assets) {
      const published = join(outputDir, section.basePath, asset);
      const source = join(repoRoot, section.sourceDir, asset);
      assert.deepEqual(await readFile(published), await readFile(source), `${section.id}/${asset}`);
    }
  }
});

test("no published page reaches an asset by an absolute path", async () => {
  const { outputDir, siteSections } = await buildIntoTempDir();

  for (const section of siteSections) {
    const html = await readFile(join(outputDir, section.basePath, "index.html"), "utf8");
    // Attribute values starting with a single "/" — absolute to the HOST, which on
    // mizchi.github.io is not this site. `//host/path` and `https://` are unaffected.
    const absolute = [...html.matchAll(/\b(?:src|href)="(\/(?!\/)[^"]*)"/g)].map((m) => m[1]);
    assert.deepEqual(absolute, [], `${section.id}/index.html links host-absolute assets`);
  }
});

test("the two published pages link to each other", async () => {
  const { outputDir } = await buildIntoTempDir();

  const intro = await readFile(join(outputDir, "index.html"), "utf8");
  const solitaire = await readFile(join(outputDir, "solitaire", "index.html"), "utf8");

  assert.match(intro, /href="\.\/solitaire\/"/);
  // Relative, so it resolves under /vlmkit/ on Pages and to the examples directory locally —
  // one directory up is the site root in both cases, which an absolute site URL would not be.
  assert.match(solitaire, /href="\.\.\/"/);
});

test("the build refuses an output directory that would delete a source tree", async () => {
  const { buildSite } = await import("../scripts/build-pages.mjs");

  // The build starts with `rm -rf` on its output, so both of these guards protect real files.
  await assert.rejects(
    () => buildSite({ sourceRoot: repoRoot, outputDir: join(repoRoot, "examples") }),
    /isolated directory named "\.pages"/,
  );
  // Named `.pages` and yet a section's own source: the name check passes and the second guard
  // is the only thing standing between the build and deleting the tree it is about to copy.
  await assert.rejects(
    () =>
      buildSite({
        sourceRoot: repoRoot,
        outputDir: join(repoRoot, ".pages"),
        sections: [{ id: "x", sourceDir: ".pages", basePath: "", assets: [] }],
      }),
    /must not be a section source directory \(x\)/,
  );
  await assert.rejects(
    () =>
      buildSite({
        sourceRoot: repoRoot,
        outputDir: join(repoRoot, ".pages"),
        sections: [
          { id: "a", sourceDir: "examples/solitaire", basePath: "", assets: [] },
          { id: "b", sourceDir: "examples/vlmkit-intro-page", basePath: "", assets: [] },
        ],
      }),
    /publish to the same path/,
  );
});
