# HTTP/2 Multiplexing Animation — Attempt Log

## Completion Time Calculations

Assets: a=2, b=3, c=1, d=1, e=2, f=1 (10 units total)

### HTTP/1.1 (2 connections, FIFO)
Requests in order: a, b, c, d, e, f

Timeline:
- t=0: a → Conn1, b → Conn2
- t=2: c → Conn1 (a finishes)
- t=3: d → Conn1 (c finishes), e → Conn2 (b finishes)
- t=4: f → Conn1 (d finishes)
- t=5: All done (e and f finish)

Completions: a=2, b=3, c=3, d=4, e=5, f=5
**Total time: 5 units**

### HTTP/2 (1 connection, 6 concurrent streams)
All 6 assets start at t=0 and progress concurrently within one multiplexed connection.

Individual completions (time for each asset's full data to be sent):
- c=1, d=1, f=1 (finish at t=1)
- a=2, e=2 (finish at t=2)
- b=3 (finish at t=3)

**Total time: 3 units** (max of all stream completion times)

Key improvements for HTTP/2:
- c: 3→1 (2 units faster)
- d: 4→1 (3 units faster)
- e: 5→2 (3 units faster)
- f: 5→1 (4 units faster)

## Strategy

**Kinds chosen:** `distributed` (2 scenes)
- Scene 1: HTTP/1.1 with 2 connection nodes
- Scene 2: HTTP/2 with 1 connection node
- Index: ordering and brief description

**Why distributed:**
- Naturally shows multiple parallel streams (HTTP/1.1's 2 connections)
- Messages flow through nodes, making asset transfers visible
- Can show timeline and captions for completion

## Predictions for `explain` output

Scene 1 (HTTP/1.1):
- "Start: request a, b on two connections"
- "Conn1 receives a (2 units)"
- "Conn2 receives b (3 units)"
- "Conn1 finishes a, receives c (1 unit)"
- "Conn1 finishes c, receives d (1 unit)"
- "Conn2 finishes b, receives e (2 units)"
- "Conn1 finishes d, receives f (1 unit)"
- "All done: total time 5 units. a=2✓, b=3✓, c=3, d=4, e=5, f=5"

Scene 2 (HTTP/2):
- "Start: all 6 assets on one connection, concurrent streams"
- "Stream c complete (1 unit)"
- "Streams d, f complete (1 unit)"
- "Streams a, e complete (2 units)"
- "Stream b complete (3 units)"
- "All done: total time 3 units. HTTP/2 is 40% faster!"

## First Attempt Predictions
- ✓ or ⚠: Likely issues with message timing/ordering in distributed kind
- May need explicit `after` anchoring to show FIFO behavior
- May need to use `latency` field to show duration of asset transfer
