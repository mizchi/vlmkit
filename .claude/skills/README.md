# vlmkit agent skills

vlmkit ships one automatic router backed by 11 specialized workflows.
Install once, then describe the outcome you want in ordinary language. The
agent picks the workflow whose inputs and done condition match the task.

## Start here

### [`vlmkit`](../../SKILL.md) — automatic entry

This is the recommended setup. You do not need to learn or name the skills
below: the root `vlmkit` skill is discovered for frontend work, classifies the
request, reads the matching bundled workflow, and runs its deterministic gates
to green.

```bash
# APM
apm install mizchi/vlmkit

# skills CLI
npx skills add mizchi/vlmkit
```

After that, ask naturally—for example:

- “Implement this mock and make it responsive.”
- “Check this page for broken layout, copy, and keyboard behavior.”
- “Turn these acceptance criteria into stable Playwright tests.”

The user does not select a skill. The agent routes these requests to
`mock-markup` + `dynamic-markup`, `markup-assist`, and `spec-to-playwright`
respectively.

## How automatic routing works

1. Agent skill discovery matches frontend work to the broad `vlmkit`
   description.
2. The root router selects one primary workflow from the request and artifacts.
3. It loads that workflow from the files bundled inside the installed skill.
4. On first use, it reuses or adds the project-local `@mizchi/vlmkit` CLI and
   installs Chromium only if Playwright reports it missing.
5. It executes the gates, fixes failures, and reruns until the workflow's done
   condition is green.

If no stronger signal exists, ordinary HTML/CSS work defaults to
`markup-assist`. The router asks only for a genuinely missing artifact, never
which skill the user wants.

## Skill classes

| Class | Choose it when… | Skills | What it can do |
|---|---|---|---|
| General verification | You edited HTML/CSS and need a fast correctness loop | [`markup-assist`](./markup-assist/) | Select an integrity, copy, layout, responsive, interaction, a11y, or design gate; read kickback; fix; rerun to green |
| UI creation | The task starts from an image, reference, contract, or behavior brief | [`mock-markup`](./mock-markup/), [`auto-markup`](./auto-markup/), [`dynamic-markup`](./dynamic-markup/) | Normalize raw mock exports; recreate static HTML/CSS; verify responsive, scrolling, interaction, and motion behavior |
| Test generation | A natural-language story must become a reproducible browser test | [`spec-to-playwright`](./spec-to-playwright/) | Explore the app, generate Playwright tests, stabilize VRT, run CI gates, and heal drift |
| Comparison and monitoring | Two renders or repeated runs must be compared | [`vrt-markup-synth`](./vrt-markup-synth/), [`vrt-visual-diff`](./vrt-visual-diff/), [`vrt-regression-watch`](./vrt-regression-watch/), [`vrt-migration-eval`](./vrt-migration-eval/) | Produce deterministic authoring signals, explain visual deltas, detect regressions over time, and evaluate framework/CSS migrations |
| Evaluation and hardening | You are measuring the repair system or the agent-facing tool itself | [`vrt-css-fix-loop`](./vrt-css-fix-loop/), [`agent-validation-loop`](./agent-validation-loop/) | Benchmark VLM+LLM CSS recovery on known fixtures and improve tool ergonomics with fresh-agent validation loops |

## Selection rules

- No reference, just edited markup → `markup-assist`.
- Raw Figma export, retina screenshot, or competitor capture → `mock-markup`.
- Target screenshot or UI Contract IR → `auto-markup`.
- Responsive, scroll, interaction, or animation requirements → `dynamic-markup`.
- Natural-language acceptance criteria → `spec-to-playwright`.
- One baseline/variant comparison → `vrt-visual-diff`; recurring CI history → `vrt-regression-watch`.
- Framework, CSS-library, or build-system swap → `vrt-migration-eval`.
- Component, token, theme, or i18n authoring signal → `vrt-markup-synth`.
- Known CSS deletion benchmark → `vrt-css-fix-loop`.
- Agent-facing CLI or harness usability study → `agent-validation-loop`.

## Advanced: install a specialized skill directly

Direct installation is optional. Use it only when you intentionally want to
pin an agent to one workflow and bypass automatic routing:

```bash
# APM example
apm install mizchi/vlmkit/.claude/skills/markup-assist

# skills CLI example
npx skills add https://github.com/mizchi/vlmkit/tree/main/.claude/skills/markup-assist
```

The skills CLI can also discover the full specialist catalog:

```bash
npx skills add https://github.com/mizchi/vlmkit/tree/main/.claude/skills --list
```
