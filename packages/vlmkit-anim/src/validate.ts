/**
 * Field-by-field validation of both IR layers, phrased for the writer to
 * repair from.
 *
 * Every diagnostic carries a JSON path, one sentence saying what is wrong,
 * and — whenever the validator can tell — a `hint` with the fix: the closest
 * accepted spelling for an unknown key or enum value, the list of ids that DO
 * exist for a dangling reference, the shape a value should have. The
 * validation loop an agent runs is "read the hints, edit, re-run", so a
 * message that only says "invalid" costs a round.
 *
 * No JSON Schema library: the schemas are small, and hand-written checks can
 * say "did you mean `rect`?" where a generic validator says "not one of enum".
 */

import {
  NAMED_EASINGS,
  SCENE_FORMAT,
  SCENE_KINDS,
  SHAPES,
  TIMELINE_FORMAT,
  TRACK_PROPS,
  type Diagnostic,
  type Scene,
  type Timeline,
} from "./types.ts";

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === "string";
const isVec2 = (v: unknown): v is [number, number] => Array.isArray(v) && v.length === 2 && v.every(isNum);

/** Levenshtein distance, for "did you mean". */
export function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...new Array<number>(n).fill(0)]);
  for (let j = 1; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return dp[m][n];
}

export function closest(word: string, candidates: readonly string[]): string | undefined {
  let best: string | undefined;
  let bestD = Infinity;
  for (const c of candidates) {
    const d = editDistance(word.toLowerCase(), c.toLowerCase());
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  // Accept a suggestion when it is plausibly a typo, or when one spelling is a
  // prefix of the other ("rectangle" → "rect", "position" → "pos"): the writer
  // knew the concept and guessed a longer or shorter name for it.
  if (best === undefined) return undefined;
  if (bestD <= Math.max(2, Math.floor(word.length / 2))) return best;
  const w = word.toLowerCase();
  const prefixed = candidates.find((c) => {
    const cl = c.toLowerCase();
    return cl.length >= 3 && w.length >= 3 && (w.startsWith(cl) || cl.startsWith(w));
  });
  return prefixed;
}

const list = (xs: readonly string[]): string => xs.map((x) => `"${x}"`).join(", ");

class Ctx {
  readonly diags: Diagnostic[] = [];
  error(path: string, message: string, hint?: string): void {
    this.diags.push({ severity: "error", path, message, ...(hint ? { hint } : {}) });
  }
  warn(path: string, message: string, hint?: string): void {
    this.diags.push({ severity: "warn", path, message, ...(hint ? { hint } : {}) });
  }

  /** Flag keys the schema does not know, suggesting the nearest known one. */
  keys(obj: Obj, path: string, known: readonly string[]): void {
    for (const k of Object.keys(obj)) {
      if (known.includes(k)) continue;
      const near = closest(k, known);
      this.error(
        path ? `${path}.${k}` : k,
        `unknown key "${k}"`,
        near ? `did you mean "${near}"? accepted keys: ${list(known)}` : `accepted keys: ${list(known)}`,
      );
    }
  }

  enumOf(v: unknown, path: string, options: readonly string[], what = "value"): boolean {
    if (isStr(v) && options.includes(v)) return true;
    const near = isStr(v) ? closest(v, options) : undefined;
    this.error(
      path,
      `${what} ${JSON.stringify(v)} is not one of ${list(options)}`,
      near ? `did you mean "${near}"?` : undefined,
    );
    return false;
  }

  number(v: unknown, path: string, opts: { min?: number; integer?: boolean } = {}): v is number {
    if (!isNum(v)) {
      this.error(path, `expected a number, got ${describe(v)}`);
      return false;
    }
    if (opts.integer && !Number.isInteger(v)) {
      this.error(path, `expected an integer, got ${v}`);
      return false;
    }
    if (opts.min !== undefined && v < opts.min) {
      this.error(path, `expected a number >= ${opts.min}, got ${v}`);
      return false;
    }
    return true;
  }

  string(v: unknown, path: string): v is string {
    if (isStr(v) && v.length > 0) return true;
    this.error(path, `expected a non-empty string, got ${describe(v)}`);
    return false;
  }

  vec2(v: unknown, path: string): v is [number, number] {
    if (isVec2(v)) return true;
    this.error(path, `expected [x, y] (two numbers), got ${describe(v)}`);
    return false;
  }

  array(v: unknown, path: string, opts: { minLength?: number } = {}): v is unknown[] {
    if (!Array.isArray(v)) {
      this.error(path, `expected an array, got ${describe(v)}`);
      return false;
    }
    if (opts.minLength !== undefined && v.length < opts.minLength) {
      this.error(path, `expected at least ${opts.minLength} item(s), got ${v.length}`);
      return false;
    }
    return true;
  }

  object(v: unknown, path: string): v is Obj {
    if (isObj(v)) return true;
    this.error(path, `expected an object, got ${describe(v)}`);
    return false;
  }

  ref(id: unknown, path: string, ids: readonly string[], what: string): boolean {
    if (!isStr(id)) {
      this.error(path, `expected a ${what} id (string), got ${describe(id)}`);
      return false;
    }
    if (ids.includes(id)) return true;
    const near = closest(id, ids);
    this.error(
      path,
      `unknown ${what} "${id}"`,
      near ? `did you mean "${near}"? known ${what}s: ${list(ids)}` : `known ${what}s: ${list(ids)}`,
    );
    return false;
  }
}

function describe(v: unknown): string {
  if (v === undefined) return "nothing (missing)";
  if (v === null) return "null";
  if (Array.isArray(v)) return `an array of ${v.length}`;
  if (typeof v === "object") return "an object";
  if (typeof v === "string") return `the string ${JSON.stringify(v.length > 40 ? v.slice(0, 40) + "…" : v)}`;
  return `${typeof v} ${String(v)}`;
}

function easing(ctx: Ctx, v: unknown, path: string): void {
  if (v === undefined) return;
  if (isStr(v) && (NAMED_EASINGS as readonly string[]).includes(v)) return;
  if (isStr(v) && /^cubic-bezier\(\s*-?[\d.]+\s*,\s*-?[\d.]+\s*,\s*-?[\d.]+\s*,\s*-?[\d.]+\s*\)$/.test(v)) return;
  const near = isStr(v) ? closest(v, NAMED_EASINGS) : undefined;
  ctx.error(
    path,
    `easing ${JSON.stringify(v)} is not one of ${list(NAMED_EASINGS)} or cubic-bezier(a,b,c,d)`,
    near ? `did you mean "${near}"?` : undefined,
  );
}

function ids(ctx: Ctx, items: unknown[], path: string, key = "id"): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  items.forEach((item, i) => {
    const id = isObj(item) ? item[key] : isStr(item) ? item : undefined;
    if (!isStr(id) || id.length === 0) {
      ctx.error(`${path}[${i}].${key}`, `every item needs a non-empty string "${key}"`);
      return;
    }
    if (seen.has(id)) ctx.error(`${path}[${i}].${key}`, `duplicate ${key} "${id}"`, "ids must be unique");
    seen.add(id);
    out.push(id);
  });
  return out;
}

// ---------------------------------------------------------------------------
// Timeline (layer 2)
// ---------------------------------------------------------------------------

const NODE_KEYS = [
  "id", "shape", "pos", "size", "r", "rx", "points", "d", "text", "fontSize", "anchor", "fill", "stroke",
  "strokeWidth", "opacity", "dash", "scale", "rotate", "parent", "color",
] as const;

export function validateTimelineNode(ctx: Ctx, node: unknown, path: string): void {
  if (!ctx.object(node, path)) return;
  ctx.keys(node, path, NODE_KEYS);
  ctx.string(node.id, `${path}.id`);
  if (!ctx.enumOf(node.shape, `${path}.shape`, SHAPES, "shape")) return;
  const shape = node.shape as string;
  if (node.pos !== undefined) ctx.vec2(node.pos, `${path}.pos`);
  if (node.size !== undefined) ctx.vec2(node.size, `${path}.size`);
  if (node.points !== undefined) {
    if (!Array.isArray(node.points) || node.points.length !== 2 || !node.points.every(isVec2)) {
      ctx.error(`${path}.points`, `expected [[x1, y1], [x2, y2]], got ${describe(node.points)}`);
    }
  }
  for (const k of ["r", "rx", "fontSize", "strokeWidth", "scale", "rotate"] as const) {
    if (node[k] !== undefined) ctx.number(node[k], `${path}.${k}`);
  }
  for (const k of ["opacity", "dash"] as const) {
    if (node[k] !== undefined && ctx.number(node[k], `${path}.${k}`) && ((node[k] as number) < 0 || (node[k] as number) > 1)) {
      ctx.error(`${path}.${k}`, `${k} must be within 0..1, got ${node[k]}`);
    }
  }
  if (node.anchor !== undefined) ctx.enumOf(node.anchor, `${path}.anchor`, ["start", "middle", "end"], "anchor");
  for (const k of ["text", "fill", "stroke", "color", "d", "parent"] as const) {
    if (node[k] !== undefined && !isStr(node[k])) ctx.error(`${path}.${k}`, `expected a string, got ${describe(node[k])}`);
  }
  // Shape-specific requirements, phrased as what to add.
  if (shape === "rect" || shape === "ellipse") {
    if (node.size === undefined) ctx.error(`${path}.size`, `${shape} needs "size": [width, height]`);
  } else if (shape === "circle") {
    if (node.r === undefined) ctx.error(`${path}.r`, `circle needs "r": radius`);
  } else if (shape === "text") {
    if (node.text === undefined) ctx.error(`${path}.text`, `text needs "text": "…"`);
  } else if (shape === "line" || shape === "arrow") {
    if (node.points === undefined) ctx.error(`${path}.points`, `${shape} needs "points": [[x1, y1], [x2, y2]]`);
  } else if (shape === "path") {
    if (node.d === undefined) ctx.error(`${path}.d`, `path needs "d": "M … "`);
  }
}

function trackValue(ctx: Ctx, prop: string, value: unknown, path: string): void {
  switch (prop) {
    case "pos":
    case "size":
      ctx.vec2(value, path);
      return;
    case "r":
    case "scale":
    case "rotate":
      ctx.number(value, path);
      return;
    case "opacity":
    case "dash":
      if (ctx.number(value, path) && (value < 0 || value > 1)) ctx.error(path, `${prop} must be within 0..1, got ${value}`);
      return;
    case "fill":
    case "stroke":
    case "color":
    case "text":
      if (!isStr(value)) ctx.error(path, `${prop} takes a string, got ${describe(value)}`);
      return;
  }
}

export function validateTimeline(doc: unknown): Diagnostic[] {
  const ctx = new Ctx();
  if (!ctx.object(doc, "")) return ctx.diags;
  ctx.keys(doc, "", ["format", "canvas", "duration", "nodes", "tracks", "steps", "meta"]);
  if (doc.format !== TIMELINE_FORMAT) {
    ctx.error("format", `expected "${TIMELINE_FORMAT}", got ${describe(doc.format)}`, `set "format": "${TIMELINE_FORMAT}"`);
  }
  if (ctx.object(doc.canvas, "canvas")) {
    ctx.keys(doc.canvas, "canvas", ["width", "height", "background"]);
    ctx.number(doc.canvas.width, "canvas.width", { min: 1 });
    ctx.number(doc.canvas.height, "canvas.height", { min: 1 });
  }
  if (doc.duration !== undefined) ctx.number(doc.duration, "duration", { min: 0 });

  let nodeIds: string[] = [];
  if (ctx.array(doc.nodes, "nodes")) {
    nodeIds = ids(ctx, doc.nodes, "nodes");
    doc.nodes.forEach((n, i) => validateTimelineNode(ctx, n, `nodes[${i}]`));
    doc.nodes.forEach((n, i) => {
      if (isObj(n) && n.parent !== undefined) ctx.ref(n.parent, `nodes[${i}].parent`, nodeIds, "node");
    });
  }

  let lastT = 0;
  if (ctx.array(doc.tracks, "tracks")) {
    doc.tracks.forEach((tr, i) => {
      const path = `tracks[${i}]`;
      if (!ctx.object(tr, path)) return;
      ctx.keys(tr, path, ["target", "prop", "keyframes"]);
      ctx.ref(tr.target, `${path}.target`, nodeIds, "node");
      const propOk = ctx.enumOf(tr.prop, `${path}.prop`, TRACK_PROPS, "prop");
      if (!ctx.array(tr.keyframes, `${path}.keyframes`, { minLength: 1 })) return;
      let prev = -Infinity;
      tr.keyframes.forEach((kf, j) => {
        const kp = `${path}.keyframes[${j}]`;
        if (!ctx.object(kf, kp)) return;
        ctx.keys(kf, kp, ["t", "value", "easing"]);
        if (ctx.number(kf.t, `${kp}.t`, { min: 0 })) {
          if (kf.t < prev) ctx.error(`${kp}.t`, `keyframes must be in ascending time order (${kf.t} after ${prev})`);
          prev = kf.t;
          lastT = Math.max(lastT, kf.t);
        }
        if (propOk) trackValue(ctx, tr.prop as string, kf.value, `${kp}.value`);
        easing(ctx, kf.easing, `${kp}.easing`);
      });
    });
  }

  if (doc.steps !== undefined && ctx.array(doc.steps, "steps")) {
    doc.steps.forEach((s, i) => {
      const path = `steps[${i}]`;
      if (!ctx.object(s, path)) return;
      ctx.keys(s, path, ["t", "label", "caption"]);
      if (ctx.number(s.t, `${path}.t`, { min: 0 })) lastT = Math.max(lastT, s.t);
    });
  }
  if (isNum(doc.duration) && doc.duration < lastT) {
    ctx.error("duration", `duration ${doc.duration} is shorter than the last keyframe/step at ${lastT}`, "raise duration or drop it to have it computed");
  }
  return ctx.diags;
}

// ---------------------------------------------------------------------------
// Scene (layer 1)
// ---------------------------------------------------------------------------

const BASE_KEYS = ["format", "kind", "title", "stepMs", "canvas", "theme"] as const;

function validateBase(ctx: Ctx, doc: Obj, extra: readonly string[]): void {
  ctx.keys(doc, "", [...BASE_KEYS, ...extra]);
  if (doc.stepMs !== undefined) ctx.number(doc.stepMs, "stepMs", { min: 1 });
  if (doc.canvas !== undefined && ctx.object(doc.canvas, "canvas")) {
    ctx.keys(doc.canvas, "canvas", ["width", "height", "background"]);
    if (doc.canvas.width !== undefined) ctx.number(doc.canvas.width, "canvas.width", { min: 1 });
    if (doc.canvas.height !== undefined) ctx.number(doc.canvas.height, "canvas.height", { min: 1 });
  }
  if (doc.theme !== undefined && ctx.object(doc.theme, "theme")) {
    ctx.keys(doc.theme, "theme", ["node", "nodeStroke", "text", "accent", "muted", "ok", "bad", "background", "fontSize"]);
  }
}

function captionAndMs(ctx: Ctx, step: Obj, path: string): void {
  if (step.caption !== undefined && !isStr(step.caption)) ctx.error(`${path}.caption`, `caption must be a string`);
  if (step.ms !== undefined) ctx.number(step.ms, `${path}.ms`, { min: 1 });
}

function idOrIds(ctx: Ctx, v: unknown, path: string, known: string[], what: string): void {
  const arr = Array.isArray(v) ? v : [v];
  arr.forEach((id, i) => ctx.ref(id, Array.isArray(v) ? `${path}[${i}]` : path, known, what));
}

function validateDiagram(ctx: Ctx, doc: Obj): void {
  validateBase(ctx, doc, ["nodes", "edges", "layout", "sequence"]);
  if (doc.layout !== undefined) ctx.enumOf(doc.layout, "layout", ["lr", "tb", "grid", "circle"], "layout");
  let nodeIds: string[] = [];
  if (ctx.array(doc.nodes, "nodes", { minLength: 1 })) {
    nodeIds = ids(ctx, doc.nodes, "nodes");
    doc.nodes.forEach((n, i) => {
      const path = `nodes[${i}]`;
      if (!ctx.object(n, path)) return;
      ctx.keys(n, path, ["id", "label", "shape", "pos", "fill", "hidden"]);
      if (n.shape !== undefined) ctx.enumOf(n.shape, `${path}.shape`, ["rect", "circle", "ellipse"], "shape");
      if (n.pos !== undefined) ctx.vec2(n.pos, `${path}.pos`);
    });
  }
  const edgeKeys: string[] = [];
  if (doc.edges !== undefined && ctx.array(doc.edges, "edges")) {
    doc.edges.forEach((e, i) => {
      const path = `edges[${i}]`;
      if (!ctx.object(e, path)) return;
      ctx.keys(e, path, ["from", "to", "label", "style", "hidden"]);
      const a = ctx.ref(e.from, `${path}.from`, nodeIds, "node");
      const b = ctx.ref(e.to, `${path}.to`, nodeIds, "node");
      if (a && b) edgeKeys.push(`${e.from as string}->${e.to as string}`);
      if (e.style !== undefined) ctx.enumOf(e.style, `${path}.style`, ["arrow", "line"], "style");
    });
  }
  if (doc.sequence !== undefined && ctx.array(doc.sequence, "sequence")) {
    const ACTIONS = ["show", "hide", "highlight", "unhighlight", "flow", "note", "relabel"];
    doc.sequence.forEach((s, i) => {
      const path = `sequence[${i}]`;
      if (!ctx.object(s, path)) return;
      const actions = Object.keys(s).filter((k) => ACTIONS.includes(k));
      if (actions.length !== 1) {
        ctx.error(path, `a step needs exactly one action key, found ${actions.length ? list(actions) : "none"}`, `one of ${list(ACTIONS)}, plus optional "caption" and "ms"`);
        ctx.keys(s, path, [...ACTIONS, "caption", "ms"]);
        return;
      }
      ctx.keys(s, path, [...ACTIONS, "caption", "ms"]);
      captionAndMs(ctx, s, path);
      const action = actions[0];
      const v = s[action];
      switch (action) {
        case "show":
        case "hide":
        case "highlight":
        case "unhighlight":
          idOrIds(ctx, v, `${path}.${action}`, nodeIds, "node");
          break;
        case "flow": {
          let from: unknown;
          let to: unknown;
          if (isStr(v) && v.includes("->")) [from, to] = v.split("->").map((x) => x.trim());
          else if (Array.isArray(v) && v.length === 2) [from, to] = v;
          else {
            ctx.error(`${path}.flow`, `flow takes "a->b" or ["a", "b"], got ${describe(v)}`);
            break;
          }
          const a = ctx.ref(from, `${path}.flow`, nodeIds, "node");
          const b = ctx.ref(to, `${path}.flow`, nodeIds, "node");
          if (a && b && !edgeKeys.includes(`${from as string}->${to as string}`) && !edgeKeys.includes(`${to as string}->${from as string}`)) {
            ctx.error(`${path}.flow`, `no edge between "${from as string}" and "${to as string}"`, `add {"from": "${from as string}", "to": "${to as string}"} to "edges", or flow along an existing edge: ${edgeKeys.length ? list(edgeKeys) : "(none declared)"}`);
          }
          break;
        }
        case "note":
          if (!isStr(v)) ctx.error(`${path}.note`, `note takes a string`);
          break;
        case "relabel":
          if (ctx.object(v, `${path}.relabel`)) {
            ctx.keys(v, `${path}.relabel`, ["id", "text"]);
            ctx.ref(v.id, `${path}.relabel.id`, nodeIds, "node");
            if (!isStr(v.text)) ctx.error(`${path}.relabel.text`, `text must be a string`);
          }
          break;
      }
    });
  }
}

function validateStateMachine(ctx: Ctx, doc: Obj): void {
  validateBase(ctx, doc, ["states", "initial", "transitions", "trace", "layout"]);
  if (doc.layout !== undefined) ctx.enumOf(doc.layout, "layout", ["lr", "tb", "circle"], "layout");
  let stateIds: string[] = [];
  if (ctx.array(doc.states, "states", { minLength: 1 })) {
    stateIds = ids(ctx, doc.states, "states");
    doc.states.forEach((s, i) => {
      if (isObj(s)) {
        ctx.keys(s, `states[${i}]`, ["id", "label", "final", "pos"]);
        if (s.pos !== undefined) ctx.vec2(s.pos, `states[${i}].pos`);
      } else if (!isStr(s)) ctx.error(`states[${i}]`, `a state is a string id or {"id", "label", "final", "pos"}`);
    });
  }
  ctx.ref(doc.initial, "initial", stateIds, "state");
  const table = new Map<string, Map<string, string>>();
  if (ctx.array(doc.transitions, "transitions")) {
    doc.transitions.forEach((t, i) => {
      const path = `transitions[${i}]`;
      if (!ctx.object(t, path)) return;
      ctx.keys(t, path, ["from", "to", "on", "note"]);
      const a = ctx.ref(t.from, `${path}.from`, stateIds, "state");
      const b = ctx.ref(t.to, `${path}.to`, stateIds, "state");
      const on = ctx.string(t.on, `${path}.on`);
      if (a && b && on) {
        const row = table.get(t.from as string) ?? new Map<string, string>();
        if (row.has(t.on as string)) {
          ctx.error(`${path}.on`, `state "${t.from as string}" already has a transition on "${t.on as string}" (to "${row.get(t.on as string)}")`, "events must be deterministic per state");
        }
        row.set(t.on as string, t.to as string);
        table.set(t.from as string, row);
      }
    });
  }
  if (ctx.array(doc.trace, "trace") && isStr(doc.initial) && stateIds.includes(doc.initial)) {
    let cur = doc.initial;
    for (let i = 0; i < doc.trace.length; i++) {
      const item = doc.trace[i];
      let ev: unknown = item;
      if (isObj(item)) {
        const keys = Object.keys(item);
        if ("note" in item) {
          ctx.keys(item, `trace[${i}]`, ["note"]);
          if (!isStr(item.note)) ctx.error(`trace[${i}].note`, "note takes a string");
          continue;
        }
        if ("goto" in item) {
          ctx.keys(item, `trace[${i}]`, ["goto", "caption"]);
          if (ctx.ref(item.goto, `trace[${i}].goto`, stateIds, "state")) cur = item.goto as string;
          continue;
        }
        if (!("on" in item)) {
          ctx.error(`trace[${i}]`, `a trace item is an event name, {"on", "caption"}, {"note"} or {"goto", "caption"}; found keys ${keys.length ? list(keys) : "none"}`);
          break;
        }
        ctx.keys(item, `trace[${i}]`, ["on", "caption"]);
        ev = item.on;
      }
      if (!ctx.string(ev, isObj(item) ? `trace[${i}].on` : `trace[${i}]`)) break;
      const row = table.get(cur);
      const next = row?.get(ev);
      if (next === undefined) {
        const avail = row ? [...row.keys()] : [];
        const near = closest(ev, avail);
        ctx.error(
          `trace[${i}]`,
          `no transition from "${cur}" on "${ev}"`,
          avail.length
            ? `${near ? `did you mean "${near}"? ` : ""}from "${cur}" the legal events are ${list(avail)}`
            : `"${cur}" has no outgoing transitions; add one to "transitions" or end the trace here`,
        );
        break;
      }
      cur = next;
    }
  }
}

function validateSort(ctx: Ctx, doc: Obj): void {
  validateBase(ctx, doc, ["values", "algorithm", "ops", "captions"]);
  let n = 0;
  if (ctx.array(doc.values, "values", { minLength: 2 })) {
    n = doc.values.length;
    doc.values.forEach((v, i) => ctx.number(v, `values[${i}]`));
  }
  if (doc.algorithm !== undefined) ctx.enumOf(doc.algorithm, "algorithm", ["bubble", "insertion", "selection"], "algorithm");
  if (doc.algorithm === undefined && doc.ops === undefined) {
    ctx.error("algorithm", `give "algorithm" (bubble | insertion | selection) or an explicit "ops" list`);
  }
  if (doc.ops !== undefined && ctx.array(doc.ops, "ops")) {
    const ACTIONS = ["compare", "swap", "done", "set", "note"];
    const idx = (v: unknown, path: string): void => {
      if (ctx.number(v, path, { integer: true, min: 0 }) && v >= n) ctx.error(path, `index ${v} is out of range for ${n} values (0..${n - 1})`);
    };
    doc.ops.forEach((op, i) => {
      const path = `ops[${i}]`;
      if (!ctx.object(op, path)) return;
      const actions = Object.keys(op).filter((k) => ACTIONS.includes(k));
      ctx.keys(op, path, [...ACTIONS, "caption", "ms"]);
      if (actions.length !== 1) {
        ctx.error(path, `an op needs exactly one action key, found ${actions.length ? list(actions) : "none"}`, `one of ${list(ACTIONS)}`);
        return;
      }
      captionAndMs(ctx, op, path);
      const a = actions[0];
      const v = op[a];
      if (a === "compare" || a === "swap") {
        if (Array.isArray(v) && v.length === 2) v.forEach((x, j) => idx(x, `${path}.${a}[${j}]`));
        else ctx.error(`${path}.${a}`, `${a} takes [i, j] (two indices), got ${describe(v)}`);
      } else if (a === "done") {
        (Array.isArray(v) ? v : [v]).forEach((x, j) => idx(x, Array.isArray(v) ? `${path}.done[${j}]` : `${path}.done`));
      } else if (a === "set") {
        if (ctx.object(v, `${path}.set`)) {
          ctx.keys(v, `${path}.set`, ["index", "value"]);
          idx(v.index, `${path}.set.index`);
          ctx.number(v.value, `${path}.set.value`);
        }
      } else if (a === "note" && !isStr(v)) ctx.error(`${path}.note`, `note takes a string`);
    });
  }
}

function validateHeap(ctx: Ctx, doc: Obj): void {
  validateBase(ctx, doc, ["type", "initial", "ops"]);
  if (doc.type !== undefined) ctx.enumOf(doc.type, "type", ["min", "max"], "type");
  if (doc.initial !== undefined && ctx.array(doc.initial, "initial")) {
    doc.initial.forEach((v, i) => ctx.number(v, `initial[${i}]`));
  }
  if (ctx.array(doc.ops, "ops", { minLength: 1 })) {
    const ACTIONS = ["push", "pop", "note"];
    doc.ops.forEach((op, i) => {
      const path = `ops[${i}]`;
      if (!ctx.object(op, path)) return;
      ctx.keys(op, path, [...ACTIONS, "caption"]);
      const actions = Object.keys(op).filter((k) => ACTIONS.includes(k));
      if (actions.length !== 1) {
        ctx.error(path, `an op needs exactly one action key, found ${actions.length ? list(actions) : "none"}`, `{"push": 5} | {"pop": true} | {"note": "…"}`);
        return;
      }
      const a = actions[0];
      if (a === "push") ctx.number(op.push, `${path}.push`);
      else if (a === "pop" && op.pop !== true) ctx.error(`${path}.pop`, `pop takes the literal true, got ${describe(op.pop)}`, `write {"pop": true}`);
      else if (a === "note" && !isStr(op.note)) ctx.error(`${path}.note`, `note takes a string`);
    });
  }
}

const STATUSES = ["up", "down", "leader", "busy"];

function validateDistributed(ctx: Ctx, doc: Obj): void {
  validateBase(ctx, doc, ["nodes", "messages", "events"]);
  let nodeIds: string[] = [];
  if (ctx.array(doc.nodes, "nodes", { minLength: 1 })) {
    nodeIds = ids(ctx, doc.nodes, "nodes");
    doc.nodes.forEach((n, i) => {
      if (isObj(n)) {
        ctx.keys(n, `nodes[${i}]`, ["id", "label", "status"]);
        if (n.status !== undefined) ctx.enumOf(n.status, `nodes[${i}].status`, STATUSES, "status");
      } else if (!isStr(n)) ctx.error(`nodes[${i}]`, `a node is a string id or {"id", "label", "status"}`);
    });
  }
  // `after` names an EARLIER message by label; a label used twice cannot be an anchor.
  const labelsSoFar: string[] = [];
  const allLabels = new Map<string, number>();
  if (Array.isArray(doc.messages)) for (const m of doc.messages) if (isObj(m) && isStr(m.label)) allLabels.set(m.label, (allLabels.get(m.label) ?? 0) + 1);
  const anchor = (v: unknown, path: string, candidates: string[]): void => {
    if (!isStr(v)) {
      ctx.error(path, `after takes the "label" of an earlier message, got ${describe(v)}`);
      return;
    }
    if ((allLabels.get(v) ?? 0) > 1) {
      ctx.error(path, `"${v}" labels ${allLabels.get(v)} messages, so it cannot anchor anything`, "give the message you mean a unique label");
      return;
    }
    if (!candidates.includes(v)) {
      const near = closest(v, candidates);
      const later = allLabels.has(v);
      ctx.error(
        path,
        later ? `"${v}" is a later message; after can only reference an earlier one` : `no earlier message is labelled "${v}"`,
        candidates.length ? `${near ? `did you mean "${near}"? ` : ""}earlier labels: ${list(candidates)}` : "no earlier message has a label yet",
      );
    }
  };
  if (ctx.array(doc.messages, "messages")) {
    doc.messages.forEach((m, i) => {
      const path = `messages[${i}]`;
      if (!ctx.object(m, path)) return;
      ctx.keys(m, path, ["from", "to", "label", "at", "after", "delay", "latency", "lost", "caption"]);
      const a = ctx.ref(m.from, `${path}.from`, nodeIds, "node");
      const b = ctx.ref(m.to, `${path}.to`, nodeIds, "node");
      if (a && b && m.from === m.to) ctx.error(`${path}.to`, `a message cannot go from "${m.from as string}" to itself`);
      if (m.at !== undefined) ctx.number(m.at, `${path}.at`, { min: 0 });
      if (m.after !== undefined) anchor(m.after, `${path}.after`, labelsSoFar);
      if (m.at !== undefined && m.after !== undefined) ctx.error(`${path}.after`, `give "at" or "after", not both`);
      if (m.delay !== undefined) ctx.number(m.delay, `${path}.delay`, { min: 0 });
      if (m.latency !== undefined) ctx.number(m.latency, `${path}.latency`, { min: 1 });
      if (m.lost !== undefined && typeof m.lost !== "boolean") ctx.error(`${path}.lost`, `lost takes true/false`);
      if (isStr(m.label)) labelsSoFar.push(m.label);
    });
  }
  if (doc.events !== undefined && ctx.array(doc.events, "events")) {
    doc.events.forEach((e, i) => {
      const path = `events[${i}]`;
      if (!ctx.object(e, path)) return;
      ctx.keys(e, path, ["at", "after", "delay", "node", "status", "caption"]);
      if (e.at === undefined && e.after === undefined) ctx.error(path, `an event needs "at" (ms) or "after" (a message label)`, `e.g. {"after": "ok", "node": "primary", "status": "down"}`);
      if (e.at !== undefined) ctx.number(e.at, `${path}.at`, { min: 0 });
      if (e.after !== undefined) anchor(e.after, `${path}.after`, [...allLabels.keys()].filter((l) => allLabels.get(l) === 1));
      if (e.delay !== undefined) ctx.number(e.delay, `${path}.delay`, { min: 0 });
      ctx.ref(e.node, `${path}.node`, nodeIds, "node");
      ctx.enumOf(e.status, `${path}.status`, STATUSES, "status");
    });
  }
}

const TWEEN_TO_KEYS = ["x", "y", "w", "h", ...TRACK_PROPS];

function validateVector(ctx: Ctx, doc: Obj): void {
  validateBase(ctx, doc, ["nodes", "timeline"]);
  let nodeIds: string[] = [];
  if (ctx.array(doc.nodes, "nodes", { minLength: 1 })) {
    nodeIds = ids(ctx, doc.nodes, "nodes");
    doc.nodes.forEach((n, i) => validateTimelineNode(ctx, n, `nodes[${i}]`));
    doc.nodes.forEach((n, i) => {
      if (isObj(n) && n.parent !== undefined) ctx.ref(n.parent, `nodes[${i}].parent`, nodeIds, "node");
    });
  }
  if (ctx.array(doc.timeline, "timeline")) {
    doc.timeline.forEach((item, i) => {
      const path = `timeline[${i}]`;
      if (!ctx.object(item, path)) return;
      if ("wait" in item) {
        ctx.keys(item, path, ["wait", "caption", "label"]);
        ctx.number(item.wait, `${path}.wait`, { min: 0 });
        return;
      }
      ctx.keys(item, path, ["target", "to", "duration", "easing", "at", "caption", "label"]);
      if (item.target === undefined) ctx.error(`${path}.target`, `a tween needs "target" (node id or list of ids), or use {"wait": ms}`);
      else idOrIds(ctx, item.target, `${path}.target`, nodeIds, "node");
      if (ctx.object(item.to, `${path}.to`)) {
        ctx.keys(item.to, `${path}.to`, TWEEN_TO_KEYS);
        for (const [k, v] of Object.entries(item.to)) {
          if (!TWEEN_TO_KEYS.includes(k)) continue;
          if (k === "x" || k === "y" || k === "w" || k === "h") ctx.number(v, `${path}.to.${k}`);
          else trackValue(ctx, k, v, `${path}.to.${k}`);
        }
        if (Object.keys(item.to).length === 0) ctx.error(`${path}.to`, `"to" is empty; name at least one property to animate`, `e.g. {"x": 200} or {"opacity": 0}`);
      }
      if (item.duration !== undefined) ctx.number(item.duration, `${path}.duration`, { min: 0 });
      easing(ctx, item.easing, `${path}.easing`);
      if (item.at !== undefined && !isNum(item.at) && !(isStr(item.at) && /^(<|[+-]\d+(\.\d+)?)$/.test(item.at))) {
        ctx.error(`${path}.at`, `at takes a number (ms), "<" (with previous), or "+N"/"-N" (offset from previous end); got ${describe(item.at)}`);
      }
    });
  }
}

export function validateScene(doc: unknown): Diagnostic[] {
  const ctx = new Ctx();
  if (!ctx.object(doc, "")) return ctx.diags;
  if (doc.format !== SCENE_FORMAT) {
    if (doc.format === TIMELINE_FORMAT) {
      ctx.error("format", `this is a timeline document, not a scene`, `validate it with the timeline validator, or set "format": "${SCENE_FORMAT}" and a "kind"`);
      return ctx.diags;
    }
    ctx.error("format", `expected "${SCENE_FORMAT}", got ${describe(doc.format)}`, `set "format": "${SCENE_FORMAT}"`);
  }
  if (!ctx.enumOf(doc.kind, "kind", SCENE_KINDS, "kind")) return ctx.diags;
  switch (doc.kind as Scene["kind"]) {
    case "diagram": validateDiagram(ctx, doc); break;
    case "state-machine": validateStateMachine(ctx, doc); break;
    case "sort": validateSort(ctx, doc); break;
    case "heap": validateHeap(ctx, doc); break;
    case "distributed": validateDistributed(ctx, doc); break;
    case "vector": validateVector(ctx, doc); break;
  }
  return ctx.diags;
}

/** Route a document to the validator for its `format`. */
export function validateDocument(doc: unknown): { layer: "scene" | "timeline" | "unknown"; diagnostics: Diagnostic[] } {
  if (isObj(doc) && doc.format === TIMELINE_FORMAT) return { layer: "timeline", diagnostics: validateTimeline(doc) };
  if (isObj(doc) && doc.format === SCENE_FORMAT) return { layer: "scene", diagnostics: validateScene(doc) };
  return {
    layer: "unknown",
    diagnostics: [
      {
        severity: "error",
        path: "format",
        message: `expected "${SCENE_FORMAT}" or "${TIMELINE_FORMAT}", got ${isObj(doc) ? describe(doc.format) : describe(doc)}`,
        hint: `a scene starts {"format": "${SCENE_FORMAT}", "kind": "sort" | "state-machine" | …}`,
      },
    ],
  };
}

export const hasErrors = (diags: Diagnostic[]): boolean => diags.some((d) => d.severity === "error");

export function formatDiagnostics(diags: Diagnostic[]): string {
  return diags
    .map((d) => `${d.severity === "error" ? "✗" : "⚠"} ${d.path || "(root)"}: ${d.message}${d.hint ? `\n    → ${d.hint}` : ""}`)
    .join("\n");
}

export type { Timeline, Scene };
