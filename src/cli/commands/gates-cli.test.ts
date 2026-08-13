import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseGateConfig, resolveGatePlan, resolveSuppression } from "@mizchi/vlmkit-core/gate-config.ts";
import {
  URL_SCAFFOLD_FLAGS,
  ensureIgnoreEntries,
  expandPlanSources,
  findGateConfig,
  formatExpiredNotice,
  formatPlan,
  formatSuppressions,
  scaffoldConfig,
  shardPlan,
} from "./gates-cli.ts";

const NOW = new Date("2026-08-02T12:00:00Z");
const plain = (s: string) => s.replace(/\x1B\[\d+m/g, "");

const planFor = (config: unknown, only?: string[]) =>
  resolveGatePlan(parseGateConfig(JSON.stringify(config)), { now: NOW, ...(only ? { only } : {}) });

describe("findGateConfig", () => {
  it("finds the conventional filename, and reports absence rather than guessing", () => {
    const dir = mkdtempSync(join(tmpdir(), "gates-find-"));
    assert.equal(findGateConfig(dir), null);
    writeFileSync(join(dir, "vlmkit.gates.json"), "{}");
    assert.equal(findGateConfig(dir), join(dir, "vlmkit.gates.json"));
  });
});

describe("ensureIgnoreEntries", () => {
  const work = (): string => mkdtempSync(join(tmpdir(), "vlmkit-gitignore-"));

  it("writes both artifact directories, creating .gitignore when there is none", async () => {
    // v6's adopting agent had to do exactly this by hand after finding the
    // directories with `ls`: "adopting the tool dirtied the repo silently."
    const cwd = work();
    mkdirSync(join(cwd, ".git"));
    assert.deepEqual(await ensureIgnoreEntries(cwd), [".vlmkit/", "test-results/"]);
    const text = readFileSync(join(cwd, ".gitignore"), "utf8");
    assert.match(text, /# vlmkit run artifacts/);
    assert.match(text, /\.vlmkit\//);
    assert.match(text, /test-results\//);
  });

  it("appends rather than rewriting — a .gitignore is someone else's file", async () => {
    const cwd = work();
    mkdirSync(join(cwd, ".git"));
    writeFileSync(join(cwd, ".gitignore"), "node_modules/");
    await ensureIgnoreEntries(cwd);
    const text = readFileSync(join(cwd, ".gitignore"), "utf8");
    assert.match(text, /^node_modules\/$/m);
    assert.match(text, /\.vlmkit\//);
  });

  it("adds only what is missing, and reports nothing when both are covered", async () => {
    const cwd = work();
    mkdirSync(join(cwd, ".git"));
    writeFileSync(join(cwd, ".gitignore"), ".vlmkit/\n");
    assert.deepEqual(await ensureIgnoreEntries(cwd), ["test-results/"]);
    assert.deepEqual(await ensureIgnoreEntries(cwd), []);
  });

  it("leaves a non-repo alone, where a .gitignore would mean nothing", async () => {
    const cwd = work();
    assert.deepEqual(await ensureIgnoreEntries(cwd), []);
  });
});

describe("scaffoldConfig", () => {
  it("gives a URL source the flags without which every gate times out", () => {
    // v5's CI agent: "Handed a `http://` source, it emits a plan that times out on
    // every gate. It has the URL; it could scaffold `--wait-until`/`--timeout` or
    // warn." A URL source implies the class of page that may never reach network idle,
    // which is the default milestone.
    const { config, urlSources } = scaffoldConfig(["http://localhost:5173/"], []);
    assert.deepEqual(urlSources, ["http://localhost:5173/"]);
    assert.deepEqual(config.defaults!.gates, [`check integrity ${URL_SCAFFOLD_FLAGS}`]);
  });

  it("scaffolds a webServer for a localhost URL, which cannot be gated without one", () => {
    // v7's agent-l: "`gates init` diagnosed the `networkidle` trap for me but didn't
    // scaffold `webServer` for a localhost URL." The same reasoning that adds the
    // page-load flags applies: a local URL means a server has to be running for the
    // config to work at all.
    const { config, localSources } = scaffoldConfig(["http://localhost:5173/"], []);
    assert.deepEqual(localSources, ["http://localhost:5173/"]);
    assert.equal(config.webServer!.url, "http://localhost:5173/");
    // A placeholder command, not a guess: a wrong command that looks configured
    // would start something unrelated and gate whatever answered.
    assert.equal(config.webServer!.command, "npm run dev");
    assert.doesNotThrow(() => parseGateConfig(JSON.stringify(config)));
  });

  it("recognises 127.0.0.1 and ::1 as local too", () => {
    assert.equal(scaffoldConfig(["http://127.0.0.1:3000/"], []).localSources.length, 1);
    assert.equal(scaffoldConfig(["http://[::1]:3000/"], []).localSources.length, 1);
  });

  it("adds no webServer for a remote URL, which nobody here can start", () => {
    const { config, urlSources, localSources } = scaffoldConfig(["https://staging.example.com/"], []);
    assert.deepEqual(urlSources, ["https://staging.example.com/"]);
    assert.deepEqual(localSources, []);
    assert.equal(config.webServer, undefined);
  });

  it("leaves a file source alone, where the default milestone is reachable", () => {
    const { config, urlSources } = scaffoldConfig(["routes/**/*.html"], []);
    assert.deepEqual(urlSources, []);
    assert.deepEqual(config.defaults!.gates, ["check integrity"]);
  });

  it("applies the flags to every declared gate, not just the starter", () => {
    const { config } = scaffoldConfig(["https://example.com/"], ["check integrity", "check copy"]);
    assert.deepEqual(config.defaults!.gates, [
      `check integrity ${URL_SCAFFOLD_FLAGS}`,
      `check copy ${URL_SCAFFOLD_FLAGS}`,
    ]);
  });

  it("treats a mixed list as needing the flags, since one URL is enough to hang the run", () => {
    const { config } = scaffoldConfig(["index.html", "http://localhost:1/"], []);
    assert.deepEqual(config.defaults!.gates, [`check integrity ${URL_SCAFFOLD_FLAGS}`]);
  });

  it("writes a config its own validator accepts", () => {
    // The scaffold is a first impression; one its validator rejects is worse than none.
    const { config } = scaffoldConfig(["http://localhost:5173/"], []);
    assert.doesNotThrow(() => parseGateConfig(JSON.stringify(config)));
  });
});

describe("expandPlanSources", () => {
  const dir = mkdtempSync(join(tmpdir(), "gates-glob-"));
  for (const name of ["a.html", "b.html", "c.html"]) writeFileSync(join(dir, name), "<p>x");

  it("turns one glob entry into one job per file", async () => {
    const plan = await expandPlanSources(planFor({
      pages: [{ id: "routes", source: `${dir}/*.html`, gates: ["check integrity"] }],
    }));
    assert.equal(plan.jobs.length, 3);
    assert.deepEqual(plan.jobs.map((j) => j.source.replace(`${dir}/`, "")), ["a.html", "b.html", "c.html"]);
  });

  it("expands a relative glob against the config's directory, not the process cwd", async () => {
    // v5's CI agent, on the exact invocation this repo's own workflows use:
    // "`gates run --config fixtures/.../vlmkit.gates.json` from repo root dies with
    //  `ENOENT … open '/home/user/vlmkit/dashboard.har'` … A committed config whose
    //  paths work from only one directory is not committed." Sources are the same
    // class of relative path as that `--har`, so they resolve from the same base.
    const plan = await expandPlanSources(
      planFor({ pages: [{ id: "routes", source: "*.html", gates: ["check integrity"] }] }),
      dir,
    );
    assert.deepEqual(plan.jobs.map((j) => j.source), ["a.html", "b.html", "c.html"]);
  });

  it("keeps resolving against the process cwd when no base is given", async () => {
    // Library callers and `gates suppressions` pass none; that path must not start
    // silently resolving somewhere else.
    await assert.rejects(
      expandPlanSources(planFor({ pages: [{ id: "x", source: "definitely-not-here-*.html", gates: ["check integrity"] }] })),
      /matched no files/,
    );
  });

  it("prefixes expanded ids with the config's own name so --only still addresses the group", async () => {
    const plan = await expandPlanSources(planFor({
      pages: [{ id: "routes", source: `${dir}/*.html`, gates: ["check integrity"] }],
    }));
    assert.ok(plan.jobs.every((j) => j.pageId.startsWith("routes:")));
  });

  it("leaves a single literal source's id alone", async () => {
    const plan = await expandPlanSources(planFor({
      pages: [{ id: "home", source: `${dir}/a.html`, gates: ["check integrity"] }],
    }));
    assert.deepEqual(plan.jobs.map((j) => j.pageId), ["home"]);
  });

  it("refuses a pattern that matches nothing instead of gating on nothing", async () => {
    await assert.rejects(
      expandPlanSources(planFor({ pages: [{ id: "x", source: `${dir}/*.md`, gates: ["check integrity"] }] })),
      /source matched no files/,
    );
  });

  it("keeps URLs as-is", async () => {
    const plan = await expandPlanSources(planFor({
      pages: [{ id: "prod", source: "https://example.com/", gates: ["check integrity"] }],
    }));
    assert.deepEqual(plan.jobs.map((j) => j.source), ["https://example.com/"]);
  });
});

describe("shardPlan", () => {
  const plan = planFor({
    defaults: { gates: ["check integrity", "check design"] },
    pages: [1, 2, 3, 4].map((n) => ({ id: `p${n}`, source: `p${n}.html` })),
  });

  it("keeps a page's gates together on one runner", () => {
    // Sharding per job would split one page's integrity and design runs across
    // machines, so a page's logs would land in two places for no gain.
    const shard = shardPlan(plan, { index: 1, total: 2 });
    const pages = [...new Set(shard.jobs.map((j) => j.pageId))];
    assert.deepEqual(pages, ["p1", "p3"]);
    assert.equal(shard.jobs.length, 4); // 2 pages x 2 gates
  });

  it("partitions pages across shards", () => {
    const seen = [1, 2].flatMap((index) => shardPlan(plan, { index, total: 2 }).jobs.map((j) => j.pageId));
    assert.equal(new Set(seen).size, 4);
    assert.equal(seen.length, 8);
  });

  it("passes through without a shard", () => {
    assert.equal(shardPlan(plan).jobs.length, 8);
  });
});

describe("formatPlan", () => {
  it("prints the exact command each page will run, with suppression flags visible", () => {
    const text = plain(formatPlan(planFor({
      defaults: { gates: ["check integrity"] },
      pages: [{
        id: "checkout",
        source: "checkout.html",
        extraGates: ["check copy --manifest c.txt"],
        suppressions: [{ gate: "check copy", flag: "--allow-invisible visually-hidden", reason: "sr-only", expires: "2026-12-01" }],
      }],
    }), "vlmkit.gates.json"));
    assert.match(text, /1 page\(s\), 2 gate run\(s\)/);
    assert.match(text, /vlmkit check integrity checkout\.html/);
    assert.match(text, /vlmkit check copy --manifest c\.txt --allow-invisible visually-hidden checkout\.html/);
    assert.match(text, /\[\+1 suppression\]/);
  });

  it("flags an expired entry in the plan itself", () => {
    const text = plain(formatPlan(planFor({
      pages: [{
        id: "game",
        source: "game.html",
        gates: ["check design"],
        suppressions: [{ gate: "check design", flag: "--min-reuse 2", reason: "zones differ", expires: "2026-07-01" }],
      }],
    }), "cfg.json"));
    assert.match(text, /1 expired suppression\(s\) NOT applied/);
    assert.doesNotMatch(text, /--min-reuse 2/); // not applied, so not in the command
  });
});

describe("formatSuppressions", () => {
  const rows = [
    { gate: "check design", flag: "--min-reuse 2", reason: "zones differ", expires: "2026-07-01" },
    { gate: "check copy", flag: "--allow-invisible visually-hidden", reason: "sr-only nav", owner: "web-platform", expires: "2026-08-10" },
    { gate: "check copy", flag: "--allow-invisible camouflage", reason: "brand watermark" },
  ].map((s, i) => resolveSuppression(s, `page-${i}`, NOW));

  it("is the inventory a grep cannot give you: reason, owner, expiry, per entry", () => {
    const text = plain(formatSuppressions(rows, 30));
    assert.match(text, /3 total: 1 active, 1 permanent \(no expiry\), 1 expired/);
    assert.match(text, /EXPIRED 32d ago/);
    assert.match(text, /8d left/);
    assert.match(text, /permanent/);
    assert.match(text, /zones differ/);
    assert.match(text, /web-platform/);
    assert.match(text, /\(no owner\)/);
    assert.match(text, /expiring within 30d/);
  });

  it("explains what an expiry actually does", () => {
    assert.match(plain(formatSuppressions(rows)), /not applied.*runs unmuted/s);
  });

  it("says so plainly when nothing is silenced", () => {
    assert.match(plain(formatSuppressions([])), /No suppressions declared/);
  });
});

describe("formatExpiredNotice", () => {
  it("warns before the run that a failure may be stale config, not a regression", () => {
    const text = plain(formatExpiredNotice([
      resolveSuppression({ gate: "check design", flag: "--min-reuse 2", reason: "zones differ", expires: "2026-07-01" }, "game", NOW),
    ]));
    assert.match(text, /1 suppression\(s\) expired — the gate\(s\) below run unmuted/);
    assert.match(text, /expired 32d ago: zones differ/);
    assert.match(text, /may be this, not a new regression/);
    // The full inventory's counts read wrong for a subset, so this is its own format.
    assert.doesNotMatch(text, /total:/);
  });

  it("is empty when nothing expired", () => {
    assert.equal(formatExpiredNotice([]), "");
  });
});

describe("gates run (end to end)", () => {
  const CLI = join(process.cwd(), "src/cli/vlmkit.ts");
  const FIXTURE = join(process.cwd(), "fixtures/auto-markup-proof/creative/attempt-s18-haiku.html");

  const runCli = async (args: string[], cwd: string) => {
    const { spawn } = await import("node:child_process");
    return new Promise<{ code: number; out: string }>((resolveRun) => {
      const child = spawn(process.execPath, [...process.execArgv, CLI, ...args], { cwd, stdio: ["ignore", "pipe", "pipe"] });
      let out = "";
      child.stdout.on("data", (d) => { out += d; });
      child.stderr.on("data", (d) => { out += d; });
      child.on("close", (code) => resolveRun({ code: code ?? 1, out: plain(out) }));
    });
  };

  const withConfig = (config: unknown): string => {
    const dir = mkdtempSync(join(tmpdir(), "gates-e2e-"));
    writeFileSync(join(dir, "vlmkit.gates.json"), JSON.stringify(config, null, 2));
    return dir;
  };

  it("runs the configured gates and passes", async () => {
    const dir = withConfig({
      defaults: { gates: ["check design"] },
      pages: [{ id: "tool-ui", source: FIXTURE }],
    });
    const { code, out } = await runCli(["gates", "run", "--concurrency", "1", "--quiet"], dir);
    assert.equal(code, 0, out);
    assert.match(out, /ALL PASS \(1\/1\)/);
  });

  it("fails on stale config even when every gate passes", async () => {
    // The whole point of an expiry: a suppression nobody renewed is a defect in
    // the config, and CI is where that gets noticed.
    const dir = withConfig({
      defaults: { gates: ["check design"] },
      pages: [{
        id: "tool-ui",
        source: FIXTURE,
        suppressions: [{ gate: "check design", flag: "--min-reuse 2", reason: "stale on purpose", expires: "2020-01-01" }],
      }],
    });
    const { code, out } = await runCli(["gates", "run", "--concurrency", "1", "--quiet"], dir);
    assert.match(out, /ALL PASS/);
    assert.match(out, /suppression\(s\) expired/);
    assert.equal(code, 1, out);
  });

  it("--advisory prints the same thing and exits 0", async () => {
    const dir = withConfig({
      defaults: { gates: ["check design"] },
      pages: [{
        id: "tool-ui",
        source: FIXTURE,
        suppressions: [{ gate: "check design", flag: "--min-reuse 2", reason: "stale on purpose", expires: "2020-01-01" }],
      }],
    });
    const { code, out } = await runCli(["gates", "run", "--concurrency", "1", "--quiet", "--advisory"], dir);
    assert.match(out, /suppression\(s\) expired/);
    assert.equal(code, 0, out);
  });

  it("points at `gates init` when there is no config", async () => {
    const dir = mkdtempSync(join(tmpdir(), "gates-empty-"));
    const { code, out } = await runCli(["gates", "list"], dir);
    assert.equal(code, 1);
    assert.match(out, /No gate config found/);
    assert.match(out, /vlmkit gates init/);
  });

  it("init scaffolds a config its own parser accepts", async () => {
    const dir = mkdtempSync(join(tmpdir(), "gates-init-"));
    const init = await runCli(["gates", "init", "--pages", FIXTURE, "--gate", "check design"], dir);
    assert.equal(init.code, 0, init.out);
    const list = await runCli(["gates", "list"], dir);
    assert.equal(list.code, 0, list.out);
    assert.match(list.out, /1 page\(s\), 1 gate run\(s\)/);
  });
});
