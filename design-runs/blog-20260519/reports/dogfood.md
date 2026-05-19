# Blog AI mock to markup dogfood

Run date: 2026-05-19

## Goal

Validate the flow described in `docs/blog-design-ai-flow.md`:

1. Write a blog design brief.
2. Generate desktop/mobile AI mock targets.
3. Use `vlmkit build component` to compare the semantic HTML implementation
   against the selected target images.
4. Iterate based on the generated reports.

## Inputs

- Brief: `design-runs/blog-20260519/brief.md`
- Desktop target: `design-runs/blog-20260519/target/desktop.png` (1536x1024)
- Mobile target: `design-runs/blog-20260519/target/mobile.png` (864x1821)
- Implementation: `design-runs/blog-20260519/implementation/page.html`
- CSS: `design-runs/blog-20260519/implementation/style.css`

## Commands

`pnpm exec vlmkit ...` failed in the repo checkout because the package bin was
not built/linked:

```text
ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL Command "vlmkit" not found
```

For repo-local dogfood, the CLI was run directly through the TypeScript entry:

```bash
node src/cli/vlmkit.ts build component \
  design-runs/blog-20260519/target/desktop.png \
  design-runs/blog-20260519/implementation/page.html \
  --output-dir design-runs/blog-20260519/reports/desktop

node src/cli/vlmkit.ts build component \
  design-runs/blog-20260519/target/mobile.png \
  design-runs/blog-20260519/implementation/page.html \
  --output-dir design-runs/blog-20260519/reports/mobile
```

## Results

| Round | Change | Desktop diff | Mobile diff | Notes |
|---|---|---:|---:|---|
| 0 | Initial scaffold, before tool fix | 19.11% | 12.81% | Misleading: CSS was not loaded, so the current render was mostly browser default styling. |
| 1 | Inline local stylesheet links in `component-from-image` | 21.38% | 25.21% | Real comparison after CSS loads. |
| 2 | Manual layout pass toward target | 23.63% | 32.23% | Visual hierarchy got closer in places, but pixel score worsened. Need a more disciplined report-driven pass. |
| 3 | Add `Landscape diff` metric and move desktop rail upward | 19.06% / landscape 2.20% | 32.03% / landscape 4.64% | Coarse score confirmed desktop improved even while exact matching remained far away. |
| 4 | Re-run mobile with `--dpr 2` and tune mobile typography | 19.06% / landscape 2.20% | 29.18% / landscape 5.54% | Correct CSS viewport exposed the real mobile layout; score is now comparable to the intended target. |

## Dogfood findings

### Finding 1: local CSS was ignored

`component-from-image` used `page.setContent(html)` on the raw HTML string.
Relative stylesheet links such as `./style.css` were not resolved, so the tool
compared unstyled HTML unless the CSS was inline.

Fix shipped in this dogfood pass:

- Added `inlineLocalStylesheets(html, htmlPath)`.
- `runComponentFromImage` now inlines local relative `<link rel="stylesheet">`
  files before `page.setContent`.
- Added unit coverage in `packages/vlmkit-markup/src/component/component-from-image.test.ts`.

### Finding 2: repo-local CLI dogfood needs a documented command

The npm bin `vlmkit` is not available before build/link. During repo-local
dogfood, `node src/cli/vlmkit.ts ...` is the reliable command. The runbook
should mention this or provide a package script/task.

### Finding 3: generated UI mocks are useful but noisy targets

The desktop mock is visually strong and readable, but pixel/text-row analysis
is noisy:

- Desktop target text-row extraction reported only 1 target row.
- Mobile target text-row extraction reported 34 rows and was more actionable.
- Generated illustration/detail regions can dominate the diff even when the
  semantic layout is acceptable.

This suggests a future `vlmkit design` wrapper should optionally generate a
"wireframe-safe" target prompt: fewer illustrations, stronger rectangular
regions, and deterministic text blocks.

### Finding 4: subjective visual edits can worsen the score

The manual layout pass made the rendered page look more like the target at a
glance, but the measured diff worsened. The next pass should be driven by the
report order:

1. Match page and section top offsets.
2. Match card dimensions.
3. Match right-rail vertical placement.
4. Match typography scale.
5. Only then add decorative image blocks.

### Finding 5: pixel diff is too strict for AI mock targets

The generated mocks are useful as "visual direction" but not as pixel-perfect
baselines. A coarse layout metric is needed before exact VRT. This pass added
`Landscape diff`, a grid-level comparison of average color + ink density.

Observed value:

- Desktop round 3: pixel 19.06%, landscape 2.20%
- Mobile round 3 without DPR: pixel 32.03%, landscape 4.64%

This better matches the human judgment that the overall page landscape is
closer than the pixel diff suggests.

### Finding 6: high-resolution mobile mocks need DPR handling

The mobile target image is 864px wide but visually represents a 2x mobile
mock. Without `--dpr 2`, `component-from-image` rendered a CSS viewport of
864px, which triggered the desktop layout and produced misleading feedback.

Fix shipped in this pass:

- Added `suggestDeviceScaleFactorForTarget`.
- `build component` now warns:
  `portrait target 864×1821 looks like a 2x mobile mock; try --dpr 2`.
- The report records the DPR hint and the CSS viewport when DPR is used.

### Finding 7: landscape needs semantic drilldown

`Landscape diff` is a useful coarse signal, but it still needs a stable way to
answer "which page area should the agent edit next?" This pass added a
landmark-based drilldown:

- Current DOM landmarks are captured from semantic HTML / concrete ARIA roles.
- `role="landmark"` is ignored; named `<section>` and named `<form>` are used
  as `region` / `form` landmarks.
- Landscape cells and heatmap regions are assigned to landmarks.
- The report now separates `Layout lane` from `Decoration lane`.

This matched the dogfood need better than a single priority list. Desktop now
starts from `region "Follow the notes"` in the layout lane even though
`complementary "Topics"` has a large decoration-only heatmap region.

### Finding 8: landscape needs layout contracts

Landmark drilldown is more useful when each landmark also exposes its layout
contract. Otherwise agents still have to infer whether a mismatch should be
fixed by changing `max-width`, grid tracks, scroll containers, or local paint.

This pass added current-DOM layout contract capture:

- width policy: fluid / min-width / max-width bounded
- height policy: content / bounded / scrollport
- scroll policy: none / x / y / xy
- display policy: block / flex / grid / subgrid hints

The desktop report now shows, for example, that `main` is `bounded max 1324px`
while `region "Blog content"` uses `grid`. This makes it clearer which edits
belong to the layout lane and which should wait for decoration.

### Finding 9: UI Contract should become the editable source

The layout contract is already more important than raw CSS declarations in the
dogfood loop. The next design target should be a UI Contract DSL / IR:

- agent edits contract;
- compiler emits semantic HTML and CSS;
- renderer simulates layout;
- `build component` compares landscape/layout/decoration lanes;
- CSS remains generated output plus escape hatch.

A design note was added at `docs/ui-contract-dsl-moonbit-renderer.md`. The
final core should be considered for MoonBit once the schema stabilizes, with
Chromium kept as the browser oracle and crater used as a fast semantic renderer.

Initial tool added:

```bash
node src/cli/vlmkit.ts contract introspect \
  design-runs/blog-20260519/implementation/page.html \
  --screen-id blog-home \
  --viewport desktop:1536x1024 \
  --viewport mobile:432x911@2 \
  --out design-runs/blog-20260519/ui.contract.json
```

The generated contract currently reports 6 validation issues, all
`fluid width must declare min or max`. That is good feedback for this flow:
the implementation has several reusable regions whose liquid bounds should be
made explicit before the contract becomes the editable source.

## Next steps

1. Add a repo-local task or README note for:
   `node src/cli/vlmkit.ts build component ...`
2. Improve the blog implementation using the report order above.
3. Add a `vlmkit design` prototype that orchestrates:
   brief -> mock targets -> build component -> report summary.
4. Add an option to `build component` for target-safe UI mock prompts if image
   generation is integrated later.
5. Add a first-class `--goal landscape` mode that treats coarse similarity as
   the primary pass/fail metric and pixel diff as secondary evidence.
6. Add mobile target metadata or prompt conventions so generated 2x/3x mocks
   can be consumed without guessing DPR.
7. Promote semantic drilldown to a shared JSON artifact and add explicit
   `--goal layout` / `--goal decoration` convergence modes.
8. Extend target/mock generation prompts to emit a first-class layout contract:
   min/max widths, scrollports, grid/subgrid tracks, and responsive stack rules.
9. Add `vlmkit contract validate` and `vlmkit contract compile` around the
   initial UI Contract schema.

## Verification

```bash
node --test packages/vlmkit-markup/src/contract/ui-contract.test.ts
node --test packages/vlmkit-markup/src/contract/introspect-contract.test.ts
node --test packages/vlmkit-markup/src/component/semantic-drilldown.test.ts
node --test packages/vlmkit-markup/src/component/component-from-image.test.ts
node --test packages/vlmkit-core/src/landscape-diff.test.ts
node --test 'packages/vlmkit-markup/src/**/*.test.ts'
node --test 'packages/vlmkit-core/src/**/*.test.ts'
node src/cli/vlmkit.ts build component --help
```
