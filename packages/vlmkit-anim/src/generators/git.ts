/**
 * Scenes generated from a repository instead of written by hand: the
 * workspace's own architecture, and the change map of a range of commits.
 *
 * Both produce ordinary `diagram` scenes — the reader gets the same
 * `check` / `explain` / `sheet` / `video` outputs as for any scene — so a PR
 * can carry an animation of *what it touched, in what order, and how those
 * parts depend on each other* without anyone drawing it. Nodes are **areas**
 * (a package's `src`, its fixtures, `docs/reports`, `tests`, `ci`), edges are
 * the import relations between the changed areas, beats are the commits.
 */

import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, posix } from "node:path";
import { labelWidth } from "../compile/builder.ts";
import { EXPECT_FORMAT, type Expectation } from "../expect.ts";
import { SCENE_FORMAT, type DiagramEdge, type DiagramNode, type DiagramScene, type DiagramStep, type ModuleDef, type ModuleDep, type ModulesScene } from "../types.ts";

// ---- the workspace ---------------------------------------------------------------

export interface WorkspacePackage {
  /** Short name: `@mizchi/vlmkit-core` → `core`; the root package → `vlmkit (cli)`. */
  id: string;
  name: string;
  /** Short names of the workspace packages it depends on. */
  deps: string[];
  description?: string;
}

const shortName = (name: string): string => name.replace(/^@mizchi\/vlmkit-?/, "") || "vlmkit";

/** Read every `package.json` in the workspace and keep the edges between them. */
export function readWorkspace(root: string): WorkspacePackage[] {
  const manifests: string[] = [join(root, "package.json")];
  const pkgDir = join(root, "packages");
  if (existsSync(pkgDir)) for (const d of readdirSync(pkgDir)) if (existsSync(join(pkgDir, d, "package.json"))) manifests.push(join(pkgDir, d, "package.json"));
  const all = manifests.map((m) => JSON.parse(readFileSync(m, "utf8")) as Record<string, unknown>);
  const names = new Set(all.map((j) => String(j.name)));
  return all.map((j) => {
    const name = String(j.name);
    const isRoot = !name.startsWith("@mizchi/vlmkit-");
    const fields = isRoot ? ["dependencies", "devDependencies"] : ["dependencies", "peerDependencies"];
    const deps = [...new Set(fields.flatMap((f) => Object.keys((j[f] as Record<string, string> | undefined) ?? {})))].filter((d) => names.has(d) && d !== name).map(shortName).sort();
    return { id: isRoot ? "vlmkit (cli)" : shortName(name), name, deps: deps.map((d) => (d === "vlmkit" ? "vlmkit (cli)" : d)), description: typeof j.description === "string" ? j.description : undefined };
  });
}

/** Dependency depth: 0 for packages that depend on nothing in the workspace. */
function layersOf(pkgs: WorkspacePackage[]): Map<string, number> {
  const byId = new Map(pkgs.map((p) => [p.id, p]));
  const depth = new Map<string, number>();
  const visit = (id: string, seen: string[]): number => {
    if (depth.has(id)) return depth.get(id)!;
    if (seen.includes(id)) return 0;
    const p = byId.get(id);
    const d = p && p.deps.length ? 1 + Math.max(...p.deps.map((x) => visit(x, [...seen, id]))) : 0;
    depth.set(id, d);
    return d;
  };
  for (const p of pkgs) visit(p.id, []);
  return depth;
}

/** The workspace as a `modules` map: one layer of packages per beat, from the ones that depend on nothing to the CLI. */
export function workspaceScene(root: string, title = "vlmkit — the workspace"): ModulesScene {
  const pkgs = readWorkspace(root);
  const depth = layersOf(pkgs);
  const layers = [...new Set([...depth.values()])].sort((a, b) => a - b);
  // A `modules` scene: the map is a still figure on its own (`vlmkit-anim still`), and the sequence below
  // walks it layer by layer for the GIF.
  const modules: ModuleDef[] = pkgs.map((p) => ({ id: p.id, label: p.id, hidden: depth.get(p.id)! > 0 }));
  const edges: ModuleDep[] = pkgs.flatMap((p) => p.deps.map((d): ModuleDep => ({ from: p.id, to: d, hidden: depth.get(p.id)! > 0 })));
  // One beat per layer: the previous layer dims, this layer appears and lights up, the caption says why it sits there.
  const sequence: DiagramStep[] = [];
  let prev: string[] = [];
  for (const layer of layers) {
    const ids = pkgs.filter((p) => depth.get(p.id) === layer).map((p) => p.id);
    if (prev.length) sequence.push({ unhighlight: prev, ms: 0 });
    if (layer > 0) sequence.push({ show: ids, ms: 0 });
    const caption = layer === 0
      ? `${ids.join(", ")}: ${ids.length === 1 ? "depends" : "depend"} on nothing else in the workspace`
      : ids.map((id) => `${id} → ${pkgs.find((p) => p.id === id)!.deps.join(", ")}`).join("; ");
    sequence.push({ highlight: ids, caption });
    sequence.push({ value: { id: "n", label: "packages so far", text: pkgs.filter((p) => depth.get(p.id)! <= layer).length }, ms: 0 });
    prev = ids;
  }
  sequence.push({ unhighlight: prev, ms: 0 });
  sequence.push({ note: `${pkgs.length} packages, ${edges.length} workspace dependencies, ${layers.length} layers deep` });
  return { format: SCENE_FORMAT, kind: "modules", title, layout: "lr", modules, deps: edges, sequence };
}

/**
 * The workspace's facts for `check --expect`: every package, every workspace dependency. A module map drawn by
 * hand (or by an agent from the package.json files) is checked against this rather than against itself.
 */
export function workspaceExpectation(root: string): Expectation {
  const pkgs = readWorkspace(root);
  return {
    format: EXPECT_FORMAT,
    modules: pkgs.map((p) => p.id),
    deps: pkgs.flatMap((p) => p.deps.map((d) => `${p.id}->${d}`)),
  };
}

// ---- a range of commits -----------------------------------------------------------

export interface Commit {
  sha: string;
  subject: string;
  /** path → [added, removed] lines (binary files count as [0, 0]). */
  files: Map<string, [number, number]>;
}

export interface ChangeMap {
  scene: DiagramScene;
  commits: number;
  files: number;
  added: number;
  removed: number;
  areas: string[];
}

export interface ChangeMapOptions {
  root: string;
  base: string;
  head?: string;
  title?: string;
  /** More areas than this are merged into "other". Default 14. */
  maxAreas?: number;
}

function git(root: string, args: string[]): string {
  return execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024 });
}

/** Commits in `base..head`, oldest first, each with its numstat. Merge commits are skipped. */
export function readCommits(root: string, base: string, head = "HEAD"): Commit[] {
  const log = git(root, ["log", "--reverse", "--no-merges", "--format=%H%x1f%s", `${base}..${head}`]).trim();
  if (!log) return [];
  return log.split("\n").map((line) => {
    const [sha, subject] = line.split("\x1f");
    const files = new Map<string, [number, number]>();
    for (const row of git(root, ["diff-tree", "--no-commit-id", "-r", "--numstat", sha]).trim().split("\n").filter(Boolean)) {
      const [a, r, ...rest] = row.split("\t");
      const path = rest.join("\t");
      files.set(path, [a === "-" ? 0 : Number(a), r === "-" ? 0 : Number(r)]);
    }
    return { sha, subject, files };
  });
}

/**
 * The area a path belongs to — the granularity a reader can take in. A
 * package's `src` is one area, its fixtures another; docs by folder; the
 * rest by top-level directory.
 */
export function areaOf(path: string): string {
  const seg = path.split("/");
  if (seg[0] === "packages" && seg.length >= 3) {
    const pkg = seg[1].replace(/^vlmkit-/, ""); // the directory name, not the scoped package name
    const sub = seg[2];
    if (seg.length === 3) return pkg; // package.json, README, LICENSE
    return `${pkg}/${sub}`;
  }
  if (seg.length === 1) return "root";
  if (seg[0] === ".github") return "ci";
  if (seg[0] === "docs" || seg[0] === "fixtures" || seg[0] === "src" || seg[0] === "examples" || seg[0] === "skills" || seg[0] === ".apm") return seg.length > 2 ? `${seg[0]}/${seg[1]}` : seg[0];
  return seg[0];
}

const IMPORT_RE = /(?:^|\n)\s*(?:import|export)\s[^;'"]*?from\s*['"]([^'"]+)['"]|(?:^|\n)\s*import\s*['"]([^'"]+)['"]/g;

/** Import edges between changed areas, read from the files as they are at `head`. */
function importEdges(root: string, head: string, changed: Set<string>, areas: Set<string>): DiagramEdge[] {
  const edges = new Set<string>();
  for (const file of changed) {
    if (!/\.(m?ts|m?js|tsx)$/.test(file) || file.endsWith(".d.ts")) continue;
    const from = areaOf(file);
    if (!areas.has(from)) continue;
    let source: string;
    try {
      source = git(root, ["show", `${head}:${file}`]);
    } catch {
      continue; // deleted in this range
    }
    for (const m of source.matchAll(IMPORT_RE)) {
      const spec = m[1] ?? m[2];
      if (!spec) continue;
      let to: string | undefined;
      const pkg = spec.match(/^@mizchi\/vlmkit-([\w-]+)/);
      if (pkg) to = `${pkg[1]}/src`;
      else if (spec.startsWith(".")) to = areaOf(posix.normalize(posix.join(posix.dirname(file), spec)));
      if (to && to !== from && areas.has(to)) edges.add(`${from}\x1f${to}`);
    }
  }
  return [...edges].map((e) => {
    const [from, to] = e.split("\x1f");
    return { from, to };
  });
}

const truncate = (s: string, n: number): string => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** What a range of commits changed, by area: shared by the animated change map and the mermaid one. */
export interface ChangeSummary {
  head: string;
  commits: Commit[];
  /** Kept areas, most-touched first, then `other (N areas)` when areas were merged. */
  areas: string[];
  /** The area a path is drawn in — its own, or the merged `other`. */
  area: (path: string) => string;
  /** `from` imports `to`, between kept areas. */
  edges: { from: string; to: string }[];
  /** Per area: distinct files touched and lines added / removed across the range. */
  perArea: Map<string, { files: number; added: number; removed: number }>;
  files: number;
  added: number;
  removed: number;
}

/** Read `base..head` once and reduce it to areas, import edges and counts. */
export function summarizeChanges(opts: ChangeMapOptions): ChangeSummary {
  const head = opts.head ?? "HEAD";
  const commits = readCommits(opts.root, opts.base, head);
  const touchCount = new Map<string, number>();
  const changed = new Set<string>();
  for (const c of commits) for (const path of c.files.keys()) {
    changed.add(path);
    touchCount.set(areaOf(path), (touchCount.get(areaOf(path)) ?? 0) + 1);
  }
  const maxAreas = opts.maxAreas ?? 14;
  const ranked = [...touchCount.entries()].sort((a, b) => b[1] - a[1]).map(([a]) => a);
  const kept = new Set(ranked.slice(0, ranked.length > maxAreas ? maxAreas - 1 : maxAreas));
  const merged = ranked.filter((a) => !kept.has(a));
  const OTHER = merged.length ? `other (${merged.length} areas)` : undefined;
  const area = (path: string): string => (kept.has(areaOf(path)) ? areaOf(path) : OTHER!);
  const areas = [...kept, ...(OTHER ? [OTHER] : [])];
  const areaSet = new Set(areas);
  const edges = importEdges(opts.root, head, changed, new Set(kept)).filter((e) => areaSet.has(e.from) && areaSet.has(e.to));

  const perArea = new Map<string, { files: number; added: number; removed: number }>();
  const filesByArea = new Map<string, Set<string>>();
  let added = 0;
  let removed = 0;
  for (const c of commits) for (const [path, [a, r]] of c.files) {
    const key = area(path);
    const entry = perArea.get(key) ?? { files: 0, added: 0, removed: 0 };
    entry.added += a;
    entry.removed += r;
    const seen = filesByArea.get(key) ?? new Set<string>();
    seen.add(path);
    filesByArea.set(key, seen);
    entry.files = seen.size;
    perArea.set(key, entry);
    added += a;
    removed += r;
  }
  return { head, commits, areas, area, edges, perArea, files: changed.size, added, removed };
}

/** The change map of `base..head` as a `diagram`: areas appear as commits touch them, edges are imports, readouts count. */
export function changeMapScene(opts: ChangeMapOptions): ChangeMap {
  const { head, commits, areas, area, edges: areaEdges } = summarizeChanges(opts);
  const nodes: DiagramNode[] = areas.map((a) => ({ id: a, label: a, hidden: true }));
  const edges = areaEdges.map((e) => ({ ...e, hidden: true }));

  const sequence: DiagramStep[] = [];
  const shown = new Set<string>();
  let files = 0;
  let added = 0;
  let removed = 0;
  let prevTouched: string[] = [];
  const seenFiles = new Set<string>();
  commits.forEach((c, i) => {
    const touched = [...new Set([...c.files.keys()].map(area))];
    const fresh = touched.filter((a) => !shown.has(a));
    const subject = `${i + 1}/${commits.length} ${truncate(c.subject, 72)}`;
    for (const path of c.files.keys()) seenFiles.add(path);
    files = seenFiles.size;
    for (const [a, r] of c.files.values()) {
      added += a;
      removed += r;
    }
    // One beat per commit: last commit's areas dim, new areas appear, this commit's areas light up.
    if (prevTouched.length) sequence.push({ unhighlight: prevTouched, ms: 0 });
    if (fresh.length) {
      sequence.push({ show: fresh, ms: 0 });
      for (const a of fresh) shown.add(a);
    }
    sequence.push({ highlight: touched, caption: subject });
    sequence.push({ value: { id: "files", label: "files changed", text: files }, ms: 0 });
    sequence.push({ value: { id: "lines", label: "lines", text: `+${added} −${removed}` }, ms: 0 });
    prevTouched = touched;
  });
  if (prevTouched.length) sequence.push({ unhighlight: prevTouched, ms: 0 });
  if (!commits.length) sequence.push({ note: `no commits in ${opts.base}..${head}` });
  else sequence.push({ note: `${commits.length} commit${commits.length === 1 ? "" : "s"} · ${files} files · +${added} −${removed} · ${areas.length} areas, ${edges.length} import edges between them` });

  // A grid sized to the areas: the diagram kind's default canvas is for a handful of boxes, and
  // area names are long ("fixtures/anim-scenario"), so a fixed canvas would stack them off-screen.
  const n = Math.max(1, nodes.length);
  const cols = Math.min(4, Math.ceil(Math.sqrt(n)));
  const rows = Math.ceil(n / cols);
  const widest = Math.max(120, ...areas.map((a) => labelWidth(a, 14)));
  const canvas = { width: Math.round(Math.max(640, cols * (widest + 60) + 80)), height: Math.round(Math.max(360, rows * 72 + 150)) };
  const scene: DiagramScene = {
    format: SCENE_FORMAT,
    kind: "diagram",
    title: opts.title ?? `Changes in ${opts.base}..${head === "HEAD" ? "HEAD" : head.slice(0, 7)}`,
    layout: "grid",
    canvas,
    nodes: nodes.length ? nodes : [{ id: "nothing", label: "no changes" }],
    edges,
    sequence,
  };
  return { scene, commits: commits.length, files, added, removed, areas };
}

// ---- mermaid ---------------------------------------------------------------------

/** A label mermaid will print as written: quotes and angle brackets as entities, `|` kept out of tables. */
const mermaidLabel = (text: string): string => text.replace(/"/g, "#quot;").replace(/</g, "#lt;").replace(/>/g, "#gt;");
const tableCell = (text: string): string => text.replace(/\|/g, "\\|").replace(/\n/g, " ");

/**
 * The change map of `base..head` as Markdown with a mermaid flowchart — what this repository
 * posts on a pull request, because GitHub renders it inline and a reviewer can read it without
 * playing anything. The same summary as the animated map: one box per area with its file and
 * line counts, an arrow where one changed area imports another, and a table of the commits in
 * order with the areas each touched.
 */
export function changeMapMermaid(opts: ChangeMapOptions): { markdown: string; summary: ChangeSummary } {
  const summary = summarizeChanges(opts);
  const { commits, areas, area, edges, perArea } = summary;
  const title = opts.title ?? `Changes in ${opts.base}..${summary.head === "HEAD" ? "HEAD" : summary.head.slice(0, 7)}`;
  const id = new Map(areas.map((a, i) => [a, `a${i}`]));
  const lines: string[] = [`## ${title}`, ""];
  if (!commits.length) {
    lines.push(`No commits in \`${opts.base}..${summary.head}\`.`);
    return { markdown: lines.join("\n") + "\n", summary };
  }
  lines.push(
    `${commits.length} commit${commits.length === 1 ? "" : "s"} · ${summary.files} files · +${summary.added} −${summary.removed}`
    + ` · ${areas.length} area${areas.length === 1 ? "" : "s"}, ${edges.length} import edge${edges.length === 1 ? "" : "s"} between them`,
    "",
    "```mermaid",
    "flowchart LR",
  );
  for (const a of areas) {
    const n = perArea.get(a) ?? { files: 0, added: 0, removed: 0 };
    lines.push(`  ${id.get(a)}["${mermaidLabel(a)}<br/>${n.files} file${n.files === 1 ? "" : "s"} · +${n.added} −${n.removed}"]`);
  }
  for (const e of edges) lines.push(`  ${id.get(e.from)} -->|imports| ${id.get(e.to)}`);
  lines.push("```", "", "| # | commit | areas | lines |", "|---:|---|---|---|");
  commits.forEach((c, i) => {
    const touched = [...new Set([...c.files.keys()].map(area))];
    let a = 0;
    let r = 0;
    for (const [x, y] of c.files.values()) { a += x; r += y; }
    lines.push(`| ${i + 1} | \`${c.sha.slice(0, 7)}\` ${tableCell(c.subject)} | ${touched.map((t) => `\`${tableCell(t)}\``).join(", ")} | +${a} −${r} |`);
  });
  return { markdown: lines.join("\n") + "\n", summary };
}

/** The workspace's packages and their workspace dependencies, layered, as a mermaid flowchart. */
export function workspaceMermaid(root: string, title = "vlmkit — the workspace"): string {
  const pkgs = readWorkspace(root);
  const layer = layersOf(pkgs);
  const id = new Map(pkgs.map((p, i) => [p.id, `p${i}`]));
  const lines = [`## ${title}`, "", "```mermaid", "flowchart BT"];
  const byLayer = new Map<number, WorkspacePackage[]>();
  for (const p of pkgs) byLayer.set(layer.get(p.id) ?? 0, [...(byLayer.get(layer.get(p.id) ?? 0) ?? []), p]);
  for (const [n, list] of [...byLayer.entries()].sort((a, b) => a[0] - b[0])) {
    lines.push(`  subgraph L${n}["layer ${n}"]`);
    for (const p of list) lines.push(`    ${id.get(p.id)}["${mermaidLabel(p.id)}"]`);
    lines.push("  end");
  }
  for (const p of pkgs) for (const d of p.deps) if (id.has(d)) lines.push(`  ${id.get(p.id)} --> ${id.get(d)}`);
  lines.push("```", "", "Arrows point from a package to the workspace packages it depends on; layer 0 depends on none.");
  return lines.join("\n") + "\n";
}
