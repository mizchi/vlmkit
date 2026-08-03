# Hard-target executable audit: SPA / auth wall / webfonts (2026-08-01)

Follow-up to the round-10 finding in
[the introduce.md eval loop](./2026-08-01-introduce-doc-eval-loop.md):
reading personas were saturated, and the value came from *executing*
the documented commands. Every gate audit before this one ran against
flat, hand-written fixtures and mirrored static sites. This one runs
them against the three input classes the docs admitted were untested.

## Targets

Purpose-built and served from one local server (`server.mjs`):

| Target | What it stresses |
|---|---|
| Vite + React 19 SPA | client rendering with a 120ms post-load tick, runtime CSS-in-JS injection, hash routing, portal modal, **open shadow-root** web component, canvas-only text, 5000-row **virtualized** list (~14 in DOM), CSS Grid app shell |
| Auth wall | `/dashboard` behind a session cookie, 302 → `/login` |
| Webfont page | `@font-face` + `font-display: swap`, font response delayed 900ms |
| Polling page | `setInterval(fetch)` — never reaches network-idle |

Planted defects (ground truth): a fixed **760px** table inside the grid
shell (overflows at 375/768), a `<div onClick>` with no role or keyboard
path, and a spec'd copy line inside a `font-size: 0` span.

## Defects found and fixed

### 1. Auth-walled route produced a green verdict (worst class)

`check integrity http://…/dashboard` followed the 302 and measured the
**login page**, reporting `verdict: CLEAN`. A gate reporting CLEAN for a
page that never rendered is worse than an error: the protected page's own
820px overflow was never seen. `check copy` on the same URL reported the
dashboard's copy as "missing" — true of the login page, misleading about
the cause.

Fix: `packages/vlmkit-core/src/navigation-redirect.ts` compares requested
vs. final URL. Cross-path or cross-host redirects are reported; cosmetic
ones (scheme upgrade, trailing slash, `www.`) stay quiet so the warning
keeps its meaning. Integrity treats it as a **fail** (never report on a
page you did not measure); copy prepends it as a suspect so the real
cause leads. Login destinations get an explicit "vlmkit cannot inject a
session" hint. 5 unit tests.

Before: `verdict: CLEAN`, exit 0. After: `DEFECTS`, exit 1, with the
redirect named.

### 2. `check interactions` / `scan handlers` were blind on any SPA

Both navigated with `waitUntil: "load"` — which fires *before* a
client-rendered app paints. On the React target `check interactions`
reported **`interactive elements: 0`** for a page with a button, two
links and a scroller, and `scan handlers` reported **`status: ok`** while
the planted pointer-only `<div onClick>` sat in the DOM. Both were
measuring the `"Loading…"` placeholder — a silent false pass on the
entire client-rendered ecosystem.

Fix: a shared bounded `settleAfterLoad()` (network-idle with a 5s cap,
`document.fonts.ready`, then a commit tick). Bounded and swallowed on
purpose so never-idle pages do not turn a scan into a 30s hang.

After: 3 interactive elements discovered; the pointer-only control is
caught. Notably this means the "React delegation blindness" hypothesis
was wrong — it was the settle bug all along, which is why measuring
beats reasoning.

### 3. Overflow kickbacks named symptoms, never the cause

The most-used kickback in the tool ranked offenders by right edge. In a
grid or flex shell one rigid child stretches the track, so every
stretched ancestor and sibling reports a *larger* right edge than the
element at fault. Measured on the SPA at 375px: the culprit
`div.wide-table` (the only element with a fixed width) ranked **12th**,
outside both the probe window and the report slice. The three selectors
actually printed were `nav.side`, `main.main`, and the sidebar's
`<strong>` — an agent following that kickback would edit the sidebar.

Flat fixtures never caught this because in flow layout the culprit
usually *is* the widest box.

Fix: stop ranking, start measuring. For each candidate, neutralize its
own `width`/`min-width`, re-read `document.scrollWidth`, restore, and
record how much overflow disappeared (`relieves`). Causes are those
accounting for ≥10% of the overflow, sorted by contribution, and are
ordered ahead of symptoms before the report's top-N slice.

Before: `sticking out: nav.side (right edge 816px), main.main …`
After: `caused by: div.wide-table (760px wide; constraining it removes
269px of the overflow)`. Regression test M7b.

### 4. Copy inside open shadow roots read as missing

`innerText` and a document-scoped `TreeWalker` both stop at the shadow
boundary, so the web component's visible badge ("Reconciled nightly",
measured at 145×25px, `checkVisibility() === true`) was reported
`copy-missing`. Every design system built on custom elements keeps all
of its copy there, making this a first-day false positive.

Fix: enumerate open shadow roots and walk each. The raw-text collector
gained the same traversal so the reason-class boundary rule still works —
hidden shadow copy is now classified `zero-size` rather than falling into
the vaguer "missing" bucket. Closed roots remain unreachable by
construction. Regression test asserts both halves: visible shadow copy
satisfies the gate, `font-size: 0` shadow copy still does not.

### 5. Framework noise buried the real signal

On React, `unprobed-handler-types` listed ~80 event types, because a
delegation root registers the entire vocabulary up front. Fix: count only
types wired to specific elements. 80 noise types → 1 real one (`scroll`,
the app's authored handler).

Also added: a `delegated-handlers-opaque` warn for pages where pointer
handlers exist *only* at a delegation root, so a genuinely blind scan
says so instead of printing a clean bill of health. It correctly stays
quiet on both targets above (detection is not blind on either).

## Verified as documented

- **Client rendering, CSS-in-JS, delayed render**: integrity measured 64
  text blocks across three viewports — styles and DOM measured after they
  exist, as claimed.
- **Never-idle page**: errored at the 30s cap with exit 1, exactly as the
  doc states. No silent pass.
- **Webfont stability**: three consecutive runs produced identical
  metrics. Partial test only — the font 404s, so the swap never lands;
  a truly late-but-successful font is still untested.
- **Virtualized list**: rows outside the DOM window are correctly absent
  from visible text (the gate reports what a user can actually reach).
- **Canvas-only text**: correctly reported missing — it is genuinely not
  DOM text, and inaccessible to assistive tech too.
- **`check breakpoints --sweep`**: found the 900px boundary and reported
  155px of overflow at 901px. The gate that best handled the hard target.
- **Planted `font-size: 0` copy**: caught as `zero-size`.

## Method notes

- **Three of five defects were silent false passes** (CLEAN on an
  unmeasured page, 0 controls on a full app, `ok` with a pointer-only
  control present). Reading the docs cannot find these; only running the
  tool against inputs that resemble production can.
- **A wrong hypothesis got corrected by measurement.** "React delegation
  makes handler scanning impossible" was plausible, and I built a
  disclosure mechanism for it — then the settle fix made detection work,
  proving the diagnosis wrong. The disclosure stays as a narrower safety
  net, but the real bug was mundane.
- **Fixture realism is the whole experiment.** Every one of these five
  defects requires a construct the previous fixtures lacked: a grid
  shell, a shadow root, a post-load render tick, a redirect. The tool
  was not under-tested in count (481 tests pass) but in *kind*.
- **Two nested caps hid the same bug twice** — the culprit was outside
  both the 10-element probe window and the 10-element report slice.
  Silent top-N truncation deserves the same suspicion as a silent gate.
