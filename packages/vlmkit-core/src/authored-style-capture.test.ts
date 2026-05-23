import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  AUTHORED_PROPERTIES,
  buildAuthoredStyleCaptureExpression,
  captureAuthoredStyleSnapshotInDom,
  hasMeaningfulAuthoredStyleSnapshot,
  parseAuthoredStyleSnapshot,
} from "./authored-style-capture.ts";
import { diffAuthoredStyles } from "./authored-style-diff.ts";

// ---------------------------------------------------------------------------
// Minimal browser-realm stub. We construct an in-memory cssRules tree that
// mimics what `document.styleSheets[i].cssRules` would expose to the
// browser-context capture function.
// ---------------------------------------------------------------------------

interface StubStyle {
  getPropertyValue(name: string): string;
}

interface StubRule {
  selectorText?: string;
  style?: StubStyle;
  conditionText?: string;
  media?: { mediaText?: string };
  cssRules?: StubRule[];
}

function styleRule(selectorText: string, decls: Record<string, string>): StubRule {
  return {
    selectorText,
    style: {
      getPropertyValue(name: string): string {
        return decls[name] ?? "";
      },
    },
  };
}

function mediaRule(mediaText: string, rules: StubRule[]): StubRule {
  return {
    media: { mediaText },
    cssRules: rules,
  };
}

function installStubStylesheets(sheets: StubRule[][]) {
  const sheetObjects = sheets.map((rules) => ({ cssRules: rules }));
  (globalThis as unknown as { document: unknown }).document = {
    styleSheets: sheetObjects,
  };
}

function clearStubStylesheets() {
  delete (globalThis as unknown as { document?: unknown }).document;
}

describe("captureAuthoredStyleSnapshotInDom", () => {
  it("captures grid-template-columns from a plain rule", () => {
    installStubStylesheets([
      [
        styleRule(".shell", {
          "grid-template-columns": "minmax(0, 1fr) 4px minmax(0, 1fr)",
          "color": "red",
        }),
      ],
    ]);
    try {
      const snap = captureAuthoredStyleSnapshotInDom(AUTHORED_PROPERTIES);
      assert.equal(
        snap[".shell"]!["grid-template-columns"],
        "minmax(0, 1fr) 4px minmax(0, 1fr)",
      );
      assert.equal(snap[".shell"]!["color"], undefined, "non-tracked props are skipped");
    } finally {
      clearStubStylesheets();
    }
  });

  it("fans out comma-separated selectors", () => {
    installStubStylesheets([
      [
        styleRule(".a, .b", {
          "transform": "translateY(4px)",
        }),
      ],
    ]);
    try {
      const snap = captureAuthoredStyleSnapshotInDom(AUTHORED_PROPERTIES);
      assert.equal(snap[".a"]!["transform"], "translateY(4px)");
      assert.equal(snap[".b"]!["transform"], "translateY(4px)");
    } finally {
      clearStubStylesheets();
    }
  });

  it("scopes selectors inside @media so the diff treats them as distinct", () => {
    installStubStylesheets([
      [
        styleRule(".shell", { "grid-template-columns": "1fr" }),
        mediaRule("(min-width: 768px)", [
          styleRule(".shell", {
            "grid-template-columns": "minmax(0, 1fr) 4px minmax(0, 1fr)",
          }),
        ]),
      ],
    ]);
    try {
      const snap = captureAuthoredStyleSnapshotInDom(AUTHORED_PROPERTIES);
      assert.equal(snap[".shell"]!["grid-template-columns"], "1fr");
      assert.equal(
        snap["@media (min-width: 768px) :: .shell"]!["grid-template-columns"],
        "minmax(0, 1fr) 4px minmax(0, 1fr)",
      );
    } finally {
      clearStubStylesheets();
    }
  });

  it("last authored declaration wins per (selector, property)", () => {
    installStubStylesheets([
      [styleRule(".shell", { transform: "translateY(2px)" })],
      [styleRule(".shell", { transform: "translateY(8px)" })],
    ]);
    try {
      const snap = captureAuthoredStyleSnapshotInDom(AUTHORED_PROPERTIES);
      assert.equal(snap[".shell"]!.transform, "translateY(8px)");
    } finally {
      clearStubStylesheets();
    }
  });
});

describe("buildAuthoredStyleCaptureExpression", () => {
  it("embeds the requested props as a JSON-encoded array", () => {
    const expr = buildAuthoredStyleCaptureExpression(["grid-template-columns"]);
    assert.match(expr, /\["grid-template-columns"\]/);
  });
});

describe("parseAuthoredStyleSnapshot", () => {
  it("accepts a JSON string and a plain object", () => {
    const obj = { ".a": { transform: "rotate(1deg)" } };
    assert.deepEqual(parseAuthoredStyleSnapshot(obj), obj);
    assert.deepEqual(parseAuthoredStyleSnapshot(JSON.stringify(obj)), obj);
  });

  it("defends against garbage", () => {
    assert.deepEqual(parseAuthoredStyleSnapshot("not-json"), {});
    assert.deepEqual(parseAuthoredStyleSnapshot(null), {});
    assert.deepEqual(parseAuthoredStyleSnapshot([1, 2]), {});
  });

  it("coerces non-string values to strings", () => {
    const out = parseAuthoredStyleSnapshot({ ".a": { transform: 42 } });
    assert.equal(out[".a"]!.transform, "42");
  });
});

describe("hasMeaningfulAuthoredStyleSnapshot", () => {
  it("returns true when any value is non-empty", () => {
    assert.equal(
      hasMeaningfulAuthoredStyleSnapshot({ ".a": { transform: "rotate(1deg)" } }),
      true,
    );
  });
  it("returns false on whitespace-only values", () => {
    assert.equal(
      hasMeaningfulAuthoredStyleSnapshot({ ".a": { transform: "   " } }),
      false,
    );
  });
});

describe("diffAuthoredStyles", () => {
  it("surfaces the 4px column-width example as a clean entry", () => {
    const baseline = {
      ".shell": {
        "grid-template-columns": "minmax(0, 1fr) minmax(0, 1fr)",
      },
    };
    const variant = {
      ".shell": {
        "grid-template-columns": "minmax(0, 1fr) 4px minmax(0, 1fr)",
      },
    };
    const result = diffAuthoredStyles(baseline, variant);
    assert.equal(result.totalDiffs, 1);
    assert.equal(result.entries[0]!.selector, ".shell");
    assert.equal(result.entries[0]!.property, "grid-template-columns");
    assert.equal(
      result.entries[0]!.baseline,
      "minmax(0, 1fr) minmax(0, 1fr)",
    );
    assert.equal(
      result.entries[0]!.variant,
      "minmax(0, 1fr) 4px minmax(0, 1fr)",
    );
  });
});
