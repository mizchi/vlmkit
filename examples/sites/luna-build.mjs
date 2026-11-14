#!/usr/bin/env node
// Build a demo site written in MoonBit with mizchi/luna into the one classic script it loads.
//
//   node examples/sites/luna-build.mjs <site>          # examples/sites/<site>/src -> examples/sites/<site>/app.js
//   node examples/sites/luna-build.mjs <site> --check  # exit 1 when app.js is not what the source builds to
//
// The site's MoonBit module lives in `src/` (moon.mod + one executable package, `main`, linked as an
// iife). `app.js` is committed so the page needs no build step to be served or judged; this script is
// the only way it is written. Needs the `moon` CLI (export PATH="$HOME/.moon/bin:$PATH").
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const [site, ...rest] = process.argv.slice(2);
if (!site || site.startsWith("-")) {
  console.error("usage: node examples/sites/luna-build.mjs <site> [--check]");
  process.exit(2);
}
const src = join(HERE, site, "src");
if (!existsSync(join(src, "moon.mod"))) {
  console.error(`${src}/moon.mod not found: a luna site keeps its MoonBit module in src/`);
  process.exit(2);
}
const env = { ...process.env, PATH: `${process.env.HOME}/.moon/bin:${process.env.PATH}` };
try {
  execFileSync("moon", ["build", "--target", "js", "--release"], {
    cwd: src,
    env,
    stdio: ["ignore", "inherit", "inherit"],
  });
} catch {
  process.exit(1);
}
const built = join(src, "_build/js/release/build/main/main.js");
if (!existsSync(built)) {
  console.error(`${built} was not written: the executable package must be src/main`);
  process.exit(1);
}
const banner = `// Built from src/ (MoonBit, mizchi/luna) by \`node examples/sites/luna-build.mjs ${site}\`. Do not edit.\n`;
const out = banner + readFileSync(built, "utf8");
const target = join(HERE, site, "app.js");
if (rest.includes("--check")) {
  const now = existsSync(target) ? readFileSync(target, "utf8") : "";
  if (now !== out) {
    console.error(`${target} is stale: run node examples/sites/luna-build.mjs ${site}`);
    process.exit(1);
  }
  console.log(`${site}/app.js is up to date`);
} else {
  writeFileSync(target, out);
  console.log(`wrote ${site}/app.js (${(out.length / 1024).toFixed(1)} KB)`);
}
