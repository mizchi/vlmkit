# `inspect claims`: Jev against other models, cost and accuracy (2026-10-17)

This compares the claims round of `2026-10-17-jev-claims.md` (54 screenshots, 5 statements each,
270 answers with a known truth) against other models.

**Only one other arm could be run.** The environment had no OpenRouter, Anthropic, Gemini or OpenAI
key. Following CLAUDE.md, the second arm is a **coding agent's own vision**. Two fresh Claude Code
subagents each got a blind packet of 27 screenshots, renamed to shuffled ids with no fixture or plant
name, and only `BRIEF.md`. They answered the same five statements as probabilities, one image at a
time. The agent had a shell, and its honesty is the one thing the packet cannot enforce. The other
models' costs below are computed from list prices. Their accuracy is **not measured**.

Data: `docs/reports/data/2026-10-17-jev-claims-vs-agent/` (`BRIEF.md`, `agent-answers.json`,
`score.py`). Run `python3 score.py docs/reports/data/2026-10-17-jev-claims-vs-agent .` from the repo
root to reproduce both tables.

## Accuracy: Jev vs the agent, same 270 answers

The truth is the same as in the claims round: a claim is true on its own plant and on the two native
fixtures (form-app's validation error, stacking-context's open dialog). A claim counts as true at ≥ 0.5.

| statement | Jev caught | agent caught | Jev false alarms (clean / other plants) | agent false alarms | AUROC Jev / agent |
|---|---:|---:|---:|---:|---:|
| error message or banner | 14/14 | 13/14 | 0/8 · 0/32 | 0/8 · 0/32 | 1.00 / 1.00 |
| modal dialog | 14/14 | 14/14 | 0/8 · 2/32 | 0/8 · 0/32 | 1.00 / 1.00 |
| broken or missing image | 9/9 | 9/9 | 0/9 · 1/36 | 0/9 · 0/36 | 1.00 / 1.00 |
| overlapping text | 9/9 | 9/9 | 0/9 · 8/36 | 0/9 · 0/36 | 0.99 / 1.00 |
| loading spinner covering the page | 8/9 | 9/9 | 0/9 · 0/36 | 0/9 · 0/36 | 1.00 / 1.00 |
| **total** | **54/55** | **54/55** | **0/43 · 11/172** | **0/43 · 0/172** | |

- **Both catch 54 of 55 true cases, and neither raises a false alarm on a clean page.**
- **The difference is the cross-plant alarms: Jev has 11 and the agent has 0.** Jev reads a broken-image
  box or a loading veil that lies over page text as "text overlapping other text" (8 cases), and reads
  a floating blank image box as a modal (2 cases). The agent never confuses one defect for another.
  At ranking, both are perfect (AUROC ~1.00). The difference is where 0.5 falls: Jev's wrong answers
  sit between 0.53 and 0.84.
- **The misses differ.** Jev missed a loading veil (0.49). The agent missed form-app's native validation
  error under the loading veil (0.30). That error is faint at the bottom edge but readable, so it is
  counted as a miss.

## Cost and speed per screenshot (1280x800, 5 statements)

Measured: Jev's tokens and latency (from the claims round) and the agent's elapsed time. Every other row
is **computed**: the image token count from each provider's published sizing rule, plus about 200
prompt tokens and about 60 JSON output tokens, at OpenRouter list prices on 2026-10-17
(`/api/v1/models`). Thinking or reasoning tokens are excluded, so a model that thinks by default costs
more than its row.

| model | image tokens (rule) | $/screenshot | 100 shots | latency | claims accuracy |
|---|---:|---:|---:|---|---|
| **Jev 1.14** (TypeSafe) | 3,047 in total (measured) | **$0.00013** (output free) | $0.013 | **0.19s median** (measured) | 54/55, 11 cross-plant alarms (measured) |
| amazon/nova-lite-v1 | ~1,300 (estimate) | ~$0.00010 | $0.010 | — | not measured |
| google/gemini-2.5-flash-lite | 1,032 (4 × 258-token tiles) | $0.00015 | $0.015 | — | not measured (on the VLM avoid list) |
| bytedance/ui-tars-1.5-7b | 1,334 (28px patches) | $0.00017 | $0.017 | ~1.4s (fix-loop bench) | not measured |
| qwen/qwen3-vl-30b-a3b-instruct | 1,000 (32px patches) | $0.00022 | $0.022 | ~2.0s (fix-loop bench) | not measured |
| google/gemini-2.5-flash | 1,032 | $0.00052 | $0.052 | — | not measured |
| openai/gpt-5-mini | ~1,620 (patches × 1.62) | ~$0.00058 + reasoning | $0.058+ | — | not measured |
| google/gemini-3-flash-preview | 1,120 (default resolution) | $0.00084 | $0.084 | — | not measured |
| anthropic/claude-haiku-4.5 | 1,365 (w·h/750) | $0.0019 | $0.19 | ~4.2s (fix-loop bench) | not measured |
| coding agent's own vision (Claude Code subagent) | ~4.9k session tokens per image | billed to the session | — | ~2.3s per image (27 in ~62s) | 54/55, 0 cross-plant alarms (measured) |

- **At this job's size, Jev costs about as much as the cheapest open models.** It sends about twice
  their tokens (3,047 against 1,000–1,300) at a lower price ($42/Btok against $60–150/Btok), and its
  output is free. Among the open models, only nova-lite is cheaper on paper. Haiku 4.5 costs about 15x more.
- **Latency is where Jev stands apart.** 0.19s against 1.4–4.2s for the fix-loop VLMs. The fix-loop
  latencies were measured on longer prose outputs, so a 60-token JSON answer would be faster than
  those, but probably still not sub-second.
- **What Jev's price buys over a text VLM is the answer type.** A `noul` is a calibrated probability
  with nothing to parse. A text VLM asked for JSON probabilities can break format or return
  uncalibrated round numbers. The VLM avoid list in CLAUDE.md records prose-only and hallucinated
  outputs on other tasks. How often this happens on this job is not measured.

## What this says, and what it does not

- **The coding agent is at least as accurate as Jev on these 54 screenshots**, and cleaner on telling
  defects apart. It is not a product to call from CI: it costs session time (~2.3s an image, all in
  sequence) and nobody can audit its process. As an independent check of Jev's answers in this round,
  the two agree on 257 of 270.
- **No accuracy is measured for any provider model.** To measure them, set `OPENROUTER_API_KEY` and ask
  each model the same `BRIEF.md` packet as one JSON request per image. The scorer in the data directory
  takes the answers as they are.
- **Jev's cross-plant alarms are the one cost the agent arm puts a number on.** 11 of 172 answers on
  screenshots with a different defect is 6%. All 11 fall on a page that is already broken, and on a
  clean page the alarm rate is still 0/43.
