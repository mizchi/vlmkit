# Markup assistance with vlmkit — deterministic gates for HTML/CSS work

## Quickstart — visual analysis in 5 minutes, knowing nothing

```bash
npm install -D @mizchi/vlmkit
npx playwright install chromium   # once, if you don't have a Playwright Chromium
```

**1. Point it at whatever you're working on** — a dev-server URL or an
HTML file. This finds concrete visual defects with no reference, no
config, no API key:

```bash
npx vlmkit check integrity http://localhost:3000/
```

(If this prints `Unknown check subcommand: integrity`, your installed
release predates the markup-assist gates — update `@mizchi/vlmkit` to
the latest version.)

```
verdict: DEFECTS (2 fail, 0 warn, 0 exempted)

Findings:
  x [page-overflow-x] @768: The page scrolls horizontally by 156px at 768px
    viewport width — sticking out: … > main > p:nth-of-type(1) (right edge 924px).
  x [text-collision] @1280: "Total: €1,240" overlaps "Refunds: €80" by 52x17px —
    same-layer text blocks must not overlap; check negative margins, absolute offsets…
```

Fix what it names, re-run, repeat until `verdict: CLEAN`. It checks 3
viewports at once (JS errors, broken resources, overflow, text
collision/clipping, invisible text, unstyled page, and more).

**2. Track what your edits change visually.** First run captures a
baseline; every run after that reports the pixel diff per viewport:

```bash
npx vlmkit snapshot http://localhost:3000/ --output .vlmkit/snapshots
# …edit your CSS…
npx vlmkit snapshot http://localhost:3000/ --output .vlmkit/snapshots
```

```
  page (http://localhost:3000/)
    desktop    13.11% (raw 0.06%, shift -55px)
    mobile      6.57% (raw 59.80%, shift +55px)
  Compared: 2 | Diff > 0: 2 (100.0%)
```

Diff images land next to the report — intended change? approve the new
baseline (`npx vlmkit snapshot approve --output .vlmkit/snapshots`).
Regression? the diff heatmap shows where.

**3. Go deeper when you need it** (each one command, still key-free):
exact copy present → `check copy page.html --manifest copy.txt` ·
responsive boundaries → `check breakpoints page.html --sweep` ·
keyboard operability → `check interactions page.html` · match a
design screenshot → `verify markup attempt.html --target design.png`.
The full routing table is below. Using a coding agent? Add the MCP
server or the `markup-assist` skill (see Install) and the agent drives
these itself.

---

This page is the self-contained guide to vlmkit's **markup-assist
toolset**: deterministic verification gates (Playwright + DOM/pixel
math) that tell you — or your coding agent — whether generated or
edited markup is actually done, and exactly what to fix when it isn't.

**No API key is required for anything on this page** unless marked
`[key]`. Every gate is deterministic: same input, same verdict. Every
failing gate prints a *kickback* — a machine-parsable next-fix list
with selector attribution — designed to be pasted back into an agent
loop.

You do not need this repository, its fixtures, or any prior context.
Requirements: Node 24+ and a Playwright Chromium
(`npx playwright install chromium` once, if you don't have one).

## Install — three drop-in forms

**CLI** (works everywhere, including CI):

```bash
npm install -D @mizchi/vlmkit   # or: npm i -g / pnpm add -D
npx vlmkit check integrity page.html
```

**MCP server** (for Claude Code / any MCP client) — add to
`.mcp.json`:

```json
{
  "mcpServers": {
    "vlmkit": { "command": "npx", "args": ["-y", "@mizchi/vlmkit", "mcp"] }
  }
}
```

Nine gates become tools (`verify_markup`, `check_integrity`,
`check_copy`, `check_interactions`, `scan_handlers`, `build_page`,
`check_layout`, `check_equivalence`, `verify_flow`). See
`packages/vlmkit-mcp/README.md` for the tool table.

**Agent skill** (for Claude Code): copy
`.claude/skills/markup-assist/` from this repo into your project's
`.claude/skills/`. The skill is self-contained — it teaches an agent
the routing table below and the loop discipline, and assumes only
that `npx vlmkit` runs.

## Many pages at once

Every recipe below takes one page. To run one over a whole route tree:

```bash
vlmkit batch --gate "check integrity" "routes/**/*.html"          # parallel, exit 1 if any page fails
vlmkit batch --gate "check integrity" --gate "check design" "dist/**/*.html" --output ci-logs/
vlmkit batch --gate "check integrity" "routes/**/*.html" --shard 2/3   # one of three CI runners
```

The verdict per page is that gate run's exit code, so anything with the
standard exit contract is batchable. Measured concurrency / sharding budget:
[`reports/2026-08-02-batch-runner-ci-budget.md`](./reports/2026-08-02-batch-runner-ci-budget.md).

Past a handful of pages, put the plan in a file instead of in shell history:

```bash
vlmkit gates init --pages "routes/**/*.html" --gate "check integrity"
vlmkit gates list            # what would run, exact commands
vlmkit gates run --shard 1/3
vlmkit gates suppressions    # every silenced check, with reason/owner/expiry
```

`vlmkit.gates.json` is also where suppressions belong (`--allow-invisible`,
loosened thresholds). A suppression must carry a `reason`, and once its
`expires` date passes it stops being applied — the gate runs unmuted and the
run fails, so a stale exemption gets noticed instead of accumulating. That is
the part a `grep` through npm scripts cannot give you.

## Pick your gate by task

Sources are file paths or URLs throughout. A file is loaded by navigation, so
its relative stylesheets, images and scripts resolve — if your CSS lives in
`style.css` next to the page, the gates measure the page as it actually renders
(this was not true before 2026-08-02; see
[`reports/2026-08-02-external-asset-load-defect.md`](./reports/2026-08-02-external-asset-load-defect.md)).

### I wrote or edited a page — find defects, no reference needed

| Need | Command |
|---|---|
| Broken-page scan: JS errors, empty render, failed resources, text collision/clipping/protrusion, collapsed containers, page overflow, invisible text, text painted over by opaque elements (occlusion), near-misalignment, unstyled page — across 3 viewports | `vlmkit check integrity page.html` |
| The exact copy is spec (spellings, casing, `€`, dates) | `vlmkit check copy page.html --manifest copy.txt` |
| An integrity finding is a deliberate pattern, not a defect | `vlmkit check integrity page.html --allow "near-misalignment@.badge;optically centred"` — reason mandatory, still listed as exempted |
| Structural requirements as a machine-checkable spec (widths, per-row counts, stacking order, per-viewport visibility) | `vlmkit check layout page.html --contract layout.json` |
| Design-system conformance: hard-coded values vs a token scale | `vlmkit check tokens page.html` |
| No token file to check against: is the page consistent with *itself*? (one button style or six; spacing on the page's own scale) | `vlmkit check design page.html` |
| Light/dark theme parity | `vlmkit check theme page.html` |
| WCAG contrast / touch targets / focus order | `vlmkit check a11y contrast\|touch\|focus page.html` |
| Layout survives 30% longer strings (i18n) | `vlmkit stress i18n page.html` |
| A generated/sourced image asset fits its slot (aspect, cut-out background, silhouette contrast, palette harmony) — before swapping it in | `vlmkit check asset sprite.png --slot 220x300 --expect-transparent --against-bg "#241b3a" --page-palette page.png` |

### Match a target design

| Need | Command |
|---|---|
| One-shot done-verdict against target screenshot(s): composition + dynamic gates + pixel diff + kickback | `vlmkit verify markup attempt.html --target target.png` |
| Just the composition diff (missing / extra / ordering / stacking gaps) | `vlmkit build page target.png attempt.html` |
| Converge one component against its crop (iterating diff) | `vlmkit build component crop.png attempt.html` |
| Normalize a Figma export / retina screenshot to CSS pixels first | `vlmkit scan mock export@2x.png` |
| Crop a full-page screenshot into per-component PNGs | `vlmkit scan component page.png` |
| Verify copy against the target's pixels (no manifest available) | `vlmkit check copy attempt.html --target target.png` — writes contact sheets a second reader checks |
| Scaffold from a UI Contract IR (or infer one from existing HTML) | `vlmkit contract scaffold\|introspect\|validate` |

### Behavior, not pixels

| Need | Command |
|---|---|
| Responsive boundaries are exact (no off-by-one at 768px, no width with horizontal overflow) | `vlmkit check breakpoints page.html --sweep --fail-on-suspect` |
| Discover which breakpoints the CSS declares | `vlmkit scan breakpoints page.html` |
| Scroll inventory: containers, page overflow-x, clipped content | `vlmkit scan scroll page.html` |
| Sticky sticks / fixed holds / snap lands | `vlmkit check scroll page.html` |
| Animations visibly animate, settle, respect reduced-motion | `vlmkit check animation page.html` (declared-CSS view: `check motion`) |
| Keyboard-operable controls: probe every interactive element, map ARIA state transitions | `vlmkit check interactions page.html` (`--reference ref.html` turns it into a behavioral contract) |
| Every wired event callback + pointer-only-control detection (clickable `<div>`s) | `vlmkit scan handlers page.html` |
| A scripted user flow with deterministic post-condition asserts | `vlmkit verify flow page.html --flow flow.json` |

### Compare, repair, maintain

| Need | Command |
|---|---|
| Are before/after visually equivalent (refactor, CSS-framework migration)? | `vlmkit migration compare` · `vlmkit diff html a.html b.html` (both need the MoonBit `moon` CLI for region classification — the error message carries the one-line install) · per-region: `vlmkit check equivalence attempt.html --target t.png --region "x,y,WxH"` |
| Pixel/element diff of two renders | `vlmkit diff png` / `vlmkit diff elements` |
| A selector no longer matches after a refactor | `vlmkit heal selector page.html ".old-selector"` |
| Turn a verify-markup kickback into gated CSS fixes automatically `[key]` | `vlmkit heal markup` (LLM; apply-and-rollback gated) |
| VLM transcription of copy contact sheets `[key]` | `vlmkit check copy --target t.png --vlm` |

## The loop discipline

The gates are built for a fix loop, human or agent:

1. Pick a **done condition** — a fixed set of gates (recipes below).
2. Run the gates. Green everywhere → done. Otherwise:
3. Read the kickback. Each line carries what is wrong, where
   (selector attribution), and often the direction of the fix.
4. Fix **the reported thing** — never weaken the page to silence a
   gate (see "What the gates refuse" below).
5. Re-run only the failing gate while iterating; re-run the full set
   once before declaring done.

Every gate invocation is appended to `.vlmkit/run-ledger.jsonl`
(tool, source, headline result) — audit iteration counts from the
ledger, not from an agent's self-report. All gates support `--json`
for machine consumption and `--fail-on-suspect` for CI exit codes.

## Done-condition recipes

**Zero-reference creative build** (a brief, no design image) — the
five-gate set proven across product/dashboard/checkout/app-shell
scenarios, all Haiku-grade:

```bash
vlmkit check integrity page.html                        # CLEAN
vlmkit check copy page.html --manifest copy.txt          # 0 missing, 0 placeholders
vlmkit scan scroll page.html                             # no page-overflow-x
vlmkit scan handlers page.html                           # no pointer-only controls
vlmkit check interactions page.html                      # no suspects
# + when the brief specifies responsive behavior:
vlmkit check breakpoints page.html --sweep --fail-on-suspect
```

**Screenshot-faithful build**: `verify markup` against the target(s),
plus `check copy --target` once composition converges (the sheets
must be read by someone other than whoever transcribed the copy).

**Refactor / migration**: `check integrity` on the result +
`check equivalence` (or `migration compare`) against the before-state.

**PR CI gate**: `vlmkit diff-pr` (per-route thresholds, markdown
summary) or `vlmkit watch` for a local inner loop.

## What the gates refuse (anti-gaming)

These rules exist because agents tried it and got caught:

- **Hidden copy does not count.** `check copy` matches manifest lines
  against *visibly rendered* text — geometrically: font-size:0,
  opacity:0, transparent color, off-screen positioning, text-indent,
  transforms, clip/clip-path, zero-size boxes, same-color camouflage,
  and sr-only text all report as `copy-invisible` with a reason
  class, never as satisfied. (Audited on 7 real sites: 0 false
  positives.)
- **Deliberate invisibility is a flag, not a loophole.** When hidden
  copy is intentional (e.g. the team accepts sr-only), the *caller*
  opts in per class: `--allow-invisible visually-hidden`. Accepted
  lines are still listed with their reason and counted in the ledger.
  Classes: `zero-size`, `hidden`, `transparent`, `visually-hidden`,
  `unreachable`, `camouflage`, `unknown`.
- **Don't ship disclosures open to satisfy the copy gate.** The
  manifest check sweeps disclosure states (closed `<details>`,
  unselected tabs, `aria-expanded=false`) and passes collapsed copy
  *with provenance*.
- **Intentional hiding patterns don't false-positive integrity.**
  `check integrity` reports image-replacement / sr-only / overlay /
  ellipsis patterns under `exempted` instead of failing them.
- **Manifest headings are comments.** `# Section` lines in a copy
  manifest organize; they are not required copy. Keep
  assistive-tech-only strings out of the manifest — it is the
  user-visible copy spec.

## Scope notes

- Deterministic ≠ omniscient: z-index occlusion and non-inset
  clip-path shapes are documented residuals of the copy gate;
  unclipped off-screen-right text is `scan scroll`'s catch
  (page-overflow-x). Resistance is a property of the gate *set*.
- `vlmkit diff region` (VLM region judgment) is deprecated — measured
  net-negative for agent repair; use `diff png --elements-html`,
  `check integrity`, and `check equivalence` instead.
- Everything above renders in headless Chromium. URL sources work
  wherever Chromium has network access.

## Where the evidence lives (this repo)

The gate set was hardened by adversarial evaluation — mutation
batteries against the gates themselves, real-site false-positive
audits, and 18 scripted agent scenarios. If you want the receipts:
`docs/reports/` (dated), `docs/knowledge.md` (accumulated findings),
and the workflow skills (`auto-markup`, `mock-markup`,
`dynamic-markup`) that drive full builds end-to-end.
