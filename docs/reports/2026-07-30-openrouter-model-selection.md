# OpenRouter model-selection recheck (2026-07-30)

Issue #88 requires a separate model choice for each task.  This recheck uses
OpenRouter for every invoked model; it does not compare direct-provider APIs.

## Stage 2: Playwright-test synthesis

The repeatable `vlmkit-heal` dogfood suite mutates a known-good Playwright test
in five ways (two locators and three assertions).  A run passes only when the
healer rewrites the complete test and Playwright returns green.

```bash
HEAL_REAL_LLM=1 HEAL_CODEGEN_MODELS=<model> \
  pnpm exec tsx packages/vlmkit-heal/smoke/dogfood.ts
```

| model | fixed | attempts | measured cost | decision |
|---|---:|---:|---:|---|
| `qwen/qwen3-coder-30b-a3b-instruct` | 5/5 | 7 | $0.000818 | default cheap codegen tier |
| `google/gemini-2.5-flash` | 5/5 | 5 | $0.004377 | higher-cost fallback; all cases converged in one attempt |
| `openai/gpt-5-mini` | 4/5 | 8 | $0.016746 | reject: placeholder case exhausted four attempts |

Keep Qwen first and Gemini Flash second in a healing/code-generation route.
The successful Qwen run needed three attempts for the placeholder mutation, so
Gemini is valuable as the fallback rather than a replacement.

## VLM-only heatmap description

The legacy synthetic 1.7%-diff heatmap prompt was also run against OpenRouter
models:

```bash
pnpm exec tsx src/experiments/benchmark/vlm-bench.ts \
  google/gemini-2.5-flash qwen/qwen3-vl-30b-a3b-instruct \
  qwen/qwen3-vl-235b-a22b-instruct openai/gpt-4.1-mini \
  openai/gpt-5-mini anthropic/claude-haiku-4.5
```

All successful responses incorrectly treated heatmap red/pink as element
colour or invented text/value changes; `gpt-5-mini` returned no content.  The
prompt therefore is not a valid selector for copy transcription or exact CSS
values.  Use deterministic pixel/CSS measurements as the source of values and
keep VLM output to localization or high-level judgment.

## Task-specific choices

- **Stage-2 test/code synthesis:** Qwen coder, then Gemini Flash fallback
  (this recheck).
- **Visual equivalence judgment:** Claude Haiku 4.5 through OpenRouter.  The
  controlled palette-shift bake-off in
  [`2026-05-23-vlm-region-diff-bakeoff.md`](2026-05-23-vlm-region-diff-bakeoff.md)
  is still the only evaluated candidate that returned the correct binary
  verdict and colour-change direction.
- **Screenshot-to-copy transcription / semantic labels:** no default yet.
  The available heatmap-description benchmark does not measure transcription
  accuracy, so choose only after adding a fixture with expected text/semantic
  labels and exact scoring.

This keeps model selection evidence-based and prevents the cheap heatmap VLMs
from being promoted on response length alone.

## End-to-end combinations

The same hard CSS case was then run through the actual two-stage fix loop:
`.readme-body pre` (six declarations) is removed from the `page` fixture.  The
CSS diff supplied to Stage 2 is authoritative, but the run still measures the
VLM response format, model latency, parsed fixes, filtering, application, and
pixel verification.

```bash
VRT_VLM_MODEL=<vision-model> VRT_LLM_PROVIDER=openrouter \
VRT_LLM_MODEL=<code-model> pnpm exec tsx \
  src/experiments/css-challenge/fix-loop.ts \
  --fixture page --seed 11 --mode selector --max-rounds 2
```

| Stage 1 VLM | Stage 2 LLM | VLM / LLM latency | parsed fixes | result |
|---|---|---:|---:|---|
| UI-TARS 1.5 7B | Gemini 2.5 Flash | 2.39s / 2.29s | 11 | pixel-perfect, round 1 |
| Qwen3-VL 30B | Gemini 2.5 Flash | 3.25s / 2.09s | 11 | pixel-perfect, round 1 |
| Gemini 3 Flash Preview | Gemini 2.5 Flash | 3.61s / 2.22s | 11 | pixel-perfect, round 1 |
| Claude Haiku 4.5 | Gemini 2.5 Flash | 3.58s / 2.31s | 11 | pixel-perfect, round 1 |
| UI-TARS 1.5 7B | Qwen3 Coder 30B | 5.02s / 21.88s | 23 (12 filtered) | pixel-perfect, round 1 |
| UI-TARS 1.5 7B | Gemini 3 Flash Preview | 2.31s / 5.18s | 11 | pixel-perfect, round 1 |
| UI-TARS 1.5 7B | Claude Haiku 4.5 | 2.22s / 4.07s | 11 | pixel-perfect, round 1 |

All seven combinations pass this single hard fixture.  The current primary
remains **UI-TARS + Gemini 2.5 Flash**: it is the fastest measured end-to-end
pair (~4.7s).  Use **UI-TARS + Claude Haiku 4.5** where the stronger visual
judgment is required, not merely for this CSS-diff-assisted repair case.

This is n=1 per pair; it establishes compatibility, not a general quality
ranking.  The next sweep should vary fixtures and mutations, especially cases
without an authoritative CSS diff.

## Accuracy × cost comparison

Accuracy is deliberately reported separately per task: a model that repairs an
authoritative CSS-diff case is not thereby proven to be an equivalence judge.
Costs in the first table are **measured OpenRouter totals** for the five-case
Playwright rewrite suite.  Prices in the second table are the OpenRouter list
prices fetched on 2026-07-30 (USD per million input / output tokens); they let
readers compare pair costs without falsely treating response length as cost.

### Code-generation accuracy (five independent mutations)

| Stage-2 model | accuracy | measured total cost | cost / successful case | cost-quality reading |
|---|---:|---:|---:|---|
| Qwen3 Coder 30B | **5/5 (100%)** | **$0.000818** | **$0.000164** | best measured cost/accuracy; one case needed three attempts |
| Gemini 2.5 Flash | **5/5 (100%)** | $0.004377 | $0.000875 | 5.3× Qwen cost, but every case took one attempt |
| GPT-5 Mini | 4/5 (80%) | $0.016746 | $0.004187 | 25.5× Qwen cost and one case exhausted retries; reject |

### Visual-equivalence accuracy (controlled palette-shift case)

| VLM | correct binary verdict + direction | measured call cost | cost-quality reading |
|---|---:|---:|---|
| Claude Haiku 4.5 | **1/1** | $0.004709 | only tested model that tracked the known change; use for equivalence judgment |
| UI-TARS 1.5 7B | 0/1 | $0.000416 | self-contradictory response; do not use as judge |
| Qwen3-VL 30B | 0/1 | $0.000383 | false negative |
| Gemini 2.5 Flash | 0/1 | **$0.000347** | cheap false negative |

The equivalence results are from the unchanged controlled fixture documented in
[`2026-05-23-vlm-region-diff-bakeoff.md`](2026-05-23-vlm-region-diff-bakeoff.md).

### Current unit pricing for pair selection

| model | input $/M | output $/M | proven role in this sweep |
|---|---:|---:|---|
| UI-TARS 1.5 7B | $0.10 | $0.20 | fastest Stage-1 localization in the CSS repair loop |
| Qwen3-VL 30B | $0.15 | $0.60 | compatible Stage 1, but slower and not an equivalence judge |
| Gemini 2.5 Flash | $0.30 | $2.50 | reliable Stage-2 fallback / fastest tested pair |
| Gemini 3 Flash Preview | $0.50 | $3.00 | compatible, slower than Gemini 2.5 Flash |
| Claude Haiku 4.5 | $1.00 | $5.00 | accuracy-first visual equivalence judge |
| Qwen3 Coder 30B | **$0.07** | **$0.27** | cheapest tested Stage-2 code synthesis |

**Operating choice:** use **UI-TARS → Qwen3 Coder → Gemini 2.5 Flash** for
cheap repair with an escalation path, and call **Claude Haiku 4.5** only for
high-stakes visual-equivalence decisions.  Do not substitute a cheap VLM for
Haiku in that latter gate solely on token price.
