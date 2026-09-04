# Log — sort-insertion attempt

## Round 1

Wrote `scene.json` straight from `docs/anim-ir.md`'s "kind: sort" section and
the `vlmkit anim schema --kind sort` output. Decided against the shorthand
`"algorithm": "insertion"` because the guide gives no way to attach custom
captions to auto-generated ops (custom `caption` is documented only as a
per-op field under the explicit `"ops"` array), and the brief requires the
narration to explicitly name the "sorted run" and explain why an element
stops — a generic default caption seemed unlikely to say that. So I hand-wrote
the full insertion-sort trace of `[7, 2, 9, 4, 1]` as `compare` / `swap` /
`note` ops, modelling each "shift" as an adjacent swap, with a `caption` on
every `compare`/`swap` and using the `note` op's own text as its caption.

Ran `check` as the first-ever invocation on this file:

```
✓ scene.json (sort): 0 error(s), 0 warning(s)
  7960ms · 24 steps (24 captioned) · 16 nodes · 10 tracks / 83 keyframes
  scene 1948 B → timeline 8124 B (×4.2)
```

Exit 0, no ✗ or ⚠ lines. Clean on the first attempt — no round 2/3/4 needed.

Verified by hand:
- `explain` prints 24 numbered lines (my 22 ops plus an auto-added "Start:
  7, 2, 9, 4, 1" line 1 and an auto-added "Sorted: 1, 2, 4, 7, 9" line 24 —
  neither is documented in the guide as automatic, but both are welcome).
  The narration mentions "sorted run" seven times and states explicitly, for
  three different elements, why each one stops (9 stops because it isn't
  smaller than the run's end; 4 stops because it isn't smaller than 2; 1 goes
  all the way to the front because it's smaller than everything).
- Rendered frames at t=560/880/1280/7760 (`render --step` and `frames --png`)
  and read them as PNGs: bars physically animate into their post-swap x
  position (confirmed 7,2,9,4,1 → 2,7,9,4,1 between the 560ms "compare"
  frame and the 1280ms "stops here" frame), the currently-compared bars are
  highlighted orange, a bar mid-swap is red, and the final frame shows all
  five bars green with the caption "Sorted: 1, 2, 4, 7, 9". Final left-to-
  right order is 1,2,4,7,9 — correctly sorted.
