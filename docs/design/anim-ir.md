# Explanatory animation IR — design (2026-09-04)

`@mizchi/vlmkit-anim` and `vlmkit-anim`. A declarative format for the
animations an AI produces to explain something to a person: a sorting run, a
state machine's trace, heap operations, messages between distributed nodes, a
concept diagram walked through in beats, or a generic vector tween. This page
records what was decided and why; the writing guide is
[`docs/anim-ir.md`](../anim-ir.md).

## What it is for, and the two properties that matter

The audience of the *output* is a person; the audience of the *source* is an
agent that writes it once and a person or agent that re-reads and edits it
later. Two properties were set as the evaluation criteria before anything was
built, and the subagent loop in `docs/reports/2026-09-04-anim-ir-v*.md`
measures them:

1. **Intent survives re-editing.** Someone opening `scene.json` six months
   later must be able to see what is being explained without playing it.
2. **An agent produces it correctly from little context.** The whole writing
   guide fits in one page; a wrong document gets a diagnostic that names the
   path, the problem, and the fix, so the loop is "read hint → edit → re-run"
   and not "guess".

Everything else (runtime size, browser API choice, layout quality) is in
service of those two.

## Two layers

```
Scene IR  (vlmkit-anim/scene@1)  ──compile──▶  Timeline IR  (vlmkit-anim/timeline@1)  ──▶  <vlm-anim> runtime (SVG + WAAPI)
 what is explained: kind + intent                nodes + keyframe tracks + step markers       ──▶  render-svg (headless frames)
```

- **Scene IR** is `kind`-tagged. Each kind has a domain vocabulary and a
  compiler that *runs the domain* (the sort algorithm, the heap, the state
  table, BFS / Dijkstra over the edge list) to produce motion. Nine kinds:
  sort, state-machine, heap, distributed, matrix, graph, chart, diagram,
  vector. A bubble sort is 112 bytes and expands ~80× into a
  timeline; that ratio is the layer earning its place.
- **Timeline IR** is the flat, dumb, complete description: nodes with initial
  attributes, tracks of absolute-time keyframes per (target, prop), and
  `steps` (chapter markers with captions). It is what plays, samples, and
  diffs. It is authorable but nobody should have to.
- `kind: vector` sits between: Timeline nodes plus a tween list with
  framer-style sequencing (`at: "<"`, `"+200"`) — enough for "generic vector
  animation" without hand-writing keyframes.

Compilers never draw an edge that has to follow a moving node: state and slot
shapes are static and *values* (tokens) move between them. That keeps every
track a plain per-node property, which is what both WAAPI and a headless
sampler handle trivially.

## Why SVG + Web Animations, why a web component, why not Remotion

- Remotion (React + per-frame rendering) is the right tool for video export and
  the wrong weight for a paragraph-sized explanation embedded in a doc.
- SVG gives geometry, text, and arrows for free and is what the concept
  diagrams need; canvas would need its own text layout and hit testing.
- WAAPI (`Element.animate`, `fill: "both"`) means the runtime holds *no*
  interpolation code. Every track is one paused animation and a master clock
  assigns `currentTime` to all of them each frame, so scrub / step / loop are
  trivial and lock-step by construction.
- Ordinary Web Animations on ordinary SVG is what makes `vlmkit check
  animation` see the result as page motion: visible effect, settle time,
  reduced-motion — the same evaluation any page gets. That is the vlmkit
  integration, and it costs nothing.
- Light DOM on purpose, so tooling that walks the document sees the SVG.
- ~7KB, no dependencies, `<vlm-anim src="x.timeline.json">` or inline JSON.

## A standalone tool, not a `vlmkit` subcommand

`vlmkit-anim` is its own binary and the package depends on nothing else in
the workspace (arg parsing and the error printer are the forty lines in
`cli-args.ts`). What it shares with vlmkit is the **evaluation** side, and it
shares that as a consumer: the pages it emits are ordinary SVG + Web
Animations, so `vlmkit check animation` measures them like any page, and the
runtime test proves the two agree. The animation tool does not need
vlmkit's capture, diff or gate plumbing to do its job, and a `vlmkit anim`
verb would have suggested it did. The next step on that axis is to split the
evaluation tooling itself, so that the check a page of animations gets is a
package the animation tool (and anything else) depends on, rather than the
whole of vlmkit.

## Headless sampling is the same arithmetic

`timeline.ts` reimplements CSS easing (named curves + `cubic-bezier` Newton
solve, `step-*`) and per-prop interpolation (vectors, colours, discrete text).
`renderFrameSvg(tl, t)` is byte-deterministic. The Playwright test asserts the
live DOM's `translate` / `opacity` at a step equals the sampler's within 1.5px.
This is what lets `check.ts` read semantics *back from the frame* — the sort
check reads the final bar order by x position rather than trusting the
compiler's bookkeeping.

## Diagnostics as the product surface

`validate.ts` is hand-written rather than JSON Schema so a message can say
`did you mean "rect"?` instead of `not one of enum`, and a dangling reference
can list the ids that exist. Structural, then referential (unknown node, illegal
trace event with the legal events named), then semantic after compile (final
order not sorted, heap property broken, message into a down node not marked
lost, node off-canvas, steps without captions). One diagnostic shape, one CLI
(`check`), one exit code.

## Evaluation loop

`fixtures/anim-scenario/` holds briefs; fresh subagents get only the brief and
`docs/anim-ir.md`, write a scene, and run `vlmkit-anim check` until green.
Recorded per run: first-attempt error count, rounds to green, scene bytes,
semantic verdict, the agent's friction in its own words; plus a re-edit task
(modify an existing scene) measuring whether intent was readable. Fixes come
from the quotes. Reports: `docs/reports/2026-09-04-anim-ir-v*.md`.

What six rounds found (26 agents, Sonnet and Haiku; v3 re-tested v2's two
failures with the fixes in place and both closed — 2/2 re-edits kept the
story's timing without hand re-timing, and the zero-warning state-machine
brief passed on the first attempt with the alternative path narrated):

- **First-attempt correctness saturated immediately**: 9/10 clean from the
  guide or from the one-screen schema sheet alone. That axis is not where the
  IR needs work.
- **Re-edit is where the IR was wrong.** Absolute event times in `distributed`
  drifted silently when a message latency changed (two agents, independently);
  fixed with `after: "<message label>"` anchors and a mid-flight warning. And a
  v1 warning's hint ("mention it in a caption") named a remedy the
  state-machine kind did not have, so a Haiku agent deleted the alternative
  path the brief required to reach zero warnings; fixed with trace items
  (`{"on", "caption"}`, `{"note"}`, `{"goto"}`). Every hint must name a remedy
  that exists in the format — that is now a rule for this package.
- **v4 changed a default from data.** Under list-order timing, 2/2 v3
  re-editors inserted a side branch and unknowingly delayed the main reply.
  v4 ran the same edit in two arms: with the guide's new insertion rule
  (2/2 correct, each by adding explicit anchors) and with a `causal` model
  where a message starts when its sender is free (2/2 correct with zero or
  one anchor; a fresh author predicted every start time). All three causal
  agents preferred it. `causal` is the default; `"timing": "sequential"`
  remains for a single linear chain.
- **v5 asked the v1 question of three new kinds.** `matrix`, `graph` and
  `chart` (grids with row / column ops, traversals generated or hand-written,
  series data) were added to widen what the IR can say. Four fresh agents,
  four briefs, 4/4 clean on the first attempt with every reported guess
  right; all friction was a missing sentence (default caption shapes, colour
  semantics, that `pos` pins compose with `layout`). v6 then re-edited one
  scene of each kind (a pivot swap followed by position-addressed sets, a
  new node that does not shorten the answer, a new series plus a corrected
  value): 3/3 clean, nothing unintended moved, again only doc sentences.
- Vision-model review uses `vlmkit-anim sheet`: one labelled contact sheet per
  animation. Correctness stays with `check`; the sheet is for "does this
  explain it?".

## Not done, deliberately

- No layout engine beyond layered / grid / circle. `pos` pins what matters.
- No edge that follows a moving node (see above).
- No Svelte / typed-TS / Pkl surface yet. JSON is the IR; typed surfaces are
  generators for it and can come once the IR has stopped moving. The `types.ts`
  declarations are already the contract such a surface would target.
- No video *encoder* beyond GIF. `video` writes GIF in-process because flat
  SVG colours fit 256 entries and GIF plays inline everywhere; MP4 / WebM go
  through `ffmpeg` when present and otherwise leave the frames and the
  command. Re-implementing H.264 is not this package's job.
