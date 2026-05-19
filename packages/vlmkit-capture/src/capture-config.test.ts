import assert from "node:assert/strict";
import { describe, it } from "node:test";
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

  it("loads routes from vrt.config.json in cwd", async () => {
    const dir = await mkdtemp(join(tmpdir(), "vrt-capture-"));
    try {
      await writeFile(join(dir, "vrt.config.json"), JSON.stringify({
        baseUrl: "http://localhost:5173",
        capture: {
          routes: [{ name: "home", path: "/", waitFor: "main" }],
        },
      }));

      const result = resolveCaptureRoutes({ cwd: dir });
      assert.equal(result.source, "config");
      assert.equal(result.baseUrl, "http://localhost:5173");
      assert.deepEqual(result.routes, [{ name: "home", path: "/", waitFor: "main" }]);
      assert.equal(result.configPath, join(dir, "vrt.config.json"));
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
      await writeFile(join(dir, "vrt.config.json"), JSON.stringify({
        capture: { routes: [{ path: "/default" }] },
      }));

      const result = resolveCaptureRoutes({ configPath: explicit, cwd: dir });
      assert.equal(result.source, "config");
      assert.deepEqual(result.routes, [{ name: "custom", path: "/custom" }]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("VRT_CAPTURE_ROUTES env var overrides config files", async () => {
    const dir = await mkdtemp(join(tmpdir(), "vrt-capture-"));
    try {
      await writeFile(join(dir, "vrt.config.json"), JSON.stringify({
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
      await writeFile(join(dir, "vrt.config.json"), JSON.stringify({
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
      () => resolveCaptureRoutes({ configPath: "/nonexistent/vrt.config.json" }),
      /Capture config not found/i,
    );
  });
});
