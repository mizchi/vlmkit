# Re-edit task (v8, list): play it backwards

`list-playlist.scene.json` edits a playlist kept as a linked list.

Change request from the author: **after the existing three edits, add a
"repeat the chorus" step that inserts a second `chorus` right after
`bridge`, then reverse the whole list to play it backwards, and finish with a
`find` for `outro` that shows how many hops it now takes from the new
head.** Every new beat gets a caption in the existing style.

Requirements: exactly one `reverse`; the second `chorus` is inserted with
`after`, not `at`; the closing `find` is the last op. Nothing in the first
three ops changes.

Success: `vlmkit-anim check list-playlist.scene.json` exits 0 with no ✗ and
no ⚠; `explain` ends with the find narration; the final frame reads
`outro → chorus → bridge → chorus → verse → ∅` left to right.

Write down, before your first `check`, the final order you expect and how
many hops the closing `find` should report.
