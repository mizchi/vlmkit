# Re-edit task (v6, graph): a new person joins the network

`graph-bfs.scene.json` is a hand-written breadth-first walk from Ann that
stops when Dan is found at hop 2.

Change request from the author: **add `Fay`, who is friends with `Cat` and
with `Dan`. The walk must now find Dan through the shorter of its two routes
and the narration must mention that Fay was discovered on the way only if
the walk actually reaches her before Dan.** Keep the existing caption style
(every beat says who is being checked and why). Do not use `algorithm`;
keep the ops explicit.

Requirements: `Fay` appears in the picture; every `explore` follows an edge
that exists; the final `path` is the shortest route to Dan; nobody the walk
never reached ends up green.

Success: `vlmkit-anim check graph-bfs.scene.json` exits 0 with no ✗ and no
⚠; `explain` reads as one walk; the final frame shows `Fay` in the unvisited
colour (white) unless your walk visited her.

Write down, before your first `check`, which nodes you expect to be green
at the end and which edges you expect the path to paint.
