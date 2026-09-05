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

## Round 1

`pnpm exec vlmkit-anim check fixtures/anim-scenario/attempts/da/scene.json`:

```
✓ scene.json (distributed): 0 error(s), 0 warning(s)
  4080ms · 8 steps (8 captioned) · 21 nodes · 21 tracks / 45 keyframes
  scene 1508 B → timeline 6759 B (×4.5)
```

Clean on the first attempt — 0 ✗, 0 ⚠. The chained `ms:0` block (note +
three `value` inits) DID all merge into step 1, resolving my pre-round
uncertainty: `explain` shows them joined with " · " exactly like the
same-instant rule for two ordinary beats. Good to know for next time: ms:0
chains however long, not just one deep.

`explain` output:

```
Vector clocks: causality without a global clock — 8 steps, 4080ms, 21 nodes
 1. [    0ms] Start: A, B and C each hold a vector [a,b,c] of counters, all zero · A = [0,0,0] · B = [0,0,0] · C = [0,0,0]
 2. [  540ms] A has a local event: it increments its own slot · A: [0,0,0] -> [1,0,0]
 3. [ 1080ms] A sends its vector to B · B receives [1,0,0]: max([0,0,0],[1,0,0])=[1,0,0], then +1 own slot -> [1,1,0]
 4. [ 1680ms] Meanwhile, C has a local event of its own: it increments its own slot · C: [0,0,0] -> [0,0,1] · C's local event (frozen) = [0,0,1]
 5. [ 2220ms] B sends its vector to C · C receives [1,1,0]: max([0,0,1],[1,1,0])=[1,1,1], then +1 own slot -> [1,1,2]
 6. [ 2820ms] Concurrent: A's event [1,0,0] and C's local event [0,0,1] - neither vector is <= the other, so neither happened before the other
 7. [ 3360ms] Ordered: A's event [1,0,0] <= C's final vector [1,1,2] in every slot - A's event happened-before C's receive
 8. [ 3900ms] end
```

Matches the brief's success criterion exactly: `explain` of the last scene
names the concurrent pair (A's `[1,0,0]`, C's `[0,0,1]`) and the ordered
pair (A's `[1,0,0]` ≤ C's final `[1,1,2]`) with their vectors, in the
narration text.

I then rendered specific instants to check *when* a value actually flips —
this matters because the brief demands "the viewer must be able to read
every vector at the moment it changes":

```
--at 1080 .. 1679  → value-vecB still "[0,0,0]"
--at 1680          → value-vecB flips to "[1,1,0]"
```

So the `ms:0` receive-side update snaps at the END of the message's travel
beat (1080→1680ms), i.e. exactly when the dot lands — not at the moment the
message departs. That is the semantically correct instant (max+increment
happens on receipt) and I did not have to do anything to get it; it falls
out of "ms:0 applies inside the previous beat" for free. No round 2 needed
on this scene — the brief's success bar is met on the first attempt.

## Rounds 2-3: pushing past "green" to find friction

Per the task, a clean pass that hides what I couldn't express is
worthless, so I spent the remaining budget probing the two places I'd
flagged as uncertain in the plan, on copies in scratch (not the submitted
scene — both probes below were rejected from the final file, one because
it actively misleads and one because it added nothing over prose).

**Probe A — `group` around two node ids to visually mark the incomparable
pair.** I added `{"group": {"around": ["A","C"], "label": "incomparable"}}`
at the concurrent beat. `check` passed clean (0/0), but the rendered SVG
shows why this is a trap for this scene's layout:

```
<rect x="-244" y="-25.4" width="488" height="50.8" .../>  <!-- centered on B, x=320 -->
```

`around: ["A","C"]` draws ONE bounding rectangle spanning from A's box all
the way to C's — and B sits geometrically in between them in a
`distributed` layout (nodes are laid out left-to-right in the order
declared). The box visually encloses B too, even though B has nothing to
do with the incomparability claim. The validator has no way to know this is
wrong because `group`'s contract is purely geometric ("bounding box of the
anchors"), not semantic ("these two things, and nothing between them"). I
did not adopt this into the final scene.

**Probe B — `callout` anchored at a single node instead.** I tried
`{"callout": {"at": "C", "text": "[1,0,0] vs [0,0,1]: neither <= the other"}}`
to sidestep the bounding-box problem. This also passed clean, and avoids
falsely implicating B — but it doesn't solve the actual problem either: a
callout is a speech-bubble on ONE anchor, so "[1,0,0] vs [0,0,1]" is just
text floating near C's box. There is still no way to draw a visual line or
bracket connecting A's vector readout to C's frozen one — the reader gets
the comparison as a sentence, identical in kind to just using a `note`.
I did not adopt this either — it added an extra beat and a redundant panel
for the same information already in the final two `note` captions.

**Also discovered along the way (my own scripting slip, but revealing):**
`note` items do not accept a `caption` key at all (`unknown key "caption" →
accepted keys: "note", "at", "after", "delay"`) — sensible, since the note
string IS the caption, but worth knowing: you cannot override a note's
displayed text separately from its narrated text, unlike every op verb.

## Stopping point

Budget used: 1 real round on the submitted scene (clean first attempt) + 2
exploratory rounds that improved my understanding but were correctly left
out of the final file. Success criterion met: `check` 0 ✗ / 0 ⚠; `explain`
names both the concurrent and the ordered pair with their exact vectors.
