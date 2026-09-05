# Attempt log: intro-vlmkit-anim

## Storyboard (hand-drawn, before touching the format)

A ten-second intro to `vlmkit-anim` for someone who's never seen it. What I'd
draw on index cards:

1. **Title card.** "vlmkit-anim" — one line under it: an explanatory-animation
   tool.
2. **A tiny JSON file appears.** Four lines: `{ "kind": "sort", "values": [5,3,8] }`.
   Caption: this is the whole input — what's being explained, not shapes or
   coordinates.
3. **An arrow from the file to a box labeled "compiler."** Caption: vlmkit-anim
   compiles it.
4. **An arrow from compiler to a box labeled "timeline."** Caption: into an
   absolute-time timeline — nodes, keyframe tracks, step markers.
5. **The timeline box sprouts three arrows, fanning out to three boxes:**
   "plays in the browser," "frames," "GIF." Caption on each: the same timeline,
   three ways to look at it.
6. **A fourth arrow from timeline to a box labeled "check."** Caption: and it's
   read back and checked against what the file claimed.
7. **Cut to a new picture: a small loop diagram.** write → check → (fail) →
   edit → write again → check → (pass) → done. A red X with an arrow pointing
   at the exact line that's wrong appears at the "check" node on the failing
   pass, then disappears on the passing one.
8. **Final card: the one-line pitch,** something like "Describe what's being
   explained. It moves. And it tells you when it's wrong." — held a beat
   longer than everything else.

Beat count on paper: 8 cards, but card 5 is really 3 sub-beats (one per
output) and card 7 is really 4 (check/fail, edit, check/pass, done). So more
like 13-14 real beats if I don't compress. The brief's "ten beats" cap forces
compression — noted as friction up front, before I've written a line of JSON.

## Kind(s) chosen

- **`diagram`** for cards 1-6 (the pipeline: file → compiler → timeline →
  {browser, frames, gif} → check). This is exactly what `diagram` is for:
  nodes + edges + a `flow` token walking them, `show`/`highlight` for
  emphasis, and a `text` annotation (anchored at a node, not coordinates) for
  the JSON snippet on card 2.
- **`state-machine`** for card 7 (the loop). write → check → edit → check →
  done is literally a state machine: states `write`/`check`/`green(final)`,
  transitions carrying the "on" event, and a trace that visits them in
  order. The edge `note` field (`"/ ✗ ...: read hint, edit"`) is exactly the
  hint text I wanted on the "check" node in card 7 — I don't need a callout
  for it.

No single kind carries both a pipeline-of-boxes AND a state-cycle well —
`diagram`'s `sequence` has no notion of "the same node visited twice with a
different outcome" the way a state machine's transitions do, and
`state-machine`'s states aren't really "a compiler" or "a GIF file." So: two
scenes, `scene-1.json` (pipeline) + `scene-2.json` (loop), with `index.md`.
Card 8 (the pitch) becomes the last beat of scene-2 rather than a third
scene — it's the emotional/verbal payoff of the loop, not a new picture.

Storyboard coverage going in: scene-1 carries cards 1-6 whole (no bending
expected — diagram's vocabulary matches this 1:1). scene-2 carries card 7
compressed from 4 sub-beats to 4 trace events (check/fix/check/clean), which
IS the format's native grain for a cycle, so no compression loss expected —
just renamed. Card 8 rides as a trailing `{"note": …}` in scene-2.
Anticipated gap: nothing in the guide places a title card standing alone
before the first picture — `title` is metadata shown at the top throughout,
not a beat of its own. So "card 1" doesn't get a dedicated beat; the title
is just always visible. Will confirm after first render.

## Round 1

Wrote `scene-1.json` (diagram, pipeline) and `scene-2.json` (state-machine,
loop). All nodes in scene-1 start visible (no hidden/show choreography) —
decided against hide/show because the guide only says edges "follow" node
visibility, not whether `flow` itself can reveal a hidden node, and I did
not want to guess undocumented behavior. Simpler and unambiguous: everything
visible from the start, `flow` ops narrate the connections in order.
