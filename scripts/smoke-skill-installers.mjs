import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, mkdtemp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePackage = join(repoRoot, "skills/vlmkit");
const apmInvocation = process.env.VLMKIT_APM_PACKAGE
  ? { command: "uvx", prefix: ["--from", process.env.VLMKIT_APM_PACKAGE, "apm"] }
  : { command: process.env.VLMKIT_APM_BIN || "apm", prefix: [] };
const expectedWorkflows = [
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

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, CI: "1", NO_COLOR: "1" },
  });
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed (${result.status})\n${result.stdout}\n${result.stderr}`,
    );
  }
  return `${result.stdout}${result.stderr}`;
}

async function exportRepository(destination) {
  const result = spawnSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    { cwd: repoRoot, encoding: "buffer", maxBuffer: 10 * 1024 * 1024 },
  );
  if (result.status !== 0) {
    throw new Error(`git ls-files failed (${result.status})\n${result.stderr.toString()}`);
  }

  await mkdir(destination, { recursive: true });
  for (const file of result.stdout.toString().split("\0").filter(Boolean)) {
    const source = join(repoRoot, file);
    try {
      await stat(source);
    } catch (error) {
      if (error?.code === "ENOENT") continue;
      throw error;
    }
    const target = join(destination, file);
    await mkdir(dirname(target), { recursive: true });
    await cp(source, target, { recursive: true });
  }
}

async function directoryBytes(directory) {
  let bytes = 0;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    bytes += entry.isDirectory() ? await directoryBytes(path) : (await stat(path)).size;
  }
  return bytes;
}

async function verifyInstalledPackage(consumerRoot, installer) {
  const installed = join(consumerRoot, ".claude/skills/vlmkit");
  assert.deepEqual(
    (await readdir(join(consumerRoot, ".claude/skills"), { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort(),
    ["vlmkit"],
    `${installer} exposed internal workflows as separate skills`,
  );
  assert.deepEqual(
    (await readdir(join(installed, "workflows"), { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort(),
    expectedWorkflows,
    `${installer} did not install all workflows`,
  );
  assert.deepEqual(
    await readFile(join(installed, "SKILL.md")),
    await readFile(join(sourcePackage, "SKILL.md")),
    `${installer} changed the router`,
  );
  const bytes = await directoryBytes(installed);
  assert.ok(bytes < 512 * 1024, `${installer} installed ${bytes} bytes`);
  return bytes;
}

const temporaryRoot = await mkdtemp(join(tmpdir(), "vlmkit-skill-installers-"));

try {
  const packageSource = join(temporaryRoot, "package-source");
  await exportRepository(packageSource);

  const apmConsumer = join(temporaryRoot, "apm-consumer");
  await mkdir(join(apmConsumer, ".claude"), { recursive: true });
  run(
    apmInvocation.command,
    [...apmInvocation.prefix, "install", packageSource, "--target", "claude"],
    apmConsumer,
  );
  const apmBytes = await verifyInstalledPackage(apmConsumer, "APM");

  const skillsConsumer = join(temporaryRoot, "skills-consumer");
  await mkdir(join(skillsConsumer, ".claude"), { recursive: true });
  await writeFile(join(skillsConsumer, "package.json"), '{"private":true}\n');
  run(
    "npx",
    ["--yes", "skills", "add", repoRoot, "--agent", "claude-code", "--copy", "--yes"],
    skillsConsumer,
  );
  const skillsBytes = await verifyInstalledPackage(skillsConsumer, "skills CLI");

  console.log(`APM installed ${apmBytes} bytes; skills CLI installed ${skillsBytes} bytes.`);
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
