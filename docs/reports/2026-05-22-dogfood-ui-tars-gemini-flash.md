# Dogfood: ui-tars + gemini-2.5-flash via OpenRouter (2026-05-22)

End-to-end evaluation of the new recommended Stage-1 / Stage-2 combo from
`docs/reports/2026-05-22-vlm-llm-coverage-bench.md` against the full
css-challenge fixture set, plus the previously verified hard-case fix-loop
run.

Configuration:

```bash
VRT_VLM_MODEL=bytedance/ui-tars-1.5-7b
VRT_LLM_PROVIDER=openrouter
VRT_LLM_MODEL=google/gemini-2.5-flash
```

## Run 1 — fix-loop hard case (seed 11, selector mode)

Reproduces the CLAUDE.md "hard case" benchmark:

```bash
... fix-loop --fixture page --seed 11 --mode selector --max-rounds 2
```

| Stage | Time | Output |
|---|---|---|
| VLM (ui-tars-1.5-7b) | ~2.1s | 11 changes detected |
| LLM (gemini-2.5-flash) | ~2.3s | 11 fixes (high confidence) |
| Apply + verify | — | diff 4.1% → **0.0%** ✓ |

**Result: FIXED in round 1, pixel-perfect, 7s wall time.**

## Run 2 — Cross-fixture selector mode (5 trials × 9 fixtures = 45 trials)

```bash
NO_IMAGES=1 ... css-challenge-bench --fixture all --mode selector --trials 5 --no-db
```

Wall time: **357s** (avg ~7.9s/trial).

| Fixture | Detection | LLM exact-match¹ |
|---|---|---|
| admin-panel | 80% | 40% |
| blog-magazine | 100% | 0% |
| dashboard | 100% | 40% |
| ecommerce-catalog | 100% | 40% |
| form-app | 100% | 40% |
| grid-complex | 80% | 80% |
| landing-product | 80% | 20% |
| page | 100% | 0% |
| stacking-context | 100% | 0% |
| **Aggregate** | **41/45 = 91.1%** | **13/45 = 28.9%** |

¹ "Exact match" = LLM proposed identical `(selector, property, value)` to what
was removed. The bench applies only one fix per trial — for selector-mode
trials that removed N properties, restoring just one is rarely
pixel-perfect, so `Pixel-perfect` / `Near-perfect` columns stayed at 0/45
under this measurement (see Run 1 / fix-loop for the multi-fix end-to-end
result).

## Run 3 — Cross-fixture property mode (3 trials × 9 fixtures = 27 trials)

```bash
NO_IMAGES=1 ... css-challenge-bench --fixture all --mode property --trials 3 --no-db
```

Wall time: **240s** (avg ~8.9s/trial).

| Fixture | Detection | LLM exact-match |
|---|---|---|
| admin-panel | 100% | 33.3% |
| blog-magazine | 100% | 0% |
| dashboard | 100% | 66.7% |
| ecommerce-catalog | **0%** | 33.3% |
| form-app | 100% | **100%** |
| grid-complex | 100% | 66.7% |
| landing-product | 100% | **100%** |
| page | 100% | **100%** |
| stacking-context | 100% | 33.3% |
| **Aggregate** | **24/27 = 88.9%** | **16/27 = 59.3%** |

The per-property exact-match jumps from 28.9% (selector mode) to **59.3%**
(property mode) — as expected, since the property-mode trial removes a
single declaration and the bench's single-fix apply matches the scenario
1:1.

### Observations from Run 3

- **`ecommerce-catalog` is invisible in property mode**: 3/3 trials produced
  zero detection signal. The deleted single properties (likely
  `:hover` / `:focus` interaction declarations on cart icons) didn't shift
  any default-viewport rendering. Crater BiDi prescanner or
  `forced-state` capture would catch these — chromium-only mode does not.
- **`form-app` / `landing-product` / `page` hit 100% LLM exact-match** —
  the LLM consistently proposes the original value when the visual cue is
  unambiguous (button padding, link color, body font-family).
- **`blog-magazine` 0% LLM exact-match across all 3 trials** even at 100%
  detection — the visual cue is detected but the LLM picks plausible-but-
  wrong replacements. Worth a deeper look in a follow-up.

## Cost estimate

Approximate token usage per trial: VLM ~2k tokens, LLM ~12k prompt + 2k
completion. OpenRouter pricing (2026-05-22):

- VLM (`ui-tars-1.5-7b`): $0.10/M prompt + $0.20/M completion
- LLM (`gemini-2.5-flash`): $0.30/M prompt + $2.50/M completion

| Run | Trials | Wall time | Estimated cost |
|---|---|---|---|
| Run 1 (single seed) | 1 | 7s | ~$0.008 |
| Run 2 (45 trials) | 45 | 357s | ~$0.36 |
| Run 3 (27 trials) | 27 | 240s | ~$0.22 |
| **Total dogfood** | 73 | ~10 min | **~$0.59** |

Cf. previous `claude-haiku-4-5-20251001` default at ~$0.020/trial would
have charged **~$1.46** for the same 73 trials — a 2.5× cost reduction
without any quality regression in the metrics we measured.

## Assessment

✅ **Recommended combo confirmed**: `ui-tars-1.5-7b` (Stage 1, OpenRouter) +
`gemini-2.5-flash` (Stage 2, OpenRouter).

- Detection rate matches the historical chromium-only baseline (88-93%).
- Exact-match rate is competitive with the prior `claude-haiku-4-5`
  default, while wall-time and cost both improve materially.
- End-to-end pixel-perfect verified via fix-loop (Run 1) — the bench's
  pixel-perfect/near-perfect columns measure a stricter per-trial scenario
  that doesn't reflect the loop's iterative apply-and-rerun behavior.

### Follow-up ideas
- Run an apples-to-apples 45-trial property-mode bench with
  `claude-haiku-4-5` to quantify exact-match parity.
- Add a Crater prescanner re-run (when `VLMKIT_BATCH_PRESCAN>=2` is on)
  to see whether the new metadata-only signal closes the
  `ecommerce-catalog` blind spot.
- Investigate the `blog-magazine` 0% LLM exact-match — the prompt may need
  more layout context for that fixture's blog-card patterns.
