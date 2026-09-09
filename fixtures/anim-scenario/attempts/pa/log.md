# Log — mermaid-import brief

## 1. What I read

- `fixtures/anim-scenario/briefs/mermaid-import.md` (the brief)
- `fixtures/anim-scenario/briefs/inputs/checkout.mmd` (sequenceDiagram source)
- `fixtures/anim-scenario/briefs/inputs/pipeline.md` (Markdown page with one ```mermaid graph TB``` fence)
- `fixtures/anim-scenario/briefs/facts/sequence-checkout-facts.expect.json` (the fact sheet for checkout)
- `fixtures/anim-scenario/briefs/inputs/modules-diff-before.json` (present in `inputs/`, opened because the brief scopes reading to "its inputs"; turned out to belong to a different brief — not used)
- `docs/anim-ir.md`, full file, both pages (offset 0 and offset 904)
- `pnpm exec vlmkit-anim --help`
- `pnpm exec vlmkit-anim schema --kind sequence`
- `pnpm exec vlmkit-anim schema --kind modules`
- `pnpm exec vlmkit-anim schema --kind diagram` (consulted after the writing guide's own kind:diagram section turned out not to mention `groups` — see Friction #1)
- `pnpm exec vlmkit-anim schema --kind expect`

I did not open anything under `packages/vlmkit-anim/`, other attempt directories, `docs/reports/`, `CHANGELOG.md`, or any test file, and did not grep the repository for examples.

## 2. Per scene, per round

### Scene: checkout.json

**Round 1** (import only, no hand edit yet):

```
$ pnpm exec vlmkit-anim import mermaid fixtures/anim-scenario/briefs/inputs/checkout.mmd --out fixtures/anim-scenario/attempts/pa/checkout.json
sequenceDiagram → sequence: 5 participants · 8 messages · 1 notes · 2 frames
wrote fixtures/anim-scenario/attempts/pa/checkout.json
next: vlmkit-anim check fixtures/anim-scenario/attempts/pa/checkout.json
```

No "dropped / changed" lines were printed — nothing was dropped.

```
$ pnpm exec vlmkit-anim check fixtures/anim-scenario/attempts/pa/checkout.json --expect fixtures/anim-scenario/briefs/facts/sequence-checkout-facts.expect.json
✓ checkout.json (sequence): 0 error(s), 0 warning(s)
  6860ms · 11 steps (11 captioned) · 36 nodes · 39 tracks / 169 keyframes
  scene 923 B (minified) → timeline 16753 B (×18.2)
  facts sequence-checkout-facts.expect.json: 5 nodes · 8 messages — all as drawn
  next: vlmkit-anim explain fixtures/anim-scenario/attempts/pa/checkout.json · vlmkit-anim render fixtures/anim-scenario/attempts/pa/checkout.json --step N · vlmkit-anim html fixtures/anim-scenario/attempts/pa/checkout.json --out page.html
```

Quoted line → change made:

- `✓ checkout.json (sequence): 0 error(s), 0 warning(s)` — no ✗, no ⚠. No change needed.
- `facts sequence-checkout-facts.expect.json: 5 nodes · 8 messages — all as drawn` — the scene the import produced already matches the fact sheet exactly (participants, messages, order). No change needed.

**Result: checkout.json was green on round 1. 0 rounds of editing were needed.** The mermaid `title Place order` line was picked up automatically as the scene's `"title"`; the `actor customer as Customer` line became `{"id": "customer", "label": "Customer", "kind": "actor"}`; the `loop … end` and `alt … else … end` became a `loop` frame containing an `alt` with two branches; `Note over shop: …` became `{"note": "order is final", "at": "shop"}`; `shop-)mail:` became `"kind": "async"`; the two `-->>` returns became `"kind": "return"`. All of this matched the fact sheet on the first try.

### Scene: pipeline.json

**Round 0** (import; no `--as` needed because the source has no decision `{}` node, so the tool defaulted to `diagram` with subgraphs as groups):

```
$ pnpm exec vlmkit-anim import mermaid fixtures/anim-scenario/briefs/inputs/pipeline.md --out fixtures/anim-scenario/attempts/pa/pipeline.json
flowchart / graph → diagram: 22 nodes · 23 edges · 7 groups
  dropped / changed:
    - 5 style / linkStyle line(s) — colour with "tone" instead
wrote fixtures/anim-scenario/attempts/pa/pipeline.json
next: vlmkit-anim check fixtures/anim-scenario/attempts/pa/pipeline.json
```

I first tried `--as sequence` on `checkout.mmd` by mistake (see Friction #3) and got a rejecting error; that was not run against `pipeline.md` and cost no round on this scene.

Node/edge/group counts checked by hand against the source: 22 node ids (`GIT, PW, PARSE_DIFF, DEP_GRAPH, AFFECTED, INTENT, SCREENSHOT, PIXEL_DIFF, HEATMAP, VIS_SEM, A11Y_TREE, A11Y_DIFF, A11Y_SEM, CROSS, JUDGE, VERDICTS, QC, WH, ERR, COV, A11Y_REG, REPORT`), 23 arrows, 7 subgraphs (`Input, Parallel, Track_Intent, Track_Visual, Track_A11y, Merge, Quality`, with the three `Track_*` nested under `Parallel` via `"parent"`) — all present and correctly wired in the emitted JSON. No node, edge or label was mis-imported.

**First `check`** (before any hand edit):

```
$ pnpm exec vlmkit-anim check fixtures/anim-scenario/attempts/pa/pipeline.json
⚠ tracks: nothing moves: there are no tracks
    → a still image is fine, but then a plain SVG is simpler
⚠ canvas: the canvas is 2989×1578: its width is over 2000px, so on a 1280×720 screen it shrinks to 43% and labels stop being legible
    → bring the width under 2000px: "layout": "tb" or "lr", shorter labels, or split the scene
⚠ steps: no step has a caption: the viewer gets motion without narration
    → add "caption" to the steps that matter
⚠ sequence: no sequence: the diagram is a still image
    → add steps such as {"highlight": "a", "caption": "…"} or {"flow": "a->b"}
✓ pipeline.json (diagram): 0 error(s), 4 warning(s)
```

Quoted line → change made:

- `⚠ tracks: nothing moves … a still image is fine, but then a plain SVG is simpler` — the brief asks for an animated walk-through, not a still, so I added a `sequence` (see round 1 below) rather than switching to a plain SVG.
- `⚠ canvas: … width is over 2000px …` — addressed across rounds 2–5 below; not fully resolved by round 5 (see Result).
- `⚠ steps: no step has a caption …` — added captions on every sequence step.
- `⚠ sequence: no sequence: the diagram is a still image` — added a `"sequence"` with 5 beats (2 `highlight`, 1 `flow`, 1 `note`, 1 more `highlight`), per the brief's list of ops to use.

**Round 1**: added `"title": "VRT + Semantic Verification Pipeline"` (from the source's H1) and the 5-beat `sequence`:

```json
"sequence": [
  { "highlight": "Input", "caption": "Two independent sources feed the pipeline: a git diff, and a Playwright run of the page." },
  { "highlight": "Parallel", "caption": "Three tracks run in parallel on those sources: diff intent, visual semantics, accessibility semantics." },
  { "flow": "CROSS->JUDGE", "caption": "Visual and a11y semantics cross-validate each other, then join diff intent and the affected components at the verdict engine." },
  { "note": "The verdict engine outputs one of: approve, reject, or escalate." },
  { "highlight": "Quality", "caption": "The quality gate turns that verdict into concrete checks — whiteout, error states, coverage, a11y regression — and a report." }
]
```

```
$ pnpm exec vlmkit-anim check fixtures/anim-scenario/attempts/pa/pipeline.json
⚠ canvas: the canvas is 2989×1578: its width is over 2000px, so on a 1280×720 screen it shrinks to 43% and labels stop being legible
    → bring the width under 2000px: "layout": "tb" or "lr", shorter labels, or split the scene
✓ pipeline.json (diagram): 0 error(s), 1 warning(s)
  4060ms · 7 steps (6 captioned) · 61 nodes · 6 tracks / 15 keyframes
```

`tracks`, `steps`, `sequence` warnings gone. Only `canvas` remains.

**Round 2**: tried the guide's "shorter labels" suggestion, all at once — shortened `VIS_SEM`, `A11Y_DIFF` and `A11Y_SEM` from their multi-bullet mermaid labels to one short parenthetical each:

```
$ pnpm exec vlmkit-anim check fixtures/anim-scenario/attempts/pa/pipeline.json
⚠ canvas: the canvas is 2472×1242: its width is over 2000px, so on a 1280×720 screen it shrinks to 52% and labels stop being legible
⚠ groups(Input): containers "Input Sources" and "Parallel Pipelines" cross — neither holds the other at step 1 (0ms) and 6 later step(s)
⚠ groups(Parallel): containers "Parallel Pipelines" and "Cross-Validation" cross — neither holds the other at step 1 (0ms) and 6 later step(s)
✓ pipeline.json (diagram): 0 error(s), 3 warning(s)
```

This regressed: canvas width did shrink (2989→2472) but shortening those three labels together also cut two of the boxes down to fewer lines than before, which shifted vertical layering enough to make two container boxes cross. Quoted line → change: I reverted `A11Y_DIFF` and `A11Y_SEM` back to their original multi-line mermaid text in round 3, keeping only the `VIS_SEM` shortening.

**Round 3**: reverted `A11Y_DIFF` and `A11Y_SEM` to their original import text; kept `VIS_SEM` shortened to `"Visual Semantic Diff\n(region class · change kind)"`:

```
$ pnpm exec vlmkit-anim check fixtures/anim-scenario/attempts/pa/pipeline.json
⚠ canvas: the canvas is 2472×1578: its width is over 2000px, so on a 1280×720 screen it shrinks to 46% and labels stop being legible
✓ pipeline.json (diagram): 0 error(s), 1 warning(s)
```

Group-crossing warning gone; canvas still over budget (2472). Change made for this line: tried shortening a different label next, keeping line-count the same this time to avoid disturbing vertical layering again.

**Round 4**: shortened `A11Y_SEM`'s wording but kept it at 4 lines (`"A11y Semantic Diff\n- ARIA contract\n- nav structure\n- labels"`) instead of collapsing it to fewer lines:

```
$ pnpm exec vlmkit-anim check fixtures/anim-scenario/attempts/pa/pipeline.json
⚠ canvas: the canvas is 2472×1578: its width is over 2000px, so on a 1280×720 screen it shrinks to 46% and labels stop being legible
✓ pipeline.json (diagram): 0 error(s), 1 warning(s)
```

No change at all — same 2472×1578. I used `render --step 1 --out /tmp/frame1.svg` (not a `check`, so not counted as a round) plus a small script that scans the SVG's `<rect>` widths to find which box is actually driving the total, and matched rects to their group labels by nearest-preceding-text. That showed the true bottleneck was `Parallel Pipelines`, sized at 2084px = `Track_Intent` (804px) + `Track_Visual` (514px) + `Track_A11y` (351px) + inter-track gaps — i.e. mostly the *structural* width of `Track_Intent`'s two-wide branch (`DEP_GRAPH`/`INTENT` sitting side by side at the same layer, both descending from `PARSE_DIFF`), not any single label's text length. `A11Y_SEM` was in the *shortest* track and was never the bottleneck — hence zero effect from editing it further.

**Round 5** (last round allowed for this scene): shortened the two labels actually inside the bottleneck track (`Track_Intent`): `DEP_GRAPH` (`"(TS / MoonBit / Rust)"` → `"(TS/MoonBit/Rust)"`) and `INTENT` (`"Heuristic or LLM"` → `"(heuristic/LLM)"`):

```
$ pnpm exec vlmkit-anim check fixtures/anim-scenario/attempts/pa/pipeline.json
⚠ canvas: the canvas is 2472×1578: its width is over 2000px, so on a 1280×720 screen it shrinks to 46% and labels stop being legible
✓ pipeline.json (diagram): 0 error(s), 1 warning(s)
```

Still no change — 2472×1578, unchanged to the pixel. This means both boxes were already at some minimum box width the guide never names, so text below that floor has zero effect on the rendered geometry (and `check`/`layout` give no signal that an edit had zero effect — I only found out by re-measuring the raw SVG).

**Stopped here at round 5**, per the brief's cap. `check` still reports the one `canvas` ⚠.

`vlmkit-anim layout fixtures/anim-scenario/attempts/pa/pipeline.json` (run once, does not count against the edit→check budget):

```
$ pnpm exec vlmkit-anim layout fixtures/anim-scenario/attempts/pa/pipeline.json
0 of 7 frames with layout issues · 0 overlap(s) · 0 clipped · 0 crossed
```

This half of the success condition is met.

`vlmkit-anim still fixtures/anim-scenario/attempts/pa/pipeline.json --out fixtures/anim-scenario/attempts/pa/pipeline.svg` produced `pipeline.svg` as required.

## Result summary

| scene | first `check` | rounds to green | final `check` |
|---|---|---|---|
| checkout.json | 0 ✗ / 0 ⚠ (green immediately, against `--expect`) | 0 | 0 ✗ / 0 ⚠ |
| pipeline.json | 0 ✗ / 4 ⚠ | 5 (cap reached) | 0 ✗ / 1 ⚠ (canvas width) — **not fully green** |

## 3. The brief's questions

**What did the import drop, and did I need it back?**

- `checkout.mmd`: nothing was reported dropped, and comparing the emitted scene against the source line by line, nothing was silently lost either (see round 1 above). Nothing needed.
- `pipeline.md`: the import dropped "5 style / linkStyle line(s)" — the mermaid source's `style Track_Intent fill:#e8f4f8,stroke:#2196F3` (and four siblings) that colour the five subgraphs. I did not add these back. They aren't needed for either success condition (`check` and `layout` don't look at colour), and the animated `sequence` I wrote already distinguishes the tracks by *when* they're highlighted rather than by a static colour-per-track scheme, which covers the same communicative need the source's colouring served. I did consider re-adding them as `"tone"` on the groups, but `tone` only has three roles (`accent`/`bad`/`muted`), not five arbitrary hex colours — see the "could not express" answer below.

**What did I add by hand that the mermaid source did not carry?**

- `checkout.json`: nothing — the import alone satisfied the fact sheet.
- `pipeline.json`: a `"title"` (taken from the Markdown page's own H1, since mermaid `graph TB` carries no title directive the way `sequenceDiagram title` does), and the entire `"sequence"` of 5 captioned beats (2 `highlight`, 1 `flow`, 1 `note`, 1 more `highlight`) — none of this exists in a flowchart mermaid source, which has no notion of beats or narration order. I also shortened four node labels (`VIS_SEM`, `DEP_GRAPH`, `INTENT`, and — ultimately reverted back for two of them — `A11Y_DIFF`/`A11Y_SEM`) purely to fight the canvas-width warning; that is an edit to the *source's own wording*, not something the brief asked for, and I would not have made it if the width check had passed on the imported text as-is.

**Anything the import got wrong, compared with the source?**

- `checkout.json`: nothing found wrong. Participants, message order, `loop`/`alt` frame nesting, the `Note over shop`, and message kinds (`call`/`return`/`async`) all matched the source exactly.
- `pipeline.json`: nothing structurally wrong either — 22/23/7 (nodes/edges/groups) matched a manual count of the source, and every id, edge direction and multi-line `<br/>` label reproduced the source faithfully. The one thing I noticed but can't call an outright error: the `direction TB` line inside `subgraph Parallel` produced no output at all — it wasn't applied (the diagram already defaults to `"layout": "tb"`, so no visible difference resulted) and it wasn't named in the "dropped / changed" list either. Net effect on the picture: none, since the two happen to agree; but the accounting is not complete — see Friction #4.

**Anything I wanted and could not express?**

- The source's five subgraph colours (light blue / orange / green / purple / pink, one per track/stage) as a *static*, always-on visual grouping cue. `diagram`/`modules` groups have no arbitrary-colour field — only `"tone": "accent" | "bad" | "muted"`, three fixed roles, not five independent hues. I ended up not needing this (the animated highlight sequence substitutes for it), but a reader who wanted the *original* five-colour scheme specifically could not get it from this IR; that matches what the import itself already told me it was dropping.
- A clean fix for the canvas-width warning that didn't require either (a) rewording the source's own labels below the point where it stopped affecting anything, or (b) restructuring the diagram. The three suggestions the check message gives (`layout: tb or lr`, shorter labels, split the scene) didn't fully work here: `lr` made things strictly worse (introduced text-covers-text and group-crossing warnings that `tb` didn't have — see Friction #2), and "shorter labels" hit an apparent floor after round 3 where further shortening produced literally zero pixel change. I didn't try "split the scene" because the brief wants one `pipeline.json`/`pipeline.svg` pair, and it's unclear a `compose` pane layout would avoid the same per-track minimum-width floor rather than just relocating it.

## 4. Friction

- The writing guide's own `## kind: diagram` section (the prose table of fields, not the CLI) never mentions a `groups` field. I only found out `diagram` accepts `groups` — which is exactly what `import mermaid` used to represent the mermaid `subgraph`s — by running `vlmkit-anim schema --kind diagram`, which *is* documented and which the rules for this exercise explicitly allow me to run, but a reader following only `docs/anim-ir.md` top to bottom would reasonably conclude `groups` belongs to `modules` alone (it's fully documented there) and would have no way to know it also applies to `diagram`, since the shared "Common to every scene" section doesn't list it as common either. I would add a one-line pointer in the kind:diagram section: "`groups` — see kind: modules; the same field, same semantics, works here too."
- The canvas-width warning's fix advice (`"layout": "tb" or "lr", shorter labels, or split the scene`) doesn't say that box widths appear to have a floor beneath which "shorter labels" has zero effect, nor does it name which node/group/track is actually driving the number over budget. I spent 3 of my 5 rounds shortening labels that turned out not to matter (in the wrong track entirely, in round 4) before dumping the raw SVG's `<rect>` widths myself to find the actual bottleneck. I would change either the warning message (name the widest sibling group/row and its px contribution, the way the `nodes(...) is covered by ...` warning already names both texts and a percentage) or add something like `vlmkit-anim layout --json` reporting per-group/per-row width contributions the way it already reports per-frame issues.
- `import mermaid --as` is documented as taking `diagram|flowchart|modules`, but nothing in the "Importing a mermaid diagram" prose section says outright that it *doesn't* apply to `sequenceDiagram` or `stateDiagram-v2` sources (only implied by "flowchart / graph → ... `--as diagram | flowchart | modules` picks" appearing only under the flowchart/graph bullet). I guessed `--as sequence` for `checkout.mmd` from the CLI's own kind list and got a rejecting error on the first try; harmless here, but a sentence like "`--as` only applies to flowchart/graph sources; sequenceDiagram and stateDiagram-v2 always import to their one matching kind" would have saved that one call.
- The import's "says what it dropped" promise (docs/anim-ir.md, "Importing a mermaid diagram" section: "and says what it dropped") turned out to be incomplete in my one test case: `direction TB` inside a nested `subgraph` produced no dropped/changed line at all, even though it is a mermaid directive the IR has no explicit field for. It happened to be harmless here because the diagram's default layout direction already agreed with it, but I have no way to know from the guide whether that is by design (directions are read and only reported when they'd conflict) or an accounting gap that would silently lose information on a diagram where the directions disagree. I'd want the guide (or the import's own dropped-list) to say explicitly which mermaid keywords are read-and-applied, which are read-and-ignored-silently, and which are read-and-reported — right now only the third category is described.
