# Brief: why BST shape depends on insertion order

Produce `scene.json` (kind `tree`) for a short lesson: the same seven values
`10, 20, 30, 40, 50, 60, 70` give a very different tree depending on the
order they arrive.

Beats to show, in order:
1. Start from an empty tree and insert them **sorted** (`10, 20, 30, …`): the
   tree degenerates into a chain. Say so in a caption.
2. Search for `70` and let the narration show how many comparisons it took.
3. Delete everything except `40` is *not* required; instead add a `note`
   explaining what a balanced insertion order would be.
4. Insert `35` and `45` and show where they land.
5. Finish with an in-order traversal: the values come out sorted regardless
   of shape.

Success: `vlmkit-anim check scene.json` exits 0 with no ✗ and no ⚠; the
search narration reports **7 comparisons**; `vlmkit-anim explain scene.json`
reads as a lesson (each beat says why, not just what).
