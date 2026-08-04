# @mizchi/vlmkit-ai

VLM / LLM clients and reasoning pipeline used by VRT to interpret diff
images and natural-language intent.

Part of the [`vlmkit`](https://github.com/mizchi/vlmkit) monorepo.

## Install

```bash
pnpm add @mizchi/vlmkit-ai
```

Set `OPENROUTER_API_KEY`, `GEMINI_API_KEY`, or `ANTHROPIC_API_KEY` depending on
the provider you target.

## Usage

```ts
import { buildIntent, runReasoning, askVlm } from "@mizchi/vlmkit-ai";

const intent = await buildIntent({
  baseUrl: "http://localhost:3000",
  description: "Migrate hero section from Tailwind to vanilla CSS",
});

const reasoning = await runReasoning({ /* diff context */ });
```

## What's included

| Module | Purpose |
|---|---|
| `llm-client` | Provider-agnostic chat-completion wrapper (Gemini / Anthropic). |
| `vlm-client` | OpenRouter VLM client for diff-image analysis. |
| `reasoning`, `reasoning-pipeline` | Multi-step structured reasoning over diff context. |
| `intent` | Natural-language intent extraction. |
| `nlp` | Stopword / synonym / heuristic helpers. |

## Environment variables

| Variable | Purpose |
|---|---|
| `VLMKIT_LLM_PROVIDER` | `gemini` (default) \| `anthropic` |
| `VLMKIT_LLM_MODEL` | Override provider default model |
| `VLMKIT_VLM_MODEL` | OpenRouter VLM model id |
| `OPENROUTER_API_KEY` | VLM access |
| `GEMINI_API_KEY` | Gemini LLM access |
| `ANTHROPIC_API_KEY` | Anthropic LLM access |

## License

MIT
