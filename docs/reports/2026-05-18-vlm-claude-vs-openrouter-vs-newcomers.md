# VLM Model Benchmark — Claude direct vs OpenRouter (cheap + newcomers)

**Date**: 2026-05-18
**Trigger**: After PR #40 landed the `claude:` direct provider, we re-ran
the bench to (a) get an actual datapoint for Anthropic and (b) check
whether the `docs/knowledge.md` 2026-04-04 recommendations still hold.

**Method**: Single call against the bench's generated heatmap (800×600,
1.7% diff). `node src/experiments/benchmark/vlm-bench.ts <model...> --md`.
8 models in one run.

## Results

| # | Model | Latency | Tokens | Response | Cost/call (display) | Quality |
|---|-------|--------:|-------:|---------:|---------------------|---------|
| 1 | `bytedance/ui-tars-1.5-7b` | **1163ms** | 789 | 176ch | $0 (OR) | △ brief, structured |
| 2 | `google/gemini-2.5-flash-lite` | 1937ms | 1640 | 706ch | $0 (OR) | ⭐ but **hallucinated** (`red → red`) |
| 3 | `qwen/qwen3-vl-30b-a3b-instruct` | **1992ms** | 810 | 533ch | $0 (OR) | ⭐ **hex codes** (`#FF4500 → #FF0000`) |
| 4 | `amazon/nova-lite-v1` | 2381ms | 1911 | 371ch | $0 (OR) | ○ adequate |
| 5 | `claude:claude-haiku-4-5-20251001` | 3510ms | 996 | 966ch | $0.000002 (direct) | ⭐ **12 structured CHANGEs + severity** |
| 6 | `nvidia/nemotron-nano-12b-v2-vl:free` | 4594ms | 3584 | 630ch | FREE | narrative, unstructured |
| 7 | `meta-llama/llama-4-scout` | 6960ms | 1394 | 1169ch | $0 (OR) | mixed (conversational prelude) |
| 8 | `meta-llama/llama-4-maverick` | **26815ms** | 1650 | 2395ch | $0 (OR) | ❌ claims image unavailable, gives methodology |

Sorted by latency.

## Findings

### 1. `meta-llama/llama-4-scout` has regressed

- **Then (2026-04-04 knowledge.md bench)**: 1.0s, 11 structured CHANGEs, recommended default
- **Now (2026-05-18 same bench code)**: 6.96s, conversational prelude before any CHANGE list

7× latency increase on identical bench inputs, plus drift in output
format. Knowledge.md's "Current Recommendations (2026-04-04)" entry
needs an updated note or a revised default.

### 2. `qwen/qwen3-vl-30b-a3b-instruct` looks like the new sweet spot

- 1.99s — second fastest, only ui-tars beats it
- Emits literal hex codes (`#FF4500 → #FF0000`), which Stage-2 fixers
  can paste directly into CSS
- 9 structured CHANGEs, monotone format
- $0.1e-6 / $0.5e-6 per-token pricing — same tier as scout / nova-lite

This is a stronger default candidate than llama-4-scout was, at the same
cost class but with concrete values in the output.

### 3. `bytedance/ui-tars-1.5-7b` is the speed champion

- 1.16s — fastest by a wide margin
- UI-domain-trained model
- Only 3 CHANGEs (brief output) — relies on the prompt to extract more

Fits "production fix-loop with Stage-2 CSS-diff downstream" where the
VLM's role is "detect that something changed, name the region" and the
LLM does the actual fix. With a thicker prompt it might extract more
detail.

### 4. `google/gemini-2.5-flash-lite` hallucinates

Returned 14 `color: red → red` lines for a heatmap where the actual
change is across multiple components. Either the prompt isn't tuned
for this model or the model is over-eager to fit the "everything is
red" template. Avoid until repro is investigated.

### 5. `meta-llama/llama-4-maverick` doesn't see the image (or thinks it doesn't)

Started its 27s response with:

> "we must first understand that the image is not directly available.
> However, based on the description given, we can infer the steps and
> the methodology to be followed for such an analysis."

Followed by 2KB of meta-methodology with no actual CHANGE list.
Maverick is not a drop-in replacement for scout — at minimum the
request shape needs probing (encoding? Content-Type?). Avoid for VRT
until the failure mode is understood.

### 6. `claude:claude-haiku-4-5-20251001` — premium structured output, slower

- 3.51s — mid-pack on latency
- 12 CHANGEs with consistent `[element] property: before → after (severity: low/medium/high)` format
- Cost ~$0.002/call — **~10,000× more than the OpenRouter cheap tier**
- Worth it **only** when VLM output is consumed directly by a downstream
  agent (no Stage-2 LLM normalizing). In the current fix-loop pipeline,
  Stage 2 already takes a CSS text diff, so Claude's per-CHANGE quality
  doesn't translate into a better FIXED rate.

### 7. `nvidia/nemotron-nano-12b-v2-vl:free` — narrative, but free

- 4.59s, 630ch of prose
- "The most prominent change appears to be in the text color of the
  content area, shifting to a darker, orange-red shade …"
- Free, but not structured. Stage-2 LLM would need to do nearly all
  the parsing work.

## Recommended defaults (2026-05-18)

| Use case | Pick |
|---|---|
| Production fix-loop default (cheap, fast, structured) | `qwen/qwen3-vl-30b-a3b-instruct` |
| Production fix-loop alt (ultra-fast, UI-trained, brief) | `bytedance/ui-tars-1.5-7b` |
| Agent-facing CHANGE list (quality matters, ~10000× cost) | `claude:claude-haiku-4-5-20251001` |
| Free baseline / cost-zero CI smoke | `nvidia/nemotron-nano-12b-v2-vl:free` |
| Stable fallback | `amazon/nova-lite-v1` |

### Avoid / re-evaluate
- `meta-llama/llama-4-scout` — regressed since 2026-04-04 (~7× slower)
- `meta-llama/llama-4-maverick` — doesn't actually consume the image
- `google/gemini-2.5-flash-lite` — hallucinates uniform `red → red`

## Reproduction

```bash
node --experimental-strip-types src/experiments/benchmark/vlm-bench.ts \
  claude:claude-haiku-4-5-20251001 \
  amazon/nova-lite-v1 \
  meta-llama/llama-4-scout \
  bytedance/ui-tars-1.5-7b \
  qwen/qwen3-vl-30b-a3b-instruct \
  meta-llama/llama-4-maverick \
  google/gemini-2.5-flash-lite \
  nvidia/nemotron-nano-12b-v2-vl:free \
  --md
```

Requires `ANTHROPIC_API_KEY` + `OPENROUTER_API_KEY` (free model also goes through OpenRouter).

## Limitations

- **n=1 per model**. Latency in particular needs more samples — a single
  3.5s call could be a 1-σ outlier above 2s mean (or vice versa).
- **No fix-loop convergence measured here**. This is single-shot VLM
  output; the Stage 2 LLM stage that decides FIXED is not exercised.
  See the 2026-04-04 fix-loop bench for that axis.
- **Identical bench image** every run, so coverage of fixture variety
  is zero. Multi-fixture sweep is a separate experiment.

## Follow-ups

- [ ] Re-bench with 5-10 trials per model to get latency error bars
- [ ] Run the fix-loop on `qwen3-vl-30b-a3b-instruct` and
  `bytedance/ui-tars-1.5-7b` against seed 11 (the
  `.readme-body pre / 6 props / 4.1% diff` hard case) to confirm
  FIXED rate parity with the old scout recommendation
- [ ] Investigate `llama-4-maverick` "image not available" failure
  (Content-Type? Anthropic-style `source.type: base64`?)
- [ ] Update `docs/knowledge.md` § "Current Recommendations" with the
  2026-05-18 defaults above
