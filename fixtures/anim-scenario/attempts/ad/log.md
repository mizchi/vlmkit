# tree-delete.scene.json re-edit — agent `ad`

## Step 1: tree drawn from `initial` before any op

`initial: [50, 30, 70, 20, 40, 60, 80, 35, 45]` inserted in this order into an
empty BST:

```
                    50
                 /      \
               30        70
              /  \      /  \
            20   40   60   80
                /  \
              35   45
```

(30 < 50 → left; 70 > 50 → right; 20 < 50,<30 → left of 30; 40 <50,>30 → right
of 30; 60 <70,>50 → left of 70; 80 >70 → right of 70; 35 <50,>30,<40 → left of
40; 45 <50,>30,>40 → right of 40.)

## Prediction, before first `check`

Ops (after edit): search 45, delete 45 (leaf, easy case), delete 30 (two
children), traverse inorder.

- After `delete 45`: 40 loses its right child; 40's only child is 35 (left).
- `delete 30`: 30 has two children (20 left, 40 right). In-order successor =
  smallest value in right subtree rooted at 40. 40's left child is 35, which
  has no left child of its own, so the successor is **35**. 35's value moves
  into 30's old slot; the original 35 leaf node is spliced out. 40 has no
  children left after that (its only child, 35, was the one promoted away),
  so **40 ends up as a leaf**, still the right child of the node now holding
  value 35 (which sits where 30 used to be, left child of 50).
- **45 is NOT present** at the point 30 is deleted — it was removed by the
  first delete op, one step earlier. (The README's "or not — state which and
  why": not present, because deletion order runs 45 first, then 30.)

Expected final tree:

```
                    50
                 /      \
               35        70
              /  \      /  \
            20   40   60   80
```

Expected in-order traversal: 20, 35, 40, 50, 60, 70, 80 (ascending — matches
the "same in-order traversal" requirement).

## Step 2: round 1 (first and only edit)

Edit: replaced `{ "delete": 20, "caption": "20 is a leaf too" }` with
`{ "delete": 30, "caption": "30 has two children: its in-order successor 35
(the smallest value in the right subtree) takes its place; 40 keeps its spot
as 35's new right child, and 45 is already gone from the earlier delete" }`.
Kept the `search 45` / `delete 45` leaf pair unchanged, kept the trailing
`{"traverse": "inorder"}`.

`check` output, verbatim:

```
✓ tree-delete.scene.json (tree): 0 error(s), 0 warning(s)
  11385ms · 17 steps (17 captioned) · 30 nodes · 48 tracks / 197 keyframes
  scene 451 B → timeline 16466 B (×36.5)
  next: vlmkit-anim explain fixtures/anim-scenario/attempts/ad/tree-delete.scene.json · vlmkit-anim render fixtures/anim-scenario/attempts/ad/tree-delete.scene.json --step N · vlmkit-anim html fixtures/anim-scenario/attempts/ad/tree-delete.scene.json --out page.html
```

Green on the first attempt: 0 ✗, 0 ⚠.

`explain` (step 14, the delete-30 beat): `30 has two children: its in-order
successor 35 (the smallest value in the right subtree) takes its place; 40
keeps its spot as 35's new right child, and 45 is already gone from the
earlier delete` — names 35 as successor, as predicted.

`explain` step 16 (final in-order line): `inorder: 20, 35, 40, 50, 60, 70, 80`
— ascending, matches prediction exactly.

`render --at end` (`end.svg`) visible (`opacity` not `0`) `v-N` circles:

| node | translate x, y |
|---|---|
| v-20 | 71, 202 |
| v-35 | 195, 138 |
| v-40 | 257, 202 |
| v-50 | 381, 74 |
| v-60 | 443, 202 |
| v-70 | 505, 138 |
| v-80 | 567, 202 |

`v-30` and `v-45` are present but `opacity="0"` (deleted, kept in the DOM
hidden). x-order (71 < 195 < 257 < 381 < 443 < 505 < 567) is ascending and
matches in-order rank exactly; y=138 for 35 and 70 (depth 1, same as 30's old
depth), y=202 for 20/40/60/80 (depth 2) — 35 sits where 30 used to be, 40 is
now at 40's own depth-2 slot as a leaf. This matches the predicted final tree
exactly. No round 2 needed.
