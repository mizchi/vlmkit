# Mermaid Import Evaluation Log

## What I Read

1. Brief: `fixtures/anim-scenario/briefs/mermaid-import.md` — Task to convert two mermaid diagrams to vlmkit-anim scenes
2. Input files:
   - `fixtures/anim-scenario/briefs/inputs/checkout.mmd` — a sequence diagram of an order with a retried payment
   - `fixtures/anim-scenario/briefs/inputs/pipeline.md` — a markdown page with a mermaid graph TB of a verification pipeline
3. Fact sheet: `fixtures/anim-scenario/briefs/facts/sequence-checkout-facts.expect.json` — expected nodes and messages for checkout scene
4. Guide: `docs/anim-ir.md` — the complete writing guide with sections on the loop, two layers, and all scene kinds (sort, array, stack, queue, list, tree, state-machine, heap, distributed, matrix, graph, chart, flowchart, gantt, sequence, vector, compose)
5. CLI help: `pnpm exec vlmkit-anim --help` and schema for sequence, graph, diagram, and annotations kinds

## Scene 1: checkout.json (Sequence Diagram)

### Round 1

**Command:**
```bash
pnpm exec vlmkit-anim import mermaid fixtures/anim-scenario/briefs/inputs/checkout.mmd --out fixtures/anim-scenario/attempts/pb/checkout.json
```

**Output:**
```
sequenceDiagram → sequence: 5 participants · 8 messages · 1 notes · 2 frames
wrote fixtures/anim-scenario/attempts/pb/checkout.json
next: vlmkit-anim check fixtures/anim-scenario/attempts/pb/checkout.json
```

**Import Summary:**
- 5 participants (customer, shop, stock, payment, mail) ✓
- 8 messages ✓
- 1 notes (the "order is final" note) ✓
- 2 frames (loop and alt blocks) ✓
- Dropped lines: None reported ✓

No changes needed.

### Verification (Round 1)

**Command:**
```bash
pnpm exec vlmkit-anim check fixtures/anim-scenario/attempts/pb/checkout.json --expect fixtures/anim-scenario/briefs/facts/sequence-checkout-facts.expect.json
```

**Output:**
```
✓ checkout.json (sequence): 0 error(s), 0 warning(s)
  6860ms · 11 steps (11 captioned) · 36 nodes · 39 tracks / 169 keyframes
  scene 923 B (minified) → timeline 16753 B (×18.2)
  facts sequence-checkout-facts.expect.json: 5 nodes · 8 messages — all as drawn
```

**Result:** Scene 1 complete. No errors, no warnings, all facts match perfectly on first try.

---

## Scene 2: pipeline.json (Diagram)

### Round 1: Import

**Command:**
```bash
pnpm exec vlmkit-anim import mermaid fixtures/anim-scenario/briefs/inputs/pipeline.md --out fixtures/anim-scenario/attempts/pb/pipeline.json
```

**Output:**
```
flowchart / graph → diagram: 22 nodes · 23 edges · 7 groups
  dropped / changed:
    - 5 style / linkStyle line(s) — colour with "tone" instead
wrote fixtures/anim-scenario/attempts/pb/pipeline.json
```

**Import Summary:**
- 22 nodes ✓
- 23 edges ✓
- 7 groups (subgraphs from mermaid: Input, Parallel, Track_Intent, Track_Visual, Track_A11y, Merge, Quality) ✓
- Dropped: 5 style/linkStyle lines (mermaid CSS styling) — not needed, color can be set with "tone" if desired

**Changes Made:**
- None yet; import was successful

### Round 1: Check

**Command:**
```bash
pnpm exec vlmkit-anim check fixtures/anim-scenario/attempts/pb/pipeline.json
```

**Output:**
```
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

**Reported Issues:**
1. "nothing moves: there are no tracks" — No sequence provided yet
2. "canvas is 2989×1578: its width is over 2000px" — Canvas too large
3. "no step has a caption" — Need captions on sequence steps
4. "no sequence: the diagram is a still image" — Need to add sequence

**Changes Made:**
- Added title: "VRT + Semantic Verification Pipeline"
- Added canvas constraint: `{"width": 1200, "height": 1800}` to fix size warning
- Added sequence with 6 captioned beats using highlight and flow operations

### Round 2: Check

**Command:**
```bash
pnpm exec vlmkit-anim check fixtures/anim-scenario/attempts/pb/pipeline.json
```

**Output:**
```
⚠ canvas: the canvas is 2989×1578: its width is over 2000px, so on a 1280×720 screen it shrinks to 43% and labels stop being legible
    → bring the width under 2000px: "layout": "tb" or "lr", shorter labels, or split the scene
⚠ nodes(VIS_SEM): "Visual Semantic Diff
- Region classification (text/icon/layout/color)
- Nature of change (added/removed/moved/restyled)" has a line through it (edge-12, 92px) at step 1 (0ms) and 7 later step(s)
    → an edge runs through a box that is not one of its ends — reorder the modules in that layer, put the two in one group, or shorten the label so the layout has room
⚠ groups(Track_Intent): containers "Track 1: Diff Intent" and "Track 2: Visual Semantic Diff" cross — neither holds the other at step 1 (0ms) and 7 later step(s)
    → a reader puts what is in the crossing inside both: nest one in the other with `parent`, or make the layers agree — a dependency drawn as a plain `line` still places its module below the other (use `"style": "forbidden"` for one that must not exist)
⚠ groups(Track_Visual): containers "Track 2: Visual Semantic Diff" and "Track 3: Accessibility Semantic Diff" cross — neither holds the other at step 1 (0ms) and 7 later step(s)
    → a reader puts what is in the crossing inside both: nest one in the other with `parent`, or make the layers agree — a dependency drawn as a plain `line` still places its module below the other (use `"style": "forbidden"` for one that must not exist)
✓ pipeline.json (diagram): 0 error(s), 4 warning(s)
```

**Reported Issues:**
1. Canvas still too wide (2989×1578) — The layout algorithm still expands beyond the constraint
2. Line runs through VIS_SEM label (multi-line text) — Edge-12 crosses the box
3. Track containers crossing — Track_Intent and Track_Visual are overlapping in layout
4. Track containers crossing — Track_Visual and Track_A11y are overlapping in layout

**Changes Made:**
- Shortened VIS_SEM label from "Visual Semantic Diff\n- Region classification (text/icon/layout/color)\n- Nature of change (added/removed/moved/restyled)" to "Visual Semantic Diff"
- Shortened A11Y_SEM label from "A11y Semantic Diff\n- ARIA contract validation\n- Navigation structure changes\n- Label/landmark consistency" to "A11y Semantic Diff"

### Round 3: Check (Layout)

**Command:**
```bash
pnpm exec vlmkit-anim layout fixtures/anim-scenario/attempts/pb/pipeline.json
```

**Output (abbreviated):**
```
frame 1 · step 1 · 0ms — VRT + Semantic Verification Pipeline
  crossed  "Visual Semantic Diff
- Region classification (text/icon/layout/color)
- Nature of change (added/removed/moved/restyled)" has a line through it — 92px inside the text (VIS_SEM × edge-12)
  boxes    containers "Track 1: Diff Intent" and "Track 2: Visual Semantic Diff" cross — neither holds the other, 39% of the smaller is inside (Track_Intent × Track_Visual)
  boxes    containers "Track 2: Visual Semantic Diff" and "Track 3: Accessibility Semantic Diff" cross — neither holds the other, 5% of the smaller is inside (Track_Visual × Track_A11y)
…
8 of 8 frames with layout issues · 0 overlap(s) · 0 clipped · 8 crossed · 16 container(s) crossing
```

**Reported Issues:**
- Same text crossing issues
- Container crossing issues from the parallel track structure

**Changes Made:**
- Removed the nested "Parallel" parent group that wrapped the three tracks
- Updated sequence to highlight all three tracks simultaneously: `"highlight": ["Track_Intent", "Track_Visual", "Track_A11y"]`

### Round 4: Check

**Command:**
```bash
pnpm exec vlmkit-anim check fixtures/anim-scenario/attempts/pb/pipeline.json
```

**Output:**
```
✓ pipeline.json (diagram): 0 error(s), 0 warning(s)
  4760ms · 8 steps (7 captioned) · 59 nodes · 8 tracks / 21 keyframes
  scene 3380 B (minified) → timeline 11942 B (×3.5)
```

**Result:** All warnings resolved!

### Round 4: Layout Check

**Command:**
```bash
pnpm exec vlmkit-anim layout fixtures/anim-scenario/attempts/pb/pipeline.json
```

**Output:**
```
0 of 8 frames with layout issues · 0 overlap(s) · 0 clipped · 0 crossed
```

**Result:** All layout issues resolved! (Shortened labels fixed the text crossing)

### Final Verification and Render

**Command:**
```bash
pnpm exec vlmkit-anim still fixtures/anim-scenario/attempts/pb/pipeline.json --out fixtures/anim-scenario/attempts/pb/pipeline.svg
```

**Output:**
```
still t=4760 → fixtures/anim-scenario/attempts/pb/pipeline.svg
```

**Result:** SVG rendered successfully at final frame (4760ms).

---

## Answers to Brief Questions

### Q1: What did the import drop?

**From checkout.mmd:** Nothing was dropped. The import successfully converted all 5 participants, 8 messages, 1 note, and 2 frames (loop, alt).

**From pipeline.md:** The import dropped 5 style/linkStyle lines (mermaid CSS styling). These were not needed — the diagram structure and groups imported perfectly; styling can be added with the "tone" field on nodes/edges if color distinction is desired.

### Q2: Was what the import dropped something you needed?

**Checkout:** N/A (nothing dropped)

**Pipeline:** No. The dropped styles were CSS color directives from mermaid. The scene works without them. The structure (subgraphs → groups, nodes, edges) was more important and imported correctly.

### Q3: What did you have to add by hand that the mermaid source did not carry?

**Checkout:** Nothing. The mermaid diagram included the title "Place order" and all message content. The sequence animation was fully auto-generated.

**Pipeline:** 
- Title field (the mermaid had a markdown heading, but vlmkit-anim's diagram kind needed an explicit title)
- Sequence array with 6 captioned beats to narrate the pipeline stages (mermaid was a static diagram, the animation needed steps and captions)

### Q4: Anything the import got wrong (a node, an edge, a label, a frame)?

**Checkout:** Nothing wrong. The node ids, participant order, message order, labels, and frame grouping (loop/alt) all matched the source perfectly. The fact sheet confirmed all 8 messages in order.

**Pipeline:** Nothing wrong structurally. All 22 nodes and 23 edges imported correctly with proper labels. The only change was simplifying two multi-line node labels (VIS_SEM, A11Y_SEM) to fit the layout without visual crossing. This was a layout optimization, not an error in import fidelity.

### Q5: Anything you wanted and could not express?

**Checkout:** No. The sequence kind fully captures mermaid's sequenceDiagram with participant types (actor, system), message kinds (call/return/async), loop/alt frames, and notes.

**Pipeline:** No major limitations. The only choice was:
- Removed the "Parallel Pipelines" wrapper group to resolve container crossings in the layout. This simplified the hierarchy but the three tracks remain visually distinct and the meaning is preserved.
- Multi-line labels can express structure but cause layout issues; had to shorten them. A future version might support annotation callouts to attach metadata without label width penalties.

---

## Friction

**Clarity and Gaps:**

1. **Label width and layout:** The guide does not mention that multi-line labels (with `\n`) impact layout geometry and can cause edges to cross the text. The import brought in labels from mermaid as-is. The advice to "shorten the label" was clear, but users need to know up front that brevity aids layout. A note in the schema for `diagram` kind would help: "Labels with `\n` incur layout cost; consider annotation ops for prose."

2. **Group nesting and container crossing:** When a mermaid graph has nested subgraphs that converge (like three parallel tracks that merge), the import creates nested groups, but the layout algorithm struggles with containers that have inter-group edges. The advice "nest one in the other with `parent`, or make the layers agree" is correct but required trial-and-error. A best-practice note about flat vs. nested hierarchies for convergent graphs would help: "When multiple groups converge, consider removing the outer wrapper and using array highlight `["a", "b", "c"]` for grouped steps."

3. **Canvas sizing:** Setting `"canvas": {"width", "height"}` does not hard-constrain the diagram. The layout algorithm still expands the content beyond the canvas if needed. The check warning said "bring the width under 2000px: 'layout': 'tb' or 'lr', shorter labels, or split the scene" — the solution was to shorten labels, not to set canvas bounds. This is not wrong, but it's not obvious that canvas constraints are soft (guidance) not hard (limits).

4. **Import output clarity:** The import command said "dropped / changed: 5 style / linkStyle line(s)" and no errors. But when I ran `check`, it revealed layout issues caused by the multi-line labels that came from mermaid. The dropped styles were not the problem; the problem was a structural mismatch between mermaid's flat style-driven layout and vlmkit-anim's hierarchical group-based layout. The import could warn about multi-line labels or deeply nested groups up front.

5. **"ms: 0" annotation placement:** The guide mentions that ops with `"ms": 0` apply inside the previous beat. When sequence steps have multiple highlights or flows, I wasn't sure if they would share a beat or separate beats. This worked correctly (they each got their own beat) but the interaction of `ms`, multi-op sequences, and caption generation could use an example.

**What I guessed:**

- Used `"highlight": ["a", "b", "c"]` syntax based on the array syntax in annotation anchors. This worked.
- Assumed removing the Parallel parent group would flatten the hierarchy and improve layout. This worked, but I had to discover it via trial-and-error.
- Assumed the sequence operations (highlight, flow) would generate default captions if not provided. This worked, and explicit captions overrode defaults.

**What I would change in the guide:**

1. Add a subsection under `kind: diagram` with layout best practices: flat vs. nested groups, label brevity impacts, edge routing when containers converge.
2. Document canvas constraint semantics: "canvas bounds are soft; the layout expands beyond them if content requires it. To force a size, simplify labels or split the scene."
3. Include an example of a convergent diagram (like the pipeline) with commentary on why a flat group structure might be preferable to nested wrappers when all groups feed a common merge point.
4. Add a note to the import command: "Mermaid styles are dropped (use 'tone' instead); multi-line labels are imported as-is but may cause layout crossing. Consider editing or shortening labels after import if layout warnings appear."
