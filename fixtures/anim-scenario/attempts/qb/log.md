# VLMKit Architecture Diagram - Evaluation Log

## Initial Read

- **Brief**: `/home/user/vlmkit/fixtures/anim-scenario/briefs/why-figure.md` — a figure too wide to read, brought back to one screen. The input mermaid-imported diagram compiles to canvas over 8000px wide. Task: make it readable at one glance (under 2000px on both axes), keeping all nodes and edges, via relabeling, regrouping, layout changes, nesting, or flattening.

- **Writing Guide**: `/home/user/vlmkit/docs/anim-ir.md` (full, 1330 lines) — covers scene format, kinds (sort, array, stack, queue, list, tree, state-machine, heap, distributed, matrix, graph, chart, flowchart, gantt, sequence, diagram, modules, vector, compose), annotations, timeline layer, embedding, checking facts.

- **Inputs**: 
  - `/home/user/vlmkit/fixtures/anim-scenario/briefs/inputs/project-structure.json` — `kind: diagram` with 32 nodes, 47 edges, 5 groups (cli, api, packages, backends, outputs)
  - `/home/user/vlmkit/fixtures/anim-scenario/briefs/facts/project-structure-facts.expect.json` — fact sheet asserting all 32 modules and 47 deps must be drawn

## Round 1: Initial State + Aggressive Relabeling + Layout Change

**Check output (initial):**
```
⚠ canvas: the canvas is 8882×1037: its width is over 2000px, so on a 1280×720 screen it shrinks to 14% and labels stop being legible — workflow (300px, in cli) and openapi (87px, in api) need 249px between their centres (both boxes' halves, a gap, and their containers' paddings) and the layout put them 3% of the width apart, so 8806px + 76px of margins
⚠ tracks: nothing moves: there are no tracks
⚠ steps: no step has a caption: the viewer gets motion without narration
⚠ nodes(snapshot): "snapshot\ncapture / approve / stability / report / flipbook / fix-prompt" has a line through it (edge-24, 7px) at step 1 (0ms) and 1 later step(s)
⚠ [10 more warnings about lines through boxes and no sequence]
✓ structure.json (diagram): 0 error(s), 14 warning(s)
canvas 8882×1037
```

**Action taken:**
- Shortened all node labels to one word: "workflow\ninit / capture / verify / approve" → "workflow", "snapshot\ncapture / approve …" → "snapshot", etc.
- Simplified group labels: "CLI: @mizchi/vlmkit" → "CLI"
- Changed `layout` from `"tb"` (top-to-bottom) to `"lr"` (left-to-right), expecting right-pointing dependencies to reduce width

**What told me to do this:** 
Quote: "workflow (300px, in cli) and openapi (87px, in api) need 249px between their centres… so 8806px + 76px of margins" — the `why` output named workflow as the 300px bottleneck taking 40% of the cli band. Shortening it was the obvious move. The layout change was a guess to see if stacking vertically would help.

**Result:**
```
⚠ canvas: the canvas is 1302×2483: its height is over 2000px
⚠ [3 more warnings about nodes and no sequence]
✓ structure.json (diagram): 0 error(s), 5 warning(s)
canvas 1302×2483
```

**Did it work?** No. Width went from 8882px to 1302px (✓ good), but height exploded from 1037px to 2483px (✗ bad). The lr layout stacks layers vertically, and with all the groups sharing layers, it became worse. The guide says lr "layers states by distance from start and orders each layer to straighten arrows" — with multiple bands sharing layers, height became the problem.

---

## Round 2: Flatten Groups

**Check input:** 0 errors, 5 warnings, canvas 1302×2483

**Action taken:**
- Removed all 5 groups (`cli`, `api`, `packages`, `backends`, `outputs`)
- Changed layout back to `"tb"` (top-to-bottom)
- Kept one-word labels from round 1

**What told me to do this:**
The `why` output from round 1 explained: "bands — containers side by side, and their share: cli: a band across 40% of the picture — shares layers with api, packages, backends, outputs". The guide says "groups that share a layer with something else each get their own band across the layers" and "a group whose layers hold nothing but its members is a full-width row". By flattening all groups, I eliminated banding and made every layer a full-width row.

**Result:**
```
⚠ canvas: [no canvas warning]
⚠ tracks: nothing moves: there are no tracks
⚠ sequence: no sequence: the diagram is a still image
✓ structure.json (diagram): 0 error(s), 2 warning(s)
canvas 986×738
```

**Did it work?** Yes. Both axes under 2000px (986×738). The two remaining warnings were about the diagram being static (no animation tracks or steps), which is appropriate for a still figure but the guide warns that `diagram` expects a sequence — `diagram` is for animated narratives, not stills.

---

## Round 3: Convert to `kind: modules`

**Check input:** 0 errors, 2 warnings, canvas 986×738

**Action taken:**
- Changed `kind` from `"diagram"` to `"modules"`
- Renamed `nodes` field to `modules`
- Renamed `edges` field to `deps`
- Converted edge format from `{from: "a", to: "b"}` to `["a", "b"]` (shorthand dependency format)
- Kept one-word labels and tb layout

**What told me to do this:**
Quote from guide (line 761–766): "Any scene is a figure at any instant... `modules` and a `diagram` without `sequence` are written for this... A `modules` map for when the picture, not the motion, is the explanation... `check` does not warn about a missing `sequence` on `modules`; it does on `diagram`, where the beats are the point."

The brief says "Success: … exits 0 with no ✗ and no ⚠". The two warnings were because `diagram` is meant for animated sequences. Switching to `modules`, the kind designed for static dependency maps, removed both warnings and kept the canvas small.

**Result:**
```
✓ structure.json (modules): 0 error(s), 0 warning(s)
canvas 1806×757
```

**Did it work?** Perfect. All 32 modules and 47 deps verified against the facts. Canvas 1806×757 is under 2000px on both axes. Zero errors, zero warnings. Success condition met.

---

## Final State

- **File**: `structure.json` (2155 B, minified)
- **SVG render**: `structure.svg` 
- **Canvas**: 1806×757 px
- **Check result**: ✓ 0 error(s), 0 warning(s)
- **Facts verified**: 32 module(s) · 47 dependencies — all as drawn
- **Rounds to green**: 3

---

## Friction / What the Tool or Guide Should Have Told Me

1. **The banding problem was not obvious from the initial warning.** The `check` output said "width is over 2000px" and named workflow as the culprit, but did not immediately explain that the real issue was *banding* — five groups sharing layers, each contributing a band. I had to run `why` and parse the band list to understand. The warning could say: "the five groups share layers, creating 5 bands side by side; each is as wide as its fullest layer. Flatten groups to eliminate banding, or nest them so one owns its own layers (a full-width row)."

2. **The choice between `diagram` and `modules` should be guided earlier.** The guide separates them by use case ("for when the picture, not the motion, is the explanation"), but after a `diagram check` warns twice about no sequence, it would help to suggest: "for a static map, use `kind: modules` instead — `check` does not warn about missing animation on stills." I only found this by re-reading the guide at line 761.

3. **`layout: lr` behavior was not intuitive.** Changing `layout` to `"lr"` (left-to-right) made me expect the canvas to become taller but narrower — which it did. But the guide does not emphasize that with multiple banding groups, `lr` layers nodes vertically (one layer per dependency level) rather than horizontally, and the height grows with the number of layers. A note: "`lr` layering: all nodes at distance N from start form one layer; a canvas with many layers grows tall. Use `tb` with fewer bands, or flatten groups."

4. **Canvas sizing after kind change was surprising.** After round 2, the canvas was 986×738. After changing to `modules` and converting the structure, the canvas reported 1806×757 — almost doubled in width. This is because `modules` kind may apply a default canvas or auto-sizing differently. The change was still good (under 2000px), but I had no way to predict it without running `check` again. The guide could note: "changing kind or structure may cause canvas to resize; re-run `check` to verify."

