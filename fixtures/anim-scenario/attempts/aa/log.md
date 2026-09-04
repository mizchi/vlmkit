# Attempt aa — array-partition

## Round 0: prediction (before first check)

Expected final row (by position): `2, 4, 3, 5, 9, 8, 7`
- left of pivot (5): 2, 4, 3 — all smaller
- right of pivot: 9, 8, 7 — all larger
- 5 marked as done (final place)

Sequence of swaps (position-based, since indices in `compare`/`swap` are
0-based *current positions* per the guide):
1. highlight 6 (pivot)
2. pointers i=0, j=0
3. compare(0,6): 7 vs 5 → no swap
4. j→1
5. compare(1,6): 2 vs 5 → smaller
6. swap(1,0) → array: 2,7,9,4,3,8,5
7. i→1
8. j→2
9. compare(2,6): 9 vs 5 → no swap
10. j→3
11. compare(3,6): 4 vs 5 → smaller
12. swap(3,1) → array: 2,4,9,7,3,8,5
13. i→2
14. j→4
15. compare(4,6): 3 vs 5 → smaller
16. swap(4,2) → array: 2,4,3,7,9,8,5
17. i→3
18. j→5
19. compare(5,6): 8 vs 5 → no swap
20. unhighlight 6
21. swap(6,3) → array: 2,4,3,5,9,8,7
22. mark 3 (pivot final)

Guessed semantics (to verify against `check`/`explain`):
- `compare` only highlights, never moves anything (stated explicitly for `sort`,
  assumed to carry over to `array`).
- `pointers` partial update (`{"j": 1}`) moves just that named pointer and
  leaves `i` where it was — guide's binary-search example only ever supplies
  both `lo`/`hi` together, so this is a guess.
- `mark` is a *permanent* recolour (stated), applied to the position, not tied
  to a pointer.
- `swap` takes two **positions**, not values — confirmed by "Indices are
  0-based positions" in the `array` section.
- Pivot itself never needs a pointer name; using `highlight`/`unhighlight` on
  its position for the whole pass, per the brief's suggestion.

## Round 1

Command: `cd /home/user/vlmkit && pnpm exec vlmkit-anim check fixtures/anim-scenario/attempts/aa/scene.json`

Output (verbatim, full):
```
✓ scene.json (array): 0 error(s), 0 warning(s)
  13500ms · 24 steps (23 captioned) · 29 nodes · 17 tracks / 83 keyframes
  scene 1746 B → timeline 9433 B (×5.4)
  next: vlmkit-anim explain fixtures/anim-scenario/attempts/aa/scene.json · vlmkit-anim render fixtures/anim-scenario/attempts/aa/scene.json --step N · vlmkit-anim html fixtures/anim-scenario/attempts/aa/scene.json --out page.html
```

Green on the first attempt — 0 errors, 0 warnings, no fix rounds needed.

`explain` output confirms the story reads as intended (22 named beats + Start +
End); the caption sequence matches the prediction in Round 0 exactly, e.g.:
- "j=1: a[1]=2 vs pivot 5. 2 is smaller — swap it into position i=0."
- "5 is now in its final place: everything left of it is smaller, everything right is larger."

## Verification via render --at end

`pnpm exec vlmkit-anim render fixtures/anim-scenario/attempts/aa/scene.json --at end --out fixtures/anim-scenario/attempts/aa/end.svg`

Read back the `cell-N` groups' `translate(x y)` against the slot x-values
(idx-0..6 at x = 62, 106, 150, 194, 238, 282, 326, step 44px reading right,
but the 0-based idx labels sit under x = 62..326 in +44 steps in *increasing*
index order — i.e. idx-0 at x=62 maps to position 0, idx-6 at x=326 maps to
position 6):

| cell id | value | translate x | → position |
|---|---|---|---|
| cell-1 | 2 | 62  | 0 |
| cell-3 | 4 | 106 | 1 |
| cell-4 | 3 | 150 | 2 |
| cell-6 | 5 | 194 | 3 (fill `#22c55e` — marked done) |
| cell-2 | 9 | 238 | 4 |
| cell-5 | 8 | 282 | 5 |
| cell-0 | 7 | 326 | 6 |

**Final row: `2, 4, 3, 5, 9, 8, 7`** — exact match to the Round 0 prediction.
Left of pivot (2, 4, 3) all smaller than 5; right (9, 8, 7) all larger; the
pivot's cell (`cell-6`) is filled `#22c55e`, confirming `mark` painted it
green as "final place". Brief's success criteria fully met.
