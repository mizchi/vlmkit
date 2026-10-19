# motion-repair v2: after `target-hidden` and hold frames, does the tool lead to the cause? (2026-10-19)

## Question

The same three pages and briefs as v1 (`fixtures/motion-repair/`), four fresh agents with the same
prompt, on the tool after v1's fixes: three as in v1, and a smaller model (haiku) on the toast, the
page that took all four rounds in v1. Does `inspect motion` now report each defect on the broken
page, name its cause, and shorten the repair?

## Result

| page | v1 rounds | v2 rounds | oracle | `inspect motion` on the broken page |
|---|---:|---:|---|---|
| notify | 2 | 1 | PASS | `target-hidden … clipped by header.topbar (overflow: hidden)` |
| menu | 1 | 1 | PASS | `target-hidden … covered by section.hero: nav makes a stacking context (a transform)` |
| toast | 4 | 1 | PASS | `snap-back at 1160ms … add animation-fill-mode: forwards (or both)`, `target-lost` ×3, `easing-mismatch` |
| toast (haiku) | — | 1 | PASS | the same |

Every agent fixed its page in one edit and none had to find the cause in the CSS:

> "Yes, and it named the cause, so I did not have to find it in the CSS." (menu)
>
> "I didn't have to search the CSS." (notify)
>
> "The `snap-back` line … verbatim, gave the exact fix." (haiku, toast)

Jev: three agents ran `--jev` once ($0.0015-0.0033); each said it agreed with the measurement and
added nothing. The haiku agent did not use it: "The brief is numeric … `inspect motion` measured all
of it from the page."

## What didn't, and what is fixed

### "No easing named" beside a fail that names one

> "On the broken page the summary line said 'no easing named: the path has a jump, so no curve
> describes it' for both segments, while the FAIL lines did name ease-in." (toast)
>
> "The path had no jump." (haiku)

The summary withheld the fit from every segment when any `snap-back` fired, and the new one fires
in the hold, outside both. **Fixed:** withheld only for a segment a jump or snap-back falls in.

### The suggested strip skips the defect

> "`snapshot strip … --max-frames 6` picked frames 300, 480, 659, 2690, 2840 and rest. None falls in
> the 660–2660ms gap, so the strip doesn't show the defect." (toast; the haiku agent: "Agents should
> look at the instants the report names.")

**Fixed:** the output names the first fail's own frame file.

### Guessing the easing the brief leaves out

> "The brief gives no easing for the fade, so I had to guess one for `--expect-easing`. My first
> guess, `linear`, caused a false fail on the original." (toast)

**Fixed:** `any` leaves a segment unchecked (`--expect-easing ease-out,any`).

### `check animation` calls a hidden element visible (v1 and v2)

> "`check animation` called the hidden card '`visible`, motion region (928,57) 320x7'." (notify)

**Fixed:** `motion-mostly-hidden` (warn, rule 219): the motion covered under a quarter of the
element's box AND the element is topmost on under half of it at rest. The second condition is what a
first version lacked — it flagged `fixtures/integrity-timeline/fade-in.html`, a block heading whose
text is a fifth of its width. On every animated page in the repository (motion-defects,
integrity-timeline, motion-repair references, the landing page, the six demo sites) it now fires on
the two broken motion-repair pages only.

### The reduced-motion hint would hide the toast for good

> "The fix the reduced-motion hint offers, 'set `animation: none`', would leave this toast never
> shown, because its resting position is off-screen." (toast)

**Fixed:** the hint adds that an element brought into place by its animation needs that end state
in the same rule.

### Smaller wording fixes

- `target-hidden` said "never seen … visible 0.00" where a 10px sliver showed (menu): it now says
  "at most N% of it visible in any frame".
- `absent-at-rest` on a toast without `--exits` "reads as a defect, not as a question of intent"
  (haiku): it now says to declare `--exits` if it is meant to leave.

### Deferred

- `check integrity`'s `occluded-text` still leaves Billing out of the hidden menu items, and its
  timeline low-contrast warning on the toast came and went between runs (toast agent).
- At 375px `check integrity` fails the notification for covering the mail list, which the brief
  asks for at 1280; it exempts the same card's protrusion as an authored overlay (notify).
- `diff html` printed "Crater BiDi unavailable at ws://127.0.0.1:9222" (menu).
- "stays until dismissed" is checked only up to the rest frame, 300ms after the motion (notify).

## Stopping signal

v1 → v2: rounds 7 → 4 over three pages (and 1 for the smaller model), every cause named by the tool.
The frictions left are wording and adjacent gates, not the signal. A round 3 would be worth it only on
new defects (a page these agents have not seen), to check the fixes generalise.
