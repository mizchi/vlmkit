# TCP Teardown Animation — Development Log

## Round 1 — First Attempt (Complete on First Try)

**Approach:** Used `kind: state-machine` from the writing guide to model TCP teardown as a state diagram.

**States:** ESTABLISHED (initial), FIN_WAIT_1, FIN_WAIT_2, CLOSING, TIME_WAIT, CLOSED (final)

**Transitions:** 
- ESTABLISHED → FIN_WAIT_1 on "close" / send FIN
- FIN_WAIT_1 → FIN_WAIT_2 on "ACK" / receive ACK (normal path)
- FIN_WAIT_1 → CLOSING on "FIN" / receive FIN, send ACK (simultaneous close)
- FIN_WAIT_2 → TIME_WAIT on "FIN" / receive FIN, send ACK
- CLOSING → TIME_WAIT on "ACK" / receive ACK
- TIME_WAIT → CLOSED on "timeout" / 2MSL timer expires

**Trace:** Normal path first (close, ACK, FIN, timeout), then `goto FIN_WAIT_1` to show alternative simultaneous-close path (FIN, ACK).

**Check Result:**
```
✓ scene.json (state-machine): 0 error(s), 0 warning(s)
  7350ms · 9 steps (9 captioned) · 21 nodes · 14 tracks / 55 keyframes
```

**Status:** ✅ COMPLETE — No changes needed.
