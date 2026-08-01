# Generated-asset evaluation: slot contract + `check asset` (2026-07-31)

## Motivation

S19's card-battle screen renders its characters as CSS-blob figures —
placeholders. The plan is to generate real character/enemy art with an
image-generation model and swap it in. This design makes that swap
**evaluable**: the deterministic part is implemented today
(`vlmkit check asset`, no keys, no browser); the generation leg is
key-gated backlog.

## The pipeline

```
[key] generate PNG  →  check asset (pre-swap, PNG math)  →  swap into slot
                            ↓ regenerate on suspect            ↓
                                        check integrity / check layout / snapshot (in situ)
```

Two evaluation moments, deliberately separate:

1. **Pre-swap, asset-level** — `check asset` on the PNG alone. Catches
   generation failures cheaply (before any page render): wrong aspect
   for the slot, matted background where a cut-out is needed,
   near-empty canvas, silhouette that melts into the backdrop,
   palette clash with the page.
2. **Post-swap, page-level** — the existing gates already cover the
   integrated result with no new code: integrity A3 (broken resource)
   if the file path is wrong, **A13 occluded-text** if the art paints
   over readouts (the exact defect class S19's CSS figures had),
   layout contract for slot geometry, and `snapshot` for regression
   once a baseline is approved.

## Slot contract (what the page owes the asset)

A swap-ready page declares, per art slot:

- a fixed-size container with a stable selector
  (e.g. `[data-asset-slot="player"]`, 220×300 CSS px),
- `object-fit: contain` on the `<img>` so a correct-aspect asset never
  distorts,
- the backdrop color behind the slot (the `--against-bg` input),
- alt text (the copy gate does NOT accept alt text for manifest lines
  — visible copy stays visible copy).

For S19 specifically: player slot ≈ 220×300 over `#241b3a`, enemy slot
≈ 220×300 over the same; both `--expect-transparent` (battlefield
sprites, not framed portraits).

## `check asset` (implemented)

```bash
vlmkit check asset sprite.png --slot 220x300 --expect-transparent \
  --against-bg "#241b3a" --page-palette page-screenshot.png
```

| Check | Signal | Severity |
|---|---|---|
| aspect vs slot | >5% relative mismatch → letterbox/distort | suspect |
| resolution vs slot | ≥1.5× upscale needed | warn |
| border ring alpha | matted / opaque-mixed under `--expect-transparent` (matte color reported) | suspect |
| occupancy | <5% non-transparent (failed generation) | suspect |
| occupancy | >98% under `--expect-transparent` | warn |
| edge contrast vs `--against-bg` | WCAG ratio of contour pixels vs backdrop; <1.5 warn, <1.2 suspect | warn/suspect |
| palette harmony vs `--page-palette` | share of asset dominants within RGB 96 of the page's top-24 colors (accents matter: S19's oranges ranked 19th-22nd, hence 24 not 16); <25% | warn |

Everything is decoded-PNG math (pngjs) — no browser, no keys, ~50ms.
Ledger tool id: `asset-check`. Aesthetic judgment ("does it look like
a Gloom Warden") is deliberately OUT of scope — that is Layer-B/VLM
territory and stays demand-gated; the gate's job is "will this file
work in this slot on this page".

## Key-gated leg (backlog)

With an image-generation key: generate N candidates per slot from a
prompt that includes the page palette and slot geometry, run
`check asset --fail-on-suspect` as the survival filter, swap the
survivors, re-run integrity/layout/snapshot per candidate, and pick by
the in-situ results (plus human eyes for aesthetics). The interesting
evaluation question mirrors the markup legs: how many candidates does
a model need before one passes the deterministic gate set — the gate
pass rate IS the model comparison metric, no rubric needed.
