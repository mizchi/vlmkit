# Vector clocks — scene order

1. `scene-1.json` (kind: `matrix`) — builds up the three processes' vectors
   as a 3x3 table (rows A/B/C, columns a/b/c): A's local event, A→B message
   (max then increment), C's concurrent local event, B→C message (max then
   increment). Ends with A=[1,0,0], B=[1,1,0], C=[1,1,2].
2. `scene-2.json` (kind: `vector`) — freezes and juxtaposes two historical
   snapshots side by side to answer "can these be ordered?": A's local
   event vs C's local event (concurrent, neither ≤), then A's local event
   vs C's final vector (ordered, A ≤ C).
