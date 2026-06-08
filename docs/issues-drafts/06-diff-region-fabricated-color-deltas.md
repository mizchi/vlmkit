# `diff region` fabricates `color` property deltas for layout-only changes

**Source**: A/B external-repo v1, treatment agent
(`docs/reports/2026-06-05-ab-external-v1.md`).

> "`diff region`'s table claims every change is property `color` with
> fabricated hex deltas (the change was padding/float)."

Consistent with the 2026-05-23 bake-off finding that VLM per-channel
hex values are "vibes, not measurements" — but here the *property
name* itself was wrong, actively steering the agent away from the
real cause (a deleted padding/float rule).

**Proposed fix**: cross-check the VLM's claimed property against
deterministic signals before emitting it — if the region's measured
colorSamples show before ≈ after, demote/drop a `color` claim and
re-ask or fall back to `layout`. Long-term: constrain the VLM to
verdict + region naming and let measured pixels supply all numbers
(the direction `vlm-region-diff` docs already recommend).

---

**Status (2026-06-08)**: Partially resolved via a deterministic
refutation gate (`PIXEL_REFUTE_FLOOR = 3` in vlm-region-diff.ts). When a
region carries a measured `bbox-average` colorSample whose
`averageChannelDelta` falls below the floor, the change is marked
`verification.refuted`, demoted to `confidence: low`, and moved out of the
confident markdown table into an "Unverified — measured pixels refute the
VLM claim" section. This catches fabricated color deltas where the pixels
show before ≈ after. The deeper fix (constrain the VLM to verdict + region
naming, never let it name property/number) is still future work.
