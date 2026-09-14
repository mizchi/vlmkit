# The false green, frozen

v2's writer `f` pinned `products` with `top` / `left`, watched the terminal
render's width fall 113 → 71, and `d2-facts` passed it: `✓ width 71 ≤ 100
columns`, `10 ok, 0 warning(s), 0 error(s)`, exit 0. The 71 was a measurement of
a fragment — the pin had pushed shapes off the ascii canvas, so the `.txt` holds
**two of the five tables** while the SVG had grown to boxes at x=1893. `d2`
exits 0 on that truncation.

These three files are that state, kept so the check that now catches it has
something to catch with no `d2` installed:

```sh
node .claude/skills/d2-diagram/assets/d2-facts.mjs \
  --from-svg shop-schema-pinned.svg --from-txt shop-schema-pinned.txt \
  --expect ../../briefs/facts/shop-schema.expect.json
# ✗ the terminal render is truncated: 3 of 5 boxes are missing from it
#   (customers, orders, shipments) — so the column count below measures a fragment.
```

`tests/d2-facts.test.mjs` asserts exactly that, which is how the checker is
gated in CI: the `d2` binary is not installed on the runner, so the test drives
the reader half over these committed renders.
