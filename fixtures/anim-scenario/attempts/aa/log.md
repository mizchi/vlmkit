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
