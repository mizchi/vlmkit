# Multi-fix improvement follow-ups (2026-05-23)

Three improvements implemented after the 5-pattern dogfood, plus
honest findings about what each improvement actually fixed.

## Implementation

### A. Selector whitespace normalization (`applyMigrationFixToCss`)

`ruleMatch[1].trim() !== fix.selector` strict equality broke matches
for descendant-combinator selectors with non-canonical whitespace
(e.g. `.kpi  strong` vs `.kpi strong`). Now both sides pass through
`normalizeSelectorWhitespace()` — collapse runs of whitespace, strip
padding around `>` / `+` / `~` / `,` combinators — before comparison.

Tests: `applyMigrationFixToCss whitespace tolerance` (2 cases).

### B. Viewport-variant detection (`buildBaselineValueIndex`)

Previous build was first-write-wins on `(selector, property)` → some
value. If `.stage { padding-top }` had `34px` at wide and `20px` at
mobile, the global map kept whichever pass landed first, and the LLM
applied it universally → regression on the other viewport.

Now `buildBaselineValueIndex` returns three maps:

- `global`: `(selector, property)` → value, **only when the same
  value was observed at every viewport that recorded it**.
- `byViewport`: `(selector, property, viewport)` → per-viewport value.
- `viewportVariant`: `(selector, property)` → `Set<string>` of the
  distinct values observed when they disagree.

`correctMigrationFixesWithReport` rejects proposals targeting a
viewport-variant pair when `mediaCondition` is null — forcing the
fix to be media-gated or dropped.

The prompt builder lists viewport-variant rows in a dedicated section
so the LLM is aware they need explicit `@media` wrappers.

Tests: 2 new cases for variant detection + correction filtering.

### I. `--summary-out path` on `migration-fix-loop`

Multi-mode now writes a JSON summary with `target`, `counts`,
`applied`, `skipped`, `corrections`, `dropped`, `proposals`, and
`outputPath` so downstream aggregation scripts don't need to grep
log files.

## Honest re-bench result

Re-ran the same 5 patterns under the fixes:

| Pattern | proposed → applied | Outcome |
|---|---|---|
| app-shell | 5 → 0 applied (5 skipped: values already match current) | no improvement |
| dashboard | 3 → 1 applied (2 no-op skips: values already match current) | no improvement |
| expressive-menu | 10 → 10 applied | **+0.81-1.74% regression** (cascade conflict — see below) |
| game | 2 → 0 applied | no improvement |
| responsive-stretch | 4 → 0 applied | no improvement |

**0/5 patterns materially improved** — opposite of the original
report. The skipped fixes weren't a B-detection issue (the
viewport-variant filter didn't fire on any of them) but rather a
genuine "LLM proposed a value that already exists" situation. The
LLM read `.channel { display: flex }` from the report's universal
table and proposed it — but `current.html` ALREADY had `display:
flex`. The apply step correctly recognized the no-op and skipped.

This is healthy behavior: the value-correction filters now narrow the
LLM's options to "things the report knows the baseline value for",
and many of those happen to be already-correct in `current.html`.
The remaining diff is structural / sub-pixel and not expressible as
single declaration changes.

### `expressive-menu` regression diagnosis

10/10 applied, all baselines verbatim from the report's universal
table:

```
.stage { padding-top: 34px; padding-right: 46px; padding-bottom: 38px; padding-left: 46px; background-color: rgb(5, 5, 5); }
.brand { font-size: 28px; line-height: 28px; }
.brand-mark { background-color: rgb(230, 0, 18); }
.clock { background-color: rgb(247, 244, 236); box-shadow: rgb(230, 0, 18) 8px 8px 0px 0px; }
```

The regression source isn't viewport-variant — every value is
observed identical at all 3 viewports. The issue is that
`applyMigrationFixToCss` falls back to **appending new longhand
declarations at end-of-stylesheet** when the existing rule is a
multi-line block (one-line regex `^([^{]+)\{([^}]+)\}\s*$/` doesn't
match `\n` -separated declarations).

So `current.html` had:

```css
.stage {
  padding: 36px 52px 40px;
  background: radial-gradient(...), linear-gradient(...), var(--black);
}
```

After fix, longhand declarations got APPENDED:

```css
.stage { padding-top: 34px; padding-right: 46px; ...; background-color: rgb(5, 5, 5); }
```

Cascade-wise the longhand wins (same specificity, later wins). The
`padding-*` longhands cleanly override the original shorthand. But
`background-color: rgb(5, 5, 5)` overrides only the COLOR layer of
the `background` shorthand — the gradient images stay intact. The
subtle difference between `rgb(5, 5, 5)` and whatever `var(--black)`
resolved to in the variant moves the visible color enough to nudge
diff +1-2%.

## Real follow-up needed

**A.2**: When the matched rule is a multi-line block, the apply step
should UPDATE the existing block's properties in-place rather than
falling through to "no single-line match → append". This requires
extending the regex / parser to handle multi-line `{ ... }` blocks
or moving to a real CSS parser.

This is the actual fix for the expressive-menu case. It's a deeper
refactor — left as a separate item.

## Artifacts

- Re-bench summaries: `/tmp/dogfood-eval/patterns-bench-v2/<pattern>/summary.json`
- Updated multi-fix-loop with `--summary-out` flag
- Tests: `migration-fix-loop-core.test.ts` (988 → 990 tests pass)
