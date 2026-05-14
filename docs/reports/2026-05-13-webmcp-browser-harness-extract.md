# Reference extract: browser-use/browser-harness + WebMCP

**Date**: 2026-05-13
**Sources**:
- https://github.com/browser-use/browser-harness
- https://developer.chrome.com/blog/webmcp-mcp-usage?hl=ja

A short extract of concepts from two adjacent projects, evaluated
against vrt's existing architecture. Goal: identify ideas worth
adopting without doing the work upfront.

## browser-use / browser-harness

**Premise**: a CDP-direct Python harness that lets LLMs drive Chrome.
No Playwright in between — just one WebSocket to Chrome. Three-layer
architecture:

| Layer | Mutable by | Purpose |
|---|---|---|
| `src/browser_harness/` (core) | maintainers | Protocol plumbing, primitives. Protected. |
| `agent_helpers.py` (helpers) | the agent itself | Convenience wrappers the agent generates on-demand during a run. |
| `domain-skills/` (per-site) | the agent over time | Per-site playbooks — selectors, flows, edge cases that survive across runs. |

**Self-healing**: "the agent writes what's missing during execution"
— the harness improves itself every run by accumulating helpers and
skills. Selectors that broke once get replaced; recurring flows get
captured as reusable skill files.

## WebMCP (Chrome proposed standard)

**Premise**: a browser-native way for pages to expose tools to AI
agents. Treats agents as guests on the page rather than rendering
into a separate UI.

| Aspect | Detail |
|---|---|
| Discovery | Pages declare machine-readable tools (actions an agent can invoke). The article promises "two APIs in JavaScript or HTML attributes" but the linked post doesn't show concrete code. |
| Intent | Tools carry explicit semantic descriptions — moves beyond UI-element inference. |
| Scope | Frontend-only, bound to active tabs. Differs from MCP (cross-platform, backend). |
| Relationship to MCP | Complementary — MCP runs core logic, WebMCP provides contextual browser interactions. |

The post is conceptual; no API surface details to copy.

## Ideas worth borrowing for vrt

Ranked by ROI against the existing toolkit.

### 1 — WebMCP-style action discovery for `vrt interact` ★★★

Current pain point: `vrt interact` requires hand-writing a
`sequence.json` per page. The author of the page knows the
interaction surface; the test author has to re-derive it.

Borrow-able pattern: let pages opt-in by declaring what's testable:

```html
<button data-vrt-action="open-menu" data-vrt-snapshot="menu-open">
  Menu
</button>
```

or richer, via a JS hook (forward-compat with WebMCP):

```html
<script>
  window.__vrtActions = [
    { name: "open-menu",  run: () => document.querySelector(".trigger").click() },
    { name: "submit",     run: async () => { await fillForm(); document.querySelector("form").submit(); } },
  ];
</script>
```

Tool: `vrt explore <html|url>` auto-discovers the declared actions,
invokes each, captures a named snapshot, diffs consecutive snapshots.
**Strictly additive** to `vrt interact` — `sequence.json` keeps
working for pages that don't declare anything.

When WebMCP spec stabilizes, swap the discovery layer to use that
instead of the bespoke attribute.

### 2 — Skill playbooks (`.vrt-skills/`) ★★

`vrt component-consistency` / `multi-page-consistency` / `interact`
all consume CLI args. Repeat usage means repeating the same args.
A `.vrt-skills/` directory per project, with files like:

```yaml
# .vrt-skills/pricing-card.yaml
name: pricing-card
selectors:
  root: ".pricing-card"
  cta:  ".pricing-card .btn-primary"
  badge: ".pricing-card .badge"
states: [hover, focus-visible]
checks: [a11y-contrast, a11y-touch, theme-parity]
```

Then `vrt run pricing-card` invokes the relevant CLIs against the
declared selectors / states / checks. Same idea as browser-harness's
domain-skills layer — domain knowledge captured as data, accumulated
over time.

### 3 — Self-healing for `interact` selector misses ★★

When `vrt interact` encounters a step whose `selector` doesn't
match, today it logs a yellow warning and continues. Borrow
self-healing: on miss, run a fuzzy match against the page's
interactive elements (closest text, closest tag, closest class
substring) and propose a fix in the report:

```
⚠ click `.nav-toggle` failed — no match.
  Best guesses (by text similarity): `button.navigation-toggle`,
  `[aria-label="Open menu"]`. Re-run with one of these and the
  step should land.
```

For agentic use, the tool could optionally apply the most-likely
fix and continue, recording the rewrite for human review.

### 4 — Agent-editable helpers layer ★

browser-harness reserves a directory (`agent_helpers.py`) where the
agent is expected to write code during a run. Adapt for vrt: a
`.vrt-agent/` directory where convenience wrappers, custom assertions,
and recurring fixture configs can be checked in.

This is just a convention — not new infrastructure. Worth doing only
when the per-project boilerplate becomes noticeable.

### 5 — CDP direct (skip Playwright) ★

browser-harness uses a single WebSocket to Chrome. vrt depends on
Playwright. Switching to CDP-direct would shrink the runtime (no
firefox/webkit binaries needed in chromium-only mode) but cost the
Playwright API surface (locators, fixtures, fixtures-style retry).

ROI is low — Playwright is paid for and works. Defer indefinitely.

## Non-borrowables

- **WebMCP-as-spec** isn't shipped yet. Building on it today means
  building on a moving target. The `data-vrt-action` attribute
  scheme above is "shaped like WebMCP" without committing to a
  spec that may change.
- **browser-harness's Python core** isn't directly useful — vrt is
  TypeScript on Node. The architectural patterns transfer; the code
  doesn't.

## Concrete next-step recommendation

Implement `vrt explore` per idea #1 — single new CLI, ~150 LoC.
Behavior:

1. Render the HTML/URL in Playwright.
2. Look for `window.__vrtActions` array OR `data-vrt-action`
   attribute markers.
3. For each declared action: take a baseline snapshot, invoke the
   action, take a named snapshot, pixel-diff against the previous
   snapshot.
4. Output a markdown report indexed by action name.

This buys most of WebMCP's discoverability story without depending on
the unfinished spec, and slots in next to `vrt interact` (which
remains the imperative-sequence option for cases the page doesn't
opt-in to declaration).

Ideas 2 + 3 are good follow-ups once `vrt explore` ships and we see
how page authors / agents actually declare actions in practice.
