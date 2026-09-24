# vlmkit — Project Skills

## How to Update VLM Model Benchmarks

### Purpose
Periodically evaluate VLM (Vision Language Model) cost-performance for analyzing VRT diff images.

### Steps

1. **Check available models** (dynamically fetched from OpenRouter API):
```bash
pkf run vlm-bench -- --list --max-cost 0.001 --limit 30
```

2. **Run fix-loop with candidate models** (hard case: seed 11):
```bash
VLMKIT_VLM_MODEL="<model-id>" node --experimental-strip-types src/experiments/css-challenge/fix-loop.ts \
  --fixture page --seed 11 --mode selector --max-rounds 2
```

3. **Measure VLM quality** (token count, latency, CHANGE detection count):
```bash
pkf run vlm-bench -- <model1> <model2> <model3> --md
```

4. **Update results in the "VLM Model Comparison" section of `docs/knowledge.md`**

5. **Save report to `docs/reports/`**:
```bash
# Filename: YYYY-MM-DD-vlm-model-benchmark-vN.md
```

### Evaluation Criteria
- Fix Loop: whether seed 11 (`.readme-body pre` 6 props, 4.1% diff) reaches FIXED
- Speed: VLM latency (1-10s acceptable range)
- Cost: /call (guideline: below $0.5e-7 is cheap)
- CHANGE detection count: number of changes following structured format (7-15 is optimal)

### Current Recommendations (2026-05-19)
- **Default**: `bytedance/ui-tars-1.5-7b` (~1.35s, ~$0/call) — UI-domain-trained, fastest of the structured outputs. Verified FIXED in round 1 on seed 11 (.readme-body pre, 4.1% diff).
- **Stable / detailed**: `qwen/qwen3-vl-30b-a3b-instruct` (~2.0s) — emits hex codes directly.
- **Baseline fallback**: `amazon/nova-lite-v1` (~2.4s).
- **High coverage + prose root-cause**: `claude:claude-haiku-4-5-20251001` (~4.2s, ~$2e-6/call). Also FIXED in round 1 on seed 11 — works as Stage-1 VLM in the 2-stage pipeline despite format divergence; Stage-2 LLM handles it. The earlier "only when VLM is consumed directly" caveat was too conservative.

#### Avoid / re-evaluate
- `meta-llama/llama-4-scout` — regressed since 2026-04-04 (was 1.0s, now ~7s with conversational output)
- `meta-llama/llama-4-maverick` — claims "image not available" and returns methodology only
- `google/gemini-2.5-flash-lite` — hallucinates uniform `red → red` deltas

See `docs/reports/2026-05-19-vlm-haiku-vs-uitars.md` for today's 2-way re-bench (haiku + UI-TARS, both FIXED r1);
`docs/reports/2026-05-18-vlm-claude-vs-openrouter-vs-newcomers.md` for the 8-way bench from the prior week.

### `vlm-region-diff` CLI Default (2026-05-23) — DEPRECATED 2026-07-30

**`diff region` is deprecated**: net-negative for agent repair in every
controlled A/B (2026-06-06), and its role is now covered deterministically
by `diff png --elements-html`, `check integrity`, and `check equivalence`.
The model notes below are kept as bench history only.

The defaults above are for **fix-loop VLMs** (Stage-1 CHANGE list + Stage-2 LLM).
`src/experiments/migration/vlm-region-diff.ts` is a different tool — it asks
the VLM directly for `{verdict, regions, baselineColor, variantColor}`. The
two roles call for different models.

- **Default**: `anthropic/claude-haiku-4-5` (~$0.005/call). Only model that
  returned `diff` with correct *direction* on the 2026-05-23 bake-off
  (expressive-menu component pair, 86% changed pixels). Per-channel hex
  numbers are still off by ~±10 — treat them as vibes, not measurements.
- **Avoid as `vlm-region-diff` default**: `bytedance/ui-tars-1.5-7b` (returns
  `diff` verdict but every region reports `baselineColor == variantColor`),
  `qwen/qwen3-vl-30b-a3b-instruct` and `google/gemini-2.5-flash` (both
  return `no-diff` on a ~6% palette shift across the entire image).

The `ui-tars` recommendation in the section above is unchanged — it remains
the fix-loop Stage-1 VLM default. It just fails specifically at the
`vlm-region-diff` job of naming color literals.

Full bench: `docs/reports/2026-05-23-vlm-region-diff-bakeoff.md`.

**A/B caveat (2026-06-06)**: in the controlled control-vs-vlmkit repair
runs, `diff region` was net-negative for agent-driven repair in every
run that tried it (wrong selector attribution, fabricated deltas —
drafts 06/09). For agent repair loops prefer the deterministic
`diff png --elements-html` path (selector candidates + shift estimates,
no VLM). See `docs/reports/2026-06-06-ab-external-synthesis.md`.

**Refutation gate (2026-06-08)**: `diff region` now cross-checks each
VLM claim against the measured bbox pixels. When the measured average
channel delta is below `PIXEL_REFUTE_FLOOR` (3) the row is demoted to
`confidence: low`, flagged `verification.refuted` in the JSON report,
and segregated into an "Unverified — measured pixels refute the VLM
claim" markdown section. This blunts the worst of 06/09 (zero-delta
rows no longer read as findings) but the deterministic path is still
the recommended default.

### Stage-2 LLM Recommendations (2026-05-22)

Hard case: `ui-tars-1.5-7b` VLM + various LLMs, seed 11 selector mode.
Full bench: `docs/reports/2026-05-22-vlm-llm-coverage-bench.md`.

- **Default**: `google/gemini-2.5-flash` via OpenRouter — **7s total, ~$0.008/run**, FIXED r1 with 11 fixes. Beats the previous `claude:claude-haiku-4-5-20251001` default on both axes (~10s, ~$0.020).
- **Cheapest still-correct (batch / cost-sensitive)**: `google/gemini-2.5-flash-lite` — **~$0.002/run**, 43s, FIXED r1. Picks up 37 fix candidates; over-generation absorbed by the apply-and-rollback gate. Note: only suitable as LLM Stage-2 — its VLM mode is in the avoid list above.
- **Independent second opinion (no Google deps)**: `moonshotai/kimi-k2` — 20s, ~$0.011/run, FIXED r1.
- **Anthropic-direct baseline**: `claude-haiku-4-5-20251001` — 10s, ~$0.020/run, FIXED r1. Useful for cross-provider sanity.

#### Avoid for Stage-2 fix synthesis
- `moonshotai/kimi-k2-thinking` — hallucinates multi-token garbage selectors (`aside#cdl figcaptionSupplymonth proportionatefailures` etc.); 47s LLM latency.
- `moonshotai/kimi-k2.5`, `moonshotai/kimi-k2.6` — return 0 fixes despite VLM CHANGE list (emits prose-only, not structured JSON). LLM latency 40-100s also disqualifies them.
- `qwen/qwen3-coder` — generates plausible-looking fixes that over-correct the whole page (diff 4.1% → 46.7%); apply-and-rollback catches it but the loop never recovers.

## Component-focused VRT (fixing one component with a small image)

```bash
# Runnable example: a plain-JS gallery, no dev server or bundler needed.
cd examples/story-gallery
G="file://$PWD/index.html"
vlmkit check story components/Button/Primary Card/Default --gallery "$G"   # writes baselines
vlmkit check story components/Button/Primary Card/Default --gallery "$G"   # compares
vlmkit check story components/Button/Primary --gallery "$G" --update-baseline
```

Use this instead of `diff html` when repairing ONE component: the shot is the
component's own box (~47x fewer pixels than the viewport on the example), and a
change to one component does not make its neighbours report.

`check story` drives the Playwright **gallery contract** — `window.mount({ story,
props })` / `window.unmount()` rendering into `#root` — via `page.evaluate`, which
is how Playwright's own `mount` fixture works. Consequences:

- **No Playwright version floor.** The `mount` fixture is 1.62+; the repo pins
  1.61 and this does not use the fixture. Do not add a peer-dep bump for it.
- The gallery is framework-specific and the project's to own; `examples/story-gallery/README.md`
  carries a React + Vite one to copy. Storybook needs a shim (no `window.mount`).
- Baselines are keyed on the story id **as written**, so `Button/Primary` and
  `components/Button/Primary` get separate baselines. List the canonical spelling
  in `vlmkit.gates.json`.

## Explanatory animations (`vlmkit-anim`) and their evaluation loop

```bash
vlmkit-anim schema --kind sort                      # the writing guide for one kind (docs/anim-ir.md has all nineteen)
vlmkit-anim schema --kind modules                   # the still-figure preset: a module map (modules / deps / groups), layered, cycle-checked
vlmkit-anim schema --kind annotations               # the six ops every kind shares (value / callout / snapshot / group / text / relate) and each kind's anchors
vlmkit-anim check scene.json                        # validate → compile → semantic checks → stats; exit 1 on ✗
vlmkit-anim check scene.ts                          # same, for a module whose default export is `scene.<kind>({…})` (typed authoring)
vlmkit-anim explain scene.json                      # narration as a numbered list
vlmkit-anim render scene.json --step 4 --out f.svg  # one frame, headless and deterministic
vlmkit-anim still scene.json --out map.svg          # the figure: final frame, no caption, cropped to what is drawn (.png needs playwright)
vlmkit-anim html scene.json --out page.html         # <vlm-anim> runtime inline; `vlmkit check animation page.html` works on it
vlmkit-anim video scene.json --out demo.gif --width 480   # GIF encoded in-process; .mp4/.webm run ffmpeg or leave frames + the command
vlmkit-anim eval page.html                          # the shared frame-sampled evaluator on an emitted page (same report as `vlmkit check animation`)
vlmkit-anim check scene.json --expect facts.json    # …and the figure against its facts (modules, deps "a->b", forbidden, highlighted in the final frame, group members) — a green check on a wrong picture was v13's finding
vlmkit-anim check walk.json --expect facts.json     # …a graph's visit order and path, a state machine's transitions / end state, a distributed scene's messages and lost ones (v18)
vlmkit-anim facts packages/x/src --depth 1 --out x.expect.json   # a fact sheet from a directory's import graph: a map drawn by hand from the code is checked against the code
vlmkit-anim diff before.json after.json --out change.svg --expect diff.json   # two module maps as one figure: added in accent, removed dashed grey; the change checked against a diff sheet (v22)
vlmkit-anim import mermaid docs/page.md --out scene.json   # a flowchart / graph, sequenceDiagram or stateDiagram-v2 the repo already has, as a scene; says what it dropped (v23; `@mizchi/vlmkit-anim/remark` embeds ```vlm-anim fences)
vlmkit-anim layout scene.json                       # texts on texts / under boxes / past the edge / lines through texts, per step, from the timeline (also warnings in `check`)
vlmkit-anim why scene.json [--about id]             # the compiler's account of a modules / diagram picture: the pair of boxes that set each canvas axis, rows vs bands and their share, what put each box on its layer, which box an edge bent round (v24)
vlmkit-anim review scene.json --out dir [--model M | --answers a.json]   # contact sheet + review brief for a vision model or an agent; scores its JSON against `layout`
vlmkit-anim repo --out docs/diagrams --name vlmkit-architecture   # the workspace drawn layer by layer (pnpm anim:diagrams regenerates docs/diagrams/)
vlmkit-anim pr --base origin/main --out .vlmkit-anim/pr           # the change map of a branch: one beat per commit, areas + import edges + counts; <name>.md is paste-ready
vlmkit-anim pr --base origin/main --mermaid                       # the same map as Markdown: a mermaid flowchart of areas + a commit table; no browser (`repo --mermaid` for the workspace)
```

The `pr-visual` workflow runs `vlmkit-anim pr --mermaid` on every same-repo pull request and keeps
one comment on the PR up to date with the result — the shape of a change before the diff.

**In this repository, explain concepts with mermaid.** Animated reviews read badly: a GIF or a
contact sheet has to be played or scanned to get what one static figure says, and it cannot be
diffed or edited in review. So a PR description, a design doc, a report or a reply that needs a
figure carries a ```` ```mermaid ```` block (flowchart / sequenceDiagram / stateDiagram-v2) that
GitHub renders inline — the README's workspace map is one, generated by `vlmkit-anim repo --mermaid`
and held to the manifests by a test. `vlmkit-anim` stays the product it is (the skills below ship
to users); it is just not how this repo explains itself. Use it here only when the question is
about the animation tool itself.

`vlmkit-anim` is a **standalone binary** (`@mizchi/vlmkit-anim`), not a `vlmkit`
subcommand. Its only workspace tie is the **evaluation** package
`@mizchi/vlmkit-animation-eval` (an optional peer, loaded by `vlmkit-anim eval`):
the frame-sampled measurement behind `vlmkit check animation` lives there, so the
animation tool and the gate share one evaluator without the tool depending on
vlmkit's capture, diff or gate plumbing. Sample outputs (one GIF and one contact
sheet per fixture) are committed under `packages/vlmkit-anim/samples/`; regenerate
with `pnpm anim:samples` after changing a compiler. In this repo run it as
`pnpm exec vlmkit-anim …` (resolves to `dist/`, so `pnpm --filter @mizchi/vlmkit-anim build`
after editing `src/`) or, without a build, `node --experimental-strip-types packages/vlmkit-anim/src/cli.ts …`.

Two skills, routed from `skills/vlmkit/SKILL.md` like the markup workflows: `explain-with-anim`
(`.claude/skills/explain-with-anim/`) is for answering a question — "how does this work", "how is
this structured", "what does this PR change" — with a figure drawn from the code (`facts` / `repo` /
`pr`), checked, and a narration that walks `explain`'s beats; `explanatory-animation`
(`.claude/skills/explanatory-animation/`) is how a scene is written and checked. It points at
`docs/anim-ir.md` as the one page to read and says how to read `check`'s canvas and crossing lines,
`--expect`, `why` and `import mermaid`'s dropped list.

A third skill in the same class, `d2-diagram` (`.claude/skills/d2-diagram/`), is for a diagram whose
deliverable is D2 text laid out by TALA (D2's whiteboard-style engine, open source and bundled since D2 0.9)
and read in the terminal: `d2 --layout=tala x.d2 x.txt` renders the layout as box drawing, `--ascii-mode
standard` as plain ASCII for a README or PR, `.svg` / `.png` for docs. Pass the flag: the in-file
`layout-engine: tala` was honoured for SVG and not for `.txt` on the build measured. A D2 diagram is a
drawing — nothing checks it against the code — so a map that must be true is `explanatory-animation`'s, or
is drawn from `vlmkit-anim facts`' sheet.

```bash
d2 layout                                                   # must list `tala (bundled)` — the gate, not the version string
d2 fmt --check x.d2 && d2 validate x.d2                     # formatted (in place without --check) and syntactically valid
node .claude/skills/d2-diagram/assets/d2-facts.mjs x.d2 [--expect x.facts.json]   # what the picture DRAWS, held to a sheet
LC_ALL=C.UTF-8 wc -L x.txt                                  # columns; in the C locale wc -L undercounts and awk reports BYTES
```

`d2-facts.mjs` is the check D2 does not have, and it is the one thing to reach for before trusting a D2
figure: d2 writes every shape's and every connection's fully-qualified id (plus geometry and labels) into
the SVG, so the drawn picture is readable back — missing / reversed / invented edges, container membership,
a sequence diagram's message order, sibling overlaps, the width, and above all **a name drawn twice**.
That last one is D2's sharpest trap: a reference to an id that is not in scope *creates a new shape* rather
than failing, so `gateway -> orders` written at the root when both live in containers silently adds two
more boxes. Reach out of a container with a full path (`_.outside.stripe`, not `_.stripe`). The evaluation
round that found this — three of four fresh writers factually correct, the fourth green with four phantom
boxes — is `fixtures/d2-scenario/` and `docs/reports/2026-09-14-d2-diagram-v1.md`, which also records the
measured width levers (they are not monotone; the fullest container's own `direction` is the first lever)
and what the terminal render silently drops (every connection style, `sql_table` constraint badges, `<<`).

A fourth, `d2-slides` (`.claude/skills/d2-slides/`), turns one Markdown file into a slide deck whose figures
TALA lays out: prose in Markdown, a ```d2 fence per figure, and
`node .claude/skills/d2-slides/assets/build-deck.mjs deck.md --out dist` emits a self-contained
`index.html` (1280x720 frames, keyboard nav, overview, `#/4` deep links), a stacked `print.html`, each figure
as `slide-NN.svg`, and `copy.txt`. The deck is a page, which is the point — `vlmkit check integrity` on both
views, `check copy --manifest` and `check a11y contrast` on `print.html` (one slide is on screen at a time, so
the deck view only ever shows the gates its first slide). Those gates found three real defects in the template
while it was being written: a 1280px stage centred as a grid item painted nothing at 375px, a percentage
height inside a padded frame clipped 114px on every slide, and a centred split layout cut long bullets off at
both ends. Worked example and the gate runs: `examples/d2-slides/`.

That loop is itself gated, in two halves, because the halves need different machines. `tests/d2-slides.test.mjs`
runs in the ordinary suite with `D2` pointed at a stub that echoes a fixed SVG, and checks everything the builder
decides before a figure is drawn — slide splitting (a `---` inside a fence is not a separator), layout choice, the
manifest taken from the *render*, the overflow warning naming the slide, a figure that fails to compile — plus that
`examples/d2-slides/built/` still matches its `deck.md`. The `d2-slides` workflow installs `d2` pinned at `v0.9.0`,
rebuilds the example, compares every byte with the committed build, runs the four gates, and then breaks the deck
twice to prove they still fail: an extra manifest line must report `copy-missing`, and `--stage-h: 260px` must
report `clipped-content`. Regenerate the committed build with `pnpm deck:example` — it is byte-reproducible for a
given `d2` (each figure carries `--salt=sN`), which is what makes the byte comparison possible at all.

`docs/reports/2026-09-14-d2-diagram-v2.md` is the round with the sheet in the writer's hands: no wrong
picture in four attempts and the small model down from 14 errors to 0 in two rounds, so the failures moved
to what a sheet cannot reach. The three that matter when reading a D2 figure: a `top` / `left` pin can push
shapes off the ascii canvas, which reads as a **narrower** render (`d2` exits 0 on the fragment, and
`d2-facts` now errors on it — re-read the render after any pin); a width budget can simply be unreachable
without one (five `sql_table`s bottomed out at 113 columns, so split the file or say the number in the
prose); and `_` is one level and only valid inside a container (`_.outside.stripe` from inside `cluster`,
`invalid underscore` at the root), which is why cross-container connections go at the root with full paths.

The IR is judged on two things, measured by fresh subagents rather than by
reading the code: **an agent gets it right from `docs/anim-ir.md` alone**, and
**intent is readable when someone edits the file later**. Scenario fixture:
`fixtures/anim-scenario/` (briefs, a re-edit task, per-agent attempts).
Procedure is the `agent-validation-loop` skill; prompt the agent with one brief
and the guide, forbid `packages/vlmkit-anim/` and other attempts, and record
first-attempt ✗ count, rounds to green, scene bytes, and its friction verbatim.
Reports: `docs/reports/2026-09-04-anim-ir-v*.md` (v1–v8, structures) and
`docs/reports/2026-09-05-anim-ir-v{9,10}.md` (concept introductions; the coordinate-fallback
count is the expressiveness metric — 3 of 8 scenes before the annotation layer and `compose`, 1 of 7 after),
`docs/reports/2026-09-05-anim-ir-v11.md` (re-edits of annotated scenes: every readout and relation followed
the data change; the round's defects were layout, fixed in the compiler, not in the writer's hands),
`docs/reports/2026-09-05-anim-ir-v12.md` (the frames measured two ways — `layout` geometry and vision readers on
the contact sheet — and compared; annotations now place themselves off other text),
`docs/reports/2026-09-06-anim-ir-v13.md` (the first still-figure round: five module maps, all green and all with lines
through labels the geometry could not see; `layout` now reports `crossed`, and the module layout, edge routing,
container labels, annotation placement and arcs were reworked until the five scenes went from 91 crossings to 2),
`docs/reports/2026-09-06-anim-ir-v14.md` (the figure against its facts: `check --expect facts.json` names v13's two
green-but-wrong pictures in one line each; four writers with fact sheets were four green, and the sheet caught one
wrong final highlight on the first run), `docs/reports/2026-09-07-anim-ir-v15.md` (labels in Japanese: a CJK glyph
is one em and every width estimate had said 0.6, so `layout`'s green was a lie on Japanese figures; measured against
Chromium, fixed in one module; the state-machine compiler learned the diagram's edge routing when a writer's only
fix for a transition through a state was to reorder the list), `docs/reports/2026-09-08-anim-ir-v16.md` (a still's
own vocabulary: `tone` on modules and dependencies, `"style": "implements"`, `relate` `"style": "equals"` — the two
asks the v13 writers left open, drawn by two writers on a brief that needs all three), `docs/reports/2026-09-08-anim-ir-v17.md`
(where an annotation lands: the canvas grows on the side the writer asked for — left and above included, the picture
shifts — and a callout's pointer goes round labelled boxes; three writers record asked side against landed side), `docs/reports/2026-09-08-anim-ir-v18.md`
(fact sheets for the walked kinds — a graph's visit order and path, a state machine's transitions and end state, a
distributed scene's messages and lost ones — and `vlmkit-anim facts` writing one from a directory's import graph; the
four writers' sheets all matched, and every further round was a compiler defect the round fixed: the token on a short
label, a 35px circle of four states, labels on states, a distance label under an edge), `docs/reports/2026-09-08-anim-ir-v19.md`
(two kinds — `flowchart` with decision diamonds, labelled ways out, a walked path and loops round the outside, and `gantt`
with bars on a unit axis, dependencies, a cursor, cascading slips — both flowchart writers green on the first write; the
gantt writer's five rounds were one callout that a moving cursor label walked under, fixed in the compiler), `docs/reports/2026-09-09-anim-ir-v20.md`
(the last two shapes on the list — `sequence` with activation bars and `loop` / `alt` frames, and groups inside groups with `parent` —
three writers green on the first write; the round's two compiler defects were found on the fixtures, a nested box running into its
neighbour and an activation bar cutting a frame's tag in two, which `layout` had not counted because a 10px bar covers little area;
it counts now), `docs/reports/2026-09-09-anim-ir-v21.md` (a still figure read back: `review --still` hands a vision reader the figure
and scores its reading against the facts the scene draws — read / missed / invented / reversed / misplaced, one fidelity number; nine
figures read before and after, four findings the geometry could not see fixed in the compilers — containers crossing, a label at a
bottom corner read as a caption, forbidden arrows filed as highlights, fans out of one corner — and one ceiling named: at 26 arrows
on 11 boxes a map reads back at 0.5–0.8 whatever the routing), `docs/reports/2026-09-09-anim-ir-v22.md` (the diff figure: `vlmkit-anim diff
before.json after.json` draws two module maps as one still — added in accent, removed dashed grey, a legend — and prints the change as facts
checked against a diff sheet with `--expect`; two writers green on the first write, a reader read the change back at fidelity 0.83 and
mistook which arrow an edge label belonged to), `docs/reports/2026-09-09-anim-ir-v23.md` (scenes in Markdown and mermaid as scenes: a
dependency-free remark plugin turns ```vlm-anim fences into the runtime or a still, and `import mermaid` reads flowchart / graph,
sequenceDiagram and stateDiagram-v2 into scenes naming what it dropped; the sequence import matched its fact sheet with no edit, the
22-node pipeline was faithful and laid out at 2989px, and the three compiler defects under that one warning — a canvas guessed from
counts, a parent's children spread evenly through one band, a detour routed through the box — were fixed until the import as-is is a
clean 1751px figure; a 32-node graph at 13277px names the next layout change, band widths by content, and the first case for `why`),
`docs/reports/2026-09-09-anim-ir-v24.md` (`vlmkit-anim why`: the compiler's account of a modules / diagram picture — the pair of boxes that
set each canvas axis, rows vs bands and their share, what put each box on its layer, which box an edge bent round — and bands sized by their
fullest layer's boxes (13277px → 8882px on the 32-node graph); two writers read the banding cause off `why` before their first edit and
brought the graph to 1805px and 1806px, both asking for the cause in `check`'s warning itself, which it now carries; the module map's own
count-based canvas guess was replaced by the shared estimator after a kind switch moved a writer's canvas from 986px to 1806px).

## Design quality: the three gates, and which sees what

Three deterministic gates measure "does this look right", on disjoint evidence.
Run all three — none subsumes another, and the proof in each case is measured:
`check design` prints **byte-identical** findings on
`fixtures/composition/proximity-broken.html` and on the intact page, and
`check a11y contrast` **passes every** `color-only-link` that `check color`
reports (caniuse's `#0046d1` note links are 8.2:1 against the page and 2.8:1
against the sentence they sit in — a different criterion, correctly satisfied).

```bash
vlmkit check design      page.html   # 反復: are components styled consistently (style signatures)
vlmkit check composition page.html   # 近接/整列/対比: label grouping, page rails, declared type hierarchy
vlmkit check color       page.html   # the palette by role, and where colour alone carries a meaning
```

| Principle | Where it lives | The measurable claim |
|---|---|---|
| 近接 proximity | `check composition` / `proximity-inversion` (warn) | A label's gap to its content is >=1.5x its gap to the boundary above AND >=8px wider, so it groups upward |
| 整列 alignment | `check composition` / `rail-near-miss` (**info**) | Two **siblings** sit on rails 2-8px apart, so the same edge was available to both. A12 in `check integrity` (`near-misalignment`) shares the 2-8px window but needs siblings that already share an edge exactly, so it is **not** a duplicate: of the three rail mutants it catches `rail-broken` only, and misses `-shrink` and `-nested` (measured 2026-09-24) |
| 反復 repetition | `check design` / `component-drift` | Instances per distinct style signature, below 3x |
| 対比 contrast | `check composition` / `flat-heading-step`, `no-type-contrast` (warn) | Two DECLARED heading levels render at one size and weight; or nothing is >=1.3x body size and nothing >=200 weight heavier |

Both report **inconsistency, never which value is correct**, and nothing exceeds
`warn` — taste stays with humans.

**The three share their plumbing — a fourth style gate reuses it rather than copying a sibling.**
Each collector splices `STYLE_SAMPLING_JS` (`style/style-sampling.ts`: `visible` / `px` / `path`),
and each judge filters `--allow` through `selectorAllowFilter` (`inspect/selector-exemption.ts`).
Composition had been pasted from design and colour re-typed from both; the re-typed copies were
where the defects were — an SVG's class read as `svg.[object`, a mistyped `--allow` that said
nothing. `path` matters most: it is the selector every finding carries and the string `--allow`
matches, so two spellings of it break exemptions across gates. A gate that needs a different
answer names it next to its collector instead of redefining the shared word — colour's `painted`
keeps an off-screen `content-visibility: auto` footer that the shared `visible` skips, and drops
closed-`<details>` content, which a size test alone had counted as paint.

### What was rejected, so it does not get re-proposed

Six candidate metrics were measured against paired mutants and thrown out. Read
`docs/design/composition-metrics.md` before adding a fifth composition rule; the
two traps worth knowing up front:

- **Per-container alignment is free.** A column rail score is 1.00 on 14 of 16
  pages, because block layout hands every child the same left edge. Same trap as
  the 4px-grid metric: it measures CSS, not design.
- **Two candidates ran BACKWARDS.** Designed pages use *more* font sizes (3-14
  vs 2-4) and *more* near-equal size pairs than generated ones. Contrast is only
  judgeable against the hierarchy the page itself declares.

The corpus split `check design` was built on (designed vs agent-built pages) is
**unusable** for composition: the agent fixtures are app shells with zero
heading-led groups, so the groups differ by page kind rather than by quality.
Use paired mutants — break one principle with injected CSS and require the rule
to fire on that mutant and stay silent on the other seven.

Fixtures: `fixtures/composition/` (one intact page plus one per broken
principle, each the intact page plus a single overriding rule — and **three**
for 整列, because one shape of a defect cannot tell a real narrowing from a
lucky one: `rail-broken` shifts sections by a compensated margin,
`rail-broken-shrink` by an uncompensated one so the width changes too, and
`rail-broken-nested` indents the subsections inside a section).
Reports: `docs/reports/2026-09-21-composition-principles-v1.md` (the paired-mutant
round that set every threshold), `docs/reports/2026-09-22-composition-live-corpus-v2.md`
(14 mirrored production pages — the round that found the verdict flipping on 7 of
them, all false positives, and fixed the three mechanisms) and
`docs/reports/2026-09-23-composition-rail-classification-v3.md` (every
`rail-near-miss` on that corpus classified: 46 findings, none a misalignment,
fixed to 0 by one predicate).

**Before touching `proximity-inversion`, know its two live-corpus lessons.** A
**kicker** — a breadcrumb, date or eyebrow at most half the heading's type size —
is climbed THROUGH, not measured against; the first version of that test used
text length instead of rank, absorbed a 74-character body paragraph and invented
an inversion where the real gaps were 32 and 32. And the boundary above must be a
preceding **sibling**: a container's padding-top is not something a label can be
mis-grouped with. One false-positive class is knowingly left in — a card title
bonded to its date, whose gap ratio (5.2) is *higher* than the mutant's (3.7), so
no threshold separates them. Use `--allow` for it rather than adding a fourth
number.

### `check color`: the palette by role, and colour carrying meaning alone

Extracts **surfaces / ink / marks** ranked by painted area, and names three
colours: the **base** (largest surface), the **body ink** (largest by area) and
the **link ink** (the most-used interactive ink that is **not** the body ink).
Then two rules, both carrying WCAG's own 3:1 rather than a number this repo
chose:

| Rule | Criterion | The measurable claim |
|---|---|---|
| `control-boundary-invisible` | WCAG 1.4.11 | A text field's fill or strongest border is <3:1 against the surface behind it, with no shadow or outline either |
| `color-only-link` | WCAG 1.4.1 / G183 | A link inside a flow that holds its own prose, with no underline, weight step, border or fill, <3:1 against that prose |

**Two definitions had to be measured into existence, and both are the same
lesson.** The base cannot be "the largest declared background" — danluu.com
declares **zero** backgrounds on 625 boxes, so the composited page background
stands in. And the link ink cannot be "the most-used interactive ink": that named
the **body** ink on 7 of the 14 corpus pages, because nav items, card titles and
logos are links set in the body colour on purpose. Interactive ink is also
counted **once per control**, not per box inside it — counting descendants made
css-tricks' nav (every link wrapping a span) outvote its real link colour 404 to
410.

**Before proposing a fourth colour rule, read the three that were rejected**
(`docs/reports/2026-09-23-color-roles-v1.md`); the first two run backwards:

- **base/main/accent against 70:25:5** — the 13 measurable designed pages miss it
  by **15 to 55 points**, base shares 39.6% to 97.6%. Every one would report wrong.
- **palette sprawl** — 3 to 35 distinct colours, no clustering, and the most
  careful pages are at the top. Same trap as the type-scale candidates.
- **accent role collision** — fires on 13 of 15, and the collisions are the body
  ink (Wikipedia: 257 static elements and 5 links at `#202122`).

**The round's largest finding was not a new rule.** `parseColor` in
`CONTRAST_BACKGROUND_JS` matched `rgba?()` only, and Chromium serialises
non-legacy colour functions verbatim — a Tailwind v4 `oklch()` token computes to
`lab(1.90334 0.278696 -5.48866)`. Every caller drops a colour it cannot parse, so
`check a11y contrast` **inspected 10 of 1068 elements** on tailwindcss.com/docs
and reported one bogus `#ffffff on #ffffff` failure. It now rasterises a pixel
and reads it back, which is the browser's own conversion and gamut mapping: 501
elements inspected, the bogus row gone, four real AA failures found. 566 of that
page's 576 text-bearing elements were unreadable; the other 13 corpus pages had
none, plus 4 `oklch()` backgrounds on MDN. So the blindness is narrow in
population and **total** where it applies.

## Demo sites and judgment logs (`examples/sites/`)

Six agent-built sites (docs, shop, dashboard, magazine, checkout, kanban), the landing page and the
gallery that lists them are published on Pages **beside the log of how each was judged**:
`/sites/<name>/` and `/sites/<name>/judgment/`, `/judgment/` for the landing page, `/sites/judgment/`
for the gallery. Solitaire predates the log and its card says so. Every gate run and screenshot goes
through `examples/sites/judge.mjs`, which keeps a run's exit code and whole output, takes one screen
per image, and makes a defect name the look or gate run that found it:

```bash
J="node examples/sites/judge.mjs examples/sites/docs"
$J status; $J check                                  # where the log stands; what it needs before done
$J round --actor reviewer "what this pass is"        # any change to a judged page is a new round
$J gate check integrity index.html                   # any vlmkit command, paths relative to the site dir
$J shot index.html --full --viewport desktop,mobile  # then Read EVERY file it prints
$J look S12 - <<'EOF' … what is in the picture … EOF
$J done - <<'EOF' … EOF                              # refuses until check passes; renders the log page
node examples/sites/gallery.mjs                      # after any log changes: the gallery is generated
node examples/vlmkit-intro-page/server.mjs           # the Pages layout on :4190 — the gallery and the landing log only resolve there
```

The protocol is `examples/sites/PROTOCOL.md`; the round's findings are
`docs/reports/2026-09-23-demo-sites-v1.md` — **135 of 179 defects across the eight logs were found by
looking, not by a gate**, which is why `markup-assist`'s done condition now ends with "then look at it".

- **A log is one file, `judgment.sqlite`** (events, every gate output, the screens it keeps), next to
  `JUDGMENT.md` (text, no pictures; links into the published page). `judgment/` beside it is a
  gitignored **export** — the screens `shot` writes for you to Read, the page `render` writes — so
  never commit it and never treat it as the record. The loose-file version was 2107 files for eight
  logs. Query it with any SQLite reader: `events(seq, kind, id, round, json)`, `outputs(path, text)`,
  `screens(path, webp)`.
- **A finished round keeps one full-page walk per width.** `done` (and `render`) drop every other
  screen of the rounds it closes — close-ups, states, repeat walks — keeping the last walk at desktop,
  tablet and phone width that shows the page as a visitor lands on it. The shots, looks and defects
  stay; only their pictures go (1418 screens → 554 on the first eight logs). So **write every look
  before `done`**: `look` refuses a shot whose screens are gone, and a state you want pictured after
  the round has to be shot again.
- **Held by tests, not by care.** `examples/sites/sites.test.mjs`: every log passes its own `check`
  and ends in `done`, its database holds exactly the gate outputs it names and the screens it keeps,
  and its committed `JUDGMENT.md` equals a fresh render; the gallery equals a fresh `gallery.mjs`.
  `tests/pages-site.test.mjs`: the published tree is the manifest file for file, byte for byte
  against the database for a log's page and screens, and all ~1300 relative links on the 19
  published pages resolve. The deploy workflow also runs
  `gates run --config examples/sites/vlmkit.gates.json` (its `webServer` starts the intro server).
- **Published half only.** `build-pages.mjs` publishes a log's page and the screens it keeps, read
  out of its `judgment.sqlite`. The database itself (raw events, gate outputs the page inlines) and
  whatever a gate wrote to `test-results/` stay in the repo or local.
- **The local server reads the logs per request**, so a screen taken while it runs is served without
  a restart. It still builds the runtime-file routes at startup.
- **`shot --element` takes the first match** (`footer` hit a pull quote's `<footer>`), and a full
  walk stops at 16 screens — the `[judge]` line says `STOPPED SHORT` and `check` refuses the shot as
  the round's full page until `--max-tiles` reaches the end.
- **No gate emulates `prefers-color-scheme`.** A page that follows the OS theme gets its dark theme
  judged by eye (`shot --dark`); the demo sites use `?theme=dark` so the gates can reach it.
- **`--allow` matches the path a gate prints** (`ul.grid>li.card>div.body>h2>a`), not a CSS selector,
  and says "matched nothing" when it does not apply.

## Measuring Gate / Rule Execution Cost

```bash
# One run, per-phase split (parse / run / findings / rules / format / ledger)
vlmkit check integrity page.html --timing

# Every gate that works from a bare page (18 of 26 when measured 2026-08-06; `check story`
# landed the next day), ranked by cost, with yield
vlmkit bench gates fixtures/css-challenge/page.html --repeat 3

# Full corpus + the "does turning rules off save time" probe, as markdown
vlmkit bench gates fixtures/css-challenge/{page,dashboard,form-app}.html \
  --repeat 3 --probe-suppression --md --out docs/reports/YYYY-MM-DD-gate-bench.md
```

**Per-rule cost is attributed, not isolated, and that is structural.** A gate does
one measurement (`run`) and every rule it declares reads that same report, so
`run` is ~100% of wall clock and the projection is under a millisecond across all
18 gates. Consequences worth remembering before optimizing anything:

- `--rule x=off` does **not** speed up a run (settings apply after the
  measurement). Measured at +0.4% — noise.
- The cost unit is the **gate**. Spend less by dropping a gate or narrowing its
  inputs (fewer viewports, no `--sweep`, shorter `--observe`).
- Four gates are ~60% of a full sweep: `check interactions`, `stress media`,
  `check perf`, `check integrity`. `check interactions` varies 5x by page.

Baseline: `docs/reports/2026-08-06-gate-rule-cost-bench.md`.

## Running CSS Challenge Benchmarks

### Cross-fixture Matrix
```bash
NO_IMAGES=1 node --experimental-strip-types src/experiments/css-challenge/css-challenge-bench.ts \
  --fixture all --mode selector --trials 10 --no-db
```

### Crater Prescanner Bench (requires crater server running)
```bash
# Start crater
cd ~/ghq/github.com/mizchi/crater && just build-bidi && just start-bidi-with-font

# Run bench
pkf run css-bench-crater -- --fixture page --trials 30
```

### Tracking Detection Rate
```bash
pkf run css-report  # Aggregate accumulated data
```

## Running Migration VRT

```bash
# Tailwind → vanilla CSS
pkf run migration-tailwind

# Reset CSS comparison
pkf run migration-reset

# File comparison
vlmkit diff html before.html after.html

# URL comparison
vlmkit diff html --url http://localhost:3000/ --current-url http://localhost:8080/

# With masks (exclude dynamic content)
vlmkit diff html --url http://localhost:3000/ --current-url http://localhost:8080/ --mask ".marquee-container,.hero-badge"
```

## Snapshot (URL → multi-viewport capture)

```bash
# First run: create baseline. Subsequent runs: baseline + diff
vlmkit snapshot http://localhost:3000/ http://localhost:3000/about/ --output snapshots/

# With masks (exclude animated/dynamic elements)
vlmkit snapshot http://localhost:3000/ --mask ".marquee-container,.hero-badge"
```

## Dogfooding

```bash
# luna.mbt (requires: npx serve ~/ghq/.../luna.mbt/dist/luna -p 4200)
pkf run dogfood-luna

# sol.mbt (requires: npx serve ~/ghq/.../sol.mbt/website/dist-docs -p 3000)
pkf run dogfood-sol

# False positive test (compare same URL twice)
pkf run false-positive --url http://localhost:3000/luna/
```

## Running Fix Loop

```bash
# Property mode (delete 1 CSS property)
pkf run fix-loop -- --fixture page --seed 42

# Selector mode (delete 1 selector block)
pkf run fix-loop -- --fixture page --seed 11 --mode selector --max-rounds 3

# Specify a VLM model
VLMKIT_VLM_MODEL="bytedance/ui-tars-1.5-7b" pkf run fix-loop -- --fixture page --seed 11 --mode selector
```

## Environment Variables

| Variable | Purpose | Default |
|------|------|----------|
| `VLMKIT_LLM_PROVIDER` | LLM provider | gemini |
| `VLMKIT_LLM_MODEL` | LLM model | Provider default |
| `VLMKIT_VLM_MODEL` | VLM model (OpenRouter / `gemini:` / `claude:`) | bytedance/ui-tars-1.5-7b |
| `OPENROUTER_API_KEY` | OpenRouter API key | — |
| `GEMINI_API_KEY` | Google AI API key | — |
| `ANTHROPIC_API_KEY` | Anthropic API key | — |
| `DEBUG_VLMKIT` | Enable debug logs | — |

### Which model to set, by who is asking

Set your own family's model so a run is reproducible from the transcript. The same table is in
[`AGENTS.md`](../AGENTS.md), which is what a non-Claude agent reads, and
`tests/agent-model-defaults.test.mjs` pins the two to each other and to the code.

- **Claude Code** (this file's reader): `VLMKIT_VLM_MODEL=claude:claude-haiku-4-5-20251001`,
  `VLMKIT_LLM_PROVIDER=anthropic` — the benchmarked recommendations above.
- **Codex / any OpenAI-based agent**: `VLMKIT_VLM_MODEL=openai/gpt-5.6-luna` and
  `VLMKIT_LLM_PROVIDER=openrouter VLMKIT_LLM_MODEL=openai/gpt-5.6-luna`.

`openai` is **not** a provider name — there is no `api.openai.com` client and no `OPENAI_API_KEY`
in this codebase, and the `openai/` in the id is an OpenRouter catalogue prefix. Setting
`VLMKIT_LLM_PROVIDER=openai` fails with `INVALID_PROVIDER`; the message now names the route, and
`OPENAI_DEFAULT_MODEL` in `packages/vlmkit-ai/src/llm-client.ts` is the one place the id is written.

## Package Layout

This repository is a pnpm workspace.

| Path | Contents |
|------|----------|
| `packages/vlmkit-judge/` | **Pure judges** (`judgeComposition`, `judgeColorRoles`, `judgeDesignPolicy`, the 15 `check integrity` judges, both `--allow` parsers, `UsageError`): snapshot in, findings out. Zero deps, no DOM / Playwright / `node:*` — `purity.test.ts` enforces it, `scene-graph.test.ts` judges a non-DOM game menu. The bottom layer (`judge ← core ← capture ← markup`); markup re-exports every moved symbol from its old path. `scene.ts` is the **scene contract** — the image-mode `--elements` JSON as `SceneElement`, plus `sceneFromTree` (engine-style local coordinates) and adapters to integrity, composition, colour and design (`check color --elements` reads `role: field | link | button`; `check design --elements` groups by any `role`); `integrity-image.ts` is only its file-reading half. `color.ts` is the page's colour arithmetic as pure functions, and `vlmkit-markup/src/contrast-parity.test.ts` holds the two to each other (functions over a grid, and the real `COLLECT_TEXT_CONTRAST` vs the scene adapter on one page). Rule: the collector resolves colours, the judge composites and measures. Both DOM contrast collectors follow it: `COLLECT_TEXT_CONTRAST` ships `TextContrastSample`s (colour, background layers, opacity, font) to `textContrastCandidates`, and `COLLECT_COLOR_ROLES` ships `ControlSample` / `LinkSample` to `controlBoundary` / `linkCue`; each move was proven by byte-identical `--json` on 15-16 pages. Plan for the rest of the split: `docs/design/package-decomposition.md`. |
| `packages/vlmkit-core/` | Image / CSS / DOM / a11y diff engine + shared types and CLI helpers. No Playwright or AI deps required to import core types. |
| `packages/vlmkit-core/src/plugin/` | **Gate plugin runtime**: the contract (`defineGate` / `definePlugin`), rule tables and settings, the registry, and the core runner that owns `--help` / `--json` / `--advisory` / the run ledger / the exit code. Core never imports a gate — definitions are handed to it. |
| `packages/vlmkit-markup/src/gates/` | Gate definitions (`*.gate.ts`) + the main built-in plugin (`index.ts`) — 28 of the 30 gates. Wraps existing measurement code; adding a gate is `defineGate` + one line in `index.ts`. |
| `packages/vlmkit-capture/src/gates/`, `src/gates/` | The other two built-in plugins: `check crater` (capture) and `check perf` (app-side). Composed by `src/cli/gate-registry.ts` alongside any `vlmkit.config.json` `"plugins"`. |
| `packages/vlmkit-capture/` | Playwright / Crater capture infrastructure, viewport discovery, prescanner. |
| `packages/vlmkit-ai/` | VLM / LLM clients, reasoning pipeline, NLP helpers. |
| `packages/vlmkit-markup/` | VLM-driven markup tooling: component extract / from-image, design tokens, theme parity, i18n stress, palette, dep-graph, selector-heal, smoke-runner. |
| `packages/vlmkit-animation-eval/` | **Frame-sampled animation evaluator** (`runAnimationEval`): the measurement behind `vlmkit check animation` and `vlmkit-anim eval`. Depends on core + Playwright only; the first evaluation tool split out so the animation tool can share it without the rest of vlmkit. |
| `packages/vlmkit-anim/` | **Explanatory animation IR** (`vlmkit-anim`): Scene IR (sort / array / stack / queue / list / state-machine / heap / tree / distributed / matrix / graph / chart / flowchart / gantt / sequence / diagram / modules / vector) → Timeline IR → `<vlm-anim>` runtime (SVG + Web Animations) and headless SVG frames. Writing guide `docs/anim-ir.md`; design `docs/design/anim-ir.md`. Every JSON block in the guide is compiled by `docs.test.ts` — edit the guide and the examples together. |
| `src/cli/` | CLI entry + router + workflow command implementations (split per-command under `cli/workflow/`). |
| `src/api/` | HTTP API server (deep-imports vlmkit-markup smoke-runner + experiments/css-challenge). |
| `src/experiments/` | migration, css-challenge, detection, benchmark, flaker. |
| `src/demo/` | Demo scripts. |
| `src/util/` | App-side helpers (agent, goal-runner, skill, perf, integration tests). |
| `src/vrt/snapshot/`, `src/vrt/compare/` | Baseline / snapshot / flipbook workflow. |

Cross-package imports use `@mizchi/vlmkit-<pkg>/<path>.ts` or the curated barrel `@mizchi/vlmkit-<pkg>`. Within a package, use relative imports. The barrel excludes Playwright-bound and CLI-entry modules — deep-import those. (This line said `@mizchi/vrt-<pkg>`, which no package has been called since 0.6 — an import written from it does not resolve.)

Run tests for a single package: `pnpm --filter @mizchi/vlmkit-core test`. From repo root, `pnpm test` runs all. **Editing a `packages/*/src` file and then running the CLI shows the OLD behavior**: `@mizchi/vlmkit-*` resolves through `exports` to `dist/*.mjs`, so `pnpm build` has to run in between (and never pipe its output to `head` — SIGPIPE leaves a half-deleted `dist/`).

The `vlmkit-markup` markup-core tests build MoonBit sources on demand and need the `moon` CLI. If tests fail with `spawnSync moon ENOENT`, add it to PATH first (it is often installed but not on PATH in sandboxes): `export PATH="$HOME/.moon/bin:$PATH"`. If it is not installed at all: `curl -fsSL https://cli.moonbitlang.com/install/unix.sh | bash`. Without it ~138 tests fail on the toolchain rather than on anything real, so install it before trusting a red suite.

**After editing anything under `.claude/skills/`, run `pnpm sync:skills`.** The content lives there once and is copied into two installer packages (`skills/vlmkit/workflows/`, `.apm/skills/vlmkit/`); `tests/skill-package.test.mjs` fails if the three drift, and hand-editing a copy is the wrong repair.

There are **three** publication routes and still only those **two** copies. The third is the Claude Code plugin marketplace, `.claude-plugin/marketplace.json`, whose one plugin's `source` is `./skills/vlmkit` — the package the npm installer already publishes. So it adds no third copy and nothing new for `pnpm sync:skills` to remember; `tests/skill-package.test.mjs` asserts that (the plugin root holds `SKILL.md` and no `skills/` subdirectory, which is what makes it a single-skill plugin needing no `plugin.json`). A new directory under `.claude-plugin/` would be a fourth copy and is the wrong repair for anything. The manifest deliberately carries no `version`: with a relative source in a git-hosted marketplace, update detection falls back to the commit SHA, so every skill edit ships — pinning a version would hide edits until someone bumped it, and `package.json`'s version is the CLI's, not the skills'.

**Commands invoked from `.github/workflows/` are checked by `tests/workflow-commands.test.mjs`.** Renaming or removing a CLI verb fails that test rather than a 15-minute browser job — or, worse, than nothing at all when the workflow step ends in `|| true`.

## Documentation Structure

| File | Contents |
|---------|------|
| `docs/markup-assist.md` | Context-free guide to the deterministic markup gates (CLI / MCP / skill install, task routing, done-condition recipes) |
| `docs/cli-reference.md` | Complete command reference moved out of README (groups, examples, workflow/API/HTTP, architecture, project structure) |
| `docs/configuration.md` | Setup detail moved out of README (install, MCP/skill, env vars, snapshot/CI config, APM skills catalog) |
| `docs/knowledge.md` | Accumulated experiment findings (detection rates, VLM comparisons, fix patterns, etc.) |
| `docs/api-design.md` | CLI / library API design |
| `docs/reports/2026-08-06-gate-rule-cost-bench.md` | Measured gate/rule execution cost: where a ruleset's time goes, why per-rule cost is attributed rather than isolated, why suppression saves nothing |
| `docs/anim-ir.md` | **Writing guide for `vlmkit-anim`**: the eighteen scene kinds (seventeen structures + `compose`), the annotation ops every kind shares, the timeline layer, embedding. The one page an agent reads before producing a scene |
| `docs/design/anim-ir.md` | Why two layers, why SVG + WAAPI over Remotion, what the semantic checks read back from frames, the evaluation criteria (intent readable on re-edit; correct from little context) |
| `docs/authoring-gates.md` | **User-facing how-to for adding a metric**: the contract field by field, choosing severities/categories, reading project config, browser measurement, testing, publishing. Runnable examples in `examples/gate-plugin/` |
| `docs/design/package-decomposition.md` | **Splitting vlmkit by layer** (collector / pure judge / driver / loop / diagrams): what was measured, phase 1 (`vlmkit-judge`) and the proposed phases 2-5 |
| `docs/design/gate-plugin-architecture.md` | Gate plugin contract, rule settings, the 30 gates + 191 rules, behavior changes, what is deliberately not a gate |
| `docs/design/moonbit-boundary.md` | **TS ↔ MoonBit boundary**: what the positional FFI costs (61 commands, 233 args, 2 duplicated dispatch tables), the JSON boundary that replaces it for new logic, how to add a command, and which pure logic belongs in MoonBit versus which deliberately does not |
| `docs/crater-css-status.md` | Crater CSS rendering verification status |
| `docs/reset-css-comparison.md` | Reset CSS domain knowledge |
| `docs/reports/` | Individual experiment reports (dated) |
| `TODO.md` | Done / Evaluation / Backlog |
