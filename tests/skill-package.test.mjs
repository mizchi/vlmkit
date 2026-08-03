import assert from "node:assert/strict";
import { access, readFile, readdir, stat } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const skillsPackage = join(repoRoot, "skills/vlmkit");
const apmPackage = join(repoRoot, ".apm/skills/vlmkit");
const workflows = [
  "agent-validation-loop",
  "auto-markup",
  "dynamic-markup",
  "markup-assist",
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
    assert.deepEqual(await listFiles(bundledRoot), sourceFiles, `${workflow} bundle is stale`);
    for (const file of sourceFiles) {
      assert.deepEqual(
        await readFile(join(bundledRoot, file)),
        await readFile(join(sourceRoot, file)),
        `${workflow}/${file} bundle is stale`,
      );
    }
  }
});

test("the APM package is an exact, bounded mirror of the skills CLI package", async () => {
  const skillsFiles = await listFiles(skillsPackage);
  const apmFiles = await listFiles(apmPackage);
  assert.deepEqual(apmFiles, skillsFiles);

  let bytes = 0;
  for (const file of skillsFiles) {
    const [skillsContent, apmContent] = await Promise.all([
      readFile(join(skillsPackage, file)),
      readFile(join(apmPackage, file)),
    ]);
    assert.deepEqual(apmContent, skillsContent, `${file} differs between installers`);
    bytes += (await stat(join(apmPackage, file))).size;
  }
  assert.ok(bytes < 512 * 1024, `APM skill package is unexpectedly large: ${bytes} bytes`);
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
