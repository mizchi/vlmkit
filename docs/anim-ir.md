# vlmkit anim — writing an explanatory animation

One JSON file describes *what is being explained*; `vlmkit anim` turns it into
motion, checks that the motion says what the file claims, and embeds it as a
`<vlm-anim>` web component (SVG + Web Animations, no dependencies).

This page is the complete writing guide. Every JSON block on it passes
`vlmkit anim check` (a test enforces that).

## The loop

```
1. write scene.json                         (one "kind", see below)
2. vlmkit anim check scene.json             validate → compile → semantic checks → stats
   read each ✗ line: path, what is wrong, and the → hint with the fix; edit; re-run
3. vlmkit anim explain scene.json           the narration as a numbered list — is this the story you meant?
4. vlmkit anim render scene.json --step 4   one frame as SVG (or --at <ms>); --out frame.svg
   vlmkit anim frames scene.json --out dir [--png]   every step as a file, for looking at
5. vlmkit anim html scene.json --out page.html       the playable page
```

`check` exits 1 on any error. Warnings (⚠) are advice: off-canvas nodes,
steps without captions, a hidden node that is never shown.

## Two layers

- **Scene** (`"format": "vlmkit-anim/scene@1"`, one `kind`): intent. Short, and
  readable when someone edits it later — `"algorithm": "bubble"` or
  `"trace": ["connect", "SYN+ACK"]`, never coordinates.
- **Timeline** (`"format": "vlmkit-anim/timeline@1"`): nodes + absolute-time
  keyframe tracks + step markers. Every kind compiles to it (`vlmkit anim compile`).
  Write it directly only when no kind fits and `kind: vector` is not enough.

Common to every scene: `format`, `kind`, optional `title` (drawn at the top),
`stepMs` (milliseconds per beat; kinds default to 500–700), `canvas`
(`{width, height, background}`; kinds pick a size that fits), `theme` (colours:
`node nodeStroke text accent muted ok bad background`, and `fontSize`).

**Captions are the explanation.** The runtime shows the current step's caption
under the picture; `explain` prints them. Every kind generates sensible default
captions; write your own where the default would not say why.

## kind: sort

```json
{
  "format": "vlmkit-anim/scene@1",
  "kind": "sort",
  "title": "Bubble sort",
  "algorithm": "bubble",
  "values": [5, 3, 8, 1, 9, 2]
}
```

| field | |
|---|---|
| `values` | required, 2+ numbers |
| `algorithm` | `bubble` \| `insertion` \| `selection` — runs the algorithm and generates the ops |
| `ops` | explicit alternative: `{"compare":[i,j]}` `{"swap":[i,j]}` `{"done": i \| [i,…]}` `{"set":{"index":i,"value":v}}` `{"note":"…"}`; indices are 0-based **positions**; each may carry `caption` |
| `captions` | `false` to drop the generated captions |

Bars swap places; the check fails unless the final left-to-right order is sorted.

## kind: state-machine

```json
{
  "format": "vlmkit-anim/scene@1",
  "kind": "state-machine",
  "title": "Door",
  "states": ["closed", "open", { "id": "locked", "final": true }],
  "initial": "closed",
  "transitions": [
    { "from": "closed", "to": "open", "on": "push" },
    { "from": "open", "to": "closed", "on": "pull" },
    { "from": "closed", "to": "locked", "on": "lock", "note": "/ beep" }
  ],
  "trace": ["push", "pull", "lock"]
}
```

| field | |
|---|---|
| `states` | required: `"id"` or `{"id", "label", "final": true}` (final = double ring) |
| `initial` | required |
| `transitions` | required: `{"from", "to", "on": "event", "note": "/ action"}`; one per (from, on) |
| `trace` | required: events fired in order; each must be legal from the current state — the validator lists the legal ones when it is not |
| `layout` | `lr` (default) \| `tb` \| `circle` |

Each event is a step captioned `on <event>: a → b`; a token slides along the arrow.

## kind: heap

```json
{
  "format": "vlmkit-anim/scene@1",
  "kind": "heap",
  "title": "Min-heap",
  "type": "min",
  "ops": [{ "push": 5 }, { "push": 3 }, { "push": 8 }, { "push": 1 }, { "pop": true }]
}
```

| field | |
|---|---|
| `type` | `min` (default) \| `max` |
| `initial` | numbers already in the tree — must ALREADY satisfy the heap property (placed without sifting) |
| `ops` | required, 1+: `{"push": n}` `{"pop": true}` `{"note": "…"}`; each may carry `caption` |

Every comparison and swap is a captioned step (`3 < parent 5: swap up`). The
check verifies the final tree is a heap and that pops come out in order.

## kind: distributed

```json
{
  "format": "vlmkit-anim/scene@1",
  "kind": "distributed",
  "title": "Write with replication",
  "nodes": ["client", { "id": "primary", "status": "leader" }, "replica"],
  "messages": [
    { "from": "client", "to": "primary", "label": "write x=1" },
    { "from": "primary", "to": "replica", "label": "replicate" },
    { "from": "replica", "to": "primary", "label": "ack" },
    { "from": "primary", "to": "client", "label": "ok" }
  ],
  "events": [{ "at": 2400, "node": "replica", "status": "down", "caption": "replica crashes" }]
}
```

| field | |
|---|---|
| `nodes` | required: `"id"` or `{"id", "label", "status": up \| down \| leader \| busy}` |
| `messages` | required: `{"from", "to", "label", "at": ms, "latency": ms, "lost": true, "caption"}`; `at` defaults to right after the previous message lands, `latency` to `stepMs` |
| `events` | `{"at": ms, "node", "status", "caption"}` — recolours the node from that moment |

Sequence-diagram picture: node boxes across the top, lifelines down, time runs
down the canvas, each message a dot travelling with its arrow drawing in
behind. A message into a node that is down when it lands should be
`"lost": true` (the check warns otherwise).

## kind: diagram

```json
{
  "format": "vlmkit-anim/scene@1",
  "kind": "diagram",
  "title": "Request path",
  "nodes": [
    { "id": "browser", "label": "Browser" },
    { "id": "api", "label": "API" },
    { "id": "db", "label": "Database", "hidden": true }
  ],
  "edges": [
    { "from": "browser", "to": "api", "label": "GET /items" },
    { "from": "api", "to": "db", "hidden": true }
  ],
  "sequence": [
    { "flow": "browser->api", "caption": "The browser calls the API" },
    { "show": "db", "caption": "The API needs the database" },
    { "flow": "api->db" },
    { "flow": "db->api", "caption": "Rows come back" },
    { "highlight": "browser", "caption": "…and the page renders" }
  ]
}
```

| field | |
|---|---|
| `nodes` | required: `{"id", "label", "shape": rect \| circle \| ellipse, "pos": [x, y], "fill", "hidden": true}` |
| `edges` | `{"from", "to", "label", "style": arrow \| line, "hidden": true}` |
| `layout` | `lr` (default) \| `tb` \| `grid` \| `circle`; nodes with `pos` are pinned |
| `sequence` | one action per step + optional `caption`, `ms`: `{"show": id \| [ids]}` `{"hide": …}` `{"highlight": …}` `{"unhighlight": …}` `{"flow": "a->b"}` (token travels along an existing edge, either direction) `{"note": "…"}` (captioned pause) `{"relabel": {"id", "text"}}` |

Hidden nodes and edges stay invisible until a `show`; an edge follows its nodes' visibility.

## kind: vector

For anything the semantic kinds do not cover: shapes plus a list of tweens.

```json
{
  "format": "vlmkit-anim/scene@1",
  "kind": "vector",
  "title": "Two balls",
  "canvas": { "width": 400, "height": 200 },
  "nodes": [
    { "id": "a", "shape": "circle", "pos": [40, 60], "r": 16, "fill": "#f59e0b" },
    { "id": "b", "shape": "rect", "pos": [40, 140], "size": [40, 30], "fill": "#3b82f6" }
  ],
  "timeline": [
    { "target": "a", "to": { "x": 360 }, "duration": 800, "easing": "ease-out", "caption": "a slides right" },
    { "target": "b", "to": { "x": 360, "rotate": 90 }, "duration": 800, "at": "<" },
    { "wait": 200 },
    { "target": ["a", "b"], "to": { "opacity": 0.2 }, "duration": 400, "caption": "both fade" }
  ]
}
```

| tween field | |
|---|---|
| `target` | node id or list of ids |
| `to` | properties reached by the end: `x`, `y` (or `pos: [x, y]`), `w`, `h` (or `size`), `r`, `opacity`, `fill`, `stroke`, `color`, `scale`, `rotate`, `dash` (0..1 stroke draw progress), `text` |
| `duration` | ms, default 500 |
| `easing` | `linear` `ease` `ease-in` `ease-out` `ease-in-out` `step-end` `step-start` `cubic-bezier(a,b,c,d)` |
| `at` | omitted = after the previous item; `"<"` = together with the previous; `"+200"` / `"-100"` = offset from its end; a number = absolute ms |
| `caption`, `label` | make this tween a step |
| `{"wait": ms, "caption"}` | a pause instead of a tween |

Nodes (also the Timeline's node model):

| field | |
|---|---|
| `id`, `shape` | required; shape: `rect` `circle` `ellipse` `text` `line` `arrow` `path` `group` |
| `pos` | `[x, y]`, the shape's centre (default `[0, 0]`) |
| `size` `[w, h]` | rect / ellipse (required) |
| `r` | circle (required) |
| `points` `[[x1,y1],[x2,y2]]` | line / arrow (required), local to `pos` |
| `d` | path (required) |
| `text` | required for `text`; on any other shape draws a centred label |
| `fill` `stroke` `strokeWidth` `color` `opacity` `rx` `fontSize` `anchor` `dash` `scale` `rotate` | as in SVG; `color` is the text colour |
| `parent` | id of a `group` node; children move with it |

## Timeline (the compiled layer)

```json
{
  "format": "vlmkit-anim/timeline@1",
  "canvas": { "width": 300, "height": 120 },
  "nodes": [{ "id": "dot", "shape": "circle", "pos": [30, 60], "r": 12, "fill": "#f59e0b" }],
  "tracks": [
    { "target": "dot", "prop": "pos", "keyframes": [{ "t": 0, "value": [30, 60] }, { "t": 800, "value": [270, 60], "easing": "ease-in-out" }] }
  ],
  "steps": [{ "t": 0, "caption": "the dot crosses" }]
}
```

- `tracks[].prop`: `pos` `size` `r` `opacity` `fill` `stroke` `color` `scale` `rotate` `dash` `text` (discrete).
- `keyframes[].easing` is the curve **into** that keyframe. Times ascend; the first and last values hold outside the span.
- `steps`: chapter markers with `label` / `caption`; the runtime's ◀ ▶| buttons walk them.
- `duration`: optional, computed from the last keyframe or step.

## Embedding

`vlmkit anim html scene.json --out page.html` writes a page with the runtime inline. For a site with many animations:

```html
<script src="vlm-anim.js"></script>                <!-- vlmkit anim runtime --out vlm-anim.js -->
<vlm-anim src="sort.timeline.json" autoplay loop></vlm-anim>
<vlm-anim><script type="application/json">{ "format": "vlmkit-anim/timeline@1", … }</script></vlm-anim>
```

Attributes: `src`, `autoplay`, `loop`, `speed="1.5"`, `nocontrols`. Properties:
`ir` (set a timeline object directly), `time`, `duration`, `playing`,
`stepIndex`. Methods: `play()`, `pause()`, `seek(ms)`, `next()`, `prev()`.
Events: `step` (`detail: {index, step, time}`), `ended`. Under
`prefers-reduced-motion: reduce` it does not autoplay and shows the final
frame; the step buttons still walk the chapters.

Because the motion is ordinary Web Animations on ordinary SVG, `vlmkit check
animation page.html` evaluates it like any other page (visible effect, settle
time, reduced-motion honoured).
