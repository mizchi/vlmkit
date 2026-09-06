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

/** The change map of `base..head` as a `diagram`: areas appear as commits touch them, edges are imports, readouts count. */
export function changeMapScene(opts: ChangeMapOptions): ChangeMap {
  const head = opts.head ?? "HEAD";
  const commits = readCommits(opts.root, opts.base, head);
  const perArea = new Map<string, number>();
  const changed = new Set<string>();
  for (const c of commits) for (const path of c.files.keys()) {
    changed.add(path);
    perArea.set(areaOf(path), (perArea.get(areaOf(path)) ?? 0) + 1);
  }
  const maxAreas = opts.maxAreas ?? 14;
  const ranked = [...perArea.entries()].sort((a, b) => b[1] - a[1]).map(([a]) => a);
  const kept = new Set(ranked.slice(0, ranked.length > maxAreas ? maxAreas - 1 : maxAreas));
  const merged = ranked.filter((a) => !kept.has(a));
  const OTHER = merged.length ? `other (${merged.length} areas)` : undefined;
  const area = (path: string): string => (kept.has(areaOf(path)) ? areaOf(path) : OTHER!);
  const areas = [...kept, ...(OTHER ? [OTHER] : [])];
  const areaSet = new Set(areas);

  const nodes: DiagramNode[] = areas.map((a) => ({ id: a, label: a, hidden: true }));
  const edges = importEdges(opts.root, head, changed, new Set(kept)).filter((e) => areaSet.has(e.from) && areaSet.has(e.to)).map((e) => ({ ...e, hidden: true }));

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
