# Brief: the import cycle in a service's modules

A code review found "circular import" warnings in a service. Produce
`scene.json` — a still figure — that shows the module dependency graph and
makes the cycle **the** thing a reader sees first, so the team can decide
where to cut it.

The imports, as the bundler reports them (`a imports b`):

```
server     imports router, config, logger
router     imports handlers, middleware
handlers   imports services, validation
middleware imports auth, logger
auth       imports services, config
services   imports repo, events
events     imports handlers
repo       imports config, logger
validation imports config
```

Draw all nine modules and every import. The cycle must be distinguishable from
the rest of the graph at a glance, and the figure should name the edge you
would cut and why (one short line, in the figure, not only in the log).

Deliver `scene.json`, `cycle.svg` (rendered with `vlmkit-anim still`) and
`log.md`.

Success: `vlmkit-anim check scene.json` exits 0 with no ✗ (a ⚠ is acceptable
only if your log says which one and why you kept it); `vlmkit-anim layout
scene.json` reports no issue; the picture has every edge from the list and no
other; the cycle's edges are visually distinct from the acyclic ones.

Also record in `log.md`: what the tool told you about the cycle and whether
that was before or after you found it yourself; every coordinate, colour or
canvas size you wrote by hand and why; anything you wanted in the figure and
could not express.
