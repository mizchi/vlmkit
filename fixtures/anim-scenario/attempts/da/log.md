# log: vector clocks

## Plan (before first check)

**Kind chosen: `distributed`.** Reasoning:

- The story is fundamentally message-passing between three named processes
  (A, B, C) with local events interleaved — that is exactly the "sequence
  diagram" picture `distributed` draws: node boxes across the top, lifelines
  down, messages travelling between them, and `events` for status changes.
- `state-machine` was considered (each process's vector as "state") but
  states there are a fixed enumerable set with transitions between named
  states — a vector clock's state space is unbounded ([1,0,0], [1,1,0],
  [1,1,2], ...) and the *interesting* transitions are cross-process
  (message send/receive), which `state-machine` has no vocabulary for (one
  token, one machine).
- `graph`/`tree`/`heap`/`array`/`matrix`/`sort`/`stack`/`queue`/`list` are
  all about one structure evolving under one algorithm; none has a notion of
  three independent, communicating actors. `distributed` is the only kind
  built around that shape.
- `vector` (the escape hatch) was rejected on principle per the guide's own
  routing table — `distributed` is the closer semantic fit, so I should not
  reach for raw coordinates.

**No first-class "local event" verb in `distributed`.** The kind only has
`messages` (between two different nodes) and `events` (recolor a node's
status, e.g. up/down/leader). A local increment at a single process is
neither. My workaround: model each local event as a `{"note": "..."}`
(captioned pause) immediately followed by a `value` annotation op with
`ms: 0` that updates that process's live vector readout — so the note IS
the "beat" for the local event, and the vector-change is folded into the
same beat via the annotation mechanism the guide describes for exactly this
purpose ("best so far = 10 appear at the moment the reveal it belongs to
happens"). I'm flagging this as a gap already, before running anything:
the guide never says a `note` is an acceptable stand-in for "this one node
did something privately"; it says notes are pauses where "every node
waits" — which is semantically backwards for a *local* event that by
definition does NOT involve other nodes.

**Per-process vector readouts**: three `value` annotation ops, one per
process, `id: "vecA"/"vecB"/"vecC"`, anchored `at: "A"/"B"/"C"` (node id —
per the anchors table, `distributed` anchors are "a node id, a message
label") so each vector is drawn right under its own process box. Updated
in place (same id, new `text`) whenever that process's vector changes —
this is exactly the "named readout... first op with an id creates it; a
later op with the same id updates it in place" mechanic.

**Frozen comparison value**: C's vector changes twice (local event, then
receiving from B), so by the final frame the live `vecC` readout no longer
shows the value at the moment of C's *local* event ([0,0,1]) — but that is
exactly the vector I need later to demonstrate incomparability with A's
event. The guide has a `snapshot` annotation for "the value to compare
against later, after the live one has moved on" — which is precisely this
problem. But `snapshot`'s anchor is a kind anchor (node id for
`distributed`), and nothing in the guide says a `snapshot` of a node
captures a `value` panel bound to that node via `at` — the node itself, in
`distributed`, only carries a `status` (up/down/leader/busy), not a
vector. So it's unclear what `snapshot: {"of": "C"}` would even freeze.
Rather than gamble on undocumented behavior, I'm using a second, distinct
`value` id (`eventC`) created once at the moment of C's local event and
never updated again — the guide's own "first op with an id creates it"
rule means it just... stays, forever, as a manual freeze. Logging this as
a second gap: `snapshot`'s anchor table doesn't say whether it can target
an annotation (`value`) bound to a kind-anchor, only the kind-anchor's own
built-in rendering.

**Ordering claim**: expressed as two final `note` ops that name the
vectors explicitly in the caption text — since `explain` prints every
caption verbatim, this is the most direct route to satisfying "explain of
the last scene names the concurrent pair and the ordered pair with their
vectors" without depending on an annotation whose exact display behavior
I'm unsure of.

**Prediction for `explain`**: I expect roughly 9 numbered lines (7 authored
beats + the compiler's auto Start + auto End), the middle ones reading
something like:
1. Start: ...
2. A = [0,0,0] · B = [0,0,0] · C = [0,0,0]  (or similar joined captions)
3. A: [0,0,0] -> [1,0,0]
4. A sends its vector to B · B receives ... -> [1,1,0]
5. C: [0,0,0] -> [0,0,1] · (eventC caption, if not suppressed)
6. B sends its vector to C · C receives ... -> [1,1,2]
7. Concurrent: A's event [1,0,0] and C's local event [0,0,1] ...
8. Ordered: A's event [1,0,0] <= C's final vector [1,1,2] ...
9. End: ...

I do NOT know yet whether chaining multiple `ms:0` ops back to back (my
init block: note + three `value` inits, all ms:0) merges them all into one
beat or only the first — the guide's own example only ever shows a single
`ms:0` op after one captioned op. Flagging as untested before round 1.
