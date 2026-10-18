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

## Zoom: let any VLM crop and magnify the original (`@mizchi/vlmkit-ai/zoom.ts`)

```bash
# Bench a model with and without zoom on the same image (needs that provider's key)
node --experimental-strip-types src/experiments/benchmark/vlm-bench.ts --zoom --max-zooms 6 qwen/qwen3-vl-30b-a3b-instruct
```

```ts
import { analyzeWithZoom } from "@mizchi/vlmkit-ai/zoom.ts";
const res = await analyzeWithZoom(await resolveModel("claude:claude-haiku-4-5-20251001"),
  [{ png: baseline, label: "Baseline" }, { png: current, label: "Current" }], "What changed?", { maxZooms: 4 });
// res.content, res.costUsd, res.zoom.zooms (view box + original box per zoom)
```

The technique of Anthropic's multimodal zoom cookbook, **with nothing provider-specific**: the loop
(`runZoomLoop`) talks to a `VisionChatDriver`, and three drivers render one transcript onto three wire
formats by `fetch` — OpenAI-compatible (OpenRouter, vLLM, Ollama), Anthropic, Gemini. Rules that make
it work, not to re-learn:

- **We choose the size the model sees.** Each image is resized to a budget (`DEFAULT_IMAGE_BUDGET`,
  1568px / 1.15MP) and the model is told `Image i (WxH pixels)`; a box it names is mapped onto the
  **original** and cropped there, then magnified to the budget. Providers that resize again by their
  own rules (OpenAI's high-detail path, Gemini tiling) can shift pixel boxes — use
  `coordinates: "normalized"` (0–1000) for those.
- **Where a zoom result's image goes is the only real provider difference.** Anthropic: inside
  `tool_result`. Gemini: beside `functionResponse`. OpenAI-compatible: `tool` messages take text only,
  so the crop follows as a user image labelled with the call id.
- **Models without function calling use the text protocol** (`protocol: "text"`, or a driver with
  `nativeTools: false`): the reply carries `ZOOM <image> <x1> <y1> <x2> <y2>` lines.
- A bad box or unparseable arguments are **answered** with an error, never dropped — an unanswered
  tool call is a 400 on the next request everywhere. The budget ends in a wrap-up turn with no tool.

**Whether zoom makes answers right is a separate bench** — `vlm-bench --zoom` only prints latency,
tokens and cost. The accuracy bench plants one change with a known answer in a full-page 2x capture of
each CSS-challenge fixture (a digit in ≤13px text, a short label's colour set to a seeded hue, an element
moved 1-6px and scored exactly, or nothing — only on elements topmost at their centre, `--variants N` per kind) and asks each model twice through the same driver, images and wording: `runSingleLook` (one
turn, no tool) and `runZoomLoop`. Answers are JSON, scored without reading prose; the report pairs the
two arms per case (fixed / broken by zoom) with an exact sign test, because 36 cases cannot carry a bare
accuracy difference.

```bash
B="node --experimental-strip-types src/experiments/benchmark/zoom-accuracy/zoom-accuracy.ts"
$B --self-check                                   # no key: 36 cases, oracle must score 36/36, "unchanged" 9/36
$B bytedance/ui-tars-1.5-7b claude:claude-haiku-4-5-20251001 --md docs/reports/YYYY-MM-DD-zoom-accuracy.md
$B --rescore --md report.md                       # re-score saved answers (test-results/zoom-accuracy/answers/)
$B --max-edge 1024 …                              # a harsher view budget, as a provider that resizes again would
```

**No API key: the agent's own vision is the model.** Do not stop at "no key" — export a packet per
arm, hand each to a fresh subagent that is given only the packet's `BRIEF.md`, and import what it writes:

```bash
$B --export-agent /tmp/p-single --arm single          # builds the cases; tasks under shuffled ids, images at the budget size
$B --export-agent /tmp/p-zoom --arm zoom --reuse      # same tasks; BRIEF.md adds the zoom helper (--agent-zoom), same budget as the loop
$B --import-agent /tmp/p-zoom/answers.json --arm zoom --model agent --md report.md
```

The packet is blind by construction and a test holds it there: no case id, fixture name or path to
`cases.json` appears in any file or file name in it — an id like `page-text` is the answer. Give each
arm to a different agent (one that has zoomed remembers the crops), and say in the report that the
arms were an agent's: it has a shell and its honesty is the one thing the packet cannot enforce.

Two things measured building it: the first full-page capture of `page.html` is 2 device px shorter than
every later one, so captures repeat until two agree (without it every `none` case differs everywhere);
and at the default budget a 2x capture is shown at ~0.8 CSS scale, where 12px text is still legible to a
careful eye — so a small single-look/zoom gap on `text` is a finding, not a broken bench.

**Measured with the coding agent's own vision**, twice. v1 (`docs/reports/2026-09-28-zoom-accuracy-agent-v1.md`)
tied at 35/36 — the bench was too easy: a nameable Tailwind colour, four guessable shifts with ±1px, a case
under a blurred modal nobody could read. v2 (`…-agent-v2.md`) fixed those (seeded hues, 1-6px shifts scored
exactly, unobstructed targets, `--variants 2`) and at the default budget **zoom scored 58/58 against the single
look's 48/58: 10 fixed, 0 broken, p = 0.002**. The whole gain is exact values — shift magnitudes (10/17 →
17/17) and colours (15/18 → 18/18); detection, ≤13px digits and "nothing changed" were perfect either way.
Cost ~1.4x tokens, ~3x time. So: turn zoom on when the answer is a measurement, not to notice a change.
No provider model has run it yet.

## Jev (TypeSafe System One): typed answers, `box` grounding (`@mizchi/vlmkit-ai/jev-client.ts`)

```bash
node --experimental-strip-types src/experiments/benchmark/jev-box/jev-box.ts --out test-results/jev-box --md r.md  # TYPESAFEAI_API_KEY, ~$0.045
node --experimental-strip-types src/experiments/benchmark/jev-box/jev-box.ts --rescore --out docs/reports/data/2026-10-16-jev-box
```

Jev writes no prose. You send a `state` and typed questions (`box` / `noul` / `choice` / `score`)
and get typed answers back. Images are asset keys referenced from strings and need
`TypeSafe-Danger-Zone-Images: true`. Each edge must be 280-1568px, and an image outside that is
rejected, not resized. Measured 2026-10-16 (`docs/reports/2026-10-16-jev-box-bench.md`), not to re-learn:

- **Box edges are two decimals** (12.8px on 1280). A single look gives 89% click hit with a 12px
  median edge error. A second `box` on a crop around it, magnified 4x, gives 96% and 5px. Pad
  before cropping.
- **`box.confidence` is uninformative** (AUROC 0.56 for a hit), and `box` has no "not found":
  ask presence as a `noul` (AUROC 0.98, 0/85 decoys accepted). The exception is placeholder text,
  which reads as not shown.
- **Pixels say where, Jev says what.** On a pixel-diff region's magnified crop, a `choice` of
  text / colour / position was 48/48. On the whole screenshot, Jev detected only 31% of 1-6px
  shifts, and it got shift direction from the crop only 8/16. Take values from the pixels.
- The image is read once per request, and each extra question on a shared state costs about 20
  tokens. A 1280x800 screenshot is about 3.1k tokens ($0.00013) and answers in about 0.2s.

**Easing from frames** (`docs/reports/2026-10-18-jev-easing.md`, bench `jev-easing/jev-easing.ts`):
asked as a `choice`, Jev named 7/21 from 11 frames and 4/21 from a contact sheet (chance 3/21),
with confidence no higher when right. A `box` per frame and `fitEasing` on the centres got 21/21
(6 frames too). Never ask Jev for an easing name: take positions from it and fit them.

**Shipped as `diff png --kind`** (`@mizchi/vlmkit-ai/region-kind.ts`, `attachRegionKinds` in
`png-diff.ts`). It puts `regions[].kind = {label: text|color|position|presence, confidence,
uncertain, model}` on the regions the pixel diff found, one request per region, largest first up
to `--kind-limit` (12). Without a key it exits 2 before measuring anything. End-to-end round on real
`compareScreenshots` regions (`docs/reports/2026-10-16-jev-region-kind.md`, bench
`jev-box.ts --only regions`), not to re-learn:

- Text 14/14, colour 18/18, presence 17/17. Shifts of 1-6px were 11/16, and every miss was read as
  colour. **Confidence matters for a `choice`** (AUROC 0.97): all 5 misses were below 0.6, which is
  `REGION_KIND_SURE`, the `uncertain` flag. Re-measure it when the model changes.
- **Score a region against the planted kind only if it touches the planted element.** A digit
  that widens a badge moves every tab after it, and those `position` labels are right. Counting
  them as text errors was the scorer's bug.
- Captures of different sizes are skipped, not labelled: after a reflow one window shows two
  different pieces of content.

**Shipped as `inspect locate` and `click` with `describe`** (`@mizchi/vlmkit-ai/locate.ts`
`locateByDescription`; `packages/vlmkit-markup/src/inspect/locate-cli.ts`; the `describe` target in
`interact.ts`). Presence (`noul`) and a `box` in one request, then a `box` on the original's pixels
around it, magnified. Measured end to end (`docs/reports/2026-10-16-jev-locate.md`, bench
`jev-box.ts --only locate`), not to re-learn:

- 81/85 targets found and 80 of them with the point on the target (94% end to end); 85/85 decoys
  not found. All 4 misses were the presence question: 3 fields described by their placeholder,
  which `noul` reads as not shown, and 1 two-line dropdown label. Describe a field by its label;
  `--no-presence` returns the box anyway.
- Interact screenshots at `scale: "css"`, so the point is already in `mouse.click` coordinates.
  A 2x capture is shrunk for the first look only: the crop is cut from the original pixels.
- A `describe` click is refused before the browser starts without a key, or with both or neither
  of `selector` and `describe`. A not-found target is a step failure quoting presence, with no
  selector suggestions.

**Shipped as `inspect claims`** (`@mizchi/vlmkit-ai/claims.ts` `checkClaims`;
`packages/vlmkit-markup/src/inspect/claims-cli.ts`). Each `--forbid` / `--expect` statement is one
`noul` in one shared request. An `inspect` leaf, not a gate: it is a model's reading of the pixels,
so it never gates and the gate registry stays deterministic. Measured
(`docs/reports/2026-10-17-jev-claims.md`, bench `jev-box.ts --only claims`: 9 fixtures, clean and
with an error banner, modal, broken image, overlapping text or loading overlay planted), not to re-learn:

- 54 of 55 true cases caught (the miss: one loading overlay at 0.49), and **0 false alarms on 43
  clean-page cases**. Two "false alarms" on the clean fixtures were right: form-app shows a
  validation error, and stacking-context has a modal open. They are `CLAIM_NATIVE`, verified by looking.
  Look at a clean page's alarm before calling it wrong.
- The cross-plant alarms (11 of 172) are mostly `overlap` firing on plants that cover page text.
  The `uncertain` band (within 0.3 of the threshold) held 10 of the 12 wrong answers and 22 of the
  258 right ones: outside it, 236 right and 2 wrong.

**Shipped as `inspect motion`** (`@mizchi/vlmkit-judge/motion-path.ts` `judgeMotionPath`, pure;
`@mizchi/vlmkit-ai/motion-check.ts` `checkMotionFrames`; `packages/vlmkit-markup/src/inspect/motion-cli.ts`).
Is a CSS animation visually broken, for an agent to judge its own: frames on the held clock, one Jev
request per frame (presence + box per `--target`, a `noul` per `--forbid`), the motion judged from
those — never asked. Known answers: `fixtures/motion-defects/` (7 mistakes × intact/broken,
`build.mjs` writes them and `cases.json`); bench `src/experiments/benchmark/jev-motion/jev-motion.ts`.
Measured (`docs/reports/2026-10-18-jev-motion.md`), not to re-learn:

- 7/7 broken caught by the expected rule, 7/7 intact pass, with and without `--selector`.
  `check animation` exited 0 on all 14; `check integrity --timeline` named 3 of the 7 by a rule
  the intact page lacked. Every number here was found by agents using the tool on their own
  pages (three rounds), not by the fixtures, which a first version already passed.
- **Sample per segment, judge per segment.** 11 even frames over a 2.4s toast gave its 600ms
  entrance 2-3, and hold frames as a step's neighbours read as a jump. Each span some finite
  animation runs in gets its own 11 (`motionPlan`).
- **A box cut by the viewport is the visible part.** Its centre moves at half speed (fits linear
  for ease-out), and a half-visible frame read as lost. Within 1.25% of an edge (Jev's 1% steps
  put a box cut at 1280 at 1267) the centre is put back from the target's own size.
- **One look is 12.8px steps; ask the box again on a magnified crop** of the region it moves
  through (`refine`, default): centre error to the DOM 7.4 → 5.2px median.
- **Look-alike siblings get swapped** (three stat cards: one boxed 630px away and back). A box far
  off and back, or one two targets share, is `locate-unsure` (warn) and left out. `--selector`
  removes it: geometry, opacity, scale and the element's own `getComputedTiming()` time from the
  page — the only way staggered siblings in one segment each fit their own curve.
- **The overlap statement must be narrow.** "text overlapping other text so that it is hard to
  read" fired on an open dropdown over a page; "two lines of text printed on top of each other,
  their letters crossing" (`DEFAULT_MOTION_FORBID`) caught the claims round's planted overlaps 9/9
  with 0/36 cross-plant alarms (the broad one 10/36), on screenshots it was not chosen on.
- Positions from frames shown at ≥0.8 only: a fade's faint frames got boxes 40px off.

## Generated figures (raster images)

Figures that state structure — dependencies, flows, states, sequences, measurements — are drawn with
code (mermaid; D2 in mizchi/explainer), because only a code-drawn figure can be checked against the code.
Claude has no image generation of its own. What code draws badly (an illustration, a concept picture,
a page that has to look like a page) is generated: Codex uses its own imagegen; anyone with
`OPENROUTER_API_KEY` uses `createImageGenClient()` from `@mizchi/vlmkit-ai/image-gen-client.ts`, whose
default is **`openai/gpt-image-2.5-flare`** (`VLMKIT_IMAGE_MODEL` overrides it).

```bash
B="node --experimental-strip-types src/experiments/benchmark/image-gen/image-gen-bench.ts"
$B --list                                   # OpenRouter's Images API catalogue
$B                                          # re-run every model of the saved evaluation (~$2, OPENROUTER_API_KEY)
$B openai/gpt-image-2.5-flare meta/muse-image --out test-results/image-gen/new
$B --report test-results/image-gen/new/evaluation.json --md table.md   # after scoring: validate + rank
```

The bench asks every model for three briefs with checkable claims (`briefs.ts`: a zoom whose enlarged
view must match its mark, a VRT diff whose panels must agree, exact Japanese labels with arrows the right
way). **It has no automatic score** — a run writes `evaluation.json` with every verdict null and one
contact sheet per brief, and a scorer (a person, or an agent's own vision) fills in pass / partial / fail
with a note. The saved round is `docs/reports/data/2026-09-30-image-gen/evaluation.json`
(`docs/reports/2026-09-30-image-gen-model-bench.md`); `score.test.ts` fails when a brief is edited (the
old verdicts answered a different question: re-run and save a new evaluation) and when the default model
does not have full marks in it. To change the default: re-run, score, save the new evaluation beside the
old one, point `SAVED_EVALUATION` at it, then change `IMAGE_GEN_DEFAULT_MODEL`.

Measured 2026-09-30, not to re-learn: nearly every model writes the exact text (13 of 14); what fails is
the relationship the figure claims — 5 of 14 drew a `current` panel identical to `baseline` and marked a
move in `diff` anyway. Usage rank is not quality: `seedream-4.5`, third by OpenRouter usage, scored 0/3.
`meta/muse-image` scored 3/3 at $0.010 but needs the account's 18+ confirmation
(`openrouter.ai/settings/preferences`), so it is not the default. `recraft/recraft-v4.1-vector` returns SVG.

### This repository's own art (`scripts/readme-art.mjs`)

The README hero, the landing page's section-05 illustration (`examples/vlmkit-intro-page/principle-{light,dark}.webp`,
one per theme, in that page's palette; the dark one is drawn against the light one as `reference`, so the theme
switch only recolours it) and the icon set (README tables, every `examples/*/README.md` heading, the demo
gallery's group headings, published at `/icons/` on Pages) are generated with that default model from
`scripts/readme-art.manifest.mjs` — one prompt per file, and `docs/assets/art.lock.json` records the
hash of the prompt each file was made from.

```bash
OPENROUTER_API_KEY=… node --experimental-strip-types scripts/readme-art.mjs            # missing or stale only
OPENROUTER_API_KEY=… node --experimental-strip-types scripts/readme-art.mjs wrench     # redo one; then LOOK at it
```

`tests/readme-art.test.mjs` fails when a prompt changes without regenerating, when an icon is unused,
and when a README names an icon the manifest does not have. Measured building it, not to re-learn:
line icons on transparent vanished on GitHub's dark theme and were unreadable at 20px, so every icon is
a filled `#2563eb` tile with a white glyph; the anchor icon is sent as `inputReferences` to every
other one (OpenRouter's `input_references` takes `{ type: "image_url", image_url: { url } }` — a bare
string or `{ url }` is a 400), which is what keeps 21 icons one set; about 1 in 5 tiles comes back with
a dark smudge of shadow on its edge, so look at every icon on light AND dark before committing and
regenerate the ones that have it.

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

- **No Playwright version floor.** The `mount` fixture is 1.62+; the peer floor is
  1.61 (the repo itself develops on 1.63) and this does not use the fixture. Do not
  add a peer-dep bump for it.
- The gallery is framework-specific and the project's to own; `examples/story-gallery/README.md`
  carries a React + Vite one to copy. Storybook needs a shim (no `window.mount`).
- Baselines are keyed on the story id **as written**, so `Button/Primary` and
  `components/Button/Primary` get separate baselines. List the canonical spelling
  in `vlmkit.gates.json`.

## Motion: the page clock held (`check animation --virtual-time`, `check integrity --timeline`)

```bash
vlmkit check animation page.html --virtual-time        # rAF / GSAP / canvas / timer motion measured, not "uncontrolled"
vlmkit check integrity page.html --timeline            # layout judged at instants of the page's motion
vlmkit check integrity page.html --timeline-at 0,250,500
```

Three ideas from HyperFrames (heygen-com/hyperframes), adapted. `virtual-clock.ts` in
`@mizchi/vlmkit-animation-eval` holds `requestAnimationFrame`, `performance.now`, `Date`,
`setTimeout` and `setInterval` at virtual 0 from document start and only the evaluator advances it,
one 60fps frame at a time with timers in order; `HOLD_TIMELINE_SCRIPT` pauses every animation as it
begins and seeks them all to one page time. `--timeline` runs integrity's layout judges at each
instant and tiers by persistence (`tierByPersistence`, `@mizchi/vlmkit-judge/persistence.ts`).
`seek-ineffective` (suspect) says when an animation's frames do not measure it. Since `check flash`
the hold also covers iframes (each on its own offset), open shadow roots, SMIL, `playbackRate` (from an
anchor, negative rates too), animations the page paused or cancelled (left to the page, never
revived), ones found finished at clock 0, nested zero-delay timers (clamped to 4ms past six levels, as
Chromium 141 does) and a page that navigates mid-sweep (`navigations()`); a held animation the seek
takes to its end is ended natively, so `finished` / `onfinish` chains run, and `animations()` /
`pending()` read every frame. `held-timeline.test.ts` plants each. Measured building them, not to re-learn:

- **A replay mismatch is not enough.** A capture can land before the compositor applies a seek: one
  replay flagged a pure-CSS `alternate infinite` badge in 2 runs of 30. Only three mutually
  different frames count (0 of 50 after; a rAF ticker over the element still fires every run).
- **A page that drives its own animations from a rAF loop needs the clock.** The (since deleted)
  `vlmkit-anim` runtime rewrote every animation's `currentTime` each frame, so on the wall clock
  every seek was overwritten and every animation read `seek-ineffective` — correctly. Use
  `--virtual-time` for such a page.
- **Mid-motion contrast is judged at full opacity only.** Without that, six of the eight
  dogfood-animation pages flipped to `defects` on their entrance fades; a fade at 40% is the
  animation. Text at full opacity whose background has not arrived is still held (`background-late.html`).
- **Held needs time as well as samples:** two consecutive instants AND ≥200ms. Instants from
  animation boundaries bunch up, and a solitaire card crossing its neighbour for 10ms of the deal
  read as held.
- **"Absent once it stops" is a separate rest instant**, past every finite animation's end and 2s —
  never the last instant asked for (`--timeline-at 0,250,500` ends mid-motion). It also replaces the
  wall-clock settled sweep as "rest": that sweep caught a rAF card mid-motion and called it resting.
- **Load with the clock held must not wait on page timers.** `settlePage`'s animation wait races a
  page `setTimeout` that never fires; both paths call `settlePage(page, 0, 0)`.
- **Count frames, never sum them.** Frame n is at `(n * 1000) / 60`. Summing `1000 / 60` drifted
  above the boundary (frame 6 summed to 100.00000000000001), so `advanceTo(100)` ran 5 frames and
  500 / 2000 ms — on `--timeline`'s default grid — each ran one short.
- **The held list is swept, not only event-fed.** `animationstart` fires when a CSS animation's
  delay ends in real time, so the list `--timeline` reads after load held only the animations whose
  delay had already passed. Which ones depended on load speed: solitaire's glimpses varied run to
  run (7 to 10) and are 10 every run now, and the rest instant could land before a delayed card
  finished. Both readers now sweep `document.getAnimations()`, which includes animations still in
  their delay.
- **Rest is past the animations the instants sampled, not every listed one.** An exit that begins
  after the last instant (a toast dismissed at 10s) put rest past it, and the label the toast
  covered, still, for 10s read as "absent once it stops" (`fixtures/integrity-timeline/late-exit.html`).
- The contrast collector resolves background from **ancestors only**: white text over a dark
  *sibling* reads as invisible at rest, with or without the timeline.

Fixtures: `fixtures/integrity-timeline/` (held, transient, clean, at-rest, script, fade-in,
background-late, late-exit). On the 21 animated pages of the repo `--timeline` changes no verdict and adds no
held finding (8 transient glimpses, 7 of them the solitaire deal). Round:
`docs/reports/2026-10-01-hyperframes-motion-v1.md`.

## Frames: the page at chosen instants (`vlmkit-frames/1`)

```bash
vlmkit check animation page.html --at 0..600/100 --frames out/f      # the viewport per instant, clock held
vlmkit check integrity page.html --timeline-at 0,250,500 --frames out/tl   # each judged instant + rest, per width
vlmkit inspect interact page.html --sequence s.json   # { "action": "frames", "name": "close", "at": "0..400/50" } after an action
vlmkit snapshot strip --manifest out/f/frames.json [--animated] [--max-frames 6]
```

One format for every numbered capture: `NNNN-t<ms>.png` (position zero-padded, so a glob is in
order) plus `frames.json` — `{format, source: {tool, url, viewport, deviceScaleFactor, browser,
clock: held|wall}, frames: [{n, file, atMs, stable, label?, shotMs?}]}`. The pure half is
`@mizchi/vlmkit-judge/frames.ts` (names, `parseInstants`, `thinEvenly`, `playbackDelays`,
`parseFramesManifest`); the capture half is `@mizchi/vlmkit-animation-eval/frames-capture.ts`
(`openHeldTimeline`, `captureStable`, `frameWriter`), which `check integrity --timeline` now
runs on too — one copy of the hold / advance / seek loop. Measured building it, not to re-learn:

- **One time grammar, `parseInstants`.** `numberList`'s `parseInt` read `--timeline-at 1.5s` as
  1ms. Bare numbers are ms; `s`, `ms`, `f` (60fps frames), `mm:ss.sss` and `a..b/step`. A range
  is `start + i * step` (in frames when written in frames), never a running sum — the same drift
  the held clock had.
- **A gate's value flags must be listed for `firstPositional`.** `check integrity --timeline-at
  0,150 page.html` read `0,150` as the page. List every new value flag.
- **Ranges and decimals are snapped.** `0 + 5 * frameTimeMs(5)` (the 5th value of `0..1s/5f`) is
  416.66666666666663, one ulp below frame 25, and `16.15 * 1000` is 16149.999999999998; both made
  the held clock stop a frame early. (`5 * (1000 / 60)` lands one ulp *above* frame 5, which runs
  the frame but made `0..10f/1f,5f` two instants.) A value within 1e-6ms of a whole ms or a frame
  boundary is put on it, and a range stepped in frames from a start on a frame (bare `0`
  included) is computed in frames.
- **A capture is two shots that agree** (at most three). A seek can be photographed before the
  compositor applies it; three that never agree are `stable: false` (video, animated image,
  worker), written anyway and counted, never passed off as the instant.
- **`check animation --frames` no longer writes the evaluation's internal captures** (`rest`,
  `anim-0-25`, `t-150ms`: each on its own clock, in an order no glob sorted). It captures the
  uncropped viewport per instant on a fresh held page; `--at` also names the strip's columns, which the
  2026-08-10 dogfood agent had looked for.
- **`inspect interact` records a `frames` step on a page of its own.** The main run — snapshots,
  transitions, step failures, the report — is the motion-off run a sequence without frames steps
  gets, byte for byte; a frames step is skipped there. Then each frames step gets its own page:
  the steps before it replay with motion off, motion goes on (removing `animation: none` restarts
  every CSS animation), what that restarted is landed, and the recorded action runs with every
  animation it starts held. Not to re-learn: three versions landed motion on the main run, and
  four review rounds kept finding pages each policy broke — holding everything froze a menu an
  earlier click opened; finishing everything before each action ran a toast's 4s auto-dismiss
  early; finishing nothing timed out a click on a 7s attention-seeker and on a self-restarting
  pulse. No landing policy matches motion-off for every page, so the main run gets none. The
  cost: the steps before each frames step run twice (a URL source with server state sees their
  requests twice). The 37 tests in the five `describe`s that follow `runInteract frames steps` in
  `interact.test.ts` cover what the rounds found. Inside the window, measured on Chromium 141:
  - Land by `finish()` (paused at its end, `finished` never resolves), only what is moving or due
    within 1s; an infinite animation, or a loop finished 5 times in one landing, is paused at 0;
    one the page paused, cancelled or set to rate 0 is the page's.
  - `document.getAnimations()` leaves out shadow roots, and `animationstart` / `transitionrun`
    are not composed: walk open shadow roots.
  - A scroll-driven animation's `endTime` is a percentage (`CSSUnitValue`); hold only
    `DocumentTimeline` animations.
  - Once paused through the API, a CSS animation outlives its `animation-name`: cancel one whose
    name its element no longer lists — compared escaped too (`slide:in` serialises as `slide\:in`).
  - Setting `currentTime` on a cancelled (`idle`) animation revives it.
  - Position by `playbackRate` and direction; take over one the page resumes or reverses after it
    was held; hold `el.animate()` a microtask later (a scrubber paused at once is the page's);
    take its start as `now - currentTime` (`animationstart` fires after the delay); and leave
    what was already running when armed (a toast's exit in its delay) at its real time.
  - A stage chained on a held animation's end is timed from THAT end: ends one at a time,
    earliest first, each used once (a pulse restarted on its own end matched its first stage);
    the origin goes to what begins while the end event — or a Web Animation's `finish`, listened
    to from creation, before the page's `onfinish` — is dispatched, and is swept in the task
    after, since a class added there (or in a `finished` promise, or behind `stopPropagation`)
    becomes an animation only when style is computed. More than 16 ends before one offset are
    finished together.
  - Time is `timeOrigin + now`; every evaluate survives up to 5 navigations, and the document is
    checked again after each frame is shot. A page that closes itself is not a navigation: the
    step stops, what was shot keeps its `frames.json`, and the run's report is still written.
  - Every wait on rendering is bounded (250ms): a page that stubs `requestAnimationFrame` hung the
    run forever.
  Offset 0 is two rendering updates after the action returns; a timer's work is on the real clock
  (`shotMs`, read just before the shot that is kept); a held animation the page cancels or
  retargets mid-window is counted and named. Left as limits: CSS inside an iframe is not held
  (its frames read unstable), and an infinite CSS animation paused at 0 ignores the page's
  `animation-play-state` from then on.
- **Seeking a paused CSS transition past its end fires `transitionend`** (Chromium 141). Measured on a drawer
  that hides itself on it: the handler runs between frames. Each frame's drawer edge is right to
  within 0.01 of the antialiased pixel's coverage (0.55 at 50ms of a 220ms slide, where 154.55px is due).
- **`setContent` runs no init script**, so the held clock needs a navigated page (`--frames` on
  inline HTML is refused). `interact` injects its script after load for that reason, and also
  registers it as an init script so the document after a link or a reload has it.

### What a sequence shows happening (`snapshot storyboard`)

```bash
vlmkit check animation page.html --at 0..1s/1f --frames out/f   # exits 1 on a suspect, frames written all the same
vlmkit snapshot storyboard out/f/frames.json
# → out/f/storyboard/: story.json, SUMMARY.md, sheet.png (box outlined), narrate/BRIEF.md (+ keyframes, crops)
```

States and events from the pixels alone, relative to an anchor (the frame of the state the page is in):
**glitch** one frame off and back; **transient** back within 5000ms whatever it held (a toast is
one); **change** not back, ending at the first 100ms of byte-identical frames — the next state, whose frame
is the anchor from then on (an earlier state's own frame when the hold is within its floor);
**drift** a change no step of which, inside its box, crosses the floor (a channel moving by more than 8). Pure half
`@mizchi/vlmkit-judge/storyboard.ts` (`buildStoryboard`, `storyboardSummary`, `storyboardBrief`);
CLI `src/cli/commands/storyboard-cli.ts` (an artifact command on the SPECS path, exits 0, no verdict:
the brief is for the agent's own vision and nothing reads its answer back). Measured building it,
not to re-learn:

- **Anchor-relative, never merge-then-split.** k blinks are k events and their gaps none; a fade is
  compared with the anchor, so it accumulates until it shows, and `movedAfter` names the last frame
  of the visit in which the event's own box was still byte-identical to the state. A random-plant property test (glitches, sliding transients, changes,
  5000 seeds once, 200 kept) holds every event to the frames and box it was planted on.
- **Durations need the same epsilon as instants.** Frame 10 minus frame 4 is 99.99999999999999, so a
  seven-frame 100ms hold never settled and the change ran on into the next event.
- **A fixture's motion must not return by symmetry.** A two-tone square turned 12° a frame equals
  itself after 180°, so the "spinner" read as transients; the planted one is asymmetric, 7° a frame.
- **What nothing holds swallows the sequence.** A video or an unheld spinner makes every frame differ
  and one change never settles; `--ignore x,y,w,h` (the frames' pixels) takes its box out, and the
  never-settling event's box is the one to pass.
- **The sheet holds cells, not frames.** The layout is solved on sizes alone and each cell is decoded
  and shrunk before the next, and segmentation decodes through a byte-bounded cache: every frame of a
  1000-frame 2x capture at once would be 15GB.
- **The anchor is the state's frame, on a return too.** Anchored on the hold it landed in, a hold
  within the floor of S0 was S0 once and a new state the next time, and a later fade measured from
  the hold called "identical to S0" a frame that was not. (Within the floor is not transitive, so
  equal bytes can still carry two ids; that is not claimed away.)
- **`movedAfter` is the event's own pixels.** The last frame of the visit in which they were exactly
  the state's, found inside the event's box. Tracked across the frame, a fade elsewhere, or a
  residue a toast left within the floor, gave an unrelated glitch a "moving since" seconds early.
  The search decodes nothing when a frame's changed pixels miss the box, and a repeated box resumes
  its last search: without both, a blink repeating over a pixel held a level off the anchor cost
  49927 decodes for 3000 frames.
- **Drift is judged inside the event's box.** Measured across the frame, a sub-floor wiggle beside a
  fade made the fade a change (step 14 between two frames each within the floor of the anchor).
- **Step before anchor on the 5s look-ahead.** The window is 300 frames at 60fps and the cache a few
  dozen; computing the anchor-independent step first lets a re-scan after a change answer identical
  frames without decoding (5247 decodes → 1174 for a 1000-frame, 16-change sequence through a
  36-frame cache; a test holds 450 for 400 frames, 1534 without it).
- **The outline is never over the box.** A 1px top bar at the frame's edge was hidden under its own
  clamped outline; it now sits outside the box, in 2px of the cell's gap. `boxOnSheet` inverts
  `scalePngData`'s float sampling (`105 * (1440 / 175)` is 863.99…), not the exact ratio.

Known answers: `fixtures/storyboard/planted.html?kind=…` (static, glitch, blinks, toast, slide, fade,
spinner), each required back on its frames in `storyboard-cli.test.ts`.

Not built yet, in the order the research put them: a noise floor for lossy storyboards, which this
one deliberately does not have (until then it refuses a lossy recording without `--lossy`).
(`check flash` and external recordings through the user's own decoder, `scan video`, the first two in
that list, are below.)

## Flashing (`check flash`, WCAG 2.3.1)

```bash
vlmkit check flash page.html                         # every 60fps frame of 2-10s of page time, held clock, 1280x720
vlmkit check flash page.html --frames out/flash --strip worst.png   # keep the frames; ONE still sheet of the worst window
vlmkit check flash out/flash/frames.json             # the saved frames judged again, no browser, same answer
```

Pure half: `@mizchi/vlmkit-judge/flash.ts` (per-pixel zig-zag, ΔL ≥ 0.1 with the darker state
< 0.8; red: u′v′ > 0.2 with a saturated-red end; > 6 transitions in (t − 1s, t]; the flashing pixels
closed 3x3 and measured in the best 341x256 field, 21,824 CSS px² the limit) and `flash-motion.ts`
(`classifyFlash`). Browser half: `packages/vlmkit-markup/src/inspect/flash-check.ts`. Known answers:
`fixtures/flash/` + `expected.json`. Measured building it, not to re-learn:

- **The limit is 21,824 (G176: 25% of the field), not 87,296** — the Understanding text's number is the
  whole field. The solitaire deal's per-pixel area, 31,862, sits between the two.
- **Red needs a magnitude floor.** R/(R+G+B) has none, and black takes the white point, so
  `#000`↔`#010000` was a full-field red flash. IRIS's (R − G − B)·320 > 20 on linear channels.
- **Per-pixel counting is literal, so a failing run is re-counted with motion compensated.** Scrolling
  text fails per pixel; the deal fails per pixel. DOM attribution must never excuse anything: a
  `scale(1)↔scale(0)` strobe, a teleport and a background toggle on a slowly translating box are
  transform-only animations and real flashes. Only pixels decide (block matching); the animations are
  named, never trusted.
- **Two tests, either fails it.** The field's mean colour, from per-frame block sums (a ticker over a
  full-screen strobe), and the tracked residual: each pixel's state — its zig-zag leg and last
  transitions — is carried along its 16x16 block's motion and stepped only by what the moved previous
  frame does not reproduce. Whole runs are re-counted (merged spans, a 1200-frame budget past which a
  run is not excused). What this replaced, each a measured hole: a 3x3 envelope that accepted a
  strobe's falling step as an antialiased blend; a reset on every explained step, so a smooth pulse
  behind moving text never added up; a 2s cap that excused a strobe beginning later in a run.
- **Between pixels, a step is checked against predictions, never a range.** The range of the 2-4
  source pixels explained a light strobe behind text moving 2.5px a frame (beside ink, the step toward
  the darker level lands inside it). The two predictions are the matcher's: forward (previous frame
  resampled) and backward (a half-pixel layer renders blurred and only the sharp frame resampled gives
  it), bilinear in encoded luminance, 0.01 tolerance. A state also keeps where in its pixel its content
  is: `Math.round(2.5)` always rounds up, so states slid half a pixel a frame along what they counted.
- **What may establish motion is narrow, and every gate was a hole first.** A match: texture ≥ 0.03,
  mean residual ≤ 0.04 encoded and under half of not moving, on the part of the block whose source is
  in the frame (at least half). Without that, the frame's edge column never matched while text
  scrolled in and its raw steps were carried across the frame: 61,757 px² left on a pure scroll.
  Refused when: a level change in place explains it as well; it has no direction (the reverse also
  matches — 20px stripes moved 20px are counterphase); it jumps > 24px beyond the source block's OR this
  block's own last motion (the second reference is what lets a carousel's entering band be trusted);
  it reverses > 6 times within a second, untrusted over the whole cluster (applied as it went, a 20px
  shake was untrusted only after seven excused reversals, too late for the window to see it). A
  reversal is a quarter turn or more (dot ≤ 0): a shake around a square path never reversed past 90°.
- **A state carries only what is the content's.** Steps a state took in place before its last one stay
  with the place: a stock that card after card appears on filled every card's ring, and the deal read
  flash at 23,341 px²; trimmed, 13,187 (15,825 with the place ring below). Content replaced under motion — what was at a pixel moved on by
  trusted motion and what is there now moves on by the next frame's — starts fresh: a slide's entering
  band. A separate location layer for untrusted steps was tried and lost a teleport while drifting: at
  a fixed place, its returns no longer line up; on the drifting content they do.
- **…and the place keeps what is the place's.** A screen-fixed ring beside the content state holds the
  in-place steps a moving state leaves behind, and level steps taken under content that travels on (a
  block untrusted between two trusted frames). Without it, text that steps across a strobe now and
  then, or scrolls through a stationary strobe box, carried the strobe out on itself (residual 0).
  Content and places are TWO areas, each closed and measured in its best field: measured as one, the
  deal's stock and its cards came to 18,136, 3,688 under the limit; apart, 15,825. Fed from every
  in-place step, the place made the deal a flash (26,390), so motion untrusted throughout feeds it
  nothing.
- **A sum stopped at the best ties.** The coarse search left its sum at 0 once an exact match was
  found, so every later offset tied and the shortest, (0, 0), won: a carousel's 64px frame unmatched.
- **Entering content has no history**, so a strobe behind content that crosses the view in under ~1.75s
  is counted only on what has been in view a second (the synthetic case scrolls 2px a frame through
  400px for that reason). A grating of bars narrower than a 16px block moving less than half its period
  a frame reads as motion; one whose bars are a block wide or more (16px bars at 4px a frame) reads as
  flash, since a block inside a bar is flat and nothing matches its motion (found in scan-video-v1).
- **What the held clock cannot hold is reported, never passed.** A `<video>` is paused (and searched for
  again during the sweep); an animated image runs on the browser's clock, sniffed from its frames, not
  its header (`@mizchi/vlmkit-core/animated-image.ts`), wherever it is drawn — `<img>`, CSS
  backgrounds, masks, border images, list markers, pseudo-element content, SVG `<image>`, shadow
  roots — and read across origins through the context's own request; an image whose bytes cannot be
  read is `unreadable-image`, not still. Probe shots in real time at gaps with no common period (three
  shots 150ms apart aliased with a 6.7 Hz strobe), and every 10th changed frame shot again 50ms later
  (something unheld that moves makes every frame "new", which counted real time as page time).
  Unmeasured pixels count beside measured flashing (`withUnknown`): two sub-limit halves are no pass.
- **The held clock now holds** iframes (every frame advanced, each on its own offset from when its
  document appeared: an iframe inserted at 1s ran its first second in one step), open shadow roots,
  SMIL (each SVG's own timeline), animations at their own `playbackRate` from an anchor the page's own
  setters move (a strobe set to rate -1 never moved), never one the page paused or cancelled (a seek
  revives a cancelled one, which kept a replayed highlight from replaying), one found finished while
  the clock is still at 0 (real time spent loading is page time 0), nested zero-delay timers clamped
  to 4ms (a `setTimeout(f, 0)` loop spun the clock's guard every frame), and a page that navigates
  mid-sweep. **A held animation the seek takes to its end is ended natively** (`finish()`), so
  `await anim.finished` and `onfinish` run: a paused animation never finishes, and a strobe chained on
  an intro was never created. `onfinish` fires only at the next rendering, so the step waits for one.
- **The window comes from every frame and is reconsidered at its end.** An iframe's animations and
  timers count (`timeline.pending()`, `animations()`), and what the page began during the sweep — an
  animation an `animationend` or a later timer started, an interval set up late — extends it. The
  one-frame `still` shortcut never applies with `--window`, iframes, timers or `vlmkit:seek`
  listeners, and the sweep's decisions are written into the manifest (`source.sweep`).
- **Media is found in every frame and told apart by element**, not by style path (three videos in
  one grid were one region). `blob:` images are read through the frame that shows them, and `data:`
  URLs as the URL standard reads them (a stray `%` in inline SVG threw). Unmeasured pixels over the
  limit together with the flashing beside them are a suspect, as alone: a not-judgeable verdict
  exited 0.
- **Capture cost was the gate's cost.** pngjs's decode took 19 of 24s of judging 181 frames; a decoder
  for RGB/RGBA rows (`@mizchi/vlmkit-core/png-decode.ts`) plus CDP `captureScreenshot` with
  `optimizeForSpeed` (rows filtered "up" only) halved capture (93 → 40ms) and decode. A frame that
  differs from the previous one is taken in one shot; an equal one is shot again (a stale capture is the
  previous frame). The field test reads per-frame 16px block sums, so it decodes nothing.
- **The strip is one still PNG, always.** An animation of a failing window would strobe for whoever
  opens the review.
- **The per-pixel record keeps 16 transitions**, so a peak of 16 reads "8+ flashes/s".
- Not judged, said so in the output: WCAG's 0.1° exception for fine balanced patterns (a 2px
  inverting checkerboard is reported), a page's own video, states behind interaction, HDR.

## Recordings through the user's own decoder (`scan video`)

```bash
vlmkit scan video rec.mp4                         # every frame → rec.mp4.frames/NNNN-t<ms>.png + frames.json (stream clock)
vlmkit scan video rec.mp4 --from 10s --to 20s     # frames on screen during the span; --at 0..3s/250ms: the one at each instant
vlmkit check flash rec.mp4 --display-width 1280   # the same as scan video, then check flash rec.mp4.frames/frames.json
vlmkit check flash rec.mp4 --from 10s --to 12s    # the 3s before the span decoded as history, windows ending in it judged
vlmkit scan video frames/ --pts frames/pts.txt --every-frame   # frames another decoder wrote (or --fps 30)
```

vlmkit ships, depends on and downloads **no decoder** (ffmpeg-static is GPL and 80 MB; Playwright's
private ffmpeg decodes VP8/MJPEG only). `@mizchi/vlmkit-core/video-decode.ts` spawns the user's ffmpeg
and ffprobe, 5.1 or later (`--ffmpeg`, `VLMKIT_FFMPEG`, PATH — resolved by vlmkit, never the working
directory; ffprobe beside ffmpeg or its symlink target) with arguments, never a shell;
`video-frames.ts` is the pure half (probe JSON, frame table, timelines, colour, the filter chain,
showinfo) and `image-timing.ts` reads GIF / APNG delays and loop counts from the bytes. Tests need
ffmpeg on PATH, as the user would; CI installs it (`unit-tests.yml`), and without it they fail naming
it, not skip. The frames are `vlmkit-frames/1` on `clock: "stream"`: `atMs` is presentation time on the
stream's own timeline (a browser's `currentTime`), `index` the position among the frames the recording
shows, `source.video` how it was decoded. Measured with ffmpeg 6.1.1 and Chromium 141 / 149, and by an
adversarial review (54 findings), not to re-learn (`docs/reports/2026-10-13-scan-video-v1.md`):

- **ffprobe's decoded frame list is ffmpeg's output, one to one, with `-copyts` and `-fps_mode
  passthrough`** — 15 inputs: B-frames, VFR mp4/mkv, an edit-list cut (90 packets, 75 frames), mpegts,
  a mid-GOP start, VP8's hidden alt-ref (91 packets, 90 frames), VP9 superframes, GIF, APNG. Packet
  counts and `nb_frames` are not frame counts. Without `-fps_mode` image2 goes CFR and duplicates and
  drops; `vfr`/`cfr` drop frames that share a pts; output-side `-frames:v` / `-t` make showinfo print
  frames that are never written. Without `-copyts` every timestamp is shifted by the *format*
  start_time, which is not the first shown frame's (a mid-GOP mpegts started at 0.5s). So the table
  is ffprobe's `best_effort_timestamp` in integer ticks, frames are chosen by index (`select`), and
  every written frame is checked against it through showinfo's integer pts — a selection one frame off
  fails even on a constant rate, where spacing alone agrees. Never `pts_time` (`%.6g`: 10ms steps past
  1000s), never frame durations (missing on VFR mp4, 0 in showinfo, 1ms on every mkv frame), never
  `-ss` (it takes the frame after a time, a player shows the one before).
- **One filter graph, and size changes refused from the table.** ffmpeg rebuilds the graph on a size
  or pixel-format change, and `select`'s n restarts at 0 (wrong frames written); with
  `-reinit_filter 0` it does not, but the graph then scales a 96x64 frame to the first 64x48 without a
  word. So `-reinit_filter 0`, and every frame's size read from ffprobe's table before decoding.
- **showinfo is read from its own prefix only** (`[Parsed_showinfo_N @ 0x…]`, bare hex on Windows):
  a recording's comment printed at info level injected frames; `AV_LOG_FORCE_COLOR` in the user's
  environment split every line (the child gets `AV_LOG_FORCE_NOCOLOR=1`, escapes are stripped too).
- **Frames that share a timestamp are real** (0, 0, 0, 33ms in an mkv). Only the last is ever on screen;
  the others are dropped and counted (`video.hidden`), in an import too. Timestamps that go back are
  refused. A raw elementary stream has none (ffmpeg makes them up): refused, with a lossless re-encode
  at its rate (a stream copy cannot give reordered B-frames a time).
- **Untagged colour is BT.601 limited** — ffmpeg's default at every size, Chromium's for VP9 at every
  size, and what ffmpeg's encoder and Playwright's recordVideo write. Chrome guesses BT.709 for untagged
  H.264 from 720 lines up, which misreads ffmpeg's own default 720p output by 39 levels, so it is not
  copied; the assumption is recorded and `--color-matrix` / `--color-range` override it. It decides
  verdicts: an untagged BT.709 `#00ff00`/`#00d700` strobe passes read as BT.601 (green clips, ΔL 0.229
  → 0.019) and fails read as BT.709 (`flash-video.test.ts`). VP9 always carries its range bit, so only
  its matrix is ever assumed. A tag the conversion cannot apply (ycgco) is refused, not called untagged.
- **`scale=…:flags=accurate_rnd+full_chroma_int`**: ±1 level (0 on 10-bit); the default errs 2-3, and
  `accurate_rnd` alone is worse than the default (808080 → 7e7e7e). `format=rgb24` always: a 10-bit
  source otherwise writes 16-bit PNGs (pngjs fallback, 4x slower). PNGs at `-compression_level 1`
  with unfiltered rows (2x faster to write, 3-7x faster to read than sub/up/paeth); showinfo without
  checksums (they doubled a 1080p decode).
- **Strip the PNG colour chunks and ICC profile** (`setparams=…=unknown`, then `sidedata=…ICC_PROFILE`,
  both after `format=rgb24` — before it the matrix falls back to BT.601). ffmpeg copies the stream's tags
  into cICP / cHRM / gAMA and Chromium colour-manages them: grey 808080 showed as 8c8c8c, a SMPTE-170M
  frame shifted 63 levels. vlmkit's decoder reads the bytes, so the judge was right and every strip,
  crop and sheet a person or model looked at was wrong.
- **Each step's place in the chain is measured** (`filterChain`): non-square pixels resampled square
  after RGB, nearest, expanding (a YUV-domain bicubic resize blended a red/blue edge and, on a
  full-range stream, squeezed it to limited range first: 0/255 came out 16/235); alpha composited over
  white / black by premultiplying (the negative, for white), so every frame keeps its timestamp — an
  `overlay` on a colour source takes that source's constant rate; dropping alpha showed the colour under
  transparent pixels (a hidden strobe, or a visible one hidden). Interlaced: split into fields at twice
  the rate (woven, a field-rate strobe was a still comb; bwdif missed it too) — **frame by frame, by each
  frame's own flag**, in one decode with two named graphs (`showinfo@fields`, `showinfo@frames`): a
  broadcast capture that turns interlaced after 2s read as one still comb when the first 30 frames
  decided, and a container's `tt` tag over progressive x264 frames strobed every 1px row. Only a codec
  that flags no frame is split by the tag. The line-doubling `scale` keeps the display aspect, so it
  doubled the SAR (NTSC 8:9 → 16:9, frames 1280 wide): `setsar=sar/2` undoes it. A turned interlaced
  stream runs with `-autorotate 0` and the chain turns it after the split (`rotationFilters`, ffmpeg
  6.1's own mapping): autorotate turned it first, so 90° split columns and 180° reversed the fields.
  Split by the tag, the frames get the tag's order first (`setfield`): `separatefields` reads each
  frame's flag, and utvideo / ffvhuff / magicyuv / v410 flag nothing, which reads bottom first (a
  tt ramp came out reversed). FFV1 v3 codes each frame's structure, so it counts as a flagging codec.
  HEVC field pictures (each decoded frame one field, top and bottom alternating) are line-doubled
  as they are, never split again (split, a 30,000 px² box was judged at 15,200). Still fine detail
  in frames flagged interlaced (a text slide, PsF) is line-doubled into a field-rate twitter that the
  woven frames cannot tell from a field-rate strobe, so a fail that neither field parity repeats
  judged a frame at a time says it is not decisive (`report.fieldDetail`); a strobe on one parity
  (5 Hz at 50i, every tenth field) fails that parity and gets no such note. HEVC field pictures are
  detected per frame (a splice where two top fields meet had sent a stream back to the double split)
  and carry `fields` and each frame's parity.
- **A YUV codec's grey frames are luma** (AV1 4:0:0, HEVC RExt; any grey tagged limited, or given
  `--color-range`): limited unless tagged, and converted through YUV — swscale's grey → RGB applies no
  range (16 stayed 16, measured), and the step to YUV is `scale=in_range=R:out_range=R` first, since
  the scaler `format` inserts reads grey as full and writes YUV as limited (150/172 came out 145/164).
- **HDR is refused**: ffmpeg passes PQ / HLG code values through as SDR, no tone map, no gamut map.
- **A GIF / APNG is timed and looped as a browser plays it**, not as ffmpeg decodes it. Chromium 141 and
  149 hold any frame of 10ms or less for 100ms — computed on whole ms, so an APNG 1/95s frame is 10 and
  held 100; ffmpeg gives a GIF's 1cs frame 10ms and an APNG's 0 delay 1/15s, and its demuxer delay
  options changed nothing. ffmpeg decodes one pass; a browser loops (NETSCAPE2.0 or ANIMEXTS1.0; loop
  count N plays N + 1 times). A two-frame black/white GIF looping at 100ms is five flashes a second on
  screen and one transition in one decoded pass, so the loop is unrolled — as far as `--at` / `--to`
  reach, and by default to the frame on screen one second past one pass (whole extra passes made a
  2000-frame GIF 4000), each decoded frame decoded once and copied. ffmpeg's GIF demuxer merges an image
  with no graphic control extension into the one before (Chromium shows both): refused, never judged on
  fewer frames. So is a GIF ffmpeg composites otherwise (`gifCompositingProblem`). ffmpeg fills with
  the global table's background colour, opaque, only when there is a global table and the image has
  no transparent index (otherwise it fills transparent, as Chromium does — measured pixel for pixel),
  so refused: a first image larger than the screen (Chromium grows the canvas, ffmpeg crops); one
  smaller, opaque; a frame disposed to background, opaque, that the next does not paint over (a
  black/white strobe passed, a static white GIF failed); and restore-to-previous over that fill
  (ffmpeg restores it, Chromium a cleared canvas) — tracked frame by frame: a sprite restored over an
  opaque first frame restores that frame's pixels in both, and refusing it hid a real strobe. The refusal carries an ImageMagick coalesce recipe
  whose import repeats the loop (`scan video <dir> --loop`: its pts end with the pass's end); one
  pass marked `--every-frame` was the false pass again. A GIF's aspect byte and a PNG's pHYs are not
  applied (a browser lays an image out at its pixel size). An APNG plays the frames its `acTL`
  declares, and its own extension is `.png`: `check flash` sniffs it by walking chunk headers to
  `acTL` (a first frame over 1 MiB hid the second `fcTL`), and it is decoded with `-f apng` — ffmpeg's
  probe gives up past ~2 KB of metadata before the first frame and reads one still. A span with no
  `--to` on a forever loop runs a pass and a second past `--from`; after a finite one's last pass its
  last frame stays on screen.
- **A recording's frames are its whole content only when they are all of it.** `check flash` counts
  consecutive indices from the first frame to the last as whole: a pass on 25fps is a real pass, and at
  6fps or less nothing can fail — nor in a span decoded with its history (`coverage.complete`, not
  `whole`, decides; a 6fps span read NOT JUDGEABLE). A span is not whole: judged as whole, a 0.5s span
  of a 5 Hz strobe passed. So `check flash rec.mp4 --from/--to` decodes `SPAN_HISTORY_MS` (3s) before the
  span (`selection.leadInMs`) and judges only the windows that end inside it (`createFlashJudge`'s
  `judgeFromMs`) — **the window ending at the start is judged even with no transition on it** (it holds
  the most; a strobe stopping just before `--from` passed), and the start is the one asked for, not
  the start of the frame on screen then (in a 3s hold that window ended before the hold). The history
  is 3s, not 1: a pixel's count depends on whether the change it is in was already counted, and with
  one second a 0 → 0.06 → 0.12 step lost its first transition (both a false pass and a false fail,
  measured). Warmed for two more, a difference needs one slow change through all three, and a verdict
  one transition decides says so (`report.history`) — decided by area (`margins` in the judge: the
  best field of the pixels one short, ≥ 6, in windows that hold a seventh frame, and of those one to
  spare, ≥ 8), not by the peak, which a small region strobing more hid. The motion re-count of a run
  starts `MOTION_LEAD_MS` (2s) before its first window, the same warm-up as a span's history (at
  250ms a still field read "motion flicker", and a small object moving beside it hid the guard), a
  re-count that explained no step never excuses a run, and in a span it judges only the windows
  ending in it (a strobe in the history had failed the span). A span without its history, or of a
  damaged recording, is `flash-undersampled` — and still judged only from its start. An import is complete only with `--every-frame` (a `-vf fps=5` export of a
  strobe passed as whole). `check flash rec.mp4` and `scan video` + `check flash frames.json` give the
  same report (a test holds it). The area is CSS px: `--display-width` (a 160x120 strobe passes at its
  size, fails at 320 wide); at most 4096 a side.
- **Codec noise does not invent or hide a full-field strobe** (crf 23/35/45, Playwright's VP8, 25/30/60
  fps); it does move areas near the limit (4:2:0 took a red/black box's 1px rim off, fail → pass;
  ringing grew a black/white one 3%) — said as "not decisive" within 5% — and a two-frame GOP at crf 45
  made dense static text fail on its own (said when a failing lossy stream has > 3 keyframes a second).
  The red track's real hole was near-black: a codec decodes black as (1,0,0), red's own chromaticity,
  and a 148x148 red strobe passed at crf 35 and 45; `flash.ts` now treats luminance ≤ 0.001 as black for
  chromaticity. Not fixed, found here: a 1D grating whose bars are as wide as a 16px block (32px
  period) moving 4px a frame reads as flash even losslessly (`flash-motion.ts` says so; 8px bars read
  as motion).
- **The output directory** is `<recording>.frames/` (`clip.mp4` and `clip.webm` shared `clip.frames/`
  and the second scan deleted the first), cleared of the previous scan only once the new frames are
  decoded and checked (a failed re-scan had deleted the last good one), never of the recording itself
  (an APNG named `0000-t000000.png` was overwritten by its own frame 0: such a name is refused, through
  symlinks too), and refused when another tool's `frames.json` is in it — by an import as well, which
  had replaced a `check flash` manifest and disarmed that check. A lock file names the scan writing
  there (two scans into one directory deleted each other's work); a dead one's is taken over. A
  killed run's ffmpeg is killed too (it kept writing gigabytes as an orphan), by signal listeners that
  exist only while a decoder runs (left installed, they swallowed Ctrl-C for the minute a judge holds
  the event loop); its work directory, and `check flash`'s pid-named temp frames, are removed by the
  next run. The decoder's errors are kept by level (`-loglevel level+info`, error or worse, from the
  demuxer and decoder): a keyword list missed Matroska's `File ended prematurely` and HEVC's damage,
  and caught a title with "Truncated" in it. A stream whose frames end well before its stated
  duration says the file may be cut short. On PATH only absolute entries are searched, POSIX for an
  executable file, Windows for the `.com` / `.exe` a shell-less spawn runs. A dropped packet is said
  only as a warning (`Packet corrupt`, `corrupt input packet`): those are kept too and make the
  recording `damaged`, so a pass on it is not backed (a TS that lost a white blip passed as complete).
  The lock and the temp frames carry a host + PID-namespace identity: a pid from a container sharing
  the directory reads as dead here, so another identity's is taken as abandoned only after a day, and
  a second scan into the same directory in one process is refused. The recording is guarded as it
  resolves too (a symlink elsewhere to a frame-named file in `--out`) and against the work-dir sweep's
  `.scan-video-*` names. A stream's stated end (start + duration) is where its last frame is on screen
  until when it decoded cleanly: an MP4 with B-frames gives a held last frame's duration to a frame in
  decode order. A file that ends short with decoder errors (`File ended prematurely`) is cut short,
  not held: a span in its lost part is refused, and the recording is `damaged` (judged as a held
  frame, a truncated strobe passed as complete).
- **`snapshot storyboard` refuses a lossy recording without `--lossy`**: it compares pixels exactly and
  has no noise floor; with `--lossy` SUMMARY.md names the events that begin on a keyframe. A lossless
  one (ffv1, png, qtrle; not rpza, a vector quantizer) is segmented like any capture: a planted glitch
  and transient come back on their frames. On the stream clock 16.67ms gaps are a recording's rate,
  never "every 60 fps frame".

## Responsive layout as a property-based test (`check responsive`)

```bash
vlmkit check responsive page.html                    # seed 1, 60 cases: every transition's two sides + random viewports per regime
vlmkit check responsive page.html --text-scale 2     # also generate root font-size 1..2x (WCAG 1.4.4)
vlmkit check responsive page.html --width 768 --height 900   # replay one case — every failure prints this line
vlmkit check responsive fixtures/responsive-patterns/mutants/card-grid--fixed-four.html   # a worked failure
```

The viewport is a generated input; the page's own media queries partition it (`matchMedia` decides,
parsed numbers only seed the sampling, so em / range syntax / `calc()` partition correctly); the
properties are `check integrity`'s layout judges run per case plus `text-starved`. Each case is one
resize of one loaded page, never a reload. A failure is shrunk before it is shown — every dimension
but width back to the base case (so `needs height=578` means it only happens on short screens), then
the width to its exact failing interval, which is anchored to the transitions, then ddmin over the
declarations whose override clears it. Pure half: `@mizchi/vlmkit-judge/pbt.ts` (seeded generator,
`shrinkRecord`, `failingInterval`, `minimizeSubset`) and `responsive.ts` (regimes, anchoring, ranking,
`judgeStarvedText`); browser half: `packages/vlmkit-markup/src/stress/responsive-pbt.ts`, whose
`runResponsiveOnPage(page, { properties })` takes a caller's own properties.

Three things measured while building it, not to re-learn:

- **The page's CSS is read and edited through the DevTools protocol, not the CSSOM.** A sheet
  linked from a `file:` page is cross-origin in Chromium (so is a CDN one) and `cssRules` throws:
  the CSSOM version tested no declaration on any demo site. `stress/responsive-css.ts` uses
  `CSS.getMatchedStylesForNode` (the cascade as computed, in order) and `CSS.setMediaText`.
  Never "fix" this with `--allow-file-access-from-files` — that hands the page under test the disk.
- **A suggested breakpoint is tried, not printed.** The conditions on both sides of the anchoring
  transition are rewritten, the interval re-checked and every property re-checked there; only
  then does the report say `verified`. A move that trades the failure for another says what it breaks.
- **The first declaration that clears a squeeze is usually `padding: 0`.** It clears almost any of
  them and names nothing, so candidates are ranked — rules inside the anchoring `@media` (or an
  `@container`) first, sizing and wrapping before spacing, larger forced size first — and the first
  single override that clears it wins, with two alternatives. `text-starved` holds display type
  (≥24px) to the 4em tier only: a 42px Japanese headline in four lines of five characters is a
  typographic choice, and was the one false positive on the live corpus.

Catalog of eleven responsive patterns with one mutant each (every intact page silent, every mutant
reported with its breakpoint and cause): `fixtures/responsive-patterns/` (`build.mjs` writes the
mutants). Round: `docs/reports/2026-09-26-responsive-pbt-v1.md`.

## Accessibility with no DOM (`scan a11y` → `check a11y tree`)

```bash
vlmkit scan a11y https://example.com/flutter-app/ --click Practice --out a11y.json   # Flutter web
vlmkit scan a11y ui.xml --density 420 --frame frame.png --out a11y.json            # Android uiautomator dump
vlmkit scan a11y --app TextEdit --out a11y.json                                    # macOS window via AX (on a Mac)
vlmkit scan a11y a11y.ax.json --out a11y.json                                      # re-import a saved AX dump, any OS
vlmkit check a11y tree a11y.json      # unlabelled-control / unreachable-content / contrast-below-aa / target-undersized
```

For apps whose DOM is not the UI — Flutter web paints a canvas and its accessibility DOM is
transparent, so the DOM gates' contrast rules read every label as 1.00:1 — and for platforms
with no DOM at all. The contract is `vlmkit-a11y/1` (`@mizchi/vlmkit-judge/a11y-tree.ts`):
role, name, rect, states, actions, plus the frame. Paint comes **only from the frame's pixels**,
never from the tree. Any platform's script can write the file; `docs/a11y-tree.md` has the
schema and `docs/reports/2026-09-25-a11y-tree-v1.md` the round on ofc-app's real build.

Three things measured there, not to re-learn:

- Pixel contrast drops ink components that are rules or outlines — spanning the rect's width
  AND thin or spanning its height. Width alone dropped whole glyphs in a tight text rect.
- Text size is the tallest inked-row run / 0.9, never the rect's height: a rect-height floor
  held 14px red card labels to 3:1 and passed them at 3.68:1.
- `scan a11y` pins `--locale en-US`: a Flutter build with no locale throws in `Intl.Locale`
  before its first frame, and the page reads as not-Flutter.

**macOS (`--app`)** compiles a Swift collector (`macos-ax-dump.swift.ts`, a string so it survives
`vp pack`) once with `swiftc`, walks one window's `AXUIElement` tree in points and captures the
window; `macos-ax.ts` maps the dump, and is the only half Linux tests reach. The other half is
`.github/workflows/macos-ax.yml` on a hosted `macos-15` runner, which grants Accessibility and
Screen Recording: an AppKit fixture with planted defects, collected, judged and re-imported.
Read its log through the MCP `get_job_logs` (the built-in `gh` cannot fetch logs). Measured
there, not to re-learn:

- An AX frame is the bezel (40x32 `NSButton` → 28x22), so plant geometry by AX frames.
- Overlay scroll bars expose arrows/pages as `AXButton`s (two 0x0): dropped as scroller parts.
- Title-bar buttons have only `AXRoleDescription`; named by it, contrast read the red close disc
  as text (4.29:1) — hence `nameDrawn: false` for names that are announced, not painted.
- swiftc 6 timed out type-checking a five-term `+` chain of optionals; build strings in steps.
- AppKit's default placeholder colour is 1.83:1 on white: a real 1.4.3 failure, left reported.

In this sandbox Chromium cannot verify the egress proxy's CA, so a live site is replayed from a
HAR recorded through Node (`NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt NODE_USE_ENV_PROXY=1`)
with `--har` — never by turning TLS verification off.

## Explanatory figures: mizchi/explainer; `vlmkit-anim` is gone

The `d2-diagram` / `d2-slides` skills live in [mizchi/explainer](https://github.com/mizchi/explainer)
since 2026-10-02. `vlmkit-anim` (`@mizchi/vlmkit-anim`) went there with the `explain-with-anim` /
`explanatory-animation` skills and was then **deleted** (explainer 0.5.0; deprecated on npm):
explainer's figures are Mermaid / D2 text held to fact sheets, and nothing is animated. The rounds
that shaped it stay here as history only — `docs/reports/2026-09-0{4..9}-anim-ir-v*.md`,
`docs/reports/2026-09-14-d2-diagram-v{1,2}.md` — and describe a tool that no longer exists.

This repository depends on it for nothing. The README's workspace map is drawn by a local script
(the `pr-visual` change-map workflow was removed with the package):

```bash
node scripts/workspace-map.mjs --write      # regenerate the README's mermaid map; tests/readme-workspace-map.test.mjs holds it to the manifests
```

The frame-sampled evaluator, `@mizchi/vlmkit-animation-eval`, stays here: it is
`check animation`'s measurement (it was split out so `vlmkit-anim eval` could share it; that consumer
is gone, the package boundary stays).

**In this repository, explain concepts with mermaid.** Animated reviews read badly: a GIF or a
contact sheet has to be played or scanned to get what one static figure says, and it cannot be
diffed or edited in review. So a PR description, a design doc, a report or a reply that needs a
figure carries a ```` ```mermaid ```` block (flowchart / sequenceDiagram / stateDiagram-v2) that
GitHub renders inline.

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

# All three from ONE page load: capture once, judge with no browser (reports equal the live runs)
vlmkit scan style page.html --out snap.json
vlmkit check design --from snap.json; vlmkit check composition --from snap.json; vlmkit check color --from snap.json
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

## Feature demos (`examples/demos/`)

```bash
pnpm build                                                        # capture runs the CLI from dist/
node --experimental-strip-types examples/demos/capture.mjs        # every demo: run, shoot, render (+ README table)
node --experimental-strip-types examples/demos/capture.mjs copy zoom
node examples/demos/render.mjs                                    # prose edits in demos.mjs only — no browser
```

One page per feature at `/demos/<id>/` on Pages, listed in the README's generated table. `demos.mjs` is the
manifest (page under test, the command, prose, shots); `capture.mjs` runs each command for real and keeps
its output in `<id>/result.json`; `render.mjs` is pure. Rules the pipeline enforces, not to work around:

- **The page under test is a fixture, copied byte for byte** (`demos.test.mjs` compares them). Change the
  fixture and re-capture; never edit `<id>/page.html` of a fixture-backed demo.
- **An outline on a screenshot may only mark a selector the command printed** — `capture.mjs` refuses
  otherwise. `check copy` prints text, not selectors, so its shot has no outlines.
- **Every number in a demo's prose is in its output.** Re-read the prose after a re-capture; the output
  changes when a gate does. (Found building it: `check copy` passes an ellipsis-truncated line on purpose —
  integrity calls `text-overflow: ellipsis` intentional — so that defect was dropped rather than claimed.)
- A published copy manifest is `manifest.txt`: the Pages test refuses any published `copy.txt`.

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
| `TYPESAFEAI_API_KEY` | TypeSafe Jev API key (`jev-client.ts`, `jev-box` bench) | — |
| `VLMKIT_IMAGE_MODEL` | Image-generation model (any OpenRouter id, or `gpt-image-2` for api.openai.com) | openai/gpt-image-2.5-flare |
| `DEBUG_VLMKIT` | Enable debug logs | — |

### Which model to set, by who is asking

Set your own family's model so a run is reproducible from the transcript. The same table is in
[`AGENTS.md`](../AGENTS.md), which is what a non-Claude agent reads, and
`tests/agent-model-defaults.test.mjs` pins the two to each other and to the code.

- **Claude Code** (this file's reader): `VLMKIT_VLM_MODEL=claude:claude-haiku-4-5-20251001`,
  `VLMKIT_LLM_PROVIDER=anthropic` — the benchmarked recommendations above.
- **Codex / any OpenAI-based agent**: `VLMKIT_VLM_MODEL=openai/gpt-5.6-luna` and
  `VLMKIT_LLM_PROVIDER=openrouter VLMKIT_LLM_MODEL=openai/gpt-5.6-luna`.

`openai` is **not** an LLM provider name — the LLM and VLM clients have no `api.openai.com` route
(only the image client's bare `gpt-image-2` does, with `OPENAI_API_KEY`), and the `openai/` in the id
is an OpenRouter catalogue prefix. Setting
`VLMKIT_LLM_PROVIDER=openai` fails with `INVALID_PROVIDER`; the message now names the route, and
`OPENAI_DEFAULT_MODEL` in `packages/vlmkit-ai/src/llm-client.ts` is the one place the id is written.

## Package Layout

This repository is a pnpm workspace.

| Path | Contents |
|------|----------|
| `packages/vlmkit-judge/` | **Pure judges** (`judgeComposition`, `judgeColorRoles`, `judgeDesignPolicy`, the 15 `check integrity` judges, both `--allow` parsers, `UsageError`): snapshot in, findings out. Zero deps, no DOM / Playwright / `node:*` — `purity.test.ts` enforces it, `scene-graph.test.ts` judges a non-DOM game menu. The bottom layer (`judge ← core ← capture ← markup`); markup re-exports every moved symbol from its old path. `scene.ts` is the **scene contract** — the image-mode `--elements` JSON as `SceneElement`, plus `sceneFromTree` (engine-style local coordinates) and adapters to integrity, composition, colour and design — each reachable as `--elements` on its gate (`check color` reads `role: field | link | button`; `check design` groups by any `role`; `check composition` reads boxes, `heading`, font, and background / border / radius as a group's painted edge; `check copy` sorts drawn strings with the page's invisible-reason classes from `opacity` / `color` / `background`, the judgement itself in `copy.ts`); `integrity-image.ts` is only its file-reading half. `a11y-tree.ts` is the second contract, for what a platform *announces* rather than paints — `vlmkit-a11y/1`, judged by `check a11y tree` with contrast read from the frame's pixels. `color.ts` is the page's colour arithmetic as pure functions, and `vlmkit-markup/src/contrast-parity.test.ts` holds the two to each other (functions over a grid, and the real `COLLECT_TEXT_CONTRAST` vs the scene adapter on one page). Rule: the collector resolves colours, the judge composites and measures. Both DOM contrast collectors follow it: `COLLECT_TEXT_CONTRAST` ships `TextContrastSample`s (colour, background layers, opacity, font) to `textContrastCandidates`, and `COLLECT_COLOR_ROLES` ships `ControlSample` / `LinkSample` to `controlBoundary` / `linkCue`; each move was proven by byte-identical `--json` on 15-16 pages. `pbt.ts` is the property-based search (seeded generator, greedy shrink, failing-interval bisection, ddmin) and `responsive.ts` the viewport space it searches for `check responsive` — both pure, both usable for any property with an async oracle. `frames.ts` is the `vlmkit-frames/1` contract and its time grammar, and `storyboard.ts` segments such a sequence into states and events over any `FramePixels` (`snapshot storyboard`); `flash.ts` and `flash-motion.ts` are WCAG 2.3.1's arithmetic over one (`check flash`). Plan for the rest of the split: `docs/design/package-decomposition.md`. |
| `packages/vlmkit-core/` | Image / CSS / DOM / a11y diff engine + shared types and CLI helpers. No Playwright or AI deps required to import core types. |
| `packages/vlmkit-core/src/plugin/` | **Gate plugin runtime**: the contract (`defineGate` / `definePlugin`), rule tables and settings, the registry, and the core runner that owns `--help` / `--json` / `--advisory` / the run ledger / the exit code. Core never imports a gate — definitions are handed to it. |
| `packages/vlmkit-markup/src/gates/` | Gate definitions (`*.gate.ts`) + the main built-in plugin (`index.ts`) — 33 of the 35 gates. Wraps existing measurement code; adding a gate is `defineGate` + one line in `index.ts`. |
| `packages/vlmkit-capture/src/gates/`, `src/gates/` | The other two built-in plugins: `check crater` (capture) and `check perf` (app-side). Composed by `src/cli/gate-registry.ts` alongside any `vlmkit.config.json` `"plugins"`. |
| `packages/vlmkit-capture/` | Playwright / Crater capture infrastructure, viewport discovery, prescanner. |
| `packages/vlmkit-ai/` | VLM / LLM clients, reasoning pipeline, NLP helpers. |
| `packages/vlmkit-markup/` | VLM-driven markup tooling: component extract / from-image, design tokens, theme parity, i18n stress, palette, dep-graph, selector-heal, smoke-runner. |
| `packages/vlmkit-animation-eval/` | **Frame-sampled animation evaluator** (`runAnimationEval`): the measurement behind `vlmkit check animation` and `check integrity --timeline`'s clock. Depends on core, judge (pure: the frame format and the timeline instants) and Playwright; split out for the (since deleted) `vlmkit-anim eval`, and kept as the first evaluation tool usable without the rest of vlmkit. Also the frames half: `frames-capture.ts`. |
| `src/cli/` | CLI entry + router + workflow command implementations (split per-command under `cli/workflow/`). |
| `src/api/` | HTTP API server (deep-imports vlmkit-markup smoke-runner + experiments/css-challenge). |
| `src/experiments/` | migration, css-challenge, detection, benchmark, flaker. |
| `src/demo/` | Demo scripts. |
| `src/util/` | App-side helpers (agent, goal-runner, skill, perf, integration tests). |
| `src/vrt/snapshot/`, `src/vrt/compare/` | Baseline / snapshot / flipbook workflow. |

Cross-package imports use `@mizchi/vlmkit-<pkg>/<path>.ts` or the curated barrel `@mizchi/vlmkit-<pkg>`. Within a package, use relative imports. The barrel excludes Playwright-bound and CLI-entry modules — deep-import those. (This line said `@mizchi/vrt-<pkg>`, which no package has been called since 0.6 — an import written from it does not resolve.)

**Toolchain: Vite+ (`vite-plus`, `vp`).** One `vite.config.ts` holds the test config (`vp test`, Vitest 5),
every library build (`vp pack`, tsdown 0.23) and the lint / format settings. Tests import from
`vite-plus/test`, which re-exports Vitest itself, so it throws on import outside the runner just as
`vitest` did. Run one file with `pnpm exec vp test run <path>`. `pnpm-workspace.yaml` overrides `vite`
and `vitest` to the copies Vite+ bundles; bump them together with `vite-plus`. Things to know
before changing it:

- **A `vp pack --filter` string matches a config's `name` or its `cwd` exactly.** A `/regex/` given
  on the command line matched nothing and exited 0 with no `dist/`. So the root build is
  `vp pack --filter .` (the three configs whose cwd is the root), and each package's own `build`
  is `vp pack --filter @mizchi/<name>`. `vp pack` has no `--config`, so all twelve builds live in
  that one `pack` list.
- **pnpm stays 10.** `vp migrate` pins pnpm 12 through `devEngines`, even with
  `VP_PACKAGE_MANAGER=pnpm@10…` set. It also runs Oxfmt over every file it rewrites, which turned an
  import rename into 24,568 changed lines. The migration was redone by hand for that reason. Never
  run `vp migrate` on this repository to "update" Vite+: bump the versions instead.
- **Formatting is enforced: run `pnpm fmt` before committing.** The `format` workflow runs `pnpm fmt:check`
  (`vp fmt --check`) on every PR and fails on any file Oxfmt would change. The scope is TS/JS only.
  `fmt.ignorePatterns` in vite.config.ts leaves out Markdown, JSON, HTML, CSS, YAML, the browser
  scripts of the judged pages (`examples/sites/*/`, the landing page's `app/content/preferences/scenarios.js`,
  solitaire's `game.js`) and `design-runs/`. Their bytes are compared elsewhere (fresh renders,
  fixture copies, judgment rounds), so formatting them would turn a style change into a behaviour
  change. `vp lint` is configured but not yet enforced.
- **`clearMocks: false` and `deps.resolveDepSubpath: true` keep the Vitest 4 / tsdown 0.21 behaviour**, and
  the comment beside each says how to drop it. With them, `vp pack` emits the same files with the same
  exported names as tsdown 0.21 did. The JavaScript differs only by `/* @__PURE__ */` notes and constant
  folding, and the declarations only by inline `export` instead of a trailing export list.

Run tests for a single package: `pnpm --filter @mizchi/vlmkit-core test`. From repo root, `pnpm test` runs all. **Editing a `packages/*/src` file and then running the CLI shows the OLD behavior**: `@mizchi/vlmkit-*` resolves through `exports` to `dist/*.mjs`, so `pnpm build` has to run in between (and never pipe its output to `head` — SIGPIPE leaves a half-deleted `dist/`).

The `vlmkit-markup` markup-core tests build MoonBit sources on demand and need the `moon` CLI. The module file is `moon.mod`, not `moon.mod.json`: CI installs the latest `moon`, and a release between 2026-10-11 and 2026-10-12 refuses the JSON form (`moon fmt` migrates it, but also reformats every `.mbt`; take only the `moon.mod` it writes). If tests fail with `spawnSync moon ENOENT`, add it to PATH first (it is often installed but not on PATH in sandboxes): `export PATH="$HOME/.moon/bin:$PATH"`. If it is not installed at all: `curl -fsSL https://cli.moonbitlang.com/install/unix.sh | bash`. Without it ~138 tests fail on the toolchain rather than on anything real, so install it before trusting a red suite.

**After editing anything under `.claude/skills/`, run `pnpm sync:skills`.** The content lives there once and is copied into two installer packages (`skills/vlmkit/workflows/`, `.apm/skills/vlmkit/`); `tests/skill-package.test.mjs` fails if the three drift, and hand-editing a copy is the wrong repair.

There are **three** publication routes and still only those **two** copies. The third is the Claude Code plugin marketplace, `.claude-plugin/marketplace.json`, whose one plugin's `source` is `./skills/vlmkit` — the package the npm installer already publishes. So it adds no third copy and nothing new for `pnpm sync:skills` to remember; `tests/skill-package.test.mjs` asserts that (the plugin root holds `SKILL.md` and no `skills/` subdirectory, which is what makes it a single-skill plugin needing no `plugin.json`). A new directory under `.claude-plugin/` would be a fourth copy and is the wrong repair for anything. The manifest deliberately carries no `version`: with a relative source in a git-hosted marketplace, update detection falls back to the commit SHA, so every skill edit ships — pinning a version would hide edits until someone bumped it, and `package.json`'s version is the CLI's, not the skills'.

**Commands invoked from `.github/workflows/` are checked by `tests/workflow-commands.test.mjs`.** Renaming or removing a CLI verb fails that test rather than a 15-minute browser job — or, worse, than nothing at all when the workflow step ends in `|| true`.

## Releasing to npm (`.github/workflows/publish.yml`)

```bash
node scripts/publish-npm.mjs --dry-run      # pack all 10 public packages, npm publish --dry-run; no credential needed
git tag v0.23.0 && git push origin v0.23.0  # the release: publish.yml runs the script with --tag
```

npm **Trusted Publishing** (OIDC): no token exists anywhere, and each package's trusted publisher on
npmjs.com names this repo and `publish.yml`. The script refuses a tag that is not the packages' one
version, packs with pnpm (a tarball still holding a `workspace:` range stops the run before the first
publish) and publishes dependencies first (`judge` → … → the root CLI); a version already on npm is
skipped, so a failed run is re-run as is. A trusted publisher can only be added to a package that
exists, so **a new package's first version is published by hand** — `@mizchi/vlmkit-judge` was the
case at 0.23.0.

## Documentation Structure

| File | Contents |
|---------|------|
| `docs/a11y-tree.md` | **Accessibility with no DOM**: the `vlmkit-a11y/1` contract (role / name / rect / states / actions + frame), `scan a11y`'s Flutter web and Android collectors, `check a11y tree`'s four rules, and how a collector for another platform writes the file |
| `docs/markup-assist.md` | Context-free guide to the deterministic markup gates (CLI / MCP / skill install, task routing, done-condition recipes) |
| `docs/cli-reference.md` | Complete command reference moved out of README (groups, examples, workflow/API/HTTP, architecture, project structure) |
| `docs/configuration.md` | Setup detail moved out of README (install, MCP/skill, env vars, snapshot/CI config, APM skills catalog) |
| `docs/knowledge.md` | Accumulated experiment findings (detection rates, VLM comparisons, fix patterns, etc.) |
| `docs/api-design.md` | CLI / library API design |
| `docs/reports/2026-08-06-gate-rule-cost-bench.md` | Measured gate/rule execution cost: where a ruleset's time goes, why per-rule cost is attributed rather than isolated, why suppression saves nothing |
| `docs/authoring-gates.md` | **User-facing how-to for adding a metric**: the contract field by field, choosing severities/categories, reading project config, browser measurement, testing, publishing. Runnable examples in `examples/gate-plugin/` |
| `docs/design/package-decomposition.md` | **Splitting vlmkit by layer** (collector / pure judge / driver / loop / diagrams): what was measured, phase 1 (`vlmkit-judge`) and the proposed phases 2-5 |
| `docs/design/gate-plugin-architecture.md` | Gate plugin contract, rule settings, the 35 gates + 217 rules, behavior changes, what is deliberately not a gate |
| `docs/design/moonbit-boundary.md` | **TS ↔ MoonBit boundary**: what the positional FFI costs (61 commands, 233 args, 2 duplicated dispatch tables), the JSON boundary that replaces it for new logic, how to add a command, and which pure logic belongs in MoonBit versus which deliberately does not |
| `docs/crater-css-status.md` | Crater CSS rendering verification status |
| `docs/reset-css-comparison.md` | Reset CSS domain knowledge |
| `docs/reports/` | Individual experiment reports (dated) |
| `TODO.md` | Done / Evaluation / Backlog |
