import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseDiffPrConfig,
  resolveA11yPolicy,
  resolveThreshold,
} from "./diff-pr-config.ts";

describe("parseDiffPrConfig", () => {
  it("accepts the minimal shape", () => {
    const cfg = parseDiffPrConfig(JSON.stringify({
      baseUrl: "http://localhost:3000",
      routes: [{ name: "home", path: "/" }],
    }));
    assert.equal(cfg.routes.length, 1);
    assert.equal(cfg.routes[0].name, "home");
    assert.equal(cfg.routes[0].url, "http://localhost:3000/");
    assert.equal(cfg.baselineDir, ".vrt/baselines");
  });

  it("honors thresholds at top level and per-route overrides", () => {
    const cfg = parseDiffPrConfig(JSON.stringify({
      baseUrl: "http://localhost:3000",
      thresholds: { mobile: 0.01, desktop: 0.005, wide: 0.005 },
      routes: [
        { name: "home", path: "/" },
        { name: "admin", path: "/admin", thresholds: { mobile: 0.03, desktop: 0.02, wide: 0.02 } },
      ],
    }));
    assert.equal(resolveThreshold(cfg, cfg.routes[0], "mobile"), 0.01);
    assert.equal(resolveThreshold(cfg, cfg.routes[1], "mobile"), 0.03);
    assert.equal(resolveThreshold(cfg, cfg.routes[1], "desktop"), 0.02);
  });

  it("parses a TOML config (detected by the .toml path) with per-route overrides", () => {
    const toml = `
baseUrl = "http://localhost:3000"
viewports = ["mobile", "desktop", "wide"]
baselineDir = ".vrt/goldens"

[thresholds]
mobile = 0.01
desktop = 0.005
wide = 0.005

[a11y]
level = "AAA"

[[routes]]
name = "home"
path = "/"

[[routes]]
name = "admin"
path = "/admin"
[routes.thresholds]
mobile = 0.03
desktop = 0.02
wide = 0.02
`;
    const cfg = parseDiffPrConfig(toml, "/tmp/vrt.config.toml");
    assert.equal(cfg.routes.length, 2);
    assert.equal(cfg.routes[0].name, "home");
    assert.equal(cfg.routes[0].url, "http://localhost:3000/");
    assert.equal(cfg.baselineDir, ".vrt/goldens");
    assert.deepEqual(cfg.viewports, ["mobile", "desktop", "wide"]);
    assert.equal(cfg.a11y?.level, "AAA");
    assert.equal(resolveThreshold(cfg, cfg.routes[0], "mobile"), 0.01);
    assert.equal(resolveThreshold(cfg, cfg.routes[1], "mobile"), 0.03);
    assert.equal(resolveThreshold(cfg, cfg.routes[1], "wide"), 0.02);
  });

  it("still parses JSON when the path is not .toml", () => {
    const cfg = parseDiffPrConfig(
      JSON.stringify({ routes: [{ name: "home", url: "http://x/" }] }),
      "/tmp/vrt.config.json",
    );
    assert.equal(cfg.routes[0].name, "home");
  });

  it("accepts routes under `capture.routes` (workflow-config parity)", () => {
    const cfg = parseDiffPrConfig(JSON.stringify({
      baseUrl: "http://localhost:3000",
      capture: { routes: [{ name: "home", path: "/" }] },
    }));
    assert.equal(cfg.routes.length, 1);
  });

  it("accepts a bare string route and derives the name", () => {
    const cfg = parseDiffPrConfig(JSON.stringify({
      baseUrl: "http://localhost:3000",
      routes: ["/about-us"],
    }));
    assert.equal(cfg.routes[0].name, "about_us");
    assert.equal(cfg.routes[0].url, "http://localhost:3000/about-us");
  });

  it("preserves absolute URLs without joining to baseUrl", () => {
    const cfg = parseDiffPrConfig(JSON.stringify({
      baseUrl: "http://localhost:3000",
      routes: [{ name: "external", url: "https://example.com/" }],
    }));
    assert.equal(cfg.routes[0].url, "https://example.com/");
  });

  it("rejects an empty routes array", () => {
    assert.throws(
      () => parseDiffPrConfig(JSON.stringify({ routes: [] })),
      /at least one route/,
    );
  });

  it("rejects a missing routes field", () => {
    assert.throws(
      () => parseDiffPrConfig(JSON.stringify({ baseUrl: "x" })),
      /routes/i,
    );
  });

  it("rejects malformed thresholds", () => {
    assert.throws(
      () => parseDiffPrConfig(JSON.stringify({
        baseUrl: "x",
        thresholds: { mobile: "not-a-number" },
        routes: ["/"],
      })),
      /thresholds\.mobile/,
    );
  });

  it("merges built-in default thresholds when none are declared", () => {
    const cfg = parseDiffPrConfig(JSON.stringify({
      baseUrl: "http://localhost:3000",
      routes: ["/"],
    }));
    assert.equal(cfg.thresholds.mobile, 0.01);
    assert.equal(cfg.thresholds.desktop, 0.005);
    assert.equal(cfg.thresholds.wide, 0.005);
  });

  it("falls back to a sensible threshold when neither route nor project declares one", () => {
    const cfg = parseDiffPrConfig(JSON.stringify({
      baseUrl: "x",
      routes: ["/"],
    }));
    // Unrecognized viewport name → fallback 0.01 (per resolveThreshold).
    assert.equal(resolveThreshold(cfg, cfg.routes[0], "ultrawide"), 0.01);
  });

  it("resolves a11y policy with project + route merge", () => {
    const cfg = parseDiffPrConfig(JSON.stringify({
      baseUrl: "http://localhost:3000",
      a11y: { level: "AA", maxContrastFailures: 0, maxTouchFailures: 0 },
      routes: [
        "/",
        { name: "admin", path: "/admin",
          a11y: { maxContrastFailures: 5 } },
        { name: "marketing", path: "/marketing",
          a11y: { contrast: false } },
      ],
    }));
    const home = resolveA11yPolicy(cfg, cfg.routes[0])!;
    assert.equal(home.level, "AA");
    assert.equal(home.maxContrastFailures, 0);
    assert.equal(home.contrast, true);
    assert.equal(home.touch, true);

    const admin = resolveA11yPolicy(cfg, cfg.routes[1])!;
    assert.equal(admin.level, "AA");
    assert.equal(admin.maxContrastFailures, 5, "route override beats project");
    assert.equal(admin.maxTouchFailures, 0, "project default still applies for unset fields");

    const marketing = resolveA11yPolicy(cfg, cfg.routes[2])!;
    assert.equal(marketing.contrast, false, "route can disable a check");
  });

  it("returns undefined a11y policy when neither project nor route declares one", () => {
    const cfg = parseDiffPrConfig(JSON.stringify({
      baseUrl: "x",
      routes: ["/"],
    }));
    assert.equal(resolveA11yPolicy(cfg, cfg.routes[0]), undefined);
  });

  it("rejects malformed a11y values", () => {
    assert.throws(
      () => parseDiffPrConfig(JSON.stringify({
        baseUrl: "x",
        a11y: { level: "AAAA" },
        routes: ["/"],
      })),
      /a11y\.level/,
    );
    assert.throws(
      () => parseDiffPrConfig(JSON.stringify({
        baseUrl: "x",
        a11y: { maxContrastFailures: -1 },
        routes: ["/"],
      })),
      /maxContrastFailures/,
    );
  });

  it("parses mediaVariants policy with explicit variants list", () => {
    const cfg = parseDiffPrConfig(JSON.stringify({
      baseUrl: "http://localhost:3000",
      mediaVariants: {
        variants: ["forced-colors", "reduced-motion", "rtl"],
        maxSuspects: 0,
        maxWarns: 3,
        threshold: 0.05,
      },
      routes: ["/"],
    }));
    assert.deepEqual(cfg.mediaVariants?.variants, ["forced-colors", "reduced-motion", "rtl"]);
    assert.equal(cfg.mediaVariants?.maxSuspects, 0);
    assert.equal(cfg.mediaVariants?.maxWarns, 3);
    assert.equal(cfg.mediaVariants?.threshold, 0.05);
  });

  it("accepts mediaVariants with no variants field (defaults to all)", () => {
    const cfg = parseDiffPrConfig(JSON.stringify({
      baseUrl: "x",
      mediaVariants: { maxWarns: 5 },
      routes: ["/"],
    }));
    assert.equal(cfg.mediaVariants?.variants, undefined);
    assert.equal(cfg.mediaVariants?.maxWarns, 5);
  });

  it("rejects malformed mediaVariants values", () => {
    assert.throws(
      () => parseDiffPrConfig(JSON.stringify({
        baseUrl: "x",
        mediaVariants: { variants: ["forced-colors", "bogus"] },
        routes: ["/"],
      })),
      /variants\[1\] must be one of/,
    );
    assert.throws(
      () => parseDiffPrConfig(JSON.stringify({
        baseUrl: "x",
        mediaVariants: { maxSuspects: -1 },
        routes: ["/"],
      })),
      /maxSuspects/,
    );
  });

  it("returns undefined mediaVariants when not declared", () => {
    const cfg = parseDiffPrConfig(JSON.stringify({
      baseUrl: "x",
      routes: ["/"],
    }));
    assert.equal(cfg.mediaVariants, undefined);
  });

  it("captures tokens, approvalPath, baselineDir overrides", () => {
    const cfg = parseDiffPrConfig(JSON.stringify({
      baseUrl: "x",
      routes: ["/"],
      tokens: "./DESIGN.md",
      approvalPath: "./manifest.json",
      baselineDir: "ci-baselines",
    }));
    assert.equal(cfg.tokens, "./DESIGN.md");
    assert.equal(cfg.approvalPath, "./manifest.json");
    assert.equal(cfg.baselineDir, "ci-baselines");
  });
});
