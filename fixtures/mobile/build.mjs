/**
 * fixtures/mobile: one phone page done right (`intact.html`) and one mutant per defect
 * `vlmkit check mobile` names (issue #219). Each mutant is the intact page with one change.
 *
 *   node fixtures/mobile/build.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = import.meta.dirname;
const intact = readFileSync(join(dir, "intact.html"), "utf8");
const mutants = {
  // WCAG 1.4.4: the reader cannot pinch to enlarge.
  "zoom-disabled": [
    'content="width=device-width, initial-scale=1, viewport-fit=cover"',
    'content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"',
  ],
  // A carousel of full-width slides with no scroll-snap: a swipe stops between two slides.
  "carousel-unsnapped": ["scroll-snap-type: x mandatory;", ""],
  // The composer is fixed to the bottom and nothing moves it when the keyboard opens.
  "keyboard-covered": ['<script src="keyboard.js"></script>', ""],
  // The header ignores the notch: viewport-fit=cover with no env(safe-area-inset-top).
  "notch-overlap": ["padding-top: calc(12px + env(safe-area-inset-top));", "padding-top: 12px;"],
};
for (const [name, [from, to]] of Object.entries(mutants)) {
  if (!intact.includes(from)) throw new Error(`${name}: ${JSON.stringify(from)} not in intact.html`);
  writeFileSync(
    join(dir, `${name}.html`),
    intact.replace(from, to).replace("<title>Mobile — intact</title>", `<title>Mobile — ${name}</title>`),
  );
}
console.log(`wrote ${Object.keys(mutants).length} mutants`);
