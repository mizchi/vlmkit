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

`check scene-2.json` (state-machine): **0 ✗, 0 ⚠ first try.**

`check scene-1.json` (diagram, first draft — used a `{"text": {...}}`
annotation op anchored at the `file` node to put the tiny scene JSON on
screen, per "Five ops every kind accepts in its own op list ... next to its
own verbs" and the anchors table listing `diagram | a node id, an edge
a->b"`):

```
✗ sequence[0]: a step needs exactly one action key, found none
    → one of "show", "hide", "highlight", "unhighlight", "flow", "note", "relabel"
✗ sequence[0].text: unknown key "text"
    → accepted keys: "show", "hide", "highlight", "unhighlight", "flow", "note", "relabel", "caption", "ms"
```

**Finding**, confirmed by isolated probes (not source-reading — three tiny
throwaway scenes fed straight to `check`): none of the five documented
annotation ops (`value`, `callout`, `snapshot`, `group`, `text`) are
accepted inside `kind: diagram`'s `sequence`. `array`'s `ops` accepted the
identical `text` op with 0 errors in the same test. So the guide's "every
kind" is wrong for at least `diagram` — its `sequence` schema is a closed
list (`show/hide/highlight/unhighlight/flow/note/relabel`) with no
annotation escape hatch, even though the Annotations section's own anchor
table lists `diagram | a node id, an edge "a->b"` as if it worked there.
This directly cost me the one thing the brief asked to try putting on
screen ("a code snippet ... could not"): I wanted the four-line scene.json
on the canvas next to the `file` box, and the format has no way to do that
for a diagram. Fallback per the task rule ("choose the closest thing the
guide does offer"): folded the snippet into the caption as prose
(`highlight: "file"` with the JSON written out in the caption string)
instead of drawing it. Not the same thing — a caption is read, a code block
is looked at — but it is what a diagram-kind scene can do.

## Round 2

Replaced the `text` op with `{"highlight": "file", "caption": "One JSON
file — { kind: \"sort\", values: [5, 3, 8] } — what is being explained, not
shapes or coordinates"}`.

```
✓ scene-1.json (diagram): 0 error(s), 0 warning(s)
  5460ms · 9 steps (8 captioned) · 21 nodes · 9 tracks / 36 keyframes
  scene 1304 B → timeline 6053 B (×4.6)
```

Both scenes green. Stopped here (2 of 4 rounds used).

## Verification (render)

- `render scene-1.json --step 2`: auto-layout (no `pos` anywhere) placed
  file/compiler/timeline in a horizontal row and fanned `html`/`frames`/
  `gif`/`check` out vertically from `timeline` — exactly the fan-out the
  storyboard called for, with zero coordinates written by hand. `--step 2`
  landed too early inside the highlight's colour transition (fill still
  `#ffffff`); `--at 500` (mid-beat) showed the accent fill (`#f6ab2b`)
  correctly — a reminder that `--step N` samples the *instant a step
  begins*, per the guide, and a still-animating property needs `--at`
  deeper into the beat to see the settled colour.
- `render scene-2.json --step 5`: three state circles left-to-right, `green`
  carries the extra outer ring (`final: true`), current state (`check`) is
  amber-filled with the token sitting on it. Matches the guide's described
  state-machine picture exactly.
- `explain` on both (see below) reads as a small pitch deck end to end.

## explain output (both scenes)

```
vlmkit-anim — 9 steps, 5460ms, 21 nodes
 1. [    0ms] vlmkit-anim
 2. [  350ms] One JSON file — { kind: "sort", values: [5, 3, 8] } — what is being explained, not shapes or coordinates
 3. [ 1050ms] vlmkit-anim compiles it
 4. [ 1750ms] into an absolute-time timeline: nodes, keyframe tracks, step markers
 5. [ 2450ms] It plays in the browser as a web component
 6. [ 3150ms] renders to individual frames
 7. [ 3850ms] and encodes to a GIF for a README
 8. [ 4550ms] The same timeline is read back and checked against what the file claims
 9. [ 5250ms] (end)

The loop: write, check, read the hint, edit — 7 steps, 5460ms, 12 nodes
 1. [    0ms] Start in "write"
 2. [  560ms] on check: write → check
 3. [ 1540ms] on fix: check → write / ✗ index 2 is out of order: read the hint, edit
 4. [ 2520ms] on check: write → check
 5. [ 3500ms] on clean: check → green / no ✗, no ⚠
 6. [ 4480ms] One line: describe what is being explained. It moves. And it tells you when it is wrong.
 7. [ 5110ms] End in final state "green"
```

Second finding, minor: the guide says compilers add a captioned last step
("Sorted: …" / "End: …"). `diagram`'s auto-final step (line 9 above) prints
bare `(end)` — no substantive caption, unlike `sort`'s or the
state-machine's own `End in final state "green"`. Diagram has no notion of
a terminal value to report, so there is nothing wrong with the *behavior*,
but it is a second place the guide's blanket "every kind" claim about the
closing step doesn't hold literally.

