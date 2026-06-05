# `diff region` default `--max-tokens 600` truncates VLM JSON → `uncertain`

**Source**: A/B external-repo v1, treatment agent
(`docs/reports/2026-06-05-ab-external-v1.md`).

> "Default `--max-tokens 600` truncates JSON → useless `uncertain`
> verdict; needs a higher default or auto-retry."

When the VLM response is cut mid-JSON the command degrades the verdict
to `uncertain` instead of telling the user the output was truncated.

**Proposed fix**: raise the default (regions on a busy page easily
exceed 600 tokens), and on JSON parse failure caused by truncation,
retry once with doubled max-tokens + emit a warning naming the flag.
