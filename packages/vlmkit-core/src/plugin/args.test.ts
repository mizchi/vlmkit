import assert from "node:assert/strict";
import { describe, it } from "vitest";
import {
  firstPositional,
  firstPositionalOrUndefined,
  numberList,
  numberListFloat,
  optionalInt,
  runOutputDir,
  viewportFlag,
  vlmFlag,
  withoutOptionalValue,
} from "./args.ts";
import { UsageError } from "../cli-error.ts";

describe("runOutputDir", () => {
  it("gives two sources two directories, so one run cannot overwrite the other", () => {
    // Measured before this existed: `check a11y contrast` on two pages in a row wrote
    // `report.md` AND `page.png` into one folder, so the second silently replaced the
    // first. Same clobber v2 found in `check drift component` and fixed for drift only.
    const a = runOutputDir("a11y-contrast", "fixtures/page.html");
    const b = runOutputDir("a11y-contrast", "fixtures/dashboard.html");
    assert.notEqual(a, b);
    assert.match(a, /a11y-contrast[/\\]page-[0-9a-f]{8}$/);
    assert.match(b, /a11y-contrast[/\\]dashboard-[0-9a-f]{8}$/);
  });

  it("is stable across runs, so a re-run overwrites its own previous report", () => {
    // The point is not uniqueness per invocation — a caller comparing two runs of the
    // same check wants the same path both times.
    assert.equal(runOutputDir("g", "a.html"), runOutputDir("g", "a.html"));
  });

  it("separates two discriminators on one source", () => {
    // Two selectors on one page are two different runs; drift passes its --selector.
    assert.notEqual(
      runOutputDir("component-consistency", "a.html", ".card"),
      runOutputDir("component-consistency", "a.html", ".card:not(.card--featured)"),
    );
  });

  it("distinguishes two sources that share a basename", () => {
    // The readable half collides; the hash is what keeps them apart.
    const a = runOutputDir("g", "en/index.html");
    const b = runOutputDir("g", "ja/index.html");
    assert.notEqual(a, b);
    assert.match(a, /index-[0-9a-f]{8}$/);
  });

  it("keeps a URL source out of the path, since it is not a path component", () => {
    const dir = runOutputDir("g", "http://localhost:5173/app?x=1");
    assert.doesNotMatch(dir, /https?:/);
    assert.doesNotMatch(dir, /[?]/);
  });
});

describe("firstPositional", () => {
  it("finds the source past flags that take a value", () => {
    // The whole reason `COMMON_VALUE_FLAGS` exists: without it `--timeout 15000
    // page.html` returns "15000" as the source, and the gate opens a file named
    // after a number.
    assert.equal(firstPositional(["--timeout", "15000", "page.html"], "usage"), "page.html");
    assert.equal(firstPositional(["--wait-until", "load", "page.html"], "usage"), "page.html");
    assert.equal(firstPositional(["--viewports", "375,768", "page.html"], "usage"), "page.html");
    assert.equal(firstPositional(["page.html", "--json"], "usage"), "page.html");
  });

  it("takes extra value flags a gate declares itself", () => {
    assert.equal(
      firstPositional(["--manifest", "copy.txt", "page.html"], "usage", ["--manifest"]),
      "page.html",
    );
    // Undeclared, so the value reads as the source — which is why a gate passing
    // its own value flags is not optional.
    assert.equal(firstPositional(["--manifest", "copy.txt", "page.html"], "usage"), "copy.txt");
  });

  it("throws a UsageError naming the usage line when there is no positional", () => {
    assert.throws(
      () => firstPositional(["--json"], "vlmkit check thing <html-or-url>"),
      (e: unknown) => e instanceof UsageError && /vlmkit check thing <html-or-url>/.test((e as Error).message),
    );
  });
});

describe("firstPositionalOrUndefined", () => {
  it("returns undefined rather than throwing, for a gate whose source is optional", () => {
    // `check integrity` needs the distinction so it can REJECT being given both a
    // page and `--elements`, rather than silently preferring one.
    assert.equal(firstPositionalOrUndefined(["--elements", "e.json"]), undefined);
    assert.equal(firstPositionalOrUndefined(["--elements", "e.json", "page.html"]), "page.html");
  });
});

describe("withoutOptionalValue", () => {
  it("drops an optionally-valued flag and the token it consumed", () => {
    assert.deepEqual(withoutOptionalValue(["--vlm", "gpt", "page.html"], "vlm"), ["page.html"]);
  });

  it("drops a bare flag without eating the next flag", () => {
    assert.deepEqual(withoutOptionalValue(["--vlm", "--json", "page.html"], "vlm"), ["--json", "page.html"]);
  });

  it("uses the same rule as vlmFlag, so the two cannot disagree about the model", () => {
    // Both bugs this prevents shipped: listing `--vlm` as always-valued made bare
    // `--vlm page.html` eat the source; omitting it made `--vlm <model> page.html`
    // return the model id AS the source, and the gate opened
    // `bytedance/ui-tars-1.5-7b` as a file.
    const argv = ["--vlm", "bytedance/ui-tars-1.5-7b", "page.html"];
    assert.equal(vlmFlag(argv), "bytedance/ui-tars-1.5-7b");
    assert.deepEqual(withoutOptionalValue(argv, "vlm"), ["page.html"]);

    const bare = ["--vlm", "page.html"];
    assert.equal(vlmFlag(bare), "page.html", "the next non-flag token IS the value");
    assert.deepEqual(withoutOptionalValue(bare, "vlm"), [], "so it is removed, leaving no source");
  });

  it("leaves argv alone when the flag is absent", () => {
    assert.deepEqual(withoutOptionalValue(["page.html", "--json"], "vlm"), ["page.html", "--json"]);
  });
});

describe("numberList / numberListFloat", () => {
  it("splits a comma list and trims", () => {
    assert.deepEqual(numberList(["--breakpoints", "768, 1024 ,1280"], "breakpoints"), [768, 1024, 1280]);
  });

  it("is undefined for an absent flag, which is not the same as an empty list", () => {
    assert.equal(numberList([], "breakpoints"), undefined);
    assert.deepEqual(numberList(["--breakpoints", ""], "breakpoints"), []);
  });

  it("names the offending part rather than yielding NaN", () => {
    assert.throws(() => numberList(["--breakpoints", "768,wide"], "breakpoints"), /"wide" is not a number/);
  });

  it("keeps fractions where a scale legitimately has them", () => {
    assert.deepEqual(numberListFloat(["--radius-scale", "0,2,4.5"], "radius-scale"), [0, 2, 4.5]);
    // parseInt would silently truncate 4.5 to 4, which is why the two exist.
    assert.deepEqual(numberList(["--radius-scale", "4.5"], "radius-scale"), [4]);
    assert.throws(() => numberListFloat(["--s", "1,x"], "s"), /"x" is not a number/);
  });
});

describe("viewportFlag", () => {
  it("parses <width>x<height>", () => {
    assert.deepEqual(viewportFlag(["--viewport", "1280x720"]), { width: 1280, height: 720 });
    assert.deepEqual(viewportFlag(["--shot", "375x667"], "shot"), { width: 375, height: 667 });
  });

  it("is undefined when absent, and an error when malformed", () => {
    assert.equal(viewportFlag([]), undefined);
    for (const bad of ["1280", "1280*720", "1280x", "wide x tall"]) {
      assert.throws(() => viewportFlag(["--viewport", bad]), /expects <width>x<height>/);
    }
  });
});

describe("optionalInt", () => {
  it("reads an int, enforces a floor, and refuses a non-number", () => {
    assert.equal(optionalInt(["--max", "12"], "max"), 12);
    assert.equal(optionalInt([], "max"), undefined);
    assert.throws(() => optionalInt(["--max", "0"], "max", { min: 1 }), /max/);
    // The form this replaced -- `Number.parseInt(argv[++i] ?? "12", 10)` -- accepted
    // `--max --json` as NaN.
    assert.throws(() => optionalInt(["--max", "--json"], "max"), /max/);
  });
});

describe("vlmFlag", () => {
  it("distinguishes absent, bare, and given-a-model", () => {
    assert.equal(vlmFlag([]), undefined, "absent means stay deterministic");
    assert.equal(vlmFlag(["--vlm"]), true, "bare means the default model");
    assert.equal(vlmFlag(["--vlm", "claude:haiku"]), "claude:haiku");
    assert.equal(vlmFlag(["--vlm", "--json"]), true, "a following flag is not a model id");
  });

  it("takes the last occurrence, matching how every other flag reader behaves", () => {
    assert.equal(vlmFlag(["--vlm", "a", "--vlm", "b"]), "b");
  });
});
