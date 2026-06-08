# Region classifier lacks a reflow/vertical-shift type; mislabels as `element-added`

**Source**: A/B external-repo v1, treatment agent
(`docs/reports/2026-06-05-ab-external-v1.md`).

> "`diff png` typing every layout-shift region as `element-added`
> (conf 0.3) with identical `#ffffff → #ffffff` colorSamples."

A deleted padding rule reflowed everything below it; the classifier
has no vocabulary for that, so it emitted seven low-confidence
`element-added` rows whose color samples carried zero information.

**Proposed fix**: add a `reflow`/`vertical-shift` region type — the
per-band shift detection (`detectBandShifts`) and heatmap-region
machinery already exist in vrt-core; classify a region as reflow when
band cross-correlation finds a consistent vertical offset. Suppress
colorSamples when before == after.

---

**Status (2026-06-08)**: Resolved. The original symptom
(element-added + #ffffff→#ffffff) was already gone via the measured
`shift` routing (draft 12) + differing-pixel colorSample (draft 10). This
adds the missing vocabulary: a measured vertical-dominant shift
(`|dy| >= |dx|`, dy≠0) is now classified as a distinct `reflow`
VisualChangeType with a "Vertical reflow: content below shifted by +Npx"
description; horizontal-dominant movement keeps `layout-shift`. Consumers
updated: isVisualChangeType, migration-diff category map (reflow →
layout-shift). Tests in `visual-semantic.test.ts`.
