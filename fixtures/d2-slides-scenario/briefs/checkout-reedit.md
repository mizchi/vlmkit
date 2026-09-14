# Brief: re-edit — the topology changed under an existing deck

`fixtures/d2-slides-scenario/reedit/deck.md` is a deck somebody else wrote and
presented: five slides about how `checkout` talks to the other services, two
figures, a closing pull quote. It builds clean today.

Copy it into your attempt directory and bring it up to date. You did not write
it; the point is whether the format lets you find and change the right things.

## What changed in the system

1. **The orders table moved behind a service.** There is a new `ledger`
   service. `checkout` no longer writes Postgres directly — it calls `ledger`,
   and `ledger` is now the only writer to `orders`. Both figures have to say
   so.
2. **A migration window exists.** For the next two weeks both paths are live:
   `checkout` dual-writes to Postgres and to `ledger`, and `ledger` is the
   source of truth only after the cutover. This needs **a new slide**, placed
   where it makes sense in the walkthrough, with a figure showing the two
   writes and which one is authoritative.
3. **A new page you can get woken by.** A `409` from `ledger` means the
   dual-write disagreed; it is the migration, not the order. It belongs in the
   existing "What wakes you up" list.
4. **The closing line is now wrong.** It says one writer per table; that is
   still true, but the writer changed. Rewrite it so it names `ledger`.

## Required content

The built `copy.txt` must contain, verbatim:

- `no longer writes Postgres directly`
- `dual-writes`
- `409`
- `ledger` (in the closing pull quote as well as in the body)

And it must **no longer** contain the old closing line
`One writer per table, and payments is the only thing holding a key.`

## Done condition

The build you deliver must satisfy all four:

1. The build exits 0 **with no warning on stderr**.
2. `check integrity` reports no failures on `index.html` (all three default
   viewports) **and** on `print.html --viewports 1280`.
3. `check copy --manifest <built>/copy.txt --allow-invisible unknown` reports
   **missing 0**.
4. `check a11y contrast` on `print.html` reports **0 failures**, over a count
   consistent with every slide being read (roughly ten or more elements per
   slide — a handful means you pointed it at `index.html`).

If you conclude a finding cannot be fixed from the deck source at all, stop
trying: write down exactly what you concluded, what you would need, and deliver
the build anyway.

## From v2 on: a sheet and a forbid list are yours

Two things ship with this brief, because both halves of a re-edit's requirement
are checkable and neither used to be:

- `briefs/facts/checkout-shared.facts.json` — held against **every** slide
  figure that draws the write path, not just one. A figure you forgot to update
  fails it (`forbidden: checkout->orders`), which is exactly the miss a figure
  count cannot see.
- `briefs/facts/checkout-forbid.txt` — the old closing line. Pass it to the copy
  gate rather than grepping for it:

```sh
vlmkit check copy built/print.html --manifest built/copy.txt \
  --forbid fixtures/d2-slides-scenario/briefs/facts/checkout-forbid.txt \
  --allow-invisible unknown
```

Both are part of the done condition.

## Hand in

`deck.md` and the built deck in your attempt directory, plus `log.md`.
