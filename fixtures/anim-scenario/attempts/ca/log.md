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

## Round 1

`vlmkit-anim check fixtures/anim-scenario/attempts/ca/scene-1.json`:
```
✓ scene-1.json (matrix): 0 error(s), 0 warning(s)
  4800ms · 9 steps (8 captioned) · 20 nodes · 14 tracks / 52 keyframes
  scene 1019 B → timeline 6342 B (×6.2)
```

`vlmkit-anim check fixtures/anim-scenario/attempts/ca/scene-2.json`:
```
✓ scene-2.json (vector): 0 error(s), 0 warning(s)
  600ms · 2 steps (2 captioned) · 6 nodes · 6 tracks / 11 keyframes
  scene 1365 B → timeline 1876 B (×1.4)
```

Both green with **zero ✗ and zero ⚠ on the first attempt**. No edits needed —
stopping here per the success criterion, but I still ran `explain` and
`render` to confirm the pictures actually say what I intended (the brief
asks for something check cannot verify by itself: "the viewer must be able
to read every vector at the moment it changes").

`explain scene-1.json` — 9 steps, matches my prediction almost exactly
(title, 7 authored beats, one unlabelled compiler-added closing step —
matrix's closing step carries no generated text, unlike sort's "Sorted:"
or queue's "left: …", so `explain`'s line 9 is blank ("(end)"). Minor gap
between kinds: not every compiler's closing step is informative.

`explain scene-2.json` — only 2 steps, both authored. My prediction was
wrong here: I expected a title-step and a closing step the way matrix got
them; `vector` does not add either. So "compilers add a first and last
step" (guide, "Two layers" section) is not true for every kind — `vector`
narrates only the tweens/waits that carry a caption, nothing else. Worth
flagging as a guide statement that has an exception.

`render scene-1.json --step 8` (C's final increment, 1→2): cell text
values are correct at the exact frame (`A=[1,0,0]`, `B=[1,1,0]`,
`C=[1,1,2]` all legible with row labels A/B/C alongside), because
cell text is a discrete property — it snaps rather than tweens, so the
value shown at a step's start IS the value the caption is narrating. Good:
this is the mechanism that actually delivers "read every vector at the
moment it changes."

`render scene-2.json --step 1` (no `--at`): surprising — at the step's
own start time (`data-t="0"`) every box is still `opacity="0"`, i.e. the
frame you get from `--step N` is the *instant the caption begins*, before
its own 300ms fade-in has drawn anything. I had to separately try
`--at 300` (fade settled, boxes visible) and `--at 600` (second pair
visible) to see the actual picture a caption is describing. `render
--step N` alone is not a reliable way to check what a `vector`-kind step
looks like when its content fades in — you need to guess a `--at` deep
enough into the step's own duration. Filed as friction below (deliverable
3), not a `check` failure — the scene is correct, the *verification
workflow* for freeform "vector" content needed extra guessing that
`matrix`/`array`/etc. (whose changes are instant, discrete swaps) never
needed.

No round 2 was needed — nothing to fix.
