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
| 5 | Mobile semantic order pass | 18.42% / landscape 2.14% | 16.55% / landscape 4.42% | Reordered mobile flow to `featured -> recent -> topics -> subscribe`, added the fourth recent note, and replaced the placeholder illustration with a small SVG botanical mark. |
| 6 | Mobile density and lower-landscape pass | 18.42% / landscape 2.14% | 22.57% / landscape 2.52% | Compressed mobile feature/recent/topics/subscribe sections so the lower page landscape enters the first viewport. Pixel diff worsened, but the coarse layout match improved strongly. |
| 7 | Add practical `--goal app` interpretation | pass: 18.42% / landscape 2.14% | pass: 22.57% / landscape 2.52% | Treats AI mock convergence as usable-app feasibility, not pixel-perfect reproduction. |

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

1. Lock the typography contract first: font family class, scale, line-height,
   and mobile wrapping.
2. Match page and section top offsets.
3. Match card dimensions.
4. Match right-rail vertical placement.
5. Only then add decorative image blocks.

The blog run showed that typography is not a late decoration detail. On mobile,
heading scale and line-height directly control feature-card height, recent-list
row height, and whether the subscription block enters the first viewport.

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

### Finding 10: responsive grid overrides need explicit reset checks

Round 5 initially collapsed the mobile feature card to a 2px-wide column.
The cause was a desktop `grid-column: 2` declaration that survived inside a
mobile one-column grid, forcing an implicit second column:

- intended mobile grid: `368px`
- broken mobile grid: `0px 346px`

The fix was to reset `grid-column: 1` for every mobile layout section. This is
a good candidate for a future contract/introspection check: when a responsive
rule changes a parent grid's column count, child placement should be validated
against the active viewport, not just the base CSS.

### Finding 11: landscape and pixel scores intentionally diverged

The final mobile pass improved the intended coarse layout signal:

- Round 4 mobile: pixel 29.18%, landscape 5.54%
- Round 5 mobile: pixel 16.55%, landscape 4.42%
- Round 6 mobile: pixel 22.57%, landscape 2.52%

The last step made the page read more like the target at the landscape level by
bringing `Topics` and `Subscribe` into the first viewport. It also made pixel
diff worse because text glyphs, exact copy, and decorative details diverged
more. This supports the dogfood hypothesis: AI mock targets should converge in
lanes, with `landscape/layout` before `pixel/decoration`.

### Finding 12: desktop and mobile mocks can disagree semantically

The generated desktop target shows three recent notes and a right-rail about
card. The generated mobile target shows four recent notes and no about card in
the first viewport. The implementation handled this as responsive presentation:

- keep the fourth article in semantic HTML;
- hide the `About` card on mobile;
- use mobile CSS order to place `Recent notes` before `Topics`.

This is another signal that the target prompt should produce a first-class
layout contract alongside images. The contract should say which landmarks are
shared across breakpoints, which are optional, and which may move between
main-column and rail layouts.

### Finding 13: diff ratio needs goal profiles, not one threshold

`--threshold` was easy to confuse with the acceptable diff ratio. In practice,
it is only the pixelmatch sensitivity used while counting changed pixels. The
dogfood loop needed a separate interpretation layer:

- `app`: practical AI mock to usable UI
- `layout`: coarse landmark geometry first
- `pixel`: strict screenshot reproduction
- `draft`: loose early exploration

The current implementation uses `--goal app` by default:

```text
pass: landscape <= 3%, pixel <= 25%
review: landscape <= 5%, pixel <= 35%
```

The final blog state passes `app` on both targets:

- desktop: landscape 2.14%, pixel 18.42%
- mobile: landscape 2.52%, pixel 22.57%

This matches the intended product judgment: the page is usable and structurally
close, even though generated text, icons, and decorative details still differ.
Pixel-perfect work should be reserved for `--goal pixel` and deterministic
baselines, not for AI-generated design mocks.

### Finding 14: mock generation needs implementation feasibility constraints

The initial mock prompts asked for "strong typography" but did not constrain
the generated design to web-standard typography. That leaves too much room for
AI to invent font shapes, weights, logo text, and decorative glyph density that
look good in an image but are expensive to reproduce with semantic HTML/CSS.

For future runs, the mock prompt should explicitly require:

- Georgia/system serif or system-ui/Inter-like sans typography;
- plausible CSS font sizes, line heights, weights, and mobile wrapping;
- no custom display fonts, hand lettering, or rasterized logo text;
- decorative art as simple SVG or replaceable media slots;
- every visible region explainable as semantic HTML plus CSS grid/flex.

This should happen before image generation, not after implementation starts.
The desired first loop is now:

```text
brief -> typography/web feasibility envelope -> AI mock -> feasibility review -> implementation
```

This also affects report order. `Text rows / typography` should be checked
before deep layout tweaking because font choices determine the box sizes that
landscape matching later depends on.

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
9. Add `vlmkit contract compile` around the initial UI Contract schema.
10. Add a responsive grid-placement lint to catch child `grid-column` values
    that create implicit columns after a breakpoint changes the parent grid.
11. Promote `--goal app|layout|pixel|draft` into JSON report metadata so agent
    loops do not need to parse markdown.
12. Add decoration/a11y gates on top of `app` goal once layout convergence is
    stable.
13. Add a `vlmkit design analyze-brief` or prompt helper that emits the
    typography/web feasibility envelope before mock generation.
14. Add a mock feasibility review artifact that records which generated
    details are implementable, normalized, or ignored.

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

This continuation pass also ran:

```bash
node --test packages/vlmkit-markup/src/component/component-from-image.test.ts \
  packages/vlmkit-markup/src/component/semantic-drilldown.test.ts \
  packages/vlmkit-markup/src/contract/introspect-contract.test.ts \
  packages/vlmkit-markup/src/contract/ui-contract.test.ts

node --test src/cli/cli.test.ts
node --test packages/vlmkit-markup/src/component/component-goal.test.ts
```

`node src/cli/vlmkit.ts contract validate design-runs/blog-20260519/ui.contract.json`
still exits non-zero with the expected 6 `fluid width must declare min or max`
issues described above.
