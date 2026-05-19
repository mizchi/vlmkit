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

export async function runAffected(projectRoot: string) {
  console.log("=== Affected Components ===\n");
  const g = await buildDepGraph(projectRoot, {
    languages: ["typescript", "moonbit"],
  });

  let changedFiles: string[];
  try {
    const diff = execSync("git diff --name-only HEAD", {
      cwd: projectRoot,
      encoding: "utf-8",
    });
    changedFiles = diff.trim().split("\n").filter(Boolean);
  } catch {
    console.log("(no git changes)");
    return;
  }

  console.log("Changed files:");
  for (const f of changedFiles) console.log(`  ${f}`);
  console.log();

  const affected = findAffectedComponents(g, changedFiles);
  if (affected.length === 0) {
    console.log("No components affected.");
    return;
  }

  console.log("Affected components:");
  for (const a of affected) {
    console.log(`  [depth=${a.depth}] ${a.node.id}`);
    console.log(`    changed deps: ${a.changedDependencies.join(", ")}`);
  }
}
