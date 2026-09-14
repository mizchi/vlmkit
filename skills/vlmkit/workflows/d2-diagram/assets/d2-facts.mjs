#!/usr/bin/env node
/**
 * d2-facts — what a D2 file actually DRAWS, and whether that is what it claims.
 *
 *   node d2-facts.mjs diagram.d2                       # the facts, as JSON
 *   node d2-facts.mjs diagram.d2 --expect facts.json   # check them; exit 1 on ✗
 *   node d2-facts.mjs diagram.d2 --layout elk          # default: tala
 *
 * D2 has no `--expect`: `validate` reads syntax and the renderers draw whatever
 * the file says, so a diagram can be green, well laid out, and wrong. This reads
 * the picture back from the RENDER — d2 writes every shape's and every
 * connection's fully-qualified id into the SVG (base64 in a class attribute) —
 * so what it reports is what a reader sees, not what the source seems to say.
 *
 * It is deliberately small and dependency-free: copy it next to your diagrams.
 *
 * Sheet keys, all optional:
 *   boxes       ["orders", …]              every one must be drawn
 *   deps        ["orders->inventory", …]   drawn, with that direction
 *   forbidden   ["orders->billing", …]     must NOT be drawn
 *   containers  {"cluster": ["orders", …]} each must hold those members
 *   exhaustive  true                       an edge not in `deps` is an error
 *   maxColumns  100                        widest line of the terminal render
 *   allowOrphans ["legend"]                boxes that may have no connection
 *
 * Names in a sheet are matched against the last segment of a drawn id, so a
 * sheet says `orders` whether the file wrote `cluster.orders` or `svc_orders`.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const argv = process.argv.slice(2);
const file = argv.find((a) => !a.startsWith("--"));
const flag = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  if (i !== -1 && argv[i + 1] && !argv[i + 1].startsWith("--")) return argv[i + 1];
  const eq = argv.find((a) => a.startsWith(`--${name}=`));
  return eq ? eq.slice(name.length + 3) : fallback;
};
if (!file) {
  console.error("usage: d2-facts.mjs diagram.d2 [--expect facts.json] [--layout tala]");
  process.exit(2);
}
const layout = flag("layout", "tala");
const d2 = process.env.D2 || "d2";
const dir = mkdtempSync(join(tmpdir(), "d2-facts-"));
const render = (ext) => {
  const out = join(dir, `out.${ext}`);
  execFileSync(d2, [`--layout=${layout}`, file, out], { stdio: "pipe" });
  return readFileSync(out, "utf8");
};

/* ---------- read the drawn picture back out of the SVG ---------- */

let svg;
try {
  svg = render("svg");
} catch (error) {
  console.error(`✗ ${file} does not render with --layout=${layout}:`);
  console.error(String(error.stderr || error.message).trim());
  process.exit(1);
}

const ids = new Set();
for (const m of svg.matchAll(/class="([A-Za-z0-9+/=]{4,})"/g)) {
  let decoded;
  try {
    decoded = Buffer.from(m[1], "base64").toString("utf8");
  } catch {
    continue;
  }
  if (!decoded) continue;
  // Only ids: a class that is not an exact re-encoding is a style class.
  if (Buffer.from(decoded, "utf8").toString("base64").replace(/=+$/, "") !== m[1].replace(/=+$/, "")) continue;
  ids.add(decoded.replace(/&gt;/g, ">").replace(/&lt;/g, "<").replace(/&amp;/g, "&"));
}

// Geometry and label, per shape: from the shape's own group. D2 has no
// `layout` verb, so boxes that overlap or escape their container are otherwise
// only visible to someone who opens the picture.
const boxOf = new Map();
const labelsOf = new Map();
for (const m of svg.matchAll(/<g class="([A-Za-z0-9+/=]{4,})"[^>]*>([\s\S]{0,900}?)<\/g>/g)) {
  let decoded;
  try {
    decoded = Buffer.from(m[1], "base64").toString("utf8");
  } catch {
    continue;
  }
  if (!decoded || Buffer.from(decoded, "utf8").toString("base64").replace(/=+$/, "") !== m[1].replace(/=+$/, ""))
    continue;
  const r = m[2].match(/<rect[^>]*\sx="([-\d.]+)"[^>]*\sy="([-\d.]+)"[^>]*\swidth="([\d.]+)"[^>]*\sheight="([\d.]+)"/);
  if (!r) continue;
  const [x, y, w, h] = r.slice(1, 5).map(Number);
  if (w <= 0 || h <= 0) continue;
  if (!boxOf.has(decoded)) boxOf.set(decoded, { x, y, w, h });
}

// The label a reader sees, per shape: every <text> between this shape's group
// tag and the next shape's, which is where d2 puts it (the label follows the
// nested `<g class="shape">`, so the group's own body does not hold it). A sheet
// can then say `gateway` for a file that wrote `gw: API gateway`.
const markers = [];
for (const m of svg.matchAll(/<g class="([A-Za-z0-9+/=]{4,})"/g)) {
  let decoded;
  try {
    decoded = Buffer.from(m[1], "base64").toString("utf8");
  } catch {
    continue;
  }
  if (!decoded || Buffer.from(decoded, "utf8").toString("base64").replace(/=+$/, "") !== m[1].replace(/=+$/, ""))
    continue;
  markers.push({ id: decoded.replace(/&gt;/g, ">").replace(/&lt;/g, "<").replace(/&amp;/g, "&"), index: m.index });
}
markers.sort((a, b) => a.index - b.index);
for (let i = 0; i < markers.length; i += 1) {
  const { id, index } = markers[i];
  if (labelsOf.has(id)) continue;
  const span = svg.slice(index, markers[i + 1] ? markers[i + 1].index : svg.length);
  const texts = [...span.matchAll(/<text[^>]*>([^<]+)<\/text>/g)].map((t) =>
    t[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim(),
  );
  if (texts.length) labelsOf.set(id, texts);
}

// The y of a connection, so a sequence diagram's message order can be read back.
const edgeY = new Map();

const edges = [];
const shapes = [];
for (const id of ids) {
  const m = id.match(/^(.*?)\(([^()]+?) (->|--|<->|<-) ([^()]+?)\)\[(\d+)\]$/);
  if (m) {
    const prefix = m[1].replace(/\.$/, "");
    const q = (x) => {
      const t = x.trim();
      return prefix && !t.startsWith(`${prefix}.`) ? `${prefix}.${t}` : t;
    };
    const [from, to] = m[3] === "<-" ? [q(m[4]), q(m[2])] : [q(m[2]), q(m[4])];
    const enc = Buffer.from(id.replace(/>/g, "&gt;").replace(/</g, "&lt;"), "utf8").toString("base64");
    const at = svg.indexOf(`class="${enc}"`) >= 0 ? svg.indexOf(`class="${enc}"`) : -1;
    let y = null;
    if (at >= 0) {
      const path = svg.slice(at, at + 1200).match(/\sd="M\s*([-\d.]+)[ ,]([-\d.]+)/);
      if (path) y = Number(path[2]);
    }
    edges.push({ from, to, op: m[3], y });
    edgeY.set(`${from}->${to}`, y);
  } else if (!id.includes("(") && !id.includes(" ")) {
    shapes.push(id);
  }
}

const containers = shapes.filter((s) => shapes.some((o) => o !== s && o.startsWith(`${s}.`)));
const membersOf = (c) => shapes.filter((s) => s.startsWith(`${c}.`) && !s.slice(c.length + 1).includes(".")).sort();
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const tail = (id) => norm(id.split(".").pop());
const deps = edges.map((e) => `${e.from}->${e.to}`).sort();
const facts = {
  boxes: shapes.filter((s) => !containers.includes(s)).sort(),
  containers: Object.fromEntries(containers.sort().map((c) => [c, membersOf(c)])),
  deps,
};

/* ---------- two defects D2 itself never reports ---------- */

// 1. The same name drawn twice. In D2 a reference to an id that is not in scope
//    CREATES a shape rather than failing, so `gateway -> orders` written at the
//    root when both live in containers silently adds two more boxes.
const byTail = new Map();
for (const s of shapes) {
  if (containers.includes(s)) continue;
  const key = tail(s);
  byTail.set(key, [...(byTail.get(key) || []), s]);
}
const duplicates = [...byTail.entries()].filter(([, list]) => list.length > 1);

// 2. A box nothing connects to. Usually the other half of a duplicate.
const touched = new Set(edges.flatMap((e) => [e.from, e.to]));
const orphans = facts.boxes.filter(
  (b) => !touched.has(b) && ![...touched].some((t) => t.startsWith(`${b}.`)),
);

// 3. Boxes that overlap a sibling, and children that escape their container.
const parentOf = (id) => (id.includes(".") ? id.slice(0, id.lastIndexOf(".")) : "");
const overlap = (a, b) => {
  const dx = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const dy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return dx > 1 && dy > 1 ? Math.round(dx) * Math.round(dy) : 0;
};
const collisions = [];
const placed = shapes.filter((s) => boxOf.has(s));
for (let i = 0; i < placed.length; i += 1) {
  for (let j = i + 1; j < placed.length; j += 1) {
    const [a, b] = [placed[i], placed[j]];
    if (a.startsWith(`${b}.`) || b.startsWith(`${a}.`)) continue; // a container holds it
    if (parentOf(a) !== parentOf(b)) continue; // only siblings share a frame
    const area = overlap(boxOf.get(a), boxOf.get(b));
    if (area) collisions.push({ a, b, area });
  }
}
const escapes = [];
for (const s of placed) {
  const p = parentOf(s);
  if (!p || !boxOf.has(p)) continue;
  const c = boxOf.get(s);
  const o = boxOf.get(p);
  if (c.x < o.x - 1 || c.y < o.y - 1 || c.x + c.w > o.x + o.w + 1 || c.y + c.h > o.y + o.h + 1)
    escapes.push({ child: s, parent: p });
}

/* ---------- the terminal render's width, measured the way a terminal sees it ---------- */

let columns = null;
try {
  const txt = render("txt");
  const width = (line) =>
    [...line.replace(/\s+$/, "")].reduce((n, ch) => {
      const cp = ch.codePointAt(0);
      // East Asian Wide / Fullwidth take two columns.
      const wide =
        (cp >= 0x1100 && cp <= 0x115f) ||
        (cp >= 0x2e80 && cp <= 0xa4cf) ||
        (cp >= 0xac00 && cp <= 0xd7a3) ||
        (cp >= 0xf900 && cp <= 0xfaff) ||
        (cp >= 0xfe30 && cp <= 0xfe6f) ||
        (cp >= 0xff00 && cp <= 0xff60) ||
        (cp >= 0xffe0 && cp <= 0xffe6) ||
        (cp >= 0x1f300 && cp <= 0x1f64f);
      return n + (wide ? 2 : 1);
    }, 0);
  columns = Math.max(0, ...txt.split("\n").map(width));
} catch {
  columns = null;
}

/* ---------- report ---------- */

const expectPath = flag("expect");
const errors = [];
const warnings = [];
const ok = [];

for (const [name, list] of duplicates)
  errors.push(
    `✗ "${name}" is drawn ${list.length} times (${list.join(", ")}) — a reference to an id that is not in scope creates a new shape; use a full path or \`_.\` to reach out of a container`,
  );
for (const c of collisions)
  errors.push(`✗ ${c.a} and ${c.b} overlap by ${c.area}px² — they are siblings, so a reader sees one box run into the other`);
for (const e of escapes) errors.push(`✗ ${e.child} is drawn outside its container ${e.parent}`);

if (!expectPath) {
  for (const line of errors) console.log(line);
  if (orphans.length) console.log(`⚠ nothing connects to: ${orphans.join(", ")}`);
  console.log(
    JSON.stringify(
      {
        file,
        layout,
        columns,
        ...facts,
        labels: Object.fromEntries([...labelsOf].filter(([id]) => shapes.includes(id)).map(([id, l]) => [id, l[0]])),
      },
      null,
      2,
    ),
  );
  process.exit(errors.length ? 1 : 0);
}

const sheet = JSON.parse(readFileSync(expectPath, "utf8"));
const labelMatches = (id, n) => (labelsOf.get(id) || []).some((l) => norm(l) === n);
const resolve = (name) => {
  const n = norm(name);
  if (name.includes(".")) {
    // A column-level name (`orders.customer_id`): the table is the shape.
    const hit = shapes.find((s) => norm(s).endsWith(n));
    if (hit) return hit;
    const head = norm(name.split(".")[0]);
    const table = shapes.find((s) => tail(s) === head) || shapes.find((s) => labelMatches(s, head));
    if (table) return table;
  }
  const deepest = (list) => list.sort((a, b) => b.split(".").length - a.split(".").length)[0];
  const byId = shapes.filter((s) => tail(s) === n);
  if (byId.length) return deepest(byId);
  const byLabel = shapes.filter((s) => labelMatches(s, n));
  if (byLabel.length) return deepest(byLabel);
  const loose = shapes.filter((s) => {
    const t = tail(s);
    const byTailPart = t.length >= 3 && n.length >= 3 && (t.includes(n) || n.includes(t));
    const byLabelPart = (labelsOf.get(s) || []).some((l) => {
      const ln = norm(l);
      return ln.length >= 3 && n.length >= 3 && (ln.includes(n) || n.includes(ln));
    });
    return byTailPart || byLabelPart;
  });
  return loose.length === 1 ? loose[0] : null;
};
const drawn = new Set(deps);
const key = (a, b) => `${a}->${b}`;
const pair = (spec) => {
  const [a, b] = spec.split("->").map((s) => s.trim());
  return [resolve(a), resolve(b), a, b];
};

for (const box of sheet.boxes || []) {
  const hit = resolve(box);
  if (hit) ok.push(`box ${box} → ${hit}`);
  else errors.push(`✗ box not drawn: ${box}`);
}
for (const spec of sheet.deps || []) {
  const [a, b, an, bn] = pair(spec);
  if (!a || !b) {
    errors.push(`✗ edge ${spec}: ${a ? bn : an} is not drawn at all`);
    continue;
  }
  if (drawn.has(key(a, b))) ok.push(`edge ${spec} → ${a}->${b}`);
  else if (drawn.has(key(b, a))) errors.push(`✗ edge reversed: the sheet says ${spec}, the picture draws ${b}->${a}`);
  else errors.push(`✗ edge not drawn: ${spec} (looked for ${a}->${b})`);
}
for (const spec of sheet.forbidden || []) {
  const [a, b] = pair(spec);
  if (a && b && drawn.has(key(a, b))) errors.push(`✗ forbidden edge drawn: ${spec}`);
}
for (const [container, members] of Object.entries(sheet.containers || {})) {
  const c = resolve(container);
  if (!c) {
    errors.push(`✗ container not drawn: ${container}`);
    continue;
  }
  const deep = new Set(shapes.filter((s) => s.startsWith(`${c}.`)).map(tail));
  for (const m of members) {
    if (deep.has(norm(m))) ok.push(`${container} holds ${m}`);
    else errors.push(`✗ ${container} does not hold ${m}`);
  }
}
const listed = new Set(
  (sheet.deps || []).map((s) => {
    const [a, b] = pair(s);
    return a && b ? key(a, b) : s;
  }),
);
for (const e of deps) {
  if (listed.has(e)) continue;
  if (sheet.exhaustive) errors.push(`✗ edge drawn that the sheet does not list: ${e}`);
  else warnings.push(`⚠ drawn but not in the sheet: ${e}`);
}
const allowed = new Set((sheet.allowOrphans || []).map(norm));
for (const o of orphans) {
  if (allowed.has(tail(o))) continue;
  warnings.push(`⚠ nothing connects to ${o}`);
}
if (sheet.order) {
  // Read the drawn order back from the geometry: top to bottom for a sequence
  // diagram, which is the only place D2 makes order visible.
  const want = sheet.order.map((spec) => {
    const [a, b] = pair(spec);
    return { spec, key: a && b ? key(a, b) : null };
  });
  const missing = want.filter((w) => !w.key || !drawn.has(w.key));
  for (const m of missing) errors.push(`✗ message not drawn: ${m.spec}`);
  const placedMsgs = want.filter((w) => w.key && drawn.has(w.key) && edgeY.get(w.key) != null);
  for (let i = 1; i < placedMsgs.length; i += 1) {
    const prev = placedMsgs[i - 1];
    const cur = placedMsgs[i];
    if (edgeY.get(cur.key) < edgeY.get(prev.key))
      errors.push(`✗ out of order: ${cur.spec} is drawn above ${prev.spec}`);
  }
  if (!missing.length && placedMsgs.length) ok.push(`${placedMsgs.length} messages drawn in the sheet's order`);
}
if (sheet.maxColumns != null) {
  if (columns == null) warnings.push("⚠ no terminal render — the width could not be measured");
  else if (columns > sheet.maxColumns)
    errors.push(`✗ the terminal render is ${columns} columns, the sheet allows ${sheet.maxColumns}`);
  else ok.push(`width ${columns} ≤ ${sheet.maxColumns} columns`);
}

for (const line of ok) console.log(`  ✓ ${line}`);
for (const line of warnings) console.log(`  ${line}`);
for (const line of errors) console.log(`  ${line}`);
console.log(
  `\n${errors.length ? "✗" : "✓"} ${file}: ${ok.length} ok, ${warnings.length} warning(s), ${errors.length} error(s)` +
    `${columns == null ? "" : ` · ${columns} columns`} · ${deps.length} edges drawn`,
);
process.exit(errors.length ? 1 : 0);
