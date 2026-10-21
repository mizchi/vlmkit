# motion-repair v6: how long, and how often (2026-10-21)

## Question

The first five rounds covered three kinds of defect: whether a target is seen, when its
animation begins and where it grows from. Round 6 adds three new kinds: an exit that does not
stay gone, a run that is too slow, and a pulse that never stops. The briefs use their own words
again. Six fresh agents took part, three on the default model and three on a smaller one, and the
setup was otherwise unchanged.

| page | planted defect | the brief's words |
|---|---|---|
| banner | exit `leave 300ms … 2000ms` with no fill-mode, so it returns | "slips up off the top … and after that nobody should see it again" |
| sheet | `rise 1400ms` | "fully up within about a quarter of a second (280ms) … snappily" |
| badge | `pulse 600ms … infinite` | "swells and settles back, three times in a row … then it sits still for good" |

## Result

| page | model | rounds | oracle | what found the defect |
|---|---|---:|---|---|
| banner | default | 1 | PASS | `inspect motion --exits`: `FAIL snap-back … add animation-fill-mode: forwards` |
| banner | small | 1 | PASS | the same |
| sheet | default | 1 | PASS | `check animation`'s list (`rise 1400ms`) read against the brief, then `--settle-threshold 480 --rule long-settle=suspect` |
| sheet | small | 1 | PASS | the list, then its own frame strip ("still moving at 900ms") |
| badge | default | 1 | PASS | `check animation`'s `infinite-animation`: "give it a bounded animation-iteration-count" |
| badge | small | 1 | PASS | the same |

All six repairs were right, each in one round. Two of the three defects were found by a rule:
snap-back for the banner and infinite-animation for the badge. For the slow sheet, both agents had
to read the duration in the list and compare it with the brief themselves.

## What they hit, and what is fixed

- **`inspect motion` could not judge how long a run takes.**

  > "Its frames are spread over each animation's own span, so the 1400ms and 280ms runs printed the
  > same list of centres … both read 'follows ease-out exactly'." (sheet)

  **Fixed:** every target's line now says `runs 1400ms`, read from the element's own timing.
  `--expect-duration 280ms` fails with `duration-mismatch: one run takes 1400ms, not 280ms
  (5.0x)`.
- **It refused a page whose animations are all infinite.**

  > "`error: no finite animation on the page to sample` … When forced with `--at`/`--end`, it says
  > `no fail` on a page that never stops." (badge)

  **Fixed:** such a page is sampled over its first three runs (4s at most) with no rest frame, and
  the header says so. The line reads `runs 600ms and repeats forever`, and `--expect-iterations 3`
  fails with `iterations-mismatch: it runs forever, not 3 times: animation-iteration-count: 3`.
  A finite run of three reads `x3`.
- **The banner's exit was counted twice.**

  > "`--exits` did not stop a second, noisy fail: `FAIL target-lost at 2299ms` … That leaving is the
  > intended exit." (banner)

  **Fixed:** with `--exits`, frames from the last segment on count as leaving, not lost. The
  snap-back after them is the only fail. The fit is no longer voided by a snap-back at rest: it
  now reads `follows ease-in exactly` instead of "the path has a jump".
- **The skill:** "within about a quarter of a second" maps to `--expect-duration`, "three times,
  then it sits still" maps to `--expect-iterations`, and "gone for good" maps to `--exits`.

## Deferred, or not the tool's to change

- **`reduced-motion-ignored` is a suspect, so it exits 1.** Every agent in all six rounds met it.
  Since round 4 the message says how to judge without it, and every agent followed that, but it
  still shows as an `x` while its text calls it advice. Making it a `warn` would change the gate's
  policy (WCAG 2.3.3 is AAA), so that is a decision for the project rather than a fix.
- **The sheet agent's proof without the flag needed `--settle-threshold`.** `long-settle` is
  page-wide and a warn. `--expect-duration` now covers this case per element.
- **A storyboard frame in a badge's delay differed from its rest frame by 104 bytes**, inside the
  badge. A pending animation renders it slightly differently, and `diff png` (now edge-aware)
  reads it as 0.00%.
- **`check animation`'s `(palindromic keyframes, leg 300ms)` could pull an agent towards
  "fixing" a 600ms throb.** The note is right about legs, but a brief that names one throb's length
  means the iteration, not the leg.
- **Shared output directory.** `inspect motion` and `check animation` both default to
  `test-results/` and overwrite each other.
- **Side effect of two small-model agents.** One stray tool call each: a failed `create_trigger`
  (nothing created) in round 4, and a Remote session created and archived at once in this round.
