// Run with a separate veriss checkout. This probe never launches a browser.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const checkout = process.argv[2];
if (!checkout) {
  throw new Error("Usage: node fixtures/responsive-patterns/check-veriss.mjs /path/to/veriss");
}
const { analyzeHTML } = await import(pathToFileURL(resolve(checkout, "packages/veriss/src/html.mjs")).href);

function readFixture(file) {
  return readFileSync(new URL(file, import.meta.url), "utf8");
}

const { mutants } = JSON.parse(readFixture("mutations.json"));
const options = {
  viewport: { min: 320, max: 1440, height: { min: 360, max: 1000 } },
  integrity: { protrusion: "painted" },
  scrollbars: [{ name: "overlay", inlineSize: 0, blockSize: 0 }],
  shorthandConflicts: "warning",
};

function scan(file) {
  const source = readFixture(file);
  // These fixtures have inline sheets without a media/type attribute. Keep the
  // CSS cascade order and retain the HTML body, title and meta elements.
  assert.doesNotMatch(source, /<(?:link|script)\b/i, file);
  const sheets = [];
  const html = source.replace(/<style(?:\s+data-mutation="[^"]*")?\s*>([\s\S]*?)<\/style>/gi, (_, css) => {
    sheets.push(css);
    return "";
  });
  assert.ok(sheets.length > 0, file);
  assert.doesNotMatch(html, /<style\b/i, file);
  const result = analyzeHTML(html, { ...options, css: sheets.join("\n") });
  return {
    file,
    status: result.status,
    sizedRegions: result.sizes.length,
    diagnostics: result.diagnostics,
    integrityWarnings: result.integrity?.warnings ?? [],
  };
}

const corpus = mutants.flatMap(({ id, pattern }) => [scan(`patterns/${pattern}.html`), scan(`mutants/${id}.html`)]);

// Keep only the sizing and breakpoints from the pricing pair. The content-free
// cells remove the need for font contracts without affecting these fixed tracks.
const html =
  '<html lang="en"><body><main><div class="plans"><div></div><div></div><div></div></div></main></body></html>';
const css = `
  * { box-sizing: border-box; margin: 0 }
  html { font-size: 16px }
  main { max-width: 1120px; margin: auto; padding: 32px 16px }
  .plans { display: grid; grid-template-columns: repeat(3, 20rem); justify-content: center; gap: 24px }
  .plans > div { height: 40px }
  @media (max-width: 1099px) { .plans { grid-template-columns: repeat(2, minmax(0, 1fr)) } }
  @media (max-width: 767px) { .plans { grid-template-columns: minmax(0, 1fr) } }
`;
const {
  replace: [before, after],
  expect: pricingExpectation,
} = mutants.find(({ id }) => id === "pricing--orphan-width");
assert.ok(css.includes(before));
const intact = analyzeHTML(html, { ...options, css });
const broken = analyzeHTML(html, { ...options, css: css.replace(before, after) });
const finding = broken.diagnostics.find(({ code, box }) => code === "E_LAYOUT_TRACKS" && box === ".plans");
assert.equal(intact.status, "verified");
assert.equal(broken.status, "violated");
assert.ok(finding);
assert.deepEqual(
  [finding.range.minExact, finding.range.minInclusive, finding.range.maxExact, finding.range.maxInclusive],
  [String(pricingExpectation.lo - 1), false, String(pricingExpectation.hi + 1), false],
);

console.log(
  JSON.stringify(
    {
      viewport: options.viewport,
      corpus,
      reducedPricing: { intact: intact.status, mutant: broken.status, finding },
    },
    null,
    2,
  ),
);
