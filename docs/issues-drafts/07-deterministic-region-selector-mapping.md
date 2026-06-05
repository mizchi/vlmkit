# Deterministic region→DOM-selector mapping without the VLM path

**Source**: A/B external-repo v2, treatment agent
(`docs/reports/2026-06-06-ab-external-v2.md`).

> "region→DOM-selector mapping exists only in the unreliable VLM path;
> a deterministic version (hit-test region bbox against live DOM via
> `--elements-html`) would have named `.portfolio-caption` without a
> VLM."

The machinery already exists: `diff region` joins VLM bboxes to DOM
element rects captured from `--elements-html`
(`matchRegionBboxToElement` in vlm-region-diff.ts). The pixel diff's
own region bboxes are deterministic and more accurate than the VLM's.

**Proposed fix**: add `--elements-html <url>` to `vlmkit diff png` —
hit-test each detected diff region's bbox against the captured DOM
rects and attach `selectorCandidate` + coverage evidence to every
region. No API key, no latency, no hallucination. The v2 control agent
independently wished for the same thing ("map a pixel coordinate → DOM
element + matched CSS rules").
