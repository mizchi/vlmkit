#!/usr/bin/env node
/**
 * The README's workspace map: every package.json in the workspace, layered by dependency
 * depth, as a mermaid flowchart.
 *
 *   node scripts/workspace-map.mjs           # print the ```mermaid block
 *   node scripts/workspace-map.mjs --write   # replace the block in README.md
 *
 * Ported from `vlmkit-anim repo --mermaid` (`workspaceMermaid`, now in mizchi/explainer, and
 * `@mizchi/vlmkit-anim` deprecated on npm) so this repository draws its own map with no
 * dependency. `tests/readme-workspace-map.test.mjs` holds README.md to it.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const shortName = (name) => name.replace(/^@mizchi\/vlmkit-?/, "") || "vlmkit";
const mermaidLabel = (text) => text.replace(/"/g, "#quot;").replace(/</g, "#lt;").replace(/>/g, "#gt;");

/** Every workspace package with the short names of the workspace packages it depends on. */
export function readWorkspace(root) {
  const manifests = [join(root, "package.json")];
  const pkgDir = join(root, "packages");
  if (existsSync(pkgDir)) {
    for (const d of readdirSync(pkgDir).sort()) {
      if (existsSync(join(pkgDir, d, "package.json"))) manifests.push(join(pkgDir, d, "package.json"));
    }
  }
  const all = manifests.map((m) => JSON.parse(readFileSync(m, "utf8")));
  const names = new Set(all.map((j) => String(j.name)));
  return all.map((j) => {
    const name = String(j.name);
    const isRoot = !name.startsWith("@mizchi/vlmkit-");
    // The root CLI's workspace edges are build-time too; a library's are what it ships with.
    const fields = isRoot ? ["dependencies", "devDependencies"] : ["dependencies", "peerDependencies"];
    const deps = [...new Set(fields.flatMap((f) => Object.keys(j[f] ?? {})))]
      .filter((d) => names.has(d) && d !== name)
      .map(shortName)
      .sort()
      .map((d) => (d === "vlmkit" ? "vlmkit (cli)" : d));
    return { id: isRoot ? "vlmkit (cli)" : shortName(name), name, deps };
  });
}

/** Dependency depth: 0 for packages that depend on nothing in the workspace. */
function layersOf(pkgs) {
  const byId = new Map(pkgs.map((p) => [p.id, p]));
  const depth = new Map();
  const visit = (id, seen) => {
    if (depth.has(id)) return depth.get(id);
    if (seen.includes(id)) return 0;
    const p = byId.get(id);
    const d = p && p.deps.length ? 1 + Math.max(...p.deps.map((x) => visit(x, [...seen, id]))) : 0;
    depth.set(id, d);
    return d;
  };
  for (const p of pkgs) visit(p.id, []);
  return depth;
}

/** The ```mermaid block, fence included. */
export function workspaceMermaid(root) {
  const pkgs = readWorkspace(root);
  const layer = layersOf(pkgs);
  const id = new Map(pkgs.map((p, i) => [p.id, `p${i}`]));
  const lines = ["```mermaid", "flowchart BT"];
  const byLayer = new Map();
  for (const p of pkgs) {
    const n = layer.get(p.id) ?? 0;
    byLayer.set(n, [...(byLayer.get(n) ?? []), p]);
  }
  for (const [n, list] of [...byLayer.entries()].sort((a, b) => a[0] - b[0])) {
    lines.push(`  subgraph L${n}["layer ${n}"]`);
    for (const p of list) lines.push(`    ${id.get(p.id)}["${mermaidLabel(p.id)}"]`);
    lines.push("  end");
  }
  for (const p of pkgs) for (const d of p.deps) if (id.has(d)) lines.push(`  ${id.get(p.id)} --> ${id.get(d)}`);
  lines.push("```");
  return lines.join("\n");
}

const FENCE = /```mermaid\nflowchart BT\n[\s\S]*?```/;

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const block = workspaceMermaid(root);
  if (process.argv.includes("--write")) {
    const readmePath = join(root, "README.md");
    const readme = readFileSync(readmePath, "utf8");
    if (!FENCE.test(readme)) throw new Error("README.md has no ```mermaid flowchart BT block to replace");
    writeFileSync(readmePath, readme.replace(FENCE, block));
    console.log("README.md workspace map updated");
  } else {
    console.log(block);
  }
}
