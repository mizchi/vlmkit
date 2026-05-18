# vrt — Project Skills

## How to Update VLM Model Benchmarks

### Purpose
Periodically evaluate VLM (Vision Language Model) cost-performance for analyzing VRT diff images.

### Steps

1. **Check available models** (dynamically fetched from OpenRouter API):
```bash
just vlm-bench --list --max-cost 0.001 --limit 30
```

2. **Run fix-loop with candidate models** (hard case: seed 11):
```bash
VRT_VLM_MODEL="<model-id>" node --experimental-strip-types src/experiments/css-challenge/fix-loop.ts \
  --fixture page --seed 11 --mode selector --max-rounds 2
```

3. **Measure VLM quality** (token count, latency, CHANGE detection count):
```bash
just vlm-bench <model1> <model2> <model3> --md
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

### Current Recommendations (2026-05-18)
- **Default**: `bytedance/ui-tars-1.5-7b` (1.16s, $0.1e-6/$0.2e-6) — UI-domain-trained, fastest of the structured outputs
- **Stable / detailed**: `qwen/qwen3-vl-30b-a3b-instruct` (1.99s) — emits hex codes directly
- **Baseline fallback**: `amazon/nova-lite-v1` (2.38s)
- **High quality (agent-facing CHANGE list)**: `claude:claude-haiku-4-5-20251001` (3.51s, ~$0.002/call — only when VLM output is consumed directly, not via Stage-2 LLM)

#### Avoid / re-evaluate
- `meta-llama/llama-4-scout` — regressed since 2026-04-04 (was 1.0s, now ~7s with conversational output)
- `meta-llama/llama-4-maverick` — claims "image not available" and returns methodology only
- `google/gemini-2.5-flash-lite` — hallucinates uniform `red → red` deltas

See `docs/reports/2026-05-18-vlm-claude-vs-openrouter-vs-newcomers.md` for the 8-way bench evidence.

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
just css-bench-crater --fixture page --trials 30
```

### Tracking Detection Rate
```bash
just css-report  # Aggregate accumulated data
```

## Running Migration VRT

```bash
# Tailwind → vanilla CSS
just migration-tailwind

# Reset CSS comparison
just migration-reset

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
# luna.mbt (requires: npx serve ~/ghq/.../luna.mbt/dist -p 4200)
just dogfood-luna

# sol.mbt (requires: npx serve ~/ghq/.../sol.mbt/website/dist-docs -p 3000)
just dogfood-sol

# False positive test (compare same URL twice)
just false-positive http://localhost:3000/luna/
```

## Running Fix Loop

```bash
# Property mode (delete 1 CSS property)
just fix-loop --fixture page --seed 42

# Selector mode (delete 1 selector block)
just fix-loop --fixture page --seed 11 --mode selector --max-rounds 3

# Specify a VLM model
VRT_VLM_MODEL="bytedance/ui-tars-1.5-7b" just fix-loop --fixture page --seed 11 --mode selector
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
