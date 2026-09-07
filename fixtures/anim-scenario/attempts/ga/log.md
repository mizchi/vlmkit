# log — modules-ports-adapters (agent ga)

## Kind chosen

`kind: modules` — the guide's kind table is exactly one page (docs/anim-ir.md
"## kind: modules") and it is the only kind meant for "which modules exist,
what depends on what, which belong together" as a *still figure* (no
sequence needed). I did not seriously consider anything else: `diagram` is
the closest alternative but its docs explicitly note the layout is manual
positioning / flow-based, not a dependency layering; `modules` is also the
only kind whose docs literally walk through "the dependency someone keeps
adding by mistake" with `style: "forbidden"` — which is this brief's exact
ask (mark domain → postgres as the mistake). So `modules` was the obvious
and only candidate.

## Round 1 — first check output (verbatim, before any edits)

```
✓ scene.json (modules): 0 error(s), 0 warning(s)
  560ms · 2 steps (1 captioned) · 23 nodes · 0 tracks / 0 keyframes
  scene 874 B → timeline 4074 B (×4.7)
  next: vlmkit-anim explain scene.json · vlmkit-anim render scene.json --step N · vlmkit-anim html scene.json --out page.html
```

Green with 0 errors / 0 warnings on the very first attempt — no round 2 was
needed. 1 round to green. First-attempt ✗ count: 0. First-attempt ⚠ count: 0.

## explain

```
Ports and adapters: dependencies point inward — 2 steps, 560ms, 23 nodes
 1. [    0ms] Ports and adapters: dependencies point inward
 2. [  350ms] (end)
```

Only the compiler-added title/"end" steps — expected, since this scene has
no `sequence` (it is a still figure, per the guide: "modules ... without a
sequence it is a still figure").

## layout

```
0 of 2 frames with layout issues · 0 overlap(s) · 0 clipped · 0 crossed
```

Clean — no text-on-text, no clipped labels, no lines crossing text, in
either of the two compiled frames.

## Coordinates / colours / canvas sizes written by hand

**None.** Every position, box size, canvas dimension, and colour (black
solid arrows for real deps, red dashed for the forbidden one, grey group
outlines) came from the automatic `modules` layout and the default theme.
I wrote only: module ids and labels, the `deps` pairs (semantic — "a depends
on b"), the `groups` (id/label/module-list), and the forbidden edge's own
label text. I deliberately did not set `canvas` — the guide says kinds
"pick a size that fits", and the rendered viewBox (1209×363, auto) shows
that held even with a 7-module, 3-group map and one long label
("In-memory repository (tests)").

## How the forbidden dependency was marked

Exactly as the guide documents it — verbatim from the `## kind: modules`
section: "The dependency someone keeps adding by mistake belongs in `deps`
as `{"from": "domain", "to": "postgres", "style": "forbidden", "label":
"never"}`: it is drawn red and dashed among the real arrows without bending
the layers around it." I used that pattern directly:

```json
{ "from": "domain", "to": "postgres", "style": "forbidden", "label": "never: domain must not import the driver" }
```

The guide told me exactly how, with the exact module names from its own
running example (`domain`, `postgres`) — this brief reads like it was
written to match that passage. Rendered result (`figure.svg`): a red,
dashed arrow from `domain` to `postgres` with the label baked in, distinct
in colour/style from every solid black real-dependency arrow, and — per the
tool's own stated rule that a forbidden edge is "ignored by the layout" —
it does not pull `domain` up into `postgres`'s layer or otherwise disturb
the normal top-to-bottom flow. I hand-checked the emitted SVG coordinates:
the forbidden line's path passes below the `app` box and above the `port`
box without crossing either, so it reads as a distinct, out-of-band arrow
rather than a tangled one.

## Verifying the "domain has no outgoing dependency" requirement

`domain` appears in `deps` only as the `from` of the forbidden edge — no
real (`arrow`/`line`/`dashed`) edge starts at `domain`. The three real
edges into `domain`'s layer are `app → domain`, `app → port`, and the two
adapter → port edges; none originate from `domain`. This is exactly the
"every dependency points inward, the domain depends on nothing outside
itself" requirement from the brief, and `check`'s cycle detector (which
would warn on a real cycle) stayed silent, confirming there is no live
outgoing edge from `domain` for the layout to even consider.

## Things I wanted in the figure and could not express

- There is no way to visually nest "the port belongs to the domain" (an
  interface literally defined inside the domain module) short of putting
  `domain` and `port` in the same `group` — which I did (`core` group holds
  `app`, `domain`, `port` together) but that also pulls in `app`, since
  `groups` is flat (a module is in at most one group, and there is no
  nested-group construct). A finer distinction — "domain and port are
  actually the same conceptual unit, app is merely adjacent to it" — isn't
  expressible; two nested containers would have said this more precisely
  than one flat one.
- I would have liked to underline that Postgres and the in-memory adapter
  are *interchangeable* implementations of the same port (that's the whole
  point of the port/adapter pattern) — e.g. some notation for "these two
  satisfy the same contract" beyond both having a plain edge to `port`.
  `relate` could draw a line between `postgres` and `memory` but that would
  read as "postgres relates to memory" rather than "both implement this",
  which isn't quite the semantics I wanted and I decided not to force it in
  since it risked being misleading rather than clarifying.

## Friction (see final reply for the concise version)

None that blocked completion — this scene went green in one shot. The one
genuine gap is the "these are interchangeable implementations of one
interface" idea above: `modules` has vocabulary for "depends on" and
"belongs in this container" but not for "satisfies the same contract as its
sibling," which is actually the semantic heart of the ports-and-adapters
pattern (why you'd swap Postgres for in-memory in tests) and the figure can
only gesture at it via the shared `port` target, not state it directly.

