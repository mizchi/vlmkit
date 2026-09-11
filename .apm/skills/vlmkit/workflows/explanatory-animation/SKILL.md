---
name: explanatory-animation
description: Explain an algorithm, protocol, data structure, state machine, or architecture as a checked animation or still figure with `vlmkit-anim` — one JSON scene (a `kind` plus intent, never coordinates) compiled to SVG + Web Animations, a GIF, or a cropped figure, and checked against what it claims (semantic checks, `layout` geometry, a fact sheet with `--expect`, `why` for the layout's own reasons). Also draws a module map from a directory's import graph, a repository's architecture, the change map of a branch, the diff of two maps, and imports mermaid the repo already has. Use when asked to animate, illustrate, diagram, draw a dependency / module / architecture map, explain how something works step by step, or embed such a figure in docs. Not a VRT gate — `vlmkit-anim` is its own binary (`@mizchi/vlmkit-anim`).
metadata:
  internal: true
---

# explanatory-animation

One file says **what is being explained**; the tool draws it, and then
checks that the picture says what the file claims. The writer's job is the
scene and the captions. The tool's job is layout, motion, and telling the
writer where the picture lies.

```json
{ "format": "vlmkit-anim/scene@1", "kind": "sort", "algorithm": "bubble", "values": [5, 3, 8, 1] }
```

Two layers: a **Scene** (`kind` + intent — `"algorithm": "bubble"`,
`"trace": ["connect", "SYN+ACK"]`, `"deps": [["web", "api"]]`, never x / y)
compiles to a **Timeline** (nodes, keyframe tracks, captioned steps). Write
the scene; read the timeline only through the verbs below.

When the task is to *answer a question* with a figure — "how does this
work", "how is this structured", "what does this PR change" — `explain-with-anim`
decides what to draw, from what, and how the prose follows it; this skill is
how the scene itself is written and checked.

**The one page to read before writing is `docs/anim-ir.md`** (in this repo)
— every kind, its ops, the annotation ops every kind shares, and one JSON
example per kind that `check` passes. `vlmkit-anim schema --kind <k>` prints
one kind's section. Do not learn the format from the compiler source.

## Invocation

`vlmkit-anim` is a **standalone binary**, not a `vlmkit` subcommand.

```bash
# this repository
pnpm exec vlmkit-anim check scene.json                      # dist/ — run `pnpm --filter @mizchi/vlmkit-anim build` after editing src/
node --experimental-strip-types packages/vlmkit-anim/src/cli.ts check scene.json   # no build

# any other repository
npx -p @mizchi/vlmkit-anim vlmkit-anim check scene.json     # or add @mizchi/vlmkit-anim as a dev dependency
```

Nothing below needs a browser or an API key except: `.png` output, `sheet`,
`video`, `eval` (Playwright), and `review --model` (a vision model through
`@mizchi/vlmkit-ai`). Writing and checking a scene is browser-free.

## Route by task

| Task shape | Do this |
|---|---|
| "Animate / show step by step how X works" (a sort, search, BST, heap, DP table, graph walk, state machine, message exchange, flowchart, gantt) | Pick the `kind` whose section in the guide names X; write the scene; run the loop below. Nineteen kinds: sort, array, stack, queue, list, tree, state-machine, heap, distributed, matrix, graph, chart, flowchart, gantt, sequence, diagram, modules, vector, compose. |
| "Explain a concept" that no kind names | Choose the kind whose *things* the concept has (nodes exchanging messages → `distributed`; a table filling in → `matrix`); say the rest with annotation ops (`value`, `callout`, `snapshot`, `group`, `text`, `relate`) that name the kind's things. Two pictures at once → `kind: compose`. Coordinates are the last resort, and count against the scene. |
| "Draw a module / dependency / architecture map" | `kind: modules` with `modules`, `deps` (`["a", "b"]` reads "a depends on b"), `groups`, optional `parent` on a group; `still` renders it. When the code exists, first `vlmkit-anim facts <dir> --depth 1 --out f.expect.json`, then `check --expect` the map against it. |
| "Draw this repository" | `vlmkit-anim repo --out docs/diagrams --name <name>` — the workspace layer by layer, a GIF, a contact sheet, a Markdown page and its own fact sheet. |
| "What does this branch change?" | `vlmkit-anim pr --base origin/main --out .vlmkit-anim/pr` — one beat per commit; `<name>.md` is paste-ready. |
| "Show what changed between two maps" | `vlmkit-anim diff before.json after.json --out change.svg [--expect diff.json]` — added in accent, removed dashed grey, a legend; `--expect` checks the change against a diff sheet. |
| "We already have a mermaid diagram" | `vlmkit-anim import mermaid page.md --out scene.json` (flowchart / graph, sequenceDiagram, stateDiagram-v2). Read its `dropped / changed:` and `notes:` lines; add what the import cannot know (a title, captions, a walk or trace). |
| "Put it in the docs" | `html --out page.html` (runtime inline), `video --out demo.gif` for a README, or the remark plugin `@mizchi/vlmkit-anim/remark` so a ```` ```vlm-anim ```` fence in Markdown becomes the animation and ```` ```vlm-anim still ```` the figure. |

## The loop

```
1. write scene.json                                  one kind; ids ASCII, language in `label`
2. vlmkit-anim check scene.json [--expect facts.json] validate → compile → semantic checks → stats; exit 1 on ✗
3. vlmkit-anim explain scene.json                    the narration as a numbered list — is this the story?
4. vlmkit-anim layout scene.json                     texts on texts, under boxes, past the edge, lines through
                                                     labels, containers crossing — per step; exit 1 when any
5. vlmkit-anim why scene.json [--about id]           (modules / diagram) what set each canvas axis, rows vs bands
                                                     and their share, what put each box on its layer, which box
                                                     a bent edge went round — read this BEFORE relabelling
6. vlmkit-anim still scene.json --out fig.svg        the figure  |  html --out page.html  |  video --out demo.gif
7. vlmkit-anim review scene.json --out dir           optional: a contact sheet + brief for a vision reader;
                                                     --answers scores its JSON against the geometry / the facts
```

Each ✗ line names a path, what is wrong, and a `→` hint with the fix. Fix
the first ✗, re-run; ⚠ lines are advice you act on only when they touch
what the picture is for. Budget five rounds; if the fifth is not green,
stop and report the lines, not a guess.

## Done condition

- `check` exits 0 with no ✗ (and, when a fact sheet exists, `--expect` too).
- `layout` reports no issue on any step.
- `explain` reads as the explanation you meant — every beat has a caption
  that says *why*, not only what moved.
- For a still: both canvas sides under 2000px (the canvas ⚠ in `check`),
  and you looked at the SVG once.

## Reading the kickbacks

- **The canvas warning names its cause.** "labels stop being legible — A
  (206px, in G1) and B (53px, in G2) need 142px between their centres … and
  the layout put them 10% of the width apart", then "N containers sit side by
  side across the picture (a 40%, b 10%, …), each as wide as its fullest
  layer's boxes". The lever is the named pair or the banding — flatten or
  re-nest the containers, break the named label — not the longest label you
  can see. `why` has every layer, band and detour; two writers who read it
  before their first edit brought an 8882px graph under 2000px.
- **A crossing names the edge by its ends** (`edge-24: diff → capture`) and
  the box it runs through. Move one end to another layer (reorder the list,
  regroup) or shorten *that* label.
- **"no sequence" on a `diagram`** means the picture, not the motion, is the
  point: switch to `kind: modules`. The switch changes layering (a diagram
  layers one past what points into a box; a module map layers from its
  leaves), so re-run `check` and read the new canvas line.
- **`--expect` lines** are the facts the picture got wrong: a dependency
  drawn that the sheet does not list, one listed and not drawn, the wrong
  edge highlighted. A green `check` on a wrong picture is the failure this
  exists for — the sheet wins over the picture.
- **`import mermaid` `dropped / changed:`** names what the IR has no place
  for (styles, classDefs, clicks, `direction` inside a subgraph, composite
  states). Colour with `tone`; everything else you put back as captions.

## Rules the checks enforce (do not fight them)

- No coordinates in a scene that has a kind for its things. `kind: vector`
  and hand-written positions are the fallback and are counted as such.
- Every annotation names an anchor the kind owns (an index, a cell, a node,
  an edge), and asks for a `side`; the compiler grows the canvas on that
  side and routes the pointer round labelled boxes. Record asked vs landed
  if it matters.
- Labels may be any script; boxes are sized per glyph (CJK is one em). Ids
  stay ASCII.
- A dependency cycle in `modules` is a warning, drawn — name the cut in a
  caption or mark one edge `"style": "forbidden"`.
- A scene in a ```` ```vlm-anim ```` fence is checked the same way; a fence
  that does not compile renders as a visible `<pre>` with the check's lines.

## Outputs at a glance

| File | Verb | Consumer |
|---|---|---|
| `scene.json` (or `scene.ts` exporting `scene.<kind>({…})`) | you | the repo — this is what is edited later |
| `fig.svg` / `fig.png` | `still` | docs, a README, a slide |
| `page.html` | `html` | a browser; `vlmkit check animation page.html` and `vlmkit-anim eval` measure it |
| `demo.gif` / `.mp4` / `.webm` | `video` | a README or PR comment |
| `*.expect.json` | `facts`, `repo`, by hand | `check --expect`; the truth the picture is held to |
| `<name>.sheet.png`, `<name>.review-brief.md`, `<name>.review-score.md` | `review` | a vision model or a second agent, and its score |

## Failure modes

- `.png`, `sheet`, `video --out x.mp4`, `eval` fail with a browser error →
  Playwright is missing; `.svg`, `.gif` and `sheet --out sheet.html` need no
  browser.
- In this repo the CLI shows old behaviour after editing `packages/vlmkit-anim/src/` →
  `pnpm --filter @mizchi/vlmkit-anim build` (never piped to `head`), or run from source.
- Every round shortens a label and the canvas does not move → the label was
  not the binding one; read the canvas line and `why`.
- A `modules` map has a dependency the code does not → the sheet from
  `facts` catches it; a map drawn from memory is checked against the code,
  not the other way round.
- `check` is green, the figure is wrong → write the fact sheet. That is the
  whole reason `--expect` exists.
