# `diff png` does not surface baseline/current dimension mismatch

**Source**: A/B external-repo v1, treatment agent
(`docs/reports/2026-06-05-ab-external-v1.md`).

> "`diff png` never reports the baseline/current **image height
> mismatch** (9541 vs 9377px) — the 164px delta was the best clue and
> required a hand-written pngjs script."

A height delta on a full-page capture is the single strongest "content
collapsed / element lost vertical space" signal, and the tool already
has both dimensions in hand.

**Proposed fix**: always print `baseline WxH / current WxH (Δheight
+N px)` in the header of text, markdown, and JSON output, and call out
non-zero Δheight as a probable reflow.
