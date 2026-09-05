# Attempt log — vector clocks

## Before writing anything: kind choice

The brief's core object is "each process keeps a vector `[a,b,c]` of
counters". No kind in the guide is "a vector of counters per named actor
that updates over time" directly — `distributed` is the closest semantic
match for the *process + message* shape (sequence-diagram picture, nodes
= processes, messages = sends) but its `events` field only recolours a
node's `status` (up/down/leader/busy) — there is no way to attach or
update an arbitrary text/value label on a node over time. So `distributed`
can show *that* a message was sent but not *what the receiver's vector
became* legibly attached to that process.

`matrix` turns out to fit better than it has any right to: a vector clock
*is* literally a table — one row per process, one column per counter slot.
`rowLabels: ["A","B","C"]`, `colLabels: ["a","b","c"]`, and `set` ops with
`from` to show the max-then-increment mechanically (a token flies in from
the sender's cell). Row label = "which process it belongs to" is answered
for free (persistent axis label, not tied to opacity/highlight state).

Predicted problem I'm writing down *before* running check: matrix cells
are mutable in place — there is no way to keep an *old* value on screen
next to a *new* one. The brief's closing beat needs C's local-event vector
`[0,0,1]` (true at beat 4) displayed *next to* A's `[1,0,0]` for comparison,
but by the final frame C's cell has moved on to `[1,1,2]`. I expect I will
need a second scene, of kind `vector` (the free-shapes fallback), just to
freeze and juxtapose two historical snapshots side by side for the
"cannot be ordered" / "can be ordered" callout. That means literal x/y
coordinates and hex fills for boxes that are otherwise pure text —
the format's most generic kind, used here for something as basic as
"put two already-known values side by side and label them".

Plan: scene-1.json (`matrix`) narrates the whole causal history to its
final resting vectors. scene-2.json (`vector`) is the closing comparison,
built by hand, restating the two snapshots the brief needs named at the
end (`explain` of the LAST scene must name both pairs — this is why the
comparison has to be its own scene rather than a stray note appended to
scene-1, where the values it needs no longer exist on screen).

Prediction for `explain scene-1.json`: a numbered list starting with the
title step, then one line per `set`/op caption (7 authored beats: A's
local event; B's max-receive; B's own increment; C's concurrent local
event; C's max-receive from B (two slots, two lines); C's own increment),
ending with a compiler-added closing step summarizing the final grid.

Prediction for `explain scene-2.json`: title step, then the two comparison
lines I wrote captions for (2 authored beats — the "≠" symbol reveal rides
uncaptioned on `"<"` so it won't get its own line), then a closing step.

Kinds used: `matrix` (scene-1), `vector` (scene-2). 2 scenes.
