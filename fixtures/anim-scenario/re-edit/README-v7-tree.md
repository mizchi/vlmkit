# Re-edit task (v7, tree): show the hard delete case

`tree-delete.scene.json` deletes two leaves from a BST, which never shows
what makes deletion interesting.

Change request from the author: **replace the second delete with the
deletion of `30`, which has two children**, and make the narration explain
what happens to `35`, `40` and `45` (which is still in the tree at that
point if you order things right — decide, and say so in your log). Keep the
first delete of a leaf as the easy case for contrast. End with the same
in-order traversal so the viewer sees the order is preserved.

Requirements: exactly two `delete` ops; the second is `30`; the tree after
the edit still contains `35`, `40` and either `45` or not — your log states
which and why; every op that changes shape has a caption that names the
successor.

Success: `vlmkit-anim check tree-delete.scene.json` exits 0 with no ✗ and no
⚠; `explain` names the successor of 30; the final in-order line is ascending.

Write down, before your first `check`, which value you expect to take 30's
place and where 40 ends up.
