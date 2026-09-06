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
  table, BFS / Dijkstra over the edge list) to produce motion. Fourteen
  structural kinds: sort, state-machine, heap, distributed, matrix, graph,
  chart, diagram, vector, plus array (pointers, windows), stack, queue, list
  and tree (BST); and `compose`, which puts several of them in one canvas. A
  bubble sort is 112 bytes and expands ~80× into a timeline; that ratio is the
  layer earning its place.
- **Annotations** are the layer v9 showed was missing: six ops (`value`,
  `callout`, `snapshot`, `group`, `text`, `relate`) every kind accepts in its own op
  list, addressing the kind's own things by **anchor** names each compiler
  registers (an index, a cell `"r,c"`, a node id, a state, a value) rather than
  by coordinate. The Builder draws them — a readout panel that widens the
  canvas only when used, a pointer box beside an anchor, a frozen copy of what
  an anchor showed, an outline around several, a multi-line block with one
  line highlighted, a labelled arrow between two anchors (v10's one remaining
  ask: where a group would enclose a bystander, `relate` names the pair; when
  the straight line would cross something else it runs beside the pair along
  their dominant axis, on the side with more free space) — so a compiler's whole involvement is one `annotate()`
  call at the top of its loop and a handful of `anchor()` registrations. A
  misspelt anchor is a compile-time diagnostic that lists the anchors that
  exist. Nothing here draws what `vector` could not; the point is that a
  writer never types a number.
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

`vlmkit-anim` is its own binary and, to write animations, the package depends
on nothing else in the workspace (arg parsing and the error printer are the
forty lines in `cli-args.ts`). What it shares with vlmkit is the **evaluation**
side, and that side is now its own package: `@mizchi/vlmkit-animation-eval`
holds the frame-sampled measurement (`runAnimationEval` — pause every Web
Animation, seek deterministic sample points, screenshot, derive issues) that
used to live inside `vlmkit-markup`. `vlmkit check animation` is that report
behind the gate runner; `vlmkit-anim eval page.html` is the same report behind
the animation tool, loaded as an optional peer so a writer who never measures
installs nothing extra. The evaluator depends on `vlmkit-core` (page load,
browser launch, PNG) and Playwright, not on capture, diff or gate plumbing;
two shared helpers it needed (`stable-selector`, `rule-prose`) moved into core
for the same reason. The runtime test proves the two sides agree: the pages
`vlmkit-anim` emits are ordinary SVG + Web Animations, and the evaluator sees
their motion as page motion. A `vlmkit anim` verb would have suggested the
tool needed the rest of vlmkit; it does not, and now neither does the
measurement.

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

What eight rounds found (35 agents, Sonnet and Haiku; v3 re-tested v2's two
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
- **v7 added `array` and `tree` and ran both axes at once.** A hand-written
  Lomuto partition (22 pointer beats), a BST lesson with a predicted
  7-comparison search, and two re-edits (retarget a pointer walk; turn a
  leaf delete into a two-children delete and predict the successor): 4/4
  clean, every prediction exact, doc sentences only.
- **v8 caught a compiler defect through a writer's refusal to accept a
  warning.** `stack`, `queue` and `list` landed; 5/5 first-attempt correct,
  but two list scenes carried ⚠ about "a track that changes nothing" that
  the documented ops could not remove. One agent proved the rule with scratch
  scenes; the compiler was re-setting arrow opacity on every relink. Fixed,
  and a second rule joins "every hint must name a remedy that exists":
  **every warning must be about the scene** — a diagnostic the writer cannot
  act on is a compiler bug. The first `vector` re-edit (a progress bar's
  pause becoming a stall) matched every predicted coordinate.
- **v9 asked the other question and found the format short.** Five writers,
  no kind named, explaining a concept (vector clocks, HTTP/2 multiplexing),
  introducing the tool itself, and a paper submitted three days earlier
  (*Batched Pandora's Box*, arXiv 2609.04059). Every brief was met and `check`
  was nearly silent, but 3 of 8 scenes fell back to `vector` with 52
  hand-typed positions and 30 colours between them — two of them only to put
  two known values side by side. Nobody asked for a Pandora kind; the asks
  were generic and repeated across briefs: a value label that tracks a
  number next to its owner (three writers), two panes at once (three writers
  wrote two scenes for want of it), a frozen snapshot of an earlier value, a
  code block and a callout, a group outline. That fixes the next build: an
  annotation layer for every kind, then `compose` — and the measure of both
  is the same five briefs with the fallback count at zero.
  `docs/reports/2026-09-05-anim-ir-v9.md`.
- **v10 re-ran the same five briefs with both layers in place.** Fallback
  went from 3 of 8 scenes to 1 of 7, and the one left is the smaller model
  choosing `vector` before reading the annotation sheet, on the brief where
  the larger model used `group` and `value` and typed nothing. The round's
  one refused annotation was the round's one bug (the `diagram` validator's
  action list had not been extended), now under a test that appends a
  `value` to every kind's example. The asks changed shape — five different
  things from one writer each, where v9's were three things from several —
  and the cheapest of them, a labelled relation between two anchors, is the
  one shape the annotation layer still lacks.
  `docs/reports/2026-09-05-anim-ir-v10.md`.
- **v11 re-edited the annotated scenes** after `relate` landed: an extra event
  upstream of three `value` readouts, a cheaper box that moves two readouts
  and the decision arithmetic, a receive that retires `A ∥ C` for `C ≤ A`.
  Every dependent literal was updated by every writer and two of three were
  green on the first `check`; the annotations survive a data change because
  they are addressed by id and anchor, not by position. What the round found
  was layout, all of it the compiler's: a `relate` beside a node row with the
  title above and the lanes below went off the canvas, and the warning's
  "enlarge the canvas" did nothing because annotations take no coordinates
  (the writer's way out was to reorder the nodes — the wrong lever); a title
  wider than the kind's canvas lost its first letters; a group label sat on a
  column header; long captions were clipped. Each is now the compiler's job:
  the relation arcs over the bystander when no side has room, the title is
  re-centred or the canvas grows, the label takes the next free corner,
  captions wrap, and the off-canvas hint for an annotation node names levers
  that exist. Two guide gaps closed from quotes: the default id is `"main"`
  and a replaced annotation fades out rather than disappearing.
  `docs/reports/2026-09-05-anim-ir-v11.md`.
- **v12 read the frames two ways and compared them.** A deterministic layout
  reading (`layout.ts`: texts on texts, texts under a filled box not their own,
  texts past the edge, at every step, from the compiled timeline) and a
  vision reader on the contact sheet (`review.ts`: the brief, the JSON, the
  frame-level score against the geometry). Run on the v11 scenes as the
  previous compiler drew them, the geometry found 27, 42, 4 and 4 overlaps —
  every one an annotation placed exactly where it was asked, on top of
  something already there — so annotations now take the nearest free spot
  (other sides, one box further out, the panel, a taller canvas) and every
  fixture reads clean. The readers: the larger model saw every frame the
  geometry flagged on the two dense sheets (recall 1.0, one extra finding the
  geometry cannot make: a highlight ring turning a `0` into an `O`) and none
  on the two sparse ones, where the defects are 12px labels on a 400px tile.
  Re-read at 640px tiles, the sparse matrix sheet went to recall 1.0 and the
  reader described the defects in the geometry's own terms; the two-glyph
  `∥` / `≤` labels on the distributed sheet still went unseen, and that reader
  found the round's second thing geometry cannot: a message sampled at the
  start of its beat is an arrowhead with no line (fixed: the head appears
  with the stroke). The smaller model reported every sheet clean. Geometry is
  the gate; the sheet is the second opinion, at a tile size the labels survive.
  `docs/reports/2026-09-05-anim-ir-v12.md`.
- Vision-model review uses `vlmkit-anim sheet`: one labelled contact sheet per
  animation. Correctness stays with `check`; the sheet is for "does this
  explain it?".

## Scenes generated, not written: the tool drawing itself and its pull requests

`vlmkit-anim repo` and `vlmkit-anim pr` (`generators/git.ts`) produce
`diagram` scenes from the repository: the workspace's packages layer by layer
from their manifests, and the change map of `base..head` — one beat per
commit, the *areas* it touched lighting up (a package's `src`, its fixtures,
`docs/reports`, `tests`, `ci`; more than fourteen fold into "other"), import
edges between changed areas as they stand at `head`, and `value` readouts
counting files and lines. Areas rather than files because a reader can take in
a dozen boxes and not eighty; the caption per beat is the commit subject, so
`explain` reads as the branch's story.

Each run writes the scene next to the images, so the picture stays editable:
the generator's job is a first cut a person can retitle or re-cut with the
same tool. The `pr-visual` workflow runs `pr` on every same-repo pull request,
publishes GIF and sheet on the `pr-visuals` branch and keeps one comment on
the PR current — a reviewer sees the shape of a change before the diff.
`docs/diagrams/vlmkit-architecture.*` is the `repo` output for this
workspace, regenerated by `pnpm anim:diagrams`.

Two compiler consequences came out of making the generated pictures legible
on a contact sheet: `diagram` highlights recolour instantly and a `show` puts
its step marker at the end of a short fade, so the frame *at* a step shows
what the caption names; and `"ms": 0` on the diagram's own ops folds them into
the surrounding beat, which is how "these areas appear and light up" is one
beat rather than two.

## Not done, deliberately

- No layout engine beyond layered / grid / circle. `pos` pins what matters.
- No edge that follows a moving node (see above).
- No Svelte / Pkl surface. JSON is the IR; typed surfaces are generators for
  it. The one that exists is the smallest possible: `scene.<kind>({ … })` in
  `author.ts` fills in `format` and `kind` over the `types.ts` declarations,
  and the CLI `import()`s a `.ts` / `.mjs` module's default export in place of
  a file. It adds nothing to the format — a misspelling becomes an editor error
  instead of a `check` error, and `sceneJson` writes the JSON back out.
- No video *encoder* beyond GIF. `video` writes GIF in-process because flat
  SVG colours fit 256 entries and GIF plays inline everywhere; MP4 / WebM go
  through `ffmpeg` when present and otherwise leave the frames and the
  command. Re-implementing H.264 is not this package's job.
