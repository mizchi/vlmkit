# Demo sites v1 — six sites built by agents, and a log of how each was judged

2026-09-23

The Pages site was two pages, the landing page and solitaire, and only one of them left a record of
being looked at. Solitaire's README has a table of what screenshots found; the landing page's visual
judgments survive as sentences in commit messages, with no picture of what was seen. This round asked
for more sites, of different kinds, and for the other half of the evidence: **how each one was
judged**, with the looking kept as carefully as the gate output.

**The round's headline number: of 136 defects found while building six sites, 96 were found by
looking at a screenshot and 40 by a gate.** Every gate the toolkit has was available to every
builder, and the protocol required the full set green before `done`. The gates did their part —
40 real defects, and 29 findings about the gates themselves — but they do not subsume looking, and
the largest class the eye found (27 line breaks that strand a word or split a name) is deterministic
enough to become a rule.

Two more pages were judged the same way and published beside their logs: the landing page (four
rounds, 34 defects, 31 by eye) and the gallery that lists everything (three rounds, 9 defects, 8 by
eye). **Across all eight logs: 179 defects, 135 found by eye and 44 by a gate, from 689 gate runs
and 1418 screens, every one of them looked at and described.**

## Method

- **`examples/sites/judge.mjs`**, a small CLI every gate run and every screenshot went through.
  `gate` keeps a run's exit code and whole output; `shot` takes one screen per image at native
  resolution, stepping short by whatever is pinned to the top and bottom of the viewport so the
  strip under a sticky header is in some picture; `look` records what was seen, against the image;
  `defect` must name the look or gate run that found it; `verify` must come after the fix. `check`
  is the log's own done condition and `done` refuses until it passes. `render` writes the published
  page (`judgment/index.html`) and `JUDGMENT.md`. Each log is one file, `judgment.sqlite` (see
  [Storage](#storage-after-the-round-2026-09-24): the first version kept loose files).
- **One protocol** (`examples/sites/PROTOCOL.md`) and **one brief per site** (`examples/sites/briefs/`):
  what it is, layout and behaviour, visual direction, required copy, the states to show. Fictional
  brands, static files, no network, deterministic.
- **Six fresh agents in parallel**, one per site, told to route their gate choice through the skill,
  not to read vlmkit's source or each other's sites, and to report tool problems as `note --kind tool`
  rather than work around them. A seventh did a visual review of the landing page.
- **An independent reviewer round per site** (the integrator): the key gates re-run, fresh full-page
  shots at desktop and phone width plus one or two states, looks recorded under `--actor reviewer`.
- **The integrator's own pages under the same rules**: the links this change added to the landing
  page (its fourth round) and the gallery (its own log, published at `/sites/judgment/`).

## Results

| site | pattern | rounds | gate runs | screens | looks | defects | by eye | by gate | reviewer |
|---|---|---|---|---|---|---|---|---|---|
| docs | documentation, 3 pages, EN | 5 | 163 | 235 | 63 | 29 | 21 | 8 | 0 |
| shop | product page, JA | 5 | 75 | 117 | 60 | 17 | 13 | 4 | 0 |
| dashboard | analytics app shell, EN | 5 | 56 | 64 | 44 | 16 | 11 | 5 | 0 |
| magazine | long-form article, JA | 6 | 71 | 150 | 43 | 37 | 26 | 11 | 1 |
| checkout | multi-step form, EN | 5 | 72 | 84 | 47 | 16 | 12 | 4 | 0 |
| kanban | drag-and-drop board, EN | 5 | 89 | 68 | 59 | 21 | 13 | 8 | 0 |
| **total** | | | **526** | **718** | **316** | **136** | **96** | **40** | 1 |
| landing page | product landing, EN/JA, reviewed | 4 | 119 | 624 | 108 | 34 | 31 | 3 | 34 |
| gallery | index of the above, EN | 3 | 44 | 76 | 18 | 9 | 8 | 1 | 9 |
| **all eight logs** | | | **689** | **1418** | **442** | **179** | **135** | **44** | 44 |

"screens" counts images; "looks" counts recorded observations (one look may cover a shot's every
screen). Every screen in every log was looked at — `check` refuses a log with one that was not.

### What only the eye found (96)

| class | n | examples |
|---|---|---|
| line breaking | 27 | a lede splitting the owner's name 汐田律 / 子さん; `--` ending a line and `batch-size` starting the next; a single 記 alone under 特定商取引法に基づく表記; "Portland, OR / 97214"; a heading ending on one kana |
| cramped or wrapped layout at in-between widths | 17 | the masthead at 768px breaking every word a character at a time (ほと / り, 暮 / ら / し) while `check integrity` called 768 CLEAN; four 93px phase cards at tablet; "New task" dropping to a third row |
| affordance, state and behaviour | 14 | a code block cut at its edge with no cue that it scrolls; a search toggle with no open state; a tap on ⋯ that opened a menu and closed it in the same moment (the tap scrolled the board) |
| typography and typeface | 12 | digits falling back to a fixed-pitch face; body text in a Chinese font; a copyright line at 10px; IPAPGothic setting 、。（） half-width |
| drawn imagery | 8 | a celadon crackle that read as a honeycomb; glaze drips that read as feet; a logo that read as a smiley |
| alignment and consistency across states | 7 | table columns moving 2–6px on every page change or sort; a phone field 20px lower than its neighbour because of a longer hint |
| meaning and content | 4 | a priority icon drawing every level at the same opacity; column notes blaming "the filter" when only a search was active |
| colour anomalies | 4 | a native search clear button in system blue, the only blue on the page; an off-screen skip link's shadow smearing into the header |
| spacing and legibility | 3 | team avatars overlapping until the initials read as one run, "AKMRPNJWLO" |

Three of these the gates could have seen and did not — they are follow-ups below, not taste:
the masthead crushed a character per line (`check integrity`), a label 4px from its kicker and 16px
from its list (`check composition` saw two others and not this one), and a pinned bar whose
translucency let the page's text ghost through (`check a11y contrast` measures the bar's own text).

### What the gates found (40)

`check design` 11 (spacing outliers and heading drift), `verify flow` 6 (three of them bugs in the
agents' own flow scripts), `check interactions` 5, `stress i18n` 4, `check integrity` 4,
`scan scroll` 2, `check copy` 2, `scan handlers` 2, `check composition` 2, `check animation` 2,
`check a11y focus` 1. The gate-found defects the eye could not have seen are the reason to keep both:
an SVG that became a Tab stop because it carried focus listeners, a checkbox tile that swallowed the
click after a blur re-validated the field above it and moved the page 130px, a drop animation that
`check animation` proved was never running.

## The gates, measured by the people using them

Twenty-nine `note --kind tool` entries across the six logs (ten more in the landing page's log, one
in the gallery's), most of them reported independently by more than one builder. Fixed in this
change, each with a test that fails on the old code:

| gate | defect | reported by |
|---|---|---|
| `check a11y focus` | positions sampled in viewport coordinates after each Tab's auto-scroll, so a forward move down any page taller than the screen read as `[reverse] Focus moved up by 424px`; and `runFocusOrder` carried its own copy of the Tab loop whose path-only cycle test stopped after one step when the first stop's path repeated | checkout, magazine, kanban, shop, dashboard |
| `check interactions`, `check grounding` | names computed by hand without reading `<label>`: `[radio] "2p3m"`, `[textbox] ""`, a `<select>` named by all its options; four scripts had their own approximation, none read labels | checkout ×2, shop |
| every gate | a relative page path with a query string read as a filename (`error: file not found: index.html?theme=dark`), so a second theme or step needed an absolute `file://` URL; three style gates also mangled `file://` sources | dashboard, docs, checkout, the reviewer |
| `scan scroll` | the visually-hidden (sr-only) box reported as cut-off content, on the elements `check integrity` exempts by the same ≤2px test; a `<textarea>`'s default overflow reported as a dead scrollport | kanban, shop, docs, dashboard, checkout |
| `check copy` | every text node its own line, so copy crossing inline markup with no space — ¥4,180<small>（税込）</small>, and English "over <strong>¥5,000</strong>." — was reported copy-invisible | shop |
| `check interactions` | a native checkbox's tick, a changed live region, and a button renaming itself ("Copy" → "Copied") read as a dead control or a focus move | checkout, dashboard, docs |
| `gates run` | "4 page(s) x 5 gate(s) = 8 job(s)" when pages run different gate lists | landing review |
| `check interactions` | a control whose markup says a press does nothing — `aria-disabled="true"`, or the `aria-current` page — reported as a dead control on every run | dashboard (twice, by hand) |
| `gates run` | the warn summary printed four identical `1  check integrity` rows with no page, and its hint `--show-output` printed failing jobs only and dropped the summary, so the warns appeared nowhere | landing, round 4 |
| `vlmkit.gates.json` `webServer` | the readiness probe used `fetch`, which refuses the Fetch standard's "bad ports" before connecting — 4190, the landing page's own server, is one — so an already-running server was never adopted, a second copy died on EADDRINUSE, and the error blamed "the command itself" | integration |
| `judge.mjs` | a phone walk that the 16-screen cap stopped 1016px above the footer counted as the round's full page; the warning was printed after the file list, where a filtered read missed it | landing, round 4 |

Measured on the six finished sites: the same gates run with the build the builders used and with
this change, each site's `index.html` at its default state (`check a11y focus`, `scan scroll
--viewport 375x812`, `check copy --manifest copy.txt`, `check interactions`, all `--json`). The
counts are findings, not pages; the last inert pair was fixed after the bench and is counted from a
re-run of `check interactions` on the dashboard:

| gate, finding | before | after |
|---|---|---|
| `check a11y focus`, `[reverse]` on a forward Tab | 7 (shop 3, magazine 3, checkout 1) | 0 |
| `scan scroll` at 375, `clipped-content` | 44 (kanban 20, checkout 13, shop 8, dashboard 2, docs 1) | 0 |
| `check copy`, `copy-invisible` | 1 (shop: ¥4,180 followed by （税込）) | 0 |
| `check interactions`, `inert-control` | 4 (dashboard's pager) | 0 |
| `check interactions` / `check grounding`, radios and checkboxes named by their `value` | 14 | 0 |
| `check interactions`, docs' Copy button read as moving focus | 5 | 0 |
| `check interactions`, checkout step 3 controls with no name | 6 of 9 | 0 of 9 |

Every one of those was a false report the builders had to classify by hand, with a note saying how
they knew; the logs keep those notes, so the old numbers stay visible next to the new.

Reported and left for follow-up (each with the reporter's verbatim evidence in its log):
`check copy` cannot reach copy behind a modal or produced by an action (shop, magazine);
`check scroll` scrolls a fixed 1.5 screens so a sticky element further down is never engaged, and
ignores `scroll-padding` when judging a snap (shop, landing, kanban); `check breakpoints` discovers
media queries only, not container queries (docs); `stress i18n` infers a wrap from box height, so a
stretched grid cell reads as wrapped (magazine); `scan handlers --probe-drag` takes a cancel's
baseline inside the previous drop's transition (kanban); `check animation` / `check motion` never
scroll, so scroll-linked motion reads as none (magazine); `check a11y touch` has no `--viewport`
(landing); a focus ring clipped by an ancestor's `overflow: hidden` passes both focus gates
(landing); `check composition` reads weight from computed style, which a missing bold face and
`font-synthesis: none` make untrue (landing). Found while integrating: `near-misalignment` measures
layout-box edges, including boxes that paint nothing there, so a centred row of a filled 48px button
and transparent 44px links reads as "2px off" although the visible edges agree to 0.3px — reported
independently on the landing page (N27) and the dashboard (N4); `check a11y touch` accepts an
unknown `--viewport` without a word and measures the desktop page (landing N30); and no gate can
emulate `prefers-color-scheme`, so a page that follows the OS theme cannot have its dark theme gated
at all — every builder with a dark theme added a `?theme=dark` parameter to get round it, and the
gallery's dark scheme was judged by eye and a computed token table (gallery N5).

## Candidate rules, from what the eye kept finding

- **A stranded last line.** 27 line-break defects on all six sites, most of them a paragraph, label
  or heading whose last line is one word or one or two CJK characters, or a line that begins with a
  separator (`· Aug 24`, `| 読了時間`). The integrator's own pages added three of the same class —
  a link broken across lines in the landing footer and twice in the gallery, one of them leaving
  "found" alone — and one cause worth checking first: Japanese titles on an English page with no
  `lang`, which Chromium breaks like English. Line boxes are measurable from
  `Range.getClientRects()`; the rule needs paired mutants and a live-corpus pass before any
  threshold is chosen.
- **Text starved of width.** The 768px masthead (magazine D30) and the tablet phase cards (docs D24):
  flex or grid items shrunk to min-content until text breaks per character or per syllable. A text
  block whose width is under ~2em while it holds more than a few characters is a candidate signal.

## The landing page, reviewed

The landing page had shipped through the gates with its visual judgments recorded only as sentences
in commit messages. A fresh agent reviewed it under the same protocol, in three rounds: the page as
published, a fix pass, and a final check, across en/ja × light/dark at 1280, 768 and 375.

- **31 defects, 29 by eye and 2 by a gate** (a nav link 41px wide from `check a11y touch --level
  AAA`, and a 19px overflow at 320px in Japanese, introduced by one of the eye's own fixes and caught
  by `check breakpoints --sweep`). The eye found the hero h1 confined to a 558px column and so
  four lines where two were written; fractional-`fr` grids leaving dead bands; focus rings clipped
  by an ancestor's `overflow: hidden` (which passes both focus gates); Japanese headings whose kana
  lost their weight and whose phrases broke mid-word until `word-break: auto-phrase` (three
  defects in sequence); stat figures that did not share a line; a dark theme whose command band had
  no surface of its own.
- **82 gate runs and 527 screens** before this change, the last matrix ALL PASS 8/8.
- Left on purpose and written down so the next reviewer knows (N24): three phrase breaks the
  browser's segmenter draws inside a word, and the phone h1's four lines, which a contract test pins.

Its fourth round judged this change's own additions — the link to the gallery in the demo band and a
footer line to the gallery and to the log — and found three more: the footer links broke mid-link at
every width below about 1230px (D32, by eye), they were the page's only targets under 44px (D33,
from `check a11y touch`, excused only by WCAG's inline exception), and the fix for that let the focus
ring run through the tagline (D34, by eye). The round also found the three tool defects above in
`gates run`, `webServer` and the judge itself.

The landing page's Playwright VRT baselines (`tests/vlmkit/*-snapshots/*-darwin.png`) are macOS
screenshots that CI does not run; this review changed the page, so they need `just vrt-update` on a
Mac before `just vrt` passes again.

## The gallery, judged like the rest

`/sites/` is generated from the Pages manifest and the logs (`examples/sites/gallery.mjs`), and
`sites.test.mjs` fails when its numbers and the logs disagree. That holds its words to the logs; it
says nothing about how it reads. Judged in three rounds, it had nine defects: a lede that claimed
every page was built from a brief (two were not), a stat whose wrapped label dropped its number
below its neighbours', a link that left "found" alone on a line, Japanese titles without `lang`
that broke inside words, a footer link broken across lines, 22 targets under 44px at AAA, a brand
set in capitals, a first fix that loosened only one-line titles, and a focus ring drawn flush on the
text. The title links were then exempted at AAA by WCAG's own "equivalent target" exception —
declared with `--allow` against the path the gate prints — rather than enlarged.

## Publishing

- `scripts/build-pages.mjs` publishes each log's page and the screenshots it keeps, read out of its
  `judgment.sqlite` at build time, never the database itself (raw events, and gate outputs the page
  inlines).
- `tests/pages-site.test.mjs` holds the published tree to the manifest file for file, checks that no
  page links a host-absolute path, and resolves every relative link on every published page to a
  published file — 2977 links on 19 pages when every screen was published, 1281 since a round keeps
  one walk per width.
- `.github/workflows/deploy-pages.yml` runs `vitest run examples/sites/` (each log complete by its
  own `check`, ended in `done`, holding exactly the screens it keeps, its committed `JUDGMENT.md`
  fresh; the gallery fresh) and `gates run --config examples/sites/vlmkit.gates.json` (integrity and
  contrast on the gallery and every demo page, served the way Pages serves them) before building
  the artifact.
- The screenshots were re-encoded from JPEG to WebP after the first round (a one-time `recode`,
  which says so in each log): 1245 screens, 63.4 MB → 34.4 MB; with this change's rounds the eight
  logs' screens came to 39.0 MB.

## Storage, after the round (2026-09-24)

The first version kept each log as loose files beside the site — `judgment/log.jsonl`, one text file
per gate run, one WebP per screen — and the eight logs came to **2107 files**, which made this change
one of 2235. Each log is now **one `judgment.sqlite`** (events in order, every gate run's whole
output, the screens it keeps) next to its `JUDGMENT.md`, which is text and diffs in review:

- **Packed losslessly first.** 2399 events, 689 gate outputs and 1418 screens read back equal to the
  files they came from, and both renders of every log were byte-identical to the committed ones.
- **Then the pictures were cut to checkpoints.** A round a `done` has closed keeps one full-page walk
  per width — desktop, tablet, phone; the last that shows the page as a visitor lands on it, else the
  last that reached the end — and lets the other screens go: **1418 screens and 39.0 MB became 554
  and 16.7 MB**. Every shot, look and defect is still in the log, and the page says which shots kept
  no pictures. Close-ups and states were the builders' working views; the defects they found are
  described in the looks that found them.
- **`judgment/` is an export, not a record** (gitignored): the screens `shot` writes for the builder
  to Read, and the page `render` writes. The Pages build and the local server read the page and the
  kept screens out of the database — the server per request, so a new screen no longer needs a
  restart. `JUDGMENT.md` carries no pictures; each kept shot and every gate run links to the
  published page.
- The gallery's text changed with it, so it took a fourth round in its own log (4 gate runs, 16
  screens, all kept). All eight logs together: 1434 screens looked at, 570 kept, 21.0 MB of
  databases; the Pages artifact went from 1463 files to 615 (36 runtime files, 8 log pages, 570
  screens, `.nojekyll`).

## What changed in how the toolkit is used

`markup-assist`'s done condition now ends with **look at it**: full-page screenshots at desktop and
phone width and of every named state, read and written down before the page is called done. The
number above is the reason.
