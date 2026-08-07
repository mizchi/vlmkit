# @mizchi/vlmkit-mcp

MCP server exposing vlmkit's **deterministic** (no-VLM) verification
gates as tools, so any MCP client / coding agent can gate generated or
edited UI on them.

Drop-in usage guide (routing table, done-condition recipes, CLI
equivalents): [`docs/markup-assist.md`](../../docs/markup-assist.md).

## Run

```bash
vlmkit mcp                 # stdio server
# or: node --experimental-strip-types packages/vlmkit-mcp/src/stdio.ts
```

Client config (stdio) — e.g. `.mcp.json` in any project:

```json
{
  "mcpServers": {
    "vlmkit": { "command": "npx", "args": ["-y", "@mizchi/vlmkit", "mcp"] }
  }
}
```

## Tools

| Tool | What it gates | Key inputs |
|------|----------------|-----------|
| `verify_markup` | done-condition verdict + paste-ready kickback (selector attribution, kind tags, near-miss, pixel-confirmed demotion) | `attempt`, `targets[]`, `reference?` |
| `check_interactions` | a11y-event state map; `reference` makes it a behavioral contract; `handlers` adds the wired-callback surface | `source`, `reference?`, `handlers?` |
| `scan_handlers` | every wired callback + **pointer-only-control** detection | `source` |
| `check_integrity` | reference-free defect gate: JS errors, empty render, broken resources, text collision/clipping/protrusion, collapsed containers, overflow, invisible text, near-misalignment, unstyled page (multi-viewport; intentional patterns reported in `exempted`) | `source`, `viewports?` |
| `check_layout` | layout contract: widths, per-row counts, stacking order, visibility per viewport — a brief's structural requirements as a machine-checkable spec | `source`, `contract` |
| `check_copy` | placeholder scan + `manifest` verification against VISIBLY rendered text (disclosure-state sweep; invisible matches report `copy-invisible` with a reason class, suppressible per class via `allowInvisible`) + `target`-image contact sheets | `source`, `manifest?`, `target?`, `allowInvisible?` |
| `build_page` | raw composition diff (matched/missing/extra/ordering/gap) | `target`, `current` |
| `build_gallery` | converged page → story gallery + per-story threshold derived from each component's area; the construction → maintenance handoff. Discovery proposes (evidence per candidate); `selectors` overrides it | `source`, `out?`, `selectors[]?` |
| `check_story` | one mounted component vs its approved baseline — a component-sized diff that does not cascade to neighbours. Needs a gallery (`build_gallery` makes one) | `story`, `gallery`, `threshold?` |
| `check_equivalence` | measured per-channel delta + pair images for a second reader (keyless advisory) | `source`, `target`, `regions[]` |
| `verify_flow` | scripted browser flow: action → deterministic post-condition assert; fails at first unmet | `source`, `flow` |

## Design

Thin JSON-in/out wrappers over the same pure functions the CLI calls —
no behavior fork. Path inputs (no base64); Playwright is dynamic-imported
inside the pure functions. A result's `isError` is true when the gate
failed; the kickback text is the next-fix list. A residual is real
unless the tool itself marks it demoted/pixel-confirmed.

See `docs/design/mcp-and-agent-expansion.md`.
