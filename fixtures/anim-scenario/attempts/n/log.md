# Round 1 (First Attempt)

## Check Result
✓ Exit 0 with 0 errors, 0 warnings
- 2980ms total duration
- 6 steps, all captioned
- 25 nodes, 33 tracks, 67 keyframes
- Scene 993 B → compiled timeline 7416 B

## Approach
- Used absolute `at: 0` for both initial heartbeats to send them together
- Used `after` with `delay: 400` for timeout before vote request
- Used `after` for subsequent messages to chain timing
- Used `after` for events: n1 crash after hb1 lands, n2 promotion after vote lands
- Marked vote request to crashed n1 as `lost: true`

## Status
✓ Brief met on first attempt. No ✗, no ⚠ about messages landing on down nodes.

## Latency Experiment
Changed vreq2 latency from 600ms to 1500ms. Result:
- ✓ Check passed with 0 errors/warnings
- Crash: still 600ms ✓
- Promotion: moved to 3100ms (was 2200ms) but still correct relative to dependencies ✓
- Story survived: timeline self-adjusted without manual fixes

## Friction in Guide
**Clarity wins**: The distinction between `at` (send time) vs `after` (landing time) was clear enough to use correctly on first try.

**Ambiguity**: How to express "send two messages at the same instant" using `after` alone—not possible. Solution uses `"at": 0` for both, which works but feels like an exception to "prefer `after`". The vector kind's `"at": "<"` syntax (means "together with previous") would help here if it applied to distributed messages.

**Minor gap**: No example showing parallel message sends in the distributed section. The guide's written-sequence structure didn't make it obvious that `at` could be reused to achieve this.
