# vrt — CLI / Library API Design

## Current Problems

- 8 CLIs exist but naming is inconsistent (`css-challenge`, `migration-compare`, `demo`, `vrt-demo-fix` ...)
- 15+ library modules exist but public API is unclear
- `css-challenge-core.ts` mixes Playwright dependency, crater dependency, CSS parser, and LLM client
- Type definitions scattered across `types.ts` and individual modules

## Design Policy

### CLI: `vrt` Subcommand System

Hang subcommands off a single entry point (`vrt`).

```
vrt compare <before> <after>         # VRT comparison of 2 files
vrt compare --url <url> --current-url <url>  # URL mode
vrt snapshot <url1> [url2] ...       # URL → multi-viewport capture + baseline diff
vrt bench [options]                   # CSS challenge benchmark
vrt report                           # Report on accumulated data
vrt discover <file>                  # Breakpoint discovery + viewport suggestions
vrt smoke <file-or-url>              # A11y-driven random operation test
vrt serve [--port 3456]              # API server
vrt status [--url ...]               # Server health check
```

### Library: 3-Layer Structure

```
┌─────────────────────────────────────────────┐
│  CLI Layer (src/cli/)                       │
│  vrt compare, vrt bench, vrt report, ...    │
└─────────────┬───────────────────────────────┘
              │
┌─────────────▼───────────────────────────────┐
│  Core Layer (src/core/)                     │
│  Pure logic. No browser dependency          │
│                                             │
│  ├── css-parser.ts      CSS parse/transform │
│  ├── diff.ts            pixel diff, paint tree diff │
│  ├── classify.ts        Property classification │
│  ├── viewport.ts        Breakpoint discovery │
│  ├── approval.ts        Diff approval rules │
│  ├── a11y.ts            A11y tree diff      │
│  └── types.ts           All type definitions │
└─────────────┬───────────────────────────────┘
              │
┌─────────────▼───────────────────────────────┐
│  Backend Layer (src/backend/)               │
│  Browser/renderer dependent                 │
│                                             │
│  ├── chromium.ts        Playwright wrapper  │
│  ├── crater.ts          Crater BiDi client  │
│  └── interface.ts       Common interface    │
└─────────────────────────────────────────────┘
```

## CLI Details

### `vrt compare`

Compare 2 HTML files (or URLs). Auto breakpoint discovery + multi-viewport.

```bash
# File comparison
vrt compare before.html after.html

# Directory comparison (baseline + variants)
vrt compare --baseline normalize.html --variants modern.html destyle.html

# URL comparison
vrt compare --url http://localhost:3000/ --current-url http://localhost:8080/

# Options
vrt compare before.html after.html \
  --backend chromium           # chromium | crater | both
  --max-viewports 10           # Viewport limit
  --random-samples 2           # Random samples between breakpoints
  --no-discover                # Disable auto breakpoint discovery
  --approval approval.json     # Approval rules file
  --output-dir path            # Output directory
  --mask ".ads,.carousel"      # Selector masking (visibility: hidden)
```

### `vrt snapshot`

Capture URL at multiple viewports and auto-compare with previous baseline.

```bash
# First run: create baseline. Subsequent runs: measure diff
vrt snapshot http://localhost:3000/ http://localhost:3000/about/

# Options
vrt snapshot <url1> [url2] ... \
  --output snapshots/          # Output directory
  --mask ".marquee,.badge"     # Mask dynamic content
```

### `vrt bench`

CSS challenge benchmark. Delete 1 CSS line → measure detection rate.

```bash
vrt bench                                    # Default (page fixture, 20 trials)
vrt bench --fixture dashboard --trials 50    # Specify fixture + trial count
vrt bench --backend crater                   # Crater backend
vrt bench --all                              # All fixtures at once
vrt bench --no-db                            # Don't save to DB
```

### `vrt report`

Analysis of accumulated data.

```bash
vrt report                     # All data
vrt report --fixture page      # By fixture
vrt report --backend crater    # By backend
```

### `vrt discover`

Discover breakpoints from HTML/CSS and suggest test viewports.

```bash
vrt discover page.html
# Output:
#   Breakpoints: min-width:640px, min-width:768px, min-width:1024px
#   Suggested viewports (11):
#     375px (mobile)
#     639px (below 640px breakpoint)
#     640px (at 640px breakpoint)
#     ...
```

### `vrt demo`

Demo execution.

```bash
vrt demo              # Basic demo
vrt demo fix          # Fix loop
vrt demo multi        # Multi-scenario
vrt demo multistep    # Multi-step
```

## Library API

### Core Layer (Browser-independent)

```typescript
// --- css-parser ---
import { parseCssDeclarations, removeCssProperty, applyCssFix, extractCss } from "vrt/core/css-parser";

// --- diff ---
import { compareImages, diffComputedStyles } from "vrt/core/diff";
import { diffPaintTrees } from "vrt/core/diff";

// --- classify ---
import { categorizeProperty, classifySelectorType, classifyUndetectedReason, isOutOfScope } from "vrt/core/classify";

// --- viewport ---
import { extractBreakpoints, generateViewports, discoverViewports } from "vrt/core/viewport";

// --- a11y ---
import { diffA11yTrees, checkA11yTree } from "vrt/core/a11y";

// --- types ---
import type { CssDeclaration, ViewportSpec, Breakpoint, DetectionRecord, ... } from "vrt/core/types";
```

### Backend Layer (Browser-dependent)

```typescript
// --- Common interface ---
import type { RenderBackend, CapturedState } from "vrt/backend/interface";

// --- Chromium ---
import { ChromiumBackend } from "vrt/backend/chromium";
const backend = new ChromiumBackend();
await backend.init();
const state = await backend.capture(html, viewport);
await backend.close();

// --- Crater ---
import { CraterBackend } from "vrt/backend/crater";
const backend = new CraterBackend("ws://127.0.0.1:9222");
await backend.init();
const state = await backend.capture(html, viewport);
await backend.close();
```

### Backend Interface

```typescript
interface RenderBackend {
  name: string;                  // "chromium" | "crater"
  
  init(): Promise<void>;
  close(): Promise<void>;
  
  /** Render HTML and capture screenshot + metadata */
  capture(html: string, viewport: ViewportSpec, options?: CaptureOptions): Promise<CapturedState>;
  
  /** Check availability */
  isAvailable(): Promise<boolean>;
}

interface CaptureOptions {
  captureHover?: boolean;        // Also capture hover state
  capturePaintTree?: boolean;    // Paint tree (crater only)
  captureA11y?: boolean;         // A11y tree
  captureComputedStyles?: boolean; // Computed style
  screenshotPath?: string;       // PNG save path
}

interface CapturedState {
  screenshotPath: string;
  a11yTree?: A11yNode;
  computedStyles?: Map<string, Record<string, string>>;
  hoverComputedStyles?: Map<string, Record<string, string>>;
  paintTree?: PaintNode;         // crater only
}
```

## Migration Path

Mapping from current files to new structure:

| Current | New Structure | Notes |
|---------|--------------|-------|
| `src/css-challenge-core.ts` | Split: `core/css-parser.ts` + `core/diff.ts` + `backend/chromium.ts` + `backend/crater.ts` | Largest refactoring target |
| `src/detection-classify.ts` | `core/classify.ts` | Nearly as-is |
| `src/detection-db.ts` | `core/db.ts` | Nearly as-is |
| `src/viewport-discovery.ts` | `core/viewport.ts` | Nearly as-is |
| `src/heatmap.ts` | `core/diff.ts` | Pixel diff portion |
| `src/a11y-semantic.ts` | `core/a11y.ts` | Nearly as-is |
| `src/crater-client.ts` | `backend/crater.ts` | PaintNode/diff moves to `core/diff.ts` |
| `src/types.ts` | `core/types.ts` | Consolidate |
| `src/css-challenge.ts` | `cli/challenge.ts` | CLI entry |
| `src/css-challenge-bench.ts` | `cli/bench.ts` | CLI entry |
| `src/detection-report.ts` | `cli/report.ts` | CLI entry |
| `src/migration-compare.ts` | `cli/compare.ts` | CLI entry |
| `src/demo*.ts` | `cli/demo.ts` | Consolidate |

## For Now

Refactoring is deferred. First:
1. Treat this design document as the source of truth
2. Add new features following the new structure
3. Leave existing code as-is since it works
4. Batch refactor when packaging as npm

## Design-md Scenario Loop (added 2026-05-15)

Three subcommands now cover the full UI-implementation lifecycle.

### Dev inner loop: `vrt compare` + `vrt watch`

```
vrt compare <baseline> <variant> [--tokens DESIGN.md]
vrt watch   <baseline> <variant> [--tokens DESIGN.md]
```

`vrt compare` does a one-shot diff and prints:

- per-viewport diff %
- **wireframe fix suggestions** with scope tags:
  - `[DIVERGENT]` — opposite-sign deltas across viewports → media query needed
  - `[MAG-DIVERGENT]` — same-sign but materially different magnitudes → per-viewport values
  - `[SUBSET]` — only some viewports affected → media query
  - (no tag) — `all` scope, safe global edit
- candidate CSS rule per suggestion (from DOM-position-diff layer)
- triptych PNG per viewport (`baseline | variant | heatmap`)
- token-snapped values when `--tokens` points at a DESIGN.md

`vrt watch` wraps that in a file-watcher with debounce + a
**round-vs-round delta**: when the developer or agent saves a file,
the next run lists which suggestions became newly-introduced (= your
last edit regressed something), resolved, or persisted.

### Approval authoring: `vrt manifest`

```
vrt manifest add    --reason "..." --selector .foo [--max-px 2] [--expires DATE]
vrt manifest add    --from-run <output-dir> [--auto-tiny | --top N | --all]
vrt manifest list   [--path approval.json]
vrt manifest rm     <index | selector>
vrt manifest check  # CI hook — exit non-zero on expired rules
```

`add --from-run` synthesizes rules from a recent compare run's
wireframe-fix suggestions: each rule names a real selector lifted
from the suggestion's `candidates[0]`. Default filter is
low-confidence ∧ |Δ|≤2px (sub-pixel AA jitter); use `--top N` to
broaden.

Manifest entries are consumed by the existing `vrt compare`
`approvalManifest` plumbing — they're subtracted from the
reported diff before the threshold gate fires.

### A11y gate (folded into `vrt diff-pr`)

```json
{
  "a11y": {
    "level": "AA",                  // AA → 24×24 / 4.5:1; AAA → 44×44 / 7:1
    "maxContrastFailures": 0,
    "maxTouchFailures": 0,
    "maxFocusOrderFailures": 0,
    "contrast": true,               // toggle individual checks
    "touch": true,
    "focusOrder": false             // off by default — slower; opt in
  }
}
```

Three checks share one config + one summary + one exit code:

- **contrast** (`a11y-contrast`): every visible text element's
  rendered foreground vs effective background, WCAG 2.1 contrast
  ratio against AA / AAA thresholds.
- **touch** (`a11y-touch`): every focusable element's
  `min(width, height)` against 24×24 (AA) / 44×44 (AAA).
- **focus-order** (`a11y-focus-order`): Tab cycle on the live
  page; surfaces `trap` / `reverse` / `skip-row` findings.

Per-check thresholds and per-route overrides resolve the same way
as the visual threshold (route value wins; project default fills
the rest).

Findings can be suppressed via `vrt manifest add --a11y-{contrast,
touch,focus-order} --selector <substring> --reason "..." --expires
<date>`. The substring matches the finding's `path` (or, for
focus-order, the message text). Expired rules surface in
`vrt manifest check` so the gate doesn't silently approve forever.

Output (terminal):

```
good   pass  mobile=0.00% [a11y c=0/t=0/f=0]  ...
focus  FAIL  mobile=0.00% [a11y c=0/t=0/f=1]  ...
```

Output (summary.md):

```
| route   | viewport | diff% | threshold | a11y (contrast / touch / focus) | status |
| `focus` | mobile   | 0.00% | 50.00%    | 0/0 · 0/0 · 1/0                  | ❌      |

## A11y failures
- `focus` / mobile — **focus-order** 1 > 0: reverse (step 1→2)
```

### CI gate: `vrt diff-pr`

```
vrt diff-pr pin       # on main: capture baselines for every route
vrt diff-pr           # in PR build: diff each route against pinned baseline
```

Reads `vrt.config.json`:

```json
{
  "baseUrl": "http://localhost:3000",
  "thresholds": { "mobile": 0.01, "desktop": 0.005, "wide": 0.005 },
  "tokens": "./DESIGN.md",
  "approvalPath": "./approval.json",
  "baselineDir": ".vrt/baselines",
  "routes": [
    "/",
    { "name": "admin", "path": "/admin",
      "thresholds": { "mobile": 0.03 } }
  ]
}
```

Per-route threshold overrides the top-level threshold; both default
to mobile=1% / desktop=wide=0.5%. Routes accept bare paths (joined
to `baseUrl`) or full URLs (including `file://`).

Output: per-route per-viewport diff% in the terminal, plus
`<output>/summary.md` suitable for pasting into a PR comment. Exit
code is 0 on full pass / 1 on any uncovered breach.

### Loop tying

```
     dev time                       CI time
     ──────────                     ────────
   vrt compare ──────┐
     (rich signals)   │
                      │   on main:
   vrt watch ─────────┤         vrt diff-pr pin
     (round delta)    │              (seed baselines)
                      │
   vrt manifest add ──┤   in PR:
     (acknowledge)    │         vrt diff-pr
                      └→        (gate vs pinned)
                                    ↓
                                 summary.md  →  PR comment
```

### `vrt diff-pr` vs `vrt workflow` — when to use which

Two baseline workflows coexist intentionally; they serve different
needs:

| | `vrt diff-pr` | `vrt workflow` |
|---|---|---|
| audience | external project's CI gate | vrt's own dogfooding e2e harness |
| capture | direct `chromium.launch()` + `page.goto()` per route | Playwright spec at `e2e/vrt-capture.spec.ts` |
| baseline layout | `<baselineDir>/<route>/<viewport>.png` | flat `baselines/*.png` keyed by spec testId |
| approval | per-rule manifest (`vrt manifest add`) + per-viewport threshold | bulk `cp snapshots → baselines` |
| partial refresh | `vrt diff-pr pin <route>` (this commit) | not supported |
| primary output | `summary.md` + per-route diff% | `output/report.json` with a11y deltas |

Rule of thumb:

- Pulling vrt into a new project: use **`vrt diff-pr`** with a
  `vrt.config.json`. Pin on main, gate per PR. Author exceptions via
  `vrt manifest`.
- Working inside the vrt repo (this codebase) or extending its
  test harness: use **`vrt workflow`**. It owns the e2e Playwright
  spec and the a11y semantic check that `vrt diff-pr` doesn't.

Unification under a single command surface is a future cleanup once
both paths have settled. For now they share the same low-level
pipeline (`migration-compare.ts`, `heatmap.ts`) and the same
approval-manifest contract.

### PR comment glue

```
vrt diff-pr post --pr <ref> [--summary <path>] [--marker <id>]
```

After running `vrt diff-pr`, post the generated `summary.md` to a
PR via `gh pr comment`. If `gh` isn't on PATH the command prints
the markdown with copy-paste instructions instead — useful for
operators inspecting the gate output before committing to a
public post.

The body is tagged with an HTML-comment marker
(`<!-- vrt-diff-pr-summary -->`) so a later iteration can find /
overwrite the comment in place.

Open follow-ups:

- Edit-in-place for the PR comment (gh CLI doesn't natively
  support it; needs the GitHub REST API)
- Auto-derive the PR ref from the current branch when omitted
