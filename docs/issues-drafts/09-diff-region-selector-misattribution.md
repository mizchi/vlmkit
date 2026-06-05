# `diff region` attributes regions to wrong selectors with Delta-0 evidence

**Source**: A/B external-repo v2, treatment agent
(`docs/reports/2026-06-06-ab-external-v2.md`).

> "its prose summary was right ('labels white → light blue') but the
> structured table mapped both findings to `.masthead` with
> `background-color #252327 → #252328, Delta 0` and bboxes in the page
> header — actively wrong selector attribution — and it missed the
> timeline shift entirely."

Two compounding failures:
1. The VLM placed bboxes in the wrong page area (header instead of
   portfolio grid), so the measured color sample showed ~zero delta —
   and the row was still emitted as a confident finding.
2. Selector join then attached a plausible-looking selector to the
   wrong bbox.

**Proposed fix**: drop (or demote to a clearly-labeled `unverified`
list) any region whose measured `colorSample.averageChannelDelta` is
below a floor (e.g. 3) — the pixels themselves refute the claim.
Related: docs/issues-drafts/06 (fabricated property deltas); the
deterministic mapping in draft 07 would bypass this failure mode
entirely.
