/**
 * `vlmkit check a11y tree`: judge a `vlmkit-a11y/1` tree and its frame. No browser.
 *
 * Four rules over one tree, each the question a DOM gate asks of a page, asked of whatever
 * platform wrote the tree:
 *
 *   unlabelled-control   an operable node announced as nothing (WCAG 4.1.2)
 *   unreachable-content  named content past the viewport with nothing that scrolls to it
 *   contrast-below-aa    text under 4.5:1 / 3:1, measured on the frame's pixels (1.4.3)
 *   target-undersized    an operable node under 24 units on its shorter side (2.5.8)
 *
 * The judging is `@mizchi/vlmkit-judge/a11y-tree.ts`; the touch floor is `check a11y
 * touch`'s own policy (`analyzeA11yTouch`), fed the tree's operable nodes, so the two gates
 * cannot disagree about a 24px target.
 */
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { decodePng } from "@mizchi/vlmkit-core/png-utils.ts";
import { UsageError } from "@mizchi/vlmkit-core/cli-error.ts";
import {
  isInteractive,
  judgeUnlabelledControls,
  judgeUnreachableContent,
  measurePixelContrast,
  parseA11yTree,
  type A11yNode,
  type PixelContrastReport,
  type UnlabelledControl,
  type UnreachableContent,
} from "@mizchi/vlmkit-judge/a11y-tree.ts";
import { parseSelectorAllowRules, selectorAllowFilter } from "@mizchi/vlmkit-judge/allow.ts";
import { analyzeA11yTouch, type TouchTargetFinding, type WcagTouchLevel } from "../a11y-touch.ts";
import { requiredTouchSide } from "../markup-core-a11y-touch.ts";

export interface CheckA11yTreeOptions {
  /** The tree file. */
  source: string;
  /** Frame PNG; default: the tree's own `frame`, relative to the tree file. */
  image?: string;
  level?: WcagTouchLevel;
  allow?: string[];
}

export interface CheckA11yTreeReport {
  source: string;
  platform: string;
  frame: string | null;
  viewport: { width: number; height: number };
  inspected: { nodes: number; interactive: number; text: number };
  unlabelled: UnlabelledControl[];
  unreachable: UnreachableContent[];
  /** Null when there is no frame: contrast was not measured, which the report says. */
  contrast: PixelContrastReport | null;
  touch: {
    level: WcagTouchLevel;
    required: number;
    failures: TouchTargetFinding[];
    /** Under the floor and excused by the criterion's own spacing exception — listed, not dropped. */
    wcagExempt: TouchTargetFinding[];
    /** Under the floor, inside an operable ancestor that meets it — judged as that ancestor. */
    enclosed: Array<{ path: string; name: string; by: string }>;
  };
  allowed: { selector: string; reason: string }[];
  unusedAllow: string[];
}

/** What `--allow` matches against: the node's path and its quoted name. */
export const allowKey = (path: string, name: string | undefined): string => `${path} "${name ?? ""}"`;

export async function runCheckA11yTree(options: CheckA11yTreeOptions): Promise<CheckA11yTreeReport> {
  const treePath = resolve(options.source);
  let text: string;
  try {
    text = await readFile(treePath, "utf8");
  } catch (error) {
    throw new UsageError(`cannot read ${options.source}: ${(error as Error).message}`);
  }
  const tree = parseA11yTree(text);
  const framePath = options.image ? resolve(options.image) : tree.frame ? resolve(dirname(treePath), tree.frame) : null;
  let contrast: PixelContrastReport | null = null;
  if (framePath) {
    let frame;
    try {
      frame = await decodePng(framePath);
    } catch (error) {
      throw new UsageError(`cannot read the frame ${framePath}: ${(error as Error).message}`);
    }
    contrast = measurePixelContrast(tree, frame);
  }
  const byPath = new Map(tree.nodes.map((n) => [n.path, n]));
  const nameOf = (path: string) => byPath.get(path)?.name;
  const filter = selectorAllowFilter(parseSelectorAllowRules(options.allow ?? []));
  const keep = (path: string) => filter.keep(allowKey(path, nameOf(path)));

  const level = options.level ?? "AA";
  const operable = tree.nodes.filter(
    (n: A11yNode) => isInteractive(n) && n.states?.disabled !== true && n.states?.hidden !== true,
  );
  // A small control inside an operable ancestor that already meets the floor is not the only
  // target: ofc-app's "Place in Top" button is 17px tall, and the 35px row around it takes the
  // same tap. Listed as enclosed, not judged — the ancestor is judged in its place.
  const floor = requiredTouchSide(level);
  const minSide = (n: A11yNode) => Math.min(n.rect.width, n.rect.height);
  const enclosing = (n: A11yNode) =>
    operable.find((a) => a !== n && n.path.startsWith(`${a.path}>`) && minSide(a) >= floor);
  const enclosed = operable.filter((n) => minSide(n) < floor && enclosing(n))
    .map((n) => ({ path: n.path, name: n.name ?? "", by: enclosing(n)!.path }));
  const judged = operable.filter((n) => !enclosed.some((e) => e.path === n.path));
  const touch = analyzeA11yTouch(
    judged.map((n) => ({
      path: n.path,
      tag: n.role,
      text: n.name ?? "",
      bbox: { x: n.rect.left, y: n.rect.top, width: n.rect.width, height: n.rect.height },
    })),
    level,
  );
  const unlabelled = judgeUnlabelledControls(tree).filter((f) => keep(f.path));
  const unreachable = judgeUnreachableContent(tree).filter((f) => keep(f.first.path));
  if (contrast) contrast = { ...contrast, failures: contrast.failures.filter((f) => keep(f.path)) };
  const touchFailures = touch.failures.filter((f) => keep(f.path));

  return {
    source: options.source,
    platform: tree.platform ?? "unknown",
    frame: framePath,
    viewport: tree.viewport,
    inspected: {
      nodes: tree.nodes.length,
      interactive: operable.length,
      text: contrast ? contrast.samples.length : 0,
    },
    unlabelled,
    unreachable,
    contrast,
    touch: { level, required: touch.required, failures: touchFailures, wcagExempt: touch.wcagExempt, enclosed },
    allowed: filter.allowed,
    unusedAllow: filter.unused(),
  };
}
