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
