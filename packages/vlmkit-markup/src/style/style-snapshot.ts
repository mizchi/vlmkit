/**
 * Collect once, judge many: `check design`, `check composition` and `check color` from one
 * page load.
 *
 * The three gates read nearly the same boxes, and each used to launch its own browser to
 * read them: the same 1280x900 page, the same `networkidle` load, the same `settlePage(250)`,
 * the same redirect check — three times. A snapshot does the load once, runs each gate's own
 * collector (`COLLECT_DESIGN_SAMPLES`, `COLLECT_COMPOSITION`, `COLLECT_COLOR_ROLES`) in it,
 * and keeps what they return. Each gate then judges its part with `--from` and no browser.
 *
 * **Why the gates' own collectors, not one merged scene.** A single `SceneElement` list can
 * already feed all five scene-capable judges, but the scene's one `role` field cannot carry
 * both vocabularies: `check design` groups by `button` / `input:text` / `h2` and skips links,
 * while `check color` needs `field` / `link`. Writing either one into `role` changes the other
 * gate's verdict. Keeping each collector's output as it is makes a snapshot judgement identical
 * to the live run — `style-snapshot.test.ts` requires the reports to be equal — and merging the
 * three into one scene stays a separate step with that conflict to resolve first.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { withBrowser } from "@mizchi/vlmkit-core/browser-launch.ts";
import { withAuthState } from "@mizchi/vlmkit-core/auth-state.ts";
import { describeRedirect } from "@mizchi/vlmkit-core/navigation-redirect.ts";
import { settlePage, sourceToUrl } from "@mizchi/vlmkit-core/page-open.ts";
import type { PageLoadOptions } from "@mizchi/vlmkit-core/page-load.ts";
import { UsageError } from "@mizchi/vlmkit-core/cli-error.ts";
import { firstPositionalOrUndefined } from "@mizchi/vlmkit-core/plugin/args.ts";
import { buildDesignSampleScript, type DesignPolicyInput } from "./design-policy.ts";
import { COLLECT_COMPOSITION, type CompositionInput } from "./composition.ts";
import { COLLECT_COLOR_ROLES, type ColorRolesInput } from "./color-roles.ts";

export const STYLE_SNAPSHOT_FORMAT = "vlmkit-style-snapshot/1";

/** Where `scan style` writes when `--out` is not given. */
export const DEFAULT_STYLE_SNAPSHOT = ".vlmkit/style-snapshot.json";

export interface StyleSnapshot {
  format: typeof STYLE_SNAPSHOT_FORMAT;
  /** The page as it was named on the command line; every report built from this names it. */
  source: string;
  /** `describeRedirect`'s message when the URL landed elsewhere, else null. */
  redirect: string | null;
  /** One width for all three: a snapshot is one render. */
  viewport: { width: number; height: number };
  /** `--exclude` selectors applied to the design collection at capture time. */
  exclude: string[];
  design: DesignPolicyInput;
  composition: CompositionInput;
  color: ColorRolesInput;
}

export interface StyleSnapshotOptions extends PageLoadOptions {
  source: string;
  /** Viewport width; 1280 by default, as each gate's own runner uses. */
  viewport?: number;
  /** Vendor subtrees to leave out of the design collection (`check design --exclude`). */
  exclude?: readonly string[];
  storageState?: string;
  /** File to write the snapshot to. */
  out?: string;
}

/**
 * Load the page once, exactly as the three runners each did, and run all three collectors.
 * The collectors only read the page, so their order does not matter.
 */
export async function captureStyleSnapshot(options: StyleSnapshotOptions): Promise<StyleSnapshot> {
  const snapshot = await withBrowser(async (browser) => {
    const width = options.viewport ?? 1280;
    const page = await browser.newPage(withAuthState({ viewport: { width, height: 900 } }, options.storageState));
    if (options.har) await page.routeFromHAR(resolve(options.har), { notFound: "abort" });
    const isUrl = /^https?:\/\//.test(options.source);
    await page.goto(sourceToUrl(options.source), {
      waitUntil: options.waitUntil ?? "networkidle",
      timeout: options.timeout ?? 30000,
    });
    await settlePage(page, 250);
    const redirect = isUrl ? describeRedirect(options.source, page.url()) : null;
    const exclude = [...(options.exclude ?? [])];
    const design = await page.evaluate(buildDesignSampleScript(exclude)) as DesignPolicyInput;
    const composition = await page.evaluate(COLLECT_COMPOSITION) as CompositionInput;
    const color = await page.evaluate(COLLECT_COLOR_ROLES) as ColorRolesInput;
    return {
      format: STYLE_SNAPSHOT_FORMAT,
      source: options.source,
      redirect,
      viewport: { width, height: 900 },
      exclude,
      design,
      composition,
      color,
    } satisfies StyleSnapshot;
  });
  if (options.out) {
    const target = resolve(options.out);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, JSON.stringify(snapshot) + "\n");
  }
  return snapshot;
}

/** Read a snapshot written by `scan style`, refusing anything else by name. */
export async function readStyleSnapshot(path: string): Promise<StyleSnapshot> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    throw new UsageError(`--from ${path}: cannot read a style snapshot (${(error as Error).message})`);
  }
  const record = parsed as Partial<StyleSnapshot> | null;
  if (!record || record.format !== STYLE_SNAPSHOT_FORMAT) {
    throw new UsageError(
      `--from ${path} is not a style snapshot (format ${JSON.stringify(record?.format ?? null)}; expected "${STYLE_SNAPSHOT_FORMAT}").`
      + " Write one with: vlmkit scan style <page> --out <file>",
    );
  }
  if (!record.design || !record.composition || !record.color || typeof record.source !== "string") {
    throw new UsageError(`--from ${path}: the snapshot is missing a part (design, composition, color or source).`);
  }
  return record as StyleSnapshot;
}

/** Flags a live run reads while loading the page; with `--from` the page was loaded at capture. */
const CAPTURE_FLAGS = ["viewport", "storage-state", "timeout", "wait-until", "har", "elements"];

/**
 * `--from` for a gate: the snapshot path, or undefined when the flag is absent. Refuses a page
 * source next to it, and every flag that only means something while loading a page, by name —
 * a `--viewport 375` that silently judged the snapshot's 1280 would be a wrong answer with no
 * sign of it.
 */
export function readFromSnapshotFlag(
  argv: readonly string[],
  command: string,
  valueFlags: readonly string[],
  alsoRefused: readonly string[] = [],
): string | undefined {
  const at = argv.findIndex((arg) => arg === "--from" || arg.startsWith("--from="));
  if (at === -1) return undefined;
  const from = argv[at]!.startsWith("--from=") ? argv[at]!.slice("--from=".length) : argv[at + 1];
  if (!from || from.startsWith("--")) throw new UsageError(`--from needs a snapshot file: vlmkit ${command} --from snap.json`);
  if (firstPositionalOrUndefined(argv, [...valueFlags, "--from"])) {
    throw new UsageError(`${command} takes a page source or --from, not both: the snapshot already names its page.`);
  }
  for (const flag of [...CAPTURE_FLAGS, ...alsoRefused]) {
    if (argv.some((arg) => arg === `--${flag}` || arg.startsWith(`--${flag}=`))) {
      throw new UsageError(`--${flag} does not apply with --from: it was fixed when the snapshot was captured (vlmkit scan style --${flag} …).`);
    }
  }
  return from;
}
