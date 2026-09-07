# Log: vlmkit workspace module map

## Round 1: Initial attempt
- Command: `pnpm exec vlmkit-anim check scene.json --expect facts/modules-this-workspace.expect.json`
- Result: 0 errors, 2 warnings
- Issue: Group labels "Measurement & Capture" and "Integration" had edges running through them (15px and 16px respectively)
- Change: Shortened all group labels to reduce label width and avoid edge collisions
  - "Foundation" → "Core"
  - "AI Services" → "AI/LLM"
  - "Measurement & Capture" → "Measurement"
  - "Synthesis & Healing" → "Synthesis"
  - "Integration" → "MCP"

## Round 2: Validation
- Command: `pnpm exec vlmkit-anim check scene.json --expect facts/modules-this-workspace.expect.json`
- Result: 0 errors, 0 warnings ✓
- Layout check: 0 frames with layout issues, 0 crossed labels ✓
- Rendered map.svg with `vlmkit-anim still`

## Summary

### Initial check result
First `check --expect` result: 0 ✗ count, 2 ⚠ count. The two warnings came from layout geometry, not from the fact sheet itself. The fact sheet validation passed perfectly on first try — all 11 modules and 26 dependencies matched exactly.

### Rounds used
- Round 1: Fixed layout warnings by shortening group labels
- Round 2: Validated final result with 0 errors and 0 warnings

### What the fact sheet revealed
The fact sheet showed exactly which modules must be present and which dependencies must be drawn:
```
"modules": ["core", "ai", "capture", "animation-eval", "generate", "heal", "markup", "mcp", "plan", "anim", "vlmkit"]
```
This confirmed I had all 11 modules (including the root package as "vlmkit", not "@mizchi/vlmkit"). Without `check --expect`, I could have misspelled module names or missed a dependency. The fact sheet prevented errors that the generic `check` alone would not have caught — it only validates the scene is well-formed, not that it says the right thing about the actual workspace.

### What did not help or was confusing
The guide section "Checking a figure against the facts" gave the format I needed (`vlmkit-anim check scene.json --expect facts.json`), but did not explain where the fact sheet came from. I had to infer from the brief that package.json files were the source. The schema for `expect` format (accessed via `vlmkit-anim schema --kind expect`) was not called out in the writing guide; I had to discover it by running the command myself after reading the documentation.

### How I decided the groups
I read each `package.json` file under `packages/*/` and the root `package.json` to extract workspace dependencies. I noted which modules had `peerDependencies` on `playwright` to identify browser-bound code:

Browser-bound (have playwright peer):
- core, capture, animation-eval, heal, markup, anim

Pure (no playwright):
- ai, generate, mcp, plan

I grouped them by their role in the system:
1. **Core**: `core` — the image/CSS/DOM/a11y diff engine at the foundation
2. **AI/LLM**: `ai`, `plan`, `generate` — LLM/VLM clients (pure, no browser)
3. **Measurement**: `capture`, `animation-eval` — browser-based measurement and animation evaluation
4. **Synthesis**: `heal`, `markup`, `anim` — higher-level tools for healing CSS and generating markup (browser-bound)
5. **MCP**: `mcp` — MCP protocol integration wrapping core + markup
6. **CLI**: `vlmkit` — the CLI entry point that depends on all packages

This organization reflects both the dependency layers (core at the bottom, everything else depends on it) and a functional grouping that a contributor would recognize: foundation, services, measurement, synthesis, integration, and CLI.

### Hand-typed values
- No coordinates: the layout generated all node positions automatically
- No colours: the default theme was used throughout
- Canvas size: not explicitly set; the tool computed it based on the graph structure
- Group labels: shortened to prevent edge crossings (5 labels shortened from longer English phrases)

### What would have been done differently
Nothing fundamental. The layout worked well once the label widths were reduced. The tool's automatic layering correctly placed core at the bottom, ai-services and capture in the middle, synthesis and mcp in the next layers, and vlmkit at the top. The edge routing avoided unnecessary crossings after labels were shortened. If I could have expressed anything more, it would be: pin the position of the vlmkit module at the top center, but that is not necessary — the result is already clear and well-ordered.

