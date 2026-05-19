# vrt

Visual Regression Testing toolkit — pixel diff, computed-style diff,
a11y tree diff, agent-readable Markdown reports, and AI-powered CSS
fix generation.

Requires Node 24+.

```bash
npm install -g @mizchi/vrt
# or, from this repo:
pnpm install && pnpm build
```

The CLI is organized into verb groups. Run `vrt <group> --help` for
options.

| Group | Subcommands |
|---|---|
| `vrt diff` | `html`, `png`, `elements`, `browsers`, `agent`, `runs` |
| `vrt check` | `a11y {contrast,touch,focus}`, `tokens`, `theme`, `perf`, `drift {component,pages}` |
| `vrt inspect` | `interact`, `explore`, `smoke` |
| `vrt stress` | `i18n`, `media` |
| `vrt scan` | `component`, `breakpoints` |
| `vrt build` | `component` |
| `vrt snapshot` | `[<url>...]`, `approve`, `fix-prompt`, `stability`, `flipbook`, `report` |
| `vrt migration` | `compare`, `blind`, `subagent` |
| `vrt workflow` | `init`, `capture`, `verify`, `approve`, `graph`, `affected`, `introspect`, `spec-verify`, `expect` |
| Standalone | `vrt watch`, `vrt manifest`, `vrt diff-pr`, `vrt baseline`, `vrt api`, `vrt bench`, `vrt report`, `vrt skill` |

The single-token commands from 0.4.x (`vrt compare`, `vrt png-diff`,
`vrt theme-parity`, …) remain as deprecation shims that forward to
the new names and print a one-line hint. See the [CHANGELOG](./CHANGELOG.md)
for the full old → new mapping.

## Features

- **Pixel diff** — pixelmatch v7 + heatmap generation
- **Computed style diff** — `getComputedStyle` capture including hover/focus states
- **A11y tree diff** — accessibility snapshot comparison
- **CSS challenge bench** — automated CSS deletion/recovery with detection rate tracking (96.7%)
- **2-stage AI pipeline** — VLM (image → structured diff) + LLM (diff → CSS fix)
- **Migration VRT** — compare HTML before/after across responsive viewports
- **Snapshot** — URL-based multi-viewport capture with baseline diff
- **Mask** — selector-based masking for dynamic content (animations, counters)
- **Crater integration** — lightweight prescanner via BiDi (1.66x speedup, 0% false positive)
- **Markup-assistance toolkit** (10+ commands): build from screenshot, theme-parity,
  i18n stress, a11y contrast / touch / focus-order, media-variant adaptations,
  cross-browser parity, design-token conformance, interaction sequences.

## Quick Start

The examples below assume the `vrt` command is already installed and available on your PATH.

```bash
pnpm install

# Run tests
pnpm test

# Compare two HTML files
vrt diff html before.html after.html --output reports/

# Render the diff into an agent-friendly Markdown report
vrt diff agent reports/diff-report.json > reports/diff.md

# Compare two existing PNG screenshots without Playwright
vrt diff png baselines/home.png snapshots/home.png

# Compare two URLs
vrt diff html --url http://localhost:3000/ --current-url http://localhost:8080/ \
  --output reports/

# Snapshot URLs (creates baseline on first run, diffs on subsequent runs)
vrt snapshot http://localhost:3000/ http://localhost:3000/about/ --output snapshots/

# Use explicit labels when URL-derived names are not ideal
vrt snapshot http://localhost:3000/issues?severity=critical --label critical-issues

# Fail CI when diffs or new baselines are detected
vrt snapshot http://localhost:3000/ --fail-on-diff --fail-on-new-baseline --max-diff-ratio 0.01

# Promote accepted snapshot diffs to the new baseline
vrt snapshot approve --output snapshots/

# Load snapshot targets from vrt.config.json
vrt snapshot

# Dev inner loop with rich signal output (token-aware + cross-round)
vrt diff html baseline.html variant.html --tokens DESIGN.md --output reports/
vrt watch baseline.html variant.html --tokens DESIGN.md

# Author approval rules (sub-pixel deviations, intentional design exceptions, etc.)
vrt manifest add --selector .hero__body --max-px 2 --reason "AA artifact" --expires 2026-08-15
vrt manifest add --a11y-contrast --selector "button" --reason "decorative" --expires 2026-08-15
vrt manifest add --from-run .vrt/runs/diff-pr/  # auto-acknowledge sub-pixel deltas
vrt manifest list

# CI gate — declare routes in vrt.config.json, pin baselines, gate per PR
vrt baseline pin                                       # on main
vrt baseline verify                                    # in PR
vrt baseline post --pr owner/repo#123                  # send summary.md as PR comment

# Legacy internal-dogfood verification loop (vrt's own e2e suite)
vrt workflow init
vrt workflow capture
vrt workflow verify

# Workflow loop with external-project routes/config
vrt workflow init --config ./vrt.config.json
vrt workflow capture --config ./vrt.config.json

# Prepare a migration diff packet for an external fixer
pkf run migration-subagent-prepare -- --report test-results/migration/migration-report.json --output test-results/migration/subagent-task.md

# Measure success rate from before/after migration reports
pkf run migration-subagent-evaluate -- --before-report test-results/migration/migration-report.json --after-report test-results/migration/migration-report.after.json

# Inspect blind migration scenarios
pkf run migration-blind-list
pkf run migration-blind-show --scenario shadcn-to-luna
pkf run migration-blind-prepare --scenario shadcn-to-luna -- --packet test-results/migration/blind/shadcn-to-luna/task.md
pkf run migration-blind-solo --scenario shadcn-to-luna -- --output test-results/migration/blind/shadcn-to-luna/solo/after-blind.html --report-output-dir test-results/migration/blind/shadcn-to-luna/solo-report
pkf run migration-blind-evaluate --scenario shadcn-to-luna -- --before-report test-results/migration/blind/shadcn-to-luna/migration-report.json --after-report test-results/migration/blind/shadcn-to-luna/solo-report/migration-report.json --rounds 1

# Mask dynamic content
vrt snapshot http://localhost:3000/ --mask ".marquee-container,.hero-badge"

# Detect broken baseline renders (e.g. CDN failed to load) — on by default
vrt diff html --dir fixtures/migration/tailwind-to-vanilla \
  --baseline before.html --variants after.html
# Add --strict-baseline-sanity to exit non-zero when warnings fire,
# or --no-baseline-sanity to skip the check entirely.

# CSS challenge benchmark
pkf run css-bench --fixture page --trials 30

# Fix loop (break CSS → VLM analyze → LLM fix → verify)
pkf run fix-loop --fixture page --seed 42
```

### Task runner & spec gates (pkfire / pkspec)

Tasks live in `Taskfile.pkl` (typed; replaces the previous bash
justfile). Specs live in
`Spec.pkl` (Goals + Scenarios) and `Test.pkl` (smoke implementations).

```bash
# List every available task
pkf list

# Run a task (mirrors any old `just <name>` invocation)
pkf run smoke-all
pkf run vrt-test

# Spec gates
pkf run spec-check    # pkspec check Spec.pkl Test.pkl
pkf run spec-render   # render Spec.pkl → docs/SPEC.md
pkf run spec-run      # execute every Test.pkl test
```

Install `pkf` / `pkspec` via nix flake:

```bash
nix run git+https://github.com/mizchi/pkfire -- list
nix run git+https://github.com/mizchi/pkspec  -- check Spec.pkl Test.pkl
```

## CLI Surface

### Diff (compare two things)

```bash
vrt diff html <baseline> <variant>          # HTML/URL pair → multi-viewport diff + report.json
vrt diff agent <report.json>                # Render report.json as agent-friendly Markdown
vrt diff png <baseline.png> <current.png>   # Direct PNG pixel diff + heatmap
vrt diff elements [options]                 # Element-level diff with shift isolation
vrt diff browsers <html|url>                # chromium / firefox / webkit parity
vrt diff runs <dir...>                      # Aggregate multiple VRT runs into one table
```

### Snapshot (URL → baseline + diff)

```bash
vrt snapshot <url1> [url2] ...              # First run: baseline. Subsequent: baseline + diff
vrt snapshot approve                        # Promote *-current.png → *-baseline.png
vrt snapshot fix-prompt                     # Emit a subagent-ready prompt from snapshot-report.json
vrt snapshot stability <url...>             # Run N iterations and report false-positive rate
vrt snapshot flipbook                       # Diff three-frame (baseline ↔ current ↔ heatmap) HTML flipbooks
vrt snapshot report                         # Render snapshot-report.json as Markdown
```

### Check (gates: a11y / tokens / theme / perf / drift)

```bash
vrt check a11y contrast <html>              # WCAG AA contrast scan
vrt check a11y touch    <html|url>          # Touch target size (WCAG 2.5.5 / 2.5.8)
vrt check a11y focus    <html|url>          # Tab order vs visual order
vrt check tokens        <html>              # radius/spacing/z-index/shadow scale conformance
vrt check theme         <html>              # prefers-color-scheme dark / unthemed components
vrt check perf          <html|url>          # Web Vitals (CLS / LCP / FCP)
vrt check drift component <html> --selector .card
vrt check drift pages     --selector .footer --files A.html B.html C.html
```

### Build / Scan / Inspect / Stress (markup-assistance)

```bash
# Build component from a target screenshot, iterate until close.
vrt build component <target.png> <current.html>
  # signals: bbox + heatmap regions + dominant fill + typography hints
  # + spacing-fix table + palette diff + multi-state suspect flags.

# Detect components in a screenshot.
vrt scan component <screenshot.png>         # Crop to standalone PNGs
vrt scan breakpoints <html-file>            # Discover responsive breakpoints

# Scripted / exploratory interaction.
vrt inspect interact <html|url> --sequence <path.json>
vrt inspect explore  <html|url>             # Auto-discover declared actions and diff each
vrt inspect smoke    <html|url>             # A11y-driven exploratory smoke test

# Stress tests.
vrt stress i18n  <html>                     # Text-node inflation overflow detection
vrt stress media <html>                     # forced-colors, reduced-motion, print, RTL, 200% zoom
```

All emit a self-contained Markdown report under `--output-dir`. Each
finding includes pasteable hex / px values + a heuristic remediation
hint. See `docs/reports/2026-05-13-capability-survey.md` for the full
scenario × coverage matrix.

Snapshot labels are query-aware by default, so `/issues` and `/issues?severity=critical` no longer share the same baseline name.
Use repeated `--label` flags to override labels explicitly when needed.
The same `--label` flag can be used with `vrt snapshot approve` to approve only selected labels.

Minimal `vrt.config.json`:

```json
{
  "baseUrl": "http://localhost:3000",
  "routes": [
    "/",
    { "path": "/issues?severity=critical", "label": "critical-issues" }
  ],
  "outputDir": "test-results/snapshots/sample-webapp-2026",
  "threshold": 0.1,
  "failOnDiff": true,
  "maxDiffRatio": 0.01,
  "workflow": {
    "captureSpec": "./e2e/vrt-capture.spec.ts"
  }
}
```

When `vrt.config.json` exists in the current directory, `vrt snapshot` loads it automatically. Use `--config <path>` to point at another file, and pass URLs or flags directly when you want CLI values to override config defaults.
`vrt workflow init` and `vrt workflow capture` also auto-load the same file, reuse `baseUrl`/`routes`, and accept `workflow.captureSpec` or `--capture-spec <path>` when you want a custom Playwright entrypoint.

#### Subagent-ready fix prompt

`vrt snapshot fix-prompt` reads the last `snapshot-report.json` and emits a structured task list that a coding agent can act on:

```bash
# Markdown prompt to stdout (default)
vrt snapshot fix-prompt --output test-results/snapshots

# Limit to the 5 worst diffs, write to a file
vrt snapshot fix-prompt --output test-results/snapshots --limit 5 --out fix-prompt.md

# Filter by label, minimum diff ratio, and emit JSON for programmatic use
vrt snapshot fix-prompt --label home --min-diff 0.01 --format json
```

The prompt includes per-task URL, viewport, diff ratio (with shift compensation), and relative paths to the baseline / current / heatmap PNGs plus the captured HTML, so a subagent can map the visual regression back to source code.

#### Measuring false-positive rate

`vrt snapshot stability` captures the same URLs across N iterations against a
baseline locked in on iteration 0, then reports how often comparisons showed a
non-zero diff. Useful for tracking renderer noise, animation leakage, or mask
gaps before turning on `--fail-on-diff` in CI:

```bash
# 3 iterations (default), any non-zero diff counts as a positive
vrt snapshot stability http://localhost:3000/ http://localhost:3000/about/

# Fail CI if the overall FP rate exceeds 5%
vrt snapshot stability http://localhost:3000/ \
  --iterations 5 \
  --fail-above-rate 0.05 \
  --output test-results/stability

# Only count diffs above 1% as positives (filters out subpixel noise)
vrt snapshot stability http://localhost:3000/ --fp-threshold 0.01
```

The run writes `stability-report.json` to the output directory with per-URL +
per-viewport FP rate, mean / max diff ratios, and shift-compensated max — well
suited to artifact upload + over-time tracking.

#### Capture backend (`--backend`)

By default `vrt snapshot` launches a local Chromium via Playwright. To offload
capture to [Cloudflare Browser Run](https://blog.cloudflare.com/browser-run-for-ai-agents/)
without installing Playwright browsers in CI, switch the backend:

```bash
# Connect via CDP WebSocket; credentials come from env vars
CLOUDFLARE_ACCOUNT_ID=... CLOUDFLARE_API_TOKEN=... \
  vrt snapshot --backend cloudflare http://localhost:3000/
```

Resolution order for the backend selector:

1. `--backend <local|cloudflare>` CLI flag
2. `VRT_CAPTURE_BACKEND` env var
3. Default `local`

For the Cloudflare backend, additional env vars are required:

| Variable | Required | Purpose |
|---|---|---|
| `CLOUDFLARE_ACCOUNT_ID` | yes | Account id for the CDP URL |
| `CLOUDFLARE_API_TOKEN` | yes | Token with Browser Rendering permissions |
| `CLOUDFLARE_BROWSER_RUN_ENDPOINT` | no | Override the default WS endpoint |

See `examples/vrt-snapshot-cloudflare.workflow.yml` for a complete GitHub
Actions template that skips the local Playwright install step.

#### Visualizing the VRT process — flipbooks + video

The VRT process can be saved as a self-contained HTML "flipbook" (PNGs
embedded as base64, vanilla-JS play/pause/scrub controls). One file
per scenario, no external assets, opens in any browser, attachable to
PRs:

```bash
# 1. Fix-loop convergence (or any ordered PNG sequence)
vrt snapshot flipbook round-0.png round-1.png round-2.png \
  --label "round 0" --label "round 1" --label "round 2" \
  --title "Fix-loop convergence" --out fix-loop.html

# 2. Diff three-frame (baseline ↔ current ↔ heatmap) for every regressed entry
vrt snapshot flipbook --output test-results/snapshots
# → test-results/snapshots/flipbooks/<label>-<viewport>.html

# 3. Stability iterations as flipbook per (URL, viewport)
vrt snapshot stability http://localhost:3000/ \
  --iterations 5 --flipbook --output test-results/stability
# → test-results/stability/flipbooks/<label>-<viewport>-stability.html

# 4. WebM recording of a smoke-test session (Playwright recordVideo)
vrt inspect smoke --url http://localhost:3000/ --max-actions 20 --record-video videos/
# → videos/<hash>.webm
```

Common flags: `--delay <ms>` controls per-frame duration (default 700),
`--no-loop` stops at the last frame, `--no-autoplay` opens paused.

#### Agent-friendly diff summary

When a coding agent is iterating with `vrt diff html`, the natural workflow
(see [`docs/reports/2026-05-12-dogfood-shadcn-luna.md`](docs/reports/2026-05-12-dogfood-shadcn-luna.md))
is: read the worst-viewport PNGs side-by-side, then write a CSS patch.
`vrt diff agent` collapses the inputs the agent needs into a single
Markdown blob:

```bash
vrt diff html --dir fixtures/migration/shadcn-to-luna \
  --baseline before.html --variants working.html \
  --output test-results/iter1
vrt diff agent test-results/iter1/diff-report.json --max-viewports 2
```

The output contains: a worst-first diff table, category totals across
viewports, fix candidates aggregated by `(selector, property)` with the
number of viewports each is flagged on, and absolute paths to the
baseline / current / heatmap PNGs for the worst N viewports — all in
one context window.

### Workflow Commands

These commands manage state under the current project root: `baselines/`, `snapshots/`, `output/`, `vrt-report.json`, `expectation.json`, and `spec.json`.

Before running them, start the target app and point `VRT_BASE_URL` at it when needed.
The built-in capture workflow defaults to `http://127.0.0.1:4174`.
`vrt workflow verify` itself only compares the PNG and `.a11y.json` artifacts already present under `baselines/` and `snapshots/`; it does not launch Playwright.

```bash
vrt workflow init
vrt workflow capture
vrt workflow verify
vrt workflow approve
vrt workflow report
vrt workflow graph
vrt workflow affected
vrt workflow introspect
vrt workflow spec-verify
vrt workflow expect
```

If `vrt.config.json` defines `routes`, the built-in capture spec uses those routes instead of the repo-local defaults.

The PR workflow also runs a deterministic snapshot false-positive check against `fixtures/css-challenge` using `.github/vrt-snapshot-ci.config.json`.
It creates baselines once, re-runs the same URLs, and summarizes `test-results/snapshots/ci/snapshot-report.json` with `vrt snapshot report`.

For migration workflows, `vrt migration subagent` packages the highest-impact diff per variant into a prompt for an external fixer, then compares before/after `migration-report.json` files to measure resolved/improved success rates.
Blind migration scenarios are declared in `fixtures/migration/blind-scenarios.json`, including the existing reset-css blind target and a scaffolded `shadcn-to-luna/after-blind.html` target for reproducible E3 runs. `vrt migration blind` supports `list`, `show`, `prepare`, `solo`, and `evaluate` so the blind run can emit a fresh compare report, generate a fixer packet, run a deterministic reference-CSS repair, and check the `diff < 1% within 3 rounds` contract without hand-assembling paths.

Workflow aliases are kept for ergonomics where they do not collide:

- `vrt init`, `vrt capture`, `vrt verify`, `vrt approve`
- `vrt graph`, `vrt affected`, `vrt introspect`, `vrt spec-verify`, `vrt expect`

`vrt report` remains the detection pattern report, so verification output lives under `vrt workflow report`.

#### Capture routes for external projects

`vrt workflow init|capture` runs `e2e/vrt-capture.spec.ts`, which now resolves
its route list from your project rather than hard-coding vrt's own pages.
Drop a `vrt.config.json` next to your app with a `capture` block:

```json
{
  "baseUrl": "http://localhost:3000",
  "capture": {
    "routes": [
      { "name": "home", "path": "/", "waitFor": "main" },
      { "name": "about", "path": "/about" },
      "/contact"
    ]
  }
}
```

Each route accepts `name` (defaults to a sanitized form of `path`), `path`, and
an optional `waitFor` CSS selector. Resolution order:

1. `VRT_CAPTURE_ROUTES` env var (JSON-encoded array)
2. `--config <path>` flag or `VRT_CONFIG_PATH` env var
3. `vrt.config.json` auto-discovered in the working directory
4. Built-in defaults (vrt's own UI — useful only when developing vrt itself)

```bash
# External project usage
vrt workflow init --config ./vrt.config.json --base-url http://localhost:5173
vrt workflow capture --config ./vrt.config.json
vrt workflow verify
```

### API Commands

```bash
vrt api serve [--port 3456]                # Start HTTP API server
vrt api status [--url http://localhost:3456]
```

Compatibility aliases:

- `vrt serve` -> `vrt api serve`
- `vrt status` -> `vrt api status`

## HTTP API

Start the server:

```bash
vrt api serve --port 3456
```

The shared Hono app also exposes a Cloudflare Workers entry point at `worker/index.ts`.

Available endpoints:

- `GET /api/openapi.json` — OpenAPI 3.1 spec for the current HTTP surface
- `GET /api/status` — server version, backends, and capabilities
- `POST /api/compare` — compare baseline/current HTML or URLs across viewports
- `POST /api/compare-renderers` — compare Chromium vs Crater rendering
- `POST /api/reason` — VLM/LLM reasoning pipeline for diff analysis and fixes
- `POST /api/smoke-test` — random or reasoning-guided a11y smoke test

When running on Workers, `/api/status` also reports detected `R2` / `KV` / `D1` storage bindings.

TypeScript client:

```ts
import { VrtClient } from "@mizchi/vrt/client";

const client = new VrtClient("http://localhost:3456");
const status = await client.status();
const result = await client.compareHtml(
  "<main><button>Before</button></main>",
  "<main><button class='primary'>After</button></main>",
);
```

Install: `pnpm add @mizchi/vrt`

`compareUrls(...)` is intended for public HTTP(S) targets. The API server rejects localhost and private-network URLs.

## Architecture

```
HTML (file or URL)
    │
    ├── Pixel diff (pixelmatch v7 → heatmap → diff ratio)
    ├── Computed style diff (getComputedStyle → property-level changes)
    ├── A11y tree diff (accessibility snapshot → structural changes)
    └── Paint tree diff (Crater BiDi → layout tree comparison)
          │
          ▼
    Detection & Classification
          │
          ▼
    AI Fix Pipeline (optional)
      Stage 1: VLM (cheap) → structured CHANGE report
      Stage 2: LLM (accurate) → CSS fix suggestions
          │
          ▼
    Dry-run verification → rollback if worse
```

## Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `VRT_LLM_PROVIDER` | LLM provider | gemini |
| `VRT_LLM_MODEL` | LLM model | provider default |
| `VRT_VLM_MODEL` | VLM model (OpenRouter) | qwen/qwen3-vl-8b-instruct |
| `OPENROUTER_API_KEY` | OpenRouter API key | — |
| `GEMINI_API_KEY` | Google AI API key | — |
| `ANTHROPIC_API_KEY` | Anthropic API key | — |

## Project Structure

```
src/
  vrt.ts                    # Unified public CLI entry point
  vrt-command-router.ts     # Root command routing + usage text
  vrt-cli.ts                # Stateful workflow CLI
  vrt-client.ts             # TypeScript client for the HTTP API
  snapshot.ts               # URL snapshot + baseline diff
  migration-compare.ts      # HTML/URL comparison across viewports
  css-challenge-bench.ts    # CSS deletion/recovery benchmark
  fix-loop.ts               # AI-powered CSS fix loop
  vrt-reasoning-pipeline.ts # 2-stage VLM + LLM pipeline
  heatmap.ts                # Pixel diff + heatmap generation
  mask.ts                   # Selector-based visibility masking
  vlm-client.ts             # OpenRouter / Gemini VLM client
  llm-client.ts             # Multi-provider LLM client
  crater-client.ts          # Crater BiDi WebSocket client
  api-server.ts             # Hono API server
fixtures/
  css-challenge/            # 9 HTML fixtures for CSS bench
  migration/                # Migration comparison fixtures
docs/
  knowledge.md              # Accumulated experimental findings
  reports/                  # Dated experiment reports
```

## Agent Skills (APM)

vrt ships five coding-agent skills under `.claude/skills/`. They wrap
the most common workflows as standalone, agent-readable playbooks.
Other repos can install them via [APM](https://agentskills.io):

```bash
# Install a single skill into the current repo's .claude/skills/
apm install mizchi/vrt/.claude/skills/vrt-visual-diff

# Install all five
apm install mizchi/vrt/.claude/skills/vrt-visual-diff \
            mizchi/vrt/.claude/skills/vrt-migration-eval \
            mizchi/vrt/.claude/skills/vrt-css-fix-loop \
            mizchi/vrt/.claude/skills/vrt-markup-synth \
            mizchi/vrt/.claude/skills/vrt-regression-watch
```

| Skill | Entry workflow | Use when |
|---|---|---|
| `vrt-visual-diff` | `vrt diff html` → `vrt diff agent` | One-shot "did this CSS edit visibly change something?" |
| `vrt-migration-eval` | `vrt migration compare\|blind\|subagent` | Framework / CSS-lib / build-system swap audit |
| `vrt-css-fix-loop` | `fix-loop.ts` (VLM-driven) | Closed-loop CSS auto-repair benchmark |
| `vrt-markup-synth` | `vrt build\|scan\|check\|stress *` | Screenshot → HTML/CSS, token / theme / i18n audits |
| `vrt-regression-watch` | `vrt diff agent --previous --fail-on-regression` | Per-PR or scheduled regression gate |

Each skill assumes the `vrt` CLI is on `$PATH` (this repo published as
a Node package, or built from source) and Node 24+. VLM-using skills
(`fix-loop`, `markup-synth`, `migration subagent`) additionally need
one of `OPENROUTER_API_KEY` / `GEMINI_API_KEY` / `ANTHROPIC_API_KEY`
depending on the model selected via `VRT_VLM_MODEL`.

## License

MIT
