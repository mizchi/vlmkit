/**
 * `--timeout` / `--wait-until` / `--har` across the whole composed registry.
 *
 * Why a registry walk rather than 20 per-gate cases: the failure this guards
 * against is a *new* URL gate that forgets the flags, and no per-gate test can
 * see that. Measured 2026-08-10 (issue #112) — `check integrity` and
 * `check design` had all three, the other 19 URL-accepting gates had none, and
 * a React + MapLibre dev server whose third-party request never settles could
 * therefore not be gated at all:
 *
 *     $ vlmkit check integrity http://localhost:5173/
 *     error: page load timed out (Timeout 30000ms exceeded)
 *
 * Two kinds of assertion here, and the second is the one that matters:
 *
 *   1. the flags are DECLARED on every gate that navigates, with the exceptions
 *      written down as data plus a reason rather than discovered;
 *   2. each gate's own `parse` actually RETURNS the values. A gate can declare
 *      an input in `--help` and drop it on the floor in `parse`; that reads to a
 *      user exactly like a flag that does not work.
 *
 * Whether the value then reaches `page.goto` is proved in
 * `packages/vlmkit-core/src/page-load.test.ts` (at the browser call, with a
 * fake Page) and in `packages/vlmkit-markup/src/gates/page-load-honoured.test.ts`
 * (end to end, against a server that never goes idle).
 */
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "vitest";
import type { AnyGateDefinition, GateInput } from "@mizchi/vlmkit-core/plugin/contract.ts";
import { loadGateRegistry, resetGateRegistryCache } from "./gate-registry.ts";
import { PAGE_LOAD_INPUTS } from "@mizchi/vlmkit-core/page-load.ts";

const PAGE_LOAD_FLAGS = ["timeout", "wait-until", "har"] as const;

/**
 * Gates that navigate a URL passed through a *flag* instead of a `path-or-url`
 * positional, so the structural walk below cannot find them. Both were missed by
 * the original audit for exactly that reason, and both point at a dev server in
 * normal use — `check story --gallery` IS a Vite/Playwright baseURL.
 */
const URL_BY_FLAG = ["check story", "check drift pages"];

/**
 * Gates that navigate but deliberately do NOT take one of the three, and why. A
 * gate missing from this table must declare all three — that is the point of the
 * table: an exception has to be argued for in writing, once, here.
 */
const EXCEPTIONS: Record<string, { missing: string[]; because: RegExp }> = {
  "check perf": {
    missing: ["har"],
    // HAR replay serves every response off local disk, so TTFB / LCP / FCP
    // would measure disk reads — the numbers this gate exists to report.
    because: /disk/,
  },
  "check drift component": {
    missing: ["timeout", "wait-until", "har"],
    // It reads the file and `setContent`s it: nothing is navigated, so there is
    // no navigation to time out, no milestone to wait for, no network to replay.
    because: /setContent|never navigat/,
  },
};

function tempJson(name: string, body: unknown): string {
  const path = join(mkdtempSync(join(tmpdir(), "gate-page-load-")), name);
  writeFileSync(path, JSON.stringify(body));
  return path;
}

/**
 * The minimum argv each gate's `parse` accepts. Default is a bare page source;
 * the entries here are gates that require a flag before they will return.
 */
const BASE_ARGV: Record<string, () => string[]> = {
  "check layout": () => [
    "page.html",
    "--contract",
    tempJson("contract.json", { rules: [{ selector: "body", at: 1280, visible: true }] }),
  ],
  "verify flow": () => [
    "page.html",
    "--flow",
    tempJson("flow.json", { steps: [{ do: { action: "wait", ms: 1 } }] }),
  ],
  "check drift component": () => ["page.html", "--selector", ".card"],
  "check drift pages": () => [
    "--selector", ".card",
    "--urls", "http://a.test/",
    "--urls", "http://b.test/",
  ],
  "check story": () => ["Button/Primary", "--gallery", "http://localhost:5173/"],
};

async function navigatingGates(): Promise<AnyGateDefinition[]> {
  resetGateRegistryCache();
  const registry = await loadGateRegistry({ builtinsOnly: true });
  return registry.list()
    .map(({ gate }) => gate)
    .filter((gate) =>
      (gate.inputs ?? []).some((input: GateInput) => input.kind === "path-or-url")
      || URL_BY_FLAG.includes(gate.command.join(" "))
    );
}

const command = (gate: AnyGateDefinition) => gate.command.join(" ");
const inputNames = (gate: AnyGateDefinition) => new Set((gate.inputs ?? []).map((i: GateInput) => i.name));
const argvFor = (gate: AnyGateDefinition) => BASE_ARGV[command(gate)]?.() ?? ["page.html"];

describe("page-load options on the gates that navigate", () => {
  it("declares them from the shared fragment, not from a hand-written copy", async () => {
    // The module header claimed a test asserted this; none did. It checked the flags
    // EXIST and WORK, which two hand-written copies also satisfy — so `check
    // integrity` and `check design` quietly kept an older description while the
    // fragment gained a hint. v5's CI agent found it from the outside:
    //
    //   "the fix exists only in `--help`, and *only in 2 of the 4 gates' help text*
    //    — `check integrity` and `check design` print the same flag without the 'SPA
    //    that never reaches network idle' hint, and integrity is the gate you reach
    //    for first."
    //
    // Identity, not just presence: a copy that starts out identical is still a copy,
    // and the next edit to the fragment is what makes it wrong.
    const fragment = new Map(PAGE_LOAD_INPUTS.map((i) => [i.name, i]));
    const divergent: string[] = [];
    for (const gate of await navigatingGates()) {
      for (const input of gate.inputs ?? []) {
        const shared = fragment.get(input.name);
        if (!shared) continue;
        if (input !== shared) {
          divergent.push(
            `${command(gate)} declares its own --${input.name}`
            + (input.description === shared.description ? " (identical today, and still a copy)" : ` ("${input.description}")`),
          );
        }
      }
    }
    assert.deepEqual(divergent, [], `spread ...PAGE_LOAD_INPUTS instead:\n  ${divergent.join("\n  ")}`);
  });


  it("covers every one of them, with the exceptions named and justified", async () => {
    const gates = await navigatingGates();
    // 23 as of 2026-08-10: 21 with a `path-or-url` source plus the two that take
    // a URL through a flag. A new one lands here first, which is the cheapest
    // place to notice it needs these flags.
    assert.equal(gates.length, 23, gates.map(command).join(", "));

    const missing: string[] = [];
    for (const gate of gates) {
      const names = inputNames(gate);
      const absent = PAGE_LOAD_FLAGS.filter((flag) => !names.has(flag));
      const exception = EXCEPTIONS[command(gate)];
      if (!exception) {
        if (absent.length > 0) missing.push(`${command(gate)} is missing ${absent.join(", ")}`);
        continue;
      }
      assert.deepEqual(
        absent.slice().sort(),
        exception.missing.slice().sort(),
        `${command(gate)}: the flags it lacks no longer match its documented exception`,
      );
      // The reason has to survive in the code, not only in this table.
      const prose = `${gate.usage ?? ""}\n${(gate.inputs ?? []).map((i: GateInput) => i.description).join("\n")}`;
      const explained = exception.because.test(prose) || exception.because.test(String(gate.parse));
      assert.ok(explained, `${command(gate)}: nothing in the gate explains why it omits ${exception.missing.join(", ")}`);
    }
    assert.deepEqual(missing, []);
  });

  it("returns the parsed values from every gate's own parse", async () => {
    const ctx = { cwd: process.cwd(), argv: [] as string[], json: false };
    for (const gate of await navigatingGates()) {
      const names = inputNames(gate);
      if (!PAGE_LOAD_FLAGS.some((flag) => names.has(flag))) continue;
      const argv = argvFor(gate);
      if (names.has("timeout")) argv.push("--timeout", "91000");
      if (names.has("wait-until")) argv.push("--wait-until", "domcontentloaded");
      if (names.has("har")) argv.push("--har", "recording.har");

      const options = gate.parse(argv, ctx) as Record<string, unknown>;
      if (names.has("timeout")) {
        assert.equal(options.timeout, 91000, `${command(gate)} declares --timeout but parse dropped it`);
      }
      if (names.has("wait-until")) {
        assert.equal(
          options.waitUntil,
          "domcontentloaded",
          `${command(gate)} declares --wait-until but parse dropped it`,
        );
      }
      if (names.has("har")) {
        assert.equal(options.har, "recording.har", `${command(gate)} declares --har but parse dropped it`);
      }
    }
  });

  it("does not read a flag value as a positional", async () => {
    // `check story` takes every positional as a story id and `check integrity`
    // as its page source, so a page-load flag must be in each gate's
    // value-taking list. Without that, `--wait-until load page.html` parses as
    // two stories / a source called "load".
    const ctx = { cwd: process.cwd(), argv: [] as string[], json: false };
    for (const gate of await navigatingGates()) {
      const names = inputNames(gate);
      if (!names.has("wait-until")) continue;
      const base = argvFor(gate);
      const withFlagFirst = ["--wait-until", "load", ...base];
      const parsedFirst = gate.parse(withFlagFirst, ctx) as Record<string, unknown>;
      const parsedLast = gate.parse([...base, "--wait-until", "load"], ctx) as Record<string, unknown>;
      // Whatever the gate calls its source, the flag must not have become it.
      for (const key of ["source", "htmlPath", "gallery"]) {
        if (typeof parsedFirst[key] === "string") {
          assert.equal(parsedFirst[key], parsedLast[key], `${command(gate)}: flag position changed its source`);
          assert.notEqual(parsedFirst[key], "load", `${command(gate)}: read the flag value as its source`);
        }
      }
      if (Array.isArray(parsedFirst.stories)) {
        assert.ok(
          !(parsedFirst.stories as string[]).includes("load"),
          `${command(gate)}: read the flag value as a story id`,
        );
      }
    }
  });

  it("does not invent values when the flags are absent", async () => {
    // A gate that defaulted `waitUntil` in `parse` would make
    // `navigationOptions(options, "load")` unreachable for the three gates that
    // deliberately navigate at `load`.
    const ctx = { cwd: process.cwd(), argv: [] as string[], json: false };
    for (const gate of await navigatingGates()) {
      const options = gate.parse(argvFor(gate), ctx) as Record<string, unknown>;
      for (const key of ["timeout", "waitUntil", "har"]) {
        assert.ok(!(key in options), `${command(gate)} invented ${key} with no flag passed`);
      }
    }
  });

  it("check perf rejects --har instead of accepting and ignoring it", async () => {
    // The failure mode this whole change is against: a flag that parses and
    // does nothing. `check perf` cannot honour a HAR meaningfully, so it says so.
    const registry = await loadGateRegistry({ builtinsOnly: true });
    const perf = registry.byCommand("check perf")!;
    assert.throws(
      () => perf.parse(["page.html", "--har", "rec.har"], { cwd: process.cwd(), argv: [], json: false }),
      /does not accept --har/,
    );
  });

  it("check copy rejects the three in element-rect mode, where no page is opened", async () => {
    const registry = await loadGateRegistry({ builtinsOnly: true });
    const copy = registry.byCommand("check copy")!;
    const ctx = { cwd: process.cwd(), argv: [] as string[], json: false };
    for (const [flag, value] of [["--timeout", "1000"], ["--wait-until", "load"], ["--har", "a.har"]]) {
      assert.throws(
        () => copy.parse(["--elements", "rects.json", flag!, value!], ctx),
        new RegExp(`${flag!.replace(/-/g, "\\-")} does not apply with --elements`),
        `check copy accepted ${flag} in element-rect mode`,
      );
    }
  });
});
