# VLM region-diff bake-off (2026-05-23)

Input: `design-runs/patterns-20260520/expressive-menu/reports/component/{target,current}.png`
(1440 × 900, the two PNGs that triggered the earlier `vlm-region-diff` ui-tars
hallucination note in `TODO.md`).

## Ground truth (client-side pixel sampling)

```
avg per-channel delta:     18.74
changed pixels (delta>1):  1,114,729 / 1,296,000  (86.01 %)
max per-channel delta:     250

near-black region (baseline luma < 30):
  600,917 px
  baseline avg RGB: ( 9.4,  9.4,  9.4)   ≈ #090909
  current  avg RGB: (24.7, 22.4, 22.1)   ≈ #191616  (~+15 lighter, slightly warmer)

red-ish region (R>150, G<80, B<80):
  95,195 px
  baseline avg RGB: (226.8,  0.6, 18.3)  ≈ #e30012
  current  avg RGB: (212.4, 18.3, 33.4)  ≈ #d41221  (slightly darker + more orange)
```

So the variant has shifted the dark background a noticeable ~6% lighter,
the red accent ~6% darker and warmer. Not a subtle 0.78% black-on-black
case — the older "+1.74%" framing was misremembered; that was a
different fixture.

## Results

Same prompt, same baseline + variant PNGs, `temperature: 0`, OpenRouter
direct.

| model | verdict | regions reported | cost | assessment |
|---|---|---|---|---|
| `bytedance/ui-tars-1.5-7b` | `diff` | 5 entries, every `baselineColor == variantColor` (incl. an invented "Star icon rgb(255,0,0)") | $0.000416 | Self-contradicting: verdict says diff, every region says "No difference detected." Effectively a false negative wrapped in a false-positive verdict. |
| `qwen/qwen3-vl-30b-a3b-instruct` | `no-diff` | 0 | $0.000383 | Clean false negative on 86% changed pixels. |
| `google/gemini-2.5-flash` | `no-diff` | 0 | **$0.000347** | Clean false negative on 86% changed pixels. Cheapest, also wrong. |
| `anthropic/claude-haiku-4-5` | `diff` | 3 (top-left black `#000000→#1a1a1a`, red stripe `#ff0000→#e60000`, bottom black `#000000→#0d0d0d`) | $0.004709 | **Only correct verdict + correct direction.** Numbers are off by ~±10 per channel vs. ground truth, but the polarity (black lightens, red darkens) matches. |

## Verdict

For `vlm-region-diff` use the model only as a binary "is there a color
shift worth investigating?" detector and consult it for `region` names,
**not** for `baselineColor` / `variantColor` literals.

- **Recommended default:** `anthropic/claude-haiku-4-5`. Only model whose
  `verdict` actually tracked the ground truth on this fixture. Accept
  that the per-channel hex numbers it returns are vibes, not measurements.
- **Do not use as default:** `bytedance/ui-tars-1.5-7b`,
  `qwen/qwen3-vl-30b-a3b-instruct`, `google/gemini-2.5-flash` — all three
  reported `no-diff` (or self-contradicting `diff` with same colors) for
  what is unambiguously a ~6% palette shift across the entire image.
  Cheap, but the cheapness is wasted when the answer is wrong.
- **Color literals**: never trust the VLM. The
  `vlm-region-diff` `baseline+variant` PNG split mode now asks the model
  for a bbox, then overwrites `baselineColor` / `variantColor` with
  client-side PNG samples. The sampler averages changed pixels inside
  the bbox first, then falls back to the full bbox when no changed
  pixels are present.

## Follow-ups

- Done: `claude-haiku-4-5` is the `vlm-region-diff` default.
- Done: split-PNG mode now samples returned bbox coords client-side and
  annotates the result with `colorSample.pixelCount`,
  `colorSample.totalPixelCount`, `colorSample.changedPixelCount`, and
  `colorSample.averageChannelDelta`.
- Done: results now include downstream-facing `changes[]` records with
  measured color `from` / `to`, inferred or explicit paint `property`,
  `selectorHint`, bbox, confidence, and color delta. With
  `--elements-json`, VLM bboxes are joined to DOM element rects and the
  change receives a concrete selector candidate plus selector evidence.
  `--format markdown` prints the selector/property/from/to table for
  direct agent handoff.
- Re-run this bake-off on a genuinely small (<1%) delta fixture before
  trusting any model in that regime — even the haiku-4-5 hit here was on
  a *visible* shift. Sub-1% may flip everyone to `no-diff`.
