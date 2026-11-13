# Documentation index

Every document under `docs/`, by what it is for. **Reference** pages describe vlmkit as it is and
are kept current; several are held to the CLI by tests. **Design** pages explain why something was
built the way it was. **History** pages record plans, explorations and reviews from earlier
versions: command names, paths and counts in them may be out of date, and they are kept because
the reasoning still matters.

## Start here

| Doc | What it is |
|---|---|
| [`features.md`](./features.md) | Every command, one line each, grouped by the question it answers. A test fails when a command is missing |
| [`introduce.md`](./introduce.md) · [`introduce.ja.md`](./introduce.ja.md) | A narrative introduction for someone with no context |
| [`markup-assist.md`](./markup-assist.md) | Which gate for which job, done-condition recipes, anti-gaming rules |

## Reference

| Doc | What it is |
|---|---|
| [`cli-reference.md`](./cli-reference.md) | Every command and flag, with examples. Its flags and verbs are checked against the CLI |
| [`configuration.md`](./configuration.md) | Install, MCP and skill setup, environment variables, snapshot and CI config |
| [`a11y-tree.md`](./a11y-tree.md) | The `vlmkit-a11y/1` contract for apps with no DOM, and how to write a collector |
| [`authoring-gates.md`](./authoring-gates.md) | Adding a gate of your own: the contract field by field, testing, publishing |
| [`knowledge.md`](./knowledge.md) | Accumulated findings: detection rates, model comparisons, fix patterns |
| [`reports/`](./reports/) | Dated experiment and evaluation reports, the evidence behind the numbers elsewhere |
| [`crater-css-status.md`](./crater-css-status.md) | Which CSS the Crater renderer supports |
| [`reset-css-comparison.md`](./reset-css-comparison.md) | Reset CSS domain notes used by the migration VRT |
| [`SPEC.md`](./SPEC.md) | The test-spec checklist (pending and active cases) |

## Design (landed)

| Doc | What it is |
|---|---|
| [`design/gate-plugin-architecture.md`](./design/gate-plugin-architecture.md) | The gate contract, rule settings, and the table of all gates and their rule counts |
| [`design/package-decomposition.md`](./design/package-decomposition.md) | Splitting vlmkit by layer (collector / pure judge / driver / loop) |
| [`design/moonbit-boundary.md`](./design/moonbit-boundary.md) | The TypeScript ↔ MoonBit boundary, and what belongs on each side |
| [`design/composition-metrics.md`](./design/composition-metrics.md) · [`design/design-policy-metrics.md`](./design/design-policy-metrics.md) | Why `check composition` and `check design` measure what they do, and the metrics rejected |
| [`design/creative-markup-eval.md`](./design/creative-markup-eval.md) | Evaluating markup with no reference: the scenario behind `check integrity` |
| [`design/generated-asset-eval.md`](./design/generated-asset-eval.md) | The slot contract behind `check asset` |
| [`design/mcp-and-agent-expansion.md`](./design/mcp-and-agent-expansion.md) | MCP exposure (part A, landed) and the verified browser agent (part B, now `vlmkit act`) |
| [`heal-loop-design.md`](./heal-loop-design.md) | `@mizchi/vlmkit-heal`: the selector and markup repair loop |
| [`crater-breakpoint-discovery-design.md`](./crater-breakpoint-discovery-design.md) | Breakpoint discovery through Crater |
| [`flaker-integration-design.md`](./flaker-integration-design.md) | Running vlmkit under flaker / metric-ci |
| [`spec-to-playwright-skill-design.md`](./spec-to-playwright-skill-design.md) | The `spec-to-playwright` skill |
| [`ui-contract-dsl-moonbit-renderer.md`](./ui-contract-dsl-moonbit-renderer.md) | UI Contract IR as the design target (`contract introspect / validate / scaffold`) |

## History

| Doc | What it is |
|---|---|
| [`architecture.md`](./architecture.md) · [`project-structure-diagram.md`](./project-structure-diagram.md) | The layout as of 2026-05 (marked as such at the top) |
| [`api-design.md`](./api-design.md) | The pre-1.0 CLI / library API exploration (marked as such at the top) |
| [`migration-0.5.md`](./migration-0.5.md) | The 0.4.x → 0.5.0 command reorganisation |
| [`heal-loop-plan.md`](./heal-loop-plan.md) · [`spec-to-playwright-skill-plan.md`](./spec-to-playwright-skill-plan.md) | Implementation plans for the two designs above, both carried out |
| [`vrt-review-design.md`](./vrt-review-design.md) | A model judging whether a failed `toHaveScreenshot` is acceptable: approved as a design, not built |
| [`feature-review.md`](./feature-review.md) | A review of the feature set as of 2026-05-19 (Japanese) |
| [`pipeline.md`](./pipeline.md) · [`research.md`](./research.md) | The early three-source diff pipeline and the research behind it |
| [`landmark-drilldown-design.md`](./landmark-drilldown-design.md) · [`markup-implementation-flow.md`](./markup-implementation-flow.md) · [`design-pattern-feasibility.md`](./design-pattern-feasibility.md) · [`blog-design-ai-flow.md`](./blog-design-ai-flow.md) | Notes from the 2026-05 AI-mock-to-markup dogfood (partly Japanese) |
