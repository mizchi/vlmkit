# vlmkit configuration

Setup and configuration reference. The README covers the two-minute
version; this page has everything else.

## Install

```bash
npm install -D @mizchi/vlmkit     # per project (use with npx vlmkit …)
npm install -g @mizchi/vlmkit     # or global
npx playwright install chromium   # once, if you don't have a Playwright Chromium
```

Requires Node 24+. Every gate is deterministic and key-free; only the
`[key]`-marked features (LLM/VLM assists such as `heal markup` or
`check copy --vlm`) need one of the API keys below.

vlmkit uses the project's `playwright` through a required peer dependency and
accepts an existing `@playwright/test` through an optional peer. In a project
that already has the test runner, the CLI resolves its Playwright installation
and browser build. If the browser is missing, the error names the resolved
Playwright version and prints a command targeting that installation directly.

## URL loading and deterministic network replay

`check integrity` and `check design` default to a 30-second `networkidle`
navigation. Data-driven pages with polling or a long-lived request can choose a
different milestone and timeout:

```bash
npx vlmkit check integrity http://localhost:3000/ \
  --wait-until domcontentloaded --timeout 60000
```

For reproducible third-party responses, record a HAR with Playwright and replay
it during the gate. Requests absent from the HAR are aborted rather than sent to
the live network:

```bash
npx vlmkit check integrity http://localhost:3000/ --har fixtures/app.har
npx vlmkit check design http://localhost:3000/ --har fixtures/app.har
```

`check design` can omit vendor-owned DOM before it computes component reuse and
spacing. Exclusions are repeatable and remain visible in text and JSON reports;
a selector that matches nothing is warned as stale:

```bash
npx vlmkit check design http://localhost:3000/ \
  --exclude ".maplibregl-ctrl" --exclude ".third-party-player"
```

## MCP server (for Claude Code / any MCP client)

`.mcp.json` in your project:

```json
{
  "mcpServers": {
    "vlmkit": { "command": "npx", "args": ["-y", "@mizchi/vlmkit", "mcp"] }
  }
}
```

Nine gates become tools (`verify_markup`, `check_integrity`,
`check_copy`, `check_interactions`, `scan_handlers`, `build_page`,
`check_layout`, `check_equivalence`, `verify_flow`). Tool table:
[`packages/vlmkit-mcp/README.md`](../packages/vlmkit-mcp/README.md).

## Agent skill

Copy `.claude/skills/markup-assist/` into your project's
`.claude/skills/` — a self-contained generalist skill that teaches an
agent the task routing and the fix-loop discipline (assumes only that
`npx vlmkit` runs).

## Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `VLMKIT_LLM_PROVIDER` | LLM provider | gemini |
| `VLMKIT_LLM_MODEL` | LLM model | provider default |
| `VLMKIT_VLM_MODEL` | VLM model (OpenRouter) | qwen/qwen3-vl-8b-instruct |
| `VLMKIT_BASE_URL` | Base URL for workflow capture | — |
| `VLMKIT_CAPTURE_BACKEND` | Capture backend override | playwright |
| `VLMKIT_CONFIG_PATH` / `VLMKIT_CONFIG_FILE` | Config path override | — |
| `VLMKIT_PROJECT_ROOT` | Project root override | cwd |
| `OPENROUTER_API_KEY` | OpenRouter API key | — |
| `GEMINI_API_KEY` | Google AI API key | — |
| `ANTHROPIC_API_KEY` | Anthropic API key | — |
| `VLMKIT_CRATER_BIDI_URL` | Crater BiDi WebSocket URL, including `/session/...` when required | `ws://127.0.0.1:9222` |
| `VLMKIT_CRATER_ROOT` | Crater checkout containing `.bidi-ws-url` from `just start-bidi-with-font` | — |
| `VLMKIT_CRATER_WASM_MODULE` | Crater layout JS/WASM module path for `POST /api/crater/layout` | — |

Only the `VLMKIT_*` names are supported. Project state is written below
`.vlmkit/`, and snapshot/workflow configuration is loaded from
`vlmkit.config.json` or `vlmkit.config.toml`.

## Snapshot / CI configuration

Snapshot targets, thresholds, and per-route CI gates live in
`vlmkit.config.json` (`vlmkit workflow init` scaffolds one); approval
rules for intentional deviations live in `approval.json`
(`vlmkit manifest`). See the [CLI reference](./cli-reference.md) for
the snapshot, workflow, and diff-pr sections.

## Agent Skills (APM)

vlmkit ships twelve coding-agent skills under `.claude/skills/`. They wrap
the most common workflows as standalone, agent-readable playbooks.
Other repos can install them via [APM](https://agentskills.io):

```bash
# Install a single skill into the current repo's .claude/skills/
apm install mizchi/vlmkit/.claude/skills/vrt-visual-diff
```

| Skill | Entry workflow | Use when |
|---|---|---|
| `markup-assist` | `vlmkit check integrity\|copy\|layout\|breakpoints\|…` | Generalist: edited markup, no reference, want the smallest correctness gate |
| `mock-markup` | `vlmkit scan mock` → `verify markup` loop | Implement from a Figma export or retina screenshot with no reference HTML |
| `vrt-visual-diff` | `vlmkit diff html` → `vlmkit diff agent` | One-shot "did this CSS edit visibly change something?" |
| `vrt-migration-eval` | `vlmkit migration compare\|blind\|subagent` | Framework / CSS-lib / build-system swap audit |
| `vrt-css-fix-loop` | `fix-loop.ts` (VLM-driven) | Closed-loop CSS auto-repair benchmark |
| `vrt-markup-synth` | `vlmkit build\|scan\|check\|stress *` | Screenshot → HTML/CSS, token / theme / i18n audits |
| `vrt-regression-watch` | `vlmkit diff agent --previous --fail-on-regression` | Per-PR or scheduled regression gate |
| `spec-to-playwright` | `init-agents` or `@mizchi/vlmkit-plan/generate` → deterministic VRT → `@mizchi/vlmkit-heal` | Spec → Playwright test with stable VRT + self-healing |
| `auto-markup` | `check palette` → `contract scaffold` → `build page\|component` loop | Rebuild a page from a target screenshot, agent-as-VLM, no API key |
| `dynamic-markup` | auto-markup + gates: `check breakpoints` / `scan scroll` / `check animation\|motion` | Markup whose spec includes breakpoints, scrollports, animations |
| `component-vrt` | `vlmkit check story --gallery <url>` | Repair one component with a component-sized diff; includes gallery templates (vanilla / React / Vue) |
| `agent-validation-loop` | disposable subagent runs → friction → fix → re-run | Harden a CLI/library by measuring whether agents can drive it |

Each skill assumes the `vlmkit` CLI is on `$PATH` (this repo published as
a Node package, or built from source) and Node 24+. VLM-using skills
(`fix-loop`, `markup-synth`, `migration subagent`) additionally need
one of `OPENROUTER_API_KEY` / `GEMINI_API_KEY` / `ANTHROPIC_API_KEY`
depending on the model selected via `VLMKIT_VLM_MODEL`. `auto-markup` and
`dynamic-markup` need no key: the driving agent's own vision is the VLM
and every measurement tool is deterministic (Playwright + pixel math).
