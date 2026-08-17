/**
 * The composed registry: every built-in plugin, loaded together.
 *
 * Each plugin has its own declaration test, but composition is where the
 * failures that matter live — two plugins claiming one command, an id that
 * does not match its command path, a three-token gate the resolver cannot
 * reach. None of that is visible from inside a single plugin, and all of it
 * used to be discoverable only by running the CLI.
 */
import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { loadGateRegistry, resetGateRegistryCache } from "./gate-registry.ts";

/**
 * `builtinsOnly` so a `vlmkit.config.json` in the repo root (or in whatever
 * cwd the suite runs from) cannot add gates and change these counts.
 */
async function registry() {
  resetGateRegistryCache();
  return loadGateRegistry({ builtinsOnly: true });
}

describe("composed built-in registry", () => {
  it("loads all three built-in plugins", async () => {
    const r = await registry();
    assert.deepEqual(
      r.plugins.map((p) => p.name).sort(),
      ["@mizchi/vlmkit-capture", "@mizchi/vlmkit-markup", "vlmkit-app"],
    );
  });

  it("registers every gate without an id or command conflict", async () => {
    // createGateRegistry throws on a conflict, so reaching this line is the
    // assertion; the count guards against a plugin silently dropping out.
    const r = await registry();
    assert.equal(r.list().length, 27);
  });

  it("keeps each gate id in step with its command path", async () => {
    for (const { gate } of (await registry()).list()) {
      assert.equal(gate.id, gate.command.join("."), `${gate.id} vs ${gate.command.join(" ")}`);
    }
  });

  it("resolves three-token gates by longest prefix", async () => {
    const r = await registry();
    for (const command of ["check a11y contrast", "check a11y touch", "check a11y focus", "check drift component", "check drift pages"]) {
      const tokens = command.split(" ");
      const resolved = r.resolve([...tokens, "page.html", "--json"]);
      assert.equal(resolved?.gate.command.join(" "), command, `${command} did not resolve`);
      assert.deepEqual(resolved?.rest, ["page.html", "--json"]);
    }
  });

  it("does not resolve a two-token prefix of a three-token gate", async () => {
    // `vlmkit check a11y` is not a command; it has to fall through to the
    // did-you-mean path rather than silently running one of the three.
    const r = await registry();
    assert.equal(r.resolve(["check", "a11y"]), undefined);
    assert.equal(r.resolve(["check", "drift"]), undefined);
  });

  it("suggests the real commands for a bare group prefix", async () => {
    const r = await registry();
    assert.ok((await registry()).suggest(["check", "a11y", "contrst"]).includes("check a11y contrast"));
    assert.deepEqual(r.suggest(["check", "integrit"]), ["check integrity"]);
  });

  it("groups gates under every verb the CLI must register", async () => {
    const r = await registry();
    assert.deepEqual([...r.groups().keys()].sort(), ["check", "scan", "stress", "verify"]);
  });

  it("gives every gate a non-empty rule table with unique ids", async () => {
    for (const { gate } of (await registry()).list()) {
      assert.ok(gate.rules.length > 0, `${gate.id} has no rules`);
      const ids = gate.rules.map((rule) => rule.id);
      assert.equal(new Set(ids).size, ids.length, `${gate.id} has duplicate rule ids`);
    }
  });

  it("declares 165 tunable rules in total", async () => {
    // A canary, not a target: a gate losing its rule table to a bad merge is
    // otherwise invisible until someone tries to tune it.
    // 119 → 120 when `check copy` gained `copy-truncated` (element-rect mode, vlmkit#118).
    // 120 → 121 when `check motion` gained `unreadable-stylesheet`, so that "no
    // prefers-reduced-motion rule" stops being asserted over CSS it could not read.
    // 121 → 122 when `check drift component` split `instance-content-differs` out of
    // `instance-drift`, so different copy stops reading as drift.
    // 122 → 123 when `check integrity` gained `stale-har-fixture`, so a request absent
    // from a `--har` recording stops reading as a broken resource on the page.
    // 123 → 124 when `scan handlers` gained a rule for a page with controls and no
    // handlers, and 124 → 125 when `check design` gained `nothing-judged`, so an
    // unjudged role stops reading as coherent.
    // 125 → 126 when `check drift pages` gained `selector-missing`: a route the
    // selector is absent from has `diffRatio: NaN`, `NaN > threshold` is false, and
    // the most severe drift there is was the one case the gate passed.
    // 126 → 127 when `check layout` gained `invalid-selector`: `querySelectorAll` throws
    // only on invalid CSS, that throw was swallowed, and "matched nothing" satisfies
    // `visible: false` — so a typo in the contract reported SATISFIED.
    // 127 → 137 in one step, and the +10 is two different things:
    //   +3  `scan handlers` gained the HTML5 drag-and-drop rules —
    //       `drag-source-not-draggable` and `drop-without-dragover` are handlers that
    //       cannot fire (no `draggable`, no `dragover` to preventDefault on), and
    //       `drag-without-keyboard-alternative` is the a11y half, since drag has no
    //       keyboard equivalent in any browser.
    //   +7  `check interactions` now DECLARES the handler-surface rules it has been
    //       emitting all along under `--handlers`. It pushed `deriveHandlerIssues`'
    //       kinds as findings while declaring none of them, so every such run printed
    //       "check.interactions emitted undeclared rule id(s): unprobed-handler-types"
    //       and `--rule pointer-only-control=off` had nothing to bind to on that gate.
    //       Both gates spread one `HANDLER_SURFACE_RULES` now, so a rule added to the
    //       deriver reaches both consumers or neither.
    // 137 → 141: the two probe-only drag rules, counted on both gates that spread
    //       HANDLER_SURFACE_RULES. `dragover-not-prevented` is the one the static check
    //       cannot reach — a dragover handler exists, it just never cancels, so the browser
    //       rejects the drop anyway — and `dragstart-transfers-nothing` needs the drag to
    //       have actually run. Both come from dispatching, so they only appear with
    //       `--probe-drag` or `check interactions --handlers`.
    // 141 → 143: `pointer-drag-intercepted`, on both gates that spread
    //       HANDLER_SURFACE_RULES. The only *graded* outcome of the pointer-drag gesture —
    //       registered handlers that a delivered gesture never invoked has one explanation
    //       (something is intercepting), while 0% pixels has several, so the pixel numbers
    //       beside it are reported and not graded.
    // 143 → 145: `drag-source-inert`, on both gates that spread HANDLER_SURFACE_RULES. The
    //       graded outcome of driving a REAL HTML5 drag rather than dispatching one: the
    //       browser started no drag on an element whose `draggable` is true and whose
    //       `dragstart` handler is registered. `-webkit-user-drag: none` and an overlay both
    //       do that, neither is visible in the DOM, and dispatching a `dragstart` runs the
    //       handler regardless — so the synthetic probe called both of them working.
    // 145 → 147: `drop-target-unreachable`, the drop-target half of `drag-source-inert`. A zone
    //       with a correct contract — dragover calling preventDefault, a wired drop — under a
    //       transparent sibling received no drag event at all, and the run reported nothing:
    //       the static check sees both handlers and the synthetic dispatch runs them directly at
    //       the element. Only a real gesture can miss it, and the finding names what took the
    //       events instead.
    // 147 → 149: `drag-cancel-not-reverted`. The probe presses Escape mid-drag; the browser
    //       reports the cancel (dragend, dropEffect "none", no drop) and the source's own box
    //       still differs from before. That is the optimistic update every sortable makes —
    //       hide the item on dragstart — with the undo wired to `drop` instead of `dragend`,
    //       so Escape strands it. Measured: 0.00% for a source that restores, 99.03% for one
    //       that does not.
    // 149 → 153: the two mid-flight rules, on both gates. `drag-source-detached-mid-drag` is a
    //       source that removed itself during the drag, so `dragend` never ran on it and every
    //       cleanup wired there was skipped — while the drop still landed, so the drag looked
    //       fine. `dragover-handler-slow` reads the interval between consecutive dragovers on one
    //       target, which is the handler's own cost plus a frame: 1.3-1.7ms for a handler that
    //       returns immediately, 82.1-82.2ms for one that busy-waits 80ms.
    // 153 → 155: `passive-listener-cannot-cancel`, on both gates. A handler that calls
    //       preventDefault() where the call does nothing — the listener was registered
    //       `{ passive: true }`, or the event is not cancelable at all. Measured per element from
    //       the listener patch: the same wheel handler records the call as ineffective under
    //       `{ passive: true }` and effective under `{ passive: false }` and with no option given.
    // 155 → 157: `hover-only-reveal` (WCAG 1.4.13 / 2.1.1), on both gates. Hovering the trigger
    //       made something visible and focusing the same trigger made nothing visible. Its triggers
    //       come from the stylesheets as well as the listeners, because the common form is a CSS
    //       `:hover` rule with no listener anywhere — and for the same reason the finding is emitted
    //       from the probe rows rather than the per-element loop.
    // 157 → 163: three rules, on both gates. `contextmenu-not-prevented` — a real right-click ran
    //       the handler and nothing cancelled, so the browser's own menu opens too.
    //       `contextmenu-replaces-nothing` (warn) — cancelled and nothing became visible, leaving
    //       the user with neither menu; warn because the replacement may be drawn where this cannot
    //       see it. `touch-handlers-not-invoked` — the touch twin of `pointer-drag-intercepted`,
    //       driven in a page of its own because touch emulation changes `maxTouchPoints` and
    //       `"ontouchstart" in window`, which a page branches on.
    // 163 → 165: `text-input-rejects-non-ascii` (warn), on both gates. Every visible text field is
    //       typed into three times — an ASCII sample, the same in Japanese, and the Japanese one
    //       through an IME composition — and a field that keeps the ASCII and loses the Japanese is
    //       reported. The ASCII drive is the control that makes it attributable: a digits-only field
    //       loses both and says nothing about the script.
    const total = (await registry()).list().reduce((n, { gate }) => n + gate.rules.length, 0);
    assert.equal(total, 165);
  });

  it("tracks which gates render their own rule settings, and which still cannot", async () => {
    // `format(report, rules)` is how a gate's prose learns that a rule was turned off or
    // re-tuned. A formatter that declares one parameter never receives the view, and the runner
    // prints a disclaimer for it — `gate.format.length` is the whole mechanism, which is why
    // this can be checked here without running anything.
    //
    // Both lists are asserted on purpose. The aware count alone would go up silently when a
    // gate is migrated; naming the blind ones makes the remaining work visible, and makes a
    // migration that forgets to update this list fail rather than pass quietly.
    const rows = (await registry()).list().map(({ gate }) => ({ id: gate.id, aware: gate.format.length >= 2 }));
    const aware = rows.filter((r) => r.aware).map((r) => r.id).sort();
    const blind = rows.filter((r) => !r.aware).map((r) => r.id).sort();
    // Every gate, as of the migration that finished the set. The list stays asserted rather
    // than reduced to `blind.length === 0`: a gate added tomorrow with a one-parameter
    // formatter should fail here and be named, not silently restart the backlog.
    assert.deepEqual(aware, [
      "check.a11y.contrast",
      "check.a11y.focus",
      "check.a11y.touch",
      "check.animation",
      "check.asset",
      "check.breakpoints",
      "check.copy",
      "check.crater",
      "check.design",
      "check.drift.component",
      "check.drift.pages",
      "check.equivalence",
      "check.integrity",
      "check.interactions",
      "check.layout",
      "check.motion",
      "check.perf",
      "check.scroll",
      "check.story",
      "check.theme",
      "check.tokens",
      "scan.handlers",
      "scan.scroll",
      "stress.i18n",
      "stress.media",
      "verify.flow",
      "verify.markup",
    ]);
    assert.deepEqual(blind, []);
  });

  it("gives every built-in gate a category", async () => {
    // `category` is optional in the contract — a project's first house gate
    // must not have to pick a taxonomy before it can run. Built-ins have no
    // such excuse: `vlmkit rules` groups by category, so an uncategorized
    // built-in lands under "other", which tells a reader deciding what to run
    // nothing at all.
    const uncategorized = (await registry()).list()
      .filter(({ gate }) => gate.category === undefined)
      .map(({ gate }) => gate.id);
    assert.deepEqual(uncategorized, []);
  });

  it("groups by category in adoption order, not registration order", async () => {
    const r = await registry();
    assert.deepEqual(
      [...r.categories().keys()],
      ["correctness", "behavior", "design-system", "verdict", "infrastructure"],
    );
    // No "other" bucket, since every built-in is categorized — and the buckets
    // partition the catalog rather than sampling it.
    const grouped = [...r.categories().values()].reduce((n, entries) => n + entries.length, 0);
    assert.equal(grouped, r.list().length);
  });

  it("spans plugins within a category and categories within a plugin", async () => {
    // The point of keeping the two axes separate. If either direction were
    // one-to-one, category could have been derived from the plugin instead.
    const r = await registry();
    const infrastructure = r.categories().get("infrastructure") ?? [];
    assert.deepEqual(
      infrastructure.map((entry) => entry.plugin).sort(),
      ["@mizchi/vlmkit-capture", "vlmkit-app"],
      "expected `infrastructure` to span two plugins",
    );
    const markupCategories = new Set(
      r.list().filter((e) => e.plugin === "@mizchi/vlmkit-markup").map((e) => e.gate.category),
    );
    assert.ok(markupCategories.size > 1, "expected one plugin to span several categories");
  });
});
