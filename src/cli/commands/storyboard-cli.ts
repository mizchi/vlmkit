#!/usr/bin/env node
/**
 * `vlmkit snapshot storyboard <frames.json>` — what a frame sequence shows happening, measured.
 *
 * Reads a `vlmkit-frames/1` sequence (`check animation --frames`, `check integrity --timeline
 * --frames`, `inspect interact`'s `frames` steps) and writes, into `--out`:
 *
 *   story.json        the segmentation: states, events (glitch / transient / change / drift),
 *                     each with its frames, times and box (`@mizchi/vlmkit-judge/storyboard.ts`)
 *   SUMMARY.md        the same as a table; every cell is a measurement
 *   sheet.png         one row per event — its keyframes, each labelled with its time, the box
 *                     the table prints outlined and nothing else
 *   narrate/BRIEF.md  the keyframes and a magnified crop of each event's box, for the agent's own
 *                     vision to say what each change is; nothing reads its answer back
 *
 * An artifact command, not a gate: it reports what happened and passes no verdict, so it has no
 * findings and exits 0. A narrative gate stays off until a bench shows narration adds something the
 * table does not (the `diff region` precedent: a VLM's account of a change was net-negative there).
 */
import { copyFileSync, existsSync, readFileSync } from "node:fs";
import { mkdir, readdir, unlink, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative, resolve } from "node:path";
import { PNG } from "pngjs";
import { isCliEntry } from "@mizchi/vlmkit-core/plugin/cli-entry.ts";
import { UsageError } from "@mizchi/vlmkit-core/cli-error.ts";
import {
  boxOnSheet,
  composeFilmstrip,
  filmstripLayout,
  scalePngData,
  strokeOutside,
} from "@mizchi/vlmkit-core/filmstrip.ts";
import { cropRegion, encodePng, type PngData } from "@mizchi/vlmkit-core/png-utils.ts";
import { BOLD, CYAN, DIM, GREEN, RESET, YELLOW } from "@mizchi/vlmkit-core/terminal-colors.ts";
import { formatInstant, parseFramesManifest, type FramesManifest } from "@mizchi/vlmkit-judge/frames.ts";
import {
  boxText,
  buildStoryboard,
  eventKeyframes,
  storyboardBrief,
  storyboardSummary,
  type BriefImage,
  type Box,
  type FramePixels,
  type Storyboard,
  type StoryEvent,
} from "@mizchi/vlmkit-judge/storyboard.ts";

function usage(): string {
  return [
    "Usage:",
    "  vlmkit snapshot storyboard <frames.json> [--out dir] [--ignore x,y,w,h ...] [--max-events N] [--json]",
    "",
    "Segments a vlmkit-frames/1 sequence into still states and events, from the pixels alone:",
    "  glitch     one frame off the state, then back",
    "  transient  more than one frame off, back within 5000 ms (whatever it held in between)",
    "  change     not back within 5000 ms; ends at the first 100 ms of identical frames (the next state)",
    "  drift      a change no frame-to-frame step of which moves a channel by more than 8 of 255",
    "",
    "Writes story.json, SUMMARY.md, sheet.png and narrate/BRIEF.md (keyframes and a magnified crop",
    "of each event's box, for your own vision to say what changed). Exits 0: it reports, it does not judge.",
    "",
    "Options:",
    "  --out <dir>          Where to write (default: storyboard/ beside frames.json)",
    "  --ignore <x,y,w,h>   A box, in the frames' pixels, no comparison looks at — a video, a clock the",
    "                       capture cannot hold. Repeatable",
    "  --max-events <n>     Events on the sheet and in the brief (default 20); SUMMARY.md has them all",
    "  --json               Print story.json to stdout",
    "",
    "The input must be lossless: frames vlmkit captured (two shots that agree), not a decoded video.",
    "",
    "Examples:",
    "  vlmkit check animation page.html --at 0..1s/1f --frames out/f",
    "  vlmkit snapshot storyboard out/f/frames.json",
    "  vlmkit snapshot storyboard out/f/frames.json --ignore 960,40,320,180 --out story",
  ].join("\n");
}

export interface StoryboardArgs {
  manifest: string;
  out?: string;
  ignore: Box[];
  maxEvents: number;
  json: boolean;
}

function parseBox(raw: string | undefined): Box {
  const parts = (raw ?? "").split(",").map((p) => p.trim());
  const nums = parts.map(Number);
  if (parts.length !== 4 || nums.some((n, i) => !Number.isInteger(n) || n < 0 || (i >= 2 && n < 1))) {
    throw new UsageError(
      `--ignore expects x,y,width,height in whole pixels (width and height at least 1), got "${raw ?? ""}"`,
    );
  }
  const [x, y, width, height] = nums as [number, number, number, number];
  return { x, y, width, height };
}

export function parseArgs(argv: string[]): StoryboardArgs {
  let manifest: string | undefined;
  let out: string | undefined;
  const ignore: Box[] = [];
  let maxEvents = 20;
  let json = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    switch (arg) {
      case "--out":
      case "--output":
        out = argv[++i];
        if (!out || out.startsWith("-")) throw new UsageError("--out expects a directory");
        break;
      case "--ignore":
        ignore.push(parseBox(argv[++i]));
        break;
      case "--max-events": {
        const raw = argv[++i];
        maxEvents = Number(raw);
        if (!Number.isInteger(maxEvents) || maxEvents < 1) {
          throw new UsageError(`--max-events expects a whole number >= 1, got "${raw ?? ""}"`);
        }
        break;
      }
      case "--json":
        json = true;
        break;
      case "-h":
      case "--help":
        console.log(usage());
        process.exit(0);
      // falls through — unreachable, `process.exit` above
      default:
        if (arg.startsWith("-")) throw new UsageError(`unknown option ${arg}`);
        if (manifest !== undefined) throw new UsageError(`one frames.json at a time, got ${manifest} and ${arg}`);
        manifest = arg;
    }
  }
  if (manifest === undefined) throw new UsageError(`no frames.json given.\n\n${usage()}`);
  return { manifest, ...(out !== undefined ? { out } : {}), ignore, maxEvents, json };
}

/** pngjs's sync reader, because the segmentation reads frames from inside a pure, synchronous loop. */
function decode(path: string): PngData {
  const png = PNG.sync.read(readFileSync(path));
  return {
    width: png.width,
    height: png.height,
    data: new Uint8Array(png.data.buffer, png.data.byteOffset, png.data.length),
  };
}

/**
 * The frames, decoded on demand and kept in a cache bounded by bytes. The segmentation reads them
 * in order and goes back at most `TRANSIENT_MS` after a change, so a few dozen decoded frames
 * serve a sequence of a thousand; holding every frame of a 1000-frame 2x capture would be 15 GB.
 */
export function framesOnDisk(
  paths: readonly string[],
  budgetBytes = 512 * 1024 * 1024,
): FramePixels & { decoded: () => number } {
  if (paths.length === 0) throw new UsageError("the manifest lists no frames");
  const read = (i: number): PngData => {
    const path = paths[i]!;
    if (!existsSync(path)) throw new UsageError(`frame ${i} not found: ${path}`);
    return decode(path);
  };
  const first = read(0);
  const { width, height } = first;
  const capacity = Math.max(8, Math.floor(budgetBytes / (width * height * 4)));
  const cache = new Map<number, Uint8Array>([[0, first.data]]);
  let decoded = 1;
  return {
    width,
    height,
    decoded: () => decoded,
    pixels(i: number): Uint8Array {
      const hit = cache.get(i);
      if (hit) {
        cache.delete(i);
        cache.set(i, hit);
        return hit;
      }
      const frame = read(i);
      decoded++;
      if (frame.width !== width || frame.height !== height) {
        throw new UsageError(
          `frame ${i} (${basename(paths[i]!)}) is ${frame.width}x${frame.height}, frame 0 is ${width}x${height}: a storyboard compares pixels, so every frame must be one size`,
        );
      }
      cache.set(i, frame.data);
      if (cache.size > capacity) cache.delete(cache.keys().next().value!);
      return frame.data;
    },
  };
}

const MAGENTA = [255, 0, 255] as const;
const COLUMNS = 5;

/** The event's box with a margin, inside the frame. */
function cropBox(box: Box, width: number, height: number): Box {
  const margin = Math.max(8, Math.round(Math.max(box.width, box.height) / 4));
  const x = Math.max(0, box.x - margin);
  const y = Math.max(0, box.y - margin);
  return {
    x,
    y,
    width: Math.min(width, box.x + box.width + margin) - x,
    height: Math.min(height, box.y + box.height + margin) - y,
  };
}

/** Nearest-neighbour magnification by a whole factor: each source pixel a `zoom` x `zoom` block. */
function magnify(src: PngData, zoom: number): PngData {
  if (zoom === 1) return src;
  const width = src.width * zoom;
  const height = src.height * zoom;
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    const sy = Math.floor(y / zoom);
    for (let x = 0; x < width; x++) {
      const si = (sy * src.width + Math.floor(x / zoom)) * 4;
      data.set(src.data.subarray(si, si + 4), (y * width + x) * 4);
    }
  }
  return { width, height, data };
}

/** Enough magnification that a small box reads (its long side ~512px), never more than 8x. */
const zoomFor = (box: Box): number => Math.max(1, Math.min(8, Math.floor(512 / Math.max(box.width, box.height))));

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function rowLabel(e: StoryEvent): string {
  return `${e.id} ${e.kind} ${e.from}>${e.to ?? "?"} ${plural(e.frames, "frame")} box ${boxText(e.box)}`;
}

const cellLabel = (roles: readonly string[], atMs: number) => `${roles.join("+")} ${formatInstant(atMs)}ms`;

/** Files this command writes, so a re-run replaces them and nothing else in the directory. */
const OWN_NARRATE_FILE = /^E\d+-\d+-[a-z+]+(-crop)?\.png$/;

async function clearPrevious(outDir: string): Promise<void> {
  for (const name of ["story.json", "SUMMARY.md", "sheet.png"]) {
    if (existsSync(join(outDir, name))) await unlink(join(outDir, name));
  }
  const narrate = join(outDir, "narrate");
  if (!existsSync(narrate)) return;
  for (const name of await readdir(narrate)) {
    if (name === "BRIEF.md" || OWN_NARRATE_FILE.test(name)) await unlink(join(narrate, name));
  }
}

export interface StoryboardWritten {
  story: Storyboard;
  manifest: FramesManifest;
  outDir: string;
  files: { story: string; summary: string; sheet: string; brief: string };
  /** The story.json object: the storyboard, its source, and each event's keyframes with their files. */
  json: Record<string, unknown>;
  shown: number;
}

/** Segment `manifestPath`'s sequence and write the four outputs. */
export async function writeStoryboard(
  manifestPath: string,
  options: { out?: string; ignore?: Box[]; maxEvents?: number } = {},
): Promise<StoryboardWritten> {
  const manifestFile = resolve(manifestPath);
  if (!existsSync(manifestFile)) throw new UsageError(`no such frames.json: ${manifestPath}`);
  const manifest = parseFramesManifest(readFileSync(manifestFile, "utf8"));
  const dir = dirname(manifestFile);
  const paths = manifest.frames.map((f) => resolve(dir, f.file));
  const pixels = framesOnDisk(paths);
  const story = buildStoryboard(manifest.frames, pixels, { ignore: options.ignore ?? [] });
  const outDir = resolve(options.out ?? join(dir, "storyboard"));
  await mkdir(join(outDir, "narrate"), { recursive: true });
  await clearPrevious(outDir);

  const maxEvents = options.maxEvents ?? 20;
  const shown = story.events.slice(0, maxEvents);
  const frameSize = { width: pixels.width, height: pixels.height };

  // story.json: the source first, so a reader knows what the times are times of.
  const json = {
    format: story.format,
    manifest: relative(outDir, manifestFile).split("\\").join("/"),
    source: manifest.source,
    frames: story.frames,
    rules: story.rules,
    states: story.states.map((s) => ({ ...s, file: manifest.frames[s.frame.n]!.file })),
    events: story.events.map((e) => ({
      ...e,
      keyframes: eventKeyframes(e).map((k) => ({ roles: k.roles, ...k.frame, file: manifest.frames[k.frame.n]!.file })),
    })),
    timeline: story.timeline,
  };
  const files = {
    story: join(outDir, "story.json"),
    summary: join(outDir, "SUMMARY.md"),
    sheet: join(outDir, "sheet.png"),
    brief: join(outDir, "narrate", "BRIEF.md"),
  };
  await writeFile(files.story, `${JSON.stringify(json, null, 2)}\n`);
  await writeFile(files.summary, storyboardSummary(story, manifest.source, manifest.frames));

  // The sheet. Each row is one event's keyframes; with none, the first and last frame. The layout
  // is solved on the frames' sizes alone, and each cell is decoded and shrunk to its cell before
  // the next is read, so the sheet never holds full-size frames for all its cells at once.
  type Cell = { n: number; label: string; box?: Box };
  const rows: { label: string; cells: Cell[] }[] =
    shown.length > 0
      ? shown.map((e) => ({
          label: rowLabel(e),
          cells: eventKeyframes(e).map((k) => ({ n: k.frame.n, label: cellLabel(k.roles, k.frame.atMs), box: e.box })),
        }))
      : [
          {
            label: `no event: ${story.states[0]!.id} throughout`,
            cells: [...new Set([0, story.frames.count - 1])].map((n, i) => ({
              n,
              label: cellLabel([i === 0 ? "first" : "last"], manifest.frames[n]!.atMs),
            })),
          },
        ];
  // As wide as the widest row: at most five keyframes (before, first, peak, last, back).
  const columns = Math.min(COLUMNS, Math.max(...rows.map((r) => r.cells.length)));
  const slots = rows.flatMap((r) => [...r.cells, ...Array.from({ length: columns - r.cells.length }, () => null)]);
  const sizeOnly = slots.map(() => ({ ...frameSize, data: new Uint8Array(0) }));
  const layoutOptions = {
    columns,
    maxWidth: 1600,
    rowLabels: rows.map((r) => r.label),
    cellLabels: slots.map((c) => c?.label ?? ""),
  };
  const virtual = filmstripLayout(sizeOnly, layoutOptions);
  const blank = (() => {
    const w = Math.max(1, Math.round(frameSize.width / virtual.scale));
    const h = Math.max(1, Math.round(frameSize.height / virtual.scale));
    return { width: w, height: h, data: new Uint8Array(w * h * 4) };
  })();
  const cells = slots.map((c) =>
    c === null ? blank : scalePngData({ ...frameSize, data: pixels.pixels(c.n) }, virtual.scale),
  );
  const sheet = composeFilmstrip(cells, { ...layoutOptions, maxWidth: 0 });
  slots.forEach((c, i) => {
    if (!c?.box) return;
    const cell = { ...virtual.positions[i]!, ...virtual.cell };
    strokeOutside(sheet, boxOnSheet(virtual, i, frameSize, c.box), MAGENTA, 2, cell);
  });
  await encodePng(files.sheet, sheet);

  // The brief: each keyframe as the capture wrote it, and the event's box cut from it, magnified.
  const images = new Map<string, BriefImage[]>();
  for (const e of shown) {
    const crop = cropBox(e.box, frameSize.width, frameSize.height);
    const zoom = zoomFor(crop);
    const list: BriefImage[] = [];
    for (const [i, k] of eventKeyframes(e).entries()) {
      const stem = `${e.id}-${i + 1}-${k.roles.join("+")}`;
      copyFileSync(paths[k.frame.n]!, join(outDir, "narrate", `${stem}.png`));
      const cut = cropRegion({ ...frameSize, data: pixels.pixels(k.frame.n) }, crop.x, crop.y, crop.width, crop.height);
      await encodePng(join(outDir, "narrate", `${stem}-crop.png`), magnify(cut, zoom));
      list.push({
        file: `${stem}.png`,
        roles: k.roles,
        atMs: k.frame.atMs,
        crop: { file: `${stem}-crop.png`, zoom, box: crop },
      });
    }
    images.set(e.id, list);
  }
  await writeFile(files.brief, storyboardBrief(story, images, shown.length));

  return { story, manifest, outDir, files, json, shown: shown.length };
}

function eventLine(e: StoryEvent): string {
  const at = formatInstant(e.first.atMs);
  if (e.back && e.last) {
    return e.kind === "glitch"
      ? `${e.id} glitch at ${at}ms`
      : `${e.id} transient ${at}–${formatInstant(e.last.atMs)}ms`;
  }
  if (e.settled)
    return `${e.id} ${e.kind} ${e.from} → ${e.to} from ${at}ms, settled ${formatInstant(e.settled.atMs)}ms`;
  return `${e.id} ${e.kind} from ${at}ms, still moving at the last frame`;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const written = await writeStoryboard(args.manifest, {
    ...(args.out !== undefined ? { out: args.out } : {}),
    ignore: args.ignore,
    maxEvents: args.maxEvents,
  });
  if (args.json) {
    console.log(JSON.stringify(written.json, null, 2));
    return;
  }
  const { story } = written;
  const f = story.frames;
  console.log();
  console.log(`${BOLD}${CYAN}Storyboard${RESET}`);
  console.log(
    `  ${DIM}${plural(f.count, "frame")} of ${f.width}x${f.height} px, ${formatInstant(f.fromMs)}–${formatInstant(f.toMs)} ms${f.sampling.everyFrame ? ", every 60 fps frame" : ""}${RESET}`,
  );
  if (story.events.length === 0) {
    console.log(`  No events: every frame is within the floor of frame 0.`);
  } else {
    console.log(`  ${plural(story.events.length, "event")}, ${plural(story.states.length, "state")}:`);
    for (const e of story.events) console.log(`    ${eventLine(e)}`);
  }
  if (f.unstable.length > 0) {
    console.log(
      `  ${YELLOW}${plural(f.unstable.length, "frame")} never captured the same twice (see SUMMARY.md).${RESET}`,
    );
  }
  if (written.shown < story.events.length) {
    console.log(
      `  ${YELLOW}The sheet and the brief show the first ${written.shown} of ${story.events.length} events (--max-events).${RESET}`,
    );
  }
  const rel = (p: string) => {
    const r = relative(process.cwd(), p);
    return r === "" ? "." : r.startsWith("..") ? p : r;
  };
  console.log(
    `  ${GREEN}${rel(written.files.summary)}${RESET} ${DIM}· ${rel(written.files.story)} · ${rel(written.files.sheet)}${RESET}`,
  );
  console.log(
    `  ${DIM}${rel(written.files.brief)}: the keyframes, for your own vision to say what each change is.${RESET}`,
  );
  console.log();
}

if (isCliEntry(import.meta.url, "storyboard-cli")) {
  const { handleCliError } = await import("@mizchi/vlmkit-core/cli-error.ts");
  main().catch(handleCliError);
}

export { usage };
