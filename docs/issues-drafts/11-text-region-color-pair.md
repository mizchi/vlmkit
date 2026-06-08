# Text-change regions surface no usable color delta (antialiasing defeats the median)

**Source**: A/B external-repo v3, treatment agent
(`docs/reports/2026-06-06-ab-external-v3.md`).

> "The 943px nav diff was classified 'text-change' — technically
> right, but it was a text-*color* change; no color delta was surfaced
> for it (glyph antialiasing defeats the median again)."

> "(want) a 'brightest/darkest differing pixel' pair for text regions."

For thin glyphs, most differing pixels are antialiased blends; the
median lands on a blend value useless for grepping a stylesheet.

**Proposed fix**: for regions classified text-change (or any region
whose differing pixels are sparse), additionally report the extreme
differing pixel pair — e.g. the darkest differing pixel in baseline
vs the same coordinate's current value — which approximates the glyph
core color. Draft 10 (diff-pixels-only median) is the prerequisite;
this is the text-specific refinement on top.

---

**Status (2026-06-08)**: Resolved on top of draft 10. The color sample
now carries an optional `peak` pair — the single highest-delta differing
pixel — attached when the change is sparse. `formatColorSample`
(visual-semantic.ts) prefers `peak` over the mean, so text-change regions
surface the glyph core color instead of an antialiasing-muddied blend.
