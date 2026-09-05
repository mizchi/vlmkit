# Attempt log — agent `ea` — README-v11-distributed

## Expectations written down before the first `check`

- A's vector when it sends (to B): `[2,0,0]` — A now has two local
  increments (`[0,0,0] -> [1,0,0] -> [2,0,0]`) before it sends, so the
  message carries `[2,0,0]` instead of the frozen scene's `[1,0,0]`.
- B's vector after it receives: `max([0,0,0], [2,0,0]) = [2,0,0]`, then
  +1 own slot (index 1) -> `[2,1,0]`.
- B forwards `[2,1,0]` to C. C's own local event is untouched, so C's
  vector at receipt time is still `[0,0,1]` (from its own earlier local
  event). `max([0,0,1], [2,1,0]) = [2,1,1]`, then +1 own slot (index 2)
  -> C's final vector `[2,1,2]`.
- `eventC` (the frozen readout) stays `[0,0,1]` — untouched, per the
  instructions.
- These match the README's stated success values (B ends `[2,1,0]`, C
  ends `[2,1,2]`, frozen readout stays `[0,0,1]`), so the arithmetic
  above was worked out independently before running the tool, then
  checked against the README's numbers as a sanity check — they agreed.

## First `check` run — exact output

```
⚠ nodes(relate-main-0-label): visible node is outside the 964×400 canvas at t=3360 (pos 320, -16)
    → move it, enlarge the canvas, or fade it out before it leaves
⚠ nodes(relate-main-1-label): visible node is outside the 964×400 canvas at t=3900 (pos 320, -16)
    → move it, enlarge the canvas, or fade it out before it leaves
✓ scene.json (distributed): 0 error(s), 2 warning(s)
  4620ms · 9 steps (9 captioned) · 25 nodes · 25 tracks / 56 keyframes
  scene 1796 B → timeline 8101 B (×4.5)
  next: vlmkit-anim explain fixtures/anim-scenario/attempts/ea/scene.json · vlmkit-anim render fixtures/anim-scenario/attempts/ea/scene.json --step N · vlmkit-anim html fixtures/anim-scenario/attempts/ea/scene.json --out page.html
```

Count: **0 ✗, 2 ⚠** on the first run.

This came from the two `relate` ops (the `∥` line, then the `≤` arrow)
both anchored `"from": "A", "to": "C"` while `B` sits between them in
the `nodes` array — the guide says exactly this triggers the
"run beside the pair, level, on the side with room" behavior, and here
"the side with room" picked *above* the node row, where there wasn't
actually room (the label rendered at y = -16, above the canvas top,
overlapping/exceeding the title area).

## Rounds to green

**3 rounds** (first check above was not green; two edits later it was):

1. Round 1: added the second local event + both `relate` ops with
   `nodes: ["A", "B", "C"]` unchanged → 0 ✗, 2 ⚠ (off-canvas labels), as above.
2. Round 2: tried the warning's own suggested fix literally — added an
   explicit `"canvas": {"width": 964, "height": 480}` (taller). Result:
   **still 2 ⚠, same `pos 482, -16`** (canvas width even auto-grew to
   1288 to fit the widened panel, but the y-offset of the relate label
   did not move at all). Enlarging the canvas turned out to only add
   room at the *bottom* of the diagram — the node row itself sits at a
   fixed y regardless of canvas height, so the warning's first-listed
   remedy ("enlarge the canvas") does not fix an above-the-top overflow
   for this kind. Confirmed this by rendering the SVG for the step and
   diffing `node-A`'s literal `transform="translate(161 60)"` before and
   after bumping height from 400 to 900 in a scratch copy — identical.
3. Round 3: reordered `nodes` from `["A", "B", "C"]` to `["A", "C", "B"]`
   so A and C become adjacent columns and B (the bystander) moves off to
   the side — this removes the "something sits between them" condition
   the guide names, so `relate` draws edge-to-edge, level with the node
   row, instead of routing around a bystander. Dropped the manual
   `canvas` override (back to the kind's default sizing). Result:
   **0 ✗, 0 ⚠.**

## Final `explain` output

```
Vector clocks: causality without a global clock — 9 steps, 4620ms, 25 nodes
 1. [    0ms] Start: A, B and C each hold a vector [a,b,c] of counters, all zero · A = [0,0,0] · B = [0,0,0] · C = [0,0,0]
 2. [  540ms] A has a local event: it increments its own slot · A: [0,0,0] -> [1,0,0]
 3. [ 1080ms] A has a second local event: it increments its own slot again · A: [1,0,0] -> [2,0,0]
 4. [ 1620ms] A sends its vector to B · B receives [2,0,0]: max([0,0,0],[2,0,0])=[2,0,0], then +1 own slot -> [2,1,0]
 5. [ 2220ms] Meanwhile, C has a local event of its own: it increments its own slot · C: [0,0,0] -> [0,0,1] · C's local event (frozen) = [0,0,1]
 6. [ 2760ms] B sends its vector to C · C receives [2,1,0]: max([0,0,1],[2,1,0])=[2,1,1], then +1 own slot -> [2,1,2]
 7. [ 3360ms] Concurrent: A's second event [2,0,0] and C's local event [0,0,1] - neither vector is <= the other, so neither happened before the other
 8. [ 3900ms] Ordered: A's event [2,0,0] <= C's final vector [2,1,2] in every slot - A's event happened-before C's receive
 9. [ 4440ms] end
```

B ends `[2,1,0]` (step 4), C ends `[2,1,2]` (step 6), the frozen readout
stays `[0,0,1]` (step 5, unchanged from the original scene) — all three
match the README's success criteria.

## How the final-frame criteria were verified

Ran `vlmkit-anim render scene.json --step N --out <f>.svg` for steps 7,
8 and 9 (the last, "end") and grepped the two `relate-main-*` groups in
each SVG:

- Step 7 (the concurrent claim's own beat): `relate-main-0` (the `∥`
  line) has no `opacity` attribute (i.e. visible); `relate-main-1` (the
  `≤` arrow) has `opacity="0"`.
- Step 8 (the ordered claim's own beat) and step 9 (the final "end"
  frame): reversed — `relate-main-0` (`∥`) carries `opacity="0"`,
  `relate-main-1` (`≤`, `data-shape="arrow"`, with `marker-end`) has no
  opacity attribute, i.e. it is the one on screen.

So the final frame (step 9) shows only the `≤` arrow between A and C,
and the `∥` line is faded to invisible but still present in the timeline
— matching the guide's "replaced annotations are faded out, not
deleted; read opacity, not presence" rule, and the README's "the arrow
replaces the line — one should be visible at a time."

## Friction — verbatim, unsoftened

- **The single biggest friction: the warning's own suggested remedy was
  wrong for this case, and nothing in the guide told me that.** The
  `check` warning says `→ move it, enlarge the canvas, or fade it out
  before it leaves`. "Move it" isn't available (annotations take no
  coordinates, by design, and the guide is explicit and proud of that).
  I tried "enlarge the canvas" first because it's the only one of the
  three suggestions that's expressible in the scene format at all — and
  it did *nothing*: the node row's y-position is apparently a fixed
  constant independent of `canvas.height`, so a taller canvas only adds
  slack at the *bottom*, never above the node row. I only discovered
  this by rendering an SVG frame and diffing the literal `translate(...)`
  coordinate of `node-A` between a height-400 and a height-900 scratch
  copy — the guide gives no way to know this without dropping to raw
  SVG inspection, which is exactly the kind of implementation-detail
  digging the guide's own workflow (`check` → `explain` → edit) is
  supposed to make unnecessary.

- **The actual fix (reordering `nodes` so the bystander isn't between
  the two `relate` anchors) is not documented as a lever at all.** The
  "Anchors by kind" / annotations section says a `relate` between two
  anchors with something between them "runs beside the pair instead,
  level, on the side with room, so the bystander is never crossed" —
  this describes the *symptom* (routes around) but never says (a) that
  "the side with room" can pick a side where there manifestly isn't
  room, causing an off-canvas warning that has no in-format fix besides
  removing the obstruction, or (b) that node/element *ordering* in the
  scene's own array is the practical way to control which anchors count
  as adjacent for this purpose. I only tried it because it was the one
  remaining thing I could change that plausibly affected "what's
  between A and C," and it worked on the first try — but that was
  closer to luck than to something the guide taught me.

- **No indication of which "room" calculation actually runs.** Is it
  based on canvas dimensions, on other annotations already occupying
  space, on the node row's fixed offsets? I never found out; I only
  found what didn't move (canvas height) and what did (node order). A
  one-line addition to the `relate` doc — "controlled only by node
  order in the scene, not by canvas size" — would have saved two of my
  three rounds.

- **Smaller: the `relate` schema help text (`vlmkit-anim schema --kind
  annotations`) and the full guide (`docs/anim-ir.md`) both show
  `relate` with `label: "A ≤ B"` as an example, which was reassuring for
  getting the `≤`/`∥` unicode characters into a label — no escaping
  issue, they just worked as plain UTF-8 in the JSON string. No friction
  there, just noting what *did* work smoothly.**

- **Also smaller: getting two `relate` ops to "replace" each other by
  both omitting `id` (so both default to `"main"`) worked exactly as
  documented on the first try** — "the second replaces the first (that
  is how to retire `A ∥ C` for `C ≤ A`)" is literally the sentence that
  described my exact use case, which was the one part of this task the
  guide anticipated precisely.

- **Minor ambiguity I had to resolve by guessing:** the README says "A
  has a second local event before it sends to B... a `value` update on
  `vecA`, in the existing style, with a caption in the existing style."
  It doesn't say whether the preceding `{"note": "..."}` (which the
  first local event has, in the frozen scene) is part of "the existing
  style" that must be copied too, or whether only the `value`+`caption`
  pair is required. I guessed "yes, copy the note too" for visual/
  narrative consistency with the first event, since the frozen scene
  never introduces a value-with-caption change without a preceding note.
  This wasn't flagged by `check` either way, so I can't tell if it was
  the "intended" reading — the README's own success criteria don't
  test for it.
