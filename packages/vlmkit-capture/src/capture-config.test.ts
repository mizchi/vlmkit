import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  DEFAULT_CAPTURE_BASE_URL,
  DEFAULT_CAPTURE_ROUTES,
  parseCaptureConfig,
  resolveCaptureRoutes,
  routeNameFromPath,
} from "./capture-config.ts";

describe("routeNameFromPath", () => {
  it("returns 'home' for root paths", () => {
    assert.equal(routeNameFromPath("/"), "home");
    assert.equal(routeNameFromPath(""), "home");
  });

  it("sanitizes non-alphanumerics", () => {
    assert.equal(routeNameFromPath("/users/profile"), "users_profile");
    assert.equal(routeNameFromPath("/issues?severity=critical"), "issues");
    assert.equal(routeNameFromPath("/about#contact"), "about");
  });
});

describe("parseCaptureConfig", () => {
  it("accepts a baseUrl + capture.routes block", () => {
    const config = parseCaptureConfig(JSON.stringify({
      baseUrl: "http://localhost:3000",
      capture: {
        routes: [
          { name: "home", path: "/", waitFor: "main" },
          { path: "/about" },
          "/contact",
        ],
      },
    }));

    assert.equal(config.baseUrl, "http://localhost:3000");
    assert.deepEqual(config.routes, [
      { name: "home", path: "/", waitFor: "main" },
      { name: "about", path: "/about" },
      { name: "contact", path: "/contact" },
    ]);
  });

  it("reads baseUrl from inside the capture block, where routes already came from", () => {
    // The config anyone writes: both keys together, under `capture`. `routes` was read from
    // both places and `baseUrl` from the top level only, so this one silently used the
    // default URL — a capture pointed at 127.0.0.1:4174 while the config said otherwise,
    // with nothing in the output to say the key had been dropped.
    const config = parseCaptureConfig(JSON.stringify({
      capture: { baseUrl: "http://localhost:9999", routes: ["/"] },
    }));
    assert.equal(config.baseUrl, "http://localhost:9999");
    assert.deepEqual(config.routes, [{ name: "home", path: "/" }]);
  });

  it("prefers capture.baseUrl over a top-level one, matching how routes resolve", () => {
    const config = parseCaptureConfig(JSON.stringify({
      baseUrl: "http://outer:3000",
      capture: { baseUrl: "http://inner:4000" },
    }));
    assert.equal(config.baseUrl, "http://inner:4000");
  });

  it("still falls back to the top-level baseUrl when the capture block omits it", () => {
    const config = parseCaptureConfig(JSON.stringify({
      baseUrl: "http://outer:3000",
      capture: { routes: ["/"] },
    }));
    assert.equal(config.baseUrl, "http://outer:3000");
  });

  it("an explicit null inside the capture block still fails loudly", () => {
    // The reason the key lookup is wrapped instead of using `??`: a present-but-null value
    // has to stay distinguishable from an absent one, or `"routes": null` would fall through
    // to the top level and be ignored — the same silent drop this pair of tests exists for.
    assert.throws(
      () => parseCaptureConfig(JSON.stringify({ routes: ["/"], capture: { routes: null } })),
      /routes must be an array/,
    );
  });

  it("falls back to top-level routes when no capture block exists", () => {
    const config = parseCaptureConfig(JSON.stringify({
      baseUrl: "http://localhost:3000",
      routes: [
        { path: "/dashboard", label: "dash" },
      ],
    }));

    assert.deepEqual(config.routes, [{ name: "dash", path: "/dashboard" }]);
  });

  it("rejects empty paths", () => {
    assert.throws(
      () => parseCaptureConfig(JSON.stringify({ capture: { routes: [{ path: "" }] } })),
      /must have a path/i,
    );
  });

  it("rejects invalid JSON", () => {
    assert.throws(() => parseCaptureConfig("{ not json"), /Invalid capture config JSON/i);
  });

  it("rejects array root", () => {
    assert.throws(() => parseCaptureConfig("[]"), /must be an object/i);
  });
});

describe("resolveCaptureRoutes", () => {
  it("returns defaults when nothing is provided", async () => {
    const dir = await mkdtemp(join(tmpdir(), "vrt-capture-"));
    try {
      const result = resolveCaptureRoutes({ cwd: dir });
      assert.equal(result.source, "default");
      assert.equal(result.baseUrl, DEFAULT_CAPTURE_BASE_URL);
      assert.equal(result.routes, DEFAULT_CAPTURE_ROUTES);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("loads routes from vlmkit.config.json in cwd", async () => {
    const dir = await mkdtemp(join(tmpdir(), "vrt-capture-"));
    try {
      await writeFile(join(dir, "vlmkit.config.json"), JSON.stringify({
        baseUrl: "http://localhost:5173",
        capture: {
          routes: [{ name: "home", path: "/", waitFor: "main" }],
        },
      }));

      const result = resolveCaptureRoutes({ cwd: dir });
      assert.equal(result.source, "config");
      assert.equal(result.baseUrl, "http://localhost:5173");
      assert.deepEqual(result.routes, [{ name: "home", path: "/", waitFor: "main" }]);
      assert.equal(result.configPath, join(dir, "vlmkit.config.json"));
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("prefers an explicit config path over auto-discovery", async () => {
    const dir = await mkdtemp(join(tmpdir(), "vrt-capture-"));
    try {
      const explicit = join(dir, "custom.json");
      await writeFile(explicit, JSON.stringify({
        capture: { routes: [{ path: "/custom" }] },
      }));
      await writeFile(join(dir, "vlmkit.config.json"), JSON.stringify({
        capture: { routes: [{ path: "/default" }] },
      }));

      const result = resolveCaptureRoutes({ configPath: explicit, cwd: dir });
      assert.equal(result.source, "config");
      assert.deepEqual(result.routes, [{ name: "custom", path: "/custom" }]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("VLMKIT_CAPTURE_ROUTES env var overrides config files", async () => {
    const dir = await mkdtemp(join(tmpdir(), "vrt-capture-"));
    try {
      await writeFile(join(dir, "vlmkit.config.json"), JSON.stringify({
        capture: { routes: [{ path: "/from-config" }] },
      }));
      const result = resolveCaptureRoutes({
        cwd: dir,
        envRoutes: JSON.stringify([{ name: "envhome", path: "/" }]),
        envBaseUrl: "http://envhost:9999",
      });

      assert.equal(result.source, "env");
      assert.equal(result.baseUrl, "http://envhost:9999");
      assert.deepEqual(result.routes, [{ name: "envhome", path: "/" }]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("env base URL overrides config baseUrl", async () => {
    const dir = await mkdtemp(join(tmpdir(), "vrt-capture-"));
    try {
      await writeFile(join(dir, "vlmkit.config.json"), JSON.stringify({
        baseUrl: "http://config-base:3000",
        capture: { routes: [{ path: "/" }] },
      }));
      const result = resolveCaptureRoutes({
        cwd: dir,
        envBaseUrl: "http://override:8080",
      });
      assert.equal(result.baseUrl, "http://override:8080");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("throws when an explicit config path is missing", () => {
    assert.throws(
      () => resolveCaptureRoutes({ configPath: "/nonexistent/vlmkit.config.json" }),
      /Capture config not found/i,
    );
  });
});
