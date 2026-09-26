#!/usr/bin/env node
/**
 * Write mutants/<id>.html from patterns/<pattern>.html and mutations.json.
 *
 * A mutant is its pattern plus exactly one change — a CSS block injected before
 * </head> as <style data-mutation="<id>">, or one literal replacement — so the pair
 * isolates one defect and nothing else. `responsive-pbt.test.ts` fails when a
 * committed mutant differs from what this writes.
 *
 *   node fixtures/responsive-patterns/build.mjs          # write
 *   node fixtures/responsive-patterns/build.mjs --check  # exit 1 when stale
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

export function buildMutant(mutant, patternHtml) {
  if (mutant.inject !== undefined) {
    if (!patternHtml.includes("</head>")) throw new Error(`${mutant.pattern}: no </head> to inject before`);
    return patternHtml.replace(
      "</head>",
      `<style data-mutation="${mutant.id}">\n${mutant.inject}\n</style>\n</head>`,
    );
  }
  if (mutant.replace !== undefined) {
    const [from, to] = mutant.replace;
    const at = patternHtml.indexOf(from);
    if (at < 0) throw new Error(`${mutant.id}: "${from}" not in ${mutant.pattern}`);
    if (patternHtml.indexOf(from, at + 1) >= 0) throw new Error(`${mutant.id}: "${from}" occurs twice in ${mutant.pattern}`);
    return patternHtml.slice(0, at) + to + patternHtml.slice(at + from.length);
  }
  throw new Error(`${mutant.id}: needs inject or replace`);
}

export function buildAll() {
  const { mutants } = JSON.parse(readFileSync(join(here, "mutations.json"), "utf8"));
  return mutants.map((m) => ({
    mutant: m,
    path: join(here, "mutants", `${m.id}.html`),
    html: buildMutant(m, readFileSync(join(here, "patterns", `${m.pattern}.html`), "utf8")),
  }));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes("--check");
  let stale = 0;
  mkdirSync(join(here, "mutants"), { recursive: true });
  for (const { path, html } of buildAll()) {
    let current = null;
    try { current = readFileSync(path, "utf8"); } catch {}
    if (current === html) continue;
    stale++;
    if (check) console.error(`stale: ${path}`);
    else writeFileSync(path, html);
  }
  if (check && stale > 0) process.exit(1);
  console.log(check ? "mutants up to date" : `wrote ${stale} mutant(s)`);
}
