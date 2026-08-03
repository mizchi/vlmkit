# vlmkit agent skills

vlmkit ships 11 specialized skills. They are workflows, not aliases for the
same command: choose the smallest skill whose inputs and done condition match
the task.

## Start here

### [`vlmkit`](../../SKILL.md) — meta entry

Use the root `vlmkit` skill when you do not yet know which workflow applies.
It classifies the request, selects one primary specialized skill, and routes
the agent to the matching deterministic gates.

```bash
# APM
apm install mizchi/vlmkit

# skills CLI
npx skills add mizchi/vlmkit
```

For a routine HTML/CSS edit with no reference design, skip the meta step and
use [`markup-assist`](./markup-assist/) directly.

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

## Install a specialized skill

Install only the workflow you want:

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
