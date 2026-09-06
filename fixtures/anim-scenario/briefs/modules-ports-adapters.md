# Brief: ports and adapters (hexagonal architecture), as a figure

Produce `scene.json` — a still figure — explaining the **ports and adapters**
rule to a developer who keeps importing the database client from the domain
layer. The one thing they must take away: **every dependency points inward,
toward the domain; the domain depends on nothing outside itself.**

The parts: an HTTP handler and a CLI command (the driving side), the
application services, the domain model, a repository *port* (an interface the
domain owns), and two adapters that implement it — a Postgres repository and
an in-memory one used by tests. Show which side each part sits on and that the
adapters depend on the port, never the other way round.

Then say what the reader is doing wrong: mark the dependency they keep adding
(domain → Postgres) as the one that must not exist, in the figure itself.

Deliver `scene.json`, `figure.svg` (rendered with `vlmkit-anim still`) and
`log.md`. If you also want a walked version (beats), put it in the same
`scene.json` as a `sequence` and note that `still` shows its last frame.

The parts, their dependencies and the sides are also written as a fact sheet,
`facts/modules-ports-adapters.expect.json`, in the shape `check --expect`
reads: use its module and group ids as written. (The port's interface names
domain types, so the port depends on the domain; the adapters depend on the
port; the domain depends on nothing.)

Success: `vlmkit-anim check scene.json --expect facts/modules-ports-adapters.expect.json`
exits 0 with no ✗ and no ⚠; `vlmkit-anim layout scene.json` reports no issue;
the forbidden dependency is visibly different from the real ones.

Also record in `log.md`: which kind you chose and what you considered;
every coordinate, colour or canvas size you wrote by hand and why; how you
marked the forbidden dependency and whether the guide told you how; anything
you wanted in the figure and could not express.
