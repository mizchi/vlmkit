# Re-edit log — checkout-reedit

## Reading the original deck cold

Intent was mostly clear without guessing: five slides, a clean progression
(topology → state → alerts → closing quote), each `##` obviously one slide,
each ```d2 fence obviously "the figure for this slide." Things I still had to
guess:

- **Where a new slide belongs.** The brief says "placed where it makes sense
  in the walkthrough" but the deck gives no marker for insertion points beyond
  slide order. I put "The migration window" between "Where the state lives"
  and "What wakes you up" because it reads as state-detail before
  operational alerts, not because the format told me to.
- **Whether the two figures were meant to stay in sync with each other.** The
  brief said so explicitly ("Both figures have to say so"), but nothing in
  the deck itself cross-references figure 1 and figure 2 — I'd have missed
  that figure 1 also needed `ledger` added if the brief hadn't spelled it out.
- **The `<!-- notes: ... -->` on slide 1 only** — is a missing notes comment
  on every other slide intentional (only one slide needed a spoken aside) or
  an oversight from whoever wrote it? Nothing in the format marks "notes are
  optional per-slide" vs. "the author forgot the rest." I left it alone since
  the brief didn't ask about notes.

Nothing needed guessing on bullet-vs-quote (the `>` marker is unambiguous) or
slide boundaries (`---` on its own line, distinct from the fenced `---` risk
the skill doc calls out — the original deck has no fence containing a bare
`---` so that trap didn't come up here).

## Round 1

Changed:
- Slide 1 ("The three services on the path" → "The services on the path"):
  added `ledger` box and `checkout -> ledger: write` edge to the figure;
  reworded the checkout bullet to say it "now calls **ledger** to record it."
- Slide 2 ("Where the state lives"): added the exact-required phrase
  "no longer writes Postgres directly"; changed the figure from
  `api.checkout -> data.orders` to `api.checkout -> svc.ledger -> data.orders`
  so `ledger` is the drawn writer to `orders`.
- Inserted a new slide, "The migration window", after slide 2: bullets using
  the required "dual-writes" wording and stating which path is authoritative
  now vs. after cutover; a new figure with two edges from `checkout` (to `pg`
  and to `ledger`), each edge labelled with which is authoritative.
- "What wakes you up": added a `409` bullet naming `ledger` and the dual-write
  disagreement, ahead of the existing latency bullet.
- Closing quote: rewrote to drop the forbidden line and name `ledger`
  explicitly, keeping the "one writer per table" framing since it's still true
  — the writer just changed.

Gates run: build (`node .../build-deck.mjs deck.md --out built`), then
`check integrity built/index.html`, `check integrity built/print.html
--viewports 1280`, `check copy built/print.html --manifest built/copy.txt
--allow-invisible unknown`, `check a11y contrast built/print.html`.

What made me change what I changed:
- Build output line `✓ .../built/index.html: 6 slides, 3 figure(s) laid out by
  tala, 27 copy lines → .../built/copy.txt` — no warning line at all, so no
  overflow to chase this round.
- `check integrity` on both views: `verdict: CLEAN (0 fail, 0 warn, 0
  exempted)` on `index.html` (all three viewports) and on `print.html` at
  1280 — nothing to fix.
- `check copy`: `manifest: 27 line(s), missing 0, 3 invisible-allowed` — the
  three invisible-allowed lines are exactly the known
  `copy-invisible (reason: unknown)` limitation the skill doc names for lines
  with inline `**bold**`/`` `code` ``; `missing 0` is the number the brief
  asks for, so no change needed there.
- `check a11y contrast`: `inspected 92 text-bearing element(s)` / `✓ 0
  contrast failure(s)` — 92 across 6 slides is ~15/slide, comfortably over the
  "roughly ten or more" the brief uses to confirm I pointed it at
  `print.html`, not `index.html`.
- Manual grep of `built/copy.txt` for the four required strings
  (`no longer writes Postgres directly`, `dual-writes`, `409`, `ledger`) —
  all four matched, `ledger` matched in the closing quote line
  (`One writer per table, and ledger is the only thing holding the pen for
  orders now.`) as well as three body locations, and the forbidden line
  `One writer per table, and payments is the only thing holding a key.` was
  absent (`grep -F` returned nothing).

All four done-condition checks passed on round 1. Stopped here — budget not
needed further.

## Files I wanted to open but didn't (per the constraints)

- `build-deck.mjs`: wanted to confirm whether copy-manifest text is derived
  purely from rendered DOM text (as the skill doc says) or also picks up
  `<!-- notes -->` comments, to know if adding a notes line to the new slide
  would show up in `copy.txt` and need to match something. Didn't need it —
  I added no notes comment to the new slide, so the question never became
  load-bearing. Recording it as a finding: the skill doc doesn't say whether
  speaker notes count toward the copy manifest at all.

## Friction — the deliverable

1. **"Both figures have to say so" is brief-supplied cross-referencing, not
   format-supplied.** Nothing in `deck.md`'s own structure marks that two
   ```d2 fences on different slides depict overlapping topology and must be
   kept consistent. A reader who only skimmed slide 2 (the explicit
   "Where the state lives" slide) could plausibly leave slide 1's figure
   unchanged and every gate here would still pass — `check integrity`,
   `check copy`, and `check a11y contrast` are all blind to whether two
   figures agree with each other. This is a real gap: the format has no gate
   for figure-to-figure consistency, only page-validity and text-presence
   gates. If the brief hadn't been explicit, the discrepancy would have
   shipped clean.
2. **Slide insertion point is unstated by the format.** `---` on its own line
   separates slides but carries no semantic ordering hint (before/after
   which topic). This is a minor issue for a five-slide deck read
   start-to-finish, but would get harder to reason about in a longer deck
   where "make a new slide fit the walkthrough" depends entirely on reading
   every slide's prose in order.
3. **No gate checks that a removed line is actually gone.** The brief's
   "must no longer contain" requirement (the old closing line) had to be
   checked by hand with `grep -F ... || echo ABSENT`; `check copy --manifest`
   only reports *missing* required lines, never *unexpectedly present* ones.
   For a re-edit task specifically — where the point is often deleting a
   stale claim — a "manifest forbids these lines" mode would have caught this
   without a manual grep.

## The one skill/builder change that would help most

Add a "figure cross-reference" concept to the format or builder — even
something as simple as letting a fence carry an id and warning when two
fences that used to share a set of node ids (via a future rebuild) diverge in
a way the brief implies they shouldn't — so that the "keep two figures in
sync" burden isn't entirely on the editor's memory of the brief. Short of
that: `check copy --manifest` accepting a `--forbid <file>` (a manifest of
lines that must NOT appear) would have replaced my manual `grep -F` with a
gated check, and is the smallest addition that removes real friction for a
"the old thing must go" re-edit task.
