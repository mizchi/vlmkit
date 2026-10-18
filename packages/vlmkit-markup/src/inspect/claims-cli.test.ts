import assert from "node:assert/strict";
import { afterEach, describe, it } from "vite-plus/test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PNG } from "pngjs";
import { ClaimsUsageError, parseClaimsArgs, parseClaimsFile, runClaimsCli } from "./claims-cli.ts";

const dir = mkdtempSync(join(tmpdir(), "vlmkit-claims-cli-"));

/** Run the CLI with console captured and the key set or unset. */
async function run(argv: string[], key: string | undefined) {
  const saved = { a: process.env.TYPESAFEAI_API_KEY, b: process.env.TYPESAFE_API_KEY };
  if (key === undefined) delete process.env.TYPESAFEAI_API_KEY;
  else process.env.TYPESAFEAI_API_KEY = key;
  delete process.env.TYPESAFE_API_KEY;
  const out: string[] = [];
  const log = console.log;
  const err = console.error;
  console.log = (s: string) => out.push(s);
  console.error = (s: string) => out.push(s);
  try {
    return { code: await runClaimsCli(argv), out: out.join("\n") };
  } finally {
    console.log = log;
    console.error = err;
    for (const [k, v] of [
      ["TYPESAFEAI_API_KEY", saved.a],
      ["TYPESAFE_API_KEY", saved.b],
    ] as const) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

describe("inspect claims", () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it("parses forbid and expect statements in order, and its options", () => {
    const o = parseClaimsArgs([
      "p.html",
      "--forbid",
      "an error message",
      "--expect",
      "a login form",
      "--viewport",
      "390x844",
      "--json",
    ]);
    assert.deepEqual(o.claims, [
      { statement: "an error message", expect: "absent" },
      { statement: "a login form", expect: "shown" },
    ]);
    assert.deepEqual(o.viewport, { width: 390, height: 844 });
    assert.equal(o.json, true);
  });

  it("refuses what it cannot run", () => {
    for (const [argv, re] of [
      [["p.html"], /nothing to check/],
      [["p.html", "an", "error", "--forbid", "x"], /quote each statement/],
      [["p.html", "--forbid"], /--forbid needs a value/],
      [["p.html", "--forbid", "x", "--viewport", "wide"], /WxH/],
      [["p.html", "--forbid", "x", "--threshold", "1"], /--threshold/],
      [["p.html", "--forbid", "x", "--bogus"], /unknown option/],
    ] as const) {
      assert.throws(
        () => parseClaimsArgs([...argv]),
        (e: Error) => e instanceof ClaimsUsageError && re.test(e.message),
      );
    }
    assert.deepEqual(parseClaimsFile('[{"statement":"a spinner","expect":"absent"}]', "c.json"), [
      { statement: "a spinner", expect: "absent" },
    ]);
    assert.throws(() => parseClaimsFile('[{"statement":"x","expect":"maybe"}]', "c.json"), /"shown" or "absent"/);
    assert.throws(() => parseClaimsFile("{}", "c.json"), /must be a list/);
  });

  it("prints help with exit 0, exits 2 on usage and without a key", async () => {
    assert.equal((await run(["--help"], undefined)).code, 0);
    assert.equal((await run(["p.html"], "k")).code, 2);
    const noKey = await run(["p.html", "--forbid", "an error message"], undefined);
    assert.equal(noKey.code, 2);
    assert.match(noKey.out, /TYPESAFEAI_API_KEY/);
  });

  it("screenshots a page at the viewport, asks Jev once, and exits 1 when a forbidden statement is shown", async () => {
    const page = join(dir, "page.html");
    writeFileSync(
      page,
      `<!doctype html><body style="margin:0;background:#fff"><div style="color:#b91c1c;padding:20px">Something went wrong</div>`,
    );
    let asked: { size: { width: number; height: number }; questions: string[] } | undefined;
    globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
      const form = init!.body as FormData;
      const req = JSON.parse(await (form.get("request") as Blob).text());
      const img = PNG.sync.read(Buffer.from(await (form.get("a0") as Blob).arrayBuffer()));
      asked = {
        size: { width: img.width, height: img.height },
        questions: Object.values(req.questions as Record<string, { instructions: string }>).map((q) => q.instructions),
      };
      // The first claim (the forbidden error) is shown; the expected heading is not.
      const answers = Object.fromEntries(
        Object.keys(req.questions).map((k, i) => [k, { type: "noul", noul: i === 0 ? 0.98 : 0.03 }]),
      );
      return Response.json({ model: "jev-fake", answers, usage: { input_tokens: 3000, output_tokens: 2 } });
    }) as typeof fetch;
    const save = join(dir, "shot.png");
    const r = await run(
      [
        page,
        "--forbid",
        "an error message",
        "--expect",
        "a page heading",
        "--viewport",
        "640x480",
        "--save",
        save,
        "--json",
      ],
      "k",
    );
    assert.equal(r.code, 1);
    assert.deepEqual(asked!.size, { width: 640, height: 480 });
    assert.deepEqual(asked!.questions, ["`screenshot` shows an error message.", "`screenshot` shows a page heading."]);
    const json = JSON.parse(r.out);
    assert.equal(json.passed, false);
    assert.deepEqual(
      json.results.map((x: { pass: boolean }) => x.pass),
      [false, false],
    );
    assert.equal(PNG.sync.read(readFileSync(save)).width, 640);
  });
});
