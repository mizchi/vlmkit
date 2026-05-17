#!/usr/bin/env node
/**
 * `vrt flipbook <pngs...>` — assemble an arbitrary PNG sequence into a
 * self-contained HTML flipbook.
 *
 * Use cases:
 *   - Fix-loop convergence: visualize round-by-round screenshots
 *   - Ad-hoc demos: any ordered PNG series
 *
 * Snapshot/stability outputs have their own integrated flipbook commands
 * (`vrt snapshot flipbook`) that auto-discover the right frames.
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { framesFromPaths, writeFlipbook, type FlipbookFrame } from "../../vrt/compare/flipbook.ts";
import { DIM, RESET, GREEN, CYAN, BOLD } from "@mizchi/vrt-core/terminal-colors.ts";

function usage(): string {
  return [
    "Usage:",
    "  vrt flipbook <frame1.png> [frame2.png ...] [--out flipbook.html] [--title \"…\"] [--delay 700] [--label A --label B] [--no-loop] [--no-autoplay]",
    "",
    "Examples:",
    "  vrt flipbook round-0.png round-1.png round-2.png --out fix-loop.html --title 'Fix-loop convergence'",
    "  vrt flipbook *.png --delay 1200 --out demo.html",
  ].join("\n");
}

function parseArgs(argv: string[]) {
  const positional: string[] = [];
  const labels: string[] = [];
  let out = "flipbook.html";
  let title = "VRT Flipbook";
  let delayMs = 700;
  let autoplay = true;
  let loop = true;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    switch (arg) {
      case "--out":
      case "--output": {
        const v = argv[++i];
        if (!v) throw new Error(`Missing value for ${arg}`);
        out = v;
        break;
      }
      case "--title": {
        const v = argv[++i];
        if (!v) throw new Error("Missing value for --title");
        title = v;
        break;
      }
      case "--delay": {
        const v = argv[++i];
        const n = v == null ? NaN : Number(v);
        if (!Number.isFinite(n) || n < 50) throw new Error("--delay must be a positive number (>= 50)");
        delayMs = n;
        break;
      }
      case "--label": {
        const v = argv[++i];
        if (!v) throw new Error("Missing value for --label");
        labels.push(v);
        break;
      }
      case "--no-loop":
        loop = false;
        break;
      case "--no-autoplay":
        autoplay = false;
        break;
      case "--help":
      case "-h":
        console.log(usage());
        process.exit(0);
      default:
        if (arg.startsWith("--")) throw new Error(`Unknown option: ${arg}`);
        positional.push(arg);
    }
  }

  if (positional.length === 0) {
    throw new Error("No frame PNGs provided. Pass at least one PNG path.");
  }
  if (labels.length > 0 && labels.length !== positional.length) {
    throw new Error(`--label was provided ${labels.length} time(s) but ${positional.length} frame(s) were given`);
  }

  return { positional, labels, out, title, delayMs, autoplay, loop };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log(usage());
    process.exit(1);
  }

  const parsed = parseArgs(args);
  for (const p of parsed.positional) {
    if (!existsSync(p)) {
      throw new Error(`Frame not found: ${p}`);
    }
  }
  const frames: FlipbookFrame[] = framesFromPaths(
    parsed.positional.map((p) => resolve(p)),
    parsed.labels.length > 0 ? parsed.labels : undefined,
  );

  const result = await writeFlipbook(parsed.out, frames, {
    title: parsed.title,
    delayMs: parsed.delayMs,
    autoplay: parsed.autoplay,
    loop: parsed.loop,
  });

  console.log();
  console.log(`${BOLD}${CYAN}Flipbook${RESET}`);
  console.log(`  ${DIM}Frames: ${result.frameCount}${RESET}`);
  console.log(`  ${DIM}Size: ${(result.bytes / 1024).toFixed(1)} KB${RESET}`);
  console.log(`  ${GREEN}${result.outPath}${RESET}`);
  console.log();
}

if (process.argv[1] && (process.argv[1].endsWith("flipbook-cli.ts") || process.argv[1].endsWith("flipbook-cli.mjs"))) {
  main().catch((err) => {
    console.error(String(err.message ?? err));
    process.exit(1);
  });
}

export { parseArgs, usage };
