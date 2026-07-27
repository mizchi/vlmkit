/**
 * Palette CLI — first-class command surface for palette-extract /
 * palette-diff, which were previously reachable only through
 * `build component` and `migration compare` reports.
 *
 * One PNG:  dominant colors + outer/inner background samples.
 * Two PNGs: palette diff (missing / extra colors with nearest-neighbor
 *           distance annotations so AA jitter is dismissible).
 *
 * CLI: vlmkit check palette <target.png> [current.png] [options]
 */
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  extractPaletteFromFile,
  findDominantBackgroundsFromFile,
  type PaletteColor,
} from "./palette-extract.ts";
import { diffPalettes, type UnmatchedPaletteColor } from "./palette-diff.ts";
import { handleCliError } from "@mizchi/vlmkit-core/cli-error.ts";

function pct(share: number): string {
  return `${(share * 100).toFixed(1)}%`;
}

function paletteTable(colors: PaletteColor[]): string {
  const lines = ["| Color | Share |", "|---|---|"];
  for (const color of colors) lines.push(`| \`${color.hex}\` | ${pct(color.share)} |`);
  return lines.join("\n");
}

function nearestNote(color: UnmatchedPaletteColor): string {
  const d = color.nearestNeighborDistance;
  if (d <= 30) return "(near, likely AA)";
  if (d > 60) return "(real palette gap)";
  return "";
}

function unmatchedTable(colors: UnmatchedPaletteColor[]): string {
  if (colors.length === 0) return "_none_";
  const lines = ["| Color | Share | Nearest | Note |", "|---|---|---|---|"];
  for (const color of colors) {
    lines.push(
      `| \`${color.hex}\` | ${pct(color.share)} | ${color.nearestNeighborDistance.toFixed(0)} | ${nearestNote(color)} |`,
    );
  }
  return lines.join("\n");
}

function printHelp(): void {
  console.log(`Usage: vlmkit check palette <target.png> [current.png] [options]

With one PNG: report dominant colors + outer/inner backgrounds.
With two PNGs: diff the palettes — colors missing from current
(forgotten tokens) and extra in current (hard-coded literals).

Options:
  --top <K>            Top-K colors to extract (default 16)
  --max-distance <N>   RGB distance treated as a match (default 12)
  --json               Emit machine-readable JSON instead of Markdown
  -h, --help           Show this help`);
}

async function main(argv = process.argv.slice(2)) {
  const help = argv.includes("--help") || argv.includes("-h");
  const positional = argv.filter((arg, i) => !arg.startsWith("-") && argv[i - 1] !== "--top" && argv[i - 1] !== "--max-distance");
  if (help || positional.length === 0) {
    printHelp();
    if (positional.length === 0 && !help) process.exit(1);
    return;
  }
  const flag = (name: string): string | undefined => {
    const index = argv.indexOf(name);
    return index >= 0 ? argv[index + 1] : undefined;
  };
  const topK = Number(flag("--top") ?? 16);
  const maxDistance = Number(flag("--max-distance") ?? 12);
  const json = argv.includes("--json");

  const [targetPath, currentPath] = positional;
  const target = await extractPaletteFromFile(targetPath, { topK });

  if (!currentPath) {
    const backgrounds = await findDominantBackgroundsFromFile(targetPath);
    if (json) {
      console.log(JSON.stringify({ palette: target, backgrounds }, null, 2));
      return;
    }
    console.log(`# Palette: ${targetPath}\n`);
    console.log(`Outer background: \`${backgrounds.outer.hex}\`  Inner background: \`${backgrounds.inner.hex}\`\n`);
    console.log(paletteTable(target));
    return;
  }

  const current = await extractPaletteFromFile(currentPath, { topK });
  const diff = diffPalettes(target, current, { maxDistance });
  if (json) {
    console.log(JSON.stringify({ target: targetPath, current: currentPath, diff }, null, 2));
    return;
  }
  console.log(`# Palette diff\n`);
  console.log(`Target: ${targetPath}`);
  console.log(`Current: ${currentPath}\n`);
  console.log(`Matched: ${diff.matched.length} colors (target coverage ${pct(diff.baselineMatchedShare)}, current coverage ${pct(diff.variantMatchedShare)})\n`);
  console.log(`## Missing from current (add these)\n`);
  console.log(unmatchedTable(diff.onlyInBaseline));
  console.log(`\n## Extra in current (hard-coded literals?)\n`);
  console.log(unmatchedTable(diff.onlyInVariant));
}

const isCliEntry = process.env.__VRT_DISPATCHER_LEAF__ === "palette-cli"
  || (process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false);
if (isCliEntry) {
  main().catch(handleCliError);
}
