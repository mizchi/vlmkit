/**
 * `vlmkit record <url>`: open a browser, let a person click through the page, and write what they
 * did as a session trace (`vlmkit-trace/1`) with what each step changed. `vlmkit export
 * playwright` turns the trace into an `@playwright/test` spec.
 *
 * The browser is headed: it needs a display, so it runs on your own machine, not in CI. Close the
 * window, or press Ctrl-C, to finish.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { isCliEntry } from "@mizchi/vlmkit-core/plugin/cli-entry.ts";
import { hasFlag, readFlag, readInt } from "@mizchi/vlmkit-core/arg-reader.ts";
import { UsageError } from "@mizchi/vlmkit-core/cli-error.ts";
import { sourceToUrl } from "@mizchi/vlmkit-core/page-open.ts";
import { BOLD, CYAN, DIM, GREEN, RESET, YELLOW } from "@mizchi/vlmkit-core/terminal-colors.ts";
import { compileTrace, describeAction, type SessionTrace } from "@mizchi/vlmkit-judge/session-trace.ts";

const USAGE = `vlmkit record <html-or-url> [--out trace.json] [--spec out.spec.ts]

Opens a browser on the page and records what you do: each click, typed field, select, checkbox
and key, with what the step changed (the URL, ARIA state, text that appeared or changed, an
element shown or gone, where focus went). Close the window or press Ctrl-C to finish.

The trace is vlmkit-trace/1; \`vlmkit export playwright <trace>\` writes an @playwright/test spec
from it (or pass --spec here).

Options:
  --out <file>               where to write the trace (default .vlmkit/traces/<time>.json)
  --spec <file>              also write the spec
  --viewport WxH             default 1280x800
  --color-scheme light|dark  emulated prefers-color-scheme, recorded in the trace
  --reduced-motion           emulate prefers-reduced-motion: reduce, recorded in the trace
  --storage-state <file>     Playwright storage state for a page behind a login
  --headless                 no window (for scripted sessions; a person needs the window)
  --for <ms>                 stop after this long instead of waiting for the window to close`;

export async function main(argv = process.argv.slice(2)): Promise<number> {
  if (argv.length === 0 || hasFlag(argv, "help") || argv.includes("-h")) {
    console.log(USAGE);
    return argv.length === 0 ? 2 : 0;
  }
  const valued = new Set(["--out", "--spec", "--viewport", "--color-scheme", "--storage-state", "--for"]);
  const positional = argv.filter((a, i) => !a.startsWith("--") && !(i > 0 && valued.has(argv[i - 1]!)));
  if (positional.length !== 1) throw new UsageError(`record takes one page or URL, got ${positional.length}`);
  const vp = readFlag(argv, "viewport");
  const m = vp?.match(/^(\d+)x(\d+)$/);
  if (vp && !m) throw new UsageError(`--viewport expects WxH, got ${vp}`);
  const viewport = m ? { width: Number(m[1]), height: Number(m[2]) } : { width: 1280, height: 800 };
  const scheme = readFlag(argv, "color-scheme");
  if (scheme && scheme !== "light" && scheme !== "dark")
    throw new UsageError(`--color-scheme takes light or dark, got ${scheme}`);
  const reduced = hasFlag(argv, "reduced-motion");
  const headless = hasFlag(argv, "headless");
  const forMs = readInt(argv, "for", { min: 1 });
  const out = resolve(readFlag(argv, "out") ?? `.vlmkit/traces/${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  const specOut = readFlag(argv, "spec");
  const storageState = readFlag(argv, "storage-state");

  const { launchBrowser } = await import("@mizchi/vlmkit-core/browser-launch.ts");
  const { TraceRecorder } = await import("@mizchi/vlmkit-markup/record/trace-recorder.ts");
  let browser;
  try {
    browser = await launchBrowser({ launch: { headless } });
  } catch (e) {
    if (!headless && !process.env.DISPLAY && process.platform === "linux")
      throw new UsageError(
        `record opens a window, and this machine has no display (DISPLAY is unset). Run it on your own machine, or drive the page another way: vlmkit act --trace writes the same trace. (${(e as Error).message.split("\n")[0]})`,
      );
    throw e;
  }
  let trace: SessionTrace;
  let dropped = 0;
  let lost = 0;
  try {
    const context = await browser.newContext({
      viewport,
      ...(scheme ? { colorScheme: scheme as "light" | "dark" } : {}),
      ...(reduced ? { reducedMotion: "reduce" as const } : {}),
      ...(storageState ? { storageState } : {}),
    });
    const page = await context.newPage();
    await page.goto(sourceToUrl(positional[0]!), { waitUntil: "load" });
    const rec = new TraceRecorder(page, {
      recordedBy: "vlmkit record",
      ...(scheme ? { colorScheme: scheme as "light" | "dark" } : {}),
      ...(reduced ? { reducedMotion: "reduce" as const } : {}),
    });
    await rec.start();
    await rec.listen();
    console.log(`${BOLD}${CYAN}vlmkit record${RESET}  ${DIM}${page.url()}${RESET}`);
    console.log(
      `${DIM}recording — ${forMs ? `stopping in ${forMs}ms` : "close the window or press Ctrl-C to finish"}${RESET}`,
    );

    await new Promise<void>((resolveDone) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const done = () => {
        if (timer) clearTimeout(timer);
        process.off("SIGINT", done);
        resolveDone();
      };
      page.on("close", done);
      process.once("SIGINT", done);
      if (forMs) timer = setTimeout(done, forMs);
    });
    trace = await rec.stop().catch(async () => rec.stop());
    dropped = rec.droppedExpectations;
    lost = rec.lostSteps;
  } finally {
    await browser.close().catch(() => {});
  }
  await writeTrace(trace, out, specOut);
  if (lost > 0)
    console.log(
      `${YELLOW}!${RESET} ${lost} action(s) left out: the window closed before they could be read. Wait a moment after the last action before closing it`,
    );
  if (dropped > 0)
    console.log(
      `${YELLOW}!${RESET} ${dropped} observed change(s) left out: no locator resolved to their element alone`,
    );
  return 0;
}

export async function writeTrace(
  trace: SessionTrace,
  out: string,
  specOut?: string,
  log: (line: string) => void = console.log,
): Promise<void> {
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, JSON.stringify(trace, null, 2) + "\n");
  log(`\n${trace.steps.length} step(s):`);
  for (const [i, s] of trace.steps.entries())
    log(`  ${String(i + 1).padStart(2)}. ${describeAction(s.action)}  ${DIM}${s.expect.length} expect${RESET}`);
  log(`\n${GREEN}trace${RESET} ${out}`);
  if (specOut) {
    const path = resolve(specOut);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, compileTrace(trace, { tracePath: out }));
    log(`${GREEN}spec${RESET}  ${path}`);
  } else log(`${DIM}next: vlmkit export playwright ${out} --out tests/recorded.spec.ts${RESET}`);
}

if (isCliEntry(import.meta.url, "record-cli")) {
  const { handleCliError } = await import("@mizchi/vlmkit-core/cli-error.ts");
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch(handleCliError);
}
