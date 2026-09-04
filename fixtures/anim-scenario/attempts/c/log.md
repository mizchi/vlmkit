# Round 1 (First Attempt)

## Checker Result
✓ Exit 0, clean (0 errors, 0 warnings)
- 4080ms duration
- 8 steps (all captioned)
- 25 nodes
- 33 tracks / 70 keyframes
- scene 894 B → timeline 7471 B

Passed on first attempt. No modifications needed.

## Approach
- Used `kind: distributed` with 3 nodes (n1, n2, n3)
- n1 starts as leader status
- 6 messages: 2 heartbeats from n1, 1 lost vote request to n1, 1 vote request to n3, 1 vote grant, 1 heartbeat from n2
- 2 events: n1 crashes at 1200ms, n2 becomes leader at 3600ms
- Captions on each message and event to explain the story
- Used explicit `at` timing to ensure crash happens before vote requests
