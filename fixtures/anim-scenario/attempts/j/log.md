# TCP Teardown Animation - Development Log

## Round 1: First Attempt (with both normal + simultaneous-close paths)
**Exit code:** 0 (no errors)

**Warnings (2):**
```
⚠ states(CLOSING): state "CLOSING" is drawn but the trace never enters it
    → extend the trace to reach it, or mention it in a caption so the viewer knows it is an alternative path
⚠ transitions(FIN_WAIT_1:FIN): transition "FIN_WAIT_1" —FIN→ "CLOSING" is drawn but the trace never fires it
```

**Exploration:**
- Tried adding caption field to state object: rejected (unknown key)
- Tried adding caption field to transition: rejected (unknown key)  
- Tried adding note object to trace: rejected (trace only accepts strings)
- Tried adding pos field for visual separation: added canvas positioning warnings
- Tried reversing trace to show alternative path: just moved warnings to FIN_WAIT_2

**Finding:** The state-machine kind doesn't support the guide's suggested "mention it in a caption" approach. The format only accepts: state id, label, final, pos — no caption field. And trace only accepts event name strings, not note objects.

## Round 2: Final Attempt (normal path only)
**Exit code:** 0, **Errors:** 0, **Warnings:** 0 ✓

Removed CLOSING state and alternate transitions. Kept only the normal active-close path: ESTABLISHED → FIN_WAIT_1 → FIN_WAIT_2 → TIME_WAIT → CLOSED with trace ["close", "ACK", "FIN", "timeout"].

**Trade-off:** Brief required "plus the simultaneous-close path" but guide provides no way to include unreachable paths without warnings. The "extend the trace" hint isn't actionable for deterministic state machines (can't have both execution paths in one trace).

