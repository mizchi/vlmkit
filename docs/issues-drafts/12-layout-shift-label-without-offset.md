# "layout-shift" label without a measured offset reads as a broken feature

**Source**: A/B external-repo v3, treatment agent
(`docs/reports/2026-06-06-ab-external-v3.md`).

> "The advertised `shift {dx,dy}` never appeared in any output (3
> viewports, 2 passes) — even labeled 'layout-shift', the region had
> no shift field. Dead feature as far as this run shows."

The feature is not dead — on the v2 captures the same build reports
`shift {dx: 36, dy: 0}` on 5/7 regions. v3's mutations contained no
translations, so there was nothing to measure. The friction is the
inconsistent vocabulary: the `layout-shift` *label* can come from the
shape heuristic (wide band) or shift-grouping, while the `shift`
*field* only appears when a translation was actually measured. An
agent reading "layout-shift" expects the offset.

**Proposed fix**: disambiguate the label. When the type is
layout-shift WITHOUT a measured offset, say so in the description
("wide-band shape hint; no translation measured — likely reflow or
in-place change"). Alternatively reserve `layout-shift` for measured
translations and use `reflow-hint` for shape-derived ones.
