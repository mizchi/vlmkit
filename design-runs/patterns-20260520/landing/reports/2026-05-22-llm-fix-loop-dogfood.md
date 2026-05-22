# design-runs landing dogfood with ui-tars + gemini-2.5-flash (2026-05-22)

End-to-end LLM-driven fix-proposal loop against
`design-runs/patterns-20260520/landing/` using the new recommended combo:

- VLM: `bytedance/ui-tars-1.5-7b` (OpenRouter)
- LLM: `google/gemini-2.5-flash` (OpenRouter)

## Flow

1. `vlmkit migration compare target.html current.html` →
   `diff-report.json` (per-viewport diff + computed-style snapshot).
2. `vlmkit diff agent <diff-report.json>` → 380-line agent-facing
   markdown with universal/breakpoint-gated pairs, per-section
   diffRatio, fix candidates, etc.
3. Manual prompt to gemini-2.5-flash via OpenRouter REST: hand it the
   first 300 lines of the diff report + the current HTML excerpt, ask
   for 3 high-confidence CSS fixes as JSON.
4. Apply the universal-pair fixes via `sed`.
5. Re-run `vlmkit build component target.png fixed.html` to measure
   the delta.

## LLM proposal

`google/gemini-2.5-flash` returned valid JSON in one shot:

```json
{
  "fixes": [
    {
      "selector": ".actions",
      "property": "margin-top",
      "value": "34px",
      "rationale": "Universal pair — was 32px in variant, 34px in baseline."
    },
    {
      "selector": ".bar",
      "property": "background-color",
      "value": "rgb(119, 201, 182)",
      "rationale": "Color token shift — variant rgb(116, 200, 181), baseline rgb(119, 201, 182)."
    },
    {
      "selector": ".actions",
      "property": "width",
      "value": "482.234px",
      "rationale": "Breakpoint-gated on desktop/wide — but a pixel-perfect width is unlikely to be an authored value; the LLM correctly flagged it as needing a @media rule."
    }
  ]
}
```

Cost: **12,197 tokens (~$0.0044)**, ~5s latency.

## Result

| Metric | Before LLM fix | After (#1 + #2 applied) | Δ |
|---|---|---|---|
| Pixel diff | 8.00% | **7.93%** | −0.07% |
| Landscape diff | 1.12% | **1.10%** | −0.02% |
| `--goal landing` | pass | pass | — |

Fix #3 (`.actions { width }`) wasn't applied — sub-pixel computed
widths usually fall out of content + flex/grid, not an authored
declaration. The LLM correctly flagged it as breakpoint-gated; deciding
whether to translate that into a `@media` rule needs context the LLM
didn't have.

## Findings

**Good:**
- gemini-2.5-flash produced strictly valid JSON in one shot — no
  retries or schema repairs.
- All 3 proposals were grounded in actual report content (universal
  pair, color token, breakpoint-gated).
- Cost per round is ~$0.004 — affordable for an inner-loop fix agent.
- The diff-for-agent markdown is already shaped for this kind of
  consumption; no transformation needed.

**Gaps:**
- The LLM only proposed 3 fixes, but the report had ~200 universal
  pairs and ~20 breakpoint-gated pairs. To get a real convergence the
  prompt needs to either request many fixes or iterate.
- For breakpoint-gated fixes, the LLM emits the raw computed value
  (`482.234px`) without proposing a `@media` rule wrapper. Useful as a
  signal, not directly applicable as CSS.
- No automated apply step — the loop currently relies on `sed` /
  manual editing. A first-class `vlmkit migration fix-loop` for
  arbitrary HTML (not just css-challenge fixtures with
  `<style id="target-css">`) would close this.

**Why fix-loop didn't auto-apply here:** `migration-fix-loop` requires
`<style id="target-css">` in the variant HTML — current.html uses a
bare `<style>` tag. This restriction makes the existing LLM-driven
loop unable to drive the design-runs scenario.

## Suggested follow-ups

1. Allow `migration-fix-loop` to operate on any inline `<style>` block
   (drop the `id="target-css"` requirement, or make it configurable).
2. Tighten the LLM prompt to request **all** universal-pair fixes in
   one shot, capped by token budget — the diff report already ranks
   them by frequency.
3. Add a `vlmkit migration fix-loop --propose-only` mode that emits
   JSON fix proposals without applying, so the design-runs flow can
   review before editing.

## Artifacts

- diff-report.json: `/tmp/dogfood-eval/landing-migration/diff-report.json`
- diff-for-agent markdown: `/tmp/dogfood-eval/landing-diff-for-agent.md`
- gemini response: `/tmp/dogfood-eval/landing-llm-fix/response.json`
- fixed HTML: `/tmp/dogfood-eval/landing-llm-fix/fixed.html`
- post-fix component report: `/tmp/dogfood-eval/landing-llm-fix/post-fix-report/report.md`
