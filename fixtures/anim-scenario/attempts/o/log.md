# Cold read log

Started: 2026-09-04 09:39:55 UTC

## The story, in my words

Three nodes: `client`, `primary` (starts as `leader`), `replica`. Sequence:
1. client writes x=1 to primary
2. primary replicates x=1 to replica
3. replica acks primary
4. primary tells client "ok"
5. (event) 100 [ms?] after "ok" is sent/arrives, primary goes `down` — it crashed
6. client sends "write x=2" to primary — marked `lost: true`, captioned "primary has
   crashed: the write is lost" (it never arrives because primary is down)
7. (event) right after that lost "write x=2", replica is promoted to `leader`
8. client retries "retry x=2" against replica (now the leader)

So the punchline is a classic primary failover: write succeeds, primary dies right
after acking, a client write into the dead primary is dropped, replica gets promoted
at that moment, and the client's retry finds the new leader.

## Things I'm unsure of (before reading the guide)

- Timing model: there is no explicit `at`/timestamp on messages or on the top level.
  I don't know whether messages are auto-spaced by array order with a fixed default
  gap, or whether some implicit "network delay" is applied. This matters a lot for
  the edit — I need to add a 1200ms delay to the ack, and I don't know yet whether
  that's a property on the *message* itself or something else.
- `events[].after`: it's a string that matches a message's `label` exactly
  ("ok", "write x=2"). Is matching by label text guaranteed unique/stable, or is
  there a hidden id I should be using instead? What happens if two messages share
  a label?
- `events[].delay`: unit assumed ms (100). Is delay measured from when the
  referenced message is *sent*, or from when it *arrives* at its destination?
- For the second event, `after: "write x=2"` refers to the *lost* message (the one
  with `lost: true`). Since it's lost, it presumably never "arrives" — so does
  the tool anchor the event to the send time, or to a computed "would-have-arrived"
  time? The README's phrasing ("when the lost retry would have landed") suggests
  the latter, i.e., the tool computes a virtual arrival time for lost messages.
- `caption` vs `label`: label seems to be the arrow text; caption looks like an
  extra annotation/subtitle shown near the event or message (used on the lost
  message and on the promotion event). Not sure if caption is rendered as part of
  the timeline narration or just a tooltip.
- `nodes` mixes bare strings (`"client"`, `"replica"`) with an object
  (`{ "id": "primary", "status": "leader" }`) for initial status. Unsure if status
  is otherwise required, what statuses are valid enum values, or if a node with no
  initial status has some default.
- Whether messages support a `delay` field of their own (for the 1200ms ack delay
  I need to add) or whether delay is only a feature of `events`.
- Whether adding a fourth node `backup` and a new message from replica→backup
  will need an accompanying `nodes` entry, and whether new nodes need a `status`.

Time before feeling ready to edit (cold, no guide): ~4 minutes to read + write this.

## Unmodified `explain` (before editing)

```
Primary-replica write with a failover — 8 steps, 3780ms, 25 nodes
 1. [    0ms] client → primary: write x=1
 2. [  600ms] primary → replica: replicate x=1
 3. [ 1200ms] replica → primary: ack
 4. [ 1800ms] primary → client: ok
 5. [ 2400ms] primary has crashed: the write is lost
 6. [ 2500ms] primary crashes
 7. [ 3000ms] client retries against the promoted replica · replica is promoted
 8. [ 3600ms] end
```

## Guide sentences relied on for the edit (docs/anim-ir.md, kind: distributed)

- "`\"sequential\"` (default): it starts when the previous message in the list
  lands. Simple, but **inserting a message in the middle delays everything
  after it**. When the new message is a side branch (a copy to a backup while
  the main reply goes on), anchor it — `{"after": "ack", …}` — and anchor the
  message it would otherwise push (`"ok"` also `after: "ack"`)."
- "`after` starts it when the earlier message with that label lands (+ `delay`)."

The guide's own worked example is literally this task (a backup side-branch off
`ack`, protecting `ok`), so the edit is close to a direct transcription.

## Edit made

- `nodes`: added `"backup"` (plain string).
- `ack`: added `"after": "replicate x=1"` (making the pre-existing default
  anchor explicit) + `"delay": 1200` + a caption naming the slow disk.
- New message `replica → backup, "copy x=1"`, `"after": "ack"`, with a caption.
- `ok`: added `"after": "ack"` explicitly — required only because the new
  backup message now sits between `ack` and `ok` in the array; without the
  explicit anchor `ok` would default to firing after the backup message lands
  instead of after `ack`.
- Nothing else touched. Both events already anchor via `after` on a label, so
  they track their anchors regardless of array position or added delay.

## Round 1 `check` (first check, run only after finishing the whole edit)

```
✓ scene.json (distributed): 0 error(s), 0 warning(s)
  4980ms · 8 steps (8 captioned) · 30 nodes · 38 tracks / 81 keyframes
```
Clean on round 1 of 3.

## `explain` after editing

```
Primary-replica write with a failover — 8 steps, 4980ms, 30 nodes
 1. [    0ms] client → primary: write x=1
 2. [  600ms] primary → replica: replicate x=1
 3. [ 2400ms] ack delayed 1200ms: replica's disk write is slow
 4. [ 3000ms] replica forwards a copy to backup · primary → client: ok
 5. [ 3600ms] primary has crashed: the write is lost
 6. [ 3700ms] primary crashes
 7. [ 4200ms] client retries against the promoted replica · replica is promoted
 8. [ 4800ms] end
```

## Beat-by-beat before/after

| beat | before | after | Δ | required or side effect? |
|---|---|---|---|---|
| write x=1 | 0 | 0 | 0 | — |
| replicate x=1 | 600 | 600 | 0 | — |
| ack (+slow-disk caption) | 1200 | 2400 | +1200 | required (item 1) |
| backup copy (new) / ok | —/1800 | 3000/3000 | new/+1200 | required — ok still fires the instant ack lands (offset 0 preserved, item 3) |
| "primary has crashed…" (write x=2 sent) | 2400 | 3600 | +1200 | necessary cascade of ok's shift, not a broken invariant |
| primary crashes (event) | 2500 | 3700 | +1200 | required — still exactly 100ms after ok lands (item 3) |
| retry x=2 / replica promoted | 3000 | 4200 | +1200 | required — still exactly at the lost retry's would-be landing (item 3) |
| end | 3600 | 4800 | +1200 | consequence of total added delay |

Verdict: nothing moved that should not have. Every downstream beat shifted by
exactly the added 1200ms and nothing else — each anchor's offset from its
reference is identical before and after. The one place this would have broken
was `ok`; I anchored it to `after: "ack"` because the guide states an
unanchored message defaults to firing after whatever is immediately before it
in the array, and my new backup message had just become that predecessor.

## Where intent was not readable from the file

- `delay` values (100, and the 1200 I added) carry no unit or rationale in the
  field itself — only the guide's prose says "ms", and only a caption I chose
  to write records *why* 1200 (slow disk). The schema has no rationale field,
  so that reasoning is easy to omit and lose on a future edit.
- `"lost": true` gives no explicit "would-be arrival" — the promotion event's
  correctness depends on the tool computing a virtual landing time (send +
  default latency) for a message that never arrives. Nothing in the scene
  states that computation; I only confirmed it by checking `explain`'s printed
  ms against arithmetic by hand.
