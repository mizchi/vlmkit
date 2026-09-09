# log — why-figure brief (project-structure.json → structure.json)

## What I read

- `fixtures/anim-scenario/briefs/why-figure.md` (the brief).
- `docs/anim-ir.md` in full (all sections, both pages of the read — the loop,
  the two layers, every `kind`, annotations, `compose`, `still figures`,
  `Asking why`, the diff figure, `check --expect`, TypeScript authoring, the
  Timeline layer, `sheet`/`video`, mermaid import, embedding).
- `fixtures/anim-scenario/briefs/inputs/project-structure.json` (the `diagram`
  scene to fix: 32 nodes, 47 edges, 5 groups, `layout: "tb"`, no `sequence`).
- `fixtures/anim-scenario/briefs/facts/project-structure-facts.expect.json`
  (only `modules` and `deps` — no `groups`, `highlighted` or `forbidden`
  fields, so group/container structure is unconstrained by the facts sheet).

Nothing under `packages/vlmkit-anim/`, `fixtures/anim-scenario/attempts/`,
`docs/reports/` or `CHANGELOG.md` was read, and the repo was not grepped for
examples, per the rules.

## Round 0 — first `check` (no edit yet)

```
⚠ tracks: nothing moves: there are no tracks
⚠ canvas: the canvas is 8882×1037: its width is over 2000px, so on a
  1280×720 screen it shrinks to 14% and labels stop being legible —
  workflow (300px, in cli) and openapi (87px, in api) need 249px between
  their centres (both boxes' halves, a gap, and their containers' paddings)
  and the layout put them 3% of the width apart, so 8806px + 76px of margins
⚠ steps: no step has a caption: the viewer gets motion without narration
⚠ nodes(snapshot): … has a line through it (edge-24, 7px) …
⚠ nodes(inspect): … has a line through it (edge-29, 18px) …
⚠ nodes(labs): … has a line through it (edge-32, 9px) …
⚠ nodes(core): … has a line through it (edge-26, 18px) …
⚠ nodes(capture): … has a line through it (edge-34, 23px) …
⚠ nodes(capture): … has a line through it (edge-42, 14px) …
⚠ nodes(ai): … has a line through it (edge-30, 48px) …
⚠ nodes(ai): … has a line through it (edge-32, 81px) …
⚠ nodes(ai): … has a line through it (edge-33, 30px) …
⚠ nodes(ai): … has a line through it (edge-38, 32px) …
⚠ sequence: no sequence: the diagram is a still image
✓ structure.json (diagram): 0 error(s), 14 warning(s)
```

Canvas **8882×1037**. `vlmkit-anim why` was also run here (not one of the
five rounds — no edit followed it) to read the cause behind the width
warning:

```
width 8882: workflow (300px, in cli) and openapi (87px, in api) need 249px
  between their centres … and the layout put them 3% of the width apart, so
  8806px + 76px of margins
bands — containers side by side, and their share
  cli: a band across 40% of the picture — shares layers with api, packages,
  backends, outputs, the ungrouped …
  api: a band across 10% …  packages: a band across 26% …
  backends: a band across 13% …  outputs: a band across 9% …
  the ungrouped nodes: a band across 3% …
```

All five groups share layers with each other (each group's members are
spread across several layers that other groups also occupy), so every one
of them becomes its own vertical band running the full height, side by
side — that is the guide's "groups that share a layer with something else
each get their own band across the layers" (`docs/anim-ir.md`, `kind:
modules`). With 5-6 bands each only a few percent of the width, the
absolute pixel gap between two boxes in different bands (workflow/openapi,
249px) has to be blown up to fill that tiny percentage, which is what
drives the canvas to 8882px.

## Round 1

**Change:** removed `groups` entirely (flattened all containers).

**What told me:** the `why` bands section quoted above, plus the `check`
canvas line's own hint: `→ bring the width under 2000px: "layout": "tb" or
"lr", shorter labels, or split the scene`. Since the bands (not any single
label) were named as the lever, and the facts sheet has no `groups` field
to preserve, removing them was the highest-leverage single change available.

**`check` after:**

```
⚠ tracks: nothing moves: there are no tracks
⚠ canvas: the canvas is 4615×913: … diff (417px) and snapshot (543px) need
  508px between their centres … and the layout put them 11% of the width
  apart, so 4574px + 40px of margins
⚠ steps: no step has a caption: the viewer gets motion without narration
⚠ sequence: no sequence: the diagram is a still image
✓ structure.json (diagram): 0 error(s), 4 warning(s)
```

**Did it do what I expected?** Yes, and by more than expected: canvas
**8882×1037 → 4615×913** (width nearly halved) and all 10 "line through it"
crossing warnings disappeared as a side effect of the new (unbanded)
layout, leaving only the 4 generic still/sequence warnings.

## Round 2

**Change:** converted the scene's `kind` from `diagram` to `modules`
(renamed `nodes`→`modules`, `edges`→`deps`; no other field changes).

**What told me:** the guide's "Still figures" section, verbatim: *"`check`
does not warn about a missing sequence on `modules`; it does on `diagram`,
where the beats are the point."* Two of the four remaining warnings
(`sequence: no sequence`, and implicitly `tracks: nothing moves`) are about
this scene being a still with no walk, and `modules` is described exactly
as the kind "for when the picture, not the motion, is the explanation."

**`check` after:**

```
⚠ canvas: the canvas is 7031×992: …
⚠ steps: no step has a caption: the viewer gets motion without narration
⚠ nodes(snapshot): … has a line through it (edge-26, 17px) …
✓ structure.json (modules): 0 error(s), 3 warning(s)
```

**Did it do what I expected?** Partially, and it was a net negative on the
axis I actually needed. It did drop `sequence: no sequence` and `tracks:
nothing moves` (2 warnings gone) as hoped. But `steps: no step has a
caption` turned out **not** to be diagram-specific — it persisted under
`modules` too, contrary to my reading of the still-figures note. Worse,
`modules`' own layering algorithm (a module's layer is one below the
*deepest* thing it depends on, computed from the leaves up) packed **12**
nodes into its widest layer instead of `diagram`'s 9, so the canvas got
*wider*: **4615×913 → 7031×992**. This is exactly the "the two levers are
the box pair or the structure that put them that fraction apart" warning
from `why` at work, just triggered by a different layering rule. I reverted
this in round 3 (kept `diagram`, addressed the sequence/caption/track
warnings a different way).

## Round 3

**Change:** three things together:
1. Reverted `kind` back to `diagram` (undid round 2's rename).
2. Wrapped every label line with more than 2 `" / "`-separated tokens onto
   multiple lines (e.g. `diff`'s "html / png / elements / browsers / agent
   / runs" → three lines of two tokens each).
3. Added a `title` and a single-beat `sequence`: `[{"note": "One request
   end-to-end through the CLI, the HTTP API, the workspace packages, and
   the backends/artifacts they use."}]`.

**What told me:** for (1), round 2's regression (above). For (2), the `why`
canvas line naming `diff (417px)` and `snapshot (543px)` as the pair
setting the width after round 1 — those are exactly the two nodes whose
un-wrapped slash-lists were the widest single lines on the canvas. For (3),
the guide's still-figures note: *"A still may still carry a one-beat
`sequence` for emphasis … since `still` renders the last frame"* — used to
give the scene a captioned step without turning it into a real walk.

**`check` after:**

```
⚠ tracks: nothing moves: there are no tracks
⚠ canvas: the canvas is 2044×1031: … inspect (174px) and markup_cli (216px)
  need 223px between their centres … and the layout put them 11% of the
  width apart, so 2004px + 40px of margins
⚠ nodes(openapi): "OpenAPI" has a line through it (edge-18, 17px) at step 1
  (0ms) and 2 later step(s)
✓ structure.json (diagram): 0 error(s), 3 warning(s)
```

**Did it do what I expected?** Mostly. `steps: no step has a caption` and
`sequence: no sequence` both cleared (the one-beat `note` supplied both).
Canvas dropped hard: **4615×913 → 2044×1031** — down to within 44px of the
2000px budget. `tracks: nothing moves` did *not* clear, because a `note` is
a captioned pause with no motion, so there is still nothing on a track —
unexpected only in that I'd hoped the sequence addition alone would cover
all three; it covered two of three. A new, different crossing warning
(`openapi`, `edge-18`) appeared, presumably from node positions shifting as
labels shrank.

## Round 4

**Change:** two things:
1. Shrank `markup_cli`'s label further, splitting every remaining
   `" / "` pair onto its own line (down to one token per line).
2. Replaced the `note` in `sequence` with `{"flow": "user->vlmkit",
   "caption": "<same text as before>"}` — a real motion op (a token
   travelling an existing edge) carrying the same explanatory caption.

**What told me:** for (1), the `why` canvas line quoted above naming
`inspect (174px)` and `markup_cli (216px)` — `markup_cli` was still the
widest box left in the crowded layer. For (2), the exact `check` line
`⚠ tracks: nothing moves: there are no tracks` — a `note` alone is a pause,
not a track, so a `flow` (explicitly a motion op in the `diagram`/`modules`
`sequence` table) was needed instead.

**`check` after:**

```
⚠ canvas: the canvas is 2006×1149: … diff (182px) and snapshot (199px) need
  218px between their centres … and the layout put them 11% of the width
  apart, so 1966px + 40px of margins
⚠ nodes(openapi): "OpenAPI" has a line through it (edge-18, 17px) at step 1
  (0ms) and 2 later step(s)
✓ structure.json (diagram): 0 error(s), 2 warning(s)
  … 3 tracks / 9 keyframes
```

**Did it do what I expected?** Yes on both counts: `tracks: nothing moves`
cleared (the report now shows "3 tracks / 9 keyframes" where before it was
"0 tracks / 0 keyframes"), and canvas width dropped from 2044 to 2006 —
only 6px over budget. The `openapi` crossing was untouched, as expected
(that edit didn't touch anything near it).

## Round 5 (final)

**Change:** two things:
1. Shrank `snapshot`'s label to one token per line (same treatment as
   `markup_cli` in round 4).
2. Reordered the five layer-5 API nodes in the `nodes` list, moving
   `openapi` from the front of that group to the back: `compare_api,
   renderers_api, reason_api, smoke_api, openapi`.

**What told me:** for (1), the `check` canvas line naming `diff (182px)`
and `snapshot (199px)` as the pair still setting the width, 6px over. For
(2), the crossing warning's own hint, quoted exactly: *"an edge runs through
a box that is not one of its ends — **reorder the modules in that layer**,
put the two in one group, or shorten the label so the layout has room"* —
`openapi`'s own label ("OpenAPI") was already short, so reordering (not
shortening) was the named lever.

**`check` after:**

```
✓ structure.json (diagram): 0 error(s), 0 warning(s)
  1260ms · 3 steps (2 captioned) · 81 nodes · 3 tracks / 9 keyframes
  facts project-structure-facts.expect.json: 32 module(s) · 47
  dependencies — all as drawn
```

Exit code confirmed `0`. `vlmkit-anim layout structure.json` on this final
state: `0 of 3 frames with layout issues · 0 overlap(s) · 0 clipped · 0
crossed`. `vlmkit-anim why structure.json` reports the final canvas as
**1805×1149**.

**Did it do what I expected?** Yes: canvas **2006×1149 → 1805×1149**, and
the `openapi` crossing cleared. Both remaining warnings are gone: **0
errors, 0 warnings**, green on the fourth `check` since round 1's baseline
of 14 warnings (five edit→check rounds used, the cap).

## Final state

- `structure.json`: `kind: "diagram"`, same 32 nodes / 47 edges as the
  input and the facts sheet (`check --expect` reports "32 module(s) · 47
  dependencies — all as drawn"), no `groups` (flattened from the input's
  5), most labels re-wrapped to shorter lines, a `title`, and a one-beat
  `sequence` (`{"flow": "user->vlmkit", "caption": "…"}`) so the still
  carries one real, captioned step instead of a walk.
- Canvas: **1805×1149** (both sides under 2000px).
- `structure.svg`: rendered via `vlmkit-anim still structure.json --out
  structure.svg` (final frame, `t=1260`).
- `check … --expect facts/project-structure-facts.expect.json` exits 0
  with 0 errors and 0 warnings; `layout` reports no issues.

## Friction — what I'd have wanted the tool or guide to tell me

The single biggest cost in this task was diagnosing *why* the canvas was
8882px wide, and the answer lived in two places I had to cross-reference by
hand: `check`'s canvas warning names a **pair of boxes and their gap as a
percentage of the width**, but the reason that percentage was only 3% (and
so blew the absolute gap up to thousands of pixels) was that all five
`groups` shared layers with each other and so were each drawn as a thin
side-by-side band — a fact that only `why`'s separate "bands" section
states, and only in the abstract ("a band across 40%... shares layers
with..."), never as "these five groups are why the canvas is this wide."
I had to read the `modules`-kind prose in the guide (bands vs. rows) to
even know that band-sharing was a thing that costs width, then manually
match every group's layer numbers from `why`'s "layers" section to see
that none of the five groups owned an exclusive layer range. A single line
in `check`'s own canvas warning — something like "5 groups share layers
with each other, contributing Npx" the way it already names the two widest
boxes — would have pointed at the actual lever immediately instead of
after a `why` read and a cross-reference.

The second friction point was `kind: diagram` vs `kind: modules`: the guide
does say `check` doesn't warn about a missing `sequence` on `modules`, but
it doesn't say that switching kind also changes the *layering algorithm*
(diagram layers "one past" the thing that points at a node; modules layers
"one below the deepest thing it depends on"), which can pack more or fewer
nodes into the widest layer depending on which rule is used. That cost me
a full round (round 2) that made the canvas worse before I reverted it —
a one-line warning "this kind change altered the widest layer from 9 to 12
nodes" would have caught the regression before I had to run `check` to
find out. Relatedly, the `steps: no step has a caption` warning turned out
to apply to both kinds even though only the `sequence` requirement is
documented as diagram-specific; I inferred the general rule (any still
gets this warning regardless of kind) only empirically, by seeing it
survive the kind change.

Third, smaller: the crossing warning's box-and-edge id (`nodes(openapi):
… edge-18, 17px`) names the affected box but only an opaque numeric edge
id, not its endpoints. `why`'s "detours" section does name edges as
`(from → to)`, but that section wasn't printed alongside the crossing
warning itself, so confirming which two modules `edge-18` actually
connects required a second lookup (in this scene, by position in the
`edges` array: `edge-18` is `diff → core`). Printing `edge-18 (diff →
core)` inline in the `check` warning, the way `why` already does for
detours, would have saved that lookup.
