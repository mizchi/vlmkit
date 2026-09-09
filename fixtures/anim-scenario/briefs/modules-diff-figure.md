# Brief: a module map before and after a change, as one figure

`inputs/modules-diff-before.json` is a module map of a web service (six
modules, three containers). The team made these changes:

- a new module `search`, which `api` calls and which reads `db` (`api → search`,
  `search → db`);
- `cache` is gone, and with it `api → cache`;
- `auth` moves out of `core` into a new container `identity` (label
  "identity"), on its own;
- `logging` is renamed: its label becomes `logs` (the id stays `logging`).

Everything else stays as it is.

Deliver `after.json` — the map after the change, kind `modules` — and
`change.svg`, the **diff figure**: `vlmkit-anim diff inputs/modules-diff-before.json after.json --out change.svg`.

A fact sheet is at `facts/modules-diff-figure.expect.json`; it fixes what the
change adds, removes, moves and relabels.

Success: `vlmkit-anim diff inputs/modules-diff-before.json after.json --expect facts/modules-diff-figure.expect.json`
exits 0 with no ✗; `vlmkit-anim check after.json` exits 0 with no ✗ and no ⚠;
in `change.svg`, `search` and `identity` are in the accent colour and `cache`
is drawn dashed and grey inside `infrastructure`.

Also record in `log.md`: the exact output of the first `diff --expect` run;
each line it reported and what you changed for it (quote the line); what the
printed change line said and whether it matched what you meant; what you
looked at in `change.svg` to confirm the figure shows the change; anything you
wanted the figure to show and could not express.
