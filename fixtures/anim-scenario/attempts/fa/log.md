# log — modules-this-workspace (attempt fa)

## Facts gathered (from package.json, root + packages/*)

Root `@mizchi/vlmkit` package.json lists all 10 `packages/*` as `devDependencies`
(workspace:*), not `dependencies`/`peerDependencies` — the root CLI bundles them
via `tsdown` at build time rather than depending on them as a published consumer
would. I decided to draw these edges anyway (labelled "dev") because the brief's
question — "where does a new piece of code belong" / "what sits at the top" —
is best answered by showing the CLI as the thing that pulls everything else
together; a map that stopped at `packages/*` would hide that the root exists at
all as a workspace member with its own `package.json`.

Per-package `@mizchi/*` deps (dependencies + devDependencies + peerDependencies
+ optionalDependencies, workspace-internal only):

- core: (none)
- ai: core
- capture: core
- animation-eval: core
- generate: ai
- plan: ai
- anim: ai, animation-eval (both are `peerDependencies` with
  `peerDependenciesMeta.optional: true` — genuinely optional peers, so I
  labelled those two edges "optional peer" per the brief's "count optional
  peers as dependencies" instruction)
- heal: ai, capture, core
- markup: ai, animation-eval, capture, core
- mcp: core, markup

## Grouping decision

The brief asks for at least "needs a browser" vs "pure". I used each package's
own `peerDependencies.playwright` (or `@playwright/test`) entry as the signal,
distinguishing REQUIRED peers (no `optional: true` in `peerDependenciesMeta`)
from OPTIONAL ones:

- **needs a browser** (playwright is a required peer): core, capture,
  animation-eval, heal, markup
- **pure** (no playwright anywhere): ai, generate, mcp, plan
- **browser only for .png / eval** (anim's playwright peer IS marked optional):
  anim alone — I gave it its own group rather than forcing it into either of
  the other two, because it is genuinely in between (its SVG/`still`/`render`
  path needs nothing, only `.png` output and `eval` touch a browser).

I did NOT fold the root CLI into either group. Its own `package.json` marks
BOTH `@playwright/test` and `playwright` as optional peers too, which by the
same literal rule would put it in "pure" — but that reads as wrong for the
thing that ships the whole CLI (most real subcommands need a browser
transitively). I left it ungrouped rather than assert a label the data
doesn't actually support. This is a real gap between what package.json says
and what a contributor would want to know; see "friction" below.

## Round 1 — first `check` output (verbatim, before any edits)

```
⚠ nodes(edge-6-label): "optional peer" is covered by "dev" (35% of the smaller) at step 1 (0ms) and 1 later step(s)
    → move one of them, shorten the text, or widen the canvas
⚠ nodes(edge-23-label): "dev" is covered by mcp (53% of the smaller) at step 1 (0ms) and 1 later step(s)
    → move one of them, shorten the text, or widen the canvas
✓ scene.json (modules): 0 error(s), 2 warning(s)
  560ms · 2 steps (1 captioned) · 57 nodes · 0 tracks / 0 keyframes
  scene 1602 B → timeline 9058 B (×5.7)
  next: vlmkit-anim explain scene.json · vlmkit-anim render scene.json --step N · vlmkit-anim html scene.json --out page.html
```

0 errors (✗), 2 warnings (⚠) on the first attempt.

## Round 2 — fix

Both warnings were text-collision warnings on edge labels: `"optional peer"`
on the anim→animation-eval edge overlapped the `"dev"` label on a nearby
cli→* edge, and one `"dev"` label overlapped the `mcp` node box. Fix:
shortened `"optional peer"` → `"peer"` on the two anim peer-dep edges, and
dropped the `"dev"` label entirely from the ten `cli→*` edges (switched them
from the long form `{"from","to","label":"dev"}` back to the short-form
`["cli", "x"]` array — no label at all).

```
✓ scene.json (modules): 0 error(s), 0 warning(s)
  560ms · 2 steps (1 captioned) · 47 nodes · 0 tracks / 0 keyframes
  scene 1324 B → timeline 7642 B (×5.8)
  next: vlmkit-anim explain scene.json · vlmkit-anim render scene.json --step N · vlmkit-anim html scene.json --out page.html
```

Green after 1 fix round (round 2 of the check loop).

## `layout` result

```
0 of 2 frames with layout issues · 0 overlap(s) · 0 clipped
```

Clean, no issues.

## Hand-typed coordinates / colours / canvas size

None. I did not set `canvas`, `theme`, or any `pos` on any module — the
whole figure (including the three group boxes) is the tool's automatic
`modules` layout from the dependency graph alone. This is a `kind: modules`
scene exactly as intended: "coordinates" never appear in the source.

## What I wanted and could not express

- **"Optional peer" vs "real runtime dependency" as a visual distinction.**
  The only way to mark `anim`'s peer deps on `ai` / `animation-eval` as
  optional was a text label (`"peer"`, after the first round's collision
  forced me to shorten it from `"optional peer"`). There is no `style` value
  for "optional" the way there is `arrow` vs `line` — I would have liked a
  dashed edge or a muted colour for "this dependency does not have to be
  installed" the same way `hidden` exists for nodes/edges elsewhere in the
  guide. As it stands the distinction survives only as a word that has to
  fight for space with every other edge label near the same node, which is
  exactly what broke round 1.
- **"Built at publish time, not a runtime import" for the root CLI's edges.**
  The root `package.json` lists all ten `packages/*` as `devDependencies`
  (bundled by `tsdown`), which is a materially different relationship than
  `heal`'s runtime `dependencies` on `ai`/`capture`/`core`. I ended up
  drawing them identically (plain arrows, no label) once the `"dev"` label
  caused the round-1 warning — there was no lower-effort way to keep the
  distinction without re-triggering a collision, so I let it go rather than
  spend another round fighting label placement for a distinction the brief
  didn't explicitly ask for.

## Layout: what surprised me / would have done differently

I expected (from the guide's "a module's layer is one below the deepest
module it depends on") that a module's vertical position is a pure function
of its OWN dependencies — i.e. `heal` (deps: `ai`, `capture`, `core`) and
`markup` (deps: `ai`, `animation-eval`, `capture`, `core`) have the same
"deepest dependency" (`core`, at the bottom) and so should land on the same
layer. They don't: in the rendered `map.svg`, `markup` sits alone one layer
below `heal` (`heal` shares its row with `generate`/`plan`/`anim`/`mcp`).

I isolated this with a throwaway scene outside this directory
(`/tmp/.../test-layer.json`, deleted after the check — not part of the
deliverable) giving two modules **identical** dependency sets (`heal`,
`markup` both → `{ai, capture, core}`) and one extra top-level module
(`top`) depending on `heal` directly but reaching `markup` only through an
intermediate `mcp`. Result: `heal` and `markup`, despite identical deps,
rendered on *different* layers — `heal` one layer higher, next to `top`'s
other direct dependency `mcp`. So the layer a module lands on is not
"1 + the deepest thing it depends on" (leaf-upward); it behaves like a
longest-path-from-the-root layering (root-downward): a module's position is
pulled toward however many hops the *longest chain from the top* takes to
reach it, through every path, not just its own direct deps. Concretely, in
my real `scene.json`, adding the `cli` module (which depends on nearly
everything, including transitively on `core`/`ai`/`capture`/`animation-eval`
via `mcp → markup → …`) is what pushed those four modules down to the very
bottom band, one layer deeper than their own direct 1-hop distance from
`core` would suggest.

This does not break anything the brief checks — every edge in the final
picture still points strictly downward (I checked all 26 by hand against
the emitted `<line>` coordinates), so direction still reads without a
legend, and `layout`/`check` are both clean. But the doc's one-sentence
description of the layering rule reads as bottom-up-from-leaves, and the
actual behavior is root-down-from-every-source, and the two agree only for
simple graphs without a "depends on nearly everything" aggregator node like
this workspace's CLI. If I were writing the guide, I'd say "a module's layer
is the length of the longest chain of dependencies that leads to it *from
any module that depends on it, however indirectly*" rather than "one below
the deepest module it depends on" — the second reads as local and it isn't.

## Whether every real dependency is drawn

Yes, all 20 workspace-internal `@mizchi/*` edges among `packages/*` (10 real
`dependencies`, 3 required `peerDependencies` treated the same, 2 optional
`peerDependencies` on `anim`) plus the root's 10 `devDependencies` on
`packages/*` are drawn — 26 edges total, cross-checked against the
`node -e "require(...).dependencies..."` dump captured before writing the
scene. None omitted, none invented.
