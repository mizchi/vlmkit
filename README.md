# vlmkit

Deterministic verification toolkit for frontend work: markup gates
(broken-page scan, copy fidelity, responsive boundaries, keyboard
operability, scripted flows), visual regression over time, design
audits, and repair tools. Built for humans and coding agents alike —
every failing gate prints a machine-parsable fix list. Everything is
key-free unless marked `[key]`.

Requires Node 24+.

## Quickstart — visual analysis with zero context

```bash
npm install -D @mizchi/vlmkit
npx playwright install chromium          # once

# 1. find concrete visual defects on the page you're working on
#    (no reference, no config, no API key — 3 viewports at once)
npx vlmkit check integrity http://localhost:3000/
#    -> verdict: DEFECTS … [page-overflow-x] @768: … main > p (right edge 924px)
#                          [text-collision] @1280: "Total: €1,240" overlaps "Refunds: €80"
#    fix what it names, re-run until: verdict: CLEAN

#    long-polling page: choose an earlier navigation milestone
npx vlmkit check integrity http://localhost:3000/ --wait-until domcontentloaded

# 2. track what your edits change visually (1st run = baseline, then diffs)
npx vlmkit snapshot http://localhost:3000/ --output .vlmkit/snapshots
#    -> desktop 13.11% … mobile 6.57% + diff heatmaps next to the report
#    intended? npx vlmkit snapshot approve --output .vlmkit/snapshots
```

From there: `check copy --manifest` (exact copy), `check breakpoints
--sweep` (responsive boundaries), `check interactions` (keyboard
operability), `verify markup --target design.png` (match a design) —
the full task-routing table, done-condition recipes, and agent
integration (MCP server + `markup-assist` skill) live in
**[`docs/markup-assist.md`](./docs/markup-assist.md)**.

## Setup

```bash
npm install -D @mizchi/vlmkit     # or -g
npx playwright install chromium   # once
```

vlmkit declares `playwright` as a peer and `@playwright/test` as an optional
peer, reusing the versions already selected by the project instead of
installing a second browser build.

- **Coding agents (MCP)** — `.mcp.json`:
  `{ "mcpServers": { "vlmkit": { "command": "npx", "args": ["-y", "@mizchi/vlmkit", "mcp"] } } }`
- **Agent skill** — install the automatic `vlmkit` router once with APM or the
  open `skills` CLI (commands below), then ask for the result in natural language.
- **API keys** — only for `[key]` features (`heal markup`,
  `check copy --vlm`, fix-loop): `OPENROUTER_API_KEY` /
  `GEMINI_API_KEY` / `ANTHROPIC_API_KEY`.
- **Snapshot / CI config** — `vlmkit.config.json` (routes, thresholds)
  via `vlmkit workflow init`.

Full setup detail: [`docs/configuration.md`](./docs/configuration.md).

### Install agent skills

Recommended: install the `vlmkit` skill package once. You do not choose a
specialized skill; the agent classifies each frontend request, loads the
matching bundled workflow, runs its deterministic gates, fixes failures, and
reruns to green.

```bash
# Install or update APM (macOS / Linux)
curl -sSL https://aka.ms/apm-unix | sh

# Install vlmkit with APM
apm install mizchi/vlmkit

# Or install with the skills CLI (APM is not required)
npx skills add mizchi/vlmkit
```

The APM bootstrap above is the [official recommended installer](https://microsoft.github.io/apm/getting-started/installation/)
and resolves the latest binary for the current platform. It avoids depending on
a stale package-manager formula.

Then ask naturally: “implement this mock,” “check this page's responsive and
keyboard behavior,” or “turn this story into stable Playwright tests.” There is
no skill-selection step in the normal workflow. On first use, the agent detects
the repository's package manager, reuses or adds `@mizchi/vlmkit` locally, and
installs Chromium only if a selected gate reports it missing.

Both installers expose one visible `vlmkit` skill. The 11 specialized workflows
are internal resources bundled under that entry, so the agent selects them
without adding 11 separate skills or copying the vlmkit source repository.

See the [agent skill catalog](./.claude/skills/README.md) for all 11
specialized skills, grouped by general verification, UI creation, test
generation, comparison and monitoring, and evaluation and hardening.

## When to use what

`vlmkit --help` prints this same map. Everything is key-free unless
marked `[key]`.

| You want to… | Reach for |
|---|---|
| Check the page you just wrote/edited, no reference | `check integrity` (broken-page scan, 3 viewports) · `check copy --manifest` (copy present, visibly, verbatim) · `check layout --contract` · `scan scroll` / `scan handlers` |
| Verify behavior, not pixels | `check breakpoints --sweep` · `check interactions` · `check scroll` / `check animation` · `verify flow --flow` |
| Match a target design | `verify markup --target` (done verdict + fix list) · `build page` / `build component` · `scan mock` (normalize @2x exports) |
| Track changes over time (VRT) | `snapshot` (baseline → per-viewport diff → `snapshot approve`) · `watch` · `diff-pr` · `baseline` |
| Compare two versions | `diff html\|png\|elements` · `migration compare` · `check equivalence --region` |
| Audit design quality | `check tokens\|theme\|palette` · `check design` (is the page consistent with itself — one button style or six) · `check a11y contrast\|touch\|focus` · `check perf` · `check drift` · `stress i18n\|media` |
| Vet an image asset before it enters a slot | `check asset --slot --expect-transparent --against-bg --page-palette` |
| Repair | `heal selector` (dead selector) · `heal markup` `[key]` (LLM auto-fix from a kickback) |
| Run gates over a whole site | `batch --gate "check integrity" "routes/**/*.html"` (parallel, `--shard i/n`, per-job timing) · `gates run` (same, from one reviewed config) |
| Audit what has been silenced | `gates suppressions` — every suppression with reason, owner, expiry; expired ones stop applying |
| Wire into agents / pipelines | `mcp` (gate tools over stdio) · `contract` · `workflow` · `markup-loop` · `api` · `bench` · `skill` |

Task-routing recipes and done-condition sets:
[`docs/markup-assist.md`](./docs/markup-assist.md).

## The workspace, drawn by itself

![vlmkit — the workspace and its dependencies](./docs/diagrams/vlmkit-architecture.gif)

Eleven packages, layer by layer from `core` to the CLI, generated from the manifests by
`vlmkit-anim repo` ([every step](./docs/diagrams/vlmkit-architecture.sheet.png), regenerate with
`pnpm anim:diagrams`). Every pull request gets the same treatment: the `pr-visual` workflow
runs `vlmkit-anim pr` and posts the change map — one beat per commit, the areas it touched,
the imports between them — as a comment on the PR.

## Documentation

| Doc | Contents |
|---|---|
| [`docs/introduce.md`](./docs/introduce.md) | What is vlmkit? — narrative introduction assuming zero context |
| [`docs/markup-assist.md`](./docs/markup-assist.md) | Task-routing guide: which gate for which job, done-condition recipes, anti-gaming rules |
| [`docs/cli-reference.md`](./docs/cli-reference.md) | Complete command reference: all groups, examples, workflow/API/HTTP, architecture, project structure |
| [`docs/configuration.md`](./docs/configuration.md) | Install, MCP/skill setup, environment variables, snapshot/CI config, agent skills catalog |
| [`packages/vlmkit-mcp/README.md`](./packages/vlmkit-mcp/README.md) | MCP tool table |
| [`docs/knowledge.md`](./docs/knowledge.md) · [`docs/reports/`](./docs/reports/) | Accumulated evaluation findings and dated experiment reports |
| [`CHANGELOG.md`](./CHANGELOG.md) | Release notes, including the 0.4.x → current command mapping |

## License

MIT
