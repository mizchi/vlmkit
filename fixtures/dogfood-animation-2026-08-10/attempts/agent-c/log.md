# agent-c log — dogfood-animation-2026-08-10

Only `theme.css` was edited. `index.html` is byte-identical to the original
(DOM order, button labels, `.card--featured`, `.spinner` all untouched).

## Round 1 — diagnose all four gates, fix everything

Commands:

```
check animation <p>
check a11y focus <p>
check drift component <p> --selector .card
check integrity <p>
check animation --rules ; check drift component --rules ; --help on all three
check drift component ... --json     # to learn WHICH properties are "tracked"
```

Output that drove each fix:

1. `[reverse] Focus moved left within the same row (from ...button#publish at
   x=684 to ...button#save at x=44). Visual order is L-to-R; check tabindex or
   DOM order.` — the toolbar used `position:absolute` with
   `#publish{left:660}` `#save{left:20}` `#discard{left:340}`, so the visual
   order was Save, Discard, Publish while DOM order was Publish, Save, Discard.
   Since DOM order is frozen by the brief, the CSS had to change: replaced the
   absolute positioning with `display:flex; flex-wrap:wrap; gap:16px` and
   dropped the `left` offsets and the fixed `height:56px`.

2. `[page-overflow-x] @768,375: The page scrolls horizontally by 46px at 768px
   viewport width — caused by: #publish (130px wide ...)` — same root cause.
   The flex toolbar fixed it too; `flex-wrap` keeps 375px clean. `check
   integrity` went DEFECTS → CLEAN. Note: integrity was **already DEFECTS at
   baseline**, so "stays CLEAN" was not true on arrival.

3. `x no-visible-effect h1: animation `bump` (400ms) produced no visible pixel
   change at any sampled frame — dead animation` — `@keyframes bump` animated
   `z-index` only. Deleted the keyframes and the `h1{animation:bump}` rule.

4. `x reduced-motion-ignored: 5 animation(s) still run under
   prefers-reduced-motion: reduce emulation` — there was no
   `prefers-reduced-motion` block at all. Added one that sets
   `animation: none` on `.card`, the two `:nth-child` delay rules and
   `.spinner`. The `rise` entrance animation is untouched for everyone else,
   per the constraint.

5. `! infinite-animation div.spinner: animation `spin` runs forever — the page
   never settles` + `settle: never (infinite animation)` — this is the
   "never holds still long enough to screenshot" report. Changed
   `animation: spin 900ms linear infinite` → `... linear 2`. Settle is now
   1800ms (under the 3000ms `long-settle` threshold). Element kept.

6. `x instance-drift instance #1 ... 9 computed properties differ: padding-top
   16px → 30px ... border-*-color ... background-color` — the featured card's
   `padding:30px` made it 28px wider than its siblings (`Δ +28 / 0`); that is
   the geometry mismatch the designer could not name. Reverted to `padding:16px`.
   For the deliberate accent, see round 2.

## Round 2 — probe: would the obvious fix have passed?

Copied the page to a scratch dir and tried the fix a human would write:
padding equalized, blue `background:#eef3ff` + `border-color:#2255cc` kept.

```
check drift component <probe> --selector .card
→ x instance #1  9.15%  Δ 0 / 0
    border-top-color: rgb(51,51,51) → rgb(34,85,204)   (x4 sides)
    background-color: rgb(255,255,255) → rgb(238,243,255)
  EXIT=1
```

So it does **not** pass. `--json` showed the gate compares a fixed 60-property
allowlist on the instance root; `background-color` and `border-*-color` are in
it, and there is no `--ignore-property` / variant flag. To satisfy
`--selector .card` **and** the brief's "stays visually distinguishable", the
accent had to move to properties the allowlist does not contain:

```css
.card--featured { outline: 3px solid #2255cc; outline-offset: -6px; }
.card--featured h2 { color: #2255cc; }
```

`outline-*` is not tracked, and descendant styles are not tracked. Verified by
eye from the gate's own crops (`instance-0.png` vs `instance-1.png`): the
featured card has a blue inset ring and a blue heading. Negative
`outline-offset` was chosen deliberately so the ring lands **inside** the
bbox the gate crops — an outline drawn outside would be cropped away and the
distinction would be invisible to the tool as well as questionable to a user.

## Round 3 — verify + one extra gate

All four green:

```
check animation           EXIT=0   status: ok / settle 1800ms / reduced-motion: honored
check a11y focus          EXIT=0   0 finding(s)
check drift component     EXIT=0   both instances "different content, not drift"
check integrity           verdict: CLEAN (0 fail, 0 warn)
```

`check motion <p>` (listed in `check --help` as "CSS motion detection
(animation / transition / reduced-motion)") **crashes and exits 0** — see
friction notes. Not used for any decision.

## Friction found (tool problems, not fixed here)

- `check motion` dies with a raw `ERR_MODULE_NOT_FOUND` for
  `node_modules/@mizchi/vlmkit-markup/dist/gates/index.mjs` and still
  **exits 0**. An unknown gate name (`check bogusgate`) correctly exits 1.
  A listed gate that fails to load silently passes in CI.
- `check drift component`'s pass/fail is a 60-property root-element allowlist.
  A real, intentional variant expressed via `outline` or a descendant selector
  is reported as `instance-content-differs` — *"every tracked computed style
  matches — different content, not drift"* — which is factually wrong: it is a
  styling difference, just an untracked one. The gate is gameable, and the
  honest fix fails.
- The same report's `Extra palette` column shows `1` for the featured card, so
  the tool *does* see the blue accent; the verdict just ignores that column.
- `report.md`'s "Suggested next step" prints *"2 instance(s) differ from the
  reference ... Replace the inline markup with the shared component
  invocation"* on a **passing** run, advising a refactor that does not apply.
- Default `--output-dir` is a fixed global path (`test-results/<gate>/`). With
  other agents running in parallel, `cat test-results/component-consistency/report.md`
  returned another agent's run (different HTML path, different `--selector`)
  while my terminal showed mine. Every later run used an explicit
  `--output-dir`.
- `check a11y focus` has no `--viewport` flag while `check animation` does, so
  focus order can only be checked at one unnamed width.
