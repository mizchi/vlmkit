# Cross-viewport presence matrix with media-query hints

**Source**: A/B external-repo v2, treatment agent
(`docs/reports/2026-06-06-ab-external-v2.md`).

> "no per-viewport presence matrix hinting '1280-only ⇒ check ≥1200px
> media queries'."

Both v1 and v2 agents localized regressions by manually comparing
which viewports showed a diff (v1: "375-only ⇒ mobile base rule
deleted, media override intact"; v2: "1280-only ⇒ min-width:1200px
block"). This inference is mechanical and vlmkit already has
breakpoint extraction (`scan breakpoints`).

**Proposed fix**: when multiple viewport diffs are available (snapshot
report, diff html multi-viewport, or N `diff png` results), emit a
region × viewport presence matrix and annotate viewport-exclusive
rows with the matching media-query ranges from the stylesheet, e.g.
`region "timeline circle" present at 1280 only → check @media
(min-width: 1200px) blocks`.
