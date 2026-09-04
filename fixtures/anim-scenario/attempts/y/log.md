# Agent y — graph-bfs re-edit log

## Understanding of the existing walk (before first check)

Original graph: nodes Ann, Bob, Cat, Dan, Eve. Edges Ann-Bob, Ann-Cat,
Bob-Dan, Cat-Eve. The `ops` are a hand-written BFS from Ann that stops the
instant Dan is found:

1. `visit Ann` — Ann becomes current/green (hop 0).
2. `explore Ann->Bob` then `highlight Bob` + `label Bob "1"` — Bob is
   discovered (hop 1) but never given its own `visit`.
3. `explore Ann->Cat` then `highlight Cat` + `label Cat "1"` — Cat is
   discovered (hop 1), same as Bob: `highlight`, not `visit`.
4. `visit Bob` — Bob's turn in the queue: Bob becomes green (visited).
5. `explore Bob->Dan` + `label Dan "2"` — Dan discovered at hop 2. Dan never
   gets its own `visit` op either.
6. `path [Ann, Bob, Dan]` — the answer; per the schema note ("path = the
   answer, painted green") this paints the Ann-Bob and Bob-Dan edges green,
   and by convention should also mark Ann/Bob/Dan as visited-green (they're
   the endpoints of the answer path).

So Cat is only ever `highlight`ed, never `visit`ed — the walk finds Dan via
Bob before Cat's turn comes up in the queue. Eve is never touched at all.

## Change request

Add Fay, friends with Cat and Dan (edges Cat-Fay, Fay-Dan). Two routes to
Dan now exist: Ann→Bob→Dan (2 hops, the existing one) and
Ann→Cat→Fay→Dan (3 hops, the new one via Fay). The walk must find Dan via
the SHORTER route. Since Bob is dequeued (visited) before Cat ever gets its
turn in the original walk, Dan is still found via Bob at hop 2 — strictly
before Fay could ever be discovered through Cat. So the correct edit is:
add Fay and her two edges to the graph, but make NO changes to `ops` — Fay
is discoverable but the walk (as originally written) never actually visits
or explores her, because it stops the moment Dan is found through the
shorter route.

Per the change request: "the narration must mention that Fay was
discovered on the way only if the walk actually reaches her before Dan."
Since the walk never reaches Fay before Dan (it never reaches her at all),
no caption should mention Fay.

## Prediction (written before running `check`)

- **Green nodes at the end**: Ann, Bob, Dan (visited / on the final path).
- **Not green**: Cat (only `highlight`ed, never `visit`ed), Eve (never
  touched), **Fay (never touched — must stay white/unvisited per the
  README's success criterion)**.
- **Edges painted green by `path`**: Ann-Bob and Bob-Dan (the same two
  edges as the original scene; Cat-Fay and Fay-Dan should NOT be green).
