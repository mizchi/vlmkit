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
`seek-ineffective` (suspect) says when an animation's frames do not measure it. Measured building
them, not to re-learn:

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
- The contrast collector resolves background from **ancestors only**: white text over a dark
  *sibling* reads as invisible at rest, with or without the timeline.

Fixtures: `fixtures/integrity-timeline/` (held, transient, clean, at-rest, script, fade-in,
background-late). On the 21 animated pages of the repo `--timeline` changes no verdict and adds no
held finding (8 transient glimpses, 7 of them the solitaire deal). Round:
`docs/reports/2026-10-01-hyperframes-motion-v1.md`.

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
| `packages/vlmkit-judge/` | **Pure judges** (`judgeComposition`, `judgeColorRoles`, `judgeDesignPolicy`, the 15 `check integrity` judges, both `--allow` parsers, `UsageError`): snapshot in, findings out. Zero deps, no DOM / Playwright / `node:*` — `purity.test.ts` enforces it, `scene-graph.test.ts` judges a non-DOM game menu. The bottom layer (`judge ← core ← capture ← markup`); markup re-exports every moved symbol from its old path. `scene.ts` is the **scene contract** — the image-mode `--elements` JSON as `SceneElement`, plus `sceneFromTree` (engine-style local coordinates) and adapters to integrity, composition, colour and design — each reachable as `--elements` on its gate (`check color` reads `role: field | link | button`; `check design` groups by any `role`; `check composition` reads boxes, `heading`, font, and background / border / radius as a group's painted edge; `check copy` sorts drawn strings with the page's invisible-reason classes from `opacity` / `color` / `background`, the judgement itself in `copy.ts`); `integrity-image.ts` is only its file-reading half. `a11y-tree.ts` is the second contract, for what a platform *announces* rather than paints — `vlmkit-a11y/1`, judged by `check a11y tree` with contrast read from the frame's pixels. `color.ts` is the page's colour arithmetic as pure functions, and `vlmkit-markup/src/contrast-parity.test.ts` holds the two to each other (functions over a grid, and the real `COLLECT_TEXT_CONTRAST` vs the scene adapter on one page). Rule: the collector resolves colours, the judge composites and measures. Both DOM contrast collectors follow it: `COLLECT_TEXT_CONTRAST` ships `TextContrastSample`s (colour, background layers, opacity, font) to `textContrastCandidates`, and `COLLECT_COLOR_ROLES` ships `ControlSample` / `LinkSample` to `controlBoundary` / `linkCue`; each move was proven by byte-identical `--json` on 15-16 pages. `pbt.ts` is the property-based search (seeded generator, greedy shrink, failing-interval bisection, ddmin) and `responsive.ts` the viewport space it searches for `check responsive` — both pure, both usable for any property with an async oracle. Plan for the rest of the split: `docs/design/package-decomposition.md`. |
| `packages/vlmkit-core/` | Image / CSS / DOM / a11y diff engine + shared types and CLI helpers. No Playwright or AI deps required to import core types. |
| `packages/vlmkit-core/src/plugin/` | **Gate plugin runtime**: the contract (`defineGate` / `definePlugin`), rule tables and settings, the registry, and the core runner that owns `--help` / `--json` / `--advisory` / the run ledger / the exit code. Core never imports a gate — definitions are handed to it. |
| `packages/vlmkit-markup/src/gates/` | Gate definitions (`*.gate.ts`) + the main built-in plugin (`index.ts`) — 32 of the 34 gates. Wraps existing measurement code; adding a gate is `defineGate` + one line in `index.ts`. |
| `packages/vlmkit-capture/src/gates/`, `src/gates/` | The other two built-in plugins: `check crater` (capture) and `check perf` (app-side). Composed by `src/cli/gate-registry.ts` alongside any `vlmkit.config.json` `"plugins"`. |
| `packages/vlmkit-capture/` | Playwright / Crater capture infrastructure, viewport discovery, prescanner. |
| `packages/vlmkit-ai/` | VLM / LLM clients, reasoning pipeline, NLP helpers. |
| `packages/vlmkit-markup/` | VLM-driven markup tooling: component extract / from-image, design tokens, theme parity, i18n stress, palette, dep-graph, selector-heal, smoke-runner. |
| `packages/vlmkit-animation-eval/` | **Frame-sampled animation evaluator** (`runAnimationEval`): the measurement behind `vlmkit check animation` and `check integrity --timeline`'s clock. Depends on core + Playwright only; split out for the (since deleted) `vlmkit-anim eval`, and kept as the first evaluation tool usable without the rest of vlmkit. |
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

The `vlmkit-markup` markup-core tests build MoonBit sources on demand and need the `moon` CLI. If tests fail with `spawnSync moon ENOENT`, add it to PATH first (it is often installed but not on PATH in sandboxes): `export PATH="$HOME/.moon/bin:$PATH"`. If it is not installed at all: `curl -fsSL https://cli.moonbitlang.com/install/unix.sh | bash`. Without it ~138 tests fail on the toolchain rather than on anything real, so install it before trusting a red suite.

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
| `docs/design/gate-plugin-architecture.md` | Gate plugin contract, rule settings, the 34 gates + 211 rules, behavior changes, what is deliberately not a gate |
| `docs/design/moonbit-boundary.md` | **TS ↔ MoonBit boundary**: what the positional FFI costs (61 commands, 233 args, 2 duplicated dispatch tables), the JSON boundary that replaces it for new logic, how to add a command, and which pure logic belongs in MoonBit versus which deliberately does not |
| `docs/crater-css-status.md` | Crater CSS rendering verification status |
| `docs/reset-css-comparison.md` | Reset CSS domain knowledge |
| `docs/reports/` | Individual experiment reports (dated) |
| `TODO.md` | Done / Evaluation / Backlog |
