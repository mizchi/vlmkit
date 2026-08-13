/**
 * `vlmkit.gates.json`'s `webServer` — start a dev server, wait until it serves,
 * run the gates, stop it.
 *
 * Playwright has had this for years and this config did not. v6's adopting agent
 * routed around it with a HAR recording and named the cost of not having the
 * idea: "the HAR path made it moot here", but otherwise you write start, trap
 * kill and poll-for-ready by hand in a shell wrapper, once per CI job. A config
 * that says which URLs to gate but cannot say how to bring them up is committed
 * only halfway.
 *
 * Two things this must not do, both learned from the gates it drives:
 *
 *   - **Report "started" for "spawned".** The readiness probe is mandatory. A
 *     gate that races the bundler produces a finding indistinguishable from a
 *     real one, and this whole toolkit exists to make findings trustworthy.
 *   - **Leave the process behind.** Teardown runs on the normal path, on a
 *     thrown error, and on SIGINT/SIGTERM. A leaked dev server poisons the next
 *     run through `reuseExistingServer`, which is the one failure that would be
 *     blamed on the tool having no `webServer` at all.
 */
import { type ChildProcess, spawn } from "node:child_process";
import { resolve } from "node:path";
import type { GateWebServer } from "@mizchi/vlmkit-core/gate-config.ts";
import { shouldReuseExistingServer } from "@mizchi/vlmkit-core/gate-config.ts";
import { UsageError } from "@mizchi/vlmkit-core/cli-error.ts";
import { DIM, GREEN, RESET, YELLOW } from "@mizchi/vlmkit-core/terminal-colors.ts";

const DEFAULT_TIMEOUT_MS = 60_000;
const POLL_INTERVAL_MS = 250;

export interface StartedWebServer {
  /** Stop the server. Safe to call more than once. */
  stop(): Promise<void>;
  /** True when an already-listening server was adopted rather than spawned. */
  reused: boolean;
}

/**
 * Does `url` answer at all?
 *
 * Any HTTP response counts, including 404 and 500: the question is whether
 * something is listening and handling requests, not whether that particular
 * path exists. A dev server whose root 404s while the routes work is common, and
 * refusing to proceed there would be a readiness probe that is wrong more often
 * than the thing it is checking.
 */
async function responds(url: string, signal?: AbortSignal): Promise<boolean> {
  try {
    const init: RequestInit = { redirect: "manual", ...(signal ? { signal } : {}) };
    await fetch(url, init);
    return true;
  } catch {
    return false;
  }
}

async function waitForResponse(url: string, timeoutMs: number, child?: ChildProcess): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let exited: number | null = null;
  child?.once("exit", (code) => { exited = code ?? 0; });
  while (Date.now() < deadline) {
    if (await responds(url)) return;
    // A server that has already died will never answer. Failing now, with its
    // exit code, beats spending the rest of the timeout on a corpse and then
    // reporting a timeout — the wrong diagnosis for a command that did not run.
    if (exited !== null) {
      throw new UsageError(
        `webServer exited with code ${exited} before ${url} responded.`
        + ` Its output is above — the command itself is the thing to fix, not the timeout.`,
      );
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new UsageError(
    `webServer did not serve ${url} within ${timeoutMs}ms.`
    + ` Raise webServer.timeout if the build is genuinely slower than that, or check that`
    + ` the command serves this exact URL — the probe accepts any HTTP response, so a`
    + ` timeout means nothing is listening.`,
  );
}

/**
 * Start the server (or adopt a running one) and return a handle that stops it.
 *
 * `baseDir` is the config file's directory, so a relative `cwd` resolves the way
 * every other relative path in the config does.
 */
export async function startWebServer(
  server: GateWebServer,
  baseDir: string,
  log: (message: string) => void = (m) => console.error(m),
): Promise<StartedWebServer> {
  const timeout = server.timeout ?? DEFAULT_TIMEOUT_MS;
  const reuse = shouldReuseExistingServer(server);
  if (reuse && await responds(server.url)) {
    log(`${DIM}webServer: reusing the server already answering ${server.url}${RESET}`);
    return { reused: true, stop: async () => {} };
  }
  const cwd = server.cwd ? resolve(baseDir, server.cwd) : baseDir;
  log(`${DIM}webServer: ${server.command}${RESET}`);
  const child = spawn(server.command, {
    cwd,
    shell: true,
    // Inherited, so the server's own startup errors reach the terminal. A dev
    // server that fails to boot has already explained why; swallowing that and
    // printing a timeout would replace the answer with a symptom.
    stdio: ["ignore", "inherit", "inherit"],
    env: { ...process.env, ...server.env },
    // Its own group, so `stop` can take the whole tree down. `npm run dev` is a
    // shell that spawns a bundler that spawns a watcher; killing the shell alone
    // leaves the port held and the next run reusing a server nobody started.
    detached: true,
  });
  let stopped = false;
  const stop = async (): Promise<void> => {
    if (stopped) return;
    stopped = true;
    if (child.exitCode !== null || child.signalCode !== null) return;
    const done = new Promise<void>((r) => child.once("exit", () => r()));
    try {
      process.kill(-child.pid!, "SIGTERM");
    } catch {
      // Already gone, or never had a group. Either way there is nothing to stop.
      return;
    }
    // SIGKILL after a grace period: a bundler that ignores SIGTERM would
    // otherwise hold the run open forever, and the gates are already finished.
    const forced = setTimeout(() => {
      try {
        process.kill(-child.pid!, "SIGKILL");
      } catch { /* raced with a normal exit */ }
    }, 5_000);
    await done;
    clearTimeout(forced);
  };
  try {
    await waitForResponse(server.url, timeout, child);
  } catch (error) {
    await stop();
    throw error;
  }
  log(`${GREEN}webServer: ${server.url} is serving${RESET}`);
  return { reused: false, stop };
}

/**
 * Run `body` with the server up, and stop it afterwards no matter how `body`
 * ends — return, throw, or the user pressing Ctrl-C.
 *
 * The signal handlers are the reason this is a wrapper rather than two exported
 * calls: a `try`/`finally` at the call site would still leak the server on
 * SIGINT, and that leak is worse than the missing feature was, because
 * `reuseExistingServer` would then hand the stale process to the next run.
 */
export async function withWebServer<T>(
  server: GateWebServer | undefined,
  baseDir: string,
  body: () => Promise<T>,
  log?: (message: string) => void,
): Promise<T> {
  if (!server) return body();
  const started = await startWebServer(server, baseDir, log);
  const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];
  const onSignal = (signal: NodeJS.Signals) => {
    void started.stop().then(() => {
      // Re-raise with the handler removed, so the exit code is the one the
      // signal would have produced rather than a plain 0.
      process.removeListener(signal, onSignal);
      process.kill(process.pid, signal);
    });
  };
  for (const signal of signals) process.once(signal, onSignal);
  try {
    return await body();
  } finally {
    for (const signal of signals) process.removeListener(signal, onSignal);
    await started.stop();
    if (!started.reused) (log ?? ((m: string) => console.error(m)))(`${DIM}webServer: stopped${RESET}`);
  }
}

/** One line for `gates list`, which does not start anything. */
export function formatWebServerPlan(server: GateWebServer): string {
  const reuse = shouldReuseExistingServer(server);
  return `${DIM}webServer:${RESET} ${server.command} ${DIM}→ ${server.url}`
    + ` (${reuse ? "reuses a running server" : `${YELLOW}always starts its own${RESET}${DIM}`}`
    + `, timeout ${server.timeout ?? DEFAULT_TIMEOUT_MS}ms)${RESET}`;
}
