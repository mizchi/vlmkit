# Brief: the module map of this workspace

Produce `scene.json` — a **still figure**, not an animation — showing the
packages of this pnpm workspace and which depends on which. The reader is a
contributor deciding where a new piece of code belongs; they need to see the
layers (what is at the bottom that everything rests on, what sits at the top)
and which packages are the browser-bound ones.

Facts come from the repository itself: `package.json` at the root and under
`packages/*/`. Use the workspace-internal dependencies only (`@mizchi/…`),
count optional peers as dependencies, and label modules by their short name
(`core`, not `@mizchi/vlmkit-core`). Group the packages into the sets a
contributor would recognise — at least "needs a browser" versus "pure" — and
give the figure a title.

Deliver `scene.json`, `map.svg` (rendered with `vlmkit-anim still`), and
`log.md`.

The package list and the dependencies, as the `package.json` files state them,
are also written as a fact sheet, `facts/modules-this-workspace.expect.json`,
in the shape `check --expect` reads: use its module ids as written (the root
package is `vlmkit`). The groups are yours to decide; the sheet does not fix
them.

Success: `vlmkit-anim check scene.json --expect facts/modules-this-workspace.expect.json`
exits 0 with no ✗ and no ⚠; `vlmkit-anim layout scene.json` reports no issue;
the direction reads from the picture without a legend.

Also record in `log.md`: how you decided the groups; every coordinate,
colour or canvas size you wrote by hand and why; anything you wanted in the
figure and could not express; and what the layout did that you would have
done differently.
