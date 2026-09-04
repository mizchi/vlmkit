# Attempt w — graph-build-critical-path

## Plan (before first check)

Nodes: core, utils, api, web, cli
Edges (directed): core->utils(2), core->api(5), utils->api(1), utils->web(4), api->web(2), api->cli(3)

Using `algorithm: dijkstra`, `start: core`, `goal: web`, `directed: true`, `layout: lr`,
with `pos` pinning only `core` (left) and `web` (right), per the brief's "let the rest
be laid out automatically."

Hand-computed Dijkstra from core:
- core = 0
- utils = 2 (core->utils)
- api: direct core->api = 5, but via utils: 2+1 = 3 — SHORTER. api = 3.
- web: via utils direct = 2+4 = 6, but via api: 3+2 = 5 — SHORTER. web = 5.
- cli: via api = 3+3 = 6.

Final shortest path core -> utils -> api -> web, total 5.

## Prediction: the two "shorter route replaces a longer one" beats

Beat 1 (api relaxed): I expect a caption near "core->api: 5" being generated first
(or skipped) and then, once utils is processed, something like:
  "utils->api: 2+1=3 is less than 5, update api to 3"
i.e. naming api, old value 5, new value 3, via utils.

Beat 2 (web relaxed): once api is processed, I expect:
  "api->web: 3+2=5 is less than 6, update web to 5"
i.e. naming web, old value 6, new value 5, via api.

I am NOT sure the auto-generated captions actually state the "old value" being
replaced — the guide only says "every beat captioned with the comparison it makes",
which could just mean "3 < 5" without naming which node/edge produced the old
tentative value. Recording this uncertainty now, before running check/explain.

## Round 1

Command: `pnpm exec vlmkit-anim check fixtures/anim-scenario/attempts/w/scene.json`

Full output (verbatim):
```
✓ scene.json (graph): 0 error(s), 0 warning(s)
  8400ms · 15 steps (14 captioned) · 24 nodes · 27 tracks / 109 keyframes
  scene 496 B → timeline 10608 B (×21.4)
  next: vlmkit-anim explain fixtures/anim-scenario/attempts/w/scene.json · vlmkit-anim render fixtures/anim-scenario/attempts/w/scene.json --step N · vlmkit-anim html fixtures/anim-scenario/attempts/w/scene.json --out page.html
```

Green on the first attempt: 0 errors, 0 warnings. No fix rounds needed.

## explain output

```
Fastest build order from core — 15 steps, 8400ms, 24 nodes
 1. [    0ms] Fastest build order from core
 2. [  360ms] Every node starts at distance ∞; core is 0
 3. [  960ms] Visit core (distance 0): the smallest tentative distance left
 4. [ 1560ms] core → utils: 0 + 2 = 2 < ∞, improve
 5. [ 2160ms] core → api: 0 + 5 = 5 < ∞, improve
 6. [ 2760ms] Visit utils (distance 2): the smallest tentative distance left
 7. [ 3360ms] utils → api: 2 + 1 = 3 < 5, improve
 8. [ 3960ms] utils → web: 2 + 4 = 6 < ∞, improve
 9. [ 4560ms] Visit api (distance 3): the smallest tentative distance left
10. [ 5160ms] api → web: 3 + 2 = 5 < 6, improve
11. [ 5760ms] api → cli: 3 + 3 = 6 < ∞, improve
12. [ 6360ms] Visit web (distance 5): the smallest tentative distance left
13. [ 6960ms] Visit cli (distance 6): the smallest tentative distance left
14. [ 7560ms] Shortest path to web: core → utils → api → web (length 5)
15. [ 8160ms] (end)
```

## Prediction vs actual

Beat 7 (predicted "utils->api: 2+1=3 is less than 5, update api to 3") vs actual
"utils → api: 2 + 1 = 3 < 5, improve" — very close match, same numbers, same
sense (3 replaces 5 as the tentative distance to api).

Beat 10 (predicted "api->web: 3+2=5 is less than 6, update web to 5") vs actual
"api → web: 3 + 2 = 5 < 6, improve" — near-exact match.

My uncertainty about whether the caption would name the *old* value was
resolved positively: it does, via the "< N" comparison shown inline.

## Render check (--at end)

`core` node: `transform="translate(40 150)"` — x=40, left edge of the 640-wide
canvas. `web` node: `transform="translate(600 150)"` — x=600, right edge.
Both as pinned.

Edge colors at the end frame: edge-0 (core→utils, green #22c55e), edge-2
(utils→api, green), edge-4 (api→web, green) are all green — exactly the
three edges of the shortest path. edge-1 (core→api direct), edge-3
(utils→web direct), edge-5 (api→cli) stay dark (#1f2328) — not on the
shortest path. Final caption baked into the frame: "Shortest path to web:
core → utils → api → web (length 5)".

All of this matches the brief's success criteria.

