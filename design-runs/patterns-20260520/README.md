# Non-blog pattern dogfood

Date: 2026-05-20

Purpose: exercise the pattern feasibility matrix outside the blog/editorial
case. This run uses synthetic HTML targets instead of generated AI images so
the loop can run deterministically in the repo.

Patterns:

- `landing`: first-viewport offer, CTA, media slot, next-section hint.
- `app-shell`: Discord-like persistent rails, nested scrollports, selected state.
- `dashboard`: dense operational dashboard with filters, KPI repeats, chart,
  table, and alerts.
- `responsive-stretch`: width stress from mobile through 1920px, checking
  bounded containers, readable measure, card sizing, and media aspect.
- `game`: canvas scene where DOM landmarks only describe the outer shell.
- `expressive-menu`: poster-like semantic menu with composition metadata.

Run:

```bash
node design-runs/patterns-20260520/capture-targets.mjs
node src/cli/vlmkit.ts build component design-runs/patterns-20260520/landing/target.png design-runs/patterns-20260520/landing/current.html --goal landing --output-dir design-runs/patterns-20260520/landing/reports/component
node src/cli/vlmkit.ts build component design-runs/patterns-20260520/app-shell/target.png design-runs/patterns-20260520/app-shell/current.html --goal app-shell --output-dir design-runs/patterns-20260520/app-shell/reports/component
node src/cli/vlmkit.ts build component design-runs/patterns-20260520/dashboard/target.png design-runs/patterns-20260520/dashboard/current.html --goal app --output-dir design-runs/patterns-20260520/dashboard/reports/component
node src/cli/vlmkit.ts contract introspect design-runs/patterns-20260520/responsive-stretch/current.html --pattern landing --goal app --viewport mobile:390x844 --viewport tablet:768x900 --viewport desktop:1440x900 --viewport wide:1920x1080 --out design-runs/patterns-20260520/responsive-stretch/ui.contract.json --profile
node src/cli/vlmkit.ts build component design-runs/patterns-20260520/responsive-stretch/target.png design-runs/patterns-20260520/responsive-stretch/current.html --contract design-runs/patterns-20260520/responsive-stretch/ui.contract.json --output-dir design-runs/patterns-20260520/responsive-stretch/reports/component
node src/cli/vlmkit.ts build component design-runs/patterns-20260520/game/target.png design-runs/patterns-20260520/game/current.html --goal canvas --output-dir design-runs/patterns-20260520/game/reports/component
node src/cli/vlmkit.ts build component design-runs/patterns-20260520/expressive-menu/target.png design-runs/patterns-20260520/expressive-menu/current.html --goal expressive-menu --states hover focus-visible --output-dir design-runs/patterns-20260520/expressive-menu/reports/component
node design-runs/patterns-20260520/check-patterns.mjs
```

Report:

- `reports/dogfood.md`
