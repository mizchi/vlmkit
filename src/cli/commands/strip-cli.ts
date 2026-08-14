#!/usr/bin/env node
/**
 * `vlmkit snapshot strip <pngs...>` — composite a numbered sequence of PNGs into
 * ONE image.
 *
 * The sibling of `snapshot flipbook`, which bundles the same input into a
 * self-contained HTML player. Two different jobs:
 *
 *   flipbook  a human sits down and scrubs; motion is animated
 *   strip     the sequence has to be readable *as a still* — pasted into an
 *             issue, diffed by eye, or handed to a model, which sees one image
 *             and cannot press play
 *
 * Frames are laid out in input order, so pass them in the order you want read:
 * a glob expands sorted, but `frame-2.png` sorts before `frame-10.png`, which is
 * the one thing that silently scrambles a numbered sequence. Zero-pad, or list
 * them explicitly.
 */
import { existsSync } from "node:fs";
import { isCliEntry } from "@mizchi/vlmkit-core/plugin/cli-entry.ts";
import { mkdir, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { UsageError } from "@mizchi/vlmkit-core/cli-error.ts";
import { composeFilmstrip } from "@mizchi/vlmkit-core/filmstrip.ts";
import { decodePng, encodePng } from "@mizchi/vlmkit-core/png-utils.ts";
import { encodeWebp, imageFormatForPath } from "@mizchi/vlmkit-core/webp.ts";
import { BOLD, CYAN, DIM, GREEN, RESET, YELLOW } from "@mizchi/vlmkit-core/terminal-colors.ts";

function usage(): string {
  return [
    "Usage:",
    "  vlmkit snapshot strip <frame1.png> [frame2.png ...] [--out strip.png] [--columns N] [--gap px] [--scale N] [--max-width px]",
    "",
    "Options:",
    "  --out <file>        Output PNG (default strip.png)",
    "  --columns <n>       Cells per row; omit for a single row",
    "  --gap <px>          Gap between cells (default 8)",
    "  --scale <n>         Downscale every frame by this factor",
    "  --max-width <px>    Cap the sheet width, downscaling to fit (default 1600; 0 disables)",
    "  --quality <0-100>   Lossy WebP quality; omit for lossless (smaller for UI screenshots)",
    "  --label <text>      Column label, repeatable, in order. Drawn into the image itself",
    "  --row-label <text>  Row label, repeatable, in order (needs --columns)",
    "  --label-scale <n>   Label size, 1 unit = 5x7px (default 2)",
    "",
    "  A `.webp` output extension encodes WebP (needs the optional @jsquash/webp).",
    "",
    "Examples:",
    "  vlmkit snapshot strip frames/anim-*.png --out strip.png",
    "  vlmkit snapshot strip round-0.png round-1.png round-2.png --columns 3 --out rounds.png",
    "  vlmkit snapshot strip f-0.png f-1.png --label 0ms --label 250ms --out strip.png",
  ].join("\n");
}

interface StripArgs {
  paths: string[];
  out: string;
  columns?: number;
  gap?: number;
  scale?: number;
  maxWidth?: number;
  /** Lossy WebP quality. Omitted means lossless, which is smaller here anyway. */
  quality?: number;
  /**
   * Labels drawn into the sheet. A strip is made to be pasted somewhere the terminal
   * is not, so what a cell means has to travel with the pixels.
   */
  labels: string[];
  rowLabels: string[];
  labelScale?: number;
}

function readNumber(argv: string[], index: number, flag: string): number {
  const raw = argv[index];
  const value = Number(raw);
  if (raw === undefined || !Number.isFinite(value)) {
    throw new UsageError(`${flag} expects a number, got ${raw === undefined ? "nothing" : `"${raw}"`}`);
  }
  return value;
}

function parseArgs(argv: string[]): StripArgs {
  const paths: string[] = [];
  let out = "strip.png";
  let columns: number | undefined;
  let gap: number | undefined;
  let scale: number | undefined;
  let maxWidth: number | undefined;
  let quality: number | undefined;
  const labels: string[] = [];
  const rowLabels: string[] = [];
  let labelScale: number | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    switch (arg) {
      case "--out":
      case "--output":
        out = argv[++i] ?? out;
        break;
      case "--columns":
        columns = readNumber(argv, ++i, "--columns");
        break;
      case "--gap":
        gap = readNumber(argv, ++i, "--gap");
        break;
      case "--scale":
        scale = readNumber(argv, ++i, "--scale");
        break;
      case "--max-width":
        maxWidth = readNumber(argv, ++i, "--max-width");
        break;
      case "--quality":
        quality = readNumber(argv, ++i, "--quality");
        break;
      case "--label":
        labels.push(argv[++i] ?? "");
        break;
      case "--row-label":
        rowLabels.push(argv[++i] ?? "");
        break;
      case "--label-scale":
        labelScale = readNumber(argv, ++i, "--label-scale");
        break;
      case "-h":
      case "--help":
        console.log(usage());
        process.exit(0);
      // falls through — unreachable, `process.exit` above
      default:
        if (arg.startsWith("-")) throw new UsageError(`unknown option ${arg}`);
        paths.push(arg);
    }
  }
  if (paths.length === 0) throw new UsageError(`no frames given.\n\n${usage()}`);
  return {
    paths,
    out,
    ...(columns !== undefined ? { columns } : {}),
    ...(gap !== undefined ? { gap } : {}),
    ...(scale !== undefined ? { scale } : {}),
    ...(maxWidth !== undefined ? { maxWidth } : {}),
    ...(quality !== undefined ? { quality } : {}),
    labels,
    rowLabels,
    ...(labelScale !== undefined ? { labelScale } : {}),
  };
}

/**
 * A numbered sequence whose shell-expanded order is not its numeric order.
 *
 * `frames/anim-0-*.png` expands to 100, 20, 40, 60, 80 — the percentage frame at
 * 100% lands first and the strip reads backwards from its second cell. This is
 * the single most likely way to get a wrong-but-plausible sheet, so it is worth
 * naming rather than leaving to the reader to notice. Returns the numerically
 * sorted order when it differs, else null.
 */
export function numericOrder(paths: readonly string[]): string[] | null {
  const keyed = paths.map((path) => {
    // Digits from the FILENAME, never the directory. Reading the whole path made
    // this fire on `<dir>/rest.png` because the directory itself contained digits
    // — a warning about ordering on two files that carry no number at all.
    //
    // Every run of digits in the name, so `anim-0-20.png` compares as [0, 20] and
    // sorts within its animation rather than across animations.
    const numbers = (basename(path).match(/\d+/g) ?? []).map(Number);
    return { path, numbers };
  });
  if (keyed.some((k) => k.numbers.length === 0)) return null;
  const sorted = [...keyed].sort((a, b) => {
    const len = Math.max(a.numbers.length, b.numbers.length);
    for (let i = 0; i < len; i++) {
      const d = (a.numbers[i] ?? -1) - (b.numbers[i] ?? -1);
      if (d !== 0) return d;
    }
    return a.path.localeCompare(b.path);
  });
  const reordered = sorted.map((k) => k.path);
  return reordered.some((path, i) => path !== paths[i]) ? reordered : null;
}

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv.slice(2));

  const missing = parsed.paths.filter((p) => !existsSync(p));
  if (missing.length > 0) {
    throw new UsageError(`frame(s) not found: ${missing.join(", ")}`);
  }

  const reordered = numericOrder(parsed.paths);
  if (reordered) {
    console.log();
    console.log(`${YELLOW}Note: these filenames do not sort in numeric order.${RESET}`);
    console.log(`  ${DIM}given:   ${parsed.paths.map((p) => basename(p)).join(" ")}${RESET}`);
    console.log(`  ${DIM}numeric: ${reordered.map((p) => basename(p)).join(" ")}${RESET}`);
    console.log(`  ${DIM}A glob expands lexicographically, so 100 sorts before 20. Frames are`);
    console.log(`  composited in the order given — pass them explicitly, or zero-pad the`);
    console.log(`  names, if the numeric order is the one you meant.${RESET}`);
  }

  const frames = await Promise.all(parsed.paths.map((p) => decodePng(resolve(p))));
  // `--max-width 0` means "do not cap", which is not the same as omitting the
  // flag (that takes the 1600 default).
  const cap = parsed.maxWidth ?? 1600;
  const sheet = composeFilmstrip(frames, {
    ...(parsed.columns !== undefined ? { columns: parsed.columns } : {}),
    ...(parsed.gap !== undefined ? { gap: parsed.gap } : {}),
    ...(parsed.scale !== undefined ? { scale: parsed.scale } : {}),
    ...(cap > 0 ? { maxWidth: cap } : {}),
    ...(parsed.labels.length > 0 ? { columnLabels: parsed.labels } : {}),
    ...(parsed.rowLabels.length > 0 ? { rowLabels: parsed.rowLabels } : {}),
    ...(parsed.labelScale !== undefined ? { labelScale: parsed.labelScale } : {}),
  });

  await mkdir(dirname(resolve(parsed.out)), { recursive: true });
  // The extension picks the format, so `--out strip.webp` needs no second flag.
  const format = imageFormatForPath(parsed.out);
  if (format === "webp") {
    await writeFile(resolve(parsed.out), await encodeWebp(sheet, parsed.quality === undefined ? {} : { quality: parsed.quality }));
  } else {
    await encodePng(resolve(parsed.out), sheet);
  }

  const sizes = new Set(frames.map((f) => `${f.width}x${f.height}`));
  console.log();
  console.log(`${BOLD}${CYAN}Strip${RESET}`);
  console.log(`  ${DIM}Frames: ${frames.length} (${sheet.layout.rows} row(s) x ${sheet.layout.columns} column(s))${RESET}`);
  console.log(`  ${DIM}Sheet:  ${sheet.width}x${sheet.height} ${format}${RESET}`);
  if (sheet.layout.scale !== 1) {
    console.log(`  ${DIM}Scale:  1/${sheet.layout.scale} to fit ${cap}px${RESET}`);
  }
  if (sizes.size > 1) {
    // Not an error — the cell is sized from the largest frame and everything is
    // placed top-left — but a mixed-size sequence usually means the wrong glob.
    console.log(`  ${YELLOW}Note:   frames are not all the same size (${[...sizes].join(", ")})${RESET}`);
  }
  console.log(`  ${GREEN}${resolve(parsed.out)}${RESET}`);
  console.log();
}

if (isCliEntry(import.meta.url, "strip-cli")) {
  const { handleCliError } = await import("@mizchi/vlmkit-core/cli-error.ts");
  main().catch(handleCliError);
}

export { parseArgs, usage };
