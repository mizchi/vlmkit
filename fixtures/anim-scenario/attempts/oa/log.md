# Log — modules-diff-figure (attempt oa)

## 1. What I read

- `fixtures/anim-scenario/briefs/modules-diff-figure.md` (the brief)
- `fixtures/anim-scenario/briefs/inputs/modules-diff-before.json` (the before map)
- `fixtures/anim-scenario/briefs/facts/modules-diff-figure.expect.json` (the diff fact sheet)
- `docs/anim-ir.md`, in full (the writing guide) — read closely: the common
  fields, `kind: modules` section, "Still figures", "The diff figure", and
  "Checking a figure against the facts"
- `pnpm exec vlmkit-anim --help`
- `pnpm exec vlmkit-anim schema --kind modules`
- `pnpm exec vlmkit-anim schema --kind diff`
- `pnpm exec vlmkit-anim schema --kind expect`

I did not open anything under `packages/vlmkit-anim/`, other attempt
directories, `docs/reports/`, `CHANGELOG.md`, or any test file, and did not
grep the repo for examples.

## 2. Rounds

### Round 1

Wrote `after.json` directly from the brief's four bullet points plus the
before map, without an intermediate run: added module `search` (deps
`api->search`, `search->db`), removed module `cache` (and `api->cache`),
moved `auth` out of the `core` group into a new group `identity` (label
"identity", containing only `auth`), and relabelled `logging`'s label to
"logs" (id unchanged). Everything else copied verbatim from
`modules-diff-before.json`.

Command 1 (from `fixtures/anim-scenario/briefs/`):

```
$ pnpm exec vlmkit-anim check ../attempts/oa/after.json
```

Full output:

```
✓ after.json (modules): 0 error(s), 0 warning(s)
  560ms · 2 steps (1 captioned) · 24 nodes · 0 tracks / 0 keyframes
  scene 578 B (minified) → timeline 3768 B (×6.5)
  next: vlmkit-anim explain ../attempts/oa/after.json · vlmkit-anim render ../attempts/oa/after.json --step N · vlmkit-anim html ../attempts/oa/after.json --out page.html
```

No ✗ or ⚠ lines were reported, so no change was made in response to this run.

Command 2 (from `fixtures/anim-scenario/briefs/`):

```
$ pnpm exec vlmkit-anim diff inputs/modules-diff-before.json ../attempts/oa/after.json --out ../attempts/oa/change.svg --expect facts/modules-diff-figure.expect.json
```

Full output:

```
+1 module (search) · +2 deps (api->search, search->db) · +1 group (identity) · −1 module (cache) · −1 dep (api->cache) · 1 moved (auth: core → identity) · 1 relabelled (logging: "logging" → "logs")
wrote ../attempts/oa/change.svg
✓ the change is what modules-diff-figure.expect.json says
```

The single reported line is the printed change summary. It is not an
error/warning line from `--expect` (that came back as a bare ✓ with no
mismatch lines), so nothing needed to change: `--expect` matched on the
first attempt. No further rounds were run — the brief's success condition
(both commands exit 0, no ✗) held after round 1.

## 3. The brief's questions

**Did the printed change line match what I meant?**

```
+1 module (search) · +2 deps (api->search, search->db) · +1 group (identity) · −1 module (cache) · −1 dep (api->cache) · 1 moved (auth: core → identity) · 1 relabelled (logging: "logging" → "logs")
```

Yes, term for term against the brief's four bullets:
- `+1 module (search)` / `+2 deps (api->search, search->db)` — the new module and its two edges.
- `−1 module (cache)` / `−1 dep (api->cache)` — cache and the edge that named it.
- `1 moved (auth: core → identity)` — the container change, correctly reported as a move rather than as a remove+add.
- `1 relabelled (logging: "logging" → "logs")` — the id held, the label changed, exactly as asked.

Nothing appeared that I did not intend (no accidental group removal, no
untouched dep reported as changed), and nothing I intended is missing from
the line.

**What did I look at in `change.svg` to confirm the figure shows the change?**

I read the raw SVG (not a rendering) and checked, element by element:
- `<g id="search" ...><rect ... fill="#f59e0b" .../>` — the new module's box
  is filled with the accent colour (`#f59e0b`), matching "added in the accent
  colour."
- `<g id="identity" ...><rect ... fill="none" stroke="#f59e0b" .../>` — the
  new container's outline is the same accent colour.
- `<g id="auth" ...><rect ... fill="#f59e0b" .../>` — `auth` itself is also
  drawn filled accent (the guide says a moved module is accent too), so the
  move reads as a colour change on the module, not only on the container
  outline.
- `<g id="logging" ...><rect ... fill="#f59e0b" .../><tspan>logs</tspan>` —
  the relabelled module is drawn with its new label ("logs") and is also
  accent-coloured, consistent with "a module that changed ... label[] is
  accent too."
- `<g id="cache" ...><rect ... fill="#ffffff" stroke="#9ca3af" .../><tspan
  fill="#9ca3af">cache</tspan>` and its position (`transform="translate(712
  403)"`), which falls inside the `infra` container's drawn rectangle
  (`transform="translate(460.1 395)"`, half-width 322.1, half-height 40.2 —
  cache's box at x=712,y=403 is well within that span). So cache is grey and
  drawn inside `infrastructure`, matching "removed module inside the
  container it left, when that container survives."
- The dependency `edge-7` (`api->cache`, the removed dep) is drawn
  `stroke="#9ca3af" stroke-dasharray="6 4"` — dashed grey, as the guide
  promises for a lost dependency.
- The legend block (`text-main-0-line-*`) restates the same six-part change
  as free text next to the picture.

One partial mismatch worth flagging: the brief's success condition says
"`cache` is drawn dashed and grey" — the module *box* for `cache` is grey
(`stroke="#9ca3af"`, grey label text) but its `<rect>` carries no
`stroke-dasharray`; only the *dependency edge* into it is dashed. So "grey"
holds for the module, "dashed" holds for the edge, but the module box itself
is solid-stroked, not dashed. I could not find anything in
`inputs/modules-diff-before.json` or `after.json` I could change to affect
this — the diff tool decides how a removed module's box is drawn, and
nothing in the scene schema (per `schema --kind modules` / `schema --kind
diff`) exposes a per-module "dashed" style for the `diff` command's own
output. I read this as the tool's fixed rendering choice, not something the
scene author controls, so I did not change either JSON file in response.

**Anything I wanted the figure to show and could not express?**

I wanted to state directly, in the after-map, *why* `auth` moved (e.g. "split
out for its own deploy") — a one-line rationale next to the `identity`
container. `schema --kind modules` documents `groups[].label` (the
container's name) but no secondary/subtitle text field on a group, and a
`callout`/`text` annotation is a `sequence` op — `still`/`diff` render a
scene with no sequence, and I did not want to invent a one-beat `sequence`
on `after.json` since the brief only asked for the plain after-map plus the
auto-generated diff figure (the diff command's own legend already states
the *mechanical* fact "1 moved"; I wanted the *reason*, which the format has
no slot for). I left it out rather than guess at extending the diff schema.

## 4. Friction

- The `diff` command's help text and the "diff figure" section of the guide
  both say a removed element is drawn "dashed and grey," in the same breath
  for modules and dependencies. In the rendered SVG this is true for a
  removed *dependency* (`stroke-dasharray` is present) but not for a removed
  *module*'s own box (grey stroke/text, no dasharray). I initially expected
  to see a dashed rectangle around `cache` and had to open the raw SVG and
  check for the `stroke-dasharray` attribute by hand to find out this was
  not the case. The guide could say explicitly "a removed module is drawn
  with a grey (not dashed) box; a removed dependency is drawn dashed" if
  that is the intended, permanent behaviour — as written I could not tell
  whether I had misused the tool or the tool simply does not dash boxes.
- Nothing else was unclear: `schema --kind modules`, `schema --kind diff`,
  and `schema --kind expect` each gave a complete, minimal, directly-usable
  example, and the "diff figure" section of `docs/anim-ir.md` named the
  exact fields (`added`/`removed`/`moved`/`relabelled`) I needed for the
  fact sheet and told me in advance that "a change the sheet does not name
  is an error too" — which is why I made sure `after.json` changed *only*
  the four things the brief listed and left every other id, label, and edge
  byte-for-byte as in the before map.
- I did not have to guess at anything materially: the before map's group
  structure (`edge`/`core`/`infra`) made "auth moves ... into a new
  container `identity`, on its own" unambiguous (a fourth, one-member
  group), and "cache is gone, and with it `api → cache`" was explicit enough
  that I did not need to reason about whether any other edge implicitly
  depended on `cache` (none did).
- Nothing in the guide would need to change for correctness on my end; the
  only guide change I'd suggest is the one dashed-box wording fix above.
