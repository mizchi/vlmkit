/**
 * The writing guide, one screen per kind: what fields exist, what each
 * accepts, and a minimal example that compiles clean. Printed by
 * `vlmkit-anim schema --kind <kind>` and mirrored in `docs/anim-ir.md`.
 *
 * `EXAMPLES` are the source of truth the tests compile; the prose is written
 * to be the ONLY thing a writer needs to read before producing a scene.
 */

import {
  SCENE_FORMAT,
  SCENE_KINDS,
  TIMELINE_FORMAT,
  type ChartScene,
  type DiagramScene,
  type DistributedScene,
  type GraphScene,
  type HeapScene,
  type MatrixScene,
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
  matrix: MatrixScene;
  graph: GraphScene;
  chart: ChartScene;
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
  matrix: {
    format: SCENE_FORMAT,
    kind: "matrix",
    title: "Edit distance: cat → cut",
    rowLabels: ["", "c", "a", "t"],
    colLabels: ["", "c", "u", "t"],
    cells: [
      [0, 1, 2, 3],
      [1, null, null, null],
      [2, null, null, null],
      [3, null, null, null],
    ],
    ops: [
      { set: { cell: [1, 1], value: 0, from: [[0, 0]] }, caption: "c = c: copy the diagonal" },
      { set: { cell: [1, 2], value: 1, from: [[1, 1]] }, caption: "c ≠ u: 1 + the smallest neighbour" },
      { set: { cell: [1, 3], value: 2, from: [[1, 2]] } },
      { set: { cell: [2, 1], value: 1, from: [[1, 1]] } },
      { set: { cell: [2, 2], value: 1, from: [[1, 1], [1, 2], [2, 1]] }, caption: "a ≠ u: 1 + min(diagonal, above, left) = 1 + 0" },
      { set: { cell: [2, 3], value: 2, from: [[2, 2]] } },
      { set: { cell: [3, 1], value: 2, from: [[2, 1]] } },
      { set: { cell: [3, 2], value: 2, from: [[2, 2]] } },
      { set: { cell: [3, 3], value: 1, from: [[2, 2]] }, caption: "t = t: copy the diagonal" },
      { mark: { cell: [3, 3] }, caption: "Edit distance is 1" },
    ],
  },
  graph: {
    format: SCENE_FORMAT,
    kind: "graph",
    title: "Shortest path A → E",
    nodes: ["A", "B", "C", "D", "E"],
    edges: [
      { from: "A", to: "B", weight: 4 },
      { from: "A", to: "C", weight: 1 },
      { from: "C", to: "B", weight: 2 },
      { from: "B", to: "D", weight: 1 },
      { from: "C", to: "D", weight: 5 },
      { from: "D", to: "E", weight: 3 },
    ],
    algorithm: "dijkstra",
    start: "A",
    goal: "E",
  },
  chart: {
    format: SCENE_FORMAT,
    kind: "chart",
    title: "p95 latency by region (ms)",
    categories: ["us", "eu", "ap"],
    series: [
      { id: "before", label: "before cache", values: [120, 180, 260] },
      { id: "after", label: "after cache", values: [40, 60, 90] },
    ],
    sequence: [
      { reveal: "before", caption: "Before: every request hits the database" },
      { threshold: { value: 100, label: "SLO" }, caption: "The SLO is 100 ms; two regions miss it" },
      { reveal: "after", caption: "After: a regional cache absorbs most reads" },
      { highlight: { category: "ap" }, caption: "ap improves most — it was furthest from the database" },
    ],
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
runtime shows the current caption under the picture and \`vlmkit-anim explain\`
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
  "messages": [ {"from", "to", "label", "at": ms | "<", "after": "label", "delay": ms, "latency": ms, "lost": true, "caption"} ]   required
                                   "at" defaults to right after the previous message lands; "<" = together with the previous
                                   message (a broadcast); "latency" defaults to stepMs; "after" starts it when the earlier
                                   message with that label lands (+ "delay"); that label must be unique (a broadcast to two
                                   nodes needs two labels).
  "timing": "causal" | "sequential"   default causal: an unanchored message starts when its SENDER is free (its last received
                                   message and its own previous message have landed) — a reply waits for what it replies to,
                                   a side branch from another node never delays it, idle senders send at 0; a node that should
                                   wait says {"after": "label", "delay": ms}. sequential: it starts when the previous message
                                   in the list lands, so inserting one delays all later ones
  "events": [ {"after": "label" | "at": ms, "delay": ms, "node", "status", "caption"} ]   status changes; prefer "after" — an absolute
                                   "at" stays put when message timing shifts (the check warns when it lands mid-flight)
Time runs down the canvas, so order is visible. A message to a node that is down at arrival should be "lost": true (the check warns).`,
  matrix: `kind: matrix — a grid of cells (a DP table, a matrix, a table of rows); rows and columns can swap
  "cells": [[…], …]                required; rows of number | string | null (null = empty, to be filled); one row = a plain array
  "rowLabels", "colLabels": string[]   optional headers, one per row / column
  "ops": [ {"set": {"cell": [r, c], "value": v, "from": [[r, c], …]}}   write a value; "from" names the cells it came from
                                                                          (they flash and a token flies from each into the target)
           {"highlight": T} {"unhighlight": T | "all"} {"mark": T}      T = {"cell": [r, c]} | {"cells": [[r, c], …]} | {"row": r} | {"col": c}
                                                                          highlight = accent until unhighlighted; mark = permanent done colour
           {"swap": {"rows": [i, j]} | {"cols": [i, j]}}                 rows / columns trade places, labels move with them
           {"note": "…"} ]                                                each may carry "caption" and "ms"
Cell references are [row, col], 0-based. The check reads the final grid back by position and compares it with the ops' result.`,
  graph: `kind: graph — nodes and edges walked by a traversal; nodes never move
  "nodes": [ "id" | {"id", "label", "pos": [x, y]} ]   required; pos pins a node
  "edges": [ {"from", "to", "weight", "label"} | ["a", "b"] ]   required; weight (or label) is drawn on the edge
  "directed": true                 arrows; explore must follow the arrow. Default false (lines, either direction)
  "layout": "circle" | "lr" | "tb" | "grid"   default circle
  "algorithm": "bfs" | "dfs" | "dijkstra", "start": "id", "goal": "id"
                                   generates the ops by running the algorithm from start (goal: dijkstra also paints the path)
  "ops": [ {"visit": "id"} {"explore": "a->b" | ["a", "b"]} {"label": {"node": "id" | [ids], "text": "…"}}
           {"highlight": id | [ids]} {"unhighlight": …} {"path": ["a", "b", "c"]} {"note": "…"} ]
                                   explicit alternative; each may carry "caption" and "ms"
                                   visit = current (accent, larger) then visited (green); explore = a token travels the edge;
                                   label = text under the node (a distance, a depth); path = the answer, painted green
Give "algorithm" OR "ops". With an algorithm the check fails unless every node reachable from start was visited.`,
  chart: `kind: chart — a bar or line chart revealed in beats
  "type": "bar" | "line"           default bar
  "categories": string[]           required; the x axis
  "series": [ {"id", "label", "values": number[], "color"} ]   required, 1+; one value per category
  "yMax": number                   optional; default a round number 10% above the largest value
  "yLabel": string                 optional
  "sequence": [ {"reveal": id | [ids] | "all"}   bars grow in / the line draws in
                {"set": {"series", "index", "value"}}   a bar animates to a new value (bar charts only)
                {"highlight": {"series", "index" | "category"}} {"unhighlight": … | "all"}   dim everything else
                {"threshold": {"value", "label"}}   a horizontal reference line
                {"note": "…"} ]                       each may carry "caption" and "ms"
                                   default: reveal each series in order
The check fails if a bar's final height is not its value's share of the axis, and warns about a series never revealed.`,
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
  return `${SHEETS[kind]}\n\n${kind === "timeline" ? "" : COMMON + "\n\n"}Example\n${example}\n\nThen: vlmkit-anim check scene.json`;
}

export function schemaIndex(): string {
  return `vlmkit-anim — declarative explanatory animations, two layers

  Scene (what is explained)      ${SCENE_FORMAT}, one "kind":
    sort           an array being sorted (algorithm-generated or explicit ops)
    state-machine  states, transitions, and an event trace
    heap           push / pop on a binary heap
    distributed    nodes exchanging messages over time, with status events
    matrix         a grid of cells (DP table, matrix, table) filled, highlighted, rows / columns swapped
    graph          nodes and edges traversed (bfs / dfs / dijkstra, or explicit ops)
    chart          a bar or line chart revealed series by series
    diagram        boxes and arrows walked through in narrated beats
    vector         generic shapes and a list of tweens
  Timeline (how it moves)         ${TIMELINE_FORMAT}: nodes + keyframe tracks + steps.
                                  Every kind compiles to it; it can also be written directly.

  vlmkit-anim schema --kind <kind>    field list + minimal example for one kind
  vlmkit-anim check <scene.json>      validate → compile → semantic checks → stats

${COMMON}`;
}
