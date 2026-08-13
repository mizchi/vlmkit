# Dogfood scenario: adopting vlmkit into a repo you don't own (2026-08-12)

**Agents must not read this file.** It is the answer key. `brief.md` is what they get.

## Why this scenario exists

Five rounds ran the same posture: an agent handed a fixture and told to fix it or to
produce evidence from it. v5's conclusion was that a different *page* finds different
kinds of defect — three real bugs came out of one round on a new page. The axis that
had never been varied is the **posture**.

Every real finding in this project's history traces back to #112, which was not a fix
task or an evidence task. It was **someone adopting the tool into a repo they owned,
alongside a test suite they could not break**. That is the situation this scenario
reproduces, and nothing in the loop had covered it:

| Pressure | Present in v1–v5? | Present here |
|---|---|---|
| The tool must not break the consumer's own test suite | no | yes — `consumer/pnpm test` runs offline, 3 tests, and repo-rooted discovery collects anything test-shaped that lands under it |
| The output has to be reviewable by someone who reads only the diff | partly (v5 CI agent) | yes, stated as a constraint |
| The agent must triage findings rather than fix them | no — every round told them to fix | yes, and it is asked to separate "real problem" from "tool is wrong" |
| Live, moving data | v5 | yes — `/api/orders` increments per request, so report text differs between runs |
| A page that never reaches network idle | v5 | yes — `/api/stream` is held open |

The triage requirement is the interesting one. Five rounds of "make the gates pass"
selected for agents that work around a bad message; this one asks an agent to *judge*
the messages, which is the posture a real adopter is in and the one that produced #112.

## The consumer

`consumer/` is a small internal console with its own identity: `package.json` at
2.4.0, a `src/format.ts` with real unit tests, an `e2e/smoke.spec.ts` Playwright pin of
its own, and a dev server. Its test script globs `src/**`, the repo root, `skills/**`
and `.agents/**` — the last two on purpose, so an installed skill asset that is
test-shaped would be collected. That is #112 item 3, now a live regression check rather
than a fixed bug taken on faith.

## Declared defects

All in `consumer/public/app.css` or the markup's own text. None annotated.

| # | Defect | Gate that should catch it |
|---|---|---|
| D1 | `.orders` is a fixed `width: 940px` table; the `max-width: 900px` media query only changes padding | `check integrity` → `page-overflow-x` (188px at 768px, **fail**) |
| D2 | `.who` `#9a9a9a` (2.81:1), `.state` `#8d8d8d` (3.32:1), `.hint` `#a0a0a0` — all 13px | `check integrity` → `low-contrast-text` ×5 (warn); `check a11y contrast` fails |
| D3 | `FIXME confirm rounding with finance.` shipped in the UI | `check copy` → `placeholder-text` (**fail**) |
| D4 | `/api/orders` increments an order id and totals per request | nothing should report it — but `check copy`'s finding text quotes the values, so the *report* differs between runs unless `--har` pins it |

D4 is the trap: it is not a page defect, and an agent that reports "the tool is
nondeterministic" without reaching for `--har` has found real friction; one that pins it
has used the fix.

## Verified before the round (2026-08-12, branch at 74ecf0b)

```
consumer pnpm test                        → 3 pass / 0 fail
check integrity <url>                     → hangs to the 30s timeout, now naming
                                            /api/stream and the way out
check integrity <url> --wait-until load   → DEFECTS (1 fail, 5 warn): page-overflow-x
                                            188px @768,375 + low-contrast-text ×5
                                            ... and the new unpinned-input line
```

## What this round is watching for, beyond new findings

Five shipped fixes are in the path an adopter walks, none of them ever seen by an agent
that did not have them from the start:

- the navigation-timeout diagnosis (does it end the hang without `--help`?)
- the unpinned-live-input line (does it lead to `record-har` unprompted?)
- `snapshot record-har` (is it findable?)
- `gates init` scaffolding the URL flags (does the scaffold run first time?)
- the gate-help persistence footer (does the config get committed without a doc lookup?)

## Attempts

`attempts/agent-<letter>/` — one directory per agent.
