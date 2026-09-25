/**
 * `vlmkit scan a11y`: write a platform's accessibility tree and its frame as a
 * `vlmkit-a11y/1` file, for `vlmkit check a11y tree` to judge.
 *
 * Two collectors today, chosen by the source:
 *
 * - a page (URL or HTML file) → the Flutter web collector (`flutter-web.ts`), in a browser;
 * - a `.xml` file → the Android `uiautomator dump` importer (`uiautomator.ts`), no browser.
 *
 * Anything else — macOS AX, Windows UI Automation, iOS, a Flutter desktop app's semantics
 * dump — writes the same JSON with its own tool; nothing downstream knows which wrote it.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, extname, relative, resolve } from "node:path";
import type { Page } from "playwright";
import { withBrowser } from "@mizchi/vlmkit-core/browser-launch.ts";
import { withAuthState } from "@mizchi/vlmkit-core/auth-state.ts";
import { describeRedirect } from "@mizchi/vlmkit-core/navigation-redirect.ts";
import { sourceToUrl } from "@mizchi/vlmkit-core/page-open.ts";
import type { PageLoadOptions } from "@mizchi/vlmkit-core/page-load.ts";
import { UsageError } from "@mizchi/vlmkit-core/cli-error.ts";
import { A11Y_TREE_FORMAT, isInteractive, type A11yTree } from "@mizchi/vlmkit-judge/a11y-tree.ts";
import {
  COLLECT_FLUTTER_SEMANTICS,
  FLUTTER_SEMANTICS_INIT,
  FLUTTER_STATE_JS,
  flutterWebNodes,
  markFlutterTarget,
  type FlutterWebRawNode,
} from "./flutter-web.ts";
import { importUiautomatorDump } from "./uiautomator.ts";

/** Where `scan a11y` writes when `--out` is not given. */
export const DEFAULT_A11Y_TREE = ".vlmkit/a11y.json";

export interface ScanA11yOptions extends PageLoadOptions {
  /** A page (Flutter web), or a uiautomator dump (`.xml`). */
  source: string;
  out: string;
  /** Frame PNG: written for a page, read (as given) for a dump. */
  frame?: string;
  viewport?: { width: number; height: number };
  /** Tap these by accessible name, in order, before collecting (a page only). */
  clicks?: string[];
  /** Device dpi, for a uiautomator dump. */
  density?: number;
  /** BCP 47 locale for the page. Default en-US: see `captureFlutterWeb`. */
  locale?: string;
  storageState?: string;
}

export interface ScanA11yReport {
  source: string;
  platform: string;
  out: string;
  frame: string | null;
  viewport: { width: number; height: number };
  redirect: string | null;
  clicks: string[];
  counts: { nodes: number; named: number; interactive: number };
}

const isDump = (source: string) => extname(source).toLowerCase() === ".xml";

/** The semantics tree is built asynchronously; it is ready when its size stops changing. */
async function waitForSemantics(page: Page, deadline: number, minQuietMs = 500): Promise<{ flutter: boolean; nodes: number }> {
  let last = -1;
  let quietSince = Date.now();
  let state = { flutter: false, nodes: 0 };
  while (Date.now() < deadline) {
    state = await page.evaluate(FLUTTER_STATE_JS) as typeof state;
    if (!state.flutter) return state;
    if (state.nodes !== last) {
      last = state.nodes;
      quietSince = Date.now();
    } else if (state.nodes > 0 && Date.now() - quietSince >= minQuietMs) {
      return state;
    }
    await page.waitForTimeout(100);
  }
  return state;
}

async function captureFlutterWeb(options: ScanA11yOptions, framePath: string): Promise<{ tree: A11yTree; redirect: string | null }> {
  return withBrowser(async (browser) => {
    const viewport = options.viewport ?? { width: 375, height: 812 };
    // Pinned, not inherited: a container with no LANG gives the page an empty locale, and a
    // Flutter build calls `new Intl.Locale(...)` on it at startup and throws before the first
    // frame — the app never boots and the page reads as not-Flutter. Measured on ofc-app.
    const locale = options.locale ?? "en-US";
    const page = await browser.newPage(withAuthState({ viewport, locale }, options.storageState));
    if (options.har) await page.routeFromHAR(resolve(options.har), { notFound: "abort" });
    await page.addInitScript(FLUTTER_SEMANTICS_INIT);
    const timeout = options.timeout ?? 30000;
    await page.goto(sourceToUrl(options.source), { waitUntil: options.waitUntil ?? "load", timeout });
    const redirect = /^https?:\/\//.test(options.source) ? describeRedirect(options.source, page.url()) : null;
    const state = await waitForSemantics(page, Date.now() + timeout);
    if (!state.flutter) {
      throw new UsageError(
        `${options.source} is not a Flutter web app (no flutter-view / flt-semantics). For a DOM page,`
        + " the DOM gates read accessibility directly: vlmkit check a11y touch|contrast|focus.",
      );
    }
    for (const name of options.clicks ?? []) {
      const found = await page.evaluate(markFlutterTarget(name)) as number;
      if (found === 0) {
        const raw = (await page.evaluate(COLLECT_FLUTTER_SEMANTICS) ?? []) as FlutterWebRawNode[];
        const names = flutterWebNodes(raw).filter(isInteractive).map((n) => n.name).filter(Boolean);
        throw new UsageError(
          `--click ${JSON.stringify(name)}: no tappable node has that exact name on this screen.`
          + ` Tappable names here: ${names.length ? names.map((n) => JSON.stringify(n)).join(", ") : "(none)"}.`,
        );
      }
      // Forced: the semantics DOM is transparent by design, so Playwright's visibility check refuses it.
      await page.click("[data-vlmkit-click]", { force: true, timeout: 5000 });
      // A route transition animates; the tree is rebuilt while it runs.
      await page.waitForTimeout(600);
      await waitForSemantics(page, Date.now() + timeout);
    }
    const raw = (await page.evaluate(COLLECT_FLUTTER_SEMANTICS) ?? []) as FlutterWebRawNode[];
    const measured = await page.evaluate("({ w: innerWidth, h: innerHeight, dpr: devicePixelRatio })") as { w: number; h: number; dpr: number };
    await mkdir(dirname(framePath), { recursive: true });
    await page.screenshot({ path: framePath });
    await page.close();
    return {
      redirect,
      tree: {
        format: A11Y_TREE_FORMAT,
        platform: "flutter-web",
        viewport: { width: measured.w, height: measured.h },
        scale: measured.dpr,
        nodes: flutterWebNodes(raw),
      },
    };
  });
}

export async function runScanA11y(options: ScanA11yOptions): Promise<ScanA11yReport> {
  const out = resolve(options.out);
  let tree: A11yTree;
  let redirect: string | null = null;
  let frame: string | null;
  if (isDump(options.source)) {
    if (options.density === undefined) {
      throw new UsageError(
        "a uiautomator dump needs --density: its bounds are device pixels and target sizes are judged in dp."
        + " Read it with: adb shell wm density",
      );
    }
    frame = options.frame ? resolve(options.frame) : null;
    tree = importUiautomatorDump(await readFile(options.source, "utf8"), {
      density: options.density,
      ...(frame ? { frame: relative(dirname(out), frame) } : {}),
    });
  } else {
    frame = resolve(options.frame ?? `${out.slice(0, out.length - extname(out).length)}.png`);
    const captured = await captureFlutterWeb(options, frame);
    tree = { ...captured.tree, frame: relative(dirname(out), frame) || basename(frame) };
    redirect = captured.redirect;
  }
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, JSON.stringify(tree, null, 1) + "\n");
  return {
    source: options.source,
    platform: tree.platform ?? "unknown",
    out: options.out,
    frame,
    viewport: tree.viewport,
    redirect,
    clicks: options.clicks ?? [],
    counts: {
      nodes: tree.nodes.length,
      named: tree.nodes.filter((n) => (n.name ?? "").trim()).length,
      interactive: tree.nodes.filter(isInteractive).length,
    },
  };
}
