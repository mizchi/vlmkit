# spec-to-playwright

Agent skill for turning a natural-language product spec into deterministic
Playwright tests with VRT baselines and a bounded heal step. It layers local
rules and assets on top of the official Playwright Test Agents:

```text
planner -> generator -> optional Playwright healer -> CI baseline/verify -> @mizchi/vlmkit-heal
```

Install into another repo with APM:

```bash
apm install mizchi/vlmkit/.claude/skills/spec-to-playwright
```

Use `npx playwright init-agents --loop=codex` for Codex projects. Use
`--loop=claude`, `--loop=vscode`, or `--loop=opencode` for those runtimes.
Regenerate the Playwright agent definitions whenever Playwright is updated.
When official agents are unavailable, `@mizchi/vlmkit-plan` and
`@mizchi/vlmkit-generate` provide runtime-neutral planner/generator contracts for
the same `specs/<topic>.md` and `tests/<topic>.spec.ts` artifacts; use the
`vlmkit-plan` and `vlmkit-generate` CLIs for a file-based workflow:

```bash
vlmkit-plan --title "<topic>" --request-file specs/<topic>.request.md \
  --observations specs/<topic>.observations.json --out specs/<topic>.md \
  --locator-inventory-out specs/<topic>.locators.json
vlmkit-generate --plan specs/<topic>.md --rules specs/_generation-rules.md \
  --locator-inventory specs/<topic>.locators.json --out tests/<topic>.spec.ts \
  --overwrite --gate-command "pnpm exec playwright test --list {testFile}"
```

## Assets

- `assets/_helpers.ts` - deterministic `gotoApp()` helper for VRT.
- `assets/seed.spec.ts` - seed test template for planner context.
- `assets/_generation-rules.md` - rules the generator must obey.
- `assets/playwright.config.preset.ts` - deterministic Playwright config preset.
- `assets/ci.yml` - CI verification workflow.
- `assets/update-baselines.yml` - CI-rendered baseline update workflow.
- `assets/vrt-review.mjs` - VRT accept/reject reviewer.
- `assets/vrt-review-ci.yml` - PR workflow for model-assisted baseline review.

See `SKILL.md` for the exact staged workflow and
`docs/spec-to-playwright-skill-design.md` for the design rationale.
