# VLM bench 2026-05-19 — claude-haiku-4.5 vs UI-TARS 1.5-7b

Single-pair re-bench to verify both models still pass the canonical
hard case after the 0.5.0 release. Both models converge in **round
1** on `seed 11 (.readme-body pre {6 props})` (selector mode, page
fixture, --max-rounds 2).

## Setup

```bash
# Single-call latency (generated heatmap 1.7% diff)
node src/experiments/benchmark/vlm-bench.ts \
  claude:claude-haiku-4-5-20251001 bytedance/ui-tars-1.5-7b --md

# Fix-loop hard case
VRT_VLM_MODEL="<model>" node --experimental-strip-types \
  src/experiments/css-challenge/fix-loop.ts \
  --fixture page --seed 11 --mode selector --max-rounds 2
```

Stage-2 LLM (fixed): `claude-sonnet-4-20250514`.

## vlm-bench (single call, 1.7% heatmap)

| Model | Latency | Cost | Tokens | Chars | CHANGEs | Format |
|---|---:|---:|---:|---:|---:|---|
| `bytedance/ui-tars-1.5-7b` | **1352ms** | ~$0 | 788 | 174 | 3 | Canonical `- [Selector] property: X → Y (severity: …)` |
| `claude:claude-haiku-4-5-20251001` | 4180ms | $2e-6 | 1108 | 1382 | 10 | `- **Selector** - property: X → Y (severity: …)` + "Overall Assessment" prose |

**Observations**:
- UI-TARS is **3.1× faster** at single-call.
- Cost difference is ~2000×; ui-tars is near-zero per call.
- Haiku produces a higher CHANGE count (10 vs 3 on the synthetic
  heatmap), plus a root-cause-inferring prose paragraph at the end
  ("font encoding issue / CSS text property corruption / color
  filter").
- Haiku's format adds `**bold**` selector wrappers — slightly
  divergent from the canonical leading-`[Selector]` shape, but the
  downstream Stage-2 LLM still parses it.

## fix-loop seed 11 (hard case)

```
Removed: .readme-body pre { 6 props }
Initial pixel diff: 4.1%
```

| Model | Round | VLM latency | CHANGEs | LLM latency | Fixes applied | Final diff |
|---|---:|---:|---:|---:|---:|---:|
| `claude:claude-haiku-4-5-20251001` | 1 | 2562ms | 11 | 5772ms | 6/6 | **0.0%** |
| `bytedance/ui-tars-1.5-7b` | 1 | 2765ms | 5 | 5002ms | 6/6 | **0.0%** |

Both **FIXED in round 1**. End-to-end (VLM + LLM + verify) totals:
- Haiku run: ~10.5 s (incl. verification).
- UI-TARS run: ~9.5 s.

**Notable**: UI-TARS reported 5 CHANGEs (below the 7-15 guideline in
CLAUDE.md), yet the Stage-2 LLM still proposed 6 fixes and all
applied cleanly. The "structured fewer-but-correct" signal carried
enough information for the downstream model to recover the missing
properties without needing the full CSS-diff trace.

Haiku reported 11 CHANGEs across more selectors (.main, .sidebar,
.header-nav, etc.), some of which were beyond the actually-removed
`.readme-body pre` block — yet Stage-2 still distilled to the right
6 fixes. This is the LLM-as-de-noiser pattern: VLM over-coverage is
fine as long as the LLM is good.

## Updated recommendations

The 2026-04-04 hardline ("Haiku is **high-quality**, only use when
VLM output isn't consumed by Stage-2 LLM") is too conservative.
Haiku works fine as a Stage-1 VLM in the 2-stage pipeline; the
Stage-2 LLM handles the format divergence and the over-coverage.

Choose by:

| Constraint | Pick |
|---|---|
| Cost / latency-sensitive (sub-2s budget, $0/call) | `bytedance/ui-tars-1.5-7b` |
| Want explicit hex-code deltas | `qwen/qwen3-vl-30b-a3b-instruct` |
| Stable baseline | `amazon/nova-lite-v1` |
| High coverage + prose-style root cause analysis | `claude:claude-haiku-4-5-20251001` |

Default remains `bytedance/ui-tars-1.5-7b` — 3.1× faster on bench,
parity on hard case.

## Avoid (no change from 2026-05-18)

- `meta-llama/llama-4-scout` — regressed since 2026-04-04 (was 1.0s,
  now ~7s conversational).
- `meta-llama/llama-4-maverick` — "image not available."
- `google/gemini-2.5-flash-lite` — hallucinates uniform `red → red`.

## Stop-sign / convergence

n=1 per model. The earlier 2026-05-18 bench used n=1 too, so this is
not a regression in evaluation rigor — it's a delta check. If a
production decision hinges on the ranking, repeat at n≥5 with random
seeds 1 through 5 from the css-challenge fixture set.

## Artifacts

- Raw bench markdown: `test-results/vlm-bench/vlm-bench-report.md`
- Raw bench JSON: `test-results/vlm-bench/vlm-bench-report.json`
