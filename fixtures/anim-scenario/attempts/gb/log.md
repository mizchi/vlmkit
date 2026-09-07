# Log — depgraph-import-cycle (agent gb)

## Kind chosen
`modules` — this is exactly "a module map for when the picture, not the
motion, is the explanation: which modules exist, what depends on what" from
docs/anim-ir.md. The brief wants a still figure, `modules` without a
`sequence` is documented as being written for exactly that (I did end up
adding a one-beat `sequence` purely to recolour the cycle's edges — see
below — but the figure is still read at its final/only frame with `still`).

## Module count vs. the brief's "nine modules"
The brief says "Draw all nine modules and every import." Counting distinct
identifiers across the 9 `imports` lines gives **11** modules: server,
router, config, logger, handlers, middleware, services, validation, auth,
events, repo. Only 9 of those ever appear on the *left* side of an "imports"
line (config and logger are pure leaves, imported but never importing
anything) — that is almost certainly what "nine" refers to, but the sentence
reads as if it's the total node count. I drew all 11, because config and
logger are load-bearing nodes (repo, server, middleware, auth and validation
all point at them) and omitting them would mean edges pointing at nothing.
Recorded here since the brief's own count doesn't match the data it gives.

## Cycle, by hand vs. by the tool
I traced the cycle myself while reading the import list, before writing any
JSON: `handlers → services → events → handlers` (services also depends on
`repo`, which is a dead end, not part of the cycle). So I found the cycle
**before** the tool did. Running `check` on the very first draft confirmed it
independently and named the exact same three edges — see the verbatim first
run below. It also told me something I had not consciously decided yet: that
the layout would resolve the cycle by "cutting" it at `events → handlers`
and drawing that one against the flow. I had already put my own
"cut here" label on that exact edge for unrelated reasons (it read to me as
the odd one out — events flowing back into a module two hops upstream of
it), so the tool's automatic choice matched my manual one. That was a useful
confirmation but not new information.

## First `check` run (verbatim, before any edits)

```
$ pnpm exec vlmkit-anim check scene.json
⚠ deps: dependency cycle: handlers → services → events → handlers
    → the layout cuts it at "events → handlers" and draws that arrow against the flow — keep it if the cycle is the point, else break it, or mark the edge to remove with "style": "forbidden"
✓ scene.json (modules): 0 error(s), 1 warning(s)
  1260ms · 3 steps (2 captioned) · 31 nodes · 4 tracks / 8 keyframes
  scene 806 B → timeline 6083 B (×7.5)
  next: vlmkit-anim explain scene.json · vlmkit-anim render scene.json --step N · vlmkit-anim html scene.json --out page.html
```

This is already a 0-error / 1-warning result. I kept the ⚠ deliberately —
the brief's whole point is the cycle, so I did not mark the edge
`"style": "forbidden"` (which would have hidden it from the cycle check) or
delete it. This is the "warning is acceptable if your log says which one
and why you kept it" case named in the brief's success criteria.

## Rounds

**Round 1** (the draft above) — `check`: 0 errors, 1 warning (the cycle
warning, kept deliberately, see above). `layout scene.json`:

```
0 of 3 frames with layout issues · 0 overlap(s) · 0 clipped · 0 crossed
```

No round 2 was needed — nothing to fix. I read the produced `cycle.svg`
(see "Looking at the SVG" below) rather than stopping at the green check,
since a 0/0 result only proves no *text* collides with anything; it says
nothing about whether the edges read as a graph. Total rounds used: 1 of
the 6 budgeted.

## What the layout actually did with the cycle

The three cycle edges (`handlers→services`, `services→events`,
`events→handlers`) are the ones I highlighted amber in a one-beat
`sequence` (the only way `modules` exposes edge colour — there's no per-dep
"colour" field, only `style: arrow|line|dashed|forbidden`, none of which is
a colour). The auto-layout, independently of my highlighting, placed
`events` in the **bottom layer** next to `config`/`logger` (its only
non-cycle edge is `services → events`, one layer below `services`; the back
edge `events → handlers` is excluded from layer placement per the tool's
own note above) and then drew `events → handlers` as one long path running
back up across almost the whole canvas — from (410, 659) up to (137, 374).
That single long backward stroke, on top of being amber, is what actually
makes the cycle jump out "at a glance": two short forward-looking amber
edges near the middle of the graph, and one long amber line running the
wrong way from the bottom back to the middle. I did not have to engineer
that distinctiveness — it fell out of asking for `["a","b"]` deps
honestly and letting the automatic layer assignment do its thing.

The edge I named to cut, `events → handlers`, carries its own `label` field
(`"cut here: closes the loop back into handlers"`) — this is drawn directly
on the edge in the SVG (`edge-13-label`, amber text with a white halo,
sitting at roughly the path's midpoint), which is the "in the figure, not
only in the log" requirement from the brief.

## Coordinates / colours / canvas sizes typed by hand

**None.** I did not set `pos` on any module, did not set `canvas`, and did
not set `theme`. The only "colour" decision I made was indirect: choosing
to `highlight` the three cycle edges, which the runtime renders in its
default accent amber (`#f59e0b`) — I never wrote a hex value myself. Layout
(11 modules across roughly 8 layers, edge routing, canvas 417×698) is
entirely automatic from the `deps` list.

## What I wanted and could not express

- No way to give a `deps` edge an arbitrary colour directly in the `deps`
  array — only the four `style` keywords. To make the cycle edges
  distinct I had to reach for a `sequence` + `highlight` op (a "motion"
  concept) on what is otherwise a deliberately motion-free still figure.
  It works, but it means a "just colour this edge" need has to go through
  the beat/caption machinery, and it re-uses the single fixed accent
  colour rather than letting me choose (e.g.) red for "this one should not
  exist" vs. amber for "this one exists and closes a loop" — those are two
  different messages I'd have liked to keep visually separate, but there is
  only the one highlight colour, so both would look identical if I'd
  wanted to try it.
- I would have liked to write the "cut here, and why" text as a short
  multi-line note near the edge (reason on its own line under the "cut
  here" instruction) rather than one long label string riding on the edge
  — `deps[].label` is a single string, no line breaks documented, and
  `modules`' anchor rules for `text`/`callout` (which do support multi-line
  and free placement `at` an anchor) are not documented at all: the guide's
  "Anchors by kind" table (docs/anim-ir.md, section "Annotations (every
  kind)") lists `diagram` and `graph` anchors as a node id or edge `"a->b"`
  but has **no row for `modules`** even though `modules` compiles through
  the same diagram-like sequence ops and its own `schema --kind modules`
  output confirms `highlight` takes an edge `"a->b"`. I did not want to
  spend a `check` round finding out by trial and error whether `callout`/
  `text`/`relate` accept `"events->handlers"` as an anchor on a `modules`
  scene, so I stuck with the one field (`deps[].label`) I already knew
  worked from the field table, and lost the ability to phrase the
  reasoning as more than one clause. This is a real gap in the guide, not
  just a nice-to-have: the annotation section explicitly says "Anchors are
  what the kind documents" and then documents every kind except this one.

## Looking at the SVG

Read `cycle.svg` after rendering. Confirmed by inspecting the raw markup
(not just re-running `check`):
- All 17 edges from the brief's import list are present exactly once, and
  no others (`edge-0` … `edge-16`), matching the `deps` array 1:1.
- Exactly three edges are amber (`stroke="#f59e0b"`): `edge-5`
  (`handlers→services`), `edge-12` (`services→events`), `edge-13`
  (`events→handlers`) — the rest are the default ink colour
  (`#1f2328`). This is the "cycle distinguishable at a glance" requirement.
- `edge-13` alone carries a visible label (`"cut here: closes the loop
  back into handlers"`), drawn in amber with a white halo so it reads over
  the line it sits on.
- `events` sits in the bottom layer, `handlers` sits three layers up;
  `edge-13`'s path runs from (410, 659) up to (137, 374) — a long diagonal
  against the top-to-bottom flow every other edge follows, which alone
  (before even reading colour) marks it as the odd one.

## Deliverables
- `scene.json` — final scene (identical to the round-1 draft; no edits were needed)
- `cycle.svg` — rendered with `vlmkit-anim still scene.json --out cycle.svg`
- `log.md` — this file
