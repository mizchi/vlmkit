# @mizchi/vlmkit-mcp

MCP server exposing vlmkit's **deterministic** (no-VLM) verification
gates as tools, so any MCP client / coding agent can gate generated or
edited UI on them.

## Run

```bash
vlmkit mcp                 # stdio server
# or: node --experimental-strip-types packages/vlmkit-mcp/src/stdio.ts
```

Client config (stdio):

```json
{ "command": "vlmkit", "args": ["mcp"] }
```

## Tools

| Tool | What it gates | Key inputs |
|------|----------------|-----------|
| `verify_markup` | done-condition verdict + paste-ready kickback (selector attribution, kind tags, near-miss, pixel-confirmed demotion) | `attempt`, `targets[]`, `reference?` |
| `check_interactions` | a11y-event state map; `reference` makes it a behavioral contract; `handlers` adds the wired-callback surface | `source`, `reference?`, `handlers?` |
| `scan_handlers` | every wired callback + **pointer-only-control** detection | `source` |
| `check_copy` | placeholder scan + `manifest` verification + `target`-image contact sheets | `source`, `manifest?`, `target?` |

## Design

Thin JSON-in/out wrappers over the same pure functions the CLI calls —
no behavior fork. Path inputs (no base64); Playwright is dynamic-imported
inside the pure functions. A result's `isError` is true when the gate
failed; the kickback text is the next-fix list. A residual is real
unless the tool itself marks it demoted/pixel-confirmed.

See `docs/design/mcp-and-agent-expansion.md`.
