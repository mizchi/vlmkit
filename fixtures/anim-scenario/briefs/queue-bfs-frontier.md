# Brief: the BFS frontier as a queue

Produce `scene.json` (kind `queue`) showing **only the queue** during a
breadth-first search of this graph from `A`: `A–B`, `A–C`, `B–D`, `C–D`,
`D–E`. (The graph itself is not drawn; the queue is the whole picture, so the
captions carry the graph.)

Beats: enqueue `A`; dequeue `A` and enqueue its unvisited neighbours `B`,
`C`; dequeue `B` and enqueue `D`; dequeue `C` (its neighbour `D` is already
queued — say so in a caption, with no enqueue); dequeue `D` and enqueue `E`;
dequeue `E`; the queue is empty, the search is done. Use `peek` at least once
to show what will be processed next before it is dequeued.

Success: `vlmkit-anim check scene.json` exits 0 with no ✗ and no ⚠; the
queue is empty at the end; `explain` lists the dequeue order `A, B, C, D, E`.
