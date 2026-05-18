# Design-md scenario v2: do the fixes work? (validation, 2026-05-15)

## Question

After landing #22 / #23 / #24 / #25 / #26 / #27 against the v1 scenario,
does an agent given the **same brief + same DESIGN.md + same goal
screenshots** converge faster or further than agent-a (10.3% mobile
floor) and agent-b (2.8% mobile floor)?

## Method

Spawned a single subagent (`agent-c`) with the same prompt shape as the
v1 run, but with one additional instruction: pass `--tokens
fixtures/.../DESIGN.md` to `vrt compare` so the new wireframe fix
suggestions / palette token reverse-lookup signals fire. Budget: 5
rounds. Agent did NOT read agent-a or agent-b logs.

## Result

Final convergence (lower is better):

| viewport | agent-a (v1) | agent-b (v1) | agent-c (v2) |
|---|---|---|---|
| wide    | 1.8%  | **0.5%** | 2.9% |
| desktop | 2.0%  | **0.6%** | 3.3% |
| mobile  | 10.3% | **2.8%** | **9.7%** |

Tool calls: agent-a 60, agent-b 146 (with self-written probes), agent-c 45.

**The floor moved on mobile (10.3% → 9.7%) but desktop/wide regressed
relative to agent-a.** Agent-c did NOT beat agent-b — but agent-b spent
2.4× the tool calls writing their own Playwright probes to compensate
for vrt gaps that #25 since closed, so that comparison is unfair.

The honest read: agent-c hit a different wall than agent-a/b.

## What worked

Quoting agent-c verbatim:

- **Token-snap hints** — "correctly identified the magnitude of
  misalignment" via `token: md (24px)` / `token: sm (12px)`. (#23 working.)
- **Per-component Δtop rows** — "rank=4 avatar +60px on mobile in R1
  was an obvious 'your mobile profile card is way too low' signal that
  survived the badge restructure." (#25 working.)
- **Triptych composite** — "*Very* useful. Diagnosing the round-1
  mobile badge-wrap bug took one glance." (#24 working.)
- **Bare-path file mode** — "Worked cleanly; no `--url file://`
  needed." (#22 working.)
- **`shift +Npx → X%` hint** — agent-c found the existing shift-detection
  output very useful as an upper-bound estimator.
- **Render sanity warning** — "warned about Google Fonts 404 but
  baseline and variant both fall back to the same system font, so diff
  numbers stayed comparable as advertised — good." (#27 working.)

## Where agent-c got stuck

Two concrete gaps surfaced that weren't visible in v1:

### G1 — Per-viewport sign disambiguation

> "In round 3 the same `md (24px)` hint fired for both viewports
> while one needed +24 and the other −24 — the token snap can't
> express that."

The wireframe fix generator buckets by `(sign, rounded-magnitude)`, so
+24 and −24 ARE different buckets internally. But when a single
*selector* needs +24 on mobile and the same change would break
desktop, the suggestion presents both buckets as independent fixes
and doesn't surface that they belong to the same underlying
responsive divergence. Agent-c tried to satisfy both buckets with a
global edit and made desktop worse.

The data needed is already in `domPositionDiffPerViewport` —
specifically the `byPathProperty` cross-viewport view. The wireframe
generator needs to join its buckets against that to flag
"this delta is mobile-only, gate it with `@media (max-width: 640px)`".

### G2 — Suggestions name a magnitude but not a selector

> "`Wireframe fix suggestions` lists targets but never points at
> *which CSS rule* to change — guessing whether the `+25px` lives in
> `hero margin-bottom`, `body margin-bottom`, or `cta margin-top`
> cost two rounds."

Image-only signals can't always disambiguate the upstream selector,
but two adjacent layers already have the answer:

- The DOM-position diff's `path` field names the affected element
  (e.g. `main[0]>section[1]>article[0]>div[0]`).
- The computed-style diff's `entries` already name `(selector,
  property, before, after)`.

The wireframe generator should consult these and suggest the most-
likely affected selector(s) when they exist, even in wireframe mode.

## Cross-fix interaction note

A few signals from #22 / #25 / #27 produced their own minor friction
that wasn't visible until the loop got tighter:

- The DOM-equivalence warning fired on agent-c's structurally-different
  mobile-vs-desktop badge layout (element count 31 → 33). Agent-c noted
  this is benign for responsive design where the same content appears
  in different DOM nodes per breakpoint; the warning should
  distinguish "structurally different" from "structurally different
  by amount X visible only on viewport Y".

## Follow-up issues

- G1: Per-viewport sign disambiguation in wireframe fix suggestions
- G2: Pair wireframe suggestions with a CSS-selector candidate from
  the DOM-position / computed-style diff layers
- (minor) DOM-equivalence warning should consider responsive
  structural variation benign

## Bottom line

The fixes are real wins on the signal-quality axis — agent-c used the
new outputs verbatim ("token: md (24px)", triptych, shift-percentage
upper bound) — but the v1 scenario's hardest task (mobile under 5%)
still isn't closed because of G1. The next round of work on this
scenario should target G1 specifically: that's the single biggest
remaining "I can't act on this" gap for an agent running a closed
loop against a designed page.
