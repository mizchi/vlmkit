---
name: vrt-css-fix-loop
description: Closed-loop CSS auto-repair. Given a fixture with a known regression (one CSS property or one selector block removed), iterate with a VLM that proposes the missing fix from the diff screenshot, apply it, and re-run until the diff falls below a threshold. Currently scoped to the CSS-challenge fixture set in `src/experiments/css-challenge/`; adapting to an arbitrary repo requires writing a fixture entry. Use when measuring whether a VLM model can recover a known regression, not for production self-healing.
---

# vrt-css-fix-loop

`fix-loop` is the harness behind every VLM benchmark in this repo
(`docs/reports/2026-05-18-vlm-claude-vs-openrouter-vs-newcomers.md`
etc.). It takes a fixture, deliberately mutates the CSS (`property`
mode deletes one property; `selector` mode deletes one selector
block), then asks a VLM to propose the fix from the rendered diff.
Each round:

1. Apply current candidate CSS to the variant page.
2. Render baseline + variant; compute pixel diff.
3. Send the diff overlay to the VLM with a structured "list the
   changes" prompt.
4. Parse the VLM's CHANGE list; apply the top candidate.
5. Re-run; stop when diffRatio falls below threshold (= FIXED) or
   `--max-rounds` is exhausted.

## When to use

- Evaluating a new VLM model on UI-domain understanding.
- Comparing two model providers on the same fixture (controlled
  benchmark).
- Understanding "what kind of fix can a VLM actually propose?" before
  shipping a self-healing feature.

## When NOT to use

- Production self-repair on an arbitrary user repo — the harness only
  knows fixtures registered in `css-challenge-fixtures.ts`. Adapting
  to a new repo means writing a fixture entry + goal CSS first.
- Bulk regression triage: use `vrt-visual-diff` for one-shot reads.
- Per-PR CI gate: use `vrt-regression-watch`.

## Quickstart

```bash
# Property mode (default): delete one CSS property; VLM proposes restoration
node --experimental-strip-types src/experiments/css-challenge/fix-loop.ts \
  --fixture page --seed 42

# Selector mode: delete one full selector block (harder)
node --experimental-strip-types src/experiments/css-challenge/fix-loop.ts \
  --fixture page --seed 11 --mode selector --max-rounds 3

# Run with a specific VLM model (any OpenRouter id, `gemini:*`, or `claude:*`)
VRT_VLM_MODEL="bytedance/ui-tars-1.5-7b" \
  node --experimental-strip-types src/experiments/css-challenge/fix-loop.ts \
  --fixture page --seed 11 --mode selector
```

## Available fixtures

Listed in `src/experiments/css-challenge/css-challenge-fixtures.ts`.
Common entries:

| Fixture | Layout | Typical seeds |
|---|---|---|
| `page` | README-style article + sidebar | 1-99 |
| (others registered in the file) | … | … |

The seed maps deterministically to "which property / selector got
deleted." Seed 11 in selector mode is the canonical hard case
(`.readme-body pre` losing 6 properties → 4.1% diffRatio) used in
VLM benchmarks.

## VLM model selection

The harness honours `VRT_VLM_MODEL`. Prefix selects the provider:

| Prefix | Provider | Example |
|---|---|---|
| (no prefix) | OpenRouter | `bytedance/ui-tars-1.5-7b` |
| `gemini:` | Google AI | `gemini:gemini-2.5-flash` |
| `claude:` | Anthropic | `claude:claude-haiku-4-5-20251001` |

Current recommendations (from `.claude/CLAUDE.md`):

- **Default**: `bytedance/ui-tars-1.5-7b` (UI-domain-trained, ~1.2s).
- **Stable / detailed**: `qwen/qwen3-vl-30b-a3b-instruct`.
- **Baseline fallback**: `amazon/nova-lite-v1`.
- **High quality** (only when VLM output isn't consumed by Stage-2
  LLM): `claude:claude-haiku-4-5-20251001`.

Avoid: `meta-llama/llama-4-scout` (regressed; verbose),
`meta-llama/llama-4-maverick` (returns "image not available"),
`google/gemini-2.5-flash-lite` (hallucinates uniform deltas).

See `docs/reports/2026-05-18-vlm-claude-vs-openrouter-vs-newcomers.md`
for the 8-way bench.

## Flags

| Flag | Default | Purpose |
|---|---|---|
| `--fixture <name>` | — | Required. Fixture id from `css-challenge-fixtures.ts` |
| `--seed <int>` | — | Required. Seeds the deterministic mutation |
| `--mode <property\|selector>` | `property` | Mutation granularity |
| `--max-rounds <int>` | 5 | Hard ceiling on iterations |
| `--threshold <float>` | 0.001 | diffRatio at which FIXED is declared |
| `--no-db` | off | Skip writing the benchmark DB row |

## Environment

| Variable | Required when |
|---|---|
| `VRT_VLM_MODEL` | Always (defaults if unset). Provider auto-detected from prefix |
| `OPENROUTER_API_KEY` | Unprefixed model id |
| `GEMINI_API_KEY` | `gemini:` prefix |
| `ANTHROPIC_API_KEY` | `claude:` prefix |
| `DEBUG_VRT=1` | Verbose VLM round logging |

## Reading the output

```
Round 1: diff=4.12%  → VLM proposed `padding: 12px` on `.foo`
Round 2: diff=1.84%  → VLM proposed `font-size: 14px` on `.bar`
Round 3: diff=0.08%  → FIXED ✓
```

A "stalled" run shows diffRatio holding steady across rounds — the
VLM's proposals aren't being applied (likely a parser failure) or
aren't structurally valid. Set `DEBUG_VRT=1` to see the raw VLM
output.

## Adapting to a new repo

The harness is fixture-bound — to run on a user repo:

1. Add a fixture entry in `css-challenge-fixtures.ts` describing the
   page (HTML + goal CSS + variant CSS template).
2. Confirm baseline + variant render the same when seed maps to a
   no-op (sanity check).
3. Run the loop.

If the new repo is large enough that fixture-style isolation isn't
viable, this skill is the wrong tool — use `vrt-visual-diff` to
surface the regression and edit by hand.

## Costs (rough)

Per call, based on the 2026-05-18 bench:

- `bytedance/ui-tars-1.5-7b`: ~$0.1e-6 / $0.2e-6 (input / output).
- `claude:claude-haiku-4-5-*`: ~$0.002 / call.

Budget consideration: a 3-round fix-loop on Haiku ≈ $0.006 / run; on
ui-tars-1.5-7b ≈ negligible. For batch benchmark runs (>100 calls),
prefer the OpenRouter models.
