# Attempt bb — queue-bfs-frontier (sonnet)

First attempt: 0 ✗ / 0 ⚠, green in round 1. Scene 907 B → 8115 B (×8.9).

Success criteria met: the compiler's last step reads `Queue: empty · removed A, B, C, D, E`; the queue is empty at the end (all five v-N rects opacity 0); `peek` used once ("Peek: B is next to be processed") before B's dequeue.

What helped: the print-jobs example gave every op name first try; `schema --kind queue` confirmed fields; the caption rules predicted `explain`'s 14 steps from 12 authored ops.

Missing: the guide never states what a default dequeue / peek caption looks like, nor that the compiler's own last step names every value ever removed, in order — "I only learned the compiler tracks and reports full dequeue history by actually running explain." Wanted: "The compiler's own last step for a queue/stack names every value that was ever pushed/popped, in order — a free trace of the whole run." Also unstated whether an uncaptioned `peek` narrates the front value by name (sidestepped by always captioning).

Guesses (all right): captions may carry graph facts the picture does not show; no `capacity` needed; `peek: true` before a `dequeue` satisfies "show what is next" with no linking field.
