// Writes fixtures/data-stress/: an intact product list and one mutant per data-edge defect.
// node fixtures/data-stress/build.mjs
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = import.meta.dirname;
const AVATAR =
  "data:image/svg+xml;utf8," +
  encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect width="48" height="48" rx="24" fill="#93c5fd"/></svg>');

const css = `
  body { margin: 0; font: 15px/1.4 system-ui, sans-serif; color: #1f2937; background: #f8fafc; }
  main { max-width: 960px; margin: 0 auto; padding: 24px 16px; }
  h1 { font-size: 24px; margin: 0 0 16px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; margin: 0; padding: 0; list-style: none; }
  .grid:empty::before { content: "No products yet"; display: block; padding: 24px; color: #6b7280; border: 1px dashed #cbd5e1; border-radius: 8px; }
  .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px; display: grid; grid-template-columns: 48px minmax(0, 1fr) auto; gap: 10px; align-items: center; }
  .avatar { width: 48px; height: 48px; border-radius: 50%; background: #e5e7eb; }
  .name { font-weight: 600; overflow-wrap: anywhere; }
  .seller { color: #6b7280; font-size: 13px; overflow-wrap: anywhere; }
  .badge { min-width: 20px; padding: 2px 8px; border-radius: 999px; background: #b91c1c; color: #fff; font-size: 12px; text-align: center; white-space: nowrap; }
`;

const page = (extra, note) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Products</title>
<!-- ${note} -->
<style>${css}${extra}</style>
</head>
<body>
<main>
  <h1>Products</h1>
  <ul class="grid">
${["Desk lamp", "Notebook", "Pen set", "Mug", "Tote bag", "Stickers"]
  .map(
    (name, i) => `    <li class="card">
      <img class="avatar" src="${AVATAR}" alt="${name}">
      <div><div class="name">${name}</div><div class="seller">by Studio ${i + 1}</div></div>
      <span class="badge">${i + 2}</span>
    </li>`,
  )
  .join("\n")}
  </ul>
</main>
</body>
</html>
`;

const files = {
  "cards.html": ["", "Intact: names and sellers wrap anywhere, the badge grows with its count, the avatar keeps its slot, and an empty list says so."],
  "cards--long-name.html": [
    ".name, .seller { overflow-wrap: normal; } .card { grid-template-columns: 48px auto auto; }",
    "Mutant: a name with nowhere to break pushes the card past the page (no overflow-wrap, an auto track).",
  ],
  "cards--fixed-badge.html": [
    ".badge { width: 20px; min-width: 0; padding: 2px 0; overflow: hidden; }",
    "Mutant: the badge is 20px wide whatever its count, so 9,999,999 is cut off.",
  ],
  "cards--avatar.html": [
    ".avatar { width: auto; height: auto; }",
    "Mutant: the avatar has no size of its own, so a failed load collapses its slot.",
  ],
  "cards--no-empty-state.html": [
    ".grid:empty::before { content: none; }",
    "Mutant: an empty list shows nothing at all.",
  ],
};
for (const [name, [extra, note]] of Object.entries(files)) writeFileSync(join(dir, name), page(extra, note));
