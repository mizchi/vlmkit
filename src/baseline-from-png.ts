/**
 * File → route/viewport resolution for `vlmkit baseline pin|verify
 * --from-png / --from-dir` (issue #118 item 3).
 *
 * WHY this exists: `diff-pr` establishes route identity by rendering
 * `route.url` in Playwright. A canvas/WebGPU engine reported that path is
 * unusable for them — on Linux/Dawn `copyTextureToBuffer` + `mapAsync` never
 * settle, so `page.screenshot()` returns a transparent canvas — while their
 * native renderer already writes correct frames to PNG. They are in the state
 * "the PNGs exist but there is no URL to open". `vlmkit diff png` compares two
 * such files, but that is a one-shot: it has no per-route thresholds, no
 * markdown summary, and no approval manifest. These flags let a PNG take the
 * place the browser render would have taken, so the rest of the gate applies
 * unchanged.
 *
 * ## The mapping rule (derived, not invented)
 *
 * Route identity in this codebase is `route.name` — either the explicit
 * `name` field or `routeNameFromUrl()` of the URL — and a pinned baseline
 * lives at `<baselineDir>/<route.name>/<viewport>.png` (see
 * `baselineDirForRoute` in diff-pr.ts). Viewport identity is the label
 * (`mobile` / `desktop` / `wide`). So a supplied file is mapped by matching
 * its path against the *declared* route × viewport cross-product, in one of
 * three spellings:
 *
 *   1. `<route>/<viewport>.png`  — canonical; byte-identical to the pinned
 *      layout, so `--from-dir <baselineDir>` round-trips.
 *   2. `<route>-<viewport>.png`  — flat; the separator `snapshot.ts` already
 *      uses (`${label}-${vp.label}-baseline.png`).
 *   3. `<route>.png`             — only when the config declares exactly ONE
 *      viewport, because otherwise the viewport is unknowable.
 *
 * Matching is against the declared set rather than by splitting on the
 * separator, which is what makes form 2 safe: route names may themselves
 * contain `-` (`form-app`), so `"form-app-mobile".split("-")` is ambiguous
 * while `"form-app-mobile" === \`${route.name}-${vp}\`` is not. A stem that
 * two declared pairs both claim is reported as ambiguous rather than guessed.
 *
 * Anything the declared set does not claim is an **error naming both sides** —
 * never a silent partial run. Same for a declared pair with no file. A
 * renderer that emits `frame_0001.png` must either rename to one of the three
 * forms or use the single-file `--from-png … --route … --viewport …` escape
 * hatch; there is deliberately no sidecar manifest (one more format to
 * document and version for a case renaming already covers).
 */

import { existsSync, statSync } from "node:fs";
import { copyFile, mkdir, open, readdir, rm } from "node:fs/promises";
import { basename, dirname, extname, isAbsolute, join, resolve } from "node:path";
import type { DiffPrRoute } from "./diff-pr-config.ts";

export interface PngSource {
  route: DiffPrRoute;
  viewport: string;
  /** Absolute path of the file the caller supplied. */
  file: string;
  /** How the file was matched — surfaced in CLI output so the rule is visible. */
  matchedAs: "nested" | "flat" | "bare" | "explicit";
}

export interface ResolvePngSourcesOptions {
  /** Target routes (already narrowed by any positional route names). */
  routes: DiffPrRoute[];
  /** Declared viewport labels, in declaration order. */
  viewports: string[];
  /** `--from-dir` (mutually exclusive with fromPng). */
  fromDir?: string;
  /** `--from-png` (mutually exclusive with fromDir). */
  fromPng?: string;
  /** `--route` — explicit route name, only meaningful with `--from-png`. */
  routeOverride?: string;
  /** `--viewport` — explicit viewport label, only meaningful with `--from-png`. */
  viewportOverride?: string;
  /** Resolve relative paths against this directory. */
  cwd: string;
  /**
   * Require every target route × viewport pair to be supplied. True for
   * `--from-dir` (a dir claims to be the whole capture set, so a hole in it
   * is a mistake); false for `--from-png` (one file is one pair by
   * construction).
   */
  requireFullCoverage: boolean;
}

/** Directory names skipped while walking `--from-dir`. */
const IGNORED_DIRS = new Set([
  // `baseline update` archives superseded PNGs here. Pointing --from-dir at a
  // baselineDir must not re-pin the history.
  "_history",
  "node_modules",
]);

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * Throw unless `file` actually starts with the PNG signature. Checked before
 * anything is copied: a `.png` that is really a JPEG (or a half-written frame)
 * would otherwise surface much later as a pixelmatch decode error, with the
 * baseline already overwritten. Reads 8 bytes, not the frame.
 */
export async function assertPng(file: string): Promise<void> {
  const handle = await open(file, "r");
  try {
    const head = Buffer.alloc(8);
    const { bytesRead } = await handle.read(head, 0, 8, 0);
    if (bytesRead < 8 || !head.equals(PNG_MAGIC)) {
      throw new Error(
        `${file} is not a PNG (bad signature). ` +
        `--from-png / --from-dir compare pixels, so the file must be a real PNG.`,
      );
    }
  } finally {
    await handle.close();
  }
}

interface PairKeyEntry {
  route: DiffPrRoute;
  viewport: string;
  matchedAs: PngSource["matchedAs"];
}

/**
 * Build the lookup from a path key (extension-stripped, `/`-joined) to the
 * declared route/viewport pair it names. Keys claimed by more than one pair
 * are dropped from the map and remembered as ambiguous, so a file hitting one
 * gets an explicit error instead of an arbitrary winner.
 */
function buildKeyIndex(
  routes: DiffPrRoute[],
  viewports: string[],
): { index: Map<string, PairKeyEntry>; ambiguous: Set<string> } {
  const index = new Map<string, PairKeyEntry>();
  const ambiguous = new Set<string>();
  const add = (key: string, entry: PairKeyEntry) => {
    const prior = index.get(key);
    if (prior && (prior.route.name !== entry.route.name || prior.viewport !== entry.viewport)) {
      ambiguous.add(key);
      return;
    }
    if (!prior) index.set(key, entry);
  };
  for (const route of routes) {
    for (const viewport of viewports) {
      add(`${route.name}/${viewport}`, { route, viewport, matchedAs: "nested" });
      add(`${route.name}-${viewport}`, { route, viewport, matchedAs: "flat" });
    }
    // Bare `<route>.png` is only decidable with a single declared viewport.
    if (viewports.length === 1) {
      add(route.name, { route, viewport: viewports[0], matchedAs: "bare" });
    }
  }
  for (const key of ambiguous) index.delete(key);
  return { index, ambiguous };
}

function stripPngExt(p: string): string {
  return extname(p).toLowerCase() === ".png" ? p.slice(0, -4) : p;
}

/** Collect PNGs under `dir`, keyed by their path relative to `dir`. */
async function collectDirPngs(dir: string): Promise<Array<{ key: string; file: string; depth: number }>> {
  const out: Array<{ key: string; file: string; depth: number }> = [];
  const walk = async (current: string, prefix: string, depth: number): Promise<void> => {
    const entries = await readdir(current, { withFileTypes: true });
    for (const e of entries) {
      if (e.isDirectory()) {
        if (IGNORED_DIRS.has(e.name)) continue;
        await walk(join(current, e.name), prefix ? `${prefix}/${e.name}` : e.name, depth + 1);
        continue;
      }
      if (!e.isFile()) continue;
      if (extname(e.name).toLowerCase() !== ".png") continue;
      const rel = prefix ? `${prefix}/${e.name}` : e.name;
      out.push({ key: stripPngExt(rel), file: join(current, e.name), depth });
    }
  };
  await walk(dir, "", 0);
  out.sort((a, b) => a.key.localeCompare(b.key));
  return out;
}

function declaredSidesMessage(routes: DiffPrRoute[], viewports: string[]): string {
  const forms = viewports.length === 1
    ? `<route>/<viewport>.png, <route>-<viewport>.png, or <route>.png`
    : `<route>/<viewport>.png or <route>-<viewport>.png`;
  return [
    `  declared routes:    ${routes.map((r) => r.name).join(", ")}`,
    `  declared viewports: ${viewports.join(", ")}`,
    `  accepted filenames: ${forms}`,
  ].join("\n");
}

/**
 * Map supplied PNG files onto declared route/viewport pairs.
 *
 * Throws (with both sides named) on: a file no declared pair claims, two files
 * claiming the same pair, an ambiguous stem, an unknown `--route`/`--viewport`
 * override, a missing file, or — under `requireFullCoverage` — a declared pair
 * with no file.
 */
export async function resolvePngSources(opts: ResolvePngSourcesOptions): Promise<PngSource[]> {
  const { routes, viewports } = opts;
  if (routes.length === 0) throw new Error("no routes to pin");
  if (viewports.length === 0) throw new Error("config declares no viewports");
  if (opts.fromDir && opts.fromPng) {
    throw new Error("--from-dir and --from-png are mutually exclusive");
  }
  if (!opts.fromDir && !opts.fromPng) throw new Error("neither --from-dir nor --from-png given");

  const { index, ambiguous } = buildKeyIndex(routes, viewports);
  const sources: PngSource[] = [];
  const claimed = new Map<string, PngSource>();

  const claim = (entry: PairKeyEntry, file: string, matchedAs: PngSource["matchedAs"]) => {
    const pair = `${entry.route.name}/${entry.viewport}`;
    const prior = claimed.get(pair);
    if (prior) {
      throw new Error(
        `two files both map to route \`${entry.route.name}\` viewport \`${entry.viewport}\`:\n` +
        `  ${prior.file}\n  ${file}\n` +
        `Remove or rename one — a pair must have exactly one source.`,
      );
    }
    const src: PngSource = { route: entry.route, viewport: entry.viewport, file, matchedAs };
    claimed.set(pair, src);
    sources.push(src);
  };

  if (opts.fromPng) {
    const file = isAbsolute(opts.fromPng) ? opts.fromPng : resolve(opts.cwd, opts.fromPng);
    if (!existsSync(file)) {
      throw new Error(`--from-png file not found: ${file}`);
    }
    if (!statSync(file).isFile()) {
      throw new Error(`--from-png expects a file, got a directory: ${file} (use --from-dir)`);
    }
    await assertPng(file);

    if (opts.routeOverride || opts.viewportOverride) {
      // Explicit form. Both halves are required: a renderer's `frame_0001.png`
      // carries neither, and guessing one of the two is worse than asking.
      if (!opts.routeOverride || !opts.viewportOverride) {
        throw new Error(
          `--route and --viewport must be given together with --from-png ` +
          `(got ${opts.routeOverride ? "--route only" : "--viewport only"}).`,
        );
      }
      const route = routes.find((r) => r.name === opts.routeOverride);
      if (!route) {
        throw new Error(
          `--route ${opts.routeOverride} is not a declared route.\n` +
          declaredSidesMessage(routes, viewports),
        );
      }
      if (!viewports.includes(opts.viewportOverride)) {
        throw new Error(
          `--viewport ${opts.viewportOverride} is not a declared viewport.\n` +
          declaredSidesMessage(routes, viewports),
        );
      }
      claim({ route, viewport: opts.viewportOverride, matchedAs: "explicit" }, file, "explicit");
    } else {
      // Infer from the path: try `<parent>/<stem>` (nested form) before the
      // bare stem, so `captures/home/desktop.png` resolves the same way it
      // would inside a --from-dir walk.
      const stem = stripPngExt(basename(file));
      const parent = basename(dirname(file));
      const nestedKey = `${parent}/${stem}`;
      const hit = index.get(nestedKey) ?? index.get(stem);
      if (!hit) {
        const amb = ambiguous.has(nestedKey) || ambiguous.has(stem);
        throw new Error(
          `${file} maps to no declared route/viewport pair` +
          (amb ? ` (its name is claimed by more than one pair)` : "") + `.\n` +
          declaredSidesMessage(routes, viewports) +
          `\nOr name the pair explicitly: --from-png ${opts.fromPng} --route <route> --viewport <viewport>`,
        );
      }
      claim(hit, file, hit.matchedAs);
    }
  } else {
    const dir = isAbsolute(opts.fromDir!) ? opts.fromDir! : resolve(opts.cwd, opts.fromDir!);
    if (!existsSync(dir)) throw new Error(`--from-dir not found: ${dir}`);
    if (!statSync(dir).isDirectory()) {
      throw new Error(`--from-dir expects a directory, got a file: ${dir} (use --from-png)`);
    }
    const found = await collectDirPngs(dir);
    if (found.length === 0) {
      throw new Error(
        `--from-dir ${dir} contains no .png files.\n` + declaredSidesMessage(routes, viewports),
      );
    }
    const unmapped: string[] = [];
    for (const f of found) {
      const hit = index.get(f.key);
      if (!hit) {
        unmapped.push(f.key + ".png" + (ambiguous.has(f.key) ? " (ambiguous — claimed by 2+ pairs)" : ""));
        continue;
      }
      await assertPng(f.file);
      claim(hit, f.file, hit.matchedAs);
    }
    if (unmapped.length > 0) {
      throw new Error(
        `${unmapped.length} file(s) in ${dir} map to no declared route/viewport pair:\n` +
        unmapped.map((u) => `  ${u}`).join("\n") + "\n" +
        declaredSidesMessage(routes, viewports),
      );
    }
  }

  if (opts.requireFullCoverage) {
    const missing: string[] = [];
    for (const route of routes) {
      for (const viewport of viewports) {
        if (!claimed.has(`${route.name}/${viewport}`)) missing.push(`${route.name}/${viewport}`);
      }
    }
    if (missing.length > 0) {
      throw new Error(
        `no PNG supplied for ${missing.length} declared route/viewport pair(s):\n` +
        missing.map((m) => `  ${m}  (expected ${m}.png or ${m.replace("/", "-")}.png)`).join("\n") + "\n" +
        `supplied: ${sources.map((s) => `${s.route.name}/${s.viewport}`).join(", ") || "(none)"}\n` +
        `Supply every pair, or narrow the run with positional route name(s).`,
      );
    }
  }

  return sources;
}

/**
 * Drop a route's pinned PNGs while leaving everything else in the dir alone.
 *
 * `pin` clears a route's baselines before writing so a viewport dropped from
 * the config does not leave a stale PNG behind. It used to do that with
 * `rm -r <routeDir>`, which also deleted `_history/` — the archive
 * `baseline update` writes one step earlier to make a golden refresh
 * reversible. Verified against the built CLI: `baseline update` archived
 * 1 PNG per route to `_history/<ts>/` and the subsequent re-pin left
 * `baselines/` with only the two new PNGs. Deleting just the top-level `.png`
 * files keeps the stale-viewport guarantee and the archive.
 */
export async function clearRouteBaselinePngs(routeDir: string): Promise<void> {
  if (!existsSync(routeDir)) return;
  for (const entry of await readdir(routeDir, { withFileTypes: true })) {
    if (entry.isFile() && extname(entry.name).toLowerCase() === ".png") {
      await rm(join(routeDir, entry.name));
    }
  }
}

/**
 * Copy resolved sources into `<baselineRoot>/<route>/<viewport>.png`.
 *
 * `wipeRouteDirs` mirrors `diff-pr pin`. It is on for `--from-dir` (full
 * coverage was just enforced, so nothing is lost) and off for `--from-png`,
 * where wiping would delete the sibling viewports the single file says
 * nothing about.
 */
export async function pinPngSources(
  baselineRoot: string,
  sources: PngSource[],
  opts: { wipeRouteDirs: boolean },
): Promise<string[]> {
  const written: string[] = [];
  if (opts.wipeRouteDirs) {
    for (const name of new Set(sources.map((s) => s.route.name))) {
      await clearRouteBaselinePngs(join(baselineRoot, name));
    }
  }
  for (const s of sources) {
    const dir = join(baselineRoot, s.route.name);
    await mkdir(dir, { recursive: true });
    const dest = join(dir, `${s.viewport}.png`);
    await copyFile(s.file, dest);
    written.push(dest);
  }
  return written;
}
