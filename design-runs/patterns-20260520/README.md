# Non-blog pattern dogfood

Date: 2026-05-20

Purpose: exercise the pattern feasibility matrix outside the blog/editorial
case. This run uses synthetic HTML targets instead of generated AI images so
the loop can run deterministically in the repo.

Patterns:

- `landing`: first-viewport offer, CTA, media slot, next-section hint.
- `app-shell`: Discord-like persistent rails, nested scrollports, selected state.
- `game`: canvas scene where DOM landmarks only describe the outer shell.

Run:

```bash
node design-runs/patterns-20260520/capture-targets.mjs
node src/cli/vlmkit.ts build component design-runs/patterns-20260520/landing/target.png design-runs/patterns-20260520/landing/current.html --goal landing --output-dir design-runs/patterns-20260520/landing/reports/component
node src/cli/vlmkit.ts build component design-runs/patterns-20260520/app-shell/target.png design-runs/patterns-20260520/app-shell/current.html --goal app-shell --output-dir design-runs/patterns-20260520/app-shell/reports/component
node src/cli/vlmkit.ts build component design-runs/patterns-20260520/game/target.png design-runs/patterns-20260520/game/current.html --goal draft --output-dir design-runs/patterns-20260520/game/reports/component
node design-runs/patterns-20260520/check-patterns.mjs
```

Report:

- `reports/dogfood.md`
