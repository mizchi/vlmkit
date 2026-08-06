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
  applySeed,
  componentClass,
  declarationsIn,
  expectedChanged,
  planSeed,
  visionTokens,
} from "./ab-run.ts";

const CSS = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "fixture", "components.css"),
  "utf8",
);

describe("declarationsIn", () => {
  it("reads every declaration of a multi-line rule block", () => {
    // The bug this replaces found 5 declarations in the whole file. Each of the
    // six component blocks has at least four.
    for (const name of COMPONENTS) {
      const found = declarationsIn(CSS, componentClass(name));
      assert.ok(found.length >= 4, `${name}: only ${found.length} declarations`);
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

describe("seed planning", () => {
  it("covers every component across seeds 1..6, one each", () => {
    // Deterministic by index rather than by RNG: `seededRandom`'s first draw put
    // seeds 1-6 all on `Avatar`, which would have left five components unmeasured
    // while looking like a six-seed run.
    const picked = [1, 2, 3, 4, 5, 6].map((seed) => planSeed(CSS, seed).component);
    assert.deepEqual([...picked].sort(), [...COMPONENTS].sort());
  });

  it("is reproducible for the same seed", () => {
    for (const seed of [1, 4, 9]) {
      assert.deepEqual(planSeed(CSS, seed), planSeed(CSS, seed));
    }
  });

  it("only ever picks a layout-affecting property", () => {
    // A colour-only mutation does not reflow, so the cascade the experiment is
    // about would not appear and the two arms would be compared on a regression
    // neither one is interesting for.
    for (let seed = 1; seed <= 24; seed++) {
      const plan = planSeed(CSS, seed);
      assert.match(
        plan.property,
        /^(padding|width|height|border|gap|font|display|letter-spacing)/,
        `seed ${seed} picked ${plan.property}`,
      );
    }
  });

  it("mutates only the named component's own block", () => {
    for (let seed = 1; seed <= 12; seed++) {
      const plan = planSeed(CSS, seed);
      assert.equal(plan.selector, componentClass(plan.component));
      const own = declarationsIn(CSS, plan.selector).map((d) => d.property);
      assert.ok(own.includes(plan.property), `${plan.property} is not in ${plan.selector}`);
    }
  });
});

describe("applySeed", () => {
  it("removes exactly one declaration and nothing else", () => {
    const plan = planSeed(CSS, 1);
    const mutated = applySeed(CSS, plan);
    assert.equal(CSS.length - mutated.length, `${plan.property}: ${plan.value};`.length);
    const before = declarationsIn(CSS, plan.selector);
    const after = declarationsIn(mutated, plan.selector);
    assert.equal(after.length, before.length - 1);
    assert.ok(!after.some((d) => d.property === plan.property));
  });

  it("throws rather than silently no-op when the declaration is absent", () => {
    // A silent no-op would produce a "clean vs clean" comparison reported as a
    // successful trial with zero diff — the worst possible failure for a bench.
    assert.throws(
      () => applySeed(CSS, { ...planSeed(CSS, 1), property: "no-such-prop", value: "1px" }),
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
