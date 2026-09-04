# vlmkit-anim — writing an explanatory animation

One JSON file describes *what is being explained*; `vlmkit-anim` turns it into
motion, checks that the motion says what the file claims, and embeds it as a
`<vlm-anim>` web component (SVG + Web Animations, no dependencies).

This page is the complete writing guide. Every JSON block on it passes
`vlmkit-anim check` (a test enforces that).

## The loop

```
1. write scene.json                         (one "kind", see below)
2. vlmkit-anim check scene.json             validate → compile → semantic checks → stats
   read each ✗ line: path, what is wrong, and the → hint with the fix; edit; re-run
3. vlmkit-anim explain scene.json           the narration as a numbered list — is this the story you meant?
4. vlmkit-anim render scene.json --step 4   one frame as SVG (or --at <ms>); --out frame.svg
   vlmkit-anim frames scene.json --out dir [--png]   every step as a file, for looking at
   vlmkit-anim sheet scene.json --out sheet.png      every step on ONE labelled image — what to show a vision model
5. vlmkit-anim html scene.json --out page.html       the playable page
   vlmkit-anim video scene.json --out demo.gif       a file for a README / slide (or .mp4 / .webm through ffmpeg)
```

`check` exits 1 on any error. Warnings (⚠) are advice: off-canvas nodes,
steps without captions, a hidden node that is never shown.

## Two layers

- **Scene** (`"format": "vlmkit-anim/scene@1"`, one `kind`): intent. Short, and
  readable when someone edits it later — `"algorithm": "bubble"` or
  `"trace": ["connect", "SYN+ACK"]`, never coordinates.
- **Timeline** (`"format": "vlmkit-anim/timeline@1"`): nodes + absolute-time
  keyframe tracks + step markers. Every kind compiles to it (`vlmkit-anim compile`).
  Write it directly only when no kind fits and `kind: vector` is not enough.

Common to every scene: `format`, `kind`, optional `title` (drawn at the top),
`stepMs` (milliseconds per beat; kinds default to 500–700), `canvas`
(`{width, height, background}`; kinds pick a size that fits), `theme` (colours:
`node nodeStroke text accent muted ok bad background`, and `fontSize`).

**Captions are the explanation.** The runtime shows the current step's caption
under the picture; `explain` prints them. Every kind generates sensible default
captions; write your own where the default would not say why. Three
conventions hold in every kind:

- A `caption` on an op or sequence item **replaces** the generated caption for that beat.
- `{"note": "…"}` is a captioned pause: the string is the caption, and it is a step like any other.
- Compilers add a first step at t=0 (the title, or "Start: …") and a last one ("Sorted: …", "End in …"), so `explain` shows two more steps than you wrote.
- A *beat* is one step. Two beats that start at the same instant (two messages sent together, an event coinciding with a message) share one step and their captions are joined with " · ".

`vlmkit-anim check scene.json --max-ms 15000` fails when the animation runs longer than a budget.

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
| `ops` | explicit alternative: `{"compare":[i,j]}` `{"swap":[i,j]}` `{"done": i \| [i,…]}` `{"set":{"index":i,"value":v}}` `{"note":"…"}`; indices are 0-based **positions**; each may carry `caption` and `ms` (that beat's length) |
| `captions` | `false` to drop the generated captions |

Bars swap places; the check fails unless the final left-to-right order is
sorted. `compare` only highlights the two bars (nothing moves); `swap` moves
them; `done` turns a bar green for "in its final place" — use it to show the
sorted run growing.

## kind: array

A row of boxes with **named pointers** underneath and an optional **window**
bracket: binary search, two-pointer walks, sliding windows — anything where
the story is where the pointers are rather than what swaps (that is `sort`).

```json
{
  "format": "vlmkit-anim/scene@1",
  "kind": "array",
  "title": "Binary search for 23",
  "values": [2, 5, 8, 12, 16, 23, 38, 56, 72, 91],
  "algorithm": "binary-search",
  "target": 23
}
```

| field | |
|---|---|
| `values` | required, 1+ numbers or strings |
| `algorithm` | `binary-search` (needs `target`, sorted numeric values) \| `two-pointer-sum` (needs `target`, the sum; sorted values) \| `sliding-window` (`window` = length, default 3; marks the max-sum window). Generates the ops with a caption on every beat |
| `ops` | explicit alternative, each with optional `caption`, `ms`: `{"pointers": {"lo": 0, "hi": 9}}` creates or moves named pointers (arrows under the boxes; `null` removes one); `{"window": [i, j]}` brackets an inclusive range, `{"window": null}` clears it; `{"compare": [i, j]}` `{"swap": [i, j]}` `{"set": {"index": i, "value": v}}` as in `sort`; `{"highlight": i \| [i, …]}` / `{"unhighlight": … \| "all"}`; `{"mark": i \| [i, …]}` permanent done colour; `{"found": i}` the answer, green with a pulse; `{"note": "…"}` |

Indices are 0-based **positions** and every pointer has its own lane, so two
pointers on the same index do not collide. `ms: 0` on a `pointers`, `window`,
`highlight` or `mark` applies it inside the previous beat with no step of its
own. The check reads the final row back by position; with `binary-search` it
also fails unless the search ended at the target's index (or reported "not in
the array" when it is absent).

## kind: tree

A binary search tree. Values are circles; x is the value's in-order rank, y
its depth, so the picture is always a valid BST drawing and a promoted node
slides up into place.

```json
{
  "format": "vlmkit-anim/scene@1",
  "kind": "tree",
  "title": "Binary search tree",
  "initial": [8, 3, 10, 1, 6],
  "ops": [
    { "insert": 14 },
    { "insert": 4, "caption": "4 goes under 3, then right of 3: 3 < 4 < 6" },
    { "search": 6 },
    { "delete": 3, "caption": "3 has two children: its in-order successor 4 takes its place" },
    { "traverse": "inorder" }
  ]
}
```

| field | |
|---|---|
| `initial` | values inserted in this order before the first op, without animation (the shape depends on the order) |
| `ops` | required, 1+: `{"insert": n}` `{"search": n}` `{"delete": n}` `{"traverse": "inorder" \| "preorder" \| "postorder" \| "levelorder"}` `{"note": "…"}`; each may carry `caption`, which replaces the generated caption of that op's **last** beat (the comparisons on the way down keep theirs) |

Insert, search and delete walk a token down from the root with one captioned
beat per comparison (`14 > 8: go right`). Delete narrates the three cases —
leaf, one child (the child moves up), two children (the in-order successor,
the smallest value on the right, takes the node's place). Traverse visits
every node and lines the values up underneath. Inserting a value already
present, or deleting one that is not, is narrated as a no-op and the validator
warns. The check reads the final tree back from the frame: left-to-right
order must be ascending and every node at its depth.

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
  "trace": ["push", "pull", { "note": "Locking is the other way out of closed" }, "lock"]
}
```

| field | |
|---|---|
| `states` | required: `"id"` or `{"id", "label", "final": true, "pos": [x, y]}` (final = double ring; `pos` pins the state, the rest are laid out around it) |
| `initial` | required |
| `transitions` | required: `{"from", "to", "on": "event", "note": "/ action"}`; one per (from, on) |
| `trace` | required: items fired in order. An event name (must be legal from the current state — the validator lists the legal ones when it is not); `{"on": "ev", "caption": "…"}` to narrate that step yourself; `{"note": "…"}` for a captioned pause; `{"goto": "state", "caption": "…"}` to jump the token without a transition — how you show a second path after the first has ended |
| `layout` | `lr` (default) \| `tb` \| `circle` |

Each event is a step captioned `on <event>: a → b`; a token slides along the
arrow. States and transitions the trace never reaches are still drawn, and the
check warns about each: extend the trace, or after the main path ends add
`{"goto": "<state>", "caption": "The other path: …"}` and play the alternative.

## kind: heap

```json
{
  "format": "vlmkit-anim/scene@1",
  "kind": "heap",
  "title": "Min-heap",
  "type": "min",
  "ops": [
    { "push": 5 }, { "push": 3 }, { "push": 8 }, { "push": 1 },
    { "note": "The root is always the minimum. Watch what pop does." },
    { "pop": true }
  ]
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
  "events": [{ "after": "ok", "node": "replica", "status": "down", "caption": "replica crashes" }]
}
```

| field | |
|---|---|
| `nodes` | required: `"id"` or `{"id", "label", "status": up \| down \| leader \| busy}` |
| `messages` | required: `{"from", "to", "label", "at": ms \| "<", "after": "label", "delay": ms, "latency": ms, "lost": true, "caption"}`; `at` defaults to right after the previous message lands, `"<"` starts it together with the previous message (a broadcast), `latency` defaults to `stepMs`; `after` starts it when the earlier message with that label lands (+ `delay`) |
| `events` | `{"after": "label" \| "at": ms, "delay": ms, "node", "status", "caption"}` — recolours the node from that moment. Prefer `after`: an absolute `at` stays put when you lengthen a latency upstream, and the check warns when it then lands mid-flight or a down node keeps sending |

Sequence-diagram picture: node boxes across the top, lifelines down, time runs
down the canvas, each message a dot travelling with its arrow drawing in
behind. A message into a node that is down when it lands should be
`"lost": true` (the check warns otherwise).

**When does a message with no `at` / `after` start?** The scene's `timing` decides:

- `"causal"` (default): when its **sender is free** — after the last message the
  sender received has landed, and after the sender's own previous message has
  landed. So a reply waits for what it replies to, a side branch from another
  node never delays it, and two senders with nothing to wait for send at once.

  ```
  { "from": "a", "to": "b", "label": "req" }        sent 0,   lands 600   (a had nothing to wait for)
  { "from": "b", "to": "a", "label": "reply" }      sent 600, lands 1200  (b received req at 600)
  { "from": "b", "to": "c", "label": "notify" }     sent 1200            (b's own reply landed at 1200)
  { "from": "a", "to": "d", "label": "log" }        sent 1200            (a received reply at 1200; c's branch is irrelevant)
  ```

  A node that should wait before sending (a timeout, a slow disk) says so:
  `{"after": "req", "delay": 400}`. Inserting a message from one node never
  moves another node's messages.
- `"sequential"`: when the previous message in the list lands, whatever the
  sender. Reads plainly for one linear chain, but **inserting a message in the
  middle delays everything after it** — anchor the side branch with `after`
  and anchor the message it would otherwise push.

Either way, `"at": "<"` sends together with the previous message and `after`
pins to a landing. A lost message still "lands" for anchoring purposes at
the moment it would have arrived (send + latency), so a timeout can be
`{"after": "<the lost request>", "delay": 400}`. Labels used as an `after` target must be unique — a
broadcast to two nodes needs two labels (`hb-n2`, `hb-n3`); the validator says
so. `delay` on an event or message is milliseconds after its `after` anchor
lands. Run `explain` after an edit and read the times: a beat that moved when
it should not have is the tell.

## kind: matrix

A grid of cells: a dynamic-programming table filling in, a matrix, a table of
rows. A single row (`"cells": [[3, 1, 2]]`) is a plain array.

```json
{
  "format": "vlmkit-anim/scene@1",
  "kind": "matrix",
  "title": "Edit distance: cat → cut",
  "rowLabels": ["", "c", "a", "t"],
  "colLabels": ["", "c", "u", "t"],
  "cells": [
    [0, 1, 2, 3],
    [1, null, null, null],
    [2, null, null, null],
    [3, null, null, null]
  ],
  "ops": [
    { "set": { "cell": [1, 1], "value": 0, "from": [[0, 0]] }, "caption": "c = c: copy the diagonal" },
    { "set": { "cell": [1, 2], "value": 1, "from": [[1, 1]] }, "caption": "c ≠ u: 1 + the smallest neighbour" },
    { "set": { "cell": [1, 3], "value": 2, "from": [[1, 2]] } },
    { "set": { "cell": [2, 1], "value": 1, "from": [[1, 1]] } },
    { "set": { "cell": [2, 2], "value": 1, "from": [[1, 1], [1, 2], [2, 1]] }, "caption": "a ≠ u: 1 + min(diagonal, above, left) = 1 + 0" },
    { "set": { "cell": [2, 3], "value": 2, "from": [[2, 2]] } },
    { "set": { "cell": [3, 1], "value": 2, "from": [[2, 1]] } },
    { "set": { "cell": [3, 2], "value": 2, "from": [[2, 2]] } },
    { "set": { "cell": [3, 3], "value": 1, "from": [[2, 2]] }, "caption": "t = t: copy the diagonal" },
    { "mark": { "cell": [3, 3] }, "caption": "Edit distance is 1" }
  ]
}
```

| field | |
|---|---|
| `cells` | required: rows of `number` \| `string` \| `null`, all the same length; `null` is an empty cell waiting to be filled |
| `rowLabels`, `colLabels` | optional headers, one per row / column; captions use them instead of indices |
| `ops` | `{"set": {"cell": [r, c], "value": v, "from": [[r, c], …]}}` writes a value — `from` names the cells it was computed from, which flash while a token flies from each into the target; `{"highlight": T}` / `{"unhighlight": T \| "all"}` / `{"mark": T}` where T is `{"cell": [r, c]}` \| `{"cells": [[r, c], …]}` \| `{"row": r}` \| `{"col": c}` (highlight = accent until cleared, mark = permanent done colour); `{"swap": {"rows": [i, j]}}` / `{"swap": {"cols": [i, j]}}` (labels move with them); `{"note": "…"}`; each may carry `caption`, `ms` |

Cell references are `[row, col]`, 0-based, **by current position** (after a
swap, row 0 is whatever is now on top; the row label travels with its row,
so captions can keep naming rows by label). A `set` may write the value a
cell already holds — a beat that says "this one needs no change". `from` may list several cells (the
three neighbours a DP cell takes a min over); a token flies in from each.
The generated caption for a `set` reads `(row, col) = value (from (r, c), …)`
with the labels when there are any — it names the inputs but not why one won,
so write a `caption` on the beats where a comparison decides. The check reads
the final grid back by position and compares it with what the ops produced.

## kind: graph

Nodes and edges walked by a traversal. Nodes never move; the story is which
node is current, which are visited, what the labels say, and where the token
goes.

```json
{
  "format": "vlmkit-anim/scene@1",
  "kind": "graph",
  "title": "Shortest path A → E",
  "nodes": ["A", "B", "C", "D", "E"],
  "edges": [
    { "from": "A", "to": "B", "weight": 4 },
    { "from": "A", "to": "C", "weight": 1 },
    { "from": "C", "to": "B", "weight": 2 },
    { "from": "B", "to": "D", "weight": 1 },
    { "from": "C", "to": "D", "weight": 5 },
    { "from": "D", "to": "E", "weight": 3 }
  ],
  "algorithm": "dijkstra",
  "start": "A",
  "goal": "E"
}
```

| field | |
|---|---|
| `nodes` | required: `"id"` or `{"id", "label", "pos": [x, y]}` (`pos` pins a node) |
| `edges` | required: `{"from", "to", "weight", "label"}` or the shorthand `["a", "b"]`; the weight (or label) is drawn on the edge |
| `directed` | `true` draws arrows and `explore` must follow them; default `false` (lines, either direction) |
| `layout` | `circle` (default) \| `lr` \| `tb` \| `grid`; nodes with `pos` are pinned and the rest are laid out around them |
| `algorithm`, `start`, `goal` | `bfs` \| `dfs` \| `dijkstra` from `start` generates the ops (every beat captioned with the comparison it makes); `goal` makes Dijkstra paint the shortest path at the end |
| `ops` | explicit alternative: `{"visit": id}` (current = accent and larger, then stays green), `{"explore": "a->b"}` (a token travels the edge), `{"label": {"node": id \| [ids], "text": "…"}}` (text under the node: a distance, a depth), `{"highlight": id \| [ids]}` / `{"unhighlight": …}`, `{"path": ["a", "b", "c"]}` (paints the answer green), `{"note": "…"}`; each may carry `caption`, `ms` |

Colours: a node starts white; `highlight` makes it accent (amber by default)
and it stays amber until a `visit`, `path` or `unhighlight` recolours it —
so a node discovered but never dequeued ends amber, not green; `visit` makes
it accent and a little larger while it is the current node, and it turns
green ("visited") when the next `visit` happens or the animation ends; `path`
paints its nodes and edges green, and visited nodes off the path stay green
too. A node never touched stays white, so the final frame shows exactly what
the walk reached. Use explicit `ops` when the walk should be allowed to stop
before reaching everything (an `algorithm` visits every reachable node, and
the check holds it to that).

`ms: 0` on a `label` or `highlight` applies it at the current instant without
a step of its own — a relaxation writing the new distance inside the explore
beat. The generated ops use it; write it when two changes belong to one beat.
With an `algorithm`, the check fails unless every node reachable from `start`
was visited, and warns about nodes that are not reachable at all.

## kind: chart

A bar or line chart revealed series by series, with reference lines and focus.

```json
{
  "format": "vlmkit-anim/scene@1",
  "kind": "chart",
  "title": "p95 latency by region (ms)",
  "categories": ["us", "eu", "ap"],
  "series": [
    { "id": "before", "label": "before cache", "values": [120, 180, 260] },
    { "id": "after", "label": "after cache", "values": [40, 60, 90] }
  ],
  "sequence": [
    { "reveal": "before", "caption": "Before: every request hits the database" },
    { "threshold": { "value": 100, "label": "SLO" }, "caption": "The SLO is 100 ms; two regions miss it" },
    { "reveal": "after", "caption": "After: a regional cache absorbs most reads" },
    { "highlight": { "category": "ap" }, "caption": "ap improves most — it was furthest from the database" }
  ]
}
```

| field | |
|---|---|
| `type` | `bar` (default) \| `line` |
| `categories` | required: the x-axis labels |
| `series` | required, 1+: `{"id", "label", "values": number[], "color"}`, one value per category; colours default to a palette |
| `yMax`, `yLabel` | axis top and axis caption. Default top: 10% above the largest value (thresholds and `set` values included), rounded up to 1 / 1.5 / 2 / 2.5 / 3 / 4 / 5 / 6 / 8 × 10ⁿ — a peak of 2.4 gets 3, of 260 gets 300 |
| `sequence` | `{"reveal": id \| [ids] \| "all"}` (bars grow in / the line draws in), `{"set": {"series", "index", "value"}}` (a bar animates to a new value; bar charts only), `{"highlight": T}` / `{"unhighlight": T \| "all"}` (everything outside T dims), `{"threshold": {"value", "label"}}` (a horizontal reference line), `{"note": "…"}`; each may carry `caption`, `ms`. Default: reveal each series in order |

A highlight target T picks by any combination of `series` and one of
`index` / `category`: `{"series": "after"}` is one series across every
category, `{"category": "ap"}` is every series in one category,
`{"series": "after", "category": "ap"}` is one bar. Every series stays
invisible until its own `reveal` (or `{"reveal": "all"}`); adding a series
to a hand-written sequence means adding its reveal, and the check warns
when one is missing. Without a `caption`, a `reveal` is captioned with the
series label; the story usually wants its own.
Put a `threshold` at the beat where it becomes relevant — after the series it
judges is on screen — rather than first. The check fails if a bar's final
height is not its value's share of the axis and warns about a series the
sequence never reveals.

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
Before reaching for it, check the table: an array is a one-row `matrix`, a
tree is a `graph` with `layout: "tb"`, a sequence of numbers is a `chart`.

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
- `steps`: chapter markers with `label` / `caption`; the runtime's ◀ ▶| buttons walk them. A step without a caption keeps the previous caption showing.
- `duration`: optional, computed from the last keyframe or step.

## Looking at it with a vision model

`sheet` puts every step on one image, tiles in reading order, each labelled
with step number, time and caption. One image is one call, the order is fixed
by layout, and a model judges "what changed between tile 3 and 4" far more
reliably than it reads absolute positions off a single frame. Two limits:
tiles shrink as frames grow (keep `--tile` at 300px+ and the count near a
dozen, or the labels inside frames stop being legible), and the sheet is for
the judgement "does this explain it?", not for correctness — `check` reads
sorted order, heap shape and trace legality back from the frames
deterministically, so do not spend a vision call on those.

## Video (GIF, MP4, WebM)

`vlmkit-anim video scene.json --out demo.gif` writes a file that plays where
no runtime runs: a README, a slide, a chat message. The frames are the same
deterministic samples `render` produces, at `--fps` (default 20), plus a
**hold** of `--hold` ms (default 400) on every step marker and on the last
frame — in a browser the viewer pauses to read a caption, in a video the file
has to do it. Identical consecutive frames collapse into one longer frame, so
a hold costs one frame.

- **`.gif`** is encoded in-process, no external tool. Flat SVG colours and
  text fit a 256-colour palette with no visible loss, and GIF autoplays inline
  everywhere. Size grows with pixel count: `--width 480` for a README, 640–800
  for a slide. `--no-loop` plays once.
- **`.mp4` / `.webm`** run `ffmpeg` (H.264 `yuv420p` / VP9) when it is on
  PATH. When it is not, the PNG frames and an `frames.ffconcat` list are left
  next to the output with the exact command printed; run it, or hand the
  frames to any encoder. MP4 is the format for X, YouTube and Keynote; GitHub
  renders MP4 only as an uploaded attachment, not from a repository path, so
  a README wants the GIF.

`sheet` and `video` divide the review work: the sheet is one image for a
vision model, the video is for a person.

## Embedding

`vlmkit-anim html scene.json --out page.html` writes a page with the runtime inline. For a site with many animations:

```html
<script src="vlm-anim.js"></script>                <!-- vlmkit-anim runtime --out vlm-anim.js -->
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
