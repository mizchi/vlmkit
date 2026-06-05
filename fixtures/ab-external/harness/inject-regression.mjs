#!/usr/bin/env node
// A/B experiment harness: inject a seeded CSS regression by deleting one
// selector block from a CSS file. Mirrors the css-challenge "selector mode"
// but works standalone against any external stylesheet.
//
// Usage:
//   node inject-regression.mjs --css path/to/style.css --list
//   node inject-regression.mjs --css path/to/style.css --seed 7 --apply
//
// --list  prints candidate count + a few samples (no mutation)
// --apply deletes the chosen block in place and prints JSON metadata
//         (keep that JSON in the harness dir — it is the hidden answer key)

import { readFileSync, writeFileSync } from "node:fs";

function parseArgs(argv) {
  const args = { css: null, seed: null, list: false, apply: false, minLine: 0 };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--css") args.css = argv[++i];
    else if (a === "--seed") args.seed = Number(argv[++i]);
    else if (a === "--list") args.list = true;
    else if (a === "--apply") args.apply = true;
    else if (a === "--min-line") args.minLine = Number(argv[++i]);
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
