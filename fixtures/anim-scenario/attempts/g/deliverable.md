# Report

## 1. Cold reading + uncertainties
The file is a primary/replica write-and-failover story: client writes to
primary, primary replicates and gets an ack, primary confirms to client;
then primary crashes, replica is promoted, a retried write to primary is
lost, and the client succeeds by retrying against the (now-leader) replica.
`explain` matched this reading exactly, with two things I hadn't predicted:
(a) `caption` **replaces** the arrow text in the narration rather than
supplementing it (`replica → primary: ack` never appears once a caption is
set — I'd assumed both would show); (b) a message and an event landing at
the same timestamp merge into one numbered step joined by " · " (step 7 in
the original explain), which I had not inferred from the raw JSON at all.

Biggest uncertainty before opening anything: messages carry no visible
timing field, yet the task asks for a "1200ms delay" — I could not tell
from the file alone whether delay is expressed per-message or only via the
`events` array.

## 2. Time before editing
About 6 minutes reading the raw JSON (log.md), then `explain` (~instant),
then I needed the guide/schema for exactly one thing: the `messages[].latency`
field (defaults to `stepMs`) and the `at` default rule ("right after the
previous message lands"). Everything else (node shape, event shape, caption
semantics) I had already guessed correctly.

## 3. First check result
```
✓ scene.json (distributed): 0 error(s), 0 warning(s)
  4980ms · 9 steps (9 captioned) · 30 nodes · 38 tracks / 81 keyframes
```
Clean on round 1 — 1 round used (of 3 budgeted).

## 4. The diff
- `nodes`: appended `"backup"` (bare string, no status — matches `client`/`replica`).
- `messages[2]` (ack): added `"latency": 1200` and a `caption` explaining the
  slow disk ("ack is slow: replica's disk is under load").
- Inserted a new message right after the ack: `{"from":"replica","to":"backup","label":"copy x=1"}`,
  no explicit `at` — letting the documented default ("right after the
  previous message lands") place it correctly with zero arithmetic.
- `events[0].at`: 2500 → 3700; `events[1].at`: 3000 → 4200. Both shifted by
  +1200 to re-sync with the messages that moved later (see §6).

## 5. Where intent was not readable from the file
`events[0].at: 2500` and `events[1].at: 3000` — nothing in the file says
these are deliberately placed "100ms after the lost-write is sent" and
"exactly when the retry lands." They read as arbitrary numbers; only by
diffing them against the message landing times in `explain`'s output did I
recover that they were hand-tuned to a specific narrative alignment. I
wanted a field or comment saying "this event is pinned relative to message
N," not a numeric coincidence I had to reverse-engineer.

## 6. Timing friction
This was the sharp edge. `messages[].at` is relative by default (chains off
the previous message), but `events[].at` is absolute. Inserting one delayed
message and one new message shifted every later message's timestamp by
+1200ms automatically (free, no math needed) — but the two absolute
`events[].at` values did **not** move with them, silently decoupling
"primary crashes" from the beat it was supposed to follow. Nothing in
`check` catches this (it passed clean before I fixed the offsets, at the
wrong dramatic moment — primary would have been shown sending "ok" after
its own crash). Recomputing the +1200 offset required manually replaying
the whole chain by hand from `explain`'s send/land times; a "relative to
message N" option for events would remove this class of error entirely.
