# Attempt w — graph-build-critical-path, directed Dijkstra (sonnet)

- First-attempt check: 0 errors, 0 warnings. Rounds to green: 1 (no fixes needed).
- Scene: 496 B → timeline 10608 B (×21.4), 15 steps, 8400ms.

Prediction vs actual (relaxation beats). Predicted "utils→api: 2+1=3 is less than 5, update api to 3" and "api→web: 3+2=5 is less than 6, update web to 5." Actual `explain` lines: `utils → api: 2 + 1 = 3 < 5, improve` and `api → web: 3 + 2 = 5 < 6, improve`. Near-exact match — the `<` comparison names both the new and superseded value, which I wasn't sure would happen.

Success criteria: met. Final beat: `Shortest path to web: core → utils → api → web (length 5)`. Render at `end`: `core` at `translate(40 150)` (left edge of the 640-wide canvas), `web` at `translate(600 150)` (right edge). The three path edges (core→utils, utils→api, api→web) render `#22c55e` (green); the other three stay `#1f2328`.

Guide feedback. The `graph` kind's field table never says whether `pos`-pinning a subset of nodes coexists with `layout: "lr"` for the rest — only the **diagram** kind spells that out ("nodes with pos are pinned"). Graph's row just lists `circle|lr|tb|grid` with no such clause, so "pin two nodes, auto-layout the rest" (exactly what the brief asks for) had to be inferred by analogy from a different kind. I'd add the same clause to graph's `layout` row: "nodes with `pos` are pinned; the rest are placed by `layout` relative to them." Otherwise the guide was sufficient — the worked `dijkstra`+`goal` example was copy-adaptable almost verbatim, so `ms:0`/relaxation semantics never had to be touched manually.

Guesses made: partial `pos` pinning + `layout: "lr"` composing as expected (right); omitting `canvas` and trusting "kinds pick a size that fits" → got 640×400 (right); that `algorithm: dijkstra` + `goal` alone would satisfy "caption the two relaxation beats" (right — default captions already name old vs. new distances).
