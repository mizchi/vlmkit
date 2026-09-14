# D2 Diagram Progress Log

| Round | Change | Signal | Width |
|-------|--------|--------|-------|
| 1 | Fixed underscore syntax: changed `_.outside.stripe` to explicit container paths (`edge.cdn`, `cluster.orders`, `outside.stripe`), allowing d2-facts to render | d2-facts.mjs initially failed with "invalid underscore" on line 40; switching to explicit fully-qualified paths resolved the compile error | 114 |
| 2 | Added `direction: down` to the cluster container (the fullest with 7 boxes) | d2-facts.mjs reported width 114 > 100; applied layout lever per skill guidance ("set the root direction, then the own direction of the container holding the most boxes"); width dropped to 65 | **65** ✓ |

**Done condition met at Round 2:**
- ✓ d2 validate exits 0
- ✓ d2 fmt --check exits 0  
- ✓ d2-facts --expect exits 0 (65 columns ≤ 100)
- ✓ Terminal render is readable and accurate
