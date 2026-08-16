/**
 * Route capture — screenshots + a11y trees for `vlmkit workflow init` / `workflow capture`,
 * in this process.
 *
 * ## Why this file exists instead of `e2e/vlmkit-capture.spec.ts`
 *
 * That spec was 135 lines that did `goto` → `screenshot` → `Accessibility.getFullAXTree` →
 * write two files. Nothing in it needed the Playwright TEST RUNNER: no fixtures, no
 * `toHaveScreenshot`, no retries — one `expect` on body text, which is a measurement this
 * returns instead. It was spawned with `npx playwright test`, and being a test file rather than
 * a function cost four things:
 *
 *  1. **A packaging question with no good answer.** `package.json` publishes `dist/**` but
 *     excludes `dist/e2e/**`, and the `e2e/` sources are not published either, so an
 *     npm-installed vlmkit had no spec and no build could produce one. `workflow init` and
 *     `workflow capture` were source-checkout-only, and the open decision was "publish the spec
 *     or retire both commands". Retiring them was not as cheap as it looked: `verify`,
 *     `approve`, `report`, `introspect`, `spec-verify` and `expect` all read the `.a11y.json`
 *     sidecars this produces, and nothing else produces them — `vlmkit snapshot` writes
 *     multi-viewport PNGs and no a11y trees. Deleting two commands would have orphaned six.
 *     A function has no packaging question at all, which is how that decision is retired.
 *
 *  2. **A silent overwrite.** `playwright.config.ts` declares two projects — `vrt-desktop`
 *     (1280x720) and `vrt-mobile` (375x812) — and both ran this spec against the same
 *     `<name>.png` and `<name>.a11y.json`. Whichever finished last won, so a baseline was
 *     nondeterministically desktop or mobile. This takes ONE viewport, named in the result.
 *
 *  3. **Errors laundered through a subprocess.** A non-zero `playwright test` exit is a string,
 *     so the callers matched on captured-file counts and printed "(some tests had warnings, but
 *     captures completed)" — a blank page and a broken selector were the same sentence. Each
 *     route now reports its own outcome.
 *
 *  4. **`npx playwright test` startup** on every capture, plus `testDir`/filter fragility: a
 *     path outside `testDir` matches nothing and reports "No tests found", which is the
 *     obscure failure `resolveCaptureSpecPath` existed to work around.
 *
 * `withBrowser` is the same launcher all 27 gates use, so this shares their Chromium
 * resolution, `--no-sandbox` handling and teardown.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Page } from "playwright";
import { withBrowser } from "@mizchi/vlmkit-core/browser-launch.ts";
import type { CaptureRoute } from "./capture-config.ts";

/** The viewport the old `vrt-desktop` project used, and vlmkit's default elsewhere. */
export const DEFAULT_CAPTURE_VIEWPORT = { width: 1280, height: 720 } as const;

export interface RouteCaptureOptions {
  baseUrl: string;
  routes: readonly CaptureRoute[];
  /** Directory that receives `<name>.png` and `<name>.a11y.json`. */
  outputDir: string;
  viewport?: { width: number; height: number };
  /** Settling delay after load, matching the spec's `waitForTimeout(500)`. */
  settleMs?: number;
}

export interface RouteCaptureEntry {
  name: string;
  url: string;
  screenshotPath: string;
  a11yPath: string;
  /** How the a11y tree was obtained — CDP is the full tree; the rest are degraded. */
  a11ySource: "cdp" | "aria-snapshot" | "empty";
  /** `body` innerText length. 0 means the page rendered nothing, which the spec asserted on. */
  textLength: number;
  /**
   * HTTP status of the main response, or null when Playwright reported none.
   *
   * Recorded because `page.goto` does NOT throw on 4xx/5xx: a route whose path is wrong captures
   * the server's error page and that becomes the baseline. Measured while porting this — a route
   * pointed at `/nope.html` produced a 404 screenshot, a 404 a11y tree, and an exit 0. The old
   * spec had the same hole and no way to see it.
   */
  status: number | null;
  /** `waitFor` was given and never matched — the capture happened anyway, as before. */
  waitForTimedOut?: boolean;
}

export interface RouteCaptureFailure {
  name: string;
  url: string;
  error: string;
}

export interface RouteCaptureResult {
  viewport: { width: number; height: number };
  captured: RouteCaptureEntry[];
  failures: RouteCaptureFailure[];
  /** Captured, but the body had no text — a served-but-empty page. */
  blank: RouteCaptureEntry[];
  /** Captured, but the server did not return 2xx — an error page about to become a baseline. */
  notOk: RouteCaptureEntry[];
}

export async function captureRoutes(options: RouteCaptureOptions): Promise<RouteCaptureResult> {
  const viewport = options.viewport ?? { ...DEFAULT_CAPTURE_VIEWPORT };
  const settleMs = options.settleMs ?? 500;
  await mkdir(options.outputDir, { recursive: true });
  const captured: RouteCaptureEntry[] = [];
  const failures: RouteCaptureFailure[] = [];

  await withBrowser(async (browser) => {
    const context = await browser.newContext({ viewport });
    try {
      for (const route of options.routes) {
        const url = `${options.baseUrl}${route.path}`;
        const page = await context.newPage();
        try {
          const response = await page.goto(url, { waitUntil: "networkidle" });
          const status = response?.status() ?? null;
          let waitForTimedOut = false;
          if (route.waitFor) {
            // Swallowed in the spec too: a selector that never appears is not a reason to skip
            // the capture — the screenshot of the page WITHOUT it is the evidence. Recorded now
            // rather than discarded, because "the wait never matched" and "the page is fine"
            // used to print the same line.
            await page.waitForSelector(route.waitFor, { timeout: 10_000 })
              .catch(() => { waitForTimedOut = true; });
          }
          await page.waitForTimeout(settleMs);

          const screenshotPath = join(options.outputDir, `${route.name}.png`);
          await page.screenshot({ path: screenshotPath, fullPage: true });

          const { tree, source } = await collectA11yTree(page, route.name);
          const a11yPath = join(options.outputDir, `${route.name}.a11y.json`);
          await writeFile(a11yPath, JSON.stringify(tree, null, 2));

          const textLength = (await page.locator("body").innerText().catch(() => "")).length;
          captured.push({
            name: route.name, url, screenshotPath, a11yPath, a11ySource: source, textLength, status,
            ...(waitForTimedOut ? { waitForTimedOut } : {}),
          });
        } catch (err) {
          // One route failing must not lose the others: a five-route run where route two 404s
          // still produces four usable baselines, and the spec's all-or-nothing exit code was
          // what made the callers guess from file counts.
          failures.push({ name: route.name, url, error: err instanceof Error ? err.message : String(err) });
        } finally {
          await page.close().catch(() => {});
        }
      }
    } finally {
      await context.close().catch(() => {});
    }
  });

  return {
    viewport,
    captured,
    failures,
    blank: captured.filter((c) => c.textLength === 0),
    notOk: captured.filter((c) => c.status !== null && (c.status < 200 || c.status >= 300)),
  };
}

/**
 * The full CDP accessibility tree, with the spec's two fallbacks kept.
 *
 * `Accessibility.getFullAXTree` is Chromium-only, so the `ariaSnapshot` fallback is what makes
 * this work at all on another engine. Which one produced the tree is now returned: an
 * `ariaSnapshot` string and a real tree are not interchangeable to the commands that diff them,
 * and silently degrading was invisible.
 */
async function collectA11yTree(
  page: Page,
  name: string,
): Promise<{ tree: unknown; source: "cdp" | "aria-snapshot" | "empty" }> {
  try {
    const client = await page.context().newCDPSession(page);
    try {
      const result = await client.send("Accessibility.getFullAXTree") as { nodes: CdpAxNode[] };
      return { tree: cdpNodesToTree(result.nodes), source: "cdp" };
    } finally {
      await client.detach().catch(() => {});
    }
  } catch {
    try {
      const yaml = await page.locator(":root").ariaSnapshot();
      return { tree: { role: "document", name, ariaSnapshot: yaml }, source: "aria-snapshot" };
    } catch {
      return { tree: { role: "document", name, children: [] }, source: "empty" };
    }
  }
}

interface CdpAxNode {
  nodeId: string;
  parentId?: string;
  role?: { value: string };
  name?: { value: string };
  properties?: { name: string; value: { value: unknown } }[];
  childIds?: string[];
}

/**
 * CDP returns a flat node list; the commands that diff these expect a tree.
 *
 * Ported unchanged from the spec, including which properties are carried
 * (`checked` / `disabled` / `expanded` / `selected` / `level`) — the `.a11y.json` files on disk
 * are compared against baselines captured by the old path, so changing the shape here would
 * report every baseline as a semantic diff.
 */
export function cdpNodesToTree(nodes: readonly CdpAxNode[]): unknown {
  if (!nodes || nodes.length === 0) return { role: "document", name: "", children: [] };

  const nodeMap = new Map<string, Record<string, unknown>>();
  const childMap = new Map<string, string[]>();
  for (const node of nodes) {
    const props: Record<string, unknown> = {};
    for (const p of node.properties ?? []) props[p.name] = p.value?.value;
    const treeNode: Record<string, unknown> = {
      role: node.role?.value ?? "none",
      name: node.name?.value ?? "",
    };
    if (props.checked !== undefined) treeNode.checked = props.checked;
    if (props.disabled !== undefined) treeNode.disabled = props.disabled;
    if (props.expanded !== undefined) treeNode.expanded = props.expanded;
    if (props.selected !== undefined) treeNode.selected = props.selected;
    if (props.level !== undefined) treeNode.level = props.level;
    nodeMap.set(node.nodeId, treeNode);
    if (node.childIds) childMap.set(node.nodeId, node.childIds);
  }

  const seen = new Set<string>();
  const buildTree = (nodeId: string): Record<string, unknown> | null => {
    // Cycle guard the spec did not have: a malformed `childIds` (or an id appearing under two
    // parents) recursed forever, and a hung capture is indistinguishable from a slow page.
    if (seen.has(nodeId)) return null;
    seen.add(nodeId);
    const node = nodeMap.get(nodeId);
    if (!node) return null;
    const children = (childMap.get(nodeId) ?? [])
      .map(buildTree)
      .filter((c): c is Record<string, unknown> => c !== null);
    if (children.length > 0) node.children = children;
    return node;
  };
  return buildTree(nodes[0]!.nodeId) ?? { role: "document", name: "", children: [] };
}
