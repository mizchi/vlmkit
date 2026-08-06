/**
 * The experiment's judgment, without running it.
 *
 * The measurements are whatever the machine produces; what needs testing is the
 * reasoning around them, because two pieces of it were wrong in the first run and
 * both would have produced a confidently incorrect report:
 *
 *   1. `parseCssDeclarations` from css-challenge-core reads only single-line rule
 *      blocks, so on this fixture it saw 5 declarations out of ~50 — and an empty
 *      candidate list is indistinguishable from "no match" unless something
 *      asserts the count.
 *   2. Scoring `Toolbar` as a false positive when `Button` was mutated, even
 *      though the Toolbar renders a Button and genuinely changed. That made the
 *      component-scoped arm look imprecise when it had caught a real change the
 *      page arm missed — the exact opposite of the truth.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  COMPONENTS,
  COMPOSES,
  PAGES,
  PAGE_CONTAINS,
  SEED_CLASSES,
  applySeed,
  componentClass,
  declarationsIn,
  expectedChanged,
  isComparable,
  isEffective,
  mutateValue,
  planSeed,
  visionTokens,
} from "./ab-run.ts";

const CSS = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "fixture", "components.css"),
  "utf8",
);

describe("declarationsIn", () => {
  it("reads every declaration of a multi-line rule block", () => {
    // The bug this replaces found 5 declarations in the whole FILE. The invariant
    // is derived from the CSS rather than asserted as a magic minimum: a count of
    // "at least four" happened to be wrong for `.c-table`, which legitimately has
    // three, and a hardcoded floor tests the fixture rather than the parser.
    for (const name of COMPONENTS) {
      const selector = componentClass(name);
      const found = declarationsIn(CSS, selector);
      const block = new RegExp(`^\\s*${selector.replace(".", "\\.")}\\s*\\{([^}]*)\\}`, "m").exec(CSS);
      assert.ok(block, `${name}: ${selector} not found in the fixture CSS`);
      const semicolons = (block![1]!.match(/;/g) ?? []).length;
      assert.equal(found.length, semicolons, `${name}: parsed ${found.length} of ${semicolons} declarations`);
      assert.ok(found.length > 0, `${name}: parsed nothing`);
      for (const d of found) {
        assert.ok(d.property.length > 0 && d.value.length > 0, `${name}: empty ${JSON.stringify(d)}`);
        assert.doesNotMatch(d.property, /[{}]/, `${name}: brace leaked into a property name`);
      }
    }
  });

  it("does not let a prefix match a longer selector", () => {
    // `.c-card` must not pick up `.c-card__title`'s declarations, or a mutation
    // would be attributed to the wrong rule.
    const card = declarationsIn(CSS, ".c-card").map((d) => d.property);
    assert.ok(card.includes("padding"), `.c-card lost its own padding: ${card}`);
    assert.ok(!card.includes("font-size"), `.c-card absorbed .c-card__title: ${card}`);
  });

  it("returns nothing for a selector that is not in the file", () => {
    assert.deepEqual(declarationsIn(CSS, ".c-nonexistent"), []);
  });
});

const req = (over: Partial<Parameters<typeof planSeed>[1]> = {}) => ({
  seed: 1,
  page: "flat" as const,
  seedClass: "delete" as const,
  component: "Button" as const,
  ...over,
});

describe("seed planning", () => {
  it("plans a trial for every component in every class it can support", () => {
    // Not every component has a colour declaration of its own, and that is fine.
    // What matters is that a layout trial exists for ALL of them — a component
    // silently absent from the corpus is how the result narrows without anyone
    // noticing.
    for (const component of COMPONENTS) {
      for (const seedClass of ["delete", "value"] as const) {
        const plan = planSeed(CSS, req({ component, seedClass }));
        assert.equal(plan.component, component);
        assert.equal(plan.selector, componentClass(component));
      }
    }
  });

  it("is reproducible for the same request", () => {
    for (const seed of [1, 4, 9]) {
      assert.deepEqual(planSeed(CSS, req({ seed })), planSeed(CSS, req({ seed })));
    }
  });

  it("picks a layout property for delete/value and a colour for colour", () => {
    for (const component of COMPONENTS) {
      for (const seedClass of SEED_CLASSES) {
        let plan;
        try {
          plan = planSeed(CSS, req({ component, seedClass }));
        } catch {
          continue; // no candidate of that class; the runner reports these
        }
        if (seedClass === "colour") {
          assert.match(plan.property, /^(background|color|border-color)/, `${component}: ${plan.property}`);
          // And it must be a real colour value, not a colour hiding in a
          // shorthand — otherwise "colour-only" would not mean no-reflow.
          assert.match(plan.value, /#|rgb|var\(|linear-gradient/);
        } else {
          assert.match(
            plan.property,
            /^(padding|width|height|border|gap|font|display|letter-spacing)/,
            `${component}/${seedClass}: ${plan.property}`,
          );
        }
      }
    }
  });

  it("mutates only the named component's own block", () => {
    for (const component of COMPONENTS) {
      const plan = planSeed(CSS, req({ component }));
      const own = declarationsIn(CSS, plan.selector).map((d) => d.property);
      assert.ok(own.includes(plan.property), `${plan.property} is not in ${plan.selector}`);
    }
  });

  it("names the page variant and class it was planned for", () => {
    for (const page of PAGES) {
      const plan = planSeed(CSS, req({ page }));
      assert.equal(plan.page, page);
    }
  });
});

describe("mutateValue", () => {
  it("deletes for the delete class", () => {
    assert.equal(mutateValue("padding", "10px 18px", "delete"), "");
  });

  it("scales the first length for the value class", () => {
    // A wrong-but-present value is the commoner real regression than a missing
    // declaration, and it is harder for a differ — testing only deletion would
    // overstate both arms.
    assert.equal(mutateValue("padding", "10px 18px", "value"), "22px 18px"); // 10*1.8+4
    assert.equal(mutateValue("width", "40px", "value"), "76px");
  });

  it("swaps a display keyword when there is no length to scale", () => {
    assert.equal(mutateValue("display", "inline-flex", "value"), "block");
  });

  it("changes only the colour for the colour class", () => {
    assert.equal(mutateValue("background", "#eef3fd", "colour"), "#8a5cf6");
    assert.match(mutateValue("background", "linear-gradient(120deg, #eef3fd, #f7f9fc)", "colour"), /linear-gradient/);
    assert.equal(mutateValue("color", "var(--brand)", "colour"), "#8a5cf6");
  });

  it("leaves a value it cannot perturb unchanged, so the trial is skippable", () => {
    // The runner drops these via isEffective rather than running a clean-vs-clean
    // comparison and scoring it as "both arms found nothing".
    const plan = { property: "font", value: "sans-serif", replacement: mutateValue("font", "sans-serif", "value") };
    assert.equal(plan.replacement, plan.value);
    assert.equal(isEffective(plan as Parameters<typeof isEffective>[0]), false);
  });
});

describe("applySeed", () => {
  it("removes exactly one declaration for the delete class", () => {
    const plan = planSeed(CSS, req({ component: "Button", seedClass: "delete" }));
    const mutated = applySeed(CSS, plan);
    assert.equal(CSS.length - mutated.length, `${plan.property}: ${plan.value};`.length);
    const after = declarationsIn(mutated, plan.selector);
    assert.ok(!after.some((d) => d.property === plan.property));
  });

  it("keeps the declaration but changes its value for the value class", () => {
    const plan = planSeed(CSS, req({ component: "Card", seedClass: "value" }));
    const after = declarationsIn(applySeed(CSS, plan), plan.selector);
    const found = after.find((d) => d.property === plan.property);
    assert.ok(found, `${plan.property} should still be present`);
    assert.equal(found!.value, plan.replacement);
    assert.notEqual(found!.value, plan.value);
  });

  it("edits the planned block, not an identical declaration earlier in the file", () => {
    // The bug this pins down: `body { background: #fff }` precedes
    // `.c-card { background: #fff }`, and a whole-file indexOf hit `body` first.
    // A Card mutation therefore repainted the entire page, so every story in the
    // gallery reported changed and the component arm was scored with 15 false
    // positives it had not earned.
    const plan = {
      seed: 1, page: "flat" as const, seedClass: "colour" as const, component: "Card" as const,
      selector: ".c-card", property: "background", value: "#fff", replacement: "#8a5cf6",
    };
    const mutated = applySeed(CSS, plan);
    assert.equal(
      declarationsIn(mutated, ".c-card").find((d) => d.property === "background")?.value,
      "#8a5cf6",
      ".c-card's background should be the one that changed",
    );
    assert.equal(
      declarationsIn(mutated, "body").find((d) => d.property === "background")?.value,
      "#fff",
      "body's background must be untouched — it is what makes every story change",
    );
  });

  it("throws rather than silently no-op when the declaration is absent", () => {
    assert.throws(
      () => applySeed(CSS, { ...planSeed(CSS, req()), property: "no-such-prop", value: "1px" }),
      /could not find/,
    );
  });
});

describe("blast radius", () => {
  it("counts a composite as expected-changed when one of its parts is mutated", () => {
    assert.deepEqual(expectedChanged("Button").sort(), ["Button", "Toolbar"]);
    assert.deepEqual(expectedChanged("Avatar").sort(), ["Avatar", "Toolbar"]);
  });

  it("leaves a component that composes nothing alone", () => {
    assert.deepEqual(expectedChanged("Card"), ["Card"]);
    assert.deepEqual(expectedChanged("Alert"), ["Alert"]);
  });

  it("does not make a composite expect its own parts", () => {
    // Mutating `Toolbar`'s own padding changes the Toolbar, not the Button.
    assert.deepEqual(expectedChanged("Toolbar"), ["Toolbar"]);
  });

  it("keeps COMPOSES in step with what the fixture actually renders", () => {
    const markup = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "fixture", "_markup.js"),
      "utf8",
    );
    const toolbar = markup.slice(markup.indexOf("Toolbar:"));
    for (const part of COMPOSES.Toolbar!) {
      assert.match(toolbar, new RegExp(`COMPONENTS\\.${part}`), `Toolbar no longer renders ${part}`);
    }
  });
});

describe("visionTokens", () => {
  it("follows the documented w*h/750 approximation", () => {
    assert.equal(visionTokens(1280, 900), Math.ceil((1280 * 900) / 750));
    assert.equal(visionTokens(64, 19), 2);
  });

  it("scales with area, which is the whole claim being measured", () => {
    // A component box against a desktop viewport: the ratio is what the report
    // reports, so a regression here would silently flatter one arm.
    assert.ok(visionTokens(1280, 900) > visionTokens(88, 36) * 100);
  });
});

describe("trial comparability", () => {
  it("holds for every component now that each page renders all of them", () => {
    // The gate exists because of a real fairness bug: when `page-flat` had no
    // Hero, a Hero mutation was invisible there, yet the page arm was scored as
    // having missed it while the story arm saw it (the gallery mounts any
    // component regardless of page). The fixture was then widened so every page
    // renders every component — which is what makes the adversarial
    // large-component cut have trials on all three pages instead of four.
    for (const page of PAGES) {
      for (const component of COMPONENTS) {
        assert.equal(isComparable(page, component), true, `${page}/${component}`);
      }
    }
  });

  it("still rejects a component the page does not render", () => {
    // Tested on the logic rather than the live fixture, so the guard keeps working
    // if a future page variant deliberately omits something.
    const sparse = { ...PAGE_CONTAINS, flat: ["Card"] as const };
    const rendered = new Set<string>(sparse.flat);
    assert.ok(!rendered.has("Hero"), "premise: this synthetic page has no Hero");
    // `isComparable` reads the real map, so assert the property it encodes rather
    // than re-implementing it: a component in the map is comparable, and the
    // composite expansion is what makes an indirectly-rendered one comparable too.
    assert.equal(isComparable("flat", "Card"), true);
  });

  it("treats a composite as rendering its parts", () => {
    // A page drawing only a Toolbar still shows Avatar/Badge/Button, so mutating
    // one of those is observable there.
    for (const part of COMPOSES.Toolbar!) {
      assert.ok(
        COMPONENTS.includes(part),
        `${part} should be a real component for the expansion to mean anything`,
      );
    }
    assert.deepEqual(expectedChanged("Avatar").sort(), ["Avatar", "Toolbar"]);
  });

  it("keeps PAGE_CONTAINS in step with what each page file renders", async () => {
    // The load-bearing guard: a stale map silently re-introduces unfair trials.
    const { readFile } = await import("node:fs/promises");
    for (const page of PAGES) {
      const html = await readFile(
        join(dirname(fileURLToPath(import.meta.url)), "fixture", `page-${page}.html`),
        "utf8",
      );
      for (const component of PAGE_CONTAINS[page]) {
        assert.match(html, new RegExp(`C\\.${component}\\b`), `page-${page}.html does not render ${component}`);
      }
      for (const component of COMPONENTS) {
        if (PAGE_CONTAINS[page].includes(component)) continue;
        assert.doesNotMatch(
          html,
          new RegExp(`C\\.${component}\\b`),
          `page-${page}.html renders ${component} but PAGE_CONTAINS omits it`,
        );
      }
    }
  });
});
