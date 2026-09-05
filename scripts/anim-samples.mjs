#!/usr/bin/env node
/**
 * Regenerate `packages/vlmkit-anim/samples/`: one GIF and one contact sheet per
 * fixture, plus a README that embeds them with each animation's narration.
 *
 * The samples are committed so a change to a compiler can be seen in a diff
 * review without running anything — GitHub renders the GIF and the PNG inline.
 * They are not byte-deterministic across machines (font rasterisation differs),
 * so no test compares them; `samples.test.ts` only asserts every fixture has
 * both files and the README lists them. Run this after editing a compiler:
 *
 *     pnpm anim:samples            # all fixtures
 *     pnpm anim:samples sort-bubble tree-bst
 *
 * Runs the CLI from source (no build step) and needs Playwright's chromium.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = join(repoRoot, "packages", "vlmkit-anim");
const fixturesDir = join(pkg, "fixtures");
const samplesDir = join(pkg, "samples");
const cli = join(pkg, "src", "cli.ts");

// 420px at 12 fps keeps the fifteen GIFs near 6 MB in total (480px / 20 fps was 13 MB —
// every GIF frame is a full frame, so bytes scale with fps × pixels).
const GIF_WIDTH = 420;
const GIF_FPS = 12;
const SHEET_COLS = 3;
const SHEET_TILE = 300;

/** `sort-bubble.json` → `sort-bubble`; `sort-insertion.scene.ts` → `sort-insertion`. */
export function sampleName(fixtureFile) {
  return basename(fixtureFile).replace(/\.scene\.(m?ts|m?js)$/, "").replace(/\.json$/, "");
}

export function listFixtures(dir = fixturesDir) {
  return readdirSync(dir)
    .filter((f) => /\.json$|\.scene\.(m?ts|m?js)$/.test(f))
    .sort();
}

function run(args, options = {}) {
  return execFileSync(process.execPath, ["--experimental-strip-types", cli, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
    stdio: ["ignore", "pipe", "inherit"],
    maxBuffer: 32 * 1024 * 1024,
    ...options,
  });
}

const kb = (path) => `${Math.round(statSync(path).size / 1024)} KB`;

function main() {
  const wanted = process.argv.slice(2);
  const fixtures = listFixtures().filter((f) => wanted.length === 0 || wanted.includes(sampleName(f)));
  if (wanted.length && fixtures.length !== wanted.length) {
    const known = listFixtures().map(sampleName);
    throw new Error(`unknown fixture(s): ${wanted.filter((w) => !known.includes(w)).join(", ")}; known: ${known.join(", ")}`);
  }
  mkdirSync(samplesDir, { recursive: true });

  const entries = [];
  for (const file of fixtures) {
    const name = sampleName(file);
    const fixture = join(fixturesDir, file);
    const gif = join(samplesDir, `${name}.gif`);
    const sheet = join(samplesDir, `${name}.sheet.png`);
    process.stderr.write(`${name}\n`);
    const check = JSON.parse(run(["check", fixture, "--json"]));
    if (!check.ok) throw new Error(`${file} does not pass check; fix it before sampling`);
    run(["video", fixture, "--out", gif, "--width", String(GIF_WIDTH), "--fps", String(GIF_FPS)]);
    run(["sheet", fixture, "--out", sheet, "--cols", String(SHEET_COLS), "--tile", String(SHEET_TILE)]);
    const narration = run(["explain", fixture]).trimEnd();
    entries.push({ name, file, kind: check.stats.kind, durationMs: check.stats.durationMs, steps: check.stats.steps, gif, sheet, narration });
  }

  // Rebuild the README from every sample on disk, so a partial run keeps the others listed.
  const all = listFixtures().map((file) => {
    const name = sampleName(file);
    const fresh = entries.find((e) => e.name === name);
    if (fresh) return fresh;
    const gif = join(samplesDir, `${name}.gif`);
    const sheet = join(samplesDir, `${name}.sheet.png`);
    const check = JSON.parse(run(["check", join(fixturesDir, file), "--json"]));
    return { name, file, kind: check.stats.kind, durationMs: check.stats.durationMs, steps: check.stats.steps, gif, sheet, narration: run(["explain", join(fixturesDir, file)]).trimEnd() };
  });
  writeFileSync(join(samplesDir, "README.md"), readme(all));
  process.stderr.write(`${entries.length} sample(s) regenerated → ${samplesDir}\n`);
}

function readme(entries) {
  const lines = [
    "# vlmkit-anim — sample outputs",
    "",
    `One GIF (\`vlmkit-anim video --width ${GIF_WIDTH} --fps ${GIF_FPS}\`) and one contact sheet (\`vlmkit-anim sheet\`,`,
    "every step as a labelled tile) per fixture in [`../fixtures/`](../fixtures/), with the",
    "narration `vlmkit-anim explain` prints. Committed so a compiler change can be judged by",
    "eye in a review; regenerate with `pnpm anim:samples` (all) or `pnpm anim:samples <name>…`.",
    "Pixel output depends on the machine's font rasterisation, so these are not compared by a",
    "test — `samples.test.ts` only checks that every fixture is represented here.",
    "",
    "| fixture | kind | steps | length |",
    "|---|---|---|---|",
    ...entries.map((e) => `| [${e.name}](#${e.name}) | ${e.kind} | ${e.steps} | ${(e.durationMs / 1000).toFixed(1)}s |`),
    "",
  ];
  for (const e of entries) {
    lines.push(
      `## ${e.name}`,
      "",
      `\`${e.kind}\` — [\`fixtures/${e.file}\`](../fixtures/${e.file}) · ${e.steps} steps · ${(e.durationMs / 1000).toFixed(1)}s · GIF ${kb(e.gif)}`,
      "",
      `![${e.name} animation](./${e.name}.gif)`,
      "",
      "<details><summary>Contact sheet (every step) and narration</summary>",
      "",
      `![${e.name} contact sheet](./${e.name}.sheet.png)`,
      "",
      "```",
      e.narration,
      "```",
      "",
      "</details>",
      "",
    );
  }
  return lines.join("\n");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
