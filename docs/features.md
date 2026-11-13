# What vlmkit does

vlmkit checks rendered frontend work deterministically: it loads the page in a real browser,
measures it, and says what is wrong and where. Nothing here needs an API key unless it is marked
**[key]**. Optional AI assists are marked **[opt key]**: they add something on top of a
deterministic result and are never needed for it.

There are **37 gates** with **248 tunable rules** (`vlmkit rules` lists them). A gate is a command
with a verdict and an exit code: 0 clean, 1 a finding, 2 a usage error. The other commands
produce artifacts, run loops or wire vlmkit into other tools. `tests/features-doc.test.mjs` fails
when a command exists that this page does not name, or when the counts above drift.

For which command to reach for in a given task, read [`markup-assist.md`](./markup-assist.md). For
every flag, read [`cli-reference.md`](./cli-reference.md).

## Is this page broken? (no reference)

| Command | What it answers |
|---|---|
| `vlmkit check auto <page>` | Probes the page once, picks the gates that apply (with a reason each) and runs them in parallel for one verdict |
| `vlmkit check integrity <page>` | Reference-free defects at three widths: JS errors, empty render, broken resources, text collision / clipping / protrusion, collapsed containers, overflow, invisible or occluded text, unstyled page. `--timeline` judges the page at instants of its motion |
| `vlmkit check copy <page> --manifest copy.txt` | The copy is present, visible and verbatim; placeholder text. `--target` compares with an image **[opt key]** |
| `vlmkit check layout <page> --contract c.json` | A brief's structure per viewport: widths, items per row, stacking order |
| `vlmkit check a11y contrast` · `check a11y touch` · `check a11y focus` | WCAG AA contrast, touch-target size, focus order and traps |
| `vlmkit check perf <page>` | Web Vitals thresholds (CLS, LCP, FCP) |
| `vlmkit check crater` | Whether the Crater BiDi rendering backend answers (only when you render through Crater) |

## Does it behave? (state, sizes, input, data)

| Command | What it answers |
|---|---|
| `vlmkit check interactions <page>` | Keyboard probes mapped to ARIA state transitions; `--reference` holds them to a contract |
| `vlmkit scan handlers <page>` | Every wired event listener, and controls that only a pointer can reach |
| `vlmkit check breakpoints <page>` | Renders each breakpoint at B-1 / B / B+1 and flags spikes, gaps and overflow (`--sweep` fuzzes the widths between) |
| `vlmkit check responsive <page>` | Generated viewports per media-query regime (plus text scale), each failure shrunk to its exact width range, breakpoint and declaration |
| `vlmkit check scroll <page>` · `scan scroll <page>` | Fixed elements hold, engaged sticky sticks, mandatory snap lands; the inventory of scroll containers and clipped content |
| `vlmkit check mobile <page>` | As a touch phone: zoom allowed, carousels land on a slide when swiped, the software keyboard leaves the focused field visible, nothing under the notch |
| `vlmkit stress i18n` · `stress data` · `stress media` | Text inflated for other languages; lists emptied, cut to one and multiplied, unbreakable names, 9,999,999, broken images; forced colours, reduced motion, print, RTL, 200% zoom |
| `vlmkit verify flow <page> --flow f.json` | A scripted flow, each action followed by a deterministic postcondition |
| `vlmkit act <page> --goal … --expect …` | A browser agent whose steps are verified: a step that breaks the page is rolled back, and the run is VERIFIED only when every postcondition holds. Planner: an LLM **[key]**, a fixed `--plan`, or any program (`--planner-cmd`) |
| `vlmkit inspect interact` · `inspect explore` · `inspect smoke` | A scripted interaction sequence with snapshots; every declared action discovered and diffed; an accessibility-driven exploratory smoke test |

## Does it move right?

| Command | What it answers |
|---|---|
| `vlmkit check motion <page>` | Which elements declare animation or transition, and whether reduced motion is honoured |
| `vlmkit check animation <page>` | Each animation sampled on a held clock: does it show, settle, honour reduced motion. `--virtual-time` measures rAF / timer motion; `--frames` and `--strip` keep the frames |
| `vlmkit inspect motion <page> --selector …` | Is a motion visibly broken, judged from frames: jumps, snap-backs, easing, direction, origin, timing, covered or clipped targets, against `--expect-*` from a brief. `--track` follows a target by its pixels (canvas), `--baseline` holds it to an approved run, `--jev` adds a model's reading **[opt key]** |
| `vlmkit check flash <page or recording>` | WCAG 2.3.1 Three Flashes at every 60fps frame, with motion told apart from flashing |
| `vlmkit snapshot strip` · `snapshot storyboard` · `snapshot flipbook` | One still sheet of frames; the states and events a frame sequence shows (`--lossy` for recordings); an HTML flipbook of screenshots to step through |
| `vlmkit scan video <recording>` | A recording decoded through your own ffmpeg into frames the commands above read |

## Is the design coherent?

| Command | What it answers |
|---|---|
| `vlmkit check design <page>` | Whether the page is consistent with itself: one button style or six |
| `vlmkit check composition <page>` | Whether spacing groups what belongs together, edges share a rail, and size follows the declared hierarchy |
| `vlmkit check color <page>` | What each colour is for, and where colour alone carries a meaning (WCAG 1.4.1, 1.4.11) |
| `vlmkit scan style <page>` | One page load saved for the three above (`--from`) |
| `vlmkit check tokens` · `check theme` · `check palette` | Values against a token scale you declare; colours hard-coded where dark mode should change them; dominant colours of an image |
| `vlmkit check drift component` · `check drift pages` | One selector's instances drifting apart, on one page or across pages |
| `vlmkit check asset <png> --slot …` | A generated image checked before it enters a slot: aspect, transparency, occupancy, contrast with its backdrop, palette |

The paint-reading gates take `--color-scheme dark`.

## Apps with no DOM

| Command | What it answers |
|---|---|
| `vlmkit scan a11y <url or dump>` | Writes the accessibility tree and frame of Flutter web, an Android uiautomator dump or a macOS window (`--app`) |
| `vlmkit check a11y tree <a11y.json>` | Unlabelled controls, unreachable content, contrast from the frame's pixels, target size |

`check integrity`, `check copy`, `check color`, `check design` and `check composition` also take
`--elements` (a scene a renderer writes) in place of a page. Contract: [`a11y-tree.md`](./a11y-tree.md).

## Match a target design

| Command | What it answers |
|---|---|
| `vlmkit verify markup <page> --target t.png` | One done verdict: composition per target, gates, pixel diff, and a fix list with selectors |
| `vlmkit build page` · `build component` · `build gallery` | Page-level composition diff; a component converged on a screenshot; components turned into a story gallery |
| `vlmkit scan mock` · `scan component` · `scan breakpoints` | A @2x / @3x export normalised to CSS px; a screenshot cut into component crops; the page's breakpoints discovered |
| `vlmkit contract introspect` · `contract validate` · `contract scaffold` | UI Contract IR inferred from HTML, validated, and compiled to an HTML/CSS scaffold |
| `vlmkit check equivalence <attempt> --region …` | Whether the regions left over are visually equivalent: a measured delta, and with `--vlm` a model's reading checked against it **[opt key]** |
| `vlmkit heal selector` · `heal markup` | Replacements for a selector that no longer matches; an LLM's CSS fix from a kickback, kept only if the gates pass **[key]** |

## Compare and track changes (VRT)

| Command | What it answers |
|---|---|
| `vlmkit diff html` · `diff png` · `diff elements` · `diff component` | Two pages, two screenshots, or elements compared, with shifts isolated from real changes. `diff png --jev` labels each region **[opt key]** |
| `vlmkit diff matrix` · `diff browsers` · `diff agent` · `diff runs` | Region presence per viewport; Chromium / Firefox / WebKit; a Markdown report for an agent; several runs aggregated |
| `vlmkit snapshot` · `snapshot approve` · `baseline` | Multi-viewport baselines and per-viewport diffs, then approval |
| `vlmkit check story <story> --gallery …` | One component mounted from a gallery and diffed against its own baseline |
| `vlmkit watch` · `diff-pr` · `workflow` | A file watcher with round-over-round deltas; a PR gate with per-route thresholds; the stateful baseline / snapshot workflow |
| `vlmkit migration` · `manifest` | A framework or CSS migration compared (compare / blind / subagent); approval manifests |

## Drive a page from a screenshot

| Command | What it answers |
|---|---|
| `vlmkit check grounding <page>` | The action map in screenshot pixels, and which element a click at each point really reaches |
| `vlmkit inspect locate <png> "<description>"` | A described element found on a screenshot, with no DOM **[key]** |
| `vlmkit inspect claims <png> --forbid …` | Advisory yes / no checks of what a screenshot shows; never a gate **[key]** |

The **[key]** commands use TypeSafe Jev (`TYPESAFEAI_API_KEY`). It answers typed questions; the
values always come from the pixels and the page. See the README's Jev table.

## Run it at scale and wire it in

| Command | What it does |
|---|---|
| `vlmkit batch --gate "check integrity" "routes/**/*.html"` | Gates over many pages in parallel, with sharding and per-job timing |
| `vlmkit gates` | Per-page gate sets and suppressions (reason, owner, expiry) from one reviewed `vlmkit.gates.json`; `{ "motion": … }` entries for briefs |
| `vlmkit rules` | Every gate and the rules it can tune: `--rule check.integrity/<id>=off` (or `info`, `warn`, `suspect`) per run, or `"rules"` in `vlmkit.gates.json` |
| `vlmkit mcp` · `vlmkit api` | The gates as MCP tools over stdio; an HTTP API server |
| `vlmkit skill` · `vlmkit markup-loop` | Per-project skill playbooks; a drop-in markup agent loop |
| `vlmkit bench` · `vlmkit report` | Gate and rule cost (`bench gates`) and the CSS challenge benchmark; its detection report |

Every measuring run appends one line to `.vlmkit/run-ledger.jsonl` (`--no-ledger` turns it off): an
auditable record that an agent really measured again after each fix.
Projects can add gates of their own through `vlmkit.config.json` plugins:
[`authoring-gates.md`](./authoring-gates.md).

## Libraries beside the CLI

| Package | What it is |
|---|---|
| `@mizchi/vlmkit-heal` | A self-healing loop for Playwright tests: runs a test, reads the failure, patches the test or its baseline, escalating from cheap to strong models under one budget **[key]** |
| `@mizchi/vlmkit-plan` · `@mizchi/vlmkit-generate` | A user story, seed test and UI observations into a Markdown test plan, then into a Playwright spec |
| `@mizchi/vlmkit-judge` | The pure judges (integrity, composition, colour, design, flash, storyboard, motion paths…): data in, findings out, no browser |
| `@mizchi/vlmkit-animation-eval` | The frame-sampled animation evaluator and the held clock behind `check animation` |

## Agent skills

The same workflows ship as agent skills (Claude Code plugin, APM, the skills CLI): `markup-assist`
(routing), `auto-markup`, `mock-markup`, `dynamic-markup`, `markup-decompose`, `component-vrt`,
`spec-to-playwright`, and the VRT skills. Install: [`configuration.md`](./configuration.md).
