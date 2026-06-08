# `colorSample` median over the whole region hides the actual change

**Source**: A/B external-repo v3, treatment agent
(`docs/reports/2026-06-06-ab-external-v3.md`).

> "`colorSample` reported `#ffffff → #ffffff` on the contact region —
> the median hit the white form inputs, hiding the actual bg change
> (#212529 → #090353). I had to write my own pixel sampler. A
> region-median is the wrong statistic; sampling only *differing*
> pixels would have named the answer directly."

`sampleRegionColor` (vlmkit-core/heatmap.ts) takes a sparse median
over the whole region bbox. When the changed pixels are a minority of
the region (dark background behind dominant white inputs), the median
reflects the unchanged majority on both sides and the sample reads as
"no change" — on the exact region the agent most needs a color for.

**Proposed fix**: restrict the sample to pixels that actually differ
(the diff buffer already knows which). Report median-of-differing
baseline color vs median-of-differing current color. Keep the
whole-region median as a secondary `surroundColor` if useful. Note
`diff region`'s `sampleBboxColorPair` already does exactly this
(changed-pixels accumulator with `averageChannelDelta > 1` gate) —
port that approach.

---

**Status (2026-06-08)**: Resolved. `sampleRegionColorSample`
(vlmkit-core/heatmap.ts) now accumulates only pixels whose baseline↔current
per-channel delta clears the gate (mean of differing pixels, fallback to the
whole region when nothing differs). Tests in `region-color-sample.test.ts`.
