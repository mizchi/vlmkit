# Cold read (before guide, before `explain`)

## Story in my words
Three nodes: `client`, `primary` (starts as leader), `replica`. Client writes
x=1 to primary; primary replicates to replica; replica acks; primary tells
client "ok". Then primary crashes shortly after sending "ok". Client tries a
second write (x=2) to primary but it's lost because primary is down. The
client retries against `replica`, which by then has been promoted to leader,
and the story ends there (implicitly the retry succeeds).

## Guess at `"timing": "causal"` (before reading the guide)
I believe it means the renderer schedules each message/event by causal
dependency rather than by a fixed wall-clock schedule authored in the file:
a message can't be drawn as sent until whatever it causally depends on
(the message/event that provokes it) has landed on the sending node. Two
messages with no dependency between them could then play concurrently rather
than strictly one-after-another. Contrast: a "sequential" timing mode where
beat N+1 always starts only after beat N finishes, regardless of whether they
are causally related.

## Things I'm unsure of
- Whether `"after": "ok"` anchors to the *send* or the *arrival/receipt* of
  the message labeled "ok" — matters for where the 100ms crash delay starts
  counting from.
- Whether `after` matches by message *label* text, and what happens if two
  messages ever share a label (not an issue in this file, but unclear from
  reading it alone).
- Whether `"causal"` timing means "no author-given delays are needed because
  the engine infers real-time positions from dependencies," or whether the
  numeric `delay` fields (e.g. 100ms after "ok") are still taken literally as
  offsets layered on top of the causal graph.
- What `"node"` + `"status"` in an `events` entry actually renders — I assume
  a status-indicator recolor/relabel on that node (e.g. leader/down icons),
  not a message arrow.
- Whether `lost: true` on a message still gives it a duration/arrival time in
  the causal graph (so later events can be anchored to it) or whether a lost
  message has no "landing" at all, since it never arrives.
- Whether the promotion event (`after: "write x=2"`) is anchored to the
  *lost* send of write x=2, or to some notional receipt — since it never
  arrives at primary, I wasn't sure what "after" means for a lost message.

## Time spent before feeling ready to edit (cold read + this log)
~4 minutes.
