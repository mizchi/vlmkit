---
name: auto-markup
description: End-to-end automatic markup — recreate a page or component as HTML/CSS from a target screenshot (or UI Contract IR), driven by deterministic signal tools with an optional VLM assist. Pipeline; scaffold the landmark skeleton (contract scaffold), converge composition (build page - missing/extra components, ordering, stacking gaps), converge each part (build component + report.json), then audit decoration (check palette / tokens / theme). Works with any agent model including Haiku; the tools are pure Playwright + pixel math, no API key required. Use when asked to implement markup from a design image, rebuild a page to match a reference, or prove a screenshot-to-HTML loop converges.
---

# auto-markup

Recreate a target screenshot as working HTML/CSS by iterating against
deterministic signal tools. **You are the markup reasoner and the VLM**:
look at the target image yourself, write HTML/CSS, then let the tools
measure what is still wrong. Never guess what the tools can measure.

## Invocation

The `vlmkit` CLI in this repo runs from source:

```bash
node --experimental-strip-types src/cli/vlmkit.ts <command...>
```

`build component` needs the MoonBit policy core on PATH
(`export PATH=$HOME/.moon/bin:$PATH` if `moon` is not already there).
`build page`, `check palette`, `scan component`, `contract scaffold`
run with no extra setup.

## Pipeline

### 0. Look at the target

Read the target PNG with your own vision. Note the landmark structure
(nav / hero / cards / footer), copy text you can read, and rough
proportions. Then get measured facts:

```bash
vlmkit check palette target.png            # dominant hex colors + outer/inner backgrounds
vlmkit scan component target.png           # optional: bbox + crops of major components
```

### 1. Skeleton

Two options:

- **Contract-first** (best for multi-landmark pages): author a
  `ui.contract.json` from what you see (screens → landmarks with
  role/name/layout policies + viewports), then compile it:

  ```bash
  vlmkit contract scaffold ui.contract.json --out build/
  ```

  The scaffold gives you semantic tags, grid/flex CSS, and responsive
  @media rules for free; you then replace placeholders.

- **Direct**: write `current.html` by hand from the image. Fine for a
  single component.

### 2. Composition loop (page-level)

```bash
vlmkit build page target.png current.html [--crop crops/] [--json]
```

Fix in this order — each class dominates the next:
1. **Missing components** — the report names bbox + fill hex; add the block.
2. **Extra components** — remove or merge.
3. **Ordering violations** — sections rendered in the wrong vertical order.
4. **Stacking gap deltas** — the report says "reduce 72px"; adjust margins.
5. **dSize / dPos on matched pairs** — width/position tuning.

Repeat until: no missing/extra, no ordering violations, all IoU ≥ 0.9.
`--crop` writes per-component target/current pairs for step 3.

### 3. Per-component loop

```bash
vlmkit build component target.png current.html --output-dir out/
```

Read `out/report.json` (machine-readable twin of report.md): goal
status, bbox deltas, heatmap regions with fill hex + kind, text-row
typography (estimated font-size/weight per row), row-gap deltas
("row #3: reduce preceding margin-bottom by 4px"), palette
missing/extra. Apply the Suggested CSS patch entries, re-run.
Stop when `goalEvaluation.status` is `pass` (or diff plateaus).

### 3.5 Multi-viewport targets (media queries)

When the task supplies target PNGs at several viewport widths, one
HTML file must satisfy all of them via `@media`:

- Build the **widest** viewport first as the base stylesheet; express
  every narrower viewport as `@media (max-width: ...)` overrides
  (conventional breakpoints like 768px are fine unless the targets
  imply otherwise).
- Run the composition loop **per viewport**: `build page
  target-desktop.png attempt.html`, then `build page
  target-mobile.png attempt.html`. `build page` renders your HTML at
  each target's own dimensions, so the media query is exercised
  automatically.
- A component present in one viewport and absent in the other (e.g. a
  sidebar hidden on mobile) is *correct* when the narrow target also
  lacks it — implement with `display: none` inside the media query.
  If a viewport's report lists it missing/extra, fix it **inside that
  viewport's media query only**; never regress the converged base.
- Verify declared breakpoints: `vlmkit scan breakpoints attempt.html`
  lists them; `vlmkit check breakpoints attempt.html` renders at
  B−1/B/B+1 and catches off-by-one boundaries (a width that matches
  neither regime), elements vanishing exactly on the boundary, and
  overflow at boundary widths.

### 3.6 Scrollports (scrollable regions)

A screenshot only shows above-the-fold content of a scrollable panel.
Two consequences:

- If the task provides an extra "scrolled to bottom" screenshot, read
  it for the hidden items (real copy, item count). Without one, do not
  invent hidden content — build exactly the visible items and say so.
- Implement with a fixed height + `overflow-y: auto` (the visible
  cut-off row in the screenshot is the tell that the panel scrolls).
- Verify deterministically that the panel actually scrolls:
  `vlmkit scan scroll attempt.html` inventories every real scroll
  container (axis + overflow px) with no annotations needed, and its
  `--json` output includes ready `expectedScrollports` entries; it also
  flags unintended page-level horizontal scroll and overflow:hidden
  cut-offs. (`vlmkit contract introspect` still works when the markup
  carries `data-scrollport` annotations.) A panel that merely *looks*
  cut off but grew to fit its content is a bug the pixel diff of the
  default screenshot won't show.

### 3.7 Interactive states (:hover / :focus)

State styling is invisible in a default screenshot. When the task
provides extra state screenshots (button hovered, input focused),
diff them against the default target *with your eyes* to read the
state delta (darker button, focus ring color/width), then write the
`:hover` / `:focus` / `:focus-visible` rules.

Verify deterministically that the states are actually wired:

```bash
vlmkit build component target-default.png attempt.html \
  --output-dir out/ --states hover focus-visible
```

The forced-state section flags `induced 0%` on interactive elements as
**suspect** (state rule missing), `ua-likely` when only the browser's
default focus ring fired (you forgot the author rule), and
`direction?` when :hover lightens what should darken. Avoid CSS
transitions on state properties — they blur forced-state capture and
real-user perception alike unless the target shows them.

### 3.8 Theme parity (light / dark)

When the task provides light AND dark target screenshots, one HTML
must serve both via `prefers-color-scheme`:

- Put every themed color in a CSS custom property on `:root`, and
  override the *variables only* inside
  `@media (prefers-color-scheme: dark)` — never fork component rules
  per theme. Read each theme's palette off its own target
  (`check palette target-light.png` / `check palette target-dark.png`).
- Dark themes usually swap more than backgrounds: accents shift a
  step lighter (`#2563eb` → `#3b82f6`), text-on-accent may invert,
  badge fills flip from tint to shade. Compare the same component
  across the two targets before assuming a shared value.
- Converge each theme separately: `build page target-light.png
  attempt.html`, then dark. `build page` renders with the OS default
  scheme, so verify the dark render explicitly with a small
  Playwright snippet using `emulateMedia({ colorScheme: "dark" })`
  and pixel-diff it against the dark target (`diff png`).
- Audit: `vlmkit check theme attempt.html` flags components whose
  fill is identical in both themes (**unthemed** — a hard-coded color
  that ignores the scheme). Every major surface should respond.

### 4. Decoration audit

```bash
vlmkit check palette target.png current-render.png   # missing = forgot a color; extra = hard-coded literal
vlmkit check tokens current.html                     # off-scale radius/spacing/z-index/shadow
vlmkit check theme current.html                      # unthemed hard-coded colors (if theming required)
vlmkit check animation current.html                  # if you authored animations: each one visibly moves
                                                     # (dead animations flagged), settle time, reduced-motion parity
```

`check animation` is also why your own `build page` / `diff png` runs can
look nondeterministic: an `infinite-animation` issue names the selector to
`--mask` during captures.

### 5. Optional VLM assist (color naming only)

With `ANTHROPIC_API_KEY` or `OPENROUTER_API_KEY` set:

```bash
vlmkit diff region --baseline target.png --variant render.png \
  --model anthropic/claude-haiku-4-5
```

Use its color pairs as hints, never as structure: VLM region diff is
color-accurate on recolors but shift-blind and can fabricate under
triptych mode (see docs/reports/2026-07-27-vlm-haiku-region-diff-
agent-harness.md). Structure and shift always come from `build page` /
`diff png`.

## Budget & stopping

- 3-5 rounds of step 2 + step 3 combined is normally enough for a
  single-viewport page; the 2026-05-13 dogfoods converged 87% → <2% in
  3-5 rounds. Multi-viewport pages need more — budget 8-12 rounds,
  since a fix at one viewport can regress another (see the dashboard
  proof in docs/reports/2026-07-27-auto-markup-skill-haiku-proof.md).
- If a round does not improve the headline number, change *what* you
  fix (composition vs decoration), not just the values.
- Report final numbers honestly: `build page` matched/missing counts +
  worst IoU, `build component` diff % + goal status.

## Ground rules

- Never open or copy the reference/original HTML if one exists — the
  proof is reconstructing from pixels.
- Trust measured hex from `check palette` over your own eyeball
  estimate; trust bbox/gap numbers over visual guessing.
- Placeholder text is a bug: read the real copy off the target image.
