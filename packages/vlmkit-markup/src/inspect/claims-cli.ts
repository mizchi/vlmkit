/**
 * `vlmkit inspect claims <page|screenshot.png> --forbid "<statement>" --expect "<statement>"`:
 * what a person would notice at a glance, asked of a screenshot as typed yes/no questions.
 *
 * Each statement is one Jev `noul` (TypeSafe; TYPESAFEAI_API_KEY), all in one request on one
 * image: ~$0.0002 and ~0.2s for a handful. `--forbid` fails when the screenshot shows it, `--expect`
 * when it does not. Exit 0 all pass, 1 any fails, 2 usage. Advisory: a model's reading of the
 * pixels, not a measurement — the deterministic gates (`check integrity`, …) are what to gate on.
 */
import { readFile, writeFile } from "node:fs/promises";
import { isCliEntry } from "@mizchi/vlmkit-core/plugin/cli-entry.ts";
import { handleCliError } from "@mizchi/vlmkit-core/cli-error.ts";
import type { Claim } from "@mizchi/vlmkit-ai/claims.ts";

export const CLAIMS_USAGE = `Usage: vlmkit inspect claims <page.html|url|screenshot.png> [--forbid "<statement>"]... [--expect "<statement>"]... [options]

Ask what a screenshot visibly shows, one yes/no question per statement, answered
by TypeSafe Jev (TYPESAFEAI_API_KEY) in one request: ~$0.0002 and ~0.2s.
A page is screenshotted at the viewport first. Advisory: a model's reading of
the pixels; gate on the deterministic checks.

  --forbid <statement>   Fails when the screenshot shows it ("an error message")
  --expect <statement>   Fails when it does not ("a login form")
  --claims <file.json>   [{ "statement": "...", "expect": "shown" | "absent" }, ...]
  --viewport <WxH>       For a page (default 1280x800)
  --save <out.png>       Keep the screenshot that was asked about
  --threshold <0-1>      A statement is true at or above this (default 0.5)
  --json                 Print the results as JSON

Exit: 0 every claim holds, 1 one does not, 2 usage error.
Measured (5 statements on 9 fixtures, clean and with each defect planted): every
planted defect but one caught, 0 false alarms on 43 clean-page cases.
Answers within 0.3 of the threshold are marked uncertain: 10 of the 12 wrong
answers in that round were. docs/reports/2026-10-17-jev-claims.md`;

export interface ClaimsCliOptions {
  source: string;
  claims: Claim[];
  claimsFile?: string;
  viewport: { width: number; height: number };
  save?: string;
  threshold: number;
  json: boolean;
}

export class ClaimsUsageError extends Error {}

export function parseClaimsArgs(argv: string[]): ClaimsCliOptions {
  const positional: string[] = [];
  const claims: Claim[] = [];
  let claimsFile: string | undefined;
  let viewport = { width: 1280, height: 800 };
  let save: string | undefined;
  let threshold = 0.5;
  let json = false;
  const value = (flag: string, v: string | undefined) => {
    if (v === undefined || v.startsWith("--")) throw new ClaimsUsageError(`${flag} needs a value`);
    return v;
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    switch (a) {
      case "--forbid":
      case "--expect": {
        const statement = value(a, argv[++i]).trim();
        if (!statement) throw new ClaimsUsageError(`${a} needs a statement`);
        claims.push({ statement, expect: a === "--forbid" ? "absent" : "shown" });
        break;
      }
      case "--claims":
        claimsFile = value(a, argv[++i]);
        break;
      case "--viewport": {
        const m = /^(\d+)x(\d+)$/.exec(value(a, argv[++i]));
        if (!m) throw new ClaimsUsageError(`--viewport takes WxH, got ${argv[i]}`);
        viewport = { width: Number(m[1]), height: Number(m[2]) };
        break;
      }
      case "--save":
        save = value(a, argv[++i]);
        break;
      case "--threshold": {
        const n = Number(value(a, argv[++i]));
        if (!Number.isFinite(n) || n <= 0 || n >= 1)
          throw new ClaimsUsageError(`--threshold takes 0-1, got ${argv[i]}`);
        threshold = n;
        break;
      }
      case "--json":
        json = true;
        break;
      default:
        if (a.startsWith("--")) throw new ClaimsUsageError(`unknown option ${a}`);
        positional.push(a);
    }
  }
  if (positional.length !== 1) {
    throw new ClaimsUsageError(
      `expected one page or screenshot, got ${positional.length}${positional.length > 1 ? ' (quote each statement: --forbid "an error message")' : ""}`,
    );
  }
  if (claims.length === 0 && !claimsFile)
    throw new ClaimsUsageError("nothing to check: give --forbid, --expect or --claims");
  return {
    source: positional[0]!,
    claims,
    ...(claimsFile ? { claimsFile } : {}),
    viewport,
    ...(save ? { save } : {}),
    threshold,
    json,
  };
}

/** A claims file: a list of `{ statement, expect }`, `expect` one of "shown" / "absent". */
export function parseClaimsFile(text: string, path: string): Claim[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new ClaimsUsageError(`${path} is not JSON: ${(e as Error).message}`);
  }
  if (!Array.isArray(data)) throw new ClaimsUsageError(`${path} must be a list of { statement, expect }`);
  return data.map((c, i) => {
    const o = c as { statement?: unknown; expect?: unknown };
    if (typeof o.statement !== "string" || !o.statement.trim()) {
      throw new ClaimsUsageError(`${path}[${i}]: "statement" must be a non-empty string`);
    }
    if (o.expect !== "shown" && o.expect !== "absent") {
      throw new ClaimsUsageError(
        `${path}[${i}]: "expect" must be "shown" or "absent", got ${JSON.stringify(o.expect)}`,
      );
    }
    return { statement: o.statement.trim(), expect: o.expect };
  });
}

const isPng = (b: Uint8Array) => b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;

async function screenshotOf(source: string, viewport: { width: number; height: number }): Promise<Uint8Array> {
  const { withBrowser } = await import("@mizchi/vlmkit-core/browser-launch.ts");
  const { openSource } = await import("@mizchi/vlmkit-core/page-open.ts");
  return withBrowser(async (browser) => {
    const { page } = await openSource(browser, source, { viewport, deviceScaleFactor: 1 });
    try {
      return new Uint8Array(await page.screenshot({ type: "png", animations: "disabled", caret: "hide" }));
    } finally {
      await page.close();
    }
  });
}

export async function runClaimsCli(argv: string[]): Promise<number> {
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(CLAIMS_USAGE);
    return 0;
  }
  let o: ClaimsCliOptions;
  try {
    o = parseClaimsArgs(argv);
    if (o.claimsFile) o.claims.push(...parseClaimsFile(await readFile(o.claimsFile, "utf-8"), o.claimsFile));
  } catch (e) {
    if (!(e instanceof ClaimsUsageError)) throw e;
    console.error(`error: ${e.message}\n\n${CLAIMS_USAGE}`);
    return 2;
  }
  // Refused before a browser starts: without a key nothing could answer.
  if (!process.env.TYPESAFEAI_API_KEY && !process.env.TYPESAFE_API_KEY) {
    console.error("error: inspect claims asks TypeSafe Jev and needs TYPESAFEAI_API_KEY (console.typesafe.ai/keys).");
    return 2;
  }
  let png: Uint8Array;
  if (/\.png$/i.test(o.source)) {
    png = new Uint8Array(await readFile(o.source));
    if (!isPng(png)) {
      console.error(`error: ${o.source} is not a PNG`);
      return 2;
    }
  } else {
    png = await screenshotOf(o.source, o.viewport);
  }
  if (o.save) await writeFile(o.save, png);
  const { checkClaims } = await import("@mizchi/vlmkit-ai/claims.ts");
  const r = await checkClaims(png, o.claims, { threshold: o.threshold });
  if (o.json) {
    console.log(
      JSON.stringify(
        {
          source: o.source,
          passed: r.passed,
          threshold: o.threshold,
          results: r.results,
          ...(o.save ? { screenshot: o.save } : {}),
          model: r.model,
          costUsd: r.costUsd,
        },
        null,
        2,
      ),
    );
    return r.passed ? 0 : 1;
  }
  console.log(`inspect claims: ${o.source}${o.save ? ` (screenshot: ${o.save})` : ""}`);
  for (const c of r.results) {
    const mark = c.pass ? "ok  " : "FAIL";
    const verb = c.expect === "absent" ? "must not show" : "must show";
    console.log(
      `  ${mark} ${verb} ${JSON.stringify(c.statement)}  — shown ${c.noul.toFixed(2)}${c.uncertain ? " (uncertain: look at it)" : ""}`,
    );
  }
  const failed = r.results.filter((c) => !c.pass).length;
  console.log(
    `  ${failed === 0 ? "all hold" : `${failed} of ${r.results.length} do not hold`}; ${r.model}, $${r.costUsd.toFixed(5)} — a model's reading of the pixels, not a measurement`,
  );
  return r.passed ? 0 : 1;
}

if (isCliEntry(import.meta.url, "claims")) {
  runClaimsCli(process.argv.slice(2))
    .then((code) => {
      process.exitCode = code;
    })
    .catch(handleCliError);
}
