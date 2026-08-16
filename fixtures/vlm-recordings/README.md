# Recorded VLM / LLM responses

Response bodies for the two-stage reasoning pipeline, so `reasoning-pipeline.ts` can be tested
without an API key. Served to the code under test by a `fetch` stub — see
`packages/vlmkit-ai/src/reasoning-pipeline.test.ts`.

## What these are, exactly

**Hand-written to the shape the providers return, not captured off the wire.** The environment
these were written in has no provider credentials, so claiming a capture would be a lie. Each
field is traceable to something checked in:

| Field | Where the shape comes from |
|---|---|
| OpenRouter `choices[].message.content`, `usage.{prompt,completion,total}_tokens` | `packages/vlmkit-ai/src/vlm-client.ts` (`callOpenRouter`) and `llm-client.ts` |
| Anthropic `content[].text`, `usage.{input,output}_tokens` | `vlm-client.ts` (`callClaude`) |
| Stage-1 body (`CHANGE: … \| … \| … \| … \| high`, `SUMMARY:`, `REGRESSION:`) | the `STAGE1_PROMPT` contract in `reasoning-pipeline.ts`, and the transcripts quoted in `docs/reports/2026-05-19-vlm-haiku-vs-uitars.md` |
| Stage-2 body (the fix JSON) | `parseStage2Response` in `reasoning-pipeline.ts` |

So they pin **what the pipeline does with a well-formed response**, and the malformed ones pin
what it does when a model ignores the format — which the benches say is common
(`moonshotai/kimi-k2.5` "returns 0 fixes despite VLM CHANGE list (emits prose-only)").

What they cannot pin is that the providers still return this shape. Nothing offline can: that is
what the dated benches in `docs/reports/` are for. If a provider changes its envelope, these
tests keep passing and the bench is what fails — so a green suite here is not evidence that a
live run works.

## Files

- `stage1-openrouter.json` — a VLM stage-1 reply with three CHANGE lines, one of them a duplicate
  (the dedup path), plus SUMMARY and REGRESSION.
- `stage1-prose-only.json` — a model that answered in prose and emitted no CHANGE line at all.
- `stage2-openrouter.json` — a stage-2 fix proposal with two CSS fixes and a confidence.
- `stage2-unparseable.json` — stage 2 returning prose where JSON was asked for.
