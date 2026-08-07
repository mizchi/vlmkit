---
name: component-vrt
description: Focus visual regression testing on ONE component instead of a whole page, so the diff is small enough to read and to hand to a model. Mounts a story from a Playwright component-testing gallery and screenshots only that component (`vlmkit check story`), then loops baseline → diff → fix → re-run to green. Includes copyable gallery reference implementations (vanilla / React / Vue) because Playwright ships no template for the gallery. Use when repairing or restyling a specific component, when a full-page diff is too noisy or cascades, or when a project wants per-component VRT baselines. Not for whole-page comparison (use vrt-visual-diff) or for generating browser tests from a spec (use spec-to-playwright).
metadata:
  internal: true
---

# component-vrt

Repairing one component with a full-page diff is the wrong instrument. The image
is large, the diff **cascades** — nudge a header and every row below it reports as
changed — and the part under repair is buried in the part that is not.

`vlmkit check story` mounts one story and screenshots **only that component**.
Measured on this skill's own fixture: 30,448px across three stories against
1,440,000px for the same count of full-viewport shots — **47x smaller** — and a
story that did not change stays green when a shared stylesheet does.

## When to use this instead of a page gate

| Situation | Use |
|---|---|
| Restyling / repairing one component | **this skill** |
| Component renders differently in two places on one page | `vlmkit check drift component` |
| Whole page vs whole page, two current renders | `vrt-visual-diff` |
| Natural-language spec → browser test | `spec-to-playwright` |
| Edited markup, no reference, want correctness gates | `markup-assist` |

### Two cases where a story diff is the *weaker* instrument

Measured over 65 trials
([report](https://github.com/mizchi/vlmkit/blob/main/docs/reports/2026-08-06-component-vs-page-vrt-signal.md)).
Both are about `check story` being a **pixel** instrument, while `diff html` also
reads computed styles:

1. **A large component with the default threshold.** On a 1258x203 hero, story
   diffs missed 6 of 12 seeded changes where `diff html` missed 0. A corner-radius
   change moves ~60 pixels — over 1.6% of a button, 0.02% of that hero, under the
   0.5% default. Get a per-story threshold from
   `vlmkit build gallery`, or compute one; do not reuse the default on a big
   component.
2. **Sub-perceptual style drift.** A pale-palette shift moved 96% of that hero's
   pixels by ≤8/255 per channel, which the comparator scores as **0% changed** —
   no threshold reaches that. `diff html` catches it from the changed
   `background-image` declaration. `check story` now *reports* it as
   `sub-perceptual-drift` (a warn, so the verdict is unchanged) rather than
   letting it read as a clean pass — but the comparator still passes it, so a
   project that treats tint drift as a regression must promote the rule.

So story VRT narrows what a page diff has to catch; **it does not replace it.**
Keep a page-level `diff html` in the suite.

## Prerequisite: does the project have a gallery?

A **gallery** is one page exposing `window.mount({ story, props })` /
`window.unmount()` that renders into `#root`. It is the half of Playwright
component testing that lives in the user's repo, and Playwright's docs are
explicit that it is framework-specific with **no template to copy**.

Check in this order:

1. **A gallery already exists** — look for `window.mount` in the repo, or a
   `baseURL` in `playwright.config.*` pointing at a gallery/ path. Use it.
2. **No gallery** — copy one from `assets/`. Do not write one from scratch;
   the templates already handle the two things that break screenshots (awaiting
   layout, freezing animation). Read
   [`assets/_gallery-contract.md`](./assets/_gallery-contract.md) first, then:

   | Stack | Copy |
   |---|---|
   | React | `assets/gallery.react.template.tsx` + `assets/gallery.host.html` |
   | Vue | `assets/gallery.vue.template.ts` + `assets/gallery.host.html` |
   | No framework / want zero setup | `assets/gallery.vanilla.html` (runs over `file://`) |

   Drop `.template` from the filename and adjust the `import.meta.glob` to the
   project's story layout. That glob is the only non-portable line.
3. **No stories either** — `assets/button.story.template.tsx` shows the shape,
   including the hidden-form pattern for state.
4. **The components are already built and rendered on a page, and you only want
   VRT over them** — generate the gallery from that page instead of writing one:

   ```bash
   vlmkit build gallery dist/index.html --out .vlmkit/gallery
   ```

   It captures each component's markup and the page's CSS, and prints the
   `check story` commands with a per-story threshold derived from each
   component's area. The tradeoff: captured markup is frozen, so `props` do
   nothing and behaviour is not exercised. Take option 2 over this whenever the
   component's states matter.

**Do not add a Playwright version bump for this.** The `mount` *fixture* is
1.62+, but `check story` does not use it — it drives the page-side contract via
`page.evaluate`, exactly as the fixture does. Only add
`assets/playwright.ct.config.template.ts` if the user also wants behavioural
component *specs*.

Storybook is **not** drop-in: its iframe renders from a URL query param and
exposes no `window.mount`, so `check story` reports `mount-failed`. A shim in
`.storybook/preview.js` would bridge it; that is unverified, so say so rather
than promising it.

## The loop

```bash
G="http://localhost:5173/playwright/gallery/index.html"   # or file://$PWD/gallery.vanilla.html

# 1. First run writes baselines and reports new-baseline — NOT a pass.
vlmkit check story components/Button/Primary --gallery "$G"

# 2. Edit the component. Re-run: the diff is the component, at component size.
vlmkit check story components/Button/Primary --gallery "$G"
#   ✗ components/Button/Primary   88x40   15.97% diff (562/3520px)
#       heatmap: .vlmkit/stories/components-Button-Primary/...heatmap.png
#       region 0,0 96x64 content

# 3. Read the heatmap and the region list, fix, re-run until green.
# 4. When the change was intended, approve it:
vlmkit check story components/Button/Primary --gallery "$G" --update-baseline
```

Several stories share one browser — list them together rather than looping in the
shell:

```bash
vlmkit check story components/Button/Primary components/Button/Disabled components/Card/Default --gallery "$G"
```

Useful flags: `--props '{"title":"Hello"}'`, `--viewport 400x300`,
`--threshold 0.02`, `--root '#app'`, `--settle 200`, `--out <dir>`.

Machine-readable: `--json` gives the shared gate envelope, with region geometry
and shift estimates under `findings[].evidence.regions` — read that rather than
parsing the prose.

## Reading the outcome

Three rules, and the difference between the first two decides what you do next.

| Rule | Means | Action |
|---|---|---|
| `story-drift` | The component changed vs its baseline | The finding you asked for. Read regions, fix, or `--update-baseline` if intended. |
| `mount-failed` | **Nothing was measured** — unknown story id, render throw, page is not a gallery | Fix the id or the gallery. **Never** `--rule check.story/mount-failed=off` to reach green: that makes a typo'd story id read as a passing component. |
| `sub-perceptual-drift` | The story **passed**, but most of its pixels moved by less than the comparator counts — the signature of a palette / gradient / opacity change, not of antialiasing | Look at it. This is the one blind spot a story diff has that a page `diff html` does not (it reads computed styles). Promote to `suspect` in `vlmkit.gates.json` if your project treats tint drift as a regression. |
| `new-baseline` | No baseline existed, so one was written | Re-run to actually compare. Commit the baseline. |

## Done conditions

- Every targeted story reports `unchanged`, or its change is approved with
  `--update-baseline` and the new baseline is committed.
- No `mount-failed` findings.
- `vlmkit check story <stories> --gallery <url>` exits 0 without `--advisory`.
- Any story over ~50,000px carries a derived `--threshold` rather than the
  default, and a page-level `diff html` still covers what story diffs cannot see
  (see above).

## Persisting the set

Once the stories matter, list them in `vlmkit.gates.json` so CI runs the same set
and the story ids stop drifting:

```jsonc
{
  "defaults": {
    "gates": [
      "check story components/Button/Primary --gallery http://localhost:5173/playwright/gallery/index.html",
      "check story components/Card/Default --gallery http://localhost:5173/playwright/gallery/index.html"
    ],
    "rules": { "check.story/new-baseline": "off" }
  }
}
```

That config is also the fix for the one sharp edge: **baselines are keyed on the
story id as written.** The gallery owns id resolution and the contract offers no
way to ask what an id resolved to, so `Button/Primary` and
`components/Button/Primary` get *separate* baselines. Pick one spelling per story
and keep it.

## Flake

A component-scoped shot removes most page-level flake by construction. What is
left, in order of how often it is the cause:

1. **Fonts.** A fallback substituting mid-run reads as real drift. Self-host the
   fonts the component uses.
2. **Animation.** Freeze it in the gallery's `window.mount` — the templates here
   already do. `--settle <ms>` is the fallback, not the fix: waiting slows every
   run and only reduces the flake.
3. **Threshold.** Default is `0.005`, deliberately tighter than a page default:
   on a 3,520px button a handful of stray pixels is already a percent. Raise it
   per-story with `--threshold` rather than globally.

## Related

- `vlmkit rules check story` — the rule table with default severities.
- [`examples/story-gallery/`](https://github.com/mizchi/vlmkit/tree/main/examples/story-gallery)
  in the vlmkit repo — the vanilla gallery as a runnable project, plus a README
  with the React + Vite version.
