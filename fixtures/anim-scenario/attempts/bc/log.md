# Attempt bc — list-lru

## Expected list state after each access (worked out from the guide before running check)

- Start: empty list.
- `get a` (miss, insert a at 0): `a`. Head=a, tail=a.
- `get b` (miss, insert b at 0): `b, a`. Head=b, tail=a.
- `get c` (miss, insert c at 0): `c, b, a`. Head=c, tail=a. Full (capacity 3).
- `get a` (hit): `find a` walks head→c→b→a. Then `remove a`: `c, b`. Then `insert a at 0`: `a, c, b`. Head=a (MRU), tail=b (now LRU, since a and c were touched more recently than b).
- `get d` (miss): tail is `b` → evict it: `remove b`: `a, c`. Then `insert d at 0`: `d, a, c`. Head=d, tail=c.

Final expected order: `d → a → c → ∅`, matching the brief. Eviction should be named as `b`.

## Round 1

Command:
```
cd /home/user/vlmkit && pnpm exec vlmkit-anim check fixtures/anim-scenario/attempts/bc/scene.json
```

Full output (verbatim):
```
⚠ tracks(arr-2.opacity): every keyframe has the same value 0: the track changes nothing
⚠ tracks(arr-3.opacity): every keyframe has the same value 0: the track changes nothing
✓ scene.json (list): 0 error(s), 2 warning(s)
  7865ms · 12 steps (12 captioned) · 18 nodes · 22 tracks / 133 keyframes
  scene 780 B → timeline 10083 B (×12.9)
  next: vlmkit-anim explain fixtures/anim-scenario/attempts/bc/scene.json · vlmkit-anim render fixtures/anim-scenario/attempts/bc/scene.json --step N · vlmkit-anim html fixtures/anim-scenario/attempts/bc/scene.json --out page.html
```

0 ✗, 2 ⚠ on first attempt. Ran `explain`:
```
LRU cache (capacity 3) as a linked list — 12 steps, 7865ms, 18 nodes
 1. [    0ms] LRU cache (capacity 3) as a linked list
 2. [  385ms] get a: miss — insert a at the head (head = most recently used)
 3. [ 1210ms] get b: miss — insert b at the head
 4. [ 2035ms] get c: miss — insert c at the head; the cache is now full (capacity 3)
 5. [ 2860ms] c ≠ a: follow next
 6. [ 3245ms] b ≠ a: follow next
 7. [ 3630ms] a = a: found it after 2 hops
 8. [ 4290ms] get a: hit — remove a from its current spot
 9. [ 5115ms] move a to the head: this remove + reinsert-at-0 is what "move to front" means
10. [ 5940ms] get d: miss — b is at the tail, the eviction candidate: evict it
11. [ 6765ms] insert d at the head
12. [ 7590ms] List: d → a → c → ∅
```
Final line already reads `d → a → c → ∅` as the brief wants, and step 10's caption names `b` as evicted (my own caption, not a generated one — the tool has no generated "evicted" language, see report).

## Round 2 — investigating the 2 warnings

`--json` showed the two diagnostics point at `tracks(arr-2.opacity)` / `tracks(arr-3.opacity)`: "every keyframe has the same value 0: the track changes nothing". I could not read source, so I isolated the cause empirically with disposable scratch scenes (not the attempt file, so not counted against the check budget):

- `insert a; remove a; insert a` → 1 warning (`arr-0.opacity`).
- `insert a; insert b; remove a` (remove with **no** insert afterward) → **0 warnings**.
- `insert a; insert b; remove a; insert c` (reinsert a *different* value) → still 1 warning.
- `insert a; insert b; insert c; remove a; insert d` → still 1 warning.
- Grouping both removes together, then both inserts together → still exactly 2 warnings (one per remove).

Conclusion: **every `remove` op that is followed later in the op list by any `insert` op leaves one dead "arrow" opacity track behind**, regardless of value, position, or how far apart the ops are. A `remove` with nothing inserted afterward emits none. This is a leftover-allocation artifact of the compiler (an arrow slot from the removed node's gap is pre-allocated for the next insert's arrows but never gets toggled again), not something a scene author can route around using the documented `insert`/`remove`/`find`/`reverse` vocabulary — and the guide does not mention it. The brief mandates exactly two remove-then-insert pairs (move-to-front, then eviction+insert-d), so 2 warnings appear to be structurally unavoidable while following the brief's own instructions with this tool version. I did not find a per-scene fix; treating this as a tool gap rather than continuing to search (round budget).

Confirmed directly in the rendered SVG below (`arr-2` / `arr-3` both carry `opacity="0"` and never change), and it does NOT affect correctness — 0 ✗, and both `explain` and the final SVG give the correct answer. I am accepting 2 ⚠ as the final state rather than spending remaining rounds fighting an unavoidable diagnostic; scene stays unedited from round 1.

## Round 2 — render + read the final order off the SVG

```
pnpm exec vlmkit-anim render fixtures/anim-scenario/attempts/bc/scene.json --at end --out fixtures/anim-scenario/attempts/bc/end.svg
→ frame t=7865 "List: d → a → c → ∅" → fixtures/anim-scenario/attempts/bc/end.svg
```

Visible node `<g id="n-N">` groups (no `opacity="0"`), by translate x ascending:

| id | x | text | opacity |
|---|---|---|---|
| n-4 | 92  | d | (visible) |
| n-3 | 170 | a | (visible) |
| n-2 | 248 | c | (visible) |
| n-1 | 248 | b | `opacity="0"` (removed, hidden) |
| n-0 | 248 | a | `opacity="0"` (removed, hidden) |

Left to right: **d → a → c → ∅** (the `<g id="nil">` text sits right after n-2). Matches the brief exactly. `arr-2` and `arr-3` (the two warned-about tracks) are confirmed `opacity="0"` throughout — dead, harmless.

Scene is green apart from the 2 unavoidable ⚠ discussed above. Done.
