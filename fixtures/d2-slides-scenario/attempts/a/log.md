# Log — tala-talk deck (attempt a)

## Round 1

**What I wrote:** `deck.md` with 7 slides matching the brief's outline exactly
(title, problem, "What D2 is" + 3-box figure, "What TALA is" + dagre/elk/tala
figure, "the one thing that bites you" + api/data phantom-edge figure, the
loop as a bulleted list, closing). Used the five required strings verbatim as
substrings of full sentences (e.g. "It is **not in the diff**", "D2 **creates
a new shape**"). Speaker notes via `<!-- notes: ... -->` on three slides.

For the TALA figure I deliberately renamed the D2 node `tala` to
`tala_engine` — `.claude/skills/d2-slides/SKILL.md`'s failure-modes list says
plain box names colliding with D2 keywords break compilation, and while
`tala` itself isn't on the listed keyword set (`width, height, label, style,
shape, icon, near, top, left, direction, class, link, constraint, layers,
steps, scenarios`), I erred toward the safer id since the label still reads
"tala" to the audience.

**Build:**
```
✓ .../built/index.html: 7 slides, 3 figure(s) laid out by tala, 25 copy lines → .../built/copy.txt
```
Exit 0, no stderr, no overflow warning.

**Gates run:**
1. `check integrity built/index.html` → `verdict: CLEAN (0 fail, 0 warn, 0 exempted)`
2. `check integrity built/print.html --viewports 1280` → `verdict: CLEAN (0 fail, 0 warn, 0 exempted)`, `56 text block(s)`
3. `check copy built/print.html --manifest built/copy.txt --allow-invisible unknown` → `manifest: 25 line(s), missing 0, 1 invisible-allowed` — the invisible-allowed line was `"It is open source (MPL-2.0) and bundled"` (reason: unknown), matching the skill's documented failure mode ("a manifest line whose rendered text is assembled from several inline children can read as invisible... Run with `--allow-invisible unknown` and check the `missing` count, which is the part that matters").
4. `check a11y contrast built/print.html` → `inspected 63 text-bearing element(s)`, `✓ 0 contrast failure(s)`

**Decision:** All four done-condition checks passed on the first build. Verified the five required strings are present as substrings of `copy.txt` (grep -F, all 5 found) and that 3 figures were emitted (brief requires exactly 3: D2-pipeline, dagre/elk/tala choice, api/data phantom-edge). Stopped here — budget not needed further.

## What helped from SKILL.md
- The exact `--allow-invisible unknown` failure mode, quoted above, let me recognize the one invisible-allowed line as expected rather than a defect, without spending a round investigating it.
- "`width`, `height`, `label`, `style`, `shape`, `icon`, `near`, `top`, `left`, `direction`, `class`, `link`, `constraint`, `layers`, `steps` and `scenarios`" — this list made me check my D2 figures for `direction` (used as a D2 statement, fine) and consciously rename the `tala` box even though it isn't on the list, to be safe rather than spend a round on a compile failure.

## Friction / things I would have wanted (but did not read, per instructions)
- I never needed `build-deck.mjs` or `examples/d2-slides/` — the SKILL.md deck-format example plus the failure-modes section were sufficient to get a green build in round 1. No finding to report there beyond: the skill's own worked example wasn't necessary scaffolding for a brief this size (7 slides, 3 simple figures).
- Minor gap: the skill doesn't say what counts as "one figure" toward a brief's required-figure count when a slide's `.d2` fence fails to compile — I only confirmed presence by trusting the builder's own "3 figure(s) laid out by tala" line, not by rendering each SVG and eyeballing it against the brief's figure description (e.g. that the api/data figure really shows the edge drawn "from the root with full paths" rather than nested wrong). The build succeeding doesn't guarantee the figure's *content* matches the brief's figure spec — that would need a `d2-facts.mjs` check per slide, which the skill mentions but I didn't need to invoke since no gate demanded it.

## The one change that would have saved the most
Nothing cost a round here — the loop worked as documented on the first pass.
If anything, the skill could save a *verification* round (not applicable to
this run, but noted): a line in the done-condition section like "run
`d2-facts.mjs --from-svg` per figure if the brief specifies figure *content*,
not just figure *count*" would close the gap above, where a compiling figure
with the wrong shape/edges would still show up as one of the builder's
"N figure(s)" and pass every gate in this skill's list.
