# Region bboxes missing from non-JSON output; no built-in crop helper

**Source**: A/B external-repo v1, treatment agent
(`docs/reports/2026-06-05-ab-external-v1.md`).

> "No region bboxes in non-JSON output; no built-in crop tool for
> inspecting regions."

The agent located the bug from `--json` bboxes, then had to write
pngjs cropping scripts by hand to actually look at the regions on a
9,500px-tall capture.

**Proposed fix**:
1. Print bboxes (`x,y WxH`) in the default text/markdown region table.
2. Add `vlmkit diff png ... --crop-regions <dir>` (or a standalone
   `vlmkit scan crop`) that writes one baseline/current/diff crop
   triple per region — `scan component` already has the cropping
   machinery.
