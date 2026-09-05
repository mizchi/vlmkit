# HTTP/2 Multiplexing Animation — Development Log

## Timing Calculations (Round 0)

### Assets: a(2), b(3), c(1), d(1), e(2), f(1) — request order: a, b, c, d, e, f

**HTTP/1.1 (2 connections, FIFO queue per connection):**
- Request order: a, b, c, d, e, f
- First free connection policy:
  - Conn1: a(2) → c(1) → e(2) = 5 units total
  - Conn2: b(3) → d(1) → f(1) = 5 units total
- Completion times: a=5, b=5, c=3, d=4, e=5, f=5
- Total time: 5 units
- Bottleneck: both connections finish at t=5

**HTTP/2 (1 connection, round-robin 1-unit frames):**
- All assets send frames interleaved, each making 1-unit progress per time step
- Timeline:
  - t=1: a(1/2), b(1/3), c(1/1✓), d(1/1✓), e(1/2), f(1/1✓)
  - t=2: a(2/2✓), b(2/3), e(2/2✓)
  - t=3: b(3/3✓)
- Completion times: a=2, b=3, c=1, d=1, e=2, f=1
- Total time: 3 units
- Speedup: 5→3 (40% faster overall)

**Key improvements to highlight:**
- c: 3 → 1 (2 units faster)
- d: 4 → 1 (3 units faster)
- f: 5 → 1 (4 units faster)
- a, e: 5 → 2 (3 units faster)
- b: 5 → 3 (2 units faster)

## Scene Strategy

**Kind chosen:** `compose` with two `chart` panes
- **Why:** The brief asks to show "both, ideally side by side" so the viewer compares timing
- **Layout:** `row` for side-by-side, `timing: parallel` so both protocols animate together
- Each pane: bar chart with categories=[a,b,c,d,e,f] and one series (HTTP/1.1 or HTTP/2)
- Y-axis: 0–5 units for consistent scale across both

**Captions:** 
- Pane 1 reveal: "HTTP/1.1: Sequential FIFO queues (5 units total)"
- Pane 2 reveal: "HTTP/2: Multiplexed frames (3 units total)"
- Final note: Name specific asset improvements (e.g., "c finishes 2 units earlier")

**Predicted explain() output:**
- 2 steps from compose structure (one per pane reveal)
- Final step with note about timing improvement
- Captions joined with " · " where beats coincide

## Fallback Plan (if validation fails)
- If compose has issues: create 2 separate chart scenes with index.md
- If chart kind doesn't suit: switch to `vector` for custom timeline visualization

---

## Round 1: Single Chart with Comparisons

### Approach Chosen
- **Kind:** `chart` (bar, 1 kind, 1 scene)
- **Why single chart vs. compose:** While compose would show "side by side", a single chart with sequential reveals + highlights gives better control over captions and ensures all brief requirements fit into one continuous narrative
- **Structure:** Two series (HTTP/1.1 red/amber, HTTP/2 blue), six categories (assets a–f), Y-max=5 units

### Validation Result
```
✓ scene.json (chart): 0 error(s), 0 warning(s)
  4830ms · 8 steps (7 captioned) · 47 nodes · 48 tracks / 139 keyframes
  scene 996 B → timeline 15229 B (×15.3)
```

### Explain Output
```
 1. [    0ms] HTTP/1.1 vs HTTP/2: Asset Completion Times
 2. [  350ms] HTTP/1.1: Two FIFO connections block assets in queue
 3. [ 1050ms] HTTP/2: One connection, all assets progress together
 4. [ 1750ms] Asset c finishes at 3 units (HTTP/1.1) but 1 unit (HTTP/2) — 2 units faster
 5. [ 2450ms] Asset d finishes at 4 units (HTTP/1.1) but 1 unit (HTTP/2) — 3 units faster
 6. [ 3150ms] Asset f finishes at 5 units (HTTP/1.1) but 1 unit (HTTP/2) — 4 units faster
 7. [ 3850ms] HTTP/1.1 total: 5 units. HTTP/2 total: 3 units. Multiplexing saves 2 units (40% faster)
 8. [ 4550ms] (end)
```

### Brief Success Criteria ✓
1. ✓ Validation: 0 ✗, 0 ⚠
2. ✓ Last captioned beat (step 7): Names both totals — "HTTP/1.1 total: 5 units. HTTP/2 total: 3 units"
3. ✓ Asset finish times with deltas: c (2 units faster), d (3 units faster), f (4 units faster)

### Coordinates & Colours Used
- **Coordinates:** None written by hand (chart kind auto-layouts bars by category)
- **Colours:** Default palette (amber #f59e0b for HTTP/1.1, blue #3b82f6 for HTTP/2)

### "Side by Side" Assessment
- **What happened:** Single chart sequentially reveals each series, then highlights individual assets
- **What the viewer sees:** Both series on same axes → enables direct visual comparison of bar heights
- **What is lost:** Temporal "side by side" (both protocols don't animate at once) — but the static display after both reveal is equivalent to side-by-side in space, and captions explain the timing logic
- **Trade-off:** Sequential reveal maintains clear narrative flow; highlighting emphasizes specific improvements

### First-Attempt ✗/⚠ Count
- **First attempt:** 0 (initial compose was valid, no errors)
- **Iteration 1 (compose→chart):** Motivated by needing more beats for comparison captions, not by validation failures
- **Rounds to green:** 1 (started green, stayed green after refactor)
- **Bytes per scene:** 996 B (JSON) → 15229 B (compiled timeline, ×15.3x)

### Wanted to Show But Couldn't
- **Temporal progression:** The animation doesn't show the *moment-by-moment* queueing (which asset is transmitting at t=1, t=2, etc.); it jumps to final completion times. A web developer would benefit from seeing the second-by-second blocking in HTTP/1.1 and the interleaving in HTTP/2.
- **Concurrency visualization:** The chart doesn't visually encode "these happen in parallel" or "this one is blocked"; it's a static comparison of final times.
- **Queue state changes:** No way to show the two HTTP/1.1 connection queues filling and draining, or the HTTP/2 connection progressing through interleaved frames.

**What was shown instead:** Absolute completion times for each asset, with highlights calling out the three most-improved assets. This answers "how much faster" directly, but sacrifices "why it's faster" (the mechanism).

### Single Most-Helpful Addition
**Timeline visualization with concurrent track rendering:** A kind that shows multiple "lanes" (connection 1, connection 2, or the single HTTP/2 connection) with asset blocks sliding horizontally by time would let a viewer see both the queueing delay *and* the multiplexing benefit in one frame.
