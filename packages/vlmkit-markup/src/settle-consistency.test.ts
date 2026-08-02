/**
 * A gate that navigates and does not settle measures the wrong document — and
 * reports it as a defect in the page.
 *
 * The remaining page-open work was labelled "cosmetic: `waitUntil` levelling"
 * (71 networkidle / 8 load / 2 domcontentloaded). Measured 2026-08-02 against a
 * page that renders its cards 350ms after `load`:
 *
 *   check layout   (networkidle)  count .card = 2          <- correct
 *   verify flow    (load, no settle)
 *                                count .card = 0, FAIL     <- blames the markup
 *   build page     (load, no settle)
 *                                5.3% of the settled ink   <- every component
 *                                                             reported missing
 *
 * Playwright *actions* auto-wait, which is why this hid for so long: a click on
 * a late-rendered element is safe. Reads are not — `page.evaluate`,
 * `page.screenshot` and `getBoundingClientRect` sample the DOM at that instant,
 * and all three gates above read.
 *
 * `waitUntil` turned out not to be the axis at all: `goto(load)` followed by
 * `settlePage` waits for network idle anyway. The fix was to settle at the five
 * call sites that did not, not to rewrite any load state.
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createServer, type Server } from "node:http";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";
import { FLOW_ACTIONS, FLOW_ASSERTS, runFlowVerify, validateFlow } from "./inspect/flow-verify.ts";
import { runLayoutVerify } from "./inspect/layout-contract.ts";
import { buildHandlerSurface } from "./inspect/handler-map.ts";
import { renderHtmlToPng } from "./component/page-compose.ts";
import { introspectUiContractFromHtml } from "./contract/introspect-contract.ts";

const RENDER_DELAY_MS = 350;

const LATE_MARKUP = [
  "<h1>Filters</h1>",
  '<div class="card">Revenue</div>',
  '<div class="card">Costs</div>',
  '<button id="apply">Apply filters</button>',
].join("");

/** A client-rendered view: `load` fires on the placeholder, content follows. */
const HTML = `<!doctype html><meta charset="utf-8"><title>Filters</title>
<style>body{margin:0;font:16px system-ui,sans-serif;background:#fff;color:#111;padding:24px}
.card{width:320px;border:1px solid #ccc;padding:12px;margin:0 0 8px}button{font:inherit;padding:8px 12px}</style>
<body>
  <button id="toggle">Show panel</button>
  <main id="root"><p>Loading…</p></main>
<script>
setTimeout(() => {
  document.getElementById("root").innerHTML = ${JSON.stringify(LATE_MARKUP)};
  document.getElementById("apply").addEventListener("click", () => {});
}, ${RENDER_DELAY_MS});
</script>`;

function startServer(): Promise<{ server: Server; url: string }> {
  const server = createServer((_req, res) => {
    res.writeHead(200, { "content-type": "text/html", "cache-control": "no-store" });
    res.end(HTML);
  });
  return new Promise((resolve) => {
    server.listen(0, () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      resolve({ server, url: `http://127.0.0.1:${port}/` });
    });
  });
}

/** The flow's action targets an element present at `load`; its post-conditions
 *  are on content that arrives later. That split is what exposes a missing
 *  settle — the action's auto-wait cannot cover for it. */
const LATE_FLOW = {
  steps: [{
    label: "panel shows two cards",
    do: { action: "click", selector: "#toggle" },
    expect: [
      { assert: "count", selector: ".card", equals: 2 },
      { assert: "visible", selector: "#apply" },
    ],
  }],
} as const;

describe("gates settle before reading a client-rendered page", () => {
  let server: Server;
  let url = "";
  let file = "";

  before(async () => {
    const started = await startServer();
    server = started.server;
    url = started.url;
    file = join(mkdtempSync(join(tmpdir(), "settle-consistency-")), "page.html");
    writeFileSync(file, HTML);
  });
  after(() => server.close());

  it("verify flow agrees with check layout on how many cards exist", async () => {
    // These two disagreed: 0 vs 2, same page, same instant. `verify flow`
    // reported it as an unmet post-condition, i.e. as the markup's fault.
    const layout = await runLayoutVerify({
      source: url,
      contract: { rules: [{ selector: ".card", at: 1280, count: 2 }] },
    });
    const flow = await runFlowVerify({ source: url, flow: structuredClone(LATE_FLOW) as never });

    assert.equal(layout.results?.[0]?.checks?.[0]?.measured, "2");
    assert.equal(flow.done, true, JSON.stringify(flow.steps, null, 1));
    for (const a of flow.steps[0]!.assertions) assert.equal(a.passed, true, `${JSON.stringify(a.assert)} -> ${a.actual}`);
  });

  it("verify flow needs no hand-written wait step to see late content", async () => {
    // The only workaround was for the flow author to guess at a leading
    // {"action":"wait"} — undiscoverable, and duplicating what the other gates
    // already do for free.
    const withoutWait = await runFlowVerify({ source: file, flow: structuredClone(LATE_FLOW) as never });
    const withWait = await runFlowVerify({
      source: file,
      flow: { steps: [{ label: "wait", do: { action: "wait", ms: RENDER_DELAY_MS + 200 } }, ...structuredClone(LATE_FLOW).steps] } as never,
    });
    assert.equal(withoutWait.done, withWait.done);
    assert.equal(withoutWait.done, true);
  });

  it("build page renders the settled candidate, not its placeholder", async () => {
    // 5.3% of the settled ink before the fix: it screenshotted "Loading…", so
    // `build page` reported every component missing.
    const shot = await renderHtmlToPng(file, 900, 500);
    const inkOf = (data: Uint8Array | Buffer): number => {
      let n = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i]! < 240 || data[i + 1]! < 240 || data[i + 2]! < 240) n++;
      }
      return n;
    };
    const rendered = inkOf(shot.data);

    const { chromium } = await import("playwright");
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage({ viewport: { width: 900, height: 500 } });
      await page.goto(`file://${file}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(RENDER_DELAY_MS + 250);
      const settled = inkOf(PNG.sync.read(await page.screenshot({ animations: "disabled" })).data);
      // Exact equality would be brittle; the defect was a 19x shortfall.
      assert.ok(
        rendered > settled * 0.9,
        `rendered ${rendered} px of ink vs ${settled} settled — the capture is still early`,
      );
    } finally {
      await browser.close();
    }
  });

  it("scan contract finds the landmarks of a built SPA opened as a file", async () => {
    // The likeliest fix to get reverted for being slow (241ms -> 986ms), so pin
    // the reason: local files used `load` with no settle deliberately, and
    // returned ZERO landmarks on a page that renders after load — the input
    // every downstream contract command reads.
    const spa = join(mkdtempSync(join(tmpdir(), "settle-spa-")), "dist-index.html");
    writeFileSync(spa, `<!doctype html><meta charset="utf-8"><title>App</title>
<style>body{margin:0;font:16px system-ui,sans-serif}main{padding:24px}</style>
<body><div id="root">Loading…</div>
<script>setTimeout(() => { document.getElementById("root").outerHTML =
  '<header><nav>Nav</nav></header><main><h1>Dashboard</h1><p>Body</p></main><footer>F</footer>';
}, ${RENDER_DELAY_MS});</script>`);
    const contract = await introspectUiContractFromHtml({
      input: spa,
      viewports: [{ label: "desktop", width: 1280, height: 800 }],
    });
    const roles = contract.screens[0]!.landmarks.map((l) => l.role);
    assert.deepEqual(roles, ["banner", "navigation", "main", "contentinfo"]);
  });

  it("scan handlers still inventories handlers registered after load", async () => {
    // Regression guard on the settleAfterLoad -> settlePage collapse: the two
    // were byte-for-byte identical, but this gate is what the original was
    // written for.
    const surface = await buildHandlerSurface({ source: url });
    assert.equal(surface.elements.length, 1, JSON.stringify(surface.elements));
    assert.ok(surface.totalRegistrations >= 1);
  });
});

describe("a malformed flow is a usage error, not a page defect", () => {
  it("rejects an unknown assert name and lists the valid ones", () => {
    assert.throws(
      () => validateFlow({ steps: [{ do: { action: "wait", ms: 1 }, expect: [{ assert: "visble", selector: "#a" } as never] }] }),
      (e: Error) => {
        // Previously: FAIL with actual "unknown assert" — read as a page defect.
        assert.match(e.message, /unknown assert "visble"/);
        assert.match(e.message, /attr, visible, hidden, focused, text, count/);
        return true;
      },
    );
  });

  it("rejects an unknown action, which used to return done: true", () => {
    // The worst of the two: `runAction`'s switch had no default, so the step
    // performed nothing, had no post-conditions to fail, and the run was green.
    assert.throws(
      () => validateFlow({ steps: [{ label: "typo", do: { action: "clik", selector: "#b" } as never }] }),
      /unknown action "clik".*click, press, fill, type, focus, hover, wait/s,
    );
  });

  it("names the offending step, so a long flow is debuggable", () => {
    assert.throws(
      () => validateFlow({
        steps: [
          { do: { action: "wait", ms: 1 } },
          { label: "open menu", do: { action: "hover", selector: "#m" }, expect: [{ assert: "shown", selector: "#p" } as never] },
        ],
      }),
      /step 1 \("open menu"\), expect\[0\]/,
    );
  });

  it("rejects an empty flow rather than reporting done on zero steps", () => {
    assert.throws(() => validateFlow({ steps: [] }), /flow has no steps/);
  });

  it("validates against the whole type union, with no drift", () => {
    // The validator's lists are string literals, so a name added to FlowAction
    // or FlowAssert without a list entry would start rejecting a *valid* flow.
    // Loud rather than silent, but still wrong — pin it.
    const source = readFileSync(
      fileURLToPath(new URL("./inspect/flow-verify.ts", import.meta.url)),
      "utf8",
    );
    const union = (kind: "action" | "assert") =>
      [...new Set([...source.matchAll(new RegExp(`\\{ ${kind}: "(\\w+)"`, "g"))].map((m) => m[1]!))].sort();
    assert.deepEqual([...FLOW_ACTIONS].sort(), union("action"));
    assert.deepEqual([...FLOW_ASSERTS].sort(), union("assert"));
  });

  it("accepts every documented action and assert name", () => {
    // Keeps the validator honest against the type union: a name added to
    // FlowAction/FlowAssert but not to the list would start being rejected.
    validateFlow({
      steps: [
        { do: { action: "click", selector: "#a" }, expect: [{ assert: "attr", selector: "#a", name: "aria-expanded", equals: "true" }] },
        { do: { action: "press", key: "Enter" }, expect: [{ assert: "visible", selector: "#a" }] },
        { do: { action: "fill", selector: "#a", value: "x" }, expect: [{ assert: "hidden", selector: "#a" }] },
        { do: { action: "type", selector: "#a", text: "x" }, expect: [{ assert: "focused", selector: "#a" }] },
        { do: { action: "focus", selector: "#a" }, expect: [{ assert: "text", selector: "#a", contains: "x" }] },
        { do: { action: "hover", selector: "#a" }, expect: [{ assert: "count", selector: "#a", equals: 1 }] },
        { do: { action: "wait", ms: 1 } },
      ],
    });
  });
});
