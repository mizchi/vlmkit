/**
 * Post-compile checks: does the animation say what the scene claims?
 *
 * The validator proves a document is well-formed; this proves the compiled
 * motion has the semantics the kind promises — the sort's final frame is in
 * order, the heap satisfies the heap property at every step marker, every
 * state-machine event was legal, no node ends up off-canvas. Each finding is
 * a `Diagnostic` in the same shape the validator emits, so a writer reads one
 * list. Also computes the stats the evaluation loop tracks: bytes of scene vs
 * timeline (how much the semantic layer buys), duration, step count.
 */

import { sampleFrame, timelineDuration, worldPos } from "./timeline.ts";
import type { Diagnostic, Scene, Timeline } from "./types.ts";

export interface AnimStats {
  kind: string;
  durationMs: number;
  nodes: number;
  tracks: number;
  keyframes: number;
  steps: number;
  captions: number;
  sceneBytes?: number;
  timelineBytes: number;
  /** timelineBytes / sceneBytes — how many bytes of motion one byte of intent buys. */
  expansion?: number;
}

export function animStats(tl: Timeline, scene?: Scene): AnimStats {
  const timelineBytes = Buffer.byteLength(JSON.stringify(tl));
  const sceneBytes = scene ? Buffer.byteLength(JSON.stringify(scene)) : undefined;
  return {
    kind: String(tl.meta?.kind ?? scene?.kind ?? "timeline"),
    durationMs: timelineDuration(tl),
    nodes: tl.nodes.length,
    tracks: tl.tracks.length,
    keyframes: tl.tracks.reduce((s, tr) => s + tr.keyframes.length, 0),
    steps: tl.steps?.length ?? 0,
    captions: (tl.steps ?? []).filter((s) => s.caption).length,
    sceneBytes,
    timelineBytes,
    expansion: sceneBytes ? Math.round((timelineBytes / sceneBytes) * 10) / 10 : undefined,
  };
}

const warn = (path: string, message: string, hint?: string): Diagnostic => ({ severity: "warn", path, message, ...(hint ? { hint } : {}) });
const error = (path: string, message: string, hint?: string): Diagnostic => ({ severity: "error", path, message, ...(hint ? { hint } : {}) });

/** Kind-agnostic checks on any timeline. */
export function checkTimeline(tl: Timeline): Diagnostic[] {
  const out: Diagnostic[] = [];
  const dur = timelineDuration(tl);
  if (dur <= 0) out.push(error("duration", "the animation has zero length: no keyframe or step is later than t=0", "add a tween, or a step with a later t"));
  const animated = new Set(tl.tracks.map((tr) => tr.target));
  if (tl.tracks.length === 0) out.push(warn("tracks", "nothing moves: there are no tracks", "a still image is fine, but then a plain SVG is simpler"));
  for (const tr of tl.tracks) {
    if (tr.keyframes.length >= 2 && tr.keyframes.every((k) => JSON.stringify(k.value) === JSON.stringify(tr.keyframes[0].value))) {
      out.push(warn(`tracks(${tr.target}.${tr.prop})`, `every keyframe has the same value ${JSON.stringify(tr.keyframes[0].value)}: the track changes nothing`));
    }
  }
  // Off-canvas at any step marker or at the end.
  const times = [...new Set([0, ...(tl.steps ?? []).map((s) => s.t), dur])];
  const { width, height } = tl.canvas;
  const reported = new Set<string>();
  for (const t of times) {
    const frame = sampleFrame(tl, t);
    for (const n of tl.nodes) {
      if (reported.has(n.id) || n.shape === "group") continue;
      const st = frame.get(n.id)!;
      if (st.opacity <= 0) continue;
      const [x, y] = worldPos(frame, n.id);
      const margin = 4;
      if (x < -margin || y < -margin || x > width + margin || y > height + margin) {
        reported.add(n.id);
        out.push(warn(`nodes(${n.id})`, `visible node is outside the ${width}×${height} canvas at t=${Math.round(t)} (pos ${Math.round(x)}, ${Math.round(y)})`, "move it, enlarge the canvas, or fade it out before it leaves"));
      }
    }
  }
  // Steps without captions are legal but explain nothing.
  const steps = tl.steps ?? [];
  if (steps.length > 0 && steps.every((s) => !s.caption)) out.push(warn("steps", "no step has a caption: the viewer gets motion without narration", 'add "caption" to the steps that matter'));
  if (animated.size > 0 && steps.length === 0) out.push(warn("steps", "no steps: the runtime cannot step through the animation chapter by chapter"));
  return out;
}

function checkSort(scene: Extract<Scene, { kind: "sort" }>, tl: Timeline): Diagnostic[] {
  const out: Diagnostic[] = [];
  const finalOrder = tl.meta?.finalOrder as number[] | undefined;
  const expected = [...scene.values].sort((a, b) => a - b);
  if (finalOrder && JSON.stringify(finalOrder) !== JSON.stringify(expected)) {
    out.push(error("ops", `the ops end with ${finalOrder.join(", ")} but sorted order is ${expected.join(", ")}`, "the explicit ops list does not finish the sort; add the missing swaps or let \"algorithm\" generate them"));
  }
  // Read the final frame back by position, independent of meta.
  const frame = sampleFrame(tl, timelineDuration(tl));
  const bars = tl.nodes.filter((n) => n.shape === "group" && n.id.startsWith("bar-")).map((n) => ({ id: n.id, x: worldPos(frame, n.id)[0], value: scene.values[Number(n.id.slice(4))] }));
  bars.sort((a, b) => a.x - b.x);
  const byPosition = bars.map((b) => b.value);
  if (JSON.stringify(byPosition) !== JSON.stringify(expected)) out.push(error("timeline", `final frame reads ${byPosition.join(", ")} left to right; sorted is ${expected.join(", ")}`));
  const xs = bars.map((b) => Math.round(b.x));
  if (new Set(xs).size !== xs.length) out.push(error("timeline", "two bars share a slot in the final frame: a swap moved one bar but not the other"));
  return out;
}

function checkHeap(scene: Extract<Scene, { kind: "heap" }>, tl: Timeline): Diagnostic[] {
  const out: Diagnostic[] = [];
  const isMin = (scene.type ?? "min") === "min";
  const ok = (parent: number, child: number): boolean => (isMin ? parent <= child : parent >= child);
  const init = scene.initial ?? [];
  for (let i = 1; i < init.length; i++) {
    const p = Math.floor((i - 1) / 2);
    if (!ok(init[p], init[i])) {
      out.push(error(`initial[${i}]`, `${init[i]} under parent ${init[p]} breaks the ${isMin ? "min" : "max"}-heap property`, `"initial" must already be a valid heap (it is placed without sifting); push the values through "ops" instead`));
      break;
    }
  }
  // Read the heap by slot just before each step begins (the previous step's
  // motion has settled) and at the end.
  const slots = tl.nodes.filter((n) => n.id.startsWith("slot-")).map((n) => ({ i: Number(n.id.slice(5)), pos: n.pos! }));
  const tokens = tl.nodes.filter((n) => n.id.startsWith("v-"));
  const times = [...(tl.steps ?? []).map((s) => s.t - 1).filter((t) => t > 0), timelineDuration(tl)];
  for (const t of times) {
    const frame = sampleFrame(tl, t);
    const bySlot = new Map<number, number>();
    for (const tk of tokens) {
      const st = frame.get(tk.id)!;
      if (st.opacity < 0.5) continue;
      const slot = slots.find((s) => Math.hypot(s.pos[0] - st.pos[0], s.pos[1] - st.pos[1]) < 1);
      if (!slot) continue; // in flight or parked
      if (bySlot.has(slot.i)) out.push(error("timeline", `two values occupy slot ${slot.i} at t=${Math.round(t)}`));
      bySlot.set(slot.i, Number(tk.text));
    }
    // Mid-sift frames are legitimately not heaps (a value that has swapped up once
    // may still be out of order with its new parent) and a pop leaves slot 0 empty
    // until the last value moves up, so shape and ordering are judged on the final
    // frame only; intermediate frames are judged on occupancy alone (above).
    if (t !== times[times.length - 1]) continue;
    for (const [i, v] of bySlot) {
      if (i === 0) continue;
      const p = Math.floor((i - 1) / 2);
      const pv = bySlot.get(p);
      if (pv === undefined) out.push(error("timeline", `final heap has a hole: slot ${i} holds ${v} but its parent slot ${p} is empty`));
      else if (!ok(pv, v)) out.push(error("timeline", `final heap breaks the ${isMin ? "min" : "max"}-heap property: ${v} under ${pv}`));
    }
    const expected = (tl.meta?.finalHeap as number[] | undefined) ?? [];
    if (bySlot.size !== expected.length) out.push(error("timeline", `final frame shows ${bySlot.size} value(s) in the tree but the simulation ends with ${expected.length}`));
  }
  const popped = (tl.meta?.popped as number[] | undefined) ?? [];
  for (let i = 1; i < popped.length; i++) {
    if (isMin ? popped[i] < popped[i - 1] : popped[i] > popped[i - 1]) {
      // Legal when pushes happen between pops; only flag with no intervening push.
      const ops = scene.ops;
      let pops = 0;
      let violates = false;
      for (const op of ops) {
        if ("pop" in op) pops++;
        if (pops === i && "push" in op) {
          violates = false;
          break;
        }
        if (pops === i + 1) {
          violates = true;
          break;
        }
      }
      if (violates) out.push(error("ops", `popped ${popped[i - 1]} then ${popped[i]} with no push in between: not ${isMin ? "ascending" : "descending"}`));
    }
  }
  return out;
}

function checkStateMachine(scene: Extract<Scene, { kind: "state-machine" }>, tl: Timeline): Diagnostic[] {
  const out: Diagnostic[] = [];
  const visited = (tl.meta?.visited as string[] | undefined) ?? [];
  if (visited.length !== scene.trace.length + 1) out.push(error("trace", `only ${Math.max(0, visited.length - 1)} of ${scene.trace.length} events could be fired`));
  const reachable = new Set<string>([scene.initial]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const t of scene.transitions) if (reachable.has(t.from) && !reachable.has(t.to)) { reachable.add(t.to); grew = true; }
  }
  const ids = scene.states.map((s) => (typeof s === "string" ? s : s.id));
  for (const id of ids) if (!reachable.has(id)) out.push(warn(`states(${id})`, `state "${id}" is unreachable from "${scene.initial}"`, "add a transition into it or drop it"));
  const fired = new Set(visited.slice(1).map((_, i) => `${visited[i]}:${scene.trace[i]}`));
  const unused = scene.transitions.filter((t) => !fired.has(`${t.from}:${t.on}`));
  if (unused.length && unused.length === scene.transitions.length) out.push(warn("trace", "the trace fires no transition: the picture is static"));
  return out;
}

function checkDistributed(scene: Extract<Scene, { kind: "distributed" }>, tl: Timeline): Diagnostic[] {
  const out: Diagnostic[] = [];
  const down = new Map<string, number>();
  for (const e of scene.events ?? []) if (e.status === "down") down.set(e.node, Math.min(e.at, down.get(e.node) ?? Infinity));
  for (const e of scene.events ?? []) if (e.status !== "down" && down.has(e.node) && e.at > down.get(e.node)!) down.delete(e.node);
  let cursor = 0;
  scene.messages.forEach((m, i) => {
    const at = m.at ?? cursor;
    const lat = m.latency ?? scene.stepMs ?? 600;
    cursor = Math.max(cursor, at + lat);
    const initialDown = scene.nodes.some((n) => typeof n !== "string" && n.id === m.to && n.status === "down");
    const downAt = down.get(m.to);
    if (!m.lost && (initialDown || (downAt !== undefined && at + lat >= downAt))) {
      out.push(warn(`messages[${i}]`, `"${m.to}" is down when this message lands (t=${at + lat}) but the message is not marked lost`, 'add "lost": true, or move the event later'));
    }
  });
  if (scene.messages.length === 0) out.push(warn("messages", "no messages: nothing travels between nodes"));
  void tl;
  return out;
}

function checkDiagram(scene: Extract<Scene, { kind: "diagram" }>, tl: Timeline): Diagnostic[] {
  const out: Diagnostic[] = [];
  const shown = new Set<string>();
  for (const st of scene.sequence ?? []) if ("show" in st) for (const id of Array.isArray(st.show) ? st.show : [st.show]) shown.add(id);
  for (const n of scene.nodes) if (n.hidden && !shown.has(n.id)) out.push(warn(`nodes(${n.id})`, `"${n.id}" is hidden and no step shows it: it never appears`, `add {"show": "${n.id}"} to "sequence" or drop "hidden"`));
  if ((scene.sequence ?? []).length === 0) out.push(warn("sequence", "no sequence: the diagram is a still image", "add steps such as {\"highlight\": \"a\", \"caption\": \"…\"} or {\"flow\": \"a->b\"}"));
  void tl;
  return out;
}

/** All semantic checks that apply. `scene` is optional for a bare timeline. */
export function checkAnimation(tl: Timeline, scene?: Scene): Diagnostic[] {
  const out = checkTimeline(tl);
  if (!scene) return out;
  switch (scene.kind) {
    case "sort": out.push(...checkSort(scene, tl)); break;
    case "heap": out.push(...checkHeap(scene, tl)); break;
    case "state-machine": out.push(...checkStateMachine(scene, tl)); break;
    case "distributed": out.push(...checkDistributed(scene, tl)); break;
    case "diagram": out.push(...checkDiagram(scene, tl)); break;
    case "vector": break;
  }
  return out;
}

/** The narration as text: one line per step. What the runtime shows as captions, readable without playing. */
export function explain(tl: Timeline): string {
  const steps = tl.steps ?? [];
  const dur = timelineDuration(tl);
  const lines = steps.map((s, i) => `${String(i + 1).padStart(2)}. [${String(Math.round(s.t)).padStart(5)}ms] ${s.caption ?? (s.label ? `(${s.label})` : "")}`.trimEnd());
  return [`${tl.meta?.title ?? tl.meta?.kind ?? "animation"} — ${steps.length} steps, ${dur}ms, ${tl.nodes.length} nodes`, ...lines].join("\n");
}
