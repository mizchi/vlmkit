# Cold reading log

Started: 09:21:18 UTC

## Story in my words

A distributed-systems sequence diagram: `client` writes x=1 to `primary`
(the leader). `primary` replicates to `replica`, which acks. `primary` tells
the `client` "ok". Shortly after that ok (100ms later), `primary` crashes
(goes "down"). The client's next write (x=2) is sent to the now-dead primary
and is lost. The client then retries against `replica`, which by that point
has been promoted to leader, so the retry succeeds.

## Things I was unsure of, before opening any docs

1. **`events[].after` semantics** — it's a string that matches a message's
   `label` ("ok", "write x=2"). Unsure whether "after" means after the
   message is *sent*, *delivered*/arrived, or fully rendered/animated. This
   matters a lot for where a new event should be anchored.
2. **`delay` field** — first event has `delay: 100`, second event has no
   `delay` at all. Unsure if `delay` is optional (defaults to 0) or required,
   and what unit it's in (assumed ms because the README talks in ms).
3. **Why the promotion event is anchored to `"write x=2"` (the *lost*
   message) and not to `"retry x=2"`.** My read: the lost message's
   nominal delivery time is where the retry-timeout / promotion logically
   happens — i.e., "promoted right when the dropped retry would have
   arrived" — but the file gives no comment confirming this, so it's an
   inference from message order + the README task description, not
   something stated in the scene itself.
4. **`node` + `status` on events** — presumably "set this node's rendered
   status/badge to this value at this point in time," but no enum of valid
   status strings is given (`"leader"`, `"down"` are the only two used).
   Unsure if arbitrary strings work or if there's a fixed vocabulary.
5. **Mixed node shapes** — `"client"` and `"replica"` are bare strings while
   `primary` is `{ "id": "primary", "status": "leader" }`. Guess: bare
   string = default/no initial status badge; object form lets you set an
   initial status. Not fully sure a bare string couldn't also take other
   implicit fields.
6. **`lost: true` on a message** — assume this renders the arrow as
   dropped/crossed-out and that the message never logically "arrives" at
   `to`, but unsure if downstream `events[].after` referencing a lost
   message key off its send time, its would-be arrival time, or something
   else — directly relevant to point 3.
7. **`caption` on messages vs `events`** — assume it's narration text shown
   alongside that beat (used by `explain`), not something with animation
   effect, but not certain if it also drives on-canvas text vs. is purely
   for `explain`/documentation.
8. Whether `messages` order is itself the timeline (each message occupies
   the next "slot" in time) or whether timing is entirely governed by
   `events[].after`/`delay` and the array order is just diagram/reading
   order that could diverge from actual timing.

Time before feeling ready to edit (cold, no guide, no CLI): **~6 minutes**.

## explain (before editing) vs my cold reading

Ran `explain` on the unmodified copy: 8 steps, 3780ms. It confirmed the
broad story but immediately falsified my guess in item 3/6/8 above about
timing: the crash (anchored `"after": "ok", "delay": 100`) landed at
2500ms — two full steps after "ok" itself (1800ms), not 1900ms as a naive
"send-time + delay" reading would predict. Same for the promotion event.
This sent me to `vlmkit anim schema --kind distributed` (not the full
guide) rather than a guess, which resolved it: a message's displayed time
is its *send* ("at"), `after` anchors to the referenced message's *land*
time (at + latency, default latency = stepMs = 600ms here), and `delay` is
added on top of *that*. So "after: ok" = ok's land (1800+600=2400) + 100 =
2500. Confirmed.

## Edit + check rounds

- Round 1 (after finishing the edit): `check` was already clean (0/0), but
  I noticed empirically via `explain` that my `"delay": 1200` on the ack
  message had **zero effect** on its timestamp — it stayed at 1200ms,
  identical to the unedited default chain position. `check` does not catch
  this because it only validates schema/references, not "did the delay you
  wrote actually do anything."
- Round 2: added `"after": "replicate x=1"` alongside the existing
  `"delay": 1200"` on the ack message (matching the schema note that
  `delay` is meaningful paired with `after`, not as a bare field). Re-ran
  `check` (clean, 0/0) and `explain`: ack now lands at 2400ms
  (1200 + 1200), confirming the delay is live.
- Never needed a round 3.
