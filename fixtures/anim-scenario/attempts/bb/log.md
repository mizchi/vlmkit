# Log — bb — queue-bfs-frontier

## Expected queue contents after each beat (worked out before running anything)

Graph: A-B, A-C, B-D, C-D, D-E. BFS from A.

| beat | op | queue (front...back) after |
|---|---|---|
| 0 (title) | — | [] |
| 1 | enqueue A | [A] |
| 2 | dequeue (A) | [] |
| 3 | enqueue B | [B] |
| 4 | enqueue C | [B, C] |
| 5 | peek (B) | [B, C] (unchanged) |
| 6 | dequeue (B) | [C] |
| 7 | enqueue D | [C, D] |
| 8 | dequeue (C) | [D] |
| 9 | dequeue (D) | [] |
| 10 | enqueue E | [E] |
| 11 | dequeue (E) | [] |
| 12 | note: empty, done | [] |

Dequeue order expected in `explain`: A, B, C, D, E.
Max simultaneous occupancy: 2 (B,C together, then C,D together) — no `capacity`
field needed since default is "as many as the scene ever holds".

## Round 1 — first attempt, before any check/explain run

scene.json written directly from `docs/anim-ir.md` (kind: stack, kind: queue
section) + `schema --kind queue` cheat sheet. 12 ops: enqueue A; dequeue;
enqueue B; enqueue C; peek; dequeue; enqueue D; dequeue; dequeue; enqueue E;
dequeue; note.

### `check` output (FULL, verbatim, first and only run):

```
✓ scene.json (queue): 0 error(s), 0 warning(s)
  8965ms · 14 steps (14 captioned) · 15 nodes · 18 tracks / 96 keyframes
  scene 907 B → timeline 8115 B (×8.9)
  next: vlmkit-anim explain fixtures/anim-scenario/attempts/bb/scene.json · vlmkit-anim render fixtures/anim-scenario/attempts/bb/scene.json --step N · vlmkit-anim html fixtures/anim-scenario/attempts/bb/scene.json --out page.html
```

0 ✗, 0 ⚠. Green on the first attempt — no round 2 needed.

### `explain` output:

```
BFS frontier from A — 14 steps, 8965ms, 15 nodes
 1. [    0ms] BFS frontier from A
 2. [  385ms] Start BFS at A: enqueue A
 3. [ 1045ms] Dequeue A: visit A; neighbours B and C are unvisited
 4. [ 1815ms] Enqueue B (unvisited neighbour of A)
 5. [ 2475ms] Enqueue C (unvisited neighbour of A)
 6. [ 3135ms] Peek: B is next to be processed
 7. [ 3740ms] Dequeue B: visit B; neighbour D is unvisited
 8. [ 4510ms] Enqueue D (unvisited neighbour of B)
 9. [ 5170ms] Dequeue C: visit C; neighbour D is already queued — no enqueue
10. [ 5940ms] Dequeue D: visit D; neighbour E is unvisited
11. [ 6710ms] Enqueue E (unvisited neighbour of D)
12. [ 7370ms] Dequeue E: visit E; no unvisited neighbours
13. [ 8140ms] Queue is empty — BFS from A is complete
14. [ 8690ms] Queue: empty · removed A, B, C, D, E
```

Step 14 is the compiler's own auto-generated last step ("removed A, B, C, D, E")
— it states the dequeue order verbatim, matching my hand-worked table exactly
and matching the brief's success criterion without me needing to encode the
order myself.

### `render --at end` check

`v-0` through `v-4` (all 5 queue-slot rects the scene ever used) each render
with `opacity="0"` in `end.svg` — none visible. Queue is empty at the end, as
predicted.

## Result: GREEN on round 1. No fixes needed.
