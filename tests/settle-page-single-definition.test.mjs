/**
 * One definition of "the page has settled".
 *
 * The settle is four things — network idle, `document.fonts.ready`, the finite animations, then a
 * frame — and the reason it is one function is that getting three of four is indistinguishable
 * from a markup bug. Measured 2026-08-02: `verify flow` reported `count .card expected 2,
 * measured 0` on a page where `check layout` measured 2 at the same instant, and `build page`
 * screenshotted a candidate at 5.3% of its settled ink, so every component came back missing.
 * Both blamed the markup.
 *
 * The fourth part was added 2026-08-16 for the same reason: `check integrity` reported a
 * `low-contrast-text` failure at 4.12:1 on a card whose colour is 5.8:1, having measured it at
 * `opacity: 0.2` mid-flight through a 960ms entrance animation. Again reported as a defect in
 * the page, with a selector, rather than as looking too early.
 *
 * Four call sites had hand-rolled the pair `fonts.ready` + `waitForTimeout`, each with its own
 * delay. That is not a style problem: the next improvement to settling (a `requestAnimationFrame`
 * wait, a longer idle timeout) reaches `settlePage` and silently misses them. This test is what
 * makes the fifth copy fail instead of merging.
 *
 * `waitUntil` is deliberately NOT policed. `goto(load)` followed by `settlePage` waits for idle
 * anyway, so the `load` and `domcontentloaded` call sites are equivalent to the `networkidle` ones
 * provided they settle — the difference that ever mattered was the settle, never the load state.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { glob } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "vitest";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

/** The one file allowed to wait on fonts directly — it is the definition. */
const DEFINITION = "packages/vlmkit-core/src/page-open.ts";

/**
 * A wait, not a mention. `integrity-check.ts` READS `document.fonts` to report broken faces
 * (`Array.from(document.fonts).filter((f) => f.status === "error")`), which is a measurement and
 * has nothing to do with settling — a test that forbade the string would have forced that probe
 * out of the file it belongs in.
 */
const FONTS_READY_WAIT = /document\.fonts\s*\.\s*ready|fonts\.ready\s*\.\s*then/;

describe("settlePage is the only settle", () => {
  it("no other source file waits on document.fonts.ready itself", async () => {
    const offenders = [];
    let scanned = 0;
    for await (const relative of glob(["src/**/*.ts", "packages/*/src/**/*.ts"], { cwd: repoRoot })) {
      if (relative.endsWith(".test.ts")) continue;
      if (relative.replaceAll("\\", "/") === DEFINITION) continue;
      scanned++;
      const source = readFileSync(join(repoRoot, relative), "utf8");
      for (const [index, line] of source.split("\n").entries()) {
        // Comments are how the previous conversions recorded what they replaced, and that history
        // is worth keeping readable — `region-selector-match.ts` says "Was a bare `fonts.ready`".
        const code = line.replace(/\/\/.*$/, "").replace(/^\s*\*.*$/, "");
        if (FONTS_READY_WAIT.test(code)) offenders.push(`${relative}:${index + 1}`);
      }
    }
    // Guards against a silently empty run: a moved source root would otherwise report success
    // over nothing.
    assert.ok(scanned > 200, `only scanned ${scanned} source files`);
    assert.deepEqual(
      offenders,
      [],
      `these wait on fonts themselves instead of calling settlePage (${DEFINITION}). `
      + "Two thirds of a settle is what makes a client-rendered page read as broken markup.",
    );
  });

  it("the definition still does all four parts", () => {
    // Without this, the test above is satisfied by a `settlePage` that waits for nothing.
    const source = readFileSync(join(repoRoot, DEFINITION), "utf8");
    const body = source.slice(source.indexOf("export async function settlePage"));
    const settle = body.slice(0, body.indexOf("\n}") + 2);
    assert.match(settle, /waitForLoadState\("networkidle"/, "network idle");
    assert.match(settle, /document\.fonts/, "fonts ready");
    assert.match(settle, /waitForAnimations\(page/, "the finite animations");
    assert.match(settle, /waitForTimeout\(settleMs\)/, "and a frame after");
  });

  it("the animation wait excludes infinite animations and is capped", () => {
    // The two properties that make waiting on animations safe to put in the shared settle. A
    // spinner never finishes, so awaiting it would hang every gate on every page that has one;
    // and a page with a 30-second intro must be measured at the cap rather than stall a run.
    const source = readFileSync(join(repoRoot, DEFINITION), "utf8");
    const fn = source.slice(source.indexOf("async function waitForAnimations"));
    const body = fn.slice(0, fn.indexOf("\n}") + 2);
    assert.match(body, /getAnimations/, "reads the real animation list rather than a convention");
    assert.match(body, /Infinity/, "excludes infinite animations");
    assert.match(body, /Promise\.race/, "and races them against the cap");
  });
});
