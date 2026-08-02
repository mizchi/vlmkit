/**
 * Selector-heal CLI — first-class command surface for
 * `healSelector`, which was previously reachable only through
 * `inspect interact`'s failure path.
 *
 * Given a page (HTML file or URL) and a selector that no longer
 * matches, print ranked replacement candidates with confidence and
 * the signals that produced them.
 *
 * CLI: vlmkit heal selector <html-or-url> <broken-selector> [options]
 */
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import { chromium } from "playwright";
import { healSelector } from "./selector-heal.ts";
import { handleCliError } from "@mizchi/vlmkit-core/cli-error.ts";
import { settlePage } from "@mizchi/vlmkit-core/page-open.ts";

function toUrl(input: string): string {
  if (/^https?:\/\//.test(input)) return input;
  if (existsSync(input)) return pathToFileURL(resolve(input)).href;
  throw new Error(`Input is neither a URL nor an existing file: ${input}`);
}

function printHelp(): void {
  console.log(`Usage: vlmkit heal selector <html-or-url> <broken-selector> [options]

Suggest replacement selectors for one that no longer matches.

Options:
  --max <N>     Max candidates to report (default 5)
  --json        Emit machine-readable JSON
  --viewport <WxH>  Viewport (default 1280x800)
  -h, --help    Show this help`);
}

async function main(argv = process.argv.slice(2)) {
  const help = argv.includes("--help") || argv.includes("-h");
  const positional = argv.filter((arg, i) => !arg.startsWith("-") && argv[i - 1] !== "--max" && argv[i - 1] !== "--viewport");
  if (help || positional.length < 2) {
    printHelp();
    if (positional.length < 2 && !help) process.exit(1);
    return;
  }
  const flag = (name: string): string | undefined => {
    const index = argv.indexOf(name);
    return index >= 0 ? argv[index + 1] : undefined;
  };
  const [input, brokenSelector] = positional;
  const maxCandidates = Number(flag("--max") ?? 5);
  const [width, height] = (flag("--viewport") ?? "1280x800").split("x").map(Number);
  const json = argv.includes("--json");

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width, height } });
    await page.goto(toUrl(input), { waitUntil: "load" });
    // Candidate selectors are harvested from the DOM as it stands. Without
    // settling, a client-rendered page offers candidates from its placeholder,
    // which is the opposite of useful when healing a selector that broke.
    await settlePage(page);

    const alreadyMatches = await page.locator(brokenSelector).count().catch(() => 0);
    const candidates = await healSelector(page, brokenSelector, { maxCandidates });

    if (json) {
      console.log(JSON.stringify({ input, brokenSelector, alreadyMatches, candidates }, null, 2));
      return;
    }
    if (alreadyMatches > 0) {
      console.log(`Note: "${brokenSelector}" currently matches ${alreadyMatches} element(s) — candidates below are alternatives.\n`);
    }
    if (candidates.length === 0) {
      console.log(`No replacement candidates found for "${brokenSelector}".`);
      return;
    }
    console.log(`# Selector heal: ${brokenSelector}\n`);
    console.log(`| # | Candidate | Confidence | Text | Signals |`);
    console.log(`|---|---|---|---|---|`);
    candidates.forEach((candidate, index) => {
      const text = candidate.text.length > 40 ? `${candidate.text.slice(0, 37)}...` : candidate.text;
      console.log(
        `| ${index + 1} | \`${candidate.selector}\` | ${(candidate.confidence * 100).toFixed(0)}% | ${text} | ${candidate.reasons.join("; ")} |`,
      );
    });
  } finally {
    await browser.close();
  }
}

const isCliEntry = process.env.__VRT_DISPATCHER_LEAF__ === "selector-heal-cli"
  || (process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false);
if (isCliEntry) {
  main().catch(handleCliError);
}
