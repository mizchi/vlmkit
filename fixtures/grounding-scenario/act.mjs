#!/usr/bin/env node
/**
 * The other half of a computer-use turn: send an action, get the next screenshot.
 *
 * v1 and v2 of this scenario measured one frame and one coordinate each. They
 * could not reach the question the gate's own report named next — whether an
 * agent can tell from the NEXT picture that its click did what it meant — because
 * nothing here could click. This can.
 *
 *   node act.mjs <letter> click  <x>,<y>          # dispatch a click at a screenshot px point
 *   node act.mjs <letter> move   <x>,<y>          # move the pointer there (hover), no click
 *   node act.mjs <letter> wheel  <x>,<y> <dy>     # scroll at a point (positive = down)
 *   node act.mjs <letter> shot                    # re-shoot without acting
 *   node act.mjs <letter> reset                   # forget every action and start over
 *   node act.mjs <letter> --page triage shot      # first call only: which page the session is on
 *
 * Coordinates are in the SAME screenshot pixels as `shots/<page>.png` and the
 * action map — one contract across the whole scenario. From v4 that includes
 * `wheel`'s dy: a v3 session's dy was a CSS-px wheel delta, which is half the
 * screenshot px the gate's own "nearest needs 34px" is denominated in, and once
 * `check grounding --after` could replay the same action the two had to agree or
 * a pasted scroll would land on a different screen. Sessions written before the
 * change carry no `wheelUnits` and replay exactly as they did.
 *
 * **Replay, not a daemon.** Every call reloads the page from scratch and replays
 * the whole action list from `attempts/<letter>/session.json` before doing the
 * new one. That costs a second and buys three things a long-lived browser does
 * not: the run is reproducible from the file alone, a crashed attempt resumes
 * exactly where it was, and the scorer can rebuild the final state without
 * trusting anything the attempt says about it.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resizePngBuffer } from "@mizchi/vlmkit-core/image-resize.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
export const VIEWPORT = { width: 1280, height: 720 };
export const SCALE = 0.5;
const DEFAULT_PAGE = "inbox";

const usage = "usage: node act.mjs <letter> [--page <name>] click|move|wheel|shot|reset [x,y] [dy]";

/** Parse `x,y` in screenshot px. A malformed point is an error, never a (0,0) click. */
export function parsePoint(raw) {
  const m = String(raw ?? "").match(/^(-?\d+)\s*,\s*(-?\d+)$/);
  if (!m) throw new Error(`bad point ${JSON.stringify(raw)} — expected x,y in screenshot px`);
  return { x: Number(m[1]), y: Number(m[2]) };
}

/** Screenshot px -> CSS px. One divide, in one place, so no caller does it twice. */
export const toCss = (p) => ({ x: Math.round(p.x / SCALE), y: Math.round(p.y / SCALE) });

/**
 * Replay `actions` on a fresh page and return the browser + page, still open.
 * Exported so the scorer rebuilds the same state the attempt reached rather than
 * reading a claim about it.
 */
export async function replay(actions, { pageName = DEFAULT_PAGE, wheelUnits = "css" } = {}) {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: VIEWPORT });
  await page.goto(pathToFileURL(join(HERE, "pages", `${pageName}.html`)).href, { waitUntil: "networkidle" });
  for (const action of actions) {
    const css = toCss(action.at);
    if (action.kind === "click") await page.mouse.click(css.x, css.y);
    else if (action.kind === "move") await page.mouse.move(css.x, css.y);
    else if (action.kind === "wheel") {
      await page.mouse.move(css.x, css.y);
      await page.mouse.wheel(0, wheelUnits === "screenshot" ? Math.round(action.dy / SCALE) : action.dy);
    }
    // Settle: the page is scripted, so a frame is enough, and a fixed wait keeps
    // the replay deterministic in a way `networkidle` on a file:// page is not.
    await page.waitForTimeout(120);
  }
  return { browser, page };
}

/** Replay a whole session file's actions, honouring the units it was written in. */
export function replaySession(session) {
  return replay(session.actions, { pageName: session.page ?? DEFAULT_PAGE, wheelUnits: session.wheelUnits ?? "css" });
}

async function main() {
  const args = process.argv.slice(2);
  const pageAt = args.indexOf("--page");
  const pageFlag = pageAt === -1 ? undefined : args[pageAt + 1];
  if (pageAt !== -1) args.splice(pageAt, 2);
  const [letter, kind, pointRaw, dyRaw] = args;
  if (!letter || !kind) { console.error(usage); process.exit(1); }
  const dir = join(HERE, "attempts", letter);
  const sessionPath = join(dir, "session.json");
  await mkdir(dir, { recursive: true });

  let session = existsSync(sessionPath)
    ? JSON.parse(await readFile(sessionPath, "utf8"))
    : { page: pageFlag ?? DEFAULT_PAGE, viewport: VIEWPORT, scale: SCALE, wheelUnits: "screenshot", actions: [] };
  if (pageFlag && pageFlag !== session.page) {
    console.error(`this session is on ${session.page}; --page ${pageFlag} only chooses the page of a new session`);
    process.exit(1);
  }

  if (kind === "reset") {
    session.actions = [];
    await writeFile(sessionPath, JSON.stringify(session, null, 2));
    console.log("session reset — 0 actions");
  } else if (kind === "click" || kind === "move" || kind === "wheel") {
    const at = parsePoint(pointRaw);
    if (at.x < 0 || at.y < 0 || at.x >= VIEWPORT.width * SCALE || at.y >= VIEWPORT.height * SCALE) {
      console.error(`(${at.x},${at.y}) is outside the ${VIEWPORT.width * SCALE}x${VIEWPORT.height * SCALE} frame`);
      process.exit(1);
    }
    const action = kind === "wheel" ? { kind, at, dy: Number(dyRaw ?? 0) } : { kind, at };
    if (kind === "wheel" && !Number.isFinite(action.dy)) {
      console.error("wheel needs a scroll amount: node act.mjs <letter> wheel <x>,<y> <dy>");
      process.exit(1);
    }
    session.actions.push(action);
    await writeFile(sessionPath, JSON.stringify(session, null, 2));
  } else if (kind !== "shot") {
    console.error(usage);
    process.exit(1);
  }

  const { browser, page } = await replaySession(session);
  const shot = await page.screenshot({ type: "png" });
  await browser.close();
  const n = String(session.actions.length).padStart(2, "0");
  const out = join(dir, `shot-${n}.png`);
  await writeFile(out, resizePngBuffer(shot, { resolution: "medium" }));

  const last = session.actions[session.actions.length - 1];
  const did = kind === "reset"
    ? "reset"
    : last
      ? `${last.kind} at (${last.at.x},${last.at.y})${last.kind === "wheel" ? ` dy=${last.dy}` : ""}`
      : "nothing yet";
  console.log(`${did} — ${session.actions.length} action(s) so far`);
  console.log(`next screenshot: ${out.replace(`${HERE}/`, "fixtures/grounding-scenario/")}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((err) => { console.error(err.message); process.exit(1); });
}
