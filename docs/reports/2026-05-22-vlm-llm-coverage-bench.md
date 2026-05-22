# VLM × LLM coverage bench (2026-05-22)

Hard case re-bench across multiple LLM Stage-2 candidates and a couple of VLM
Stage-1 alternatives, using the existing fix-loop scenario from CLAUDE.md:

```bash
VRT_VLM_MODEL="<vlm>" VRT_LLM_PROVIDER="<provider>" VRT_LLM_MODEL="<llm>" \
  node --experimental-strip-types src/experiments/css-challenge/fix-loop.ts \
  --fixture page --seed 11 --mode selector --max-rounds 2
```

Hard case: `.readme-body pre { 6 props }` removed, baseline pixel diff 4.1%.

## Stage-2 LLM sweep (VLM = `bytedance/ui-tars-1.5-7b`)

| LLM | Result | Total | VLM ms | LLM ms | Fixes | Notes |
|---|---|---|---|---|---|---|
| **`google/gemini-2.5-flash`** | ✓ FIXED r1 | **7s** | 2104 | 2328 | 11 | fastest |
| `anthropic/claude-haiku-4-5-20251001` (direct) | ✓ FIXED r1 | ~10s | 6055 | 3848 | 11 | baseline |
| `moonshotai/kimi-k2` | ✓ FIXED r1 | 20s | 2561 | 14387 | 11 | slow LLM |
| `moonshotai/kimi-k2-0905` | ✓ FIXED r2 | 20s | 11958 | 1105 | 6/6 r2 | r1 rollback (6.2%) |
| `google/gemini-2.5-flash-lite` | ✓ FIXED r1 | 43s | 12308 | 27930 | 37 | many fixes, cheap |
| `moonshotai/kimi-k2-thinking` | ✗ NOT FIXED | 77s | 11903 | 47651 | 11 | hallucinates garbage selectors (`figcaptionSupplymonth proportionatefailures` etc.) |
| `moonshotai/kimi-k2.5` | ✗ NOT FIXED | 151s | 4302 | 97382 | 0 | 思考のみ、fix を JSON で返さない |
| `moonshotai/kimi-k2.6` | ✗ NOT FIXED | ~80s | 7847 | 40000 | 0 | 同上 |
| `qwen/qwen3-coder` | ✗ NOT FIXED | 15s | 2110 | 4660 | 11 | over-fixes → diff 4.1% → 46.7% |

## VLM swap (LLM held at best candidate)

| VLM | LLM | Result | Total | VLM ms | LLM ms |
|---|---|---|---|---|---|
| `qwen/qwen3-vl-30b-a3b-instruct` | `gemini-2.5-flash` | ✓ FIXED r1 | 19s | 14220 | 1792 |
| `qwen/qwen3-vl-30b-a3b-instruct` | `moonshotai/kimi-k2` | ✓ FIXED r1 | 16s | 2450 | 11124 |
| `amazon/nova-lite-v1` | `gemini-2.5-flash` | ✓ FIXED r1 | 11s | 3656 | 3707 |
| `bytedance/ui-tars-1.5-7b` | `anthropic/claude-haiku-4.5` (OpenRouter) | ✓ FIXED r1 | 9s | 2912 | 3542 |

## Cost estimate ($/run, FIXED r1)

Approximate token usage: VLM ~1.5k prompt + ~0.4k completion, LLM ~10k prompt
+ ~2k completion (single-round case). OpenRouter prices as of 2026-05-22:

| Combo | VLM $ | LLM $ | Total | Time |
|---|---|---|---|---|
| **ui-tars + gemini-2.5-flash-lite** | ~$0.0002 | ~$0.002 | **~$0.002** | 43s |
| **ui-tars + gemini-2.5-flash** | ~$0.0002 | ~$0.008 | **~$0.008** | **7s** |
| nova-lite + gemini-2.5-flash | ~$0.0002 | ~$0.008 | ~$0.008 | 11s |
| ui-tars + kimi-k2 | ~$0.0002 | ~$0.010 | ~$0.011 | 20s |
| ui-tars + haiku-4.5 (OpenRouter) | ~$0.0002 | ~$0.020 | ~$0.020 | 9s |
| qwen3-vl-30b + gemini-2.5-flash | ~$0.0004 | ~$0.008 | ~$0.008 | 19s |

## Recommendations

- **Interactive / fix-loop dogfood (fastest pareto-front)**:
  `VRT_VLM_MODEL=bytedance/ui-tars-1.5-7b` +
  `VRT_LLM_MODEL=google/gemini-2.5-flash` via OpenRouter — **7s, ~$0.008/run**,
  FIXED in 1 round on the hard case. Beats the previous `claude-haiku-4-5`
  default on both axes (10s, ~$0.020).

- **Batch / cost-sensitive (cheapest still-correct)**:
  `ui-tars + gemini-2.5-flash-lite` — **~$0.002/run** but 43s, 4× the latency.
  Picks up 37 fix candidates instead of 11; over-generation absorbed by the
  apply-and-rollback gate.

- **Independent second opinion (no Google deps)**:
  `ui-tars + moonshotai/kimi-k2` — 20s, ~$0.011/run, FIXED r1 with 11 fixes.
  Good fallback when avoiding Google models is preferred.

### Avoid for Stage-2 fix generation

- `moonshotai/kimi-k2-thinking` — outputs hallucinated multi-token selector
  strings (`aside#cdl figcaptionSupplymonth proportionatefailures` etc.).
- `moonshotai/kimi-k2.5`, `moonshotai/kimi-k2.6` — return 0 fixes despite
  receiving VLM CHANGE list (likely emits prose-only, not structured fix JSON).
  LLM latency 40-100s also disqualifies them as fix-loop stages.
- `qwen/qwen3-coder` — generates plausible-looking fixes that *over-correct*
  the whole page; the apply-and-rollback gate catches the 46.7% regression
  but the loop never recovers within 2 rounds.

## Method notes

- Same fixture (`fixtures/css-challenge/page.html`), same seed (11), same mode
  (`selector`, 6-prop removal at `.readme-body pre`), 2 rounds max.
- VLM latency for qwen3-vl-30b shows high variance (2.5s vs. 14s) — likely a
  cold/warm OpenRouter model cache.
- Cost numbers are token-estimate-derived, not measured via the OpenRouter
  generation API. Margin of error ±30%.
- The bench harness is `/tmp/bench-llm.sh`; per-run logs in
  `/tmp/bench-llm-runs/<model>.log` (last-write-wins, so re-runs overwrite).
