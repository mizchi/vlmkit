# agent-i — dogfood log (ops dashboard, served on :5201)

Rounds used: **2**. All four success criteria reached, plus one extra gate that
turned out to be necessary (`check a11y contrast`).

## Round 1

### Commands, in order

| Command | Result | Helped? |
|---|---|---|
| `check integrity http://localhost:5201/` | exit 1 after **31s**, output was one line: `error: page load timed out (Timeout 30000ms exceeded)` | **Dead end.** Reproduced complaint 1 exactly. Told me nothing about why or what to do. |
| `check integrity --help` | revealed `--wait-until <domcontentloaded\|load\|networkidle>  (default: networkidle)` | Helped — but only because I went looking. |
| `check integrity URL --wait-until load` | exit 1 in **6s**, 1 fail + 3 warn | Helped a lot. Named the overflowing element and the contrast numbers. |
| `check copy URL --wait-until load` | exit 1, `placeholder-text: Placeholder "TODO"` | Helped. Exact string, exact rule name. |
| `check breakpoints URL --rule overflow-at-boundary=suspect --wait-until load` | exit 1, `overflow:0/0/24px` at the 767px boundary | Helped, and the B-1/B/B+1 triple is the right shape for "only at tablet width". |
| `check design URL --wait-until load` | exit 0, DRIFT, `button 6 inst 3 styles reuse 2x` | **Misleading as-is** — see below. The dominant style was the vendor's. |
| `check design --help` | revealed `--exclude <selector> (repeatable)  Exclude a vendor-owned subtree` | Helped. Again only found by reading `--help`, not from the output. |

### Fixes applied in round 1

1. **theme.css `.grid`** — `repeat(3, 240px)` → `repeat(auto-fit, minmax(200px, 240px))`.
   The fixed 3x240 track set demanded 816px (720 + 2x24 gap + 2x24 padding), so at
   768px the third panel ended at x=792 → 24px of horizontal scroll. The 767px media
   query only rescued phone width, which is why it "looked fine on a phone and fine
   on a laptop".
2. **theme.css `.status`** — `#a8a8a8` (2.38:1) → `#595959` (7.0:1).
3. **index.html error-rate panel** — `TODO: confirm the denominator with the platform team`
   → real copy. Brief confirms the denominator is successful requests.
4. **`check design` invocation** — added `--exclude ".vendorchart-ctrl-group"`.

All four criteria already passed at the end of round 1.

## Round 2

Spent on tightening and on probing whether the green was real.

1. Copy reworded to `Errors as a share of successful requests` (round 1's
   "Share of successful requests" passed the gate but read ambiguously — the gate
   only looks for placeholder tokens, it has no opinion on whether the sentence
   is right).
2. **Probed the default wait state on other gates** to confirm complaint 1 is systemic:
   `check copy`, `check breakpoints`, `check design` with no `--wait-until` each died
   at 31-32s with the *same* single unactionable line.
3. **Probed the contrast floor.** Set `.status` to `#949494` (3.03:1) —
   `check integrity` reported **CLEAN, exit 0**, while `check a11y contrast`
   reported `3.03:1 (need 4.5)` and exit 1. So criterion 1 does not cover
   complaint 2. Reverted to `#595959` and added `check a11y contrast` to my own
   verification set.
4. **Probed design sensitivity** with `--min-reuse 2`. The reuse figure did not
   change (still 1.5x) because it is `instances / distinct styles`, an average —
   see the complaint below.
5. **Wrote `vlmkit.gates.json`** in this directory and ran `gates run --config …`:
   **ALL PASS (4/4), wall 6.7s.** That is the actual answer to "I cannot get any
   of this into CI" — one committed config, flags included.

## Success criteria — exact commands and exit codes

```
node --experimental-strip-types src/cli/vlmkit.ts check integrity http://localhost:5201/ --wait-until load
  → exit 0   verdict: CLEAN (0 fail, 0 warn, 0 exempted)

node --experimental-strip-types src/cli/vlmkit.ts check copy http://localhost:5201/ --wait-until load
  → exit 0   status: ok

node --experimental-strip-types src/cli/vlmkit.ts check breakpoints http://localhost:5201/ \
  --rule overflow-at-boundary=suspect --wait-until load
  → exit 0   767px: clean

node --experimental-strip-types src/cli/vlmkit.ts check design http://localhost:5201/ \
  --wait-until load --exclude ".vendorchart-ctrl-group"
  → exit 0   DRIFT (2 finding(s), 11 element(s) excluded)

node --experimental-strip-types src/cli/vlmkit.ts check a11y contrast http://localhost:5201/ --wait-until load
  → exit 0   ✓ 0 contrast failure(s)          (extra — integrity is not sufficient here)

node --experimental-strip-types src/cli/vlmkit.ts gates run \
  --config fixtures/dogfood-dataviz-2026-08-11/attempts/agent-i/vlmkit.gates.json
  → exit 0   ALL PASS (4/4), wall 6.7s
```

### Criterion 4 — what the role-reuse number says about our own components

Before the exclusion:

```
button           6 inst    3 styles  reuse     2x  1 one-off  drift
Dominant style, used 3x: padding 0/0/0/0, radius 0, no painted text, border 0, bg rgba(0, 0, 0, 0).
Deviating: button#snooze (…); button#acknowledge (…)
```

The "dominant" style was the **three vendor zoom buttons**, so our own footer
buttons were reported as deviations *from the vendor's* fingerprint. Any change
we made to our own buttons could not move the verdict, and restyling the
library's controls only ever produced a third style. That is complaint 5.

After `--exclude ".vendorchart-ctrl-group"` (11 elements removed):

```
button           3 inst    2 styles  reuse   1.5x  1 one-off  drift
Dominant style, used 2x: padding 10/18/10/18, radius 8, 16px/400, border 1, bg rgb(255, 255, 255).
Deviating: button#acknowledge (padding 10/18/10/18, radius 8, 16px/400, border 1, bg rgb(34, 85, 204))
```

Reading: **our button role is coherent.** The two secondary buttons share one
style exactly; the single deviation is `#acknowledge`, which differs from them in
`background` (and border-color) and in *nothing else* — same padding, radius,
font size/weight, border width. That is a deliberate primary variant, not drift.
The number is 3 instances / 2 styles = 1.5x, and with a 3-button footer and one
primary CTA it is arithmetically incapable of reaching the 3x threshold: you
would have to delete the primary affordance to satisfy it. So for this page the
figure is a *description* ("one variant, differing only in fill"), not a target,
which is consistent with the gate keeping it warn-level and exiting 0.

## What did NOT help / actively misled me

1. **The timeout error is a dead end, and it is the single worst thing here.**
   The whole of the output was:
   ```
   error: page load timed out (Timeout 30000ms exceeded)
   ```
   No mention that the default wait state is `networkidle`, no mention that
   `--wait-until` exists, no mention that a request is still in flight, no
   mention of *which* request. The page paints in well under a second and the
   tool has already navigated it — it knows the milestone it was waiting on and
   it knows there are pending requests. It should say so. Something like
   `page load timed out waiting for networkidle (1 request still open: /api/live)
   — retry with --wait-until load`. As it stands, an agent or a CI owner with no
   docs access is stuck, and this is *exactly* the reported complaint 1: three
   separate gates (`copy`, `breakpoints`, `design`) all die at 31s with this same
   one line. I only escaped by reading `--help`. `docs/cli-reference.md:273` even
   describes this precise scenario ("a page renders in ~480ms but one third-party
   request stays in flight forever") — the knowledge exists in the repo and is
   absent from the failure.

2. **`check integrity` reports contrast at the large-text floor and calls a
   WCAG-AA failure CLEAN.** With `.status` at `#949494`:
   `check integrity` → `verdict: CLEAN (0 fail, 0 warn, 0 exempted)`, exit 0;
   `check a11y contrast` → `3.03:1 (need 4.5)`, exit 1. Integrity's own wording,
   `below the 3:1 floor even for large text`, is technically honest but reads as
   the authoritative contrast verdict, and the text in question is 13px. If I had
   fixed only far enough to satisfy criterion 1, the low-vision reporter would
   still be failed and the gate would have told me I was done. At minimum
   integrity's passing summary should point at `check a11y contrast`; better, it
   should use the size-appropriate threshold.

3. **`--exclude` is not discoverable from the failing output.** The `check design`
   finding names `button` styles with `no painted text, border 0, bg rgba(0,0,0,0)`
   — a fingerprint that screams "icon buttons I did not write" — yet the report
   never says "vendor subtree?" or "see `--exclude`". `check integrity` uses a
   *different* vocabulary for the same idea (`--allow <kind>@<selector>;<reason>`),
   so "how do I tell this tool a subtree isn't mine" has two answers depending on
   the gate and neither is mentioned where you hit the problem.

4. **`reuse 1.5x` is an average presented as a per-style claim, and it contradicts
   the next sentence.** The finding says:
   `each style reused only 1.5x` … `Dominant style, used 2x`.
   No style is used 1.5 times. `1.5x` is `instances / distinct styles`. Because it
   is an average, `--min-reuse 2` changed nothing — the threshold text updated
   (`a system reuses each style 2x or more`) but the metric stayed 1.5x and the
   verdict stayed `drift`, even though the dominant style *is* reused 2x. I could
   not tune this gate into agreement with its own detail line, and I had to work
   out the formula by hand from the numbers.

5. **The style fingerprint hides the attribute that actually differs.** Both
   button styles print `border 1`; the real difference between `#acknowledge` and
   the secondaries is `background` *and* `border-color`, and border-color is never
   shown. I had to open the stylesheet to know whether the deviation was one
   property or two.

6. **`check design`'s exit code and its banner disagree in tone.** It prints
   `verdict: DRIFT` in yellow and exits 0. Criterion 4 is satisfiable only because
   of that, but "DRIFT + exit 0" is a coin-flip to interpret in CI; the
   `1 warn(s) did not fail this command` footer is the only thing that resolves it
   and it is the last line, below the findings.

7. **Minor:** `check layout http://localhost:5201/` fails with
   `error: --contract <contract.json> is required` — correct, but it burns a
   30-second-free failure only because the gate is listed under `check` alongside
   the reference-free ones. Not a real problem, noted for completeness.

8. **Minor:** `check a11y contrast` writes `report: /home/user/vlmkit/test-results/a11y-contrast/report.md`
   — outside the page's directory and outside anything I asked for. In CI that is
   a stray artifact in the repo root.

## Not changed, deliberately

The `.vendorchart-ctrl button { border: 0; border-radius: 0; background: rgba(0,0,0,0); … }`
rules in `theme.css` are our stylesheet reaching into the library's DOM — the
"we restyled what we could reach" attempt from complaint 5. They are left in
place (removing them would leave the vendor controls browser-default) but they
are not the fix; `--exclude` is. Restyling vendor internals to satisfy a
consistency metric is the wrong direction and the brief rules it out.
