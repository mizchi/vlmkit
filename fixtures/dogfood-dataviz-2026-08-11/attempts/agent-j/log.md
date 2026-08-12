# agent-j — getting the ops dashboard into CI

Task: run `check integrity / copy / breakpoints / design` against the **served**
dashboard, reproducibly, from a **committed** config, invoked by one short command.
Not: fix the page.

Port 5202. CLI invoked as `node --experimental-strip-types /home/user/vlmkit/src/cli/vlmkit.ts`.

---

## Deliverable

**The command:** `bash ci.sh` (from anywhere; it `cd`s to its own directory)

**Committed files in this directory:**

| File | Role |
|---|---|
| `vlmkit.gates.json` | the gate plan — which gates, which flags, why (every flag has a `//`-comment) |
| `ci.sh` | starts the server, waits for it, runs `vlmkit gates run` |
| `record-har.mjs` | regenerates `dashboard.har` (vlmkit has no HAR recorder — see friction #4) |
| `dashboard.har` | the pinned network responses that make a run reproducible |
| `serve-jitter.mjs` | **not part of CI.** A probe server that randomizes `/api/metrics` on every request, used to prove the reproducibility claim rather than assume it. |

---

## Round 1 — get anything to report at all

### 1. Reproduced the reported symptom

```
$ node ... check integrity http://localhost:5202/
real 0m30.840s
EXIT=1
error: page load timed out (Timeout 30000ms exceeded)
```

That is the whole output. **The error names the symptom and nothing else** — no
mention of the navigation milestone, no mention of `--wait-until`, no hint that a
long-lived request is the usual cause. The page paints in <1s. I only found the
fix by reading `--help`. (Friction #1.)

### 2. Found the fix in `--help`, not in the error

`check copy --help` / `check breakpoints --help` spell it out on the flag itself:

> `--wait-until <domcontentloaded|load|networkidle>  Navigation wait state
> (domcontentloaded for an SPA that never reaches network idle) (default: networkidle)`

30.8s timeout → **2.2s with 4 findings**. Note `check integrity --help` and
`check design --help` print the same flag *without* that parenthetical hint —
inconsistent, and integrity is the gate you reach for first.

### 3. Scaffolded the config

```
$ node ... gates init --pages "http://localhost:5202/" \
    --gate "check integrity" --gate "check copy" --gate "check breakpoints" --gate "check design"
Wrote .../vlmkit.gates.json
```

Accepted a URL as a "page" without complaint — good. But it scaffolded no
navigation flags, so **the scaffolded config cannot run against a URL like this
one.** Running it verbatim:

```
$ node ... gates run
EXIT=1   (63.6s wall)
[1/4] fail 31.8s check copy http://localhost:5202/
[2/4] fail 31.9s check breakpoints http://localhost:5202/
[3/4] fail 31.9s check integrity http://localhost:5202/
[4/4] fail 31.1s check design http://localhost:5202/
verdict: 4 FAILED (0 passed)
```

**This is the worst output I saw all session.** Four red gates, zero reasons.
Nothing anywhere in it says "the page never loaded" — the per-gate
`page load timed out` message is swallowed by the runner. In CI this reads as
"the dashboard has four defects" when the truth is "no check ran". `--output`
also does not help: the log files contain the same bare timeout line, and the
runner's closing hint tells you to `--output <dir>` *even when you already did*.
(Friction #2.)

### 4. Same config + the milestone

63.6s → **6.6s, all four gates reporting**, 2 pass / 2 fail. Round 1 done.

---

## Round 2 — reproducibility, and the vendor DOM

### 5. Is a second run the same run? (measured, not assumed)

Three back-to-back `gates run` invocations, ANSI stripped, per-gate logs diffed:

```
check-integrity:   IDENTICAL across A/B/C
check-copy:        IDENTICAL across A/B/C
check-breakpoints: IDENTICAL across A/B/C
check-design:      IDENTICAL across A/B/C
exit codes: 1,1,0,0 in all three
```

But `serve.mjs` returns **constant** metrics (`148 / 412 / 0.031`), so that
proves nothing about the actual constraint. So I wrote `serve-jitter.mjs`: same
page, same held-open `/api/live`, but `/api/metrics` randomized per request
(queueDepth 4–98412, p95 7–19833ms, errorRate 0.0001–0.9999). Four runs of all
four gates against it:

| gate | exit code | report body |
|---|---|---|
| `check integrity` | 1,1,1,1 stable | findings identical; only the telemetry line moved (`ink 3.4%` → `3.3%`) |
| `check copy` | 1,1,1,1 stable | **differs every run** — the finding quotes the live value: `"…Error rate 87.9% TODO…"` vs `"…Error rate 99.2% TODO…"` |
| `check breakpoints` | 0,0,0,0 stable | identical |
| `check design` | 0,0,0,0 stable | identical |

**Answer to criterion 3: verdicts are reproducible; report text is not.** No
check flips morning-to-afternoon on this page, because none of the four gates
reads a *number* — they read layout, contrast, placeholder strings and style
reuse. But the copy finding embeds the live value verbatim, so log-diffing or
"same output" review across runs is noise, and it would be noise for any future
gate that keys on text extents.

Two hazards I noticed while doing this, neither surfaced by the tool:

- `check breakpoints` hit `/api/metrics` **six times in one run** (once per
  B-1/B/B+1 render). Under a live endpoint each of those three widths gets a
  *different payload*, so the gate's own B-vs-neighbour comparison is made
  across three different datasets. It didn't misfire here (metric values don't
  change discrete style properties) but a data-driven `boundary-spike` is
  structurally possible and would look exactly like a CSS bug.
- Nothing in any gate's output mentions that its input was live and unpinned.
  A gate that navigates to a URL knows it made network requests; none of them says so.

### 6. Pinned the data with `--har`

The docs (not the tool) point at HAR:

> `docs/configuration.md:35` — "For reproducible third-party responses, record a
> HAR with Playwright and replay it during the gate. Requests absent from the HAR
> are aborted rather than sent to the live network"

vlmkit ships **no recorder**, so `record-har.mjs` in this directory is that
missing step. Result — three runs against the *jitter* server with
`--har dashboard.har`:

```
### HAR integrity: IDENTICAL x3
### HAR copy:      IDENTICAL x3     ("…Error rate 48.2% TODO…" frozen from the recording)
```

and the jitter server's request log confirms it: 6 gate runs added **zero**
`/api/metrics` hits. Report text is now byte-stable, not just verdict-stable.

Bonus finding: **`--har` alone also unblocks the hang.** The replayed
`/api/live` is a *completed* 200, not a held-open stream, so `networkidle` fires
in 3.7s with no `--wait-until` at all. I kept `--wait-until domcontentloaded`
anyway so the plan still completes if the HAR is ever missing or stale.

### 7. `check design`'s number moves once vendor DOM is excluded

Without exclusion the gate judged 6 buttons / 3 styles and picked the **vendor's**
style as the norm:

```
button  6 inst  3 styles  reuse 2x  drift
  Dominant style, used 3x: padding 0/0/0/0, radius 0, no painted text, border 0, bg rgba(0,0,0,0)
  Deviating: button#snooze (…); button#acknowledge (…)
```

Those three zero-padding entries are the charting library's 24x24 icon buttons.
They outnumber the three real `.btn`s, so **our own buttons are the deviation by
construction** — restyling them can never converge. `--exclude
".vendorchart-ctrl-group"` (documented at `docs/configuration.md:44`) flips it:

```
verdict: DRIFT (2 finding(s), 11 element(s) excluded)
button  3 inst  2 styles  reuse 1.5x  drift
Excluded subtrees (11 unique element(s) omitted)
  - .vendorchart-ctrl-group: 1 root match(es), 11 element(s) removed
  Dominant style, used 2x: padding 10/18/10/18, radius 8, 16px/400, border 1, bg rgb(255,255,255)
  Deviating: button#acknowledge (… bg rgb(34,85,204))
```

Now the finding is about *our* design system (primary vs secondary button), and
the exclusion is printed with its element count so it can't rot silently.

### 8. The committed config does not survive `--config` from elsewhere

The repo's own CI (`.github/workflows/deploy-pages.yml:68`) runs
`gates run --config <path-to-config> --output <dir>` **from the repo root**. Doing
that with this config:

```
$ node ... gates run --config fixtures/.../agent-j/vlmkit.gates.json
verdict: 4 FAILED (0 passed)   (1.8s)
page.routeFromHAR: ENOENT: no such file or directory, open '/home/user/vlmkit/dashboard.har'
    at .../packages/vlmkit-core/dist/page-open.mjs:110:13
```

Relative paths inside `vlmkit.gates.json` resolve against **process cwd**, not
against the config file. A committed config's paths are relative to the config —
that is the only reading that survives being committed. This is the single
biggest committed-config problem I hit, and it presents as a raw Playwright stack
trace, not a config error. (Friction #3.) `ci.sh` works around it with
`cd "$(dirname "$0")"`.

---

## Results — which checks pass, which fail

`bash ci.sh` → **exit 1**, 2.9s wall, 2 passed / 2 failed. Run twice, output
identical apart from timings.

| gate | exit | verdict |
|---|---|---|
| `check integrity` | **1** | DEFECTS — 1 fail, 3 warn |
| `check copy` | **1** | suspect — 1 placeholder |
| `check breakpoints` | 0 | warn only (warn does not fail) |
| `check design` | 0 | DRIFT — warn only |

**Findings (reported, not fixed):**

1. `[page-overflow-x] @768` (suspect) — "The page scrolls horizontally by 24px at
   768px viewport width — caused by: `main.grid > section:nth-of-type(3)`
   (extends to x=792px: starts at 552px, 240px wide…)". Matches reported problem 3.
   `check breakpoints` finds the same thing and explains *why* it is tablet-only:
   "overflow:0/0/24px … layout breaks right at the 767px boundary" — the
   `max-width: 767px` query stops one pixel short of 768.
2. `[low-contrast-text]` x3 (warn) — the three `.status` lines at **2.38:1**
   (`rgb(168,168,168)` on white), "below the 3:1 floor even for large text".
   Matches reported problem 2.
3. `[placeholder-text]` (suspect) — `TODO: confirm the denominator with the
   platform team`. Matches reported problem 4. (The brief says the answer is
   "successful requests, not total requests" — but fixing copy is not my job.)
4. `[component-drift]` (warn) — after excluding vendor DOM: 3 buttons, 2 styles,
   `#acknowledge` deviates. This is the number that was stuck; see §7.
5. `[scale-outlier]` (info) — `header.topbar` paddingTop `20px` sits next to a
   6x-used `18px`.

**Severity note, deliberately left at defaults:** the tablet overflow fails via
`check integrity` but only *warns* via `check breakpoints`
(`overflow-at-boundary` is warn). Both gates print the escape hatch —
"1 warn(s) did not fail this command. To gate on one: `--rule
overflow-at-boundary=suspect`". I did not add it: nobody asked me to change what
counts as a failure, and criterion 4 says every flag must be explainable as
*needed*.

---

## Friction summary (blunt)

1. **`error: page load timed out (Timeout 30000ms exceeded)` is a dead end.** The
   tool knows it was navigating to a URL with `waitUntil: networkidle` and it
   knows requests were still in flight. It could name the in-flight request and
   print `--wait-until domcontentloaded`. Instead the fix is only in `--help`,
   and *only in two of the four gates' help text*.
2. **`gates run` erases the reason a gate failed.** "4 FAILED (0 passed)" with
   the per-gate error swallowed, and no distinction between *gate failed* (found
   defects) and *gate never ran* (page didn't load). A CI runner needs those to
   be different colours. Also: the closing hint "or pass `--output <dir>` to keep
   every log" prints even when `--output` was passed.
3. **Relative paths in `vlmkit.gates.json` resolve against cwd, not the config
   file.** Breaks `gates run --config <path>` — the exact invocation this repo's
   own workflow uses — with a Playwright ENOENT stack trace. A committed config
   whose paths only work from one directory is not really committed.
4. **`--har` is the documented reproducibility answer and there is no
   `vlmkit ... --record-har`.** Every project that wants a reproducible run
   against a live endpoint has to write the same 20-line Playwright script.
   That is the knowledge-in-someone's-shell-history problem, one level down.
   There is also no staleness signal: a page that starts using a new endpoint
   gets that request *aborted*, which surfaces as a broken-resource **defect**,
   not as "your HAR is out of date". And the recording is keyed on the full URL,
   so it is port-bound — change the port and the whole HAR silently stops matching.
5. **`gates init` does not know what it just scaffolded.** Given a `http://` page
   it emits a plan that cannot run against a URL that behaves like this one. It
   already has the URL; it could scaffold `--wait-until`/`--timeout` commented out,
   or warn.
6. **No gate says its input was unpinned.** Four gates navigated to a live URL,
   made real network requests, and reported verdicts with no indication that a
   re-run could differ. The reproducibility question — the one the platform
   engineer actually asked — I had to answer myself by writing a jitter server
   and diffing outputs. `gates run --repeat 2 --require-stable` would have
   answered it in one command.
7. **`check breakpoints` re-fetches per width** (6 `/api/metrics` hits per run),
   so its B-vs-neighbour comparison spans three different datasets against a live
   endpoint. Nothing warns about this. `--har` fixes it as a side effect.

## What genuinely helped

- The per-flag help text, specifically `(domcontentloaded for an SPA that never
  reaches network idle)` — that parenthetical is the entire round-1 fix.
- The `Persisting:` footer on every gate's `--help`: "a `"gates"` entry in
  vlmkit.gates.json is the whole command, so any flag above belongs there".
  That answered "how do I put this in a config file" without a doc lookup.
- `gates list` printing the fully resolved commands — that is how I verified the
  quoted `--exclude ".vendorchart-ctrl-group"` survived JSON escaping.
- `check design`'s `Excluded subtrees … 11 element(s) removed` block plus its
  promise to warn on a stale selector. An exclusion I can review is the
  difference between config and a silent suppression.
- Findings that name the culprit and the arithmetic: "caused by
  `main.grid > section:nth-of-type(3)` (extends to x=792px …; shrinking or moving
  it removes 24px of the overflow)". No guessing.
- `examples/vlmkit.gates.json` as a worked, commented example, and
  `.github/workflows/deploy-pages.yml` showing the real start-server-then-`gates run`
  CI shape.
