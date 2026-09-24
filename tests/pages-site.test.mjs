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
 *   tests, a README and Playwright baselines, and a judged site also holds its `judgment.sqlite`
 *   (raw events, and the gate outputs its log page inlines) and a copy manifest; the deploy is the
 *   one place where accidentally publishing them is a public mistake rather than a local one.
 * - Every published page reaches its assets by a relative path, because the site is served from
 *   `/vlmkit/` and not from a domain root. An absolute `/styles.css` renders perfectly on
 *   `file://` and 404s on Pages, which is the failure this catches.
 * - Every relative link on every published page arrives at a published file, and the pages link
 *   to each other: the landing page to solitaire, to the gallery and to its own log; the gallery
 *   to every demo site and every log. A page nothing points at is a separate site that happens to
 *   share a host, and a log whose screenshots 404 is a claim with the evidence missing.
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, posix } from "node:path";
import { fileURLToPath } from "node:url";
import { onTestFinished, test } from "vitest";
import { logPaths, publishedFiles, readLog } from "../examples/sites/judge.mjs";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const DEMO_SITES = ["checkout", "dashboard", "docs", "kanban", "magazine", "shop"];

async function buildIntoTempDir() {
  const { buildSite, siteSections } = await import("../scripts/build-pages.mjs");
  const temporaryDir = await mkdtemp(join(tmpdir(), "vlmkit-pages-"));
  onTestFinished(() => rm(temporaryDir, { recursive: true, force: true }));
  const outputDir = join(temporaryDir, ".pages");
  const result = await buildSite({ sourceRoot: repoRoot, outputDir });
  return { outputDir, result, siteSections };
}

/** Every file under `dir`, as posix paths relative to it. */
async function walk(dir, prefix = "") {
  const out = [];
  for (const entry of await readdir(join(dir, prefix), { withFileTypes: true })) {
    const path = posix.join(prefix, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(dir, path)));
    else out.push(path);
  }
  return out;
}

test("the site manifest: the landing page at the root, solitaire, and the gallery and six demo sites under /sites/", async () => {
  const { siteSections } = await import("../scripts/build-pages.mjs");

  assert.deepEqual(
    siteSections.map(({ id, sourceDir, basePath }) => ({ id, sourceDir, basePath })),
    [
      { id: "intro", sourceDir: "examples/vlmkit-intro-page", basePath: "" },
      { id: "solitaire", sourceDir: "examples/solitaire", basePath: "solitaire" },
      { id: "sites", sourceDir: "examples/sites", basePath: "sites" },
      ...DEMO_SITES.map((name) => ({ id: `sites-${name}`, sourceDir: `examples/sites/${name}`, basePath: `sites/${name}` })),
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
  // The gallery is one generated page (examples/sites/gallery.mjs) and its own log; the briefs,
  // the protocol and the judge tool beside it are the repository's.
  assert.deepEqual(siteSections[2].assets, ["index.html"]);

  // A judgment log's published half is its page and the screens it keeps — derived from the log,
  // so it cannot drift from it — and never the database itself.
  for (const section of siteSections) {
    const judged = section.judgment.map((asset) => asset.path);
    if (!existsSync(logPaths(join(repoRoot, section.sourceDir)).db)) {
      assert.deepEqual(judged, [], `${section.id} has no log, so publishes no judgment files`);
      continue;
    }
    assert.deepEqual(judged, publishedFiles(readLog(join(repoRoot, section.sourceDir))), section.id);
    for (const asset of judged) {
      assert.match(asset, /^judgment\/(index\.html|shots\/S\d+-\d+\.webp)$/, `${section.id}: ${asset}`);
    }
  }
  const logged = siteSections.filter((section) => section.judgment.some((asset) => asset.path === "judgment/index.html")).map((s) => s.id);
  assert.deepEqual(logged, ["intro", "sites", ...DEMO_SITES.map((name) => `sites-${name}`)]);
});

test("the build publishes exactly the manifest, byte-identical to the sources", async () => {
  const { outputDir, result, siteSections } = await buildIntoTempDir();

  assert.deepEqual((await readdir(outputDir)).sort(), [
    ".nojekyll",
    "app.js",
    "content.js",
    "demo-solitaire.png",
    "index.html",
    "judgment",
    "preferences.js",
    "proof-diff.png",
    "proof-implementation.png",
    "proof-target.png",
    "scenarios.js",
    "sites",
    "solitaire",
    "styles.css",
  ]);
  assert.deepEqual((await readdir(join(outputDir, "sites"))).sort(), ["index.html", "judgment", ...DEMO_SITES].sort());
  assert.equal(await readFile(join(outputDir, ".nojekyll"), "utf8"), "");
  assert.deepEqual(
    result.sections.map(({ id, basePath }) => ({ id, basePath })),
    siteSections.map(({ id, basePath }) => ({ id, basePath })),
  );

  const expected = [
    ".nojekyll",
    ...siteSections.flatMap((s) => [...s.assets, ...s.judgment.map((j) => j.path)].map((a) => posix.join(s.basePath, a))),
  ];
  const published = await walk(outputDir);
  assert.deepEqual(published.sort(), expected.sort(), "the published tree is the manifest, file for file");
  for (const file of published) {
    assert.doesNotMatch(
      file,
      /(^|\/)(README\.md|JUDGMENT\.md|copy\.txt|flow\.json|log\.jsonl|PROTOCOL\.md|[^/]+\.sqlite|[^/]+\.(test|spec)\.[mc]?[jt]s)$|(^|\/)(gates|flows|briefs|tests)\//,
      `${file} is repository material, not part of a page`,
    );
  }
  for (const section of siteSections) {
    for (const asset of section.assets) {
      const publishedFile = join(outputDir, section.basePath, asset);
      const source = join(repoRoot, section.sourceDir, asset);
      assert.deepEqual(await readFile(publishedFile), await readFile(source), `${section.id}/${asset}`);
    }
    // A log's page and screens are generated from its judgment.sqlite, so they are held to that.
    for (const { path, bytes } of section.judgment) {
      assert.deepEqual(await readFile(join(outputDir, section.basePath, path)), bytes(), `${section.id}/${path}`);
    }
  }
});

test("no published page reaches an asset by an absolute path", async () => {
  const { outputDir } = await buildIntoTempDir();

  for (const page of (await walk(outputDir)).filter((file) => file.endsWith(".html"))) {
    const html = await readFile(join(outputDir, page), "utf8");
    // Attribute values starting with a single "/" — absolute to the HOST, which on
    // mizchi.github.io is not this site. `//host/path` and `https://` are unaffected.
    const absolute = [...html.matchAll(/\b(?:src|href)="(\/(?!\/)[^"]*)"/g)].map((m) => m[1]);
    assert.deepEqual(absolute, [], `${page} links host-absolute assets`);
  }
});

test("every relative link on every published page arrives at a published file", async () => {
  const { outputDir } = await buildIntoTempDir();
  const published = new Set(await walk(outputDir));

  let checked = 0;
  for (const page of [...published].filter((file) => file.endsWith(".html"))) {
    const html = await readFile(join(outputDir, page), "utf8");
    for (const [, url] of html.matchAll(/\b(?:src|href)="([^"]*)"/g)) {
      if (!url || /^(?:[a-z][a-z0-9+.-]*:|#|\/\/)/i.test(url)) continue;
      const path = url.split(/[?#]/)[0];
      if (!path) continue;
      let target = posix.normalize(posix.join(posix.dirname(page), path));
      assert.ok(!target.startsWith(".."), `${page}: ${url} climbs above the site root`);
      if (path.endsWith("/") || target === ".") target = posix.join(target, "index.html");
      else if (!published.has(target) && published.has(posix.join(target, "index.html"))) target = posix.join(target, "index.html");
      assert.ok(published.has(target), `${page}: ${url} → ${target} is not published`);
      checked++;
    }
  }
  // Hundreds of screenshot links on the log pages alone: a regex that matched nothing would pass.
  assert.ok(checked > 1000, `only ${checked} links checked`);
});

test("the pages link to each other", async () => {
  const { outputDir } = await buildIntoTempDir();
  const read = (path) => readFile(join(outputDir, path), "utf8");

  const intro = await read("index.html");
  const solitaire = await read("solitaire/index.html");
  const gallery = await read("sites/index.html");

  assert.match(intro, /href="\.\/solitaire\/"/);
  // Relative, so it resolves under /vlmkit/ on Pages and to the examples directory locally —
  // one directory up is the site root in both cases, which an absolute site URL would not be.
  assert.match(solitaire, /href="\.\.\/"/);
  // The landing page's two ways out that this layout added: the gallery, and its own log.
  assert.match(intro, /href="\.\/sites\/"/);
  assert.match(intro, /href="\.\/judgment\/"/);
  // The gallery reaches back to the landing page and solitaire, and to every site and every log.
  assert.match(gallery, /href="\.\.\/"/);
  assert.match(gallery, /href="\.\.\/solitaire\/"/);
  assert.match(gallery, /href="\.\.\/judgment\/"/);
  for (const name of DEMO_SITES) {
    assert.match(gallery, new RegExp(`href="\\./${name}/"`), `the gallery links ${name}`);
    assert.match(gallery, new RegExp(`href="\\./${name}/judgment/"`), `the gallery links ${name}'s log`);
    // A log page leads back to the site it judged.
    assert.match(await read(`sites/${name}/judgment/index.html`), /href="\.\.\/"/, `${name}'s log links its site`);
  }
  assert.match(await read("judgment/index.html"), /href="\.\.\/"/, "the landing page's log links the landing page");
  // The gallery was judged like the pages it lists, and links its own log.
  assert.match(gallery, /href="\.\/judgment\/"/);
  assert.match(await read("sites/judgment/index.html"), /href="\.\.\/"/, "the gallery's log links the gallery");
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
