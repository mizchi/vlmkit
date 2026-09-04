# Attempt y — re-edit graph-bfs (sonnet)

First-attempt result: 0 ✗ / 0 ⚠. `check` passed on the first try; rounds to green: 1.

Success criteria — all met. `explain` reads as one walk, unchanged in substance (no mention of Fay, since the walk never reaches her): "Next in the queue: Bob" → "Bob knows Dan: hop 2 — found" → "Yes: Ann → Bob → Dan, two hops". End-frame SVG: green fill on `node-Ann`, `node-Bob`, `node-Dan`; `node-Cat` amber (highlighted, not visited); `node-Eve` and `node-Fay` white — Fay stays unvisited, as required. Green-stroke edges: Ann–Bob, Bob–Dan; Cat–Fay and Fay–Dan stay black.

Prediction vs actual: identical in every particular.

Edit made: added `"Fay"` to `nodes`, added `["Cat","Fay"]` and `["Fay","Dan"]` to `edges`. Left every op untouched — the original walk dequeues Bob (finding Dan at hop 2) before Cat's turn ever comes, so Fay, reachable only through Cat, is never discovered by this hand-written walk regardless of her existing in the graph.

What made intent readable: the schema line "`visit` = current (accent, larger) then visited (green); … `path` = the answer, painted green" told me which ops produce which final colours; reading the ops in sequence (`highlight` for Cat vs explicit `visit` for Ann/Bob) made clear that "visited" and "merely discovered" are distinct states — exactly the distinction the task turns on.

What was ambiguous: `highlight`'s resulting colour is never named in the guide (only visit → green and path → green are documented); I confirmed Cat renders amber, not green, only by rendering the SVG. Wish-it-said: "highlight = a temporary accent colour (amber), distinct from the green of visit/path — the node stays that accent, not green, if never explicitly visited." Also, "With an algorithm the check fails unless every node reachable from start was visited" explains why the README bans `algorithm` mode here (it would force-visit Fay), but the guide never states that connection outright — worth adding "use explicit ops when a walk should be allowed to leave a reachable node undiscovered."

Diagnostics: none fired — the edit was correct on the first pass.
