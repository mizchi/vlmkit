# `diff region` crashes on full-page captures taller than the VLM image limit

**Source**: A/B external-repo v1, treatment agent
(`docs/reports/2026-06-05-ab-external-v1.md`).

> "`diff region` crashes on captures >8000px tall (Anthropic limit) —
> needs auto-downscale/tiling/crop-to-region."

Full-page mobile captures of a real landing page were 9,377–9,541px
tall. Any real-world full-page workflow hits this immediately.

**Proposed fix**: before sending to the VLM, (a) downscale to fit the
provider's limit, or (b) tile vertically and merge region lists, or
(c) pre-crop to pixel-diff bounding boxes (cheapest: the pixel diff
already knows where the changes are). Option (c) also cuts token cost.
