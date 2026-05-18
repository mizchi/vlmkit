# Changelog

## Unreleased — design-md scenario branch (2026-05-15)

A single branch of work — `claude/design-md-scenario-2026-05-15` —
turning vrt from a single-shot diff tool into a complete UI-regression
workflow. Driven by 9 closed-loop subagent runs (a → i) against a
DESIGN.md → HTML/CSS reproduction scenario; each run surfaced
friction, each friction got closed in code.

### Headlines

- **18 GitHub issues filed and closed** (#22 – #36, plus 3 drafts
  shipped as `vrt manifest` / `vrt watch` / `vrt diff-pr`).
- **38 commits, 183 tests across 32 suites.**
- Closed-loop floor moved from **10.3% mobile** (agent-a, original
  vrt) to **0.2% mobile** (agent-d, post-fix) on a 5-round budget;
  3-round budget reached **3.45% mobile** (agent-f).
- 4 a11y gate layers + 2 quality-extension gates added to the CI
  surface, all with manifest suppression.

### New top-level CLIs

| Command | Purpose |
|---|---|
| `vrt manifest add/list/rm/check` | Author the approval manifest. Per-rule kinds: `visual` (default), `a11y-contrast`, `a11y-touch`, `a11y-focus-order`, `a11y-semantic`, `media-variant`, `cross-browser`. `--from-run <output-dir>` synthesizes rules from a recent compare's wireframe-fix candidates. |
| `vrt watch <baseline> <variant>` | File-watcher inner-loop with round-vs-round delta (newly-introduced / resolved / persisted suggestions + zero-crossing detection). |
| `vrt diff-pr {pin,verify,post}` | CI gate. Per-route diff against pinned baselines; per-viewport thresholds; optional a11y + media-variants + cross-browser gates. |
| `vrt baseline {pin,verify,post,list,rm}` | Canonical alias over `vrt diff-pr` with two extra utilities (`list` / `rm`) for inspecting baseline state. |

### Wireframe fix suggestions (new "what to edit" layer)

When DOM correspondence is missing, vrt's compare now emits actionable
fix candidates with a layered scope hierarchy:

```
STRUCTURAL  >  REFLOW  >  HIGH-IMPACT  >  DIVERGENT  >  MAG-DIVERGENT  >  SUBSET  >  (all)
```

- `[STRUCTURAL]` — 3+ child suggestions share a parent path with
  heterogeneous deltas; names the specific parent layout-strategy
  mismatch (e.g. `display: flex (now) → grid (target)`); flags
  conflicting child margins that will compound with the new gap.
- `[REFLOW]` — one viewport's magnitude is ≥ 3× others; suggestion
  steers toward typography upstream rather than spacing tokens.
- `[HIGH-IMPACT]` — one suggestion's magnitude dominates the set
  (≥ 12px AND ≥ 1.5× the next-largest).
- `[DIVERGENT]` — opposite-sign deltas across viewports; needs a
  media query.
- `[MAG-DIVERGENT]` — same sign but materially different magnitudes;
  suggestion includes predictive overshoot ("applying 40px globally
  would overshoot mobile by 16px").
- `[SUBSET]` — observation covers only some viewports.

Plus per-suggestion annotations:

- `current → target` notation on candidate CSS rules — agent reads
  arrow left-to-right matching the natural edit direction.
- `[cascades to siblings]` on box-size-mutating candidates.
- `⚠ component height differs intrinsically` when bbox heights
  themselves differ.
- `⚠ N suggestions converge on .selector` (same-selector cumulative
  overshoot).
- `⚠ cross-edit: A + B all cascade-affect` (multi-selector cascade).

### CI gate layers (`vrt diff-pr`)

- **Visual diff**: per-route per-viewport pixel ratio against pinned
  baseline; per-route threshold overrides.
- **a11y gate**: contrast (WCAG 2.1) / touch-target size / focus-
  order (Tab cycling) / semantic (heading hierarchy / form-label /
  image-alt). Findings demoted by manifest rules.
- **Media-variants gate**: forced-colors / reduced-motion / print /
  rtl / zoom-200. Suspect / warn verdict counts gate.
- **Cross-browser gate**: chromium / firefox / webkit. Auto-skip on
  CI runners that don't have all three.

All gates emit a unified markdown `summary.md` suitable for
`gh pr comment --body-file`.

### Cross-round signals

- `vrt compare --against-previous <output-dir>`: emits per-viewport
  diff% change, newly-introduced / resolved suggestions, and
  zero-crossing detection (a component flipped sign → damp ~50%).
- `vrt watch` emits the same delta on every save event.

### Render correctness

- `vrt compare` file-mode no longer produces a false 0% PASS when
  the same `<link>` href fails to resolve on both sides (#22 — the
  bug that bit the first two agents in round 1).
- Render-sanity warnings (font 404, stylesheet 404) promoted to a
  red banner at the top; variant side now probed alongside baseline.
- Symmetric failures downgrade to a single dimmed line so diff
  numbers stay readable.

### Triptych output

Every per-viewport compare now emits a `<route>-<viewport>-triptych.png`
with `BASELINE | VARIANT | HEATMAP` panels labeled in color.

### DESIGN.md token integration

Pass `--tokens <path>` to `vrt compare` and hex pairs in the palette
diff back-resolve to token names; bbox magnitudes snap to the
nearest declared spacing token.

### Issues closed

| # | Title | Severity |
|---|---|---|
| #22 | False 0% PASS in `vrt compare` file-mode (3 stacked bugs) | critical |
| #23 | Token-aware fix candidates in wireframe mode | major |
| #24 | `BASELINE / VARIANT / HEATMAP` triptych PNG per viewport | minor |
| #25 | Default-on computed-style + DOM-position diff | major |
| #26 | Reverse hex → DESIGN.md token lookup | major |
| #27 | Render-sanity banner + variant probe | major |
| #28 | `migration-report.json` state-leak (duplicate of #22) | minor |
| #29 | Viewport scope tags (DIVERGENT / SUBSET) | major |
| #30 | Wireframe suggestions name candidate CSS selector | major |
| #31 | MAG-DIVERGENT classification | minor |
| #32 | Symmetric sanity banner downgrade | minor |
| #33 | Text-reflow detection (REFLOW scope) | major |
| #34 | Cross-suggestion overshoot aggregation | major |
| #35 | STRUCTURAL parent layout-strategy detail | minor |
| #36 | Cross-edit interaction warning (multi-selector cascade) | minor |

Plus three drafts shipped as new CLIs (`vrt manifest` / `vrt watch` /
`vrt diff-pr`).

### Reports

Detailed analysis of each validation run is under
`docs/reports/2026-05-15-design-md-scenario-v{1..9}.md`. Each
report quotes the agent's friction verbatim and records what was
fixed in response.

## Unreleased — Markup-assistance toolkit

A new suite of commands focused on the LLM-agent markup-authoring loop:
build from screenshot, verify a11y / theme / i18n / cross-browser
regressions, enforce design-system scales. The full scenario coverage
matrix is at `docs/reports/2026-05-13-scenario-matrix.md`; the
capability survey at `docs/reports/2026-05-13-capability-survey.md`.

### New commands

- `vrt component-from-image <target.png> <current.html>` — build a
  component from a target screenshot, iterate until pixel diff is
  low. Surfaces structured signals: bbox matches with IoU, heatmap
  region clusters with dominant fill + content-kind classification,
  text-row Δy with per-gap spacing-fix table, typography hints
  (estimated font-size / weight bucket), palette diff with
  near-neighbor distance, dominant background colors, and a
  multi-state pass (`--states hover focus-visible …`) that surfaces
  `suspect` / `_subtle_` / `ua-likely` / `direction?` flags. Optional
  `--device-scale-factor` for retina target captures.

- `vrt theme-parity <html>` — render under
  `prefers-color-scheme: light` and `dark`, flag components whose
  fill is identical across themes (hard-coded colors that defeat
  the theme switch).

- `vrt media-variants <html>` — render under five user-preference
  variants in one pass: `forced-colors`, `reduced-motion`, `print`,
  `rtl`, `zoom-200`. Each gets a heuristic verdict combining pixel
  delta with stylesheet-text static analysis (catches missing
  `@media (prefers-reduced-motion: reduce)`, `forced-color-adjust:
  none` opt-outs, physical-property usage that breaks RTL).

- `vrt cross-browser <html|url>` — render in Chromium, Firefox,
  WebKit. Engines not installed in the local Playwright cache
  auto-skip with `npx playwright install` hints.

- `vrt i18n-stress <html>` — inflate every text node by a factor
  (default 1.4× ≈ German), detect horizontal overflow / wrap / parent
  bounds violations. Dedupes ancestor reports.

- `vrt design-tokens <html|url>` — scale-conformance for
  `border-radius`, `padding`, `margin`, `z-index`, `box-shadow`.
  Configurable scales via CLI flags or JSON config. Per-violation
  report with nearest in-scale replacement.

- `vrt a11y-contrast <html>` — walks every visible text node,
  computes WCAG AA contrast ratio (4.5:1 normal, 3:1 large text),
  surfaces failures with foreground/background hex pairs.

- `vrt a11y-touch <html|url>` — interactive elements below
  44×44 (`--level AAA`) or 24×24 (`--level AA`) flagged with
  cluster-spacing check.

- `vrt a11y-focus-order <html|url>` — drives Tab through the page,
  detects visual-order mismatches (reverse / trap / skip-row).

- `vrt multi-page-consistency --selector <sel> --urls ... | --files ...` —
  drift check: same component across N pages.

- `vrt component-consistency <html> --selector <sel>` — drift check:
  N instances of selector on one page (catches inline-vs-component
  leak after refactors).

- `vrt interact <html|url> --sequence <path.json>` — scripted
  Playwright action sequence (snapshot / click / hover / focus /
  blur / press / type / fill / select / scroll / wait /
  waitForSelector). Per-transition pixel diff + heatmap regions.
  Per-row "dead" flag for actions that produced no visible change
  (selector miss or no-op detection).

- `vrt perf <html|url>` — Web-Vitals visual-stability check via
  in-page PerformanceObserver. Captures CLS / LCP / FCP / TTFB in
  ~3s without a Lighthouse dependency. CLS-source attribution
  surfaces the specific element triggering layout shift; LCP-element
  identity points at the largest contentful node. For full Web
  Vitals (TBT, INP, bundle size) defer to Lighthouse / PageSpeed.

### Infrastructure

- All new CLIs registered under the unified `vrt` dispatcher
  (`src/cli/vrt.ts` + `src/cli/router.ts`). Fixed a long-standing
  dispatcher bug where `process.argv[1]` was a relative path,
  silently breaking each module's `isCliEntry` check in dev mode.
- Smoke test (`scripts/smoke-all-clis.sh`) — runs every
  markup-assistance CLI on its fixture, asserts exit 0 + expected
  output. 15/15 PASS at HEAD.
- New fixtures under `fixtures/` for every command, each engineered
  to exercise a specific bug class:
  - `wireframe/pricing-card/` (component-from-image)
  - `multi-state/hover-button/` (multi-state)
  - `multi-page/footer-drift/` (multi-page-consistency)
  - `component-consistency/inline-leak/` (component-consistency)
  - `theme-parity/card-with-bug/` (theme-parity)
  - `i18n-stress/button-overflow/` (i18n-stress)
  - `media-variants/card/` friendly + hostile (media-variants)
  - `design-tokens/off-scale/` (design-tokens)
  - `a11y-contrast/low-contrast/`, `a11y-touch/small-targets/`,
    `a11y-focus-order/reversed/`, `typography/wrong-size-weight/`,
    `interact/dropdown-form/`

### Reports for review

- `docs/reports/2026-05-13-capability-survey.md` — what the toolkit
  can and can't do, ROI-ranked next directions.
- `docs/reports/2026-05-13-scenario-matrix.md` — 97 markup-flow
  scenarios × coverage status (currently 44 ✅ / 32 🟡 / 10 ❌ / 11 ⚪
  = 89% useful coverage).
- `docs/reports/2026-05-13-comprehensive-dogfood.md` — subagent
  evaluation of the integrated toolkit; identified 3 follow-up
  improvements (all shipped).

## 0.4.0 — Prior releases

(See git history for changes before this entry was added.)
