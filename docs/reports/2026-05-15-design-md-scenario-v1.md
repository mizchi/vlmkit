# DESIGN.md → HTML/CSS cross-eval scenario (v1, 2026-05-15)

## Premise

Two parallel subagents, no context about each other, each got:

- `DESIGN.md` (the [Paws & Paths](https://github.com/google-labs-code/design.md/tree/main/examples/paws-and-paths) spec from Google's example)
- A content brief (`fixtures/design-md-scenario/paws-and-paths/brief.md`) — hero + walker profile card + two stat cards
- Goal screenshots (`golden/snapshots/*-baseline.png`) — desktop + mobile
- Tools: `vrt compare`, `vrt diff-for-agent`, file edits
- Budget: 5 rounds

They could NOT see `golden/page.html` or `golden/style.css`. Closed-loop visual evaluation: render → diff → iterate.

The goal of this scenario was not to grade the agents. **It was to grade `vrt` as a feedback loop**, by treating the friction agents hit as the deliverable.

## Final convergence

| viewport | agent-a | agent-b |
|---|---|---|
| wide    | 1.8%  | **0.5%** |
| desktop | 2.0%  | **0.6%** |
| mobile  | 10.3% | **2.8%** |

(Both ended with non-zero mobile; agent-a stalled at a layout-shift wall, agent-b drove mobile down by writing its own playwright probe to extract the deltas vrt would not surface.)

Agent A used **60 tool calls / ~9 min**. Agent B used **146 tool calls / ~24 min** — most of that overage went into the playwright self-probe to recover information vrt did not give them.

## Critical findings (both agents independently)

### F1 — `vrt compare <a.html> <b.html>` produces a confidently false PASS

> **agent-a:** "All viewports 0.0%. Heading mismatch warning… I confirmed via `vrt snapshot` that my page actually rendered correctly. So the 0% diff was a lie."

> **agent-b:** "Result: **0.0 % on every viewport, 'PASS, clean (3/3)'**. That diff is a lie. Three independent vrt bugs hit at once."

Both agents hit this in round 1. Both wasted a round trusting the result. Verified post-run on synthetic input — comparing **`HELLO red/blue`** against **`WORLD green/yellow`** (both `<link rel=stylesheet>` to different local CSS) reports `clean (3/3)` at 0.0% on every viewport.

Three bugs stack to produce this:

1. **File-mode uses `page.setContent(html)`** (`src/migration-compare.ts:661`) with no base URL, so relative `<link href="./style.css">` / `<script src="...">` never resolve in either side. Both sides render bare HTML and look "the same."
2. **Same basename → on-disk filename collision.** Both files are `page.html`; both serialize to `baselineName = variantName = "page"`. The variant screenshot overwrites the baseline screenshot at `<outputDir>/page-<viewport>.png` before the diff runs, so the diff compares the variant against itself.
3. **`--output <path>` is silently ignored.** The flag does not exist; the actual flag is `--output-dir`. Reports always land in `test-results/migration/migration-report.json` regardless of what the user passed.

`--url file://... --current-url file://...` mode works correctly because it goes through `page.goto()` (line 656) which DOES resolve relative hrefs against the file URL. So the "URL-shaped" public interface is fine; only the "path-shaped" interface is broken.

### F2 — `Fix Candidates: no suggestions` every round, on every fixture

Both agents reported the fix-candidate engine emits nothing in this "wireframe mode" (no DOM correspondence between golden and variant trees). `diff-for-agent` even acknowledges "wireframe mode detected" — and then offers zero CSS guesses. The bbox table will tell you `Δ top +12px` but never "this is `.profile`, try `margin-top: var(--s-md)`".

> **agent-a:** "If that's known, the tool could still propose CSS guesses (e.g. 'increase margin-top of nth section by Δy') instead of being silent."

> **agent-b:** "with no DOM correspondence between golden and my variant, the 'Fix Candidates' section was always empty… The bbox table tells you `Δ top +12px` but never which element/selector that is."

### F3 — No way to see the variant render alone

Both agents wanted to see their own page rendered, alongside the heatmap, without having to issue a separate `vrt snapshot` command.

> **agent-a:** "The PNG saved as `page-desktop.png` was NOT the rendered variant — it appeared to be the heatmap/diff overlay rendered against a blank canvas… No way to view 'variant render alone' from `compare`."

> **agent-b:** "A composite triptych (baseline | variant | heatmap) per viewport would cut iteration time in half."

### F4 — Computed-style diff is gated behind Crater BiDi and silently absent without it

Crater BiDi was unavailable for the whole run; both agents got an empty Paint Tree section every round. Agent B compensated by writing their own playwright probe; agent A could not and gave up earlier on font-family / property-level questions.

> **agent-a:** "the entire 'Paint Tree' section was dead in every report. So I had no DOM/computed-style data — only image features."

> **agent-b:** "The font-family bug killed me for two rounds. vrt's typography category counted '1 typography' diff but never surfaced *which* property differed. I only found it by writing my own playwright probe. A `getComputedStyle` diff (which the code clearly has, behind `csdEnabled`) would have made this a 30-second fix."

### F5 — Color deltas printed as hex; no reverse lookup to DESIGN.md tokens

Both agents wanted "Extra color `#dce4f4` ≈ DESIGN.md token `surface-container-high` (#e2e8f8, ΔE 2.1)" instead of raw hex pairs. Closing the loop with the DESIGN.md front matter is the single highest-value addition for a token-driven workflow.

### F6 — Render-sanity warnings should be loud, and should include the variant

> **agent-b:** "The baseline sanity probe warned about Google Fonts failing to load for the baseline. It didn't warn about the same failure for the variant, and never escalated 'your fonts are mid-fallback' to 'your text geometry will not match the baseline.' That warning is the *cause* of the entire mobile diff and yet sits below the report."

If a stylesheet 404s or a webfont falls back, the diff numbers become meaningless. Today the warning is buried; it should be a red banner at the top of the report and ideally a non-zero exit code.

## Findings agent B alone surfaced

### B1 — JSON `variantFile` state-leak across runs

> "the JSON `migration-report.json` from this run had `variantFile` pointing at `attempts/agent-a/page.html` even though I passed agent-b on the command line. The console output and the on-disk screenshots used the correct agent-b path. Looks like the JSON merges with / inherits from an earlier report rather than being overwritten."

Worth investigation — if reports are being merged with stale JSON instead of overwritten, downstream tooling will be wrong intermittently.

### B2 — Display-token math doesn't account for mobile

> "The golden visibly uses a **bigger than 44 px** display on mobile (e.g. 'Walks that' alone fills the line). DESIGN.md doesn't declare a mobile-specific display size."

This is actually a DESIGN.md / golden discrepancy: our golden uses the same `var(--fs-display)` (44px) on mobile, but on a 375px viewport the headline wraps differently. Agent B's intuition that a token-driven spec is incomplete-feeling here is worth noting for any future DESIGN.md scenario authoring.

## What worked

Both agents called out the same three signals as useful:

1. **Text-row Δy table** in `diff-for-agent`. "+24px on every band → bump container top padding by 24px." Concrete and immediately actionable.
2. **Component bbox table with IoU.** Quickly separates "wrong tree" (low IoU) from "wrong position" (high IoU, uniform Δ). Mobile profile-card IoU 0.18 vs desktop 0.70+ told agent A "your mobile layout is structurally wrong" in one glance.
3. **Palette diff** with explicit hex pairs. Both agents fixed the stat-card color in one shot from this signal (agent A) or one shot once they cross-referenced manually (agent B).

These are the load-bearing parts of `vrt`'s agent-facing output today. Everything else is either silent (Fix Candidates), buried (font-load warnings), or simply missing (computed-style diff without Crater).

## Follow-up tracking

Issues filed from this report:

- false PASS in `vrt compare` file-mode (F1 → issue link TBD)
- Token-aware fix candidates in wireframe mode (F2)
- Variant render saved alongside heatmap / triptych output (F3)
- Computed-style diff exposed without requiring Crater BiDi (F4)
- Reverse hex → DESIGN.md token lookup (F5)
- Render-sanity warnings promoted to banner + non-zero exit (F6)
- `migration-report.json` state-leak (B1)

## Reproducing

```bash
# Capture fresh golden snapshots (optional — committed under golden/snapshots/)
node --experimental-strip-types src/vrt.ts snapshot \
  "file://$(pwd)/fixtures/design-md-scenario/paws-and-paths/golden/page.html" \
  --output fixtures/design-md-scenario/paws-and-paths/golden/snapshots

# Replay each agent's final diff
node --experimental-strip-types src/vrt.ts compare \
  --url "file://$(pwd)/fixtures/design-md-scenario/paws-and-paths/golden/page.html" \
  --current-url "file://$(pwd)/fixtures/design-md-scenario/paws-and-paths/attempts/agent-a/page.html"

node --experimental-strip-types src/vrt.ts compare \
  --url "file://$(pwd)/fixtures/design-md-scenario/paws-and-paths/golden/page.html" \
  --current-url "file://$(pwd)/fixtures/design-md-scenario/paws-and-paths/attempts/agent-b/page.html"
```

To re-run the scenario with two new subagents: see the `Agent` invocations described in commit history; the prompts are reproduced under `fixtures/design-md-scenario/paws-and-paths/attempts/agent-{a,b}/log.md` (each agent's own log preserves the workflow it followed).
