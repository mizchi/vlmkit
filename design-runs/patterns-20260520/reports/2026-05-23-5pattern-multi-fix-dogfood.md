# 5-pattern multi-fix dogfood (2026-05-23)

End-to-end LLM-driven fix loop across every patterns-20260520 scenario
that wasn't yet exercised. Uses the new recommended combo
(`bytedance/ui-tars-1.5-7b` + `google/gemini-2.5-flash` via OpenRouter)
with the post-correction filters added in commit `477cff6`.

## Flow

For each pattern:
1. `vlmkit migration compare target.html current.html` → diff report.
2. `migration-fix-loop --max-fixes 10 --no-rerun` (LLM-driven multi-fix).
3. `vlmkit migration compare target.html fixed.html` → after report.

## Results

| Pattern | Viewports converged to 0.00% | Δ best | Δ worst | Outcome |
|---|---|---:|---:|---|
| `app-shell` | 3/3 | −2.16% | −1.88% | ✓ **fully converged** |
| `dashboard` | 0/7 | 0.00% | 0.00% | ≈ no change (1/5 applied) |
| `expressive-menu` | 0/3 | +0.81% | +1.74% | ⚠ regressed (10/10 applied, universal-when-should-be-gated) |
| `game` | 3/3 | −0.84% | −0.80% | ✓ **fully converged** |
| `responsive-stretch` | 10/10 | −12.02% | −5.02% | ✓ **fully converged** |

3 of 5 patterns reach pixel-perfect on every viewport. `responsive-stretch`
is the most impressive — the LLM correctly handled 10 viewports
including newly discovered breakpoint boundaries.

### Per-viewport detail

```
Pattern                Viewport     Before    After        Δ
------------------------------------------------------------
app-shell              desktop       2.00%    0.00%   -2.00% ✓
app-shell              mobile        2.16%    0.00%   -2.16% ✓
app-shell              wide          1.88%    0.00%   -1.88% ✓
dashboard              above-720    11.56%   11.56%   +0.00% ≈
dashboard              at-720       10.69%   10.69%   +0.00% ≈
dashboard              desktop      10.49%   10.49%   +0.00% ≈
dashboard              mobile       11.32%   11.32%   +0.00% ≈
dashboard              sample-521   10.94%   10.94%   +0.00% ≈
dashboard              sample-932   10.70%   10.70%   +0.00% ≈
dashboard              wide         10.29%   10.29%   +0.00% ≈
expressive-menu        desktop       7.03%    8.78%   +1.74% ⚠
expressive-menu        mobile        9.19%   10.00%   +0.81% ⚠
expressive-menu        wide          6.66%    7.83%   +1.17% ⚠
game                   desktop       0.84%    0.00%   -0.84% ✓
game                   mobile        0.80%    0.00%   -0.80% ✓
game                   wide          0.83%    0.00%   -0.83% ✓
responsive-stretch     above-640     7.15%    0.00%   -7.15% ✓
responsive-stretch     above-860     9.76%    0.00%   -9.76% ✓
responsive-stretch     at-640        7.22%    0.00%   -7.22% ✓
responsive-stretch     at-860        5.98%    0.00%   -5.98% ✓
responsive-stretch     desktop       5.12%    0.00%   -5.12% ✓
responsive-stretch     mobile       12.02%    0.00%  -12.02% ✓
responsive-stretch     sample-1024    5.63%    0.00%   -5.63% ✓
responsive-stretch     sample-481    8.95%    0.00%   -8.95% ✓
responsive-stretch     sample-679    6.84%    0.00%   -6.84% ✓
responsive-stretch     wide          5.02%    0.00%   -5.02% ✓
```

## Failure analyses

### dashboard — 1/5 fixes applied, no measurable change

The LLM proposed 5 reasonable-looking fixes; only `.filters
{ grid-template-columns: 1fr } @media (max-width: 720px)` was applied.
The other 4 used **descendant-combinator selectors** (`.kpi strong`,
`.alert strong`) which `applyMigrationFixToCss` skipped because the
strict-match `ruleMatch[1].trim() !== fix.selector` check doesn't
tolerate the `<class> <tag>` form when the existing CSS uses a different
whitespace shape (or doesn't have that exact compound selector at all).

The single applied fix added a new `@media` block but apparently
didn't change rendered output enough to move pixel diff. Likely the
`.filters` selector was already grid-templated correctly at this
breakpoint and the override is redundant.

**Follow-up**: make the apply step more permissive about descendant /
child combinator whitespace, or surface "rule-not-found" as a
proposal type that gets a fresh `<selector> { <prop>: <value>; }`
inserted at end-of-stylesheet rather than skipped.

### expressive-menu — 10/10 applied, +0.81% to +1.74% regression

Every proposal was an authored-property baseline-value pair —
exactly the shape the filters are tuned for. But all 10 had
`mediaCondition: null` and applied universally. The LLM read the
"wide" target's baseline values (e.g. `.stage { padding-top: 34px }`)
and applied them to all viewports.

If the target's `.stage` has different padding at different viewports
(say `34px` at wide but `20px` at mobile), applying `34px` universally
fixes wide but breaks mobile/desktop — exactly the +1.74% / +0.81%
regression we see.

**Follow-up**: when `buildBaselineValueIndex` builds the global map
with first-write-wins, also detect **multi-value pairs** (same
selector/property has different baselines per viewport) and either:
  - exclude them from the prompt table entirely (force LLM to skip), or
  - emit them with explicit per-viewport `mediaCondition` annotations
    so the LLM can media-gate.

## Cost & latency

Each `--max-fixes 10` round costs ~$0.004 (12k prompt + 0.3k completion
tokens at gemini-2.5-flash prices). 5 patterns × 1 round each = **~$0.02
total**.

Wall time: ~5 minutes for all 5 patterns including their before+after
migration-compare runs (Playwright capture × 3-10 viewports each).

## Takeaway

With the report-grounding + property filters from commit `477cff6`:

- **3/5 patterns reach pixel-perfect on every viewport in one shot**.
- **1/5 (dashboard) is gated by the apply step's selector strictness**
  — a known limitation; LLM proposals look right.
- **1/5 (expressive-menu) regresses because baseline values aren't
  shared across viewports** — a known limitation in `buildBaselineValueIndex`'s
  first-write-wins indexing.

These two gaps are concrete, narrowly-scoped follow-ups. The combo +
filter chain is now a useful inner-loop tool for the design-runs flow.

## Artifacts

- Per-pattern run dirs: `/tmp/dogfood-eval/patterns-bench/<pattern>/`
  containing `before/`, `after/`, `fixed.html`, and fix logs.
