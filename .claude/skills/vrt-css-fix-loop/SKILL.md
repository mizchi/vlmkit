---
name: vrt-css-fix-loop
description: Closed-loop CSS auto-repair. Given a fixture with a known regression (one CSS property or one selector block removed), iterate with a VLM that proposes the missing fix from the diff screenshot, apply it, and re-run until the diff falls below a threshold. Currently scoped to the CSS-challenge fixture set in `src/experiments/css-challenge/`; adapting to an arbitrary repo requires writing a fixture entry. Use when measuring whether a VLM model can recover a known regression, not for production self-healing.
---

# vrt-css-fix-loop

`fix-loop` is the harness behind every VLM benchmark in this repo
(`docs/reports/2026-05-18-vlm-claude-vs-openrouter-vs-newcomers.md`
etc.). It takes a fixture, deliberately mutates the CSS (`property`
mode deletes one property; `selector` mode deletes one selector
block), then runs a **two-stage** AI pipeline to propose a fix from
the rendered diff.

**The pipeline is VLM → LLM, not VLM alone:**

1. Apply current candidate CSS to the variant page.
2. Render baseline + variant; compute pixel diff.
3. **Stage 1 (VLM)**: send the diff overlay to the VLM with a
   structured "list the changes" prompt; parse a CHANGE list
   (`selector { prop: from → to }` rows).
4. **Stage 2 (LLM)**: hand the CHANGE list + current CSS to an LLM
   (default `claude-sonnet-*`); LLM emits the actual CSS edits to
   apply. The LLM compensates for VLM imprecision — it may rewrite,
   merge, or discard VLM proposals based on the CSS context.
5. Re-run; stop when diffRatio falls below threshold (= FIXED) or
   `--max-rounds` is exhausted.

**FIXED means "the pipeline converged," not "the VLM understood the
diff."** It's common to see VLM propose selectors unrelated to the
deleted block while the LLM still emits a working fix. When using
this harness to *benchmark a VLM model*, compare CHANGE-list quality
between models — don't read FIXED as a VLM verdict on its own. The
banner line `VLM=<id> | LLM=<id>` makes the two stages explicit.

## Invocation

`fix-loop` is run directly from source (not via the `vlmkit` CLI):

```bash
node --experimental-strip-types src/experiments/css-challenge/fix-loop.ts <flags>
```

It does not ship in `./dist/vrt.mjs`. The source form above is the
only supported entry point.

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

This repo uses direnv; `.envrc` auto-loads `.env.local` (where
`OPENROUTER_API_KEY` / `ANTHROPIC_API_KEY` live). If you're shelling
outside the direnv context, run
`set -a; source .env.local; set +a` first.

```bash
# Property mode (default): delete one CSS property; pipeline proposes restoration
node --experimental-strip-types src/experiments/css-challenge/fix-loop.ts \
  --fixture page --seed 42

# Selector mode: delete one full selector block (harder)
node --experimental-strip-types src/experiments/css-challenge/fix-loop.ts \
  --fixture page --seed 11 --mode selector --max-rounds 3

# Run with a specific VLM model (any OpenRouter id, `gemini:*`, or `claude:*`).
# The Stage-2 LLM is held constant across VLM swaps so VLM quality
# can be compared apples-to-apples.
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

- **Default**: `bytedance/ui-tars-1.5-7b` (UI-domain-trained, ~1.4s
  single-call, $0/call). Verified FIXED in round 1 on the canonical
  hard case (seed 11, .readme-body pre {6 props}, 4.1% diff →
  0.0%).
- **Stable / detailed**: `qwen/qwen3-vl-30b-a3b-instruct` (emits hex
  codes directly).
- **Baseline fallback**: `amazon/nova-lite-v1`.
- **High coverage + prose root-cause**:
  `claude:claude-haiku-4-5-20251001` (~4.2s single-call, ~$2e-6/call;
  also FIXED in round 1 on seed 11 — works as Stage-1 VLM despite
  format divergence, Stage-2 LLM handles it).

Avoid: `meta-llama/llama-4-scout` (regressed; verbose),
`meta-llama/llama-4-maverick` (returns "image not available"),
`google/gemini-2.5-flash-lite` (hallucinates uniform deltas).

See `docs/reports/2026-05-19-vlm-haiku-vs-uitars.md` for the latest
2-way re-bench;
`docs/reports/2026-05-18-vlm-claude-vs-openrouter-vs-newcomers.md`
for the 8-way bench from the prior week.

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
| `DEBUG_VLMKIT=1` | Verbose VLM round logging |

## Reading the output

Real banner + first round of a real run on seed 11 selector mode:

```
VLM=bytedance/ui-tars-1.5-7b | LLM=claude-sonnet-4-20250514
Removed block: .readme-body pre { 6 props }

Round 1:
  VLM: 5 changes (3383ms)
    .main         { padding: 16px → 24px }
    .sidebar      { width: 100% → 296px }
    .header-nav   { display: none → flex }
    .header-search{ max-width: none → 320px }
    .tabs         { padding: 0 16px → 0 24px }
  LLM: 6 fixes proposed
  diff: 4.12% → 0.00% (FIXED ✓)
```

Things to read:

- `VLM=<id> | LLM=<id>` — confirms which two models drove the
  pipeline.
- **`VLM: N changes (Tms)`** — VLM stage's wall-clock + the CHANGE
  list. Per-row format `selector { prop: from → to }`.
- **`LLM: M fixes proposed`** — Stage-2 emitted M CSS edits; usually
  M ≥ N (LLM expands / corrects).
- `diff: x% → y%` — diffRatio before this round's edits vs after.
- `FIXED ✓` when `y` falls below `--threshold` (default `0.001`).

**Pipeline divergence warning**: if `Removed block:` names something
the VLM never mentions in its CHANGE list, *but the pipeline still
hits FIXED*, the LLM compensated. Treat that run as a **win for the
pipeline**, not for the VLM. To grade the VLM in isolation, score the
CHANGE list against the known-removed block (e.g. selector
recall, property recall).

A "stalled" run shows diffRatio holding steady across rounds — the
VLM's proposals aren't parseable, or the LLM's emitted fixes aren't
structurally valid CSS. Set `DEBUG_VLMKIT=1` to see both stages' raw
output.

At the end of the run, a summary table prints one row per round
with columns:

| Column | Meaning |
|---|---|
| `Round` | 1-indexed iteration number |
| `Diff` | diffRatio after this round's edits applied |
| `Changes` | rows in VLM's CHANGE list (Stage 1) |
| `Fixes` | CSS edits emitted by LLM (Stage 2). Usually `Fixes ≥ Changes` |
| `Escalated` | `false` if the default LLM tier handled it; `true` if the harness fell back to a higher-capability model. A run with `Escalated=true` cost more — relevant for cross-model benchmarks. |

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
