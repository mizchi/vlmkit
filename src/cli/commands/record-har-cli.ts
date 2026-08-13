/**
 * `vlmkit snapshot record-har <url> [--out app.har]` — record the network a gate
 * will replay.
 *
 * `--har` is the documented answer to "this page reads live endpoints and the numbers
 * move between runs", and until now the recording step was a doc sentence: "record a
 * HAR with Playwright and replay it during the gate". v5's CI agent, handed exactly
 * that task, wrote its own 20-line recorder to finish:
 *
 *   "`--har` is the documented reproducibility answer and there is no recorder. […]
 *    so every project writes the same 20-line script. That is the
 *    knowledge-in-shell-history problem one level down."
 *
 * Which is the same complaint the project already accepted for `--fail-on-diff` and
 * for baseline approval: if every consumer has to write the same wrapper, the wrapper
 * is a missing command.
 *
 * The recording is deliberately made the way the gate will replay it — same
 * navigation milestone, same viewport-independent context — because a HAR recorded
 * over a different navigation is the stale-fixture case on day one.
 */
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { chromium } from "playwright";
import { UsageError, handleCliError } from "@mizchi/vlmkit-core/cli-error.ts";
import { hasFlag, readFlag, readInt } from "@mizchi/vlmkit-core/arg-reader.ts";
import { BOLD, CYAN, DIM, GREEN, RESET, YELLOW } from "@mizchi/vlmkit-core/terminal-colors.ts";
import {
  DEFAULT_PAGE_LOAD_TIMEOUT_MS,
  PAGE_LOAD_WAIT_UNTIL,
  type PageLoadWaitUntil,
} from "@mizchi/vlmkit-core/page-load.ts";

function usage(): string {
  return [
    "Usage:",
    "  vlmkit snapshot record-har <url> [--out app.har] [--wait-until <state>] [--timeout ms] [--settle ms]",
    "",
    "Record the network a gate will replay with --har.",
    "",
    "Options:",
    "  --out <file>          Output HAR (default app.har)",
    `  --wait-until <state>  ${PAGE_LOAD_WAIT_UNTIL.join(" | ")} (default load)`,
    "  --timeout <ms>        Navigation timeout (default 30000)",
    "  --settle <ms>         Extra quiet time after the milestone, for late XHR (default 1000)",
    "  --no-content          Record headers only, not response bodies (much smaller, replays worse)",
    "",
    "  Record it the way the gate will replay it: a HAR made over a different",
    "  navigation is a stale fixture on day one. `networkidle` is NOT the default here,",
    "  for the reason --har exists — a page with a held-open stream never reaches it.",
    "",
    "Examples:",
    "  vlmkit snapshot record-har http://localhost:5173/ --out fixtures/app.har",
    "  vlmkit check integrity http://localhost:5173/ --har fixtures/app.har",
  ].join("\n");
}

interface RecordArgs {
  url: string;
  out: string;
  waitUntil: PageLoadWaitUntil;
  timeout: number;
  settleMs: number;
  content: "embed" | "omit";
}

export function parseArgs(argv: readonly string[]): RecordArgs {
  // `--help` is a request that was satisfied, not a misuse: printing usage with an
  // `error:` prefix and exit 1 is what every other command here avoids.
  if (hasFlag(argv, "help") || hasFlag(argv, "h")) {
    console.log(usage());
    process.exit(0);
  }
  if (argv.length === 0) throw new UsageError(`a URL is required.\n\n${usage()}`);
  const positional = argv.find((a) => !a.startsWith("-")
    && !["--out", "--wait-until", "--timeout", "--settle"].includes(argv[argv.indexOf(a) - 1] ?? ""));
  if (!positional) throw new UsageError(`a URL is required.\n\n${usage()}`);
  if (!/^https?:\/\//.test(positional)) {
    // A file:// page has no network to pin, so recording one is always a mistake
    // rather than a no-op worth allowing.
    throw new UsageError(
      `record-har needs an http(s) URL, got "${positional}".`
      + ` A local file has no network to pin — pass the file straight to the gate instead.`,
    );
  }
  const waitUntil = (readFlag(argv, "wait-until") ?? "load") as PageLoadWaitUntil;
  if (!PAGE_LOAD_WAIT_UNTIL.includes(waitUntil)) {
    throw new UsageError(`--wait-until must be one of ${PAGE_LOAD_WAIT_UNTIL.join(", ")}, got "${waitUntil}"`);
  }
  return {
    url: positional,
    out: readFlag(argv, "out") ?? "app.har",
    waitUntil,
    timeout: readInt(argv, "timeout", { min: 1 }) ?? DEFAULT_PAGE_LOAD_TIMEOUT_MS,
    settleMs: readInt(argv, "settle", { min: 0 }) ?? 1000,
    content: hasFlag(argv, "no-content") ? "omit" : "embed",
  };
}

export async function recordHarCli(argv: readonly string[]): Promise<void> {
  const args = parseArgs(argv);
  const out = resolve(args.out);
  await mkdir(dirname(out), { recursive: true });

  const requested: string[] = [];
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ recordHar: { path: out, content: args.content } });
    const page = await context.newPage();
    page.on("request", (r) => requested.push(r.url()));
    await page.goto(args.url, { waitUntil: args.waitUntil, timeout: args.timeout });
    // Late XHR is the common case for a dashboard: the metrics call lands after the
    // milestone, and a recording without it is stale before it is written.
    if (args.settleMs > 0) await page.waitForTimeout(args.settleMs);
    // The HAR is flushed on context close, not on browser close.
    await context.close();
  } finally {
    await browser.close();
  }

  const origins = [...new Set(requested.map((u) => {
    try {
      return new URL(u).origin;
    } catch {
      return null;
    }
  }).filter((o): o is string => o !== null))];

  console.log("");
  console.log(`  ${BOLD}${CYAN}Recorded HAR${RESET}`);
  console.log(`  ${DIM}${requested.length} request(s) across ${origins.length} origin(s): ${origins.join(", ")}${RESET}`);
  console.log(`  ${DIM}wait-until ${args.waitUntil}, settle ${args.settleMs}ms, bodies ${args.content === "embed" ? "embedded" : "omitted"}${RESET}`);
  console.log(`  ${GREEN}${out}${RESET}`);
  // Said at record time, because both are silent at replay time until something is
  // already wrong: the recording is keyed on the full URL, and it ages.
  console.log(`  ${DIM}Replay: --har ${args.out}${RESET}`);
  console.log(
    `  ${YELLOW}Keyed on the full URL${RESET}${DIM}, so it only replays for ${origins[0] ?? args.url}`
    + ` — a different host or port stops matching. Re-record when the page starts calling a new endpoint.${RESET}`,
  );
}

if (
  process.env.__VLMKIT_DISPATCHER_LEAF__ === "record-har-cli"
  || (process.argv[1] && (process.argv[1].endsWith("record-har-cli.ts") || process.argv[1].endsWith("record-har-cli.mjs")))
) {
  recordHarCli(process.argv.slice(2)).catch(handleCliError);
}

export { usage };
