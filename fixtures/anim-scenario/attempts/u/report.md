# Attempt u — graph-friend-of-friend, explicit ops (haiku)

- First-attempt errors: 0 ✗. Warnings: 0 ⚠. Rounds to green: 1. Scene: 1469 bytes.

Success criteria met: check exits 0; final frame shows the path Ann → Bob → Dan → Fay in the done colour; all six people reachable, no unreached person coloured as visited. Green nodes at end: Ann, Bob, Cat, Dan, Eve, Fay. Path edges (green): Ann→Bob, Bob→Dan, Dan→Fay. Narration traces BFS: Ann (hop 0), Bob and Cat at hop 1, Dan and Eve at hop 2, Fay at hop 3 via Dan. Caption: "FOUND! Fay at hop 3 - reachable from Ann in 3 hops".

What helped: op types are intuitive — `visit` for current node, `explore` for edge traversal, `label` for distances, `path` for the answer — they map directly to BFS steps; captions on every beat; explicit ops let you script exactly what BFS does without guessing compiler behaviour.

What was missing or confusing:

1. Visit colour semantics unclear: guide says "visit = current (accent, larger) then visited (green)" — accent colour not shown; unclear if `visit` automatically greens a node or is temporary. The sentence "`visit: id` (current = accent and larger, then stays green)" is buried in the syntax table. Should expand with before/after appearance and clarify that accent is temporary.
2. Path vs visit distinction: guide doesn't clarify whether applying `path` after `visit` leaves visited nodes outside the path coloured or uncoloured. Missing: "When you apply `path`, nodes on the path stay green; nodes visited but off the path also remain green."
3. Narrative mechanics fragmented: "`caption` on an op **replaces** the generated caption" is only in the prose, not in the syntax table where a user reads.
4. Unvisited node colour not shown: the brief's negative constraint ("no person never reached is coloured visited") has no anchor in the guide. Missing: "Nodes you never `visit` stay default; only `visit` and `path` produce green."

Guesses (all correct): `visit` makes nodes green and keeps them green; `explore "a->b"` animates a token along the edge; `label` places hop-count text under nodes; `path` highlights path nodes and edges in the done colour; BFS visits all six people in this graph.

Conclusion: the guide is sufficient for the task. Minor friction points are in colour semantics (accent vs visited vs done) and narrative conventions (caption vs note) — both easily resolved by trying the tool and observing output.
