#!/usr/bin/env node
/**
 * The judgment log: how a demo site was judged, recorded while it was being judged.
 *
 *   node examples/sites/judge.mjs <site-dir> <command> [...]
 *
 * A page an agent builds comes with two kinds of evidence, and the intro page kept only one of
 * them. Gate output is easy to keep and easy to trust. What the builder SAW is neither: the intro
 * page's visual findings survive as sentences in commit messages, with no picture of what was
 * looked at, so a reader cannot tell a look from a guess. This file makes both first-class:
 *
 * - `gate` runs a vlmkit gate in the site directory and keeps its exit code and its whole output,
 *   verbatim. A paraphrase of a gate is a claim; the output is the evidence.
 * - `shot` takes screenshots one screen per image, at native resolution — a whole page at 1280px
 *   squeezed into one image is too small to read, for a model or a person — and `look` records
 *   what was seen in them. A look names its shot, so a reader can open the same picture and
 *   disagree with it.
 * - `defect` must say where it came from, a look or a gate run. That is what lets a log answer
 *   "how many of these did only the eye find", which is the question the intro page cannot.
 *
 * `check` is the log's own done condition. `render` writes `judgment/index.html` (published next
 * to the site) and `JUDGMENT.md` (for reading in the repository) from `judgment/log.jsonl`, and
 * is deterministic, so a test can hold the committed renders to the log.
 *
 * The log is append-only and written only by this file. Editing it by hand defeats the point.
 */
import { spawn } from "node:child_process";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
/** The CLI a `gate` runs. Overridable so the tests can stand a stub in for a real browser run. */
const VLMKIT = () => process.env.JUDGE_VLMKIT ?? join(REPO, "dist", "vlmkit.mjs");

/** The three widths `check integrity` measures by default, so a look and a gate see one page. */
export const VIEWPORTS = Object.freeze({
  desktop: Object.freeze({ width: 1280, height: 800 }),
  tablet: Object.freeze({ width: 768, height: 1024 }),
  mobile: Object.freeze({ width: 375, height: 812 }),
});
export const ACTORS = Object.freeze(["builder", "reviewer"]);
/**
 * Why something stays as it is. `accepted`: real, and left on purpose. `false-positive`: the gate
 * was wrong about this page (say how you know). `superseded`: a later run replaced this command.
 * `decision` and `tool` are free notes — a choice made, or a problem with the tooling itself.
 */
export const NOTE_KINDS = Object.freeze(["decision", "false-positive", "accepted", "superseded", "tool"]);
const CLOSING_KINDS = new Set(["accepted", "false-positive", "superseded"]);
/** Gate commands take `--ledger`, which is how `gate` gets a structured headline for free. */
const GATE_GROUPS = new Set(["check", "scan", "stress", "verify"]);
/** Shorter than this, a look cannot have said what was in the picture. */
export const MIN_LOOK_CHARS = 80;
const MAX_TILES = 16;
const JPEG_QUALITY = 78;
const PREFIX = Object.freeze({
  round: "R",
  gate: "G",
  shot: "S",
  look: "L",
  defect: "D",
  fix: "F",
  verify: "V",
  note: "N",
});

class JudgeError extends Error {}
const fail = (message) => {
  throw new JudgeError(message);
};

// ---------------------------------------------------------------------------------------------
// The log

export function logPaths(siteDir) {
  const dir = join(siteDir, "judgment");
  return {
    dir,
    log: join(dir, "log.jsonl"),
    gates: join(dir, "gates"),
    shots: join(dir, "shots"),
    html: join(dir, "index.html"),
    md: join(siteDir, "JUDGMENT.md"),
  };
}

export function readLog(siteDir) {
  const { log } = logPaths(siteDir);
  if (!existsSync(log)) return [];
  return readFileSync(log, "utf8")
    .split("\n")
    .filter((line) => line.trim())
    .map((line, i) => {
      try {
        return JSON.parse(line);
      } catch {
        throw new JudgeError(`judgment/log.jsonl line ${i + 1} is not JSON — was it edited by hand?`);
      }
    });
}

function append(siteDir, event) {
  appendFileSync(logPaths(siteDir).log, `${JSON.stringify(event)}\n`);
}

export function nextId(events, kind) {
  return `${PREFIX[kind]}${events.filter((e) => e.kind === kind).length + 1}`;
}

const byId = (events, id) => events.find((e) => e.id === id);

function currentRound(events) {
  const round = events.filter((e) => e.kind === "round").at(-1);
  if (!round) fail('start a round first: judge.mjs <site> round "first draft"');
  return round;
}

function stamp(events, kind, fields) {
  return { kind, id: nextId(events, kind), round: currentRound(events).id, t: new Date().toISOString(), ...fields };
}

/** Strip ANSI colour, keep only what a `\r` progress line finally showed, and drop this machine's path. */
export function clean(text) {
  return text
    .replace(/\x1b\[[0-9;?]*[A-Za-z]/g, "")
    .split("\n")
    .map((line) => line.split("\r").at(-1))
    .join("\n")
    .replaceAll(`${REPO}/`, "")
    .replaceAll(REPO, ".");
}

const shellQuote = (arg) => (/^[\w@%+=:,./-]+$/.test(arg) ? arg : `'${arg.replaceAll("'", "'\\''")}'`);

// ---------------------------------------------------------------------------------------------
// Arguments

/**
 * Split argv into flags and positionals. `values` flags take the next argument; everything else
 * starting with `--` is boolean. `-` alone is a positional (it means "read stdin").
 */
function parse(argv, { values = [], booleans = [] } = {}) {
  const flags = {};
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) {
      rest.push(arg);
      continue;
    }
    const name = arg.slice(2);
    if (values.includes(name)) {
      const value = argv[++i];
      if (value === undefined) fail(`--${name} needs a value`);
      flags[name] = value;
    } else if (booleans.includes(name)) {
      flags[name] = true;
    } else {
      fail(`unknown flag --${name}`);
    }
  }
  return { flags, rest };
}

/** Free text: the remaining arguments joined, or stdin when the only one is `-` (for a heredoc). */
function takeText(rest, what) {
  const text = rest.length === 1 && rest[0] === "-" ? readFileSync(0, "utf8") : rest.join(" ");
  const trimmed = text.trim();
  if (!trimmed) fail(`${what} needs text — as arguments, or \`-\` and a heredoc`);
  return trimmed;
}

// ---------------------------------------------------------------------------------------------
// Commands that only write the log

function cmdInit(siteDir, argv) {
  const { flags } = parse(argv, { values: ["title", "pattern", "brief"] });
  if (!flags.title) fail('init needs --title "…"');
  const events = readLog(siteDir);
  if (events.some((e) => e.kind === "init")) fail("this site's log is already initialised");
  const paths = logPaths(siteDir);
  mkdirSync(paths.gates, { recursive: true });
  mkdirSync(paths.shots, { recursive: true });
  let brief = null;
  if (flags.brief) {
    const file = resolve(flags.brief);
    if (!existsSync(file)) fail(`no brief at ${flags.brief}`);
    brief = relative(siteDir, file);
  }
  append(siteDir, {
    kind: "init",
    t: new Date().toISOString(),
    title: flags.title,
    pattern: flags.pattern ?? null,
    brief,
  });
  console.log(`[judge] log started: ${relative(process.cwd(), paths.log)}`);
}

function cmdRound(siteDir, argv) {
  const { flags, rest } = parse(argv, { values: ["actor"] });
  const events = readLog(siteDir);
  if (!events.some((e) => e.kind === "init")) fail("run init first");
  const previous = events.filter((e) => e.kind === "round").at(-1);
  const actor = flags.actor ?? previous?.actor ?? "builder";
  if (!ACTORS.includes(actor)) fail(`--actor must be one of ${ACTORS.join(", ")}`);
  const title = takeText(rest, "round");
  const event = { kind: "round", id: nextId(events, "round"), t: new Date().toISOString(), actor, title };
  append(siteDir, event);
  console.log(`[judge] ${event.id} (${actor}): ${title}`);
}

function parseShotRef(events, ref) {
  const m = /^(S\d+)(?::(\d+))?$/.exec(ref ?? "");
  if (!m) fail(`expected a shot id like S3 or S3:2 (tile 2), got ${JSON.stringify(ref)}`);
  const shot = byId(events, m[1]);
  if (!shot || shot.kind !== "shot") fail(`no shot ${m[1]} in this log`);
  const tile = m[2] === undefined ? null : Number(m[2]);
  if (tile !== null && (tile < 1 || tile > shot.tiles.length)) {
    fail(`${m[1]} has ${shot.tiles.length} tile(s); there is no tile ${tile}`);
  }
  return { shot, tile };
}

function cmdLook(siteDir, argv) {
  const { rest } = parse(argv);
  const events = readLog(siteDir);
  const { shot, tile } = parseShotRef(events, rest[0]);
  const text = takeText(rest.slice(1), "look");
  if (text.length < MIN_LOOK_CHARS) {
    fail(
      `a look is the evidence that the picture was read — say what is in it (layout, hierarchy, ` +
        `spacing, wrapping, colour, state, and anything off against the brief). ${text.length} ` +
        `characters is not that; write at least ${MIN_LOOK_CHARS}.`,
    );
  }
  const event = stamp(events, "look", { shot: shot.id, tile, text });
  append(siteDir, event);
  const covers = tile === null ? `all ${shot.tiles.length} tile(s)` : `tile ${tile}`;
  console.log(`[judge] ${event.id} recorded for ${shot.id} (${covers})`);
}

function cmdDefect(siteDir, argv) {
  const { flags, rest } = parse(argv, { values: ["from", "where"] });
  const events = readLog(siteDir);
  const source = byId(events, flags.from ?? "");
  if (!source || (source.kind !== "look" && source.kind !== "gate")) {
    fail(
      "a defect needs --from <L#|G#>: the look that saw it or the gate run that reported it. " +
        "If you noticed it some other way, take a shot of it and look first.",
    );
  }
  const text = takeText(rest, "defect");
  const event = stamp(events, "defect", {
    from: source.id,
    by: source.kind === "look" ? "eye" : "gate",
    where: flags.where ?? null,
    text,
  });
  append(siteDir, event);
  console.log(`[judge] ${event.id} (found by ${event.by}, ${source.id}): ${text.split("\n")[0]}`);
}

function requireDefect(events, id) {
  const defect = byId(events, id ?? "");
  if (!defect || defect.kind !== "defect") fail(`no defect ${JSON.stringify(id)} in this log`);
  return defect;
}

function cmdFix(siteDir, argv) {
  const { rest } = parse(argv);
  const events = readLog(siteDir);
  const defect = requireDefect(events, rest[0]);
  const text = takeText(rest.slice(1), "fix");
  const event = stamp(events, "fix", { defect: defect.id, text });
  append(siteDir, event);
  console.log(`[judge] ${event.id} fixes ${defect.id} — now re-shoot or re-run, and verify ${defect.id} --by <L#|G#>`);
}

function cmdVerify(siteDir, argv) {
  const { flags, rest } = parse(argv, { values: ["by"] });
  const events = readLog(siteDir);
  const defect = requireDefect(events, rest[0]);
  const lastFix = events.filter((e) => e.kind === "fix" && e.defect === defect.id).at(-1);
  if (!lastFix) fail(`${defect.id} has no fix to verify`);
  const evidence = byId(events, flags.by ?? "");
  if (!evidence || (evidence.kind !== "look" && evidence.kind !== "gate")) {
    fail("verify needs --by <L#|G#>: the look or gate run that shows the fix working");
  }
  if (events.indexOf(evidence) < events.indexOf(lastFix)) {
    fail(`${evidence.id} was recorded before ${lastFix.id} — evidence for a fix has to come after it`);
  }
  const text = rest.length > 1 ? takeText(rest.slice(1), "verify") : null;
  const event = stamp(events, "verify", { defect: defect.id, by: evidence.id, text });
  append(siteDir, event);
  console.log(`[judge] ${event.id}: ${defect.id} verified by ${evidence.id}`);
}

function cmdNote(siteDir, argv) {
  const { flags, rest } = parse(argv, { values: ["about", "kind"] });
  const events = readLog(siteDir);
  const noteKind = flags.kind ?? "decision";
  if (!NOTE_KINDS.includes(noteKind)) fail(`--kind must be one of ${NOTE_KINDS.join(", ")}`);
  if (flags.about && !byId(events, flags.about)) fail(`--about ${flags.about}: no such id in this log`);
  if (CLOSING_KINDS.has(noteKind) && !flags.about) fail(`a ${noteKind} note must say --about which gate run or defect`);
  const text = takeText(rest, "note");
  const event = stamp(events, "note", { about: flags.about ?? null, noteKind, text });
  append(siteDir, event);
  console.log(`[judge] ${event.id} (${noteKind}${event.about ? ` about ${event.about}` : ""})`);
}

// ---------------------------------------------------------------------------------------------
// gate

function run(command, args, cwd, timeoutMs) {
  return new Promise((resolvePromise) => {
    const child = spawn(command, args, { cwd, env: process.env, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout.on("data", (chunk) => (output += chunk));
    child.stderr.on("data", (chunk) => (output += chunk));
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      resolvePromise({ code: timedOut ? 124 : (code ?? (signal ? 128 : 1)), output, timedOut });
    });
  });
}

async function cmdGate(siteDir, args) {
  if (!args.length) fail("gate needs a vlmkit command, e.g. gate check integrity index.html");
  const events = readLog(siteDir);
  currentRound(events);
  const id = nextId(events, "gate");
  const scratch = mkdtempSync(join(tmpdir(), "judge-"));
  const ledger = join(scratch, "ledger.jsonl");
  const wantsLedger = GATE_GROUPS.has(args[0]) && !args.includes("--ledger") && !args.includes("--no-ledger");
  const timeoutMs = Number(process.env.JUDGE_GATE_TIMEOUT_MS ?? 15 * 60_000);
  const started = Date.now();
  const result = await run(
    process.execPath,
    [VLMKIT(), ...args, ...(wantsLedger ? ["--ledger", ledger] : [])],
    siteDir,
    timeoutMs,
  );
  const ms = Date.now() - started;
  let headline = [];
  if (existsSync(ledger)) {
    headline = readFileSync(ledger, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line))
      .map((entry) => ({ tool: entry.tool, ...entry.headline }));
  }
  rmSync(scratch, { recursive: true, force: true });

  const text = clean(result.output) + (result.timedOut ? `\n[judge] killed after ${timeoutMs}ms\n` : "");
  const output = `gates/${id}.txt`;
  writeFileSync(join(logPaths(siteDir).dir, output), text);
  const verdict = text.split("\n").map((line) => line.trim()).find((line) => /^verdict:/i.test(line)) ?? null;
  const event = stamp(events, "gate", {
    cmd: ["vlmkit", ...args].map(shellQuote).join(" "),
    exit: result.code,
    ms,
    verdict,
    headline,
    output,
  });
  append(siteDir, event);
  process.stdout.write(text.endsWith("\n") ? text : `${text}\n`);
  console.log(`[judge] ${id} recorded — exit ${result.code}, ${(ms / 1000).toFixed(1)}s → judgment/${output}`);
  return result.code;
}

// ---------------------------------------------------------------------------------------------
// shot

function parseViewport(spec) {
  if (VIEWPORTS[spec]) return { name: spec, ...VIEWPORTS[spec] };
  const m = /^(\d+)x(\d+)$/.exec(spec);
  if (!m) fail(`--viewport takes desktop, tablet, mobile or WxH, got ${JSON.stringify(spec)}`);
  return { name: spec, width: Number(m[1]), height: Number(m[2]) };
}

/**
 * Read `shot`'s arguments in order, because the steps before the shutter are a sequence: a
 * `--click` then a `--press Tab` is not the same page as the other way round.
 */
export function parseShotArgs(argv) {
  const options = {
    page: null,
    viewports: [],
    full: false,
    dark: false,
    reducedMotion: false,
    element: null,
    scrollEl: null,
    scale: 1,
    label: null,
    maxTiles: MAX_TILES,
    steps: [],
  };
  const take = (i, flag) => {
    const value = argv[i + 1];
    if (value === undefined) fail(`${flag} needs a value`);
    return value;
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--viewport":
        for (const spec of take(i, arg).split(",")) options.viewports.push(parseViewport(spec.trim()));
        i++;
        break;
      case "--full":
        options.full = true;
        break;
      case "--dark":
        options.dark = true;
        break;
      case "--reduced-motion":
        options.reducedMotion = true;
        break;
      case "--element":
        options.element = take(i, arg);
        i++;
        break;
      case "--scroll-el":
        options.scrollEl = take(i, arg);
        i++;
        break;
      case "--scale":
        options.scale = Number(take(i, arg));
        if (!(options.scale >= 1 && options.scale <= 3)) fail("--scale is 1, 2 or 3");
        i++;
        break;
      case "--label":
        options.label = take(i, arg);
        i++;
        break;
      case "--max-tiles":
        options.maxTiles = Number(take(i, arg));
        i++;
        break;
      case "--click":
      case "--hover":
      case "--focus":
      case "--press":
      case "--type":
      case "--scroll-to":
      case "--wait":
        options.steps.push({ do: arg.slice(2), arg: take(i, arg) });
        i++;
        break;
      case "--fill": {
        const selector = take(i, arg);
        const value = argv[i + 2];
        if (value === undefined) fail("--fill needs a selector and a value: --fill '#email' 'a@b.c'");
        options.steps.push({ do: "fill", arg: selector, value });
        i += 2;
        break;
      }
      default:
        if (arg.startsWith("--")) fail(`unknown shot flag ${arg}`);
        if (options.page) fail(`one page per shot — got ${options.page} and ${arg}`);
        options.page = arg;
    }
  }
  if (!options.page) fail("shot needs a page: a file in the site (index.html, index.html?theme=dark) or a URL");
  if (options.full && options.element) fail("--full and --element are different shots — take two");
  if (!options.viewports.length) options.viewports.push({ name: "desktop", ...VIEWPORTS.desktop });
  return options;
}

function pageUrl(siteDir, page) {
  if (/^(https?|file):/.test(page)) return page;
  const cut = page.search(/[?#]/);
  const path = cut < 0 ? page : page.slice(0, cut);
  const suffix = cut < 0 ? "" : page.slice(cut);
  const file = resolve(siteDir, path);
  if (!existsSync(file)) fail(`no file ${path} in ${relative(process.cwd(), siteDir) || "."}`);
  return pathToFileURL(file).href + suffix;
}

async function settle(page) {
  await page.evaluate(() => document.fonts?.ready).catch(() => {});
  await page.waitForTimeout(400);
}

async function doStep(page, step) {
  const timeout = 5000;
  const where = () => page.locator(step.arg).first();
  try {
    if (step.do === "click") await where().click({ timeout });
    else if (step.do === "hover") await where().hover({ timeout });
    else if (step.do === "focus") await where().focus({ timeout });
    else if (step.do === "scroll-to") await where().scrollIntoViewIfNeeded({ timeout });
    else if (step.do === "fill") await where().fill(step.value, { timeout });
    else if (step.do === "press") await page.keyboard.press(step.arg);
    else if (step.do === "type") await page.keyboard.type(step.arg);
    else if (step.do === "wait") await page.waitForTimeout(Number(step.arg));
  } catch (error) {
    fail(`--${step.do} ${step.arg}: ${String(error.message).split("\n")[0]}`);
  }
  await page.waitForTimeout(250);
}

/**
 * Where the next screen starts. A full viewport step would be right on a page with nothing pinned,
 * and wrong on almost every real one: a sticky header covers the top of every screen after the
 * first, so the strip of content that scrolled under it would never be in any picture. The step is
 * the viewport minus what is pinned to its top and bottom edges (`insets`), never under half a
 * screen, and the last screen sits flush with the end. `null` when this screen reached the end.
 */
export function nextOffset(y, total, view, insets = { top: 0, bottom: 0 }) {
  if (y + view >= total) return null;
  const step = Math.max(Math.round(view / 2), view - insets.top - insets.bottom);
  return Math.min(y + step, total - view);
}

/**
 * Heights pinned to the viewport's top and bottom edges right now: fixed or stuck elements at least
 * half the viewport wide (a header, a bottom tab bar, a cookie banner — not a floating button),
 * each capped at 40% of the screen so a full-screen overlay does not stall the walk.
 */
function measureInsets() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let top = 0;
  let bottom = 0;
  for (const el of document.querySelectorAll("body *")) {
    const position = getComputedStyle(el).position;
    if (position !== "fixed" && position !== "sticky") continue;
    const r = el.getBoundingClientRect();
    if (r.width < vw / 2 || r.height === 0 || r.bottom <= 0 || r.top >= vh) continue;
    if (r.top <= 1) top = Math.max(top, r.bottom);
    else if (r.bottom >= vh - 1) bottom = Math.max(bottom, vh - r.top);
  }
  return { top: Math.round(Math.min(top, vh * 0.4)), bottom: Math.round(Math.min(bottom, vh * 0.4)) };
}

async function capture(siteDir, id, url, viewport, options) {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  const tiles = [];
  const errors = [];
  let pageHeight = null;
  try {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: options.scale,
      colorScheme: options.dark ? "dark" : "light",
      reducedMotion: options.reducedMotion ? "reduce" : "no-preference",
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(String(error.message)));
    page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
    await page.goto(url, { waitUntil: "load" });
    await settle(page);
    for (const step of options.steps) await doStep(page, step);
    await settle(page);

    const file = (n) => `shots/${id}-${n}.jpg`;
    // `w` / `h` are CSS pixels, so a render can reserve each thumbnail's box before it loads.
    const shoot = async (target, n, extra = {}, size = viewport) => {
      await target.screenshot({ path: join(logPaths(siteDir).dir, file(n)), type: "jpeg", quality: JPEG_QUALITY });
      tiles.push({ file: file(n), w: Math.round(size.width), h: Math.round(size.height), ...extra });
    };
    if (options.element) {
      const element = page.locator(options.element).first();
      try {
        await element.scrollIntoViewIfNeeded({ timeout: 5000 });
      } catch {
        fail(`--element ${options.element}: nothing on the page matches`);
      }
      await page.waitForTimeout(200);
      const box = await element.boundingBox();
      if (!box) fail(`--element ${options.element}: it has no box (display: none?)`);
      await shoot(element, 1, {}, box);
    } else if (options.full) {
      const box = await page.evaluate((selector) => {
        const el = selector ? document.querySelector(selector) : document.scrollingElement;
        if (!el) return null;
        return { total: el.scrollHeight, view: selector ? el.clientHeight : window.innerHeight };
      }, options.scrollEl);
      if (!box) fail(`--scroll-el ${options.scrollEl}: nothing on the page matches`);
      pageHeight = box.total;
      for (let y = 0, n = 1; y !== null && n <= options.maxTiles; n++) {
        await page.evaluate(
          ([selector, top]) => {
            const el = selector ? document.querySelector(selector) : document.scrollingElement;
            el.scrollTo({ top, behavior: "instant" });
          },
          [options.scrollEl, y],
        );
        // Scroll-linked effects (a reveal, a scroll-spy, a sticky header's shadow) get a frame to land.
        await page.waitForTimeout(350);
        // Inside a scroll container the page's own pinned bars do not cover the container's content.
        const insets = options.scrollEl ? { top: 0, bottom: 0 } : await page.evaluate(measureInsets);
        await shoot(page, n, { scrollY: y, ...(insets.top || insets.bottom ? { insets } : {}) });
        y = nextOffset(y, box.total, box.view, insets);
      }
    } else {
      await shoot(page, 1);
    }
  } finally {
    await browser.close();
  }
  return { tiles, errors, pageHeight };
}

async function cmdShot(siteDir, argv) {
  const options = parseShotArgs(argv);
  const url = pageUrl(siteDir, options.page);
  for (const viewport of options.viewports) {
    const events = readLog(siteDir);
    currentRound(events);
    const id = nextId(events, "shot");
    const { tiles, errors, pageHeight } = await capture(siteDir, id, url, viewport, options);
    const mode = options.element ? "element" : options.full ? "full" : "viewport";
    const event = stamp(events, "shot", {
      page: options.page,
      viewport: { name: viewport.name, width: viewport.width, height: viewport.height },
      scale: options.scale,
      dark: options.dark,
      reducedMotion: options.reducedMotion,
      mode,
      element: options.element,
      scrollEl: options.scrollEl,
      steps: options.steps,
      label: options.label,
      pageHeight,
      tiles,
      errors,
    });
    append(siteDir, event);
    const state = [options.dark && "dark", options.reducedMotion && "reduced motion", ...options.steps.map(describeStep)]
      .filter(Boolean)
      .join(", ");
    const what = mode === "full" ? `full page, ${tiles.length} screen(s) of ${pageHeight}px` : mode;
    console.log(`[judge] ${id} — ${options.page} @ ${viewport.name} ${viewport.width}x${viewport.height}, ${what}${state ? ` (${state})` : ""}`);
    for (const tile of tiles) {
      const at = tile.scrollY === undefined ? "" : `  (scrollY ${tile.scrollY})`;
      console.log(`  ${join(logPaths(siteDir).dir, tile.file)}${at}`);
    }
    if (tiles.length === options.maxTiles && pageHeight > tiles.at(-1).scrollY + viewport.height) {
      console.log(`  ! stopped at ${options.maxTiles} screens; the page goes on — pass --max-tiles to see the rest`);
    }
    for (const error of errors) console.log(`  ! page error while shooting: ${error}`);
    console.log(`Read every file above, then: judge.mjs <site> look ${id} - <<'EOF' … what you saw … EOF`);
  }
}

export function describeStep(step) {
  return step.do === "fill" ? `fill ${step.arg} "${step.value}"` : `${step.do} ${step.arg}`;
}

// ---------------------------------------------------------------------------------------------
// check

/**
 * What a log needs before it can say the site is done. Every entry names the id to act on and the
 * command that closes it, because the reader of this list is the agent that has to fix it.
 */
export function checkLog(events) {
  const problems = [];
  if (!events.some((e) => e.kind === "init")) return ["the log was never initialised (init --title …)"];
  const rounds = events.filter((e) => e.kind === "round");
  if (!rounds.length) return ["no round yet (round \"first draft\")"];
  const notesAbout = (id) => events.filter((e) => e.kind === "note" && e.about === id);

  for (const shot of events.filter((e) => e.kind === "shot")) {
    const looks = events.filter((e) => e.kind === "look" && e.shot === shot.id);
    if (looks.some((look) => look.tile === null)) continue;
    const seen = new Set(looks.map((look) => look.tile));
    const missing = shot.tiles.map((_, i) => i + 1).filter((n) => !seen.has(n));
    if (missing.length === shot.tiles.length) {
      problems.push(`${shot.id} was never looked at — Read its file(s) and record: look ${shot.id} - <<'EOF' …`);
    } else if (missing.length) {
      problems.push(`${shot.id}: tile(s) ${missing.join(", ")} never looked at — look ${shot.id}:${missing[0]} …`);
    }
  }

  for (const defect of events.filter((e) => e.kind === "defect")) {
    const fixes = events.filter((e) => e.kind === "fix" && e.defect === defect.id);
    const closed = notesAbout(defect.id).some((note) => CLOSING_KINDS.has(note.noteKind));
    if (!fixes.length && !closed) {
      problems.push(`${defect.id} is open — fix ${defect.id} …, or say why it stays: note --about ${defect.id} --kind accepted …`);
      continue;
    }
    if (fixes.length) {
      const lastFix = fixes.at(-1);
      const verified = events.some(
        (e) => e.kind === "verify" && e.defect === defect.id && events.indexOf(e) > events.indexOf(lastFix),
      );
      if (!verified) problems.push(`${defect.id} was fixed (${lastFix.id}) and nothing checked it since — verify ${defect.id} --by <L#|G#>`);
    }
  }

  const last = rounds.at(-1);
  const inLast = events.filter((e) => e.round === last.id);
  if (!inLast.some((e) => e.kind === "gate")) problems.push(`the last round (${last.id}) ran no gate`);
  const fullShots = inLast.filter((e) => e.kind === "shot" && e.mode === "full");
  if (!fullShots.some((shot) => shot.viewport.width >= 1024)) {
    problems.push(`the last round (${last.id}) has no full-page shot at desktop width — shot <page> --full --viewport desktop`);
  }
  if (!fullShots.some((shot) => shot.viewport.width <= 480)) {
    problems.push(`the last round (${last.id}) has no full-page shot at phone width — shot <page> --full --viewport mobile`);
  }

  const lastRunOf = new Map();
  for (const gate of events.filter((e) => e.kind === "gate")) lastRunOf.set(gate.cmd, gate);
  for (const gate of lastRunOf.values()) {
    if (gate.exit === 0) continue;
    if (notesAbout(gate.id).some((note) => CLOSING_KINDS.has(note.noteKind))) continue;
    problems.push(
      `${gate.id} is the last run of \`${gate.cmd}\` and it exited ${gate.exit} — fix and re-run, or ` +
        `note --about ${gate.id} --kind accepted|false-positive|superseded …`,
    );
  }
  return problems;
}

function cmdCheck(siteDir) {
  const problems = checkLog(readLog(siteDir));
  if (!problems.length) {
    console.log("[judge] the log is complete");
    return 0;
  }
  console.log(`[judge] ${problems.length} thing(s) before this log can say done:`);
  for (const problem of problems) console.log(`  - ${problem}`);
  return 1;
}

function cmdDone(siteDir, argv) {
  const events = readLog(siteDir);
  const problems = checkLog(events);
  if (problems.length) {
    cmdCheck(siteDir);
    return 1;
  }
  const text = takeText(parse(argv).rest, "done");
  append(siteDir, { kind: "done", round: currentRound(events).id, t: new Date().toISOString(), text });
  cmdRender(siteDir);
  return 0;
}

function cmdStatus(siteDir) {
  const events = readLog(siteDir);
  const count = (kind) => events.filter((e) => e.kind === kind).length;
  const round = events.filter((e) => e.kind === "round").at(-1);
  console.log(
    `[judge] ${round ? `${round.id} (${round.actor}): ${round.title}` : "no round yet"} — ` +
      `${count("gate")} gate run(s), ${count("shot")} shot(s), ${count("look")} look(s), ` +
      `${count("defect")} defect(s), ${count("fix")} fix(es), ${count("note")} note(s)`,
  );
  const problems = checkLog(events);
  for (const problem of problems) console.log(`  - ${problem}`);
}

// ---------------------------------------------------------------------------------------------
// render

export function summarize(events) {
  const of = (kind) => events.filter((e) => e.kind === kind);
  const defects = of("defect");
  const gates = of("gate");
  const shots = of("shot");
  return {
    init: events.find((e) => e.kind === "init") ?? null,
    done: events.filter((e) => e.kind === "done").at(-1) ?? null,
    rounds: of("round").length,
    gates: gates.length,
    gatesFailed: gates.filter((g) => g.exit !== 0).length,
    shots: shots.length,
    screens: shots.reduce((n, s) => n + s.tiles.length, 0),
    looks: of("look").length,
    defects: defects.length,
    byEye: defects.filter((d) => d.by === "eye").length,
    byGate: defects.filter((d) => d.by === "gate").length,
    fixed: defects.filter((d) => of("fix").some((f) => f.defect === d.id)).length,
    falsePositives: of("note").filter((n) => n.noteKind === "false-positive").length,
  };
}

function defectRows(events) {
  return events
    .filter((e) => e.kind === "defect")
    .map((defect) => {
      const source = byId(events, defect.from);
      const shot = source?.kind === "look" ? byId(events, source.shot) : null;
      const fixes = events.filter((e) => e.kind === "fix" && e.defect === defect.id);
      const verifies = events.filter((e) => e.kind === "verify" && e.defect === defect.id);
      const closing = events.filter(
        (e) => e.kind === "note" && e.about === defect.id && CLOSING_KINDS.has(e.noteKind),
      );
      return { defect, source, shot, fixes, verifies, closing };
    });
}

/** The run-ledger headline of a gate run as one line of counts (`report` is a local path, so it goes). */
function headlineText(gate) {
  return gate.headline
    .map((h) =>
      Object.entries(h)
        .filter(([key]) => key !== "tool" && key !== "report")
        .map(([key, value]) => `${key} ${typeof value === "object" ? JSON.stringify(value) : value}`)
        .join(" · "),
    )
    .filter(Boolean)
    .join(" — ");
}

/** One line for a gate run: its own `verdict:` line, or the headline when it prints none. */
export function gateSummary(gate) {
  return gate.verdict ?? headlineText(gate);
}

const escapeHtml = (text) =>
  String(text).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

function shotCaption(shot) {
  const parts = [`${shot.viewport.width}×${shot.viewport.height}`];
  if (shot.mode === "full") parts.push(`full page, ${shot.tiles.length} screen(s)`);
  else if (shot.mode === "element") parts.push(`element ${shot.element}`);
  if (shot.scale !== 1) parts.push(`@${shot.scale}x`);
  if (shot.dark) parts.push("dark");
  if (shot.reducedMotion) parts.push("reduced motion");
  for (const step of shot.steps) parts.push(describeStep(step));
  return `${shot.page} · ${parts.join(" · ")}`;
}

const STYLE = `
:root { color-scheme: light dark; --bg:#f6f5f1; --panel:#ffffff; --ink:#1d1d1b; --muted:#5d5b55; --line:#dcd9d0;
  --eye:#7a3fb0; --eye-bg:#f3ebfa; --gate:#1f5f8b; --gate-bg:#e6f0f7; --pass:#1e6b3a; --pass-bg:#e4f3e8; --fail:#a3261c; --fail-bg:#fbe9e7; --code:#f0eee8; }
@media (prefers-color-scheme: dark) { :root { --bg:#161614; --panel:#1f1f1c; --ink:#ecebe6; --muted:#a9a69c; --line:#3a3934;
  --eye:#d2a8f5; --eye-bg:#2c2136; --gate:#8cc4ea; --gate-bg:#1a2a36; --pass:#8fd6a4; --pass-bg:#18291e; --fail:#f4a39b; --fail-bg:#35201e; --code:#262622; } }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--ink); font: 16px/1.6 system-ui, -apple-system, "Segoe UI", "Hiragino Sans", "Noto Sans JP", sans-serif; }
main { max-width: 72rem; margin: 0 auto; padding: 2.5rem 1rem 4rem; }
a { color: inherit; text-underline-offset: 0.15em; }
.kicker { margin: 0 0 0.5rem; color: var(--muted); font-size: 0.875rem; letter-spacing: 0.06em; text-transform: uppercase; }
h1 { margin: 0 0 0.75rem; font-size: clamp(1.75rem, 4vw, 2.5rem); line-height: 1.2; }
h2 { margin: 3rem 0 1rem; font-size: 1.5rem; line-height: 1.3; }
h4 { margin: 0; font-size: 1rem; }
.lede { margin: 0 0 1.5rem; color: var(--muted); max-width: 46rem; }
.stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr)); gap: 0.75rem; margin: 0 0 1.5rem; padding: 0; list-style: none; }
.stats li { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 0.75rem 1rem; }
.stats b { display: block; font-size: 1.5rem; line-height: 1.2; }
.stats span { color: var(--muted); font-size: 0.875rem; }
.chip { display: inline-block; padding: 0.05rem 0.5rem; border-radius: 999px; font-size: 0.8125rem; font-weight: 600; white-space: nowrap; }
.chip.eye { color: var(--eye); background: var(--eye-bg); } .chip.gate { color: var(--gate); background: var(--gate-bg); }
.chip.pass { color: var(--pass); background: var(--pass-bg); } .chip.fail { color: var(--fail); background: var(--fail-bg); }
.chip.actor { color: var(--muted); border: 1px solid var(--line); font-weight: 500; }
.table-wrap { overflow-x: auto; border: 1px solid var(--line); border-radius: 10px; background: var(--panel); }
table { border-collapse: collapse; width: 100%; font-size: 0.9375rem; }
th, td { text-align: left; vertical-align: top; padding: 0.625rem 0.75rem; border-bottom: 1px solid var(--line); }
tr:last-child td { border-bottom: 0; }
th { font-size: 0.8125rem; color: var(--muted); font-weight: 600; }
td p { margin: 0 0 0.375rem; } td p:last-child { margin: 0; }
@media (max-width: 40rem) {
  /* Five columns in 343px leave each one a word wide; below this width a row is a card. */
  table, tbody, tr, td { display: block; } thead { display: none; }
  tr { border-bottom: 1px solid var(--line); padding: 0.5rem 0; } tr:last-child { border-bottom: 0; }
  td { border: 0; padding: 0.25rem 0.75rem; }
  td::before { content: attr(data-label); display: block; font-size: 0.75rem; font-weight: 600; color: var(--muted); }
}
.id { font-family: ui-monospace, "SFMono-Regular", Menlo, monospace; font-size: 0.8125rem; color: var(--muted); }
.round { margin: 2.5rem 0 0; }
.round > header { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.5rem 0.75rem; border-bottom: 1px solid var(--line); padding-bottom: 0.5rem; margin-bottom: 1rem; }
.round > header h3 { margin: 0; font-size: 1.25rem; line-height: 1.3; }
.entry { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 0.875rem 1rem; margin: 0 0 0.75rem; }
.entry > header { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.25rem 0.625rem; margin-bottom: 0.375rem; }
.entry p { margin: 0.25rem 0 0; white-space: pre-wrap; overflow-wrap: anywhere; }
code, pre { font-family: ui-monospace, "SFMono-Regular", Menlo, monospace; font-size: 0.8125rem; }
code { overflow-wrap: anywhere; }
pre { margin: 0.5rem 0 0; padding: 0.75rem; background: var(--code); border-radius: 8px; overflow-x: auto; max-height: 32rem; line-height: 1.45; }
details summary { cursor: pointer; color: var(--muted); font-size: 0.875rem; }
.tiles { display: flex; gap: 0.5rem; overflow-x: auto; padding: 0.25rem 0 0.5rem; }
.tiles a { flex: none; display: block; border: 1px solid var(--line); border-radius: 6px; overflow: hidden; background: var(--bg); }
.tiles img { display: block; width: auto; height: 11rem; }
.tiles img.tall { height: 18rem; }
.look { border-left: 3px solid var(--eye); padding: 0.25rem 0 0.25rem 0.75rem; margin: 0.75rem 0 0; }
.look p { margin: 0.25rem 0 0; }
.raised { margin: 0.5rem 0 0 0.75rem; padding: 0.5rem 0.75rem; border-radius: 8px; background: var(--fail-bg); }
.raised p { margin: 0.125rem 0 0; }
.done { border-color: var(--pass); }
footer { margin-top: 3rem; color: var(--muted); font-size: 0.875rem; }
`;

const para = (text) =>
  String(text)
    .split(/\n{2,}/)
    .map((chunk) => `<p>${escapeHtml(chunk)}</p>`)
    .join("");

/** The judgment log as a page. `briefText` is the brief's contents, when there is one. */
export function renderHtml(events, { briefText = null, readOutput = () => "" } = {}) {
  const readGateOutput = (gate) => readOutput(gate.output).trimEnd();
  const s = summarize(events);
  const title = s.init?.title ?? "Untitled site";
  const rows = defectRows(events);
  const looksOf = (shotId) => events.filter((e) => e.kind === "look" && e.shot === shotId);
  const raisedFrom = (id) => events.filter((e) => e.kind === "defect" && e.from === id);

  const raised = (id) =>
    raisedFrom(id)
      .map((d) => `<div class="raised"><span class="id">${d.id}</span> <b>defect</b>${d.where ? ` <code>${escapeHtml(d.where)}</code>` : ""}${para(d.text)}</div>`)
      .join("");

  const defectTable = rows.length
    ? `<div class="table-wrap"><table><thead><tr><th>Defect</th><th>Found by</th><th>What</th><th>Fix</th><th>Checked by</th></tr></thead><tbody>${rows
        .map(({ defect, source, shot, fixes, verifies, closing }) => {
          const found = defect.by === "eye"
            ? `<span class="chip eye">eye</span> <span class="id">${source?.id} on <a href="#${shot?.id}">${shot?.id}</a></span>`
            : `<span class="chip gate">gate</span> <span class="id"><a href="#${source?.id}">${source?.id}</a></span>`;
          const fix = fixes.length
            ? fixes.map((f) => para(f.text)).join("")
            : closing.map((n) => `<p><span class="chip actor">${n.noteKind}</span> ${escapeHtml(n.text)}</p>`).join("") || "<p>—</p>";
          const checked = verifies.length ? verifies.map((v) => `<span class="id">${v.by}</span>`).join(", ") : "—";
          return `<tr id="${defect.id}"><td class="id" data-label="Defect">${defect.id}</td><td data-label="Found by">${found}</td><td data-label="What">${defect.where ? `<p><code>${escapeHtml(defect.where)}</code></p>` : ""}${para(defect.text)}</td><td data-label="Fix">${fix}</td><td data-label="Checked by">${checked}</td></tr>`;
        })
        .join("")}</tbody></table></div>`
    : `<p class="lede">No defects were recorded.</p>`;

  const entry = (e) => {
    switch (e.kind) {
      case "gate": {
        const lines = readGateOutput(e).split("\n").length;
        const head = headlineText(e);
        return `<article class="entry" id="${e.id}"><header><span class="id">${e.id}</span><span class="chip ${e.exit === 0 ? "pass" : "fail"}">exit ${e.exit}</span><code>${escapeHtml(e.cmd)}</code></header>${e.verdict ? `<p>${escapeHtml(e.verdict)}</p>` : ""}${head ? `<p class="id">${escapeHtml(head)}</p>` : ""}<details><summary>output, ${lines} line(s), ${(e.ms / 1000).toFixed(1)}s</summary><pre>${escapeHtml(readGateOutput(e))}</pre></details>${raised(e.id)}</article>`;
      }
      case "shot": {
        const tiles = e.tiles
          .map((t, i) => `<a href="${t.file}" title="screen ${i + 1}${t.scrollY === undefined ? "" : `, scrollY ${t.scrollY}`}"><img src="${t.file}" alt="${e.id} screen ${i + 1}" width="${t.w}" height="${t.h}" class="${t.h > t.w ? "tall" : "wide"}" loading="lazy"></a>`)
          .join("");
        const looks = looksOf(e.id)
          .map((l) => `<div class="look"><span class="id">${l.id}${l.tile ? ` · screen ${l.tile}` : ""}${l.round !== e.round ? ` · ${l.round}` : ""}</span> <span class="chip eye">saw</span>${para(l.text)}${raised(l.id)}</div>`)
          .join("");
        const errors = e.errors.length ? `<p class="id">page errors: ${escapeHtml(e.errors.join(" | "))}</p>` : "";
        return `<article class="entry" id="${e.id}"><header><span class="id">${e.id}</span><h4>${escapeHtml(e.label ?? shotCaption(e))}</h4></header>${e.label ? `<p class="id">${escapeHtml(shotCaption(e))}</p>` : ""}<div class="tiles">${tiles}</div>${errors}${looks}</article>`;
      }
      case "fix":
        return `<article class="entry" id="${e.id}"><header><span class="id">${e.id}</span><b>fix</b> for <a class="id" href="#${e.defect}">${e.defect}</a></header>${para(e.text)}</article>`;
      case "verify":
        return `<article class="entry" id="${e.id}"><header><span class="id">${e.id}</span><b>verified</b> <a class="id" href="#${e.defect}">${e.defect}</a> by <a class="id" href="#${e.by}">${e.by}</a></header>${e.text ? para(e.text) : ""}</article>`;
      case "note":
        return `<article class="entry" id="${e.id}"><header><span class="id">${e.id}</span><span class="chip actor">${e.noteKind}</span>${e.about ? `about <a class="id" href="#${e.about}">${e.about}</a>` : ""}</header>${para(e.text)}</article>`;
      case "done":
        return `<article class="entry done"><header><span class="chip pass">done</span></header>${para(e.text)}</article>`;
      default:
        return "";
    }
  };

  const rounds = events
    .filter((e) => e.kind === "round")
    .map((round) => {
      // Looks and defects hang off their shot or gate run; everything else is in the order it happened.
      const body = events
        .filter((e) => e.round === round.id && !(e.kind === "look" && byId(events, e.shot)) && !(e.kind === "defect"))
        .map(entry)
        .join("");
      const orphanLooks = events.filter((e) => e.kind === "look" && e.round === round.id && byId(events, e.shot)?.round !== round.id);
      const lateLooks = orphanLooks.length
        ? `<p class="id">Also in this round: ${orphanLooks.map((l) => `${l.id} on <a href="#${l.shot}">${l.shot}</a>`).join(", ")}.</p>`
        : "";
      return `<section class="round" id="${round.id}"><header><h3>${round.id} · ${escapeHtml(round.title)}</h3><span class="chip actor">${round.actor}</span></header>${body}${lateLooks}</section>`;
    })
    .join("");

  const stat = (value, label) => `<li><b>${value}</b><span>${label}</span></li>`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} — judgment log</title>
<style>${STYLE}</style>
</head>
<body>
<main>
<p class="kicker">vlmkit demo · judgment log</p>
<h1>${escapeHtml(title)}</h1>
<p class="lede">How this ${escapeHtml(s.init?.pattern ?? "site")} was judged, in the order it happened: every gate run with its whole output, every screenshot that was looked at with what was seen in it, and where each defect came from. <a href="../">Open the site</a>.</p>
<ul class="stats">${stat(s.rounds, "rounds")}${stat(s.gates, `gate runs, ${s.gatesFailed} failing`)}${stat(s.screens, `screens in ${s.shots} shots`)}${stat(s.looks, "looks recorded")}${stat(s.byEye, "defects found by eye")}${stat(s.byGate, "defects found by a gate")}${stat(s.falsePositives, "gate false positives")}</ul>
${briefText ? `<details><summary>The brief the builder was given</summary><pre>${escapeHtml(briefText)}</pre></details>` : ""}
<h2>Defects</h2>
${defectTable}
<h2>Rounds</h2>
${rounds}
${s.done ? "" : `<p class="lede">This log has not been marked done.</p>`}
<footer>Rendered by <code>examples/sites/judge.mjs</code> from <code>judgment/log.jsonl</code>. Every gate output above is the command's own, with colour codes stripped.</footer>
</main>
</body>
</html>
`;
}

/** The same log as Markdown, for reading on GitHub. Images point into `judgment/`. */
export function renderMarkdown(events) {
  const s = summarize(events);
  const title = s.init?.title ?? "Untitled site";
  const out = [];
  const cell = (text) => String(text).replaceAll("|", "\\|").replaceAll("\n", "<br>");
  out.push(`# ${title} — judgment log`, "");
  out.push(
    `How this ${s.init?.pattern ?? "site"} was judged, in order. Rendered from \`judgment/log.jsonl\` by ` +
      "`examples/sites/judge.mjs`; the published copy is `judgment/index.html`.",
    "",
  );
  out.push(
    `**${s.rounds}** rounds · **${s.gates}** gate runs (${s.gatesFailed} failing) · **${s.screens}** screens in ${s.shots} shots · ` +
      `**${s.looks}** looks · defects: **${s.byEye}** by eye, **${s.byGate}** by a gate · ${s.falsePositives} gate false positive(s)`,
    "",
  );
  if (s.init?.brief) out.push(`Brief: [\`${s.init.brief}\`](${s.init.brief})`, "");

  out.push("## Defects", "");
  const rows = defectRows(events);
  if (!rows.length) out.push("No defects were recorded.", "");
  else {
    out.push("| | found by | what | fix | checked by |", "|---|---|---|---|---|");
    for (const { defect, source, shot, fixes, verifies, closing } of rows) {
      const found = defect.by === "eye" ? `eye (${source?.id} on ${shot?.id})` : `gate (${source?.id})`;
      const fix = fixes.length ? fixes.map((f) => f.text).join(" / ") : closing.map((n) => `${n.noteKind}: ${n.text}`).join(" / ") || "—";
      const what = `${defect.where ? `\`${defect.where}\` ` : ""}${defect.text}`;
      out.push(`| ${defect.id} | ${found} | ${cell(what)} | ${cell(fix)} | ${verifies.map((v) => v.by).join(", ") || "—"} |`);
    }
    out.push("");
  }

  out.push("## Rounds", "");
  const flat = (text) => text.replaceAll("\n", " ");
  const raised = (id, indent) =>
    events
      .filter((e) => e.kind === "defect" && e.from === id)
      .map((d) => `${indent}- ✗ **${d.id}** defect${d.where ? ` \`${d.where}\`` : ""}: ${flat(d.text)}`);
  for (const round of events.filter((e) => e.kind === "round")) {
    out.push(`### ${round.id} · ${round.title} (${round.actor})`, "");
    // As in the page: looks sit under the shot they are about, defects under what found them.
    for (const e of events.filter((x) => x.round === round.id && x.kind !== "defect" && !(x.kind === "look" && byId(events, x.shot)))) {
      if (e.kind === "gate") {
        const summary = gateSummary(e);
        out.push(`- **${e.id}** \`${e.cmd}\` → exit ${e.exit}${summary ? ` — ${summary}` : ""} ([output](judgment/${e.output}))`);
        out.push(...raised(e.id, "  "));
      } else if (e.kind === "shot") {
        out.push(`- **${e.id}** ${shotCaption(e)}${e.label ? ` — ${e.label}` : ""}`, "");
        out.push(`  ${e.tiles.map((t) => `<img src="judgment/${t.file}" height="${t.h > t.w ? 240 : 160}" alt="${e.id}">`).join(" ")}`, "");
        for (const look of events.filter((x) => x.kind === "look" && x.shot === e.id)) {
          const where = `${look.tile ? ` screen ${look.tile}` : ""}${look.round !== e.round ? `, in ${look.round}` : ""}`;
          out.push(`  - 👁 **${look.id}**${where ? ` (${where.trim()})` : ""}: ${flat(look.text)}`);
          out.push(...raised(look.id, "    "));
        }
      } else if (e.kind === "fix") {
        out.push(`- **${e.id}** fix for ${e.defect}: ${flat(e.text)}`);
      } else if (e.kind === "verify") {
        out.push(`- **${e.id}** ${e.defect} verified by ${e.by}${e.text ? `: ${flat(e.text)}` : ""}`);
      } else if (e.kind === "note") {
        out.push(`- **${e.id}** ${e.noteKind}${e.about ? ` about ${e.about}` : ""}: ${flat(e.text)}`);
      } else if (e.kind === "done") {
        out.push(`- **done**: ${flat(e.text)}`);
      }
    }
    out.push("");
  }
  if (!s.done) out.push("_This log has not been marked done._", "");
  return `${out.join("\n").trimEnd()}\n`;
}

export function renderSite(siteDir) {
  const events = readLog(siteDir);
  const paths = logPaths(siteDir);
  const readOutput = (file) => {
    const path = join(paths.dir, file);
    return existsSync(path) ? readFileSync(path, "utf8") : "(output file missing)";
  };
  const init = events.find((e) => e.kind === "init");
  const briefFile = init?.brief ? resolve(siteDir, init.brief) : null;
  const briefText = briefFile && existsSync(briefFile) ? readFileSync(briefFile, "utf8") : null;
  return { html: renderHtml(events, { briefText, readOutput }), markdown: renderMarkdown(events) };
}

function cmdRender(siteDir) {
  const { html, markdown } = renderSite(siteDir);
  const paths = logPaths(siteDir);
  writeFileSync(paths.html, html);
  writeFileSync(paths.md, markdown);
  console.log(`[judge] rendered ${relative(process.cwd(), paths.html)} and ${relative(process.cwd(), paths.md)}`);
}

// ---------------------------------------------------------------------------------------------

const USAGE = `node examples/sites/judge.mjs <site-dir> <command> [...]

  init   --title "…" [--pattern docs] [--brief path]   start the log, once
  round  "title" [--actor builder|reviewer]            start a round; what follows belongs to it
  gate   <vlmkit command…>                              run a gate in the site dir; exit code + whole output kept
  shot   <page> [--viewport desktop|tablet|mobile|WxH[,…]] [--full] [--element sel] [--scroll-el sel]
         [--dark] [--reduced-motion] [--scale 2] [--label "…"]
         [--click sel] [--hover sel] [--focus sel] [--press Key] [--type text] [--fill sel value]
         [--scroll-to sel] [--wait ms]                  screenshots, one screen per file; Read each one
  look   S#[:tile] - <<'EOF' … EOF                       what you saw in a shot you READ (≥${MIN_LOOK_CHARS} chars)
  defect --from L#|G# [--where "sel or area"] text     something wrong, and which look or gate found it
  fix    D# text                                        what you changed for it
  verify D# --by L#|G# [text]                           the later look or gate run showing the fix works
  note   [--about id] [--kind ${NOTE_KINDS.join("|")}] text
  status | check                                        where the log stands / what it still needs
  done   text                                           final summary; refuses until check passes, then renders
  render                                                write judgment/index.html and JUDGMENT.md`;

export async function main(argv) {
  const [siteArg, command, ...rest] = argv;
  if (!siteArg || !command || siteArg === "--help" || command === "--help") {
    console.log(USAGE);
    return siteArg && command ? 0 : 1;
  }
  const siteDir = resolve(siteArg);
  if (!existsSync(siteDir)) fail(`no site directory ${siteArg}`);
  if (command !== "init" && !existsSync(logPaths(siteDir).log)) fail(`no log in ${siteArg} — run init first`);
  switch (command) {
    case "init":
      return cmdInit(siteDir, rest) ?? 0;
    case "round":
      return cmdRound(siteDir, rest) ?? 0;
    case "gate":
      return cmdGate(siteDir, rest);
    case "shot":
      return (await cmdShot(siteDir, rest)) ?? 0;
    case "look":
      return cmdLook(siteDir, rest) ?? 0;
    case "defect":
      return cmdDefect(siteDir, rest) ?? 0;
    case "fix":
      return cmdFix(siteDir, rest) ?? 0;
    case "verify":
      return cmdVerify(siteDir, rest) ?? 0;
    case "note":
      return cmdNote(siteDir, rest) ?? 0;
    case "status":
      return cmdStatus(siteDir) ?? 0;
    case "check":
      return cmdCheck(siteDir);
    case "done":
      return cmdDone(siteDir, rest);
    case "render":
      return cmdRender(siteDir) ?? 0;
    default:
      fail(`unknown command ${command}\n\n${USAGE}`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code ?? 0;
    },
    (error) => {
      console.error(error instanceof JudgeError ? `judge: ${error.message}` : error);
      process.exitCode = 2;
    },
  );
}
