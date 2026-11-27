// Writes one mutant per rule: the intact page plus a single injected style block.
// node fixtures/css-check/build.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = import.meta.dirname;
const intact = readFileSync(join(dir, "intact.html"), "utf8");
const mutants = {
  // calc() needs spaces around -, a hex colour has 3/4/6/8 digits, a length needs a unit, and a misspelt property.
  "dropped-declaration": `.button { width: calc(100%-10px); color: #12345; } .card h2 { margin-top: 4; } .note { colr: #374151; }`,
  "unknown-media-feature": `@media (prefers-reduce-motion: reduce) { .button { transition: none; } }`,
  "never-matching-media": `@media (min-width: 900px) and (max-width: 600px) { .card { grid-template-columns: 1fr; } }`,
  "vendor-declaration-dropped": `.button { -moz-osx-font-smoothing: grayscale; }`,
  // Parsed and applied, and nothing changes: an offset on a static box, a flex item property under a grid, a background
  // size with no image, a flex container property on a block.
  "inert-declaration": `.note { top: 4px; } .card h2 { flex: 1; } h1 { background-size: cover; } main { justify-content: center; }`,
};
for (const [name, css] of Object.entries(mutants))
  writeFileSync(join(dir, `${name}.html`), intact.replace("</style>", `  ${css}\n</style>`).replace("<title>Intact CSS", `<title>${name}`));
