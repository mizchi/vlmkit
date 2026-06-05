#!/usr/bin/env node
// A/B experiment harness: inject a seeded CSS regression by deleting one
// selector block from a CSS file, or by mutating property values across
// several blocks. Deletion mirrors the css-challenge "selector mode";
// mutation is the harder class — no sibling rule to copy values from,
// so repairing requires measuring the rendered pixels.
//
// Usage:
//   node inject-regression.mjs --css path/to/style.css --list
//   node inject-regression.mjs --css path/to/style.css --seed 7 --apply
//   node inject-regression.mjs --css path/to/style.css --seed 7 --mutate 3 --apply
//
// --list      prints candidate count + a few samples (no mutation)
// --mutate N  mutate N color/px values in N distinct blocks instead of
//             deleting a block
// --apply     writes the change in place and prints JSON metadata
//             (keep that JSON in the harness dir — it is the hidden answer key)

import { readFileSync, writeFileSync } from "node:fs";

function parseArgs(argv) {
  const args = { css: null, seed: null, list: false, apply: false, minLine: 0, mutate: 0, subtle: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--css") args.css = argv[++i];
    else if (a === "--seed") args.seed = Number(argv[++i]);
    else if (a === "--list") args.list = true;
    else if (a === "--apply") args.apply = true;
    else if (a === "--min-line") args.minLine = Number(argv[++i]);
    else if (a === "--mutate") args.mutate = Number(argv[++i]);
    else if (a === "--subtle") args.subtle = true;
  }
  return args;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Brace-aware scan that records every {...} block with its selector prelude
// and parent chain. Strings and comments are skipped.
function findBlocks(css) {
  const blocks = [];
  const stack = [];
  let preludeStart = 0;
  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (c === "/" && css[i + 1] === "*") {
      const end = css.indexOf("*/", i + 2);
      i = end < 0 ? css.length : end + 1;
      continue;
    }
    if (c === '"' || c === "'") {
      const q = c;
      i++;
      while (i < css.length && css[i] !== q) {
        if (css[i] === "\\") i++;
        i++;
      }
      continue;
    }
    if (c === "{") {
      const raw = css.slice(preludeStart, i);
      const prelude = raw.trim();
      const start = preludeStart + raw.length - raw.trimStart().length;
      stack.push({ prelude, start, bodyStart: i + 1 });
      preludeStart = i + 1;
    } else if (c === "}") {
      const b = stack.pop();
      if (b) {
        blocks.push({
          prelude: b.prelude,
          start: b.start,
          end: i + 1,
          body: css.slice(b.bodyStart, i),
          parents: stack.map((s) => s.prelude),
        });
      }
      preludeStart = i + 1;
    } else if (c === ";") {
      preludeStart = i + 1;
    }
  }
  return blocks;
}

function candidateBlocks(css) {
  return findBlocks(css).filter((b) => {
    if (b.prelude.startsWith("@")) return false; // at-rule itself
    if (b.body.includes("{")) return false; // not a leaf
    // parents must all be conditional group rules (@media / @supports)
    if (
      !b.parents.every(
        (p) => p.startsWith("@media") || p.startsWith("@supports"),
      )
    )
      return false;
    // skip keyframe step selectors that slipped through (parent @keyframes)
    if (b.parents.some((p) => p.startsWith("@keyframes"))) return false;
    const decls = b.body
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.includes(":"));
    if (decls.length < 2) return false;
    b.declCount = decls.length;
    return true;
  });
}

// --- mutation mode helpers ---

const HEX_RE = /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g;
const PX_RE = /(\d+(?:\.\d+)?)px\b/g;

function blockBodyStart(block) {
  // body = css.slice(bodyStart, end - 1)
  return block.end - 1 - block.body.length;
}

// Declarations inside a leaf block whose value contains a hex color or a
// px length — the mutatable population.
function mutatableDecls(block) {
  const decls = [];
  let offset = 0;
  for (const segment of block.body.split(";")) {
    const m = segment.match(/^(\s*)([-a-zA-Z]+)\s*:\s*(.+?)\s*$/s);
    if (m) {
      const property = m[2];
      const value = m[3];
      const hex = value.match(HEX_RE);
      const px = value.match(PX_RE);
      if ((hex && hex.length > 0) || (px && px.some((p) => parseFloat(p) > 0))) {
        decls.push({
          property,
          value,
          kind: hex && hex.length > 0 ? "color" : "length",
          // absolute offset of the segment within the file
          segmentStart: blockBodyStart(block) + offset,
          segmentText: segment,
        });
      }
    }
    offset += segment.length + 1; // + ";"
  }
  return decls;
}

function mutateHex(hex, rand, subtle) {
  const raw = hex.slice(1);
  const full = raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw;
  const channels = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
  const mutated = channels.map((c) => {
    const sign = rand() < 0.5 ? -1 : 1;
    // subtle: hard to eyeball, still above the pixelmatch 0.1 threshold
    const delta = subtle
      ? Math.round(24 + rand() * 20) // 24..44
      : Math.round(24 + rand() * 56); // 24..80 — clearly visible
    return Math.max(0, Math.min(255, c + sign * delta));
  });
  return "#" + mutated.map((c) => c.toString(16).padStart(2, "0")).join("");
}

function mutatePx(px, rand, subtle) {
  const value = parseFloat(px);
  if (value === 0) return "16px";
  const grow = rand() < 0.5;
  const factor = subtle
    ? (grow ? 1.15 + rand() * 0.2 : 0.72 + rand() * 0.16)
    : (grow ? 1.6 + rand() * 0.8 : 0.35 + rand() * 0.25);
  const next = Math.max(1, Math.round(value * factor));
  // Guarantee at least a few px of movement even for small values.
  if (next === value) return `${grow ? value + 3 : Math.max(1, value - 3)}px`;
  return `${next}px`;
}

function mutateValue(decl, rand, subtle) {
  if (decl.kind === "color") {
    const matches = [...decl.value.matchAll(HEX_RE)];
    const target = matches[Math.floor(rand() * matches.length)];
    const replacement = mutateHex(target[0], rand, subtle);
    return {
      from: target[0],
      to: replacement,
      value: decl.value.slice(0, target.index) + replacement +
        decl.value.slice(target.index + target[0].length),
    };
  }
  const matches = [...decl.value.matchAll(PX_RE)].filter((m) => parseFloat(m[1]) > 0);
  const target = matches[Math.floor(rand() * matches.length)];
  const replacement = mutatePx(target[0], rand, subtle);
  return {
    from: target[0],
    to: replacement,
    value: decl.value.slice(0, target.index) + replacement +
      decl.value.slice(target.index + target[0].length),
  };
}

function applyMutations(css, candidates, count, rand, subtle) {
  // Pool: every mutatable decl, at most one per block so the damage spreads.
  const pool = [];
  for (const block of candidates) {
    const decls = mutatableDecls(block);
    if (decls.length === 0) continue;
    pool.push({ block, decls });
  }
  // Seeded shuffle of blocks, then pick `count`.
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const chosen = shuffled.slice(0, count);
  const edits = [];
  for (const { block, decls } of chosen) {
    const decl = decls[Math.floor(rand() * decls.length)];
    const mutated = mutateValue(decl, rand, subtle);
    const newSegment = decl.segmentText.replace(decl.value, mutated.value);
    edits.push({
      selector: block.prelude,
      parents: block.parents,
      property: decl.property,
      from: decl.value,
      to: mutated.value,
      changed: `${mutated.from} -> ${mutated.to}`,
      start: decl.segmentStart,
      end: decl.segmentStart + decl.segmentText.length,
      replacement: newSegment,
      line: css.slice(0, decl.segmentStart).split("\n").length,
    });
  }
  // Apply from the end so earlier offsets stay valid.
  edits.sort((a, b) => b.start - a.start);
  let next = css;
  for (const e of edits) {
    next = next.slice(0, e.start) + e.replacement + next.slice(e.end);
  }
  return { next, edits: edits.sort((a, b) => a.start - b.start) };
}

const args = parseArgs(process.argv);
if (!args.css) {
  console.error("--css is required");
  process.exit(1);
}
const css = readFileSync(args.css, "utf8");
let candidates = candidateBlocks(css);
if (args.minLine > 0) {
  candidates = candidates.filter(
    (b) => css.slice(0, b.start).split("\n").length >= args.minLine,
  );
}

if (args.list) {
  console.log(`candidates: ${candidates.length}`);
  for (const [i, b] of candidates.entries()) {
    const media = b.parents.length ? ` [${b.parents.join(" > ")}]` : "";
    console.log(
      `${String(i).padStart(3)}  ${b.prelude.slice(0, 60)}${media}  (${b.declCount} decls)`,
    );
  }
  process.exit(0);
}

if (args.seed == null || Number.isNaN(args.seed)) {
  console.error("--seed <n> is required with --apply");
  process.exit(1);
}
const rand = mulberry32(args.seed);

if (args.mutate > 0) {
  const { next, edits } = applyMutations(css, candidates, args.mutate, rand, args.subtle);
  if (edits.length < args.mutate) {
    console.error(`only ${edits.length} mutatable blocks available`);
    process.exit(1);
  }
  const meta = {
    seed: args.seed,
    mode: "mutate",
    cssFile: args.css,
    mutations: edits.map(({ selector, parents, property, from, to, changed, line }) => ({
      selector, parents, property, from, to, changed, line,
    })),
  };
  if (args.apply) writeFileSync(args.css, next);
  console.log(JSON.stringify(meta, null, 2));
  process.exit(0);
}

const pick = candidates[Math.floor(rand() * candidates.length)];
if (!pick) {
  console.error("no candidate blocks found");
  process.exit(1);
}

const meta = {
  seed: args.seed,
  cssFile: args.css,
  selector: pick.prelude,
  parents: pick.parents,
  declCount: pick.declCount,
  deletedText: css.slice(pick.start, pick.end),
  line: css.slice(0, pick.start).split("\n").length,
};

if (args.apply) {
  const next = css.slice(0, pick.start) + css.slice(pick.end);
  writeFileSync(args.css, next);
}
console.log(JSON.stringify(meta, null, 2));
