# AGENTS.md — for coding agents that are not Claude Code

**The project conventions live in [`.claude/CLAUDE.md`](./.claude/CLAUDE.md). Read that file
first.** It is the single source for the package layout, the build/test commands, the gate
benchmarks and the model recommendations, and this file deliberately does not restate any of it —
two copies of a convention drift, and this repo already carries a test
(`tests/skill-package.test.mjs`) that exists because three copies of a skill did.

What follows is only what `.claude/CLAUDE.md` cannot answer: which model to reach for when the
agent reading it is not Claude.

## Which model this project expects you to use

vlmkit calls models itself — a VLM for the Stage-1 CHANGE list and an LLM for Stage-2 fix
synthesis — and the model is yours to choose through the environment. The defaults below are what
each agent should set for its OWN family, so a run is reproducible from the transcript.

| you are | VLM (`VLMKIT_VLM_MODEL`) | LLM (`VLMKIT_LLM_PROVIDER` / `VLMKIT_LLM_MODEL`) |
|---|---|---|
| Codex / any OpenAI-based agent | `openai/gpt-5.6-luna` | `openrouter` / `openai/gpt-5.6-luna` |
| Claude Code | `claude:claude-haiku-4-5-20251001` | `anthropic` / `claude-sonnet-4-6` |
| anything else, or no preference | `bytedance/ui-tars-1.5-7b` (the code's default) | `gemini` / provider default |

For an OpenAI-based agent, the whole block:

```sh
export OPENROUTER_API_KEY=...            # OpenAI models are served through OpenRouter here
export VLMKIT_LLM_PROVIDER=openrouter
export VLMKIT_LLM_MODEL=openai/gpt-5.6-luna
export VLMKIT_VLM_MODEL=openai/gpt-5.6-luna
```

### `VLMKIT_LLM_PROVIDER=openai` is not a thing, and this is where agents stop

There is no `api.openai.com` client in this codebase and no `OPENAI_API_KEY` anywhere in it.
`openai` is not one of the three provider names (`gemini | anthropic | openrouter`), so setting it
fails with `INVALID_PROVIDER` — which is exactly what happened to the run that produced this file.
**The `openai/` in the model id is an OpenRouter catalogue prefix, not a provider.**

The other spelling that dead-ends is a half-name. Model ids are resolved against the OpenRouter
catalogue and an ambiguous one is an error rather than a guess, so:

- `openai/gpt-5.6-luna` — exact, always works.
- `gpt-5.6-luna` — works: it matches one whole path segment.
- `gpt-5.6` — **fails** with `MULTIPLE_MATCHES` (Luna, Luna Pro, Terra, Sol, and their `:batch`
  variants all contain it). Name the variant.

### Before you pick something else

The recommendations in `.claude/CLAUDE.md` are benchmarked, dated, and specific about which model
fails how — `meta-llama/llama-4-maverick` claims the image is unavailable, `gemini-2.5-flash-lite`
hallucinates uniform colour deltas, `qwen3-coder` over-corrects a whole page. If you swap the
model, run the bench in that file rather than assuming, and write the result into
`docs/reports/`.

## Two things that will waste your time otherwise

Both are in `.claude/CLAUDE.md` and both are worth repeating because they fail confusingly:

- **`pnpm build` between editing `packages/*/src` and running the CLI.** `@mizchi/vlmkit-*`
  resolves through `exports` to `dist/*.mjs`, so the CLI shows the OLD behaviour until you build.
  (Never pipe that build to `head`: SIGPIPE leaves a half-deleted `dist/`.)
- **`export PATH="$HOME/.moon/bin:$PATH"` before `pnpm test`.** The markup-core tests build MoonBit
  sources on demand; without `moon` on PATH ~138 tests fail on the toolchain rather than on
  anything real.

`pnpm test` on a machine with `OPENROUTER_API_KEY` exported fails two tests in
`packages/vlmkit-ai/src/vlm-client.test.ts` that assert the missing-key rejection. That is the
environment, not your change — `env -u OPENROUTER_API_KEY pnpm test` is green.
