/**
 * Re-shoots `demo-solitaire.png`, the still the intro page's playable-demo section shows.
 *
 *   node examples/vlmkit-intro-page/capture-demo-still.mjs
 *   node examples/vlmkit-intro-page/capture-demo-still.mjs --seed 4 --plies 80
 *
 * A hand-taken screenshot of a card game is not reproducible: the deal is shuffled and the
 * position depends on which moves the photographer happened to make. This drives the same
 * `solve.mjs` search the playthrough harness uses, replays the first `--plies` moves of the
 * winning line through the page's own `commit`, and shoots the result — so the image is a
 * function of (seed, plies) and a solitaire restyle can be re-shot to the identical position.
 *
 * `animate=0` because the deal is a ~960ms staggered flight and the flips tween: without it the
 * shot catches whatever frame it happened to land on, which is the same reason the deploy gates
 * pass it. Mid-game rather than the deal, because a fresh deal is seven face-down piles and says
 * nothing about the game being played.
 *
 * The output is 1024x660, not the 1024x768 of the `proof-*.png` files: solitaire's own layout
 * ends above the fold and the extra 108px was empty table felt. The `width`/`height` on the
 * `<img>` in `index.html` are those numbers — update both together or the reserved box stops
 * matching the image and the section shifts as it loads.
 */
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { chromium } from "playwright";
import { solve } from "../solitaire/solve.mjs";

const here = dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const flag = (name, fallback) => {
    const index = argv.indexOf(name);
    return index >= 0 && argv[index + 1] !== undefined ? argv[index + 1] : fallback;
  };
  return {
    seed: Number(flag("--seed", 1)),
    plies: Number(flag("--plies", 60)),
    width: Number(flag("--width", 1024)),
    height: Number(flag("--height", 660)),
    out: String(flag("--out", join(here, "demo-solitaire.png"))),
  };
}

const options = parseArgs(process.argv.slice(2));
const pageUrl = `file://${resolve(here, "../solitaire/index.html")}?seed=${options.seed}&draw=1&animate=0`;

const search = solve(options.seed, { draw: 1 });
if (!search.solved) {
  console.error(`seed ${options.seed} did not solve (${search.reason}, ${search.nodes} nodes).`);
  process.exit(1);
}
if (options.plies > search.line.length) {
  console.error(`seed ${options.seed} wins in ${search.line.length} plies; --plies ${options.plies} is past the end.`);
  process.exit(1);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: options.width, height: options.height } });
await page.goto(pageUrl, { waitUntil: "load" });
await page.waitForFunction(() => globalThis.solitaire && !globalThis.solitaire.dealing);

for (const step of search.line.slice(0, options.plies)) {
  // No draw on the debug surface on purpose — clicking the stock is the real handler.
  if (step.draw) await page.click("#stock");
  else await page.evaluate(([from, to]) => globalThis.solitaire.commit(from, to), [step.from, step.to]);
}

const placed = await page.evaluate(() =>
  globalThis.solitaire.state.foundations.reduce((total, pile) => total + pile.length, 0),
);
await page.screenshot({ path: options.out });
await browser.close();

console.log(
  `seed ${options.seed}: ${options.plies}/${search.line.length} plies replayed, ` +
    `${placed}/52 on the foundations → ${options.out} (${options.width}x${options.height})`,
);
