# Attempt log — introduce `vlmkit-anim`

## Hand-drawn storyboard (before touching the format)

What I'd actually draw for a 10-second intro slide, beat by beat:

1. Title card: wordmark "vlmkit-anim" + tagline "explain code, checked" fading in.
2. Cut to a tiny code-editor window with a real JSON snippet on screen
   (`{"kind":"sort","values":[5,3,8,1]}`, ~4 lines) — a callout arrow labelled
   "this is the whole file" pointing at it, to sell the smallness.
3. The JSON file flies into a spinning gear icon labelled "compiler".
4. The gear outputs a box labelled "timeline" with a few dots wiggling along
   little tracks — a quick zoom into the keyframe picture.
5. The timeline box fans out on three arrows to three icons: a browser/play
   icon ("plays"), a filmstrip/GIF icon ("renders"), a checkmark/✗ badge
   ("checked").
6. Zoom on the checkmark icon: it flashes a red ✗ with a callout bubble
   "hint: add `algorithm`" — an arrow from that bubble back to the exact
   line in the JSON file from beat 2 (arrow between two pictures).
7. The JSON file reappears with that one line highlighted/edited, a blinking
   text-cursor icon next to it.
8. The loop closes: the checkmark badge turns from ✗ to green ✓.
9. Camera pulls back: all six pieces on screen at once, connected by arrows
   — the whole architecture in one frame.
10. Final beat: big text overlay with the one-line pitch — "Describe what
    you're explaining. Get an animation that checks itself." — wordmark in
    the corner.

## Kind chosen

`kind: diagram`. It is the only kind built for "boxes representing named
things, connected by labelled edges, with a token that flows along an edge
to narrate a step" — exactly the shape of this pitch (scene file → compiler
→ timeline → {browser, frames, check} → back to scene file). No other kind
in the guide models a *pipeline of unlike things*; the rest (sort, array,
stack/queue, list, tree, state-machine, heap, matrix, graph, chart) are all
about one data structure's own operations. `vector` could draw individual
boxes and arrows but demotes everything to raw coordinates, which is what
this format is explicitly for *not* doing at the scene layer, so `diagram`
is the closer fit even before trying anything.

Coverage against the storyboard, guessed before writing JSON:
- Beats 1, 9, 10 (title card, full architecture view, closing pitch line):
  diagram's `title` field + a `note` step give me 1 and 10 directly; 9 is
  just "everything visible" and diagram nodes don't move, so that's free.
- Beats 3–5, 8 (file → compiler → timeline → three outputs, loop closing):
  this is `diagram`'s whole reason to exist — nodes + edges + `flow`.
- Beats 2, 6, 7 (an actual code snippet on screen, a callout bubble tied to
  one line of it, a red ✗ turning into a specific edit): nothing in
  `diagram` draws text *content* beyond a one-line node label — no code
  block, no "this exact substring" callout, no bitmap/icon. I expect to
  have to narrate these in captions instead of showing them. Recorded as a
  finding below once confirmed against `check`.

Single scene, not several — the whole pitch is one connected picture, not
several unrelated things needing a shared index.

## Round 1

Wrote `scene-1.json`: `kind: diagram`, 6 nodes (`scene`, `compiler`,
`timeline`, `browser`, `frames`, `check`), all visible from t=0 (no `hidden`,
so beat 0 already shows the whole architecture — covers storyboard beat 9
for free, but costs beat-1's "just the JSON file alone" reveal-in framing).
Edges: scene→compiler→timeline→{browser, frames, check}, plus check→scene
(the feedback loop) labelled "hint". 6 `flow` ops (one per edge) + 1
`highlight` on `scene` + 1 closing `note` = 8 authored beats, +2 auto
(Start/End) = 10 total, at the brief's stated ceiling.

No `pos`, no `fill`, no `canvas` written by hand — left every coordinate and
colour to the kind's own layout/theme defaults. Zero hand-typed
coordinates/colours in round 1.

Command: `pnpm exec vlmkit-anim check fixtures/anim-scenario/attempts/cc/scene-1.json`

Raw output:
```
✓ scene-1.json (diagram): 0 error(s), 0 warning(s)
  6160ms · 10 steps (9 captioned) · 15 nodes · 9 tracks / 36 keyframes
  scene 1358 B → timeline 5305 B (×3.9)
  next: vlmkit-anim explain ... · vlmkit-anim render ... --step N · vlmkit-anim html ...
```

Green, zero warnings, first try. (File on disk is 1593 B including the trailing
newline; the tool's "scene 1358 B" is the parsed-JSON size it counted, not the
raw file.)

Ran `explain` to read it as a newcomer would, no picture:
```
vlmkit-anim — 10 steps, 6160ms, 15 nodes
 1. [    0ms] vlmkit-anim
 2. [  350ms] One JSON file describes what you're explaining -- a kind, not shapes or coordinates
 3. [ 1050ms] The compiler runs that kind's logic into a timeline: nodes plus keyframe tracks
 4. [ 1750ms] That timeline plays in the browser as a web component
 5. [ 2450ms] ...or renders to frames and a GIF for a README
 6. [ 3150ms] ...or gets checked: does the motion say what the file claims?
 7. [ 3850ms] check fails, names the fix as a hint, you edit -- write, check, read the hint, edit
 8. [ 4550ms] Small file in, self-checking animation out
 9. [ 5250ms] Describe what you're explaining. Get an animation that checks itself.
10. [ 5950ms] (end)
```
Reads as a coherent ten-second pitch on its own. Step 10 `(end)` is the
compiler's auto-appended closing beat (unlike `sort`'s "Sorted: N" it carries
no generated text for `diagram`) — I worried this would visually blank out
my pitch line, so I rendered it.

Rendered frames to check the picture, not just the words:
- `--step 0`: title card only ("vlmkit-anim"), all 6 boxes already on the
  canvas (no `hidden`, so the full architecture is visible from the first
  frame — see "storyboard vs delivered" below).
- `--step 6` (the `timeline->check` flow): boxes laid out
  scene(95,175)→compiler(245,175)→timeline(395,175), then browser(545,85) /
  frames(545,175) / check(545,265) fanned out at three heights to the right,
  the amber token riding the timeline→check edge, the `check->scene`
  feedback edge drawn as one long diagonal from (511,258) back to (154,187)
  crossing behind the middle boxes. Legible but the crossing line means the
  auto-layout does not know it's drawing a cycle back-edge specially — it's
  just the straight line the nodes' positions happen to produce.
- `--step 9` (the auto `(end)` beat): confirms the runtime's actual rule —
  "a step without a caption keeps the previous caption showing" — so the
  *picture* still reads "Describe what you're explaining. Get an animation
  that checks itself." on the last frame. `explain`'s `(end)` label is a
  transcript artifact, not a blank screen. Correcting my own worry: this is
  NOT a real problem, just a place `explain`'s text and the rendered frame
  disagree in a way I had to render to be sure of.

**Result: green on round 1.** Both success criteria met (`check`: 0 ✗ / 0 ⚠;
`explain` reads as a followable pitch). Stopping here per the budget rule —
nothing left to fix.

## Deliverables

**1. Kinds / scenes / rounds / bytes.** One kind (`diagram`), one scene
(`scene-1.json`), 0 ✗ / 0 ⚠ on the first attempt, 1 round to green, 1593
bytes on disk (1358 B by the tool's own count of the parsed JSON).

**2. Coordinate / colour fallback.** None. No `pos` on any node, no `fill`
on any node or edge, no `canvas` override — the diagram kind's `lr`
auto-layout and default theme did everything, including placing the six
boxes in the exact left-to-right pipeline order the pitch needed and giving
the token/edges a consistent default colour. This scene needed zero
hand-typed numbers or hex values.

**3. Storyboard vs delivered.**
- *Survived unchanged*: the pipeline itself (file → compiler → timeline →
  three outputs → check → loop back to file), the closing one-line pitch
  (beat 10 in the storyboard = the `note` step), the "architecture in one
  frame" beat (storyboard beat 9) — got it for free since nothing is
  `hidden`, every box is visible from t=0.
- *Bent to fit*: the title card (storyboard beat 1, meant to be a clean
  wordmark-alone frame) instead opens on the *whole diagram already
  assembled*, title text overlaid — because `diagram` nodes are either
  visible from the start or explicitly `hidden` and `show`n later, and
  spending a beat on "reveal each box" would have blown the 10-beat ceiling
  (6 flows + 1 highlight + 1 note + 2 auto = already at 10). Progressive
  reveal and a full connection tour were mutually exclusive inside the
  budget; I chose the tour.
- *Dropped entirely, and what's missing each time*:
  - Storyboard beat 2 — an actual multi-line **code snippet on screen**
    (the real `{"kind":"sort",...}` text). A diagram node's `label` is one
    line under/inside a box; there is no code-block or multi-line text
    primitive in this kind (the `vector` kind has a bare `text` shape, but
    that's a different kind, and it's still one string, not syntax-shaped
    lines). Had to narrate "a `kind`, not coordinates" in the caption
    instead of showing it.
  - Storyboard beat 6 — a **callout bubble pointing at one specific thing**
    (the red ✗ pointing back at a particular line of the JSON). `diagram`
    has `highlight` (recolours a whole node) and edges with labels, but no
    speech-bubble/annotation primitive distinct from a node or an edge
    label, and no way to point at a *substring* of a label rather than the
    whole box.
  - Storyboard beats 1/10 — a **logo/wordmark image**. Shapes are limited to
    `rect circle ellipse text line arrow path group`; no image/icon
    embedding, so "vlmkit-anim" is rendered as plain SVG text via `title`,
    not a mark.
  - Storyboard beat 9 — a **camera zoom/pull-back**. Nodes don't move in
    `diagram` and there's no canvas-level pan/zoom; `vector` has per-node
    `scale`, but that scales one shape, not "zoom the whole picture out to
    reveal it's all connected." I got the *content* of beat 9 (everything
    visible at once) but not the *motion* of pulling back to reveal it.

**4. How free did it feel?** Freer than hand-drawing shapes and slower than
writing prose. For the *pipeline* half of the pitch — six named things and
how they connect — `diagram` was close to as fast as describing it in
English: name the boxes, name the edges, say which edge to walk when, done,
and the layout/theme decisions I'd normally burn slide time on (where do the
boxes go, what colour is the arrow) were not mine to make at all. But the
freedom is scoped to "boxes and flow between them" — the moment the pitch
wanted to *show* something (the JSON text itself, a pointer from a specific
error to a specific line, the tool's own wordmark) rather than *narrate* it,
I was back to writing a caption and hoping the words carried it, which is
exactly the leverage a hand-drawn slide has and this format doesn't.

**5. One addition.** A `text`/code-block node kind (multi-line, monospace,
optionally with one line highlightable) would carry the most weight — it's
the one primitive that would have let this scene *show* its own JSON file
and its own check-hint instead of only describing them, which is the whole
point of an introduction to a tool that's about *reading files back*.
