import assert from "node:assert/strict";
import { access, readFile, readdir, stat } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "vitest";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const skillsPackage = join(repoRoot, "skills/vlmkit");
const apmPackage = join(repoRoot, ".apm/skills/vlmkit");

/**
 * The skill content lives once in `.claude/skills/` and is copied into two
 * installer packages. `scripts/sync-skill-package.mjs` does the copying, so a
 * failure here is always "you edited the source and did not re-sync" — but the
 * assertion used to report it as a 10 KB buffer diff with no hint of the fix.
 * Editing one of the three copies by hand and re-running is the wrong repair,
 * and a byte-diff invites exactly that.
 */
const FIX = "run `pnpm sync:skills`";
const workflows = [
  "agent-validation-loop",
  "auto-markup",
  "component-vrt",
  "d2-diagram",
  "d2-slides",
  "dynamic-markup",
  "explain-with-anim",
  "explanatory-animation",
  "markup-assist",
  "markup-decompose",
  "mock-markup",
  "spec-to-playwright",
  "vrt-css-fix-loop",
  "vrt-markup-synth",
  "vrt-migration-eval",
  "vrt-regression-watch",
  "vrt-visual-diff",
];

async function listFiles(root, directory = root) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await listFiles(root, path)));
    else files.push(relative(root, path));
  }
  return files.sort();
}

test("the repository exposes one lightweight public vlmkit skill", async () => {
  await assert.rejects(access(join(repoRoot, "SKILL.md")));

  const router = await readFile(join(skillsPackage, "SKILL.md"), "utf8");
  assert.match(router, /^---\nname: vlmkit\n/m);
  assert.match(router, /## Automatic routing contract/);

  for (const workflow of workflows) {
    const workflowPath = `workflows/${workflow}/SKILL.md`;
    assert.ok(router.includes(`./${workflowPath}`), `${workflow} is not routed relatively`);
    assert.match(
      await readFile(join(skillsPackage, workflowPath), "utf8"),
      new RegExp(`name: ${workflow}`),
    );

    const sourceRoot = join(repoRoot, ".claude/skills", workflow);
    const bundledRoot = join(skillsPackage, "workflows", workflow);
    const sourceFiles = (await listFiles(sourceRoot)).filter((file) => file !== "README.md");
    assert.deepEqual(await listFiles(bundledRoot), sourceFiles, `${workflow} bundle is stale — ${FIX}`);
    for (const file of sourceFiles) {
      assert.deepEqual(
        await readFile(join(bundledRoot, file)),
        await readFile(join(sourceRoot, file)),
        `${workflow}/${file} bundle is stale — ${FIX}`,
      );
    }
  }
});

/**
 * The router states which vlmkit the workflows are written against, and it has to be THIS one.
 *
 * A skill that names a verb the installed CLI does not have fails with "unknown option", which
 * reads as the user's mistake rather than as version skew — `check story` and `--probe <families>`
 * are both younger than two releases. So the router tells the agent to check `vlmkit --version` and
 * install the recorded version when what it finds is older.
 *
 * Recorded ONCE, in the router, because every workflow is reached through it: thirteen copies of a
 * version number is thirteen chances to ship a stale one, and this file exists because three copies
 * of a skill drifted. This test is the other half of that decision — a number written down once
 * still goes stale unless something fails when it does.
 */
test("the router pins the vlmkit version the workflows are written against", async () => {
  const [skill, manifest] = await Promise.all([
    readFile(join(skillsPackage, "SKILL.md"), "utf8"),
    readFile(join(repoRoot, "package.json"), "utf8"),
  ]);
  const { version } = JSON.parse(manifest);
  const heading = skill.match(/^### The version these workflows are written against: (\S+)$/m);
  assert.ok(heading, "the router must state the version in its bootstrap section");
  assert.equal(
    heading[1],
    version,
    `the router says ${heading[1]} and the package is ${version} — bump the router with the release`,
  );
  // The install line an agent will actually run, and the sample `--version` output it compares
  // against. Both carry the number, and a bump that fixes only the heading leaves the instruction
  // telling the agent to install the previous release.
  assert.ok(
    skill.includes(`@mizchi/vlmkit@${version}`),
    `the install instruction must name ${version}`,
  );
  assert.ok(
    skill.includes(`vlmkit/${version} `),
    `the sample --version output must show ${version}`,
  );
});

test("the APM package is an exact, bounded mirror of the skills CLI package", async () => {
  const skillsFiles = await listFiles(skillsPackage);
  const apmFiles = await listFiles(apmPackage);
  assert.deepEqual(apmFiles, skillsFiles, `installer file lists differ — ${FIX}`);

  let bytes = 0;
  for (const file of skillsFiles) {
    const [skillsContent, apmContent] = await Promise.all([
      readFile(join(skillsPackage, file)),
      readFile(join(apmPackage, file)),
    ]);
    assert.deepEqual(apmContent, skillsContent, `${file} differs between installers — ${FIX}`);
    bytes += (await stat(join(apmPackage, file))).size;
  }
  assert.ok(bytes < 512 * 1024, `APM skill package is unexpectedly large: ${bytes} bytes`);
});

test("the installed skill bundle does not contain test-runner-discoverable assets", async () => {
  const testAssetPattern = /(?:^|\/)[^/]+\.(?:test|spec)\.[cm]?[jt]sx?$/;
  const discovered = (await listFiles(skillsPackage)).filter((file) => testAssetPattern.test(file));
  assert.deepEqual(
    discovered,
    [],
    `template assets must not be collected by consumer Vitest/Jest defaults: ${discovered.join(", ")}`,
  );
});

test("apm.yml explicitly publishes only the vlmkit package", async () => {
  const manifest = await readFile(join(repoRoot, "apm.yml"), "utf8");
  assert.match(manifest, /^name: vlmkit$/m);
  assert.match(manifest, /^includes:\n  - \.apm\/skills\/vlmkit\/$/m);
});

test("the local development shell pins the current APM release", async () => {
  const apmNix = await readFile(join(repoRoot, "apm.nix"), "utf8");
  assert.match(apmNix, /version \? "0\.27\.0"/);
});

/**
 * The Claude Code plugin marketplace, and the one thing it must NOT do.
 *
 * This repository already publishes the skills two ways — APM
 * (`.apm/skills/vlmkit/`) and the skills CLI (`skills/vlmkit/`) — and the tests
 * above exist because those two are COPIES of `.claude/skills/` and copies
 * drift. A third route was added for `/plugin marketplace add mizchi/vlmkit`,
 * and the interesting decision is that it adds no copy at all: its plugin
 * `source` points at the existing `skills/vlmkit/`, which is already a
 * single-skill plugin by Claude Code's own rules (a `SKILL.md` at the plugin
 * root, no `skills/` subdirectory, so no `plugin.json` is required) and is
 * already guarded by every assertion above.
 *
 * So this test's job is to keep that true. A future edit that points the plugin
 * at a fourth directory, or vendors the skills under `.claude-plugin/`, fails
 * here — because then `pnpm sync:skills` would have one more place to forget.
 */
test("the plugin marketplace reuses the existing package rather than adding a copy", async () => {
  const manifest = JSON.parse(await readFile(join(repoRoot, ".claude-plugin/marketplace.json"), "utf8"));

  // The schema's required fields. Asserted rather than assumed: a marketplace
  // missing `owner.name` is rejected on `/plugin marketplace add`, and the
  // failure a user sees is about JSON, not about what is wrong.
  assert.equal(manifest.name, "vlmkit");
  assert.equal(typeof manifest.owner?.name, "string");
  assert.ok(Array.isArray(manifest.plugins) && manifest.plugins.length === 1,
    "one plugin: the router is the only thing either other installer exposes, and the 17 "
    + "workflows are bundled resources rather than separately installable skills");

  const [plugin] = manifest.plugins;
  assert.equal(plugin.name, "vlmkit");
  assert.equal(plugin.source, "./skills/vlmkit",
    "the plugin must point at the package the other two installers already publish — a new "
    + "directory here is a fourth copy and a fourth thing `pnpm sync:skills` has to remember");
  // Relative sources resolve from the marketplace ROOT, not from `.claude-plugin/`.
  const pluginRoot = join(repoRoot, plugin.source.replace(/^\.\//, ""));
  assert.equal(pluginRoot, skillsPackage, "and that package is the skills-CLI one");
  await access(join(pluginRoot, "SKILL.md"));
  await assert.rejects(
    access(join(pluginRoot, "skills")),
    "a `skills/` subdirectory next to a root SKILL.md would make Claude Code load this as a "
    + "multi-skill plugin and stop treating the router as the entry",
  );
  await assert.rejects(
    access(join(repoRoot, ".claude-plugin/skills")),
    "the marketplace directory holds the manifest only; vendoring skills beside it is the copy "
    + "this test exists to prevent",
  );

  // `strict: false` is the documented signal for "this plugin ships no
  // plugin.json", which is the case here and must stay consistent with the
  // absence of one.
  assert.equal(plugin.strict, false);
  await assert.rejects(access(join(pluginRoot, ".claude-plugin/plugin.json")));

  // No `version`. With a relative-path source inside a git-hosted marketplace,
  // update detection falls back to the commit SHA when the field is absent, so
  // every skill edit reaches users. Pinning it would hide edits until someone
  // bumped the string — and the obvious string to reach for, package.json's
  // 0.23.0, is the CLI's version and has never described the skills.
  assert.equal("version" in plugin, false,
    "omitted on purpose: a pinned version hides skill edits until it is bumped");
});
