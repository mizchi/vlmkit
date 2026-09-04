/**
 * The writing guide, one screen per kind: what fields exist, what each
 * accepts, and a minimal example that compiles clean. Printed by
 * `vlmkit anim schema --kind <kind>` and mirrored in `docs/anim-ir.md`.
 *
 * `EXAMPLES` are the source of truth the tests compile; the prose is written
 * to be the ONLY thing a writer needs to read before producing a scene.
 */

import {
  SCENE_FORMAT,
  SCENE_KINDS,
  TIMELINE_FORMAT,
  type DiagramScene,
  type DistributedScene,
  type HeapScene,
  type Scene,
  type SortScene,
  type StateMachineScene,
  type Timeline,
  type VectorScene,
} from "./types.ts";

export interface Examples {
  sort: SortScene;
  "state-machine": StateMachineScene;
  heap: HeapScene;
  distributed: DistributedScene;
  diagram: DiagramScene;
  vector: VectorScene;
  timeline: Timeline;
}

export const EXAMPLES: Examples = {
  sort: {
    format: SCENE_FORMAT,
    kind: "sort",
    title: "Bubble sort",
    algorithm: "bubble",
    values: [5, 3, 8, 1],
  },
  "state-machine": {
    format: SCENE_FORMAT,
    kind: "state-machine",
    title: "Door",
    states: ["closed", "open", { id: "locked", final: true }],
    initial: "closed",
    transitions: [
      { from: "closed", to: "open", on: "push" },
      { from: "open", to: "closed", on: "pull" },
      { from: "closed", to: "locked", on: "lock", note: "/ beep" },
    ],
    trace: ["push", "pull", { note: "Locking is the other way out of closed" }, "lock"],
  },
  heap: {
    format: SCENE_FORMAT,
    kind: "heap",
    title: "Min-heap",
    type: "min",
    ops: [{ push: 5 }, { push: 3 }, { push: 8 }, { pop: true }],
  },
  distributed: {
    format: SCENE_FORMAT,
    kind: "distributed",
    title: "Write with replication",
    nodes: ["client", { id: "primary", status: "leader" }, "replica"],
    messages: [
      { from: "client", to: "primary", label: "write x=1" },
      { from: "primary", to: "replica", label: "replicate" },
      { from: "replica", to: "primary", label: "ack" },
      { from: "primary", to: "client", label: "ok" },
    ],
    events: [{ after: "ok", node: "replica", status: "down", caption: "replica crashes" }],
  },
  diagram: {
    format: SCENE_FORMAT,
    kind: "diagram",
    title: "Request path",
    nodes: [{ id: "browser", label: "Browser" }, { id: "api", label: "API" }, { id: "db", label: "Database", hidden: true }],
    edges: [{ from: "browser", to: "api", label: "GET /items" }, { from: "api", to: "db", hidden: true }],
    sequence: [
      { flow: "browser->api", caption: "The browser calls the API" },
      { show: "db", caption: "The API needs the database" },
      { flow: "api->db" },
      { flow: "db->api", caption: "Rows come back" },
      { highlight: "browser", caption: "…and the page renders" },
    ],
  },
  vector: {
    format: SCENE_FORMAT,
    kind: "vector",
    title: "Two balls",
    canvas: { width: 400, height: 200 },
    nodes: [
      { id: "a", shape: "circle", pos: [40, 60], r: 16, fill: "#f59e0b" },
      { id: "b", shape: "rect", pos: [40, 140], size: [40, 30], fill: "#3b82f6" },
    ],
    timeline: [
      { target: "a", to: { x: 360 }, duration: 800, easing: "ease-out", caption: "a slides right" },
      { target: "b", to: { x: 360, rotate: 90 }, duration: 800, at: "<" },
      { wait: 200 },
      { target: ["a", "b"], to: { opacity: 0.2 }, duration: 400, caption: "both fade" },
    ],
  },
  timeline: {
    format: TIMELINE_FORMAT,
    canvas: { width: 300, height: 120 },
    nodes: [{ id: "dot", shape: "circle", pos: [30, 60], r: 12, fill: "#f59e0b" }],
    tracks: [{ target: "dot", prop: "pos", keyframes: [{ t: 0, value: [30, 60] }, { t: 800, value: [270, 60], easing: "ease-in-out" }] }],
    steps: [{ t: 0, caption: "the dot crosses" }],
  },
};

const COMMON = `Common to every scene
  "format": "${SCENE_FORMAT}"      required, exactly this string
  "kind": one of ${SCENE_KINDS.join(" | ")}
  "title": string                  optional; drawn at the top and used as the first caption
  "stepMs": number                 optional; milliseconds per beat (kinds default 500–700)
  "canvas": {"width", "height", "background"}   optional; kinds choose a size that fits
  "theme": {"node","nodeStroke","text","accent","muted","ok","bad","background","fontSize"}  optional colours

Captions are the explanation. Every beat that matters should carry one; the
runtime shows the current caption under the picture and \`vlmkit anim explain\`
prints them as a numbered list. Write them for the reader, not the machine.
A "caption" on an op replaces the generated one; {"note": "…"} is a captioned
pause and counts as a step; compilers add a first (title / "Start") and a last
("Sorted" / "End") step of their own.`;

const SHEETS: Record<Scene["kind"] | "timeline", string> = {
  sort: `kind: sort — bars that swap into order
  "values": number[]               required, 2+ numbers
  "algorithm": "bubble" | "insertion" | "selection"
                                   generates the ops by running the algorithm; use this unless you need a custom walk
  "ops": [ {"compare": [i, j]} | {"swap": [i, j]} | {"done": i | [i, ...]} | {"set": {"index": i, "value": v}} | {"note": "…"} ]
                                   explicit alternative; indices are 0-based positions (not values); every op may carry "caption" and "ms"
                                   compare only highlights; swap moves; done turns a bar green (the sorted run)
  "captions": false                turn off the generated captions
The check fails unless the final left-to-right order is sorted. Give "algorithm" OR "ops".`,
  "state-machine": `kind: state-machine — circles, labelled arrows, a token walking a trace
  "states": [ "id" | {"id", "label", "final": true, "pos": [x, y]} ]   required; final = double ring; pos pins a state
  "initial": "id"                  required
  "transitions": [ {"from", "to", "on": "event", "note": "/ action"} ]   required; one transition per (from, on)
  "trace": [ "event" | {"on": "event", "caption"} | {"note": "…"} | {"goto": "state", "caption"} ]
                                   required; events fire in order and must be legal from the current state;
                                   note = captioned pause; goto = jump the token to show a second path after the first
  "layout": "lr" | "tb" | "circle" default lr
Each fired event is one step captioned "on <event>: a → b". The validator names the legal events when a trace step is not.`,
  heap: `kind: heap — a binary tree of slots; values sift up and down
  "type": "min" | "max"            default min
  "initial": number[]              optional; must ALREADY be a valid heap (placed without sifting)
  "ops": [ {"push": n} | {"pop": true} | {"note": "…"} ]   required, 1+; each may carry "caption"
Every comparison and swap becomes a captioned step ("3 < parent 5: swap up"). The check verifies the final tree is a heap.`,
  distributed: `kind: distributed — nodes across the top, lifelines down, messages as travelling dots
  "nodes": [ "id" | {"id", "label", "status": "up" | "down" | "leader" | "busy"} ]   required
  "messages": [ {"from", "to", "label", "at": ms, "after": "label", "delay": ms, "latency": ms, "lost": true, "caption"} ]   required
                                   "at" defaults to right after the previous message lands; "latency" defaults to stepMs;
                                   "after" starts it when the earlier message with that label lands (+ "delay")
  "events": [ {"after": "label" | "at": ms, "delay": ms, "node", "status", "caption"} ]   status changes; prefer "after" — an absolute
                                   "at" stays put when message timing shifts (the check warns when it lands mid-flight)
Time runs down the canvas, so order is visible. A message to a node that is down at arrival should be "lost": true (the check warns).`,
  diagram: `kind: diagram — boxes and arrows, narrated in beats
  "nodes": [ {"id", "label", "shape": "rect" | "circle" | "ellipse", "pos": [x, y], "fill", "hidden": true} ]   required
  "edges": [ {"from", "to", "label", "style": "arrow" | "line", "hidden": true} ]
  "layout": "lr" | "tb" | "grid" | "circle"   default lr; nodes with "pos" are pinned
  "sequence": [ one action per step, plus optional "caption" and "ms" ]
      {"show": id | [ids]}  {"hide": …}  {"highlight": …}  {"unhighlight": …}
      {"flow": "a->b"}      a token travels along an existing edge (either direction)
      {"note": "…"}         a captioned pause
      {"relabel": {"id", "text"}}
Hidden nodes stay invisible until a "show" step. A "flow" needs an edge between the two nodes.`,
  vector: `kind: vector — generic shapes with a list of tweens (when nothing semantic fits)
  "nodes": [ timeline nodes, see below ]   required
  "timeline": [ tween | {"wait": ms, "caption"} ]   required
      tween: {"target": id | [ids], "to": {…}, "duration": ms, "easing", "at", "caption", "label"}
      "to" keys: x, y (or pos: [x, y]), w, h (or size), r, opacity, fill, stroke, color, scale, rotate, dash, text
      "at": omitted = after the previous item; "<" = together with the previous; "+200" / "-100" = offset from its end; a number = absolute ms
Nodes: {"id", "shape": rect | circle | ellipse | text | line | arrow | path | group, "pos": [x, y], "size": [w, h], "r", "points": [[x1,y1],[x2,y2]], "d", "text", "fontSize", "fill", "stroke", "strokeWidth", "opacity", "dash", "rotate", "scale", "parent"}
  rect/ellipse need "size"; circle needs "r"; text needs "text"; line/arrow need "points"; path needs "d". Shapes are centred on "pos". Any shape with "text" draws it centred as a label.`,
  timeline: `format: ${TIMELINE_FORMAT} — the compiled layer; write it directly only when a tween list is not enough
  "canvas": {"width", "height", "background"}   required
  "nodes": [ … same node fields as kind: vector … ]   required, drawn in order
  "tracks": [ {"target": id, "prop", "keyframes": [ {"t": ms, "value", "easing"} ]} ]   required
      prop: pos [x,y] | size [w,h] | r | opacity | fill | stroke | color | scale | rotate | dash (0..1 draw progress) | text (discrete)
      "easing" is INTO the keyframe: linear | ease | ease-in | ease-out | ease-in-out | step-end | step-start | cubic-bezier(a,b,c,d)
      keyframe times ascend; the first/last value holds outside the span
  "steps": [ {"t": ms, "label", "caption"} ]   chapter markers; the runtime steps between them and shows the caption
  "duration": ms                   optional; computed from the last keyframe/step`,
};

export function schemaSheet(kind: Scene["kind"] | "timeline"): string {
  const example = JSON.stringify(EXAMPLES[kind], null, 2);
  return `${SHEETS[kind]}\n\n${kind === "timeline" ? "" : COMMON + "\n\n"}Example\n${example}\n\nThen: vlmkit anim check scene.json`;
}

export function schemaIndex(): string {
  return `vlmkit anim — declarative explanatory animations, two layers

  Scene (what is explained)      ${SCENE_FORMAT}, one "kind":
    sort           an array being sorted (algorithm-generated or explicit ops)
    state-machine  states, transitions, and an event trace
    heap           push / pop on a binary heap
    distributed    nodes exchanging messages over time, with status events
    diagram        boxes and arrows walked through in narrated beats
    vector         generic shapes and a list of tweens
  Timeline (how it moves)         ${TIMELINE_FORMAT}: nodes + keyframe tracks + steps.
                                  Every kind compiles to it; it can also be written directly.

  vlmkit anim schema --kind <kind>    field list + minimal example for one kind
  vlmkit anim check <scene.json>      validate → compile → semantic checks → stats

${COMMON}`;
}
