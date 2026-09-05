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

(raw output recorded after running)
