# vrt — Project Skills

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
VRT_VLM_MODEL="<model-id>" node --experimental-strip-types src/experiments/css-challenge/fix-loop.ts \
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

### `vlm-region-diff` CLI Default (2026-05-23)

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
vrt compare before.html after.html

# URL comparison
vrt compare --url http://localhost:3000/ --current-url http://localhost:8080/

# With masks (exclude dynamic content)
vrt compare --url http://localhost:3000/ --current-url http://localhost:8080/ --mask ".marquee-container,.hero-badge"
```

## Snapshot (URL → multi-viewport capture)

```bash
# First run: create baseline. Subsequent runs: baseline + diff
vrt snapshot http://localhost:3000/ http://localhost:3000/about/ --output snapshots/

# With masks (exclude animated/dynamic elements)
vrt snapshot http://localhost:3000/ --mask ".marquee-container,.hero-badge"
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
VRT_VLM_MODEL="bytedance/ui-tars-1.5-7b" pkf run fix-loop -- --fixture page --seed 11 --mode selector
```

## Environment Variables

| Variable | Purpose | Default |
|------|------|----------|
| `VRT_LLM_PROVIDER` | LLM provider | gemini |
| `VRT_LLM_MODEL` | LLM model | Provider default |
| `VRT_VLM_MODEL` | VLM model (OpenRouter / `gemini:` / `claude:`) | bytedance/ui-tars-1.5-7b |
| `OPENROUTER_API_KEY` | OpenRouter API key | — |
| `GEMINI_API_KEY` | Google AI API key | — |
| `ANTHROPIC_API_KEY` | Anthropic API key | — |
| `DEBUG_VRT` | Enable debug logs | — |

## Package Layout

This repository is a pnpm workspace.

| Path | Contents |
|------|----------|
| `packages/vrt-core/` | Image / CSS / DOM / a11y diff engine + shared types and CLI helpers. No Playwright or AI deps required to import core types. |
| `packages/vrt-capture/` | Playwright / Crater capture infrastructure, viewport discovery, prescanner. |
| `packages/vrt-ai/` | VLM / LLM clients, reasoning pipeline, NLP helpers. |
| `packages/vrt-markup/` | VLM-driven markup tooling: component extract / from-image, design tokens, theme parity, i18n stress, palette, dep-graph, selector-heal, smoke-runner. |
| `src/cli/` | CLI entry + router + workflow command implementations (split per-command under `cli/workflow/`). |
| `src/api/` | HTTP API server (deep-imports vrt-markup smoke-runner + experiments/css-challenge). |
| `src/experiments/` | migration, css-challenge, detection, benchmark, flaker. |
| `src/demo/` | Demo scripts. |
| `src/util/` | App-side helpers (agent, goal-runner, skill, perf, integration tests). |
| `src/vrt/snapshot/`, `src/vrt/compare/` | Baseline / snapshot / flipbook workflow. |

Cross-package imports use `@mizchi/vrt-<pkg>/<path>.ts` or the curated barrel `@mizchi/vrt-<pkg>`. Within a package, use relative imports. The barrel excludes Playwright-bound and CLI-entry modules — deep-import those.

Run tests for a single package: `pnpm --filter @mizchi/vrt-core test`. From repo root, `pnpm test` runs all.

## Documentation Structure

| File | Contents |
|---------|------|
| `docs/knowledge.md` | Accumulated experiment findings (detection rates, VLM comparisons, fix patterns, etc.) |
| `docs/api-design.md` | CLI / library API design |
| `docs/crater-css-status.md` | Crater CSS rendering verification status |
| `docs/reset-css-comparison.md` | Reset CSS domain knowledge |
| `docs/reports/` | Individual experiment reports (dated) |
| `TODO.md` | Done / Evaluation / Backlog |
