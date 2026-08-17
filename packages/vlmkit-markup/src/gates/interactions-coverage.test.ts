/**
 * What `check interactions --handlers` may claim to have exercised.
 *
 * `gates.test.ts` is deliberately browser-free and covers the declarations; this one runs the
 * gate, because the claim under test is about what the probe did to a real page.
 *
 * The gate must hand the handler surface the evidence from its own interaction map
 * (`surface.interactionProbe`). Without it the surface cannot tell an exercised handler from an
 * inventoried one, and coverage falls back to a static list of types that was applied on every
 * run of both gates — including `scan handlers`, which presses nothing at all. Removing the
 * wiring left every other test in the repo green, which is why this file exists.
 */
import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { interactionsGate } from "./interactions.gate.ts";

function page(body: string): string {
  const dir = mkdtempSync(join(tmpdir(), "ix-coverage-"));
  const file = join(dir, "page.html");
  writeFileSync(file, `<!doctype html><html><head><meta charset="utf-8"><title>t</title></head><body>
    ${body}
  </body></html>`);
  return file;
}

async function unprobedTypes(source: string): Promise<string[] | "no-warn"> {
  const report = await interactionsGate.run(
    { source, maxElements: 30, handlers: true } as never,
    { cwd: process.cwd() } as never,
  );
  const warn = (report as { handlerIssues?: { kind: string; types?: string[] }[] })
    .handlerIssues?.find((i) => i.kind === "unprobed-handler-types");
  return warn ? warn.types ?? [] : "no-warn";
}

describe("check interactions --handlers coverage claims", { timeout: 180_000 }, () => {
  it("counts a native control's click as exercised, because Enter synthesizes one", async () => {
    // Measured per element type: <button>, <a href>, input[type=submit|button|reset],
    // input[type=checkbox|radio] and <summary> all fire `click` from their activation key.
    const source = page(`<button id="b">go</button>
      <script>document.getElementById("b").addEventListener("click", () => {});</script>`);
    assert.equal(await unprobedTypes(source), "no-warn");
  });

  it("does not count a role-only control's click, because nothing clicks it", async () => {
    // The probe focuses and presses a key; there is no `.click()` anywhere in
    // `interaction-map.ts`, and a div[role=button] does not synthesize one from Enter —
    // measured both ways. This is the element class `pointer-only-control` exists to find, so
    // claiming its click handler was tested is the worst place to be wrong.
    const source = page(`<div id="d" role="button" tabindex="0">go</div>
      <script>document.getElementById("d").addEventListener("click", () => {});</script>`);
    assert.deepEqual(await unprobedTypes(source), ["click"]);
  });

  it("counts the keyboard types it actually pressed, and not the ones it could not", async () => {
    // `activationKeyForRole` returns null for a slider, so nothing is pressed there; the tab
    // walk still focuses it, so `focus` is exercised and `keydown` is not.
    const source = page(`<div id="s" role="slider" tabindex="0" aria-valuenow="1">s</div>
      <script>
        const el = document.getElementById("s");
        el.addEventListener("keydown", () => {});
        el.addEventListener("focus", () => {});
      </script>`);
    assert.deepEqual(await unprobedTypes(source), ["keydown"]);
  });
});
