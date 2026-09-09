# Brief: two mermaid diagrams a repository already has, as scenes

A project's docs carry mermaid. Turn two of them into scenes with
`vlmkit-anim import mermaid`, finish what the import cannot know, and deliver
the checked scenes and their figures.

1. `inputs/checkout.mmd` — a `sequenceDiagram` of an order with a retried
   payment. Import it to `checkout.json`. A fact sheet for the result is at
   `facts/sequence-checkout-facts.expect.json` (participants, messages in
   order, frames flattened).
2. `inputs/pipeline.md` — a Markdown page whose first ```mermaid fence is a
   `graph TB` of a verification pipeline with subgraphs. Import it to
   `pipeline.json`. Then make it a figure a reader can follow: give it a
   `title`, and a short `sequence` of three to six captioned beats that walk
   the reader through the pipeline (`highlight` a group, `flow` along an
   edge, a `note`) — whatever you judge tells the story. Render it with
   `vlmkit-anim still pipeline.json --out pipeline.svg`.

Deliver `checkout.json`, `pipeline.json`, `pipeline.svg` and `log.md`.

Success: `vlmkit-anim check checkout.json --expect facts/sequence-checkout-facts.expect.json`
exits 0 with no ✗ and no ⚠; `vlmkit-anim check pipeline.json` exits 0 with no ✗
and no ⚠; `vlmkit-anim layout pipeline.json` reports no issue.

Also record in `log.md`: the exact output of each `import` (the summary line
and every "dropped / changed" line) and whether what it dropped was something
you needed; the exact output of the first `check` on each scene and what you
changed for each line; what you had to add by hand that the mermaid source
did not carry; anything the import got wrong (a node, an edge, a label, a
frame — compare against the source); anything you wanted and could not express.
