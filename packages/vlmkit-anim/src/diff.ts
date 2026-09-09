/**
 * The diff figure (v22): two module maps — before and after, or two revisions of
 * one — drawn as one still with what changed marked. The after map is the
 * picture; what it added is in the accent colour, what it lost is drawn in,
 * dashed and muted, where it was; a module that changed container is accent
 * too, and a legend counts the change. `diffFacts` is the change as data —
 * added / removed / moved / relabelled — printed as one line and checkable
 * against a sheet with `--expect`, so a figure that claims a change is checked
 * against the two scenes, not against the writer's memory of them.
 */

import { depEnds, moduleId } from "./compile/modules.ts";
import type { Diagnostic } from "./types.ts";
import { SCENE_FORMAT, type ModuleDep, type ModuleDef, type ModuleGroup, type ModulesScene } from "./types.ts";

export const DIFF_FORMAT = "vlmkit-anim/diff@1";

export interface DiffSide {
  modules: string[];
  /** `"a->b"` */
  deps: string[];
  groups: string[];
}

export interface DiffFacts {
  format: typeof DIFF_FORMAT;
  added: DiffSide;
  removed: DiffSide;
  /** A module whose own container changed; `null` is "no container". */
  moved: { module: string; from: string | null; to: string | null }[];
  relabelled: { id: string; from: string; to: string }[];
  unchanged: { modules: number; deps: number; groups: number };
}

/** A sheet for `diff --expect`: any subset of the facts' fields, each compared as a set. */
export interface DiffExpectation {
  format?: string;
  added?: Partial<DiffSide>;
  removed?: Partial<DiffSide>;
  moved?: DiffFacts["moved"];
  relabelled?: DiffFacts["relabelled"];
}

const labelOf = (m: string | ModuleDef): string => (typeof m === "string" ? m : (m.label ?? m.id));
const depKey = (d: ModuleDep): string => depEnds(d).join("->");
const isForbidden = (d: ModuleDep): boolean => !Array.isArray(d) && (d as { style?: string }).style === "forbidden";

/** Module id → the id of the group whose `modules` list names it (its own container), or null. */
function ownerMap(scene: ModulesScene): Map<string, string | null> {
  const out = new Map<string, string | null>();
  for (const m of scene.modules) out.set(moduleId(m), null);
  for (const g of scene.groups ?? []) for (const id of g.modules) out.set(id, g.id);
  return out;
}

/** What changed between two module maps. Forbidden dependencies are claims about absence and are compared as deps too. */
export function diffFacts(before: ModulesScene, after: ModulesScene): DiffFacts {
  const bMods = new Map(before.modules.map((m) => [moduleId(m), labelOf(m)]));
  const aMods = new Map(after.modules.map((m) => [moduleId(m), labelOf(m)]));
  const bDeps = new Set((before.deps ?? []).map(depKey));
  const aDeps = new Set((after.deps ?? []).map(depKey));
  const bGroups = new Set((before.groups ?? []).map((g) => g.id));
  const aGroups = new Set((after.groups ?? []).map((g) => g.id));
  const bOwner = ownerMap(before);
  const aOwner = ownerMap(after);
  const moved: DiffFacts["moved"] = [];
  const relabelled: DiffFacts["relabelled"] = [];
  for (const [id, label] of aMods) {
    if (!bMods.has(id)) continue;
    if (bMods.get(id) !== label) relabelled.push({ id, from: bMods.get(id)!, to: label });
    const from = bOwner.get(id) ?? null;
    const to = aOwner.get(id) ?? null;
    if (from !== to) moved.push({ module: id, from, to });
  }
  const diff = <T>(a: Iterable<T>, b: Set<T>): T[] => [...a].filter((x) => !b.has(x));
  const addedModules = diff(aMods.keys(), new Set(bMods.keys()));
  const removedModules = diff(bMods.keys(), new Set(aMods.keys()));
  const addedDeps = diff(aDeps, bDeps);
  const removedDeps = diff(bDeps, aDeps);
  return {
    format: DIFF_FORMAT,
    added: { modules: addedModules, deps: addedDeps, groups: diff(aGroups, bGroups) },
    removed: { modules: removedModules, deps: removedDeps, groups: diff(bGroups, aGroups) },
    moved,
    relabelled,
    unchanged: {
      modules: aMods.size - addedModules.length,
      deps: aDeps.size - addedDeps.length,
      groups: aGroups.size - diff(aGroups, bGroups).length,
    },
  };
}

/** One line: `+1 module (search) · +2 deps · −1 module (cache) · −1 dep · 1 moved (auth: core → identity)`. */
export function formatDiffFacts(f: DiffFacts): string {
  const parts: string[] = [];
  const list = (xs: string[]) => (xs.length && xs.length <= 4 ? ` (${xs.join(", ")})` : "");
  const n = (k: number, one: string, many = `${one}s`) => `${k} ${k === 1 ? one : many}`;
  if (f.added.modules.length) parts.push(`+${n(f.added.modules.length, "module")}${list(f.added.modules)}`);
  if (f.added.deps.length) parts.push(`+${n(f.added.deps.length, "dep")}${list(f.added.deps)}`);
  if (f.added.groups.length) parts.push(`+${n(f.added.groups.length, "group")}${list(f.added.groups)}`);
  if (f.removed.modules.length) parts.push(`−${n(f.removed.modules.length, "module")}${list(f.removed.modules)}`);
  if (f.removed.deps.length) parts.push(`−${n(f.removed.deps.length, "dep")}${list(f.removed.deps)}`);
  if (f.removed.groups.length) parts.push(`−${n(f.removed.groups.length, "group")}${list(f.removed.groups)}`);
  if (f.moved.length) parts.push(`${n(f.moved.length, "moved", "moved")} (${f.moved.map((m) => `${m.module}: ${m.from ?? "—"} → ${m.to ?? "—"}`).join(", ")})`);
  if (f.relabelled.length) parts.push(`${n(f.relabelled.length, "relabelled", "relabelled")} (${f.relabelled.map((r) => `${r.id}: "${r.from}" → "${r.to}"`).join(", ")})`);
  return parts.length ? parts.join(" · ") : "no change";
}

/**
 * The after map with the change marked: added modules and dependencies in the accent colour, removed ones
 * drawn in dashed and muted where they were (a removed module inside the container it left, when that
 * container survives), moved modules accent, an added container highlighted, and a legend.
 */
export function diffScene(before: ModulesScene, after: ModulesScene, facts = diffFacts(before, after)): ModulesScene {
  const added = new Set(facts.added.modules);
  const movedIds = new Set(facts.moved.map((m) => m.module));
  const relabelledIds = new Set(facts.relabelled.map((r) => r.id));
  const modules: (string | ModuleDef)[] = after.modules.map((m) => {
    const id = moduleId(m);
    const def: ModuleDef = typeof m === "string" ? { id } : { ...m };
    if (added.has(id) || movedIds.has(id)) def.tone = "accent";
    else if (relabelledIds.has(id)) def.tone = "accent";
    return def.tone || def.label || def.hidden ? def : id;
  });
  const bLabel = new Map(before.modules.map((m) => [moduleId(m), labelOf(m)]));
  for (const id of facts.removed.modules) modules.push({ id, label: bLabel.get(id) ?? id, tone: "muted", dashed: true });
  const addedDeps = new Set(facts.added.deps);
  const deps: ModuleDep[] = (after.deps ?? []).map((d) => {
    if (!addedDeps.has(depKey(d)) || isForbidden(d)) return d;
    const [from, to] = depEnds(d);
    return { ...(Array.isArray(d) ? {} : (d as object)), from, to, tone: "accent" };
  });
  const bDepsByKey = new Map((before.deps ?? []).map((d) => [depKey(d), d]));
  for (const key of facts.removed.deps) {
    const d = bDepsByKey.get(key)!;
    if (isForbidden(d)) continue; // a lifted prohibition is not drawn as a dependency
    const [from, to] = depEnds(d);
    deps.push({ from, to, style: "dashed", tone: "muted", ...(Array.isArray(d) || !(d as { label?: string }).label ? {} : { label: (d as { label: string }).label }) });
  }
  // Groups: the after map's; a removed module sits in the container it left when that container survives.
  const bOwner = ownerMap(before);
  const groups: ModuleGroup[] = (after.groups ?? []).map((g) => ({ ...g, modules: [...g.modules] }));
  for (const id of facts.removed.modules) {
    const owner = bOwner.get(id);
    const g = owner ? groups.find((x) => x.id === owner) : undefined;
    if (g) g.modules.push(id);
  }
  // Short lines: the legend sits in the readout panel beside the map, and one long line would run across it.
  const n = (k: number, one: string, many = `${one}s`) => `${k} ${k === 1 ? one : many}`;
  const plus = [facts.added.modules.length && `+${n(facts.added.modules.length, "module")}`, facts.added.deps.length && `+${n(facts.added.deps.length, "dep")}`, facts.added.groups.length && `+${n(facts.added.groups.length, "group")}`].filter(Boolean);
  const minus = [facts.removed.modules.length && `−${n(facts.removed.modules.length, "module")}`, facts.removed.deps.length && `−${n(facts.removed.deps.length, "dep")}`, facts.removed.groups.length && `−${n(facts.removed.groups.length, "group")}`].filter(Boolean);
  const other = [facts.moved.length && `${facts.moved.length} moved`, facts.relabelled.length && `${facts.relabelled.length} relabelled`].filter(Boolean);
  const legend = [plus.join(" · "), minus.join(" · "), other.join(" · ")].filter(Boolean);
  if (!legend.length) legend.push("no change");
  legend.push("accent: added or moved", "dashed grey: removed");
  const sequence: ModulesScene["sequence"] = [];
  if (facts.added.groups.length) sequence.push({ highlight: facts.added.groups.length === 1 ? facts.added.groups[0] : facts.added.groups, ms: 0 } as ModulesScene["sequence"] extends (infer T)[] | undefined ? T : never);
  sequence.push({ text: { lines: legend } } as ModulesScene["sequence"] extends (infer T)[] | undefined ? T : never);
  return {
    format: SCENE_FORMAT,
    kind: "modules",
    title: after.title ? `${after.title} — what changed` : "What changed",
    ...(after.theme ? { theme: after.theme } : {}),
    ...(after.layout ? { layout: after.layout } : {}),
    modules,
    deps,
    ...(groups.length ? { groups } : {}),
    sequence,
  };
}

/** Compare the facts of a change with a sheet: every field the sheet has, as a set, said once per difference. */
export function checkDiffExpectation(facts: DiffFacts, exp: DiffExpectation): Diagnostic[] {
  const out: Diagnostic[] = [];
  const err = (path: string, message: string, hint?: string): Diagnostic => ({ severity: "error", path, message, ...(hint ? { hint } : {}) });
  if (exp.format !== undefined && exp.format !== DIFF_FORMAT) out.push(err("expect.format", `"format" must be "${DIFF_FORMAT}"`));
  const sets = (side: "added" | "removed") => {
    const want = exp[side];
    if (!want) return;
    for (const field of ["modules", "deps", "groups"] as const) {
      const w = want[field];
      if (!w) continue;
      const got = facts[side][field];
      const missing = w.filter((x) => !got.includes(x));
      const extra = got.filter((x) => !w.includes(x));
      const noun = field === "deps" ? "dependency" : field.slice(0, -1);
      for (const x of missing) out.push(err(`expect.${side}.${field}`, `the facts say ${noun} "${x}" was ${side}; the two scenes do not show that`, side === "added" ? `add it to the after scene, or take it out of the sheet` : `take it out of the after scene, or out of the sheet`));
      for (const x of extra) out.push(err(`${side}.${field}`, `${noun} "${x}" was ${side} between the scenes but the sheet does not say so`, `add it to the sheet, or undo the change`));
    }
  };
  sets("added");
  sets("removed");
  if (exp.moved) {
    const key = (m: DiffFacts["moved"][number]) => `${m.module}: ${m.from ?? "—"} → ${m.to ?? "—"}`;
    const want = exp.moved.map(key);
    const got = facts.moved.map(key);
    for (const x of want) if (!got.includes(x)) out.push(err("expect.moved", `the facts say ${x} moved; the two scenes do not show that`));
    for (const x of got) if (!want.includes(x)) out.push(err("moved", `${x} moved between the scenes but the sheet does not say so`));
  }
  if (exp.relabelled) {
    const key = (r: DiffFacts["relabelled"][number]) => `${r.id}: "${r.from}" → "${r.to}"`;
    const want = exp.relabelled.map(key);
    const got = facts.relabelled.map(key);
    for (const x of want) if (!got.includes(x)) out.push(err("expect.relabelled", `the facts say ${x} was relabelled; the two scenes do not show that`));
    for (const x of got) if (!want.includes(x)) out.push(err("relabelled", `${x} was relabelled between the scenes but the sheet does not say so`));
  }
  return out;
}

export const DIFF_SHEET = `A diff sheet (vlmkit-anim diff before.json after.json --expect diff.json) — the change two module maps must show:
  "format":     "${DIFF_FORMAT}"
  "added":      {"modules": [ids], "deps": ["a->b"], "groups": [ids]}   what the after map has that the before map did not
  "removed":    {"modules": [ids], "deps": ["a->b"], "groups": [ids]}   what the before map had that the after map does not
  "moved":      [{"module", "from": group id | null, "to": group id | null}]   a module whose own container changed
  "relabelled": [{"id", "from": "old label", "to": "new label"}]
Every field is optional; a present one must match exactly — a change the sheet does not name is an error too.`;
