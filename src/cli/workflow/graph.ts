import { execSync } from "node:child_process";
import { buildDepGraph, findAffectedComponents, graphStats } from "@mizchi/vlmkit-markup/inspect/dep-graph.ts";

export async function runGraph(projectRoot: string) {
  console.log("=== Dependency Graph ===\n");
  const g = await buildDepGraph(projectRoot, {
    languages: ["typescript", "moonbit"],
  });
  const s = graphStats(g);
  console.log(`Files: ${s.totalFiles}  Edges: ${s.totalEdges}  Components: ${s.components}`);
  console.log(`Languages: ${JSON.stringify(s.byLanguage)}\n`);

  console.log("Components:");
  for (const node of g.nodes.values()) {
    if (node.isComponent) {
      console.log(`  ${node.id}`);
    }
  }
}

/**
 * @returns 1 when the change set could not be determined at all, 0 otherwise. An
 *   empty change set is an answer; a failed `git diff` is not.
 */
export async function runAffected(projectRoot: string): Promise<number> {
  console.log("=== Affected Components ===\n");
  const g = await buildDepGraph(projectRoot, {
    languages: ["typescript", "moonbit"],
  });

  let changedFiles: string[];
  try {
    // stderr ignored, not inherited. `execSync` inherits it by default, so outside a
    // git repository this printed git's whole `diff` usage block above the answer.
    const diff = execSync("git diff --name-only HEAD", {
      cwd: projectRoot,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    changedFiles = diff.trim().split("\n").filter(Boolean);
  } catch {
    // NOT "(no git changes)", which is what this said. git failing means the change
    // set is unknown, and reporting an unknown as an empty one tells the caller
    // nothing is affected — the answer they would act on — about a project this
    // command never managed to inspect.
    console.log("Cannot determine the change set: `git diff --name-only HEAD` failed.");
    console.log(`  ${projectRoot} may not be a git repository, or may have no commits yet.`);
    console.log("  Affected components are derived from the diff, so there is nothing to report.");
    return 1;
  }

  if (changedFiles.length === 0) {
    // Distinct from the case above: git answered, and the answer was "nothing".
    console.log("No files changed against HEAD, so no components are affected.");
    return 0;
  }

  console.log("Changed files:");
  for (const f of changedFiles) console.log(`  ${f}`);
  console.log();

  const affected = findAffectedComponents(g, changedFiles);
  if (affected.length === 0) {
    console.log("No components affected.");
    return 0;
  }

  console.log("Affected components:");
  for (const a of affected) {
    console.log(`  [depth=${a.depth}] ${a.node.id}`);
    console.log(`    changed deps: ${a.changedDependencies.join(", ")}`);
  }
  return 0;
}
