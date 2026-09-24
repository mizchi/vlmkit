# Building a demo site, and logging how it was judged

You are building one static site under `examples/sites/<name>/` from the brief you were given
(`examples/sites/briefs/<name>.md`). It will be published on vlmkit's GitHub Pages as a demo,
next to the log of how you judged it. **The log is half of the deliverable.** A reader must be
able to see, for every decision, what you ran, what you saw, and why you acted — and in
particular which problems only your eyes found, because no gate reported them.

Work from the repository root, `/home/user/vlmkit`, and use absolute paths when you Read files.

## The site

- **Static files only**: `index.html` (plus any further pages the brief asks for) and the CSS / JS
  it loads, in your site directory. No build step, no dependencies, **no network requests** — no
  CDN, no web fonts, no remote images. Draw imagery with CSS or inline SVG. Use system font stacks.
- **Works from disk and from a sub-path**: relative URLs only, classic `<script src="…">` (not
  `type="module"`, which `file://` blocks), no `fetch` of local files. It will be served at
  `https://mizchi.github.io/vlmkit/sites/<name>/`.
- **Deterministic**: no unseeded `Math.random()`, no `Date.now()` / `new Date()` in anything
  displayed (write fixed dates into the data), nothing that keeps changing after the page settles
  unless the brief asks for motion. Honour `prefers-reduced-motion`. If anything animates on load,
  support `?animate=0` to skip it.
- **Accessible by construction**: landmarks, real `<button>` / `<a>` / `<input>`, labels, visible
  focus, full keyboard operation, WCAG AA contrast in every theme the brief asks for.
- **Fictional brands only.** Every line under the brief's "Required copy" must appear verbatim and
  visibly; put them in `copy.txt`, one per line, for `check copy --manifest copy.txt`.
- Also write a short `README.md` (what the site is, its URL parameters, its files).

## The tools

Every gate run and every screenshot goes through the judge, which records it:

```sh
J="node examples/sites/judge.mjs examples/sites/<name>"
$J init --title "<site title>" --pattern "<pattern from the brief>" --brief examples/sites/briefs/<name>.md
$J round "first draft"
$J gate check integrity index.html          # any vlmkit command; paths are relative to the site dir
$J shot index.html --full --viewport desktop,mobile
$J look S1 - <<'EOF'
…what is actually in the picture…
EOF
$J defect --from L1 --where ".hero h1" "…"   # or --from G3 for a gate finding
$J fix D1 "…what you changed…"
$J verify D1 --by L4                          # a LATER look or gate run
$J note --about G5 --kind false-positive "…why, and how you know…"
$J status        # where the log stands
$J check         # what it still needs before it can say done
$J done "…"      # refuses until check passes, then renders the log
```

`node examples/sites/judge.mjs x --help` lists every flag. `shot` takes `--click`, `--hover`,
`--focus`, `--press`, `--type`, `--fill sel value`, `--scroll-to`, `--wait` (in order, before the
shutter), `--element sel` for a close-up, `--scale 2` for fine detail, `--dark`,
`--reduced-motion`, and `--scroll-el sel` to walk a scroll container instead of the window.

- **To choose gates**, read `skills/vlmkit/SKILL.md` (the router) and the workflow it sends you to
  (`markup-assist`; `dynamic-markup` when the brief specifies behaviour). `node dist/vlmkit.mjs
  <group> --help` and `node dist/vlmkit.mjs rules` list what exists. Record the gate set you chose
  and why as a `note --kind decision`.
- **Screenshots are the only way you see the page.** `shot` prints one file per screen; **Read every
  one with the Read tool before you write its look.** A look you did not read is worse than none.

What caught people out in the first rounds:

- A full-page walk stops at 16 screens. A longer page says `STOPPED SHORT of the end` in the shot's
  own `[judge]` line, and `check` will not count that shot as the round's full page — pass
  `--max-tiles` (the check names a number that reaches the end).
- `--element` shoots the **first** match. `footer` matched a pull quote's `<footer>` on the landing
  page; name the one you mean (`.site-footer`).
- Text that starts with a dash (`--measure 42rem …`) goes after `--`, or in a heredoc with `-`.
- Screens are saved as WebP and are what the log page publishes. What a gate writes with
  `--output-dir` lands under `test-results/`, which is ignored and never published — the log keeps
  each run's whole output instead.

## The loop

1. `round "first draft"`: build a complete first version of everything in the brief. Run the gate
   set, take full-page shots at desktop and mobile (and tablet when the layout changes there), Read
   every screen, write a look for each shot, raise defects, fix, verify.
2. A new `round` for each pass after that ("fix pass", "interactions", "dark theme", …).
3. Last, `round "final check"`: the whole gate set again, full-page desktop and mobile shots, and a
   shot of **every state the brief lists under "States to show"**. Look at all of them. `check`,
   then `done`.

### What a look is

Write what is in the picture, not what you meant to build: layout and alignment, what reads first,
spacing rhythm, text wrapping (orphans, awkward breaks, truncation), overlap and clipping, colour
and contrast, state (focused, selected, open, error), and anything that looks off against the
brief. Name the screen number when it matters. Judge like a demanding designer and like a
first-time visitor: is it obvious what this page is and what to do next? Does anything look
broken, cramped, unbalanced, generic or unfinished? If you see nothing wrong, say what you checked.

### Defects, fixes and gate findings

- Every problem you act on after the first draft is a `defect` with a provenance: `--from` the look
  or the gate run that showed it. Something you only noticed in the code: take a shot of it, look,
  then raise it — the log counts what was seen or measured, not what was remembered.
- Every gate finding you do not fix gets a `note --about G#`: `false-positive` (the gate is wrong
  about this page — say how you know, ideally with a shot) or `accepted` (real, left on purpose,
  and why). Do not silence a rule to get green; `--rule x=off` only with a note saying why.
- A gate that misbehaves (crashes, reports nonsense, contradicts what the screen shows) is a
  finding about vlmkit: `note --kind tool` with the verbatim output. Do not work around it silently.

## The gate set

In the final round, at least: `check integrity`, `check copy --manifest copy.txt`, `check design`,
`check composition`, `check color`, `check a11y contrast` (every theme — use the URL parameter the
brief defines), `check a11y focus`, `check a11y touch`, `scan scroll`, `scan handlers`,
`check interactions`. Add what the brief's behaviour needs — `check breakpoints --sweep`,
`check scroll`, `check animation` / `check motion`, `scan handlers --probe-drag`, `verify flow`,
`check grounding`, `stress i18n` — and say why in your decision note.

## Rules of the room

- **Stay in your directory.** Edit nothing outside `examples/sites/<name>/`. Do not edit anything
  under `judgment/` by hand. Do not commit, and do not run `pnpm install` or `pnpm build` —
  `dist/` is shared with other agents and is already built. No servers are needed: gates and shots
  take `index.html` straight from disk.
- **Work independently.** Do not read the other sites in `examples/sites/` or their logs, and do not
  read vlmkit's source (`packages/`, `src/`) — use the CLI as a user would, from its help and the
  skill files.
- The machine is shared with other agents. If a timing-sensitive result (animation, interactions)
  looks flaky, run it once more before acting on it, and say so in a note.
- Fonts on this machine: Latin text falls back to DejaVu / Liberation; Japanese to IPAGothic /
  WenQuanYi Zen Hei. There is **no Japanese serif (Mincho)** here, so a serif stack renders as
  Gothic in your screenshots — write the stack for real devices, judge what you see here.

## When you finish

Reply with: what you built (a paragraph), the gate set and its final state, the defects by source
(eye vs gate) and the three most interesting ones, any gate false positives, anything in vlmkit or
`judge.mjs` that got in your way (verbatim), and anything in the brief you could not do.
