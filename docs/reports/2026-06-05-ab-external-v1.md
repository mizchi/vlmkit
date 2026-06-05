# A/B external-repo scenario v1: does vlmkit beat a bare-handed agent? (2026-06-05)

## Question

Every prior validation run measured "can an agent converge *with*
vlmkit" — never against a control. This run tests the actual product
claim: **does vlmkit make a coding agent repair a CSS regression
faster / cheaper / more reliably than the same agent without it**, on
an external repository vlmkit has never seen.

## Setup

- **Target**: `startbootstrap/startbootstrap-agency` (MIT) — static
  `dist/` with one 11,315-line `styles.css` (Bootstrap 5 compiled +
  ~700 lines of template-custom rules). Cloned fresh; not present in
  any vlmkit fixture.
- **Injected regression** (seed 1, harness
  `fixtures/ab-external/harness/inject-regression.mjs`): deleted the
  `.timeline > li .timeline-panel` block (5 decls). Visible **only at
  375×700** (13.53% diff) because `@media (min-width: 768px)`
  variants survive — desktop/tablet render 0.00%.
- **Both arms** got: 3 baseline PNGs (1280×800 / 768×900 / 375×700,
  captured pre-regression by a neutral Playwright script), an isolated
  workspace served on its own port, a 5-round budget, success = max
  per-viewport diff < 1% by the fixed scorer
  (`fixtures/ab-external/harness/score.mjs`, pixelmatch 0.1,
  white-padded size mismatch). Original CSS, the upstream repo, and
  all network access were explicitly forbidden.
- **Control**: plain Playwright + neutral capture/score + image
  reading. vlmkit forbidden.
- **Treatment**: vlmkit CLI (`diff png`, `diff region` with
  OpenRouter VLM, etc.) in addition to the neutral tooling.
- Capture determinism was verified before the run: two captures of
  the pristine page scored 0.000% on all viewports.

## Result

| metric | control (no vlmkit) | treatment (vlmkit) |
|---|---|---|
| final max diff | **0.000%** | **0.000%** |
| rounds used | 1 / 5 | 1 / 5 |
| wall clock | 2m26s | 4m30s |
| subagent tokens | 38.5k | 48.7k |
| tool calls | 11 | 23 |
| CSS vs original | identical (modulo 1 blank line) | identical (modulo 1 blank line) |

Both arms reconstructed the exact deleted rule, property-for-property,
in one round. **On this seed, vlmkit lost on every cost axis**: ~1.8×
wall clock, ~1.3× tokens, ~2× tool calls.

Honest read: this seed has a ceiling effect. The deleted block left a
near-identical sibling (`.timeline > li.timeline-inverted >
.timeline-panel`) in the stylesheet, so value reconstruction was
copy-paste; and the per-viewport scalar score alone ("375 is 13.5%,
others 0") already implied "mobile-first base rule deleted, media
override intact". Neither arm needed pixel-level measurement.

## What worked — the agents' own words

Treatment, on the one genuinely useful vlmkit signal:

> "`diff png --json` region list — all 7 regions started at y≥4704
> with full-width bboxes, instantly proving 'single mobile-only
> vertical reflow below the timeline', which pointed grep straight at
> the timeline rules."

Control, asked what tool it wished it had, independently specified
vlmkit's feature set:

> "a region-localizing pixel diff — something that outputs 'diff
> clusters at y=5800–8200 in 375x700' or a diff-heatmap PNG. […]
> Second wish: a computed-style differ (same element, baseline vs
> current, per-viewport) — would have named `padding-left` directly."

So the *demand* for vlmkit's signals is real — control spent "roughly
half" its time eyeballing two 9,400px-tall PNGs to do what `diff png`
does in one call. The problem is the *supply* side: see below.

## What didn't — vlmkit friction (treatment's words)

Treatment spent "~60% on the diff-localization loop (mostly working
around the two `diff region` failures + manual pngjs
cropping/measuring)". Each item below is filed as an issue draft
under `docs/issues-drafts/`.

1. **`diff region` crashes on tall captures** (full-page mobile is
   9,377–9,541px; Anthropic image limit is 8,000px). Needs
   auto-downscale / tiling / crop-to-region. (draft 01)
2. **Default `--max-tokens 600` truncates the VLM JSON**, degrading
   the verdict to a useless `uncertain`. Needs a saner default or
   auto-retry on truncation. (draft 02)
3. **`diff png` never reports the image dimension mismatch**
   (9,541 vs 9,377px). The 164px height delta was "the best clue" and
   required a hand-written pngjs script. (draft 03)
4. **No reflow/shift change type**: every layout-shift region was
   typed `element-added` (conf 0.3) with fabricated
   `#ffffff → #ffffff` colorSamples. (draft 04)
5. **No region bboxes in non-JSON output; no built-in crop tool**
   for inspecting a named region. (draft 05)
6. **`diff region` fabricates per-region `color` deltas** with hex
   values when the actual change is padding/float. Consistent with
   the 2026-05-23 bake-off note that per-channel hex are "vibes" —
   but here they were actively misleading. (draft 06)

## Verdict for v1

- **Outcome**: tie (both pixel-perfect, round 1).
- **Cost**: control wins clearly.
- **Qualitative**: vlmkit's deterministic signals (`diff png` region
  list) provided the localization both arms wanted; its VLM path
  (`diff region`) was net-negative on a real-world full-page capture.
- The claim "vlmkit makes agents better at CSS repair" is **not
  supported by this seed** — and not refuted either, because the
  scenario was too easy: sibling-rule redundancy made value recovery
  free.

## Next (v2)

1. Fix friction drafts 01–03 (the crash, the truncation, the missing
   dimension-mismatch signal) — these block any fair VLM-path use on
   real pages.
2. Re-run with a **harder seed class: property-value mutation**
   (shift a color, a padding, a font-size across 2–3 unrelated
   blocks, no deletions). No sibling rule to copy from — value
   reconstruction requires *measurement*, which is where
   `diff png` colorSamples / spacing tables should differentiate, if
   they work.
3. Keep the same target repo, same budget, same scorer, so v1/v2 are
   comparable.

## Files

- Harness: `fixtures/ab-external/harness/{inject-regression,capture,score}.mjs`
- Briefs (committed copies): `fixtures/ab-external/brief-{control,treatment}.md`
- Run artifacts (gitignored): `test-results/ab-external/seed-1/`
- Answer key: `test-results/ab-external/seed-1/answer-key.json`
  (selector `.timeline > li .timeline-panel`, 5 decls, line 11078)
