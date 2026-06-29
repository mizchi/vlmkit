# Markup VRT Eval

Dogfood harness for measuring the VLMKit Playwright workflow while building a
new UI screen.

The app is a static Release Queue screen. The evaluator:

1. observes the rendered UI with Playwright
2. runs `vlmkit-plan`
3. runs `vlmkit-generate`
4. updates VRT baselines
5. verifies the generated test twice with `--runtime-gate-runs 2`
6. reruns the same test with `MARKUP_EVAL_VARIANT=regression` and expects a VRT failure

Artifacts are written under `.vrt/markup-vrt-eval/`.

```sh
PROVIDER=anthropic node examples/markup-vrt-eval/run.mjs
```

The run needs whichever API key matches `PROVIDER` (`ANTHROPIC_API_KEY`,
`OPENROUTER_API_KEY`, or `GEMINI_API_KEY`).

The evaluator exits non-zero if the generated test skips VRT assertions, uses
`page.goto(...)` instead of `gotoApp(page)`, falls back to ambiguous release-name
text locators, includes comments, or fails to detect the intentional visual
regression variant.

The intentional regression also writes repair context:

- `.vrt/markup-vrt-eval/repair-context.md`
- `.vrt/markup-vrt-eval/repair-context.json`

This combines Playwright's failed screenshot artifacts with
`@mizchi/vlmkit-heal` artifact discovery and `@mizchi/vlmkit-markup` region
selector matching. It records the failing assertion, expected/actual/diff PNG
paths, raw changed-pixel bbox, matching selector candidates, top-edge DOM
candidates, computed-style property attribution, semantic/visual drift
classification, and fix hints for the next repair loop.

The main report also writes `.vrt/markup-vrt-eval/report.html`, which links the
expected/actual/diff screenshots next to the ranked CSS property candidates.
The run gates on two stable post-generation VRT checks and verifies the
intentional regression against `specs/expected-change.json`.

Set `MARKUP_EVAL_VLM_REGION_DIFF=1` to additionally run `vlmkit
vlm-region-diff` against the failed expected/actual screenshots. That optional
path requires `OPENROUTER_API_KEY`.
