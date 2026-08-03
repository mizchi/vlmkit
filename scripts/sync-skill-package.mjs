import { cp, mkdir, readdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const sourceWorkflows = join(repoRoot, ".claude/skills");
const skillsPackage = join(repoRoot, "skills/vlmkit");
const bundledWorkflows = join(skillsPackage, "workflows");
const apmPackage = join(repoRoot, ".apm/skills/vlmkit");

export async function syncSkillPackage() {
  const workflowNames = (
    await readdir(sourceWorkflows, { withFileTypes: true })
  )
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  await rm(bundledWorkflows, { recursive: true, force: true });
  await mkdir(bundledWorkflows, { recursive: true });

  for (const workflow of workflowNames) {
    await cp(join(sourceWorkflows, workflow), join(bundledWorkflows, workflow), {
      recursive: true,
      filter: (path) => !path.endsWith("/README.md"),
    });
  }

  await rm(apmPackage, { recursive: true, force: true });
  await mkdir(dirname(apmPackage), { recursive: true });
  await cp(skillsPackage, apmPackage, { recursive: true });

  return { workflowNames, skillsPackage, apmPackage };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { workflowNames } = await syncSkillPackage();
  console.log(`Synced vlmkit skill package with ${workflowNames.length} workflows.`);
}
