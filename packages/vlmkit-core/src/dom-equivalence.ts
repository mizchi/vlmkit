/**
 * DOM equivalence preflight for `migration-compare`.
 *
 * Catches the failure mode from `docs/reports/2026-05-12-dogfood-shadcn-luna.md`:
 * an agent edits the *body* of the variant HTML (rename a heading, drop a
 * button, change input values) and the run blames `layout-shift` because
 * the renders diverge structurally rather than stylistically.
 *
 * The preflight captures three lightweight fingerprints per document:
 *   - heading texts in document order (h1..h6)
 *   - button texts in document order
 *   - input/textarea/select value sequence
 *
 * Both pure helpers (sequence diff) and a browser-side capture script live
 * here; migration-compare evaluates the script with `page.evaluate()`
 * and feeds the results into `evaluateDomEquivalence`.
 */

export interface DomFingerprint {
  headingTexts: string[];
  buttonTexts: string[];
  inputValues: string[];
  elementCount: number;
}

export interface DomEquivalenceWarning {
  code:
    | "heading-mismatch"
    | "button-mismatch"
    | "input-mismatch"
    | "element-count-mismatch";
  message: string;
  baseline: string[];
  variant: string[];
}

export interface DomEquivalenceResult {
  ok: boolean;
  warnings: DomEquivalenceWarning[];
}

function normalize(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function diffSequence(a: string[], b: string[]): { added: string[]; removed: string[]; reordered: boolean } {
  const aNorm = a.map(normalize);
  const bNorm = b.map(normalize);
  const aSet = new Set(aNorm);
  const bSet = new Set(bNorm);
  const added = bNorm.filter((x) => !aSet.has(x));
  const removed = aNorm.filter((x) => !bSet.has(x));
  const sameElements = added.length === 0 && removed.length === 0;
  const reordered = sameElements && aNorm.join("|") !== bNorm.join("|");
  return { added, removed, reordered };
}

function makeMismatchMessage(
  kind: "headings" | "buttons" | "inputs",
  diff: { added: string[]; removed: string[]; reordered: boolean },
): string {
  if (diff.reordered) {
    return `${kind} reordered between baseline and variant`;
  }
  const parts: string[] = [];
  if (diff.removed.length > 0) {
    parts.push(`missing in variant: [${diff.removed.map((s) => `"${s}"`).join(", ")}]`);
  }
  if (diff.added.length > 0) {
    parts.push(`extra in variant: [${diff.added.map((s) => `"${s}"`).join(", ")}]`);
  }
  return `${kind} differ — ${parts.join("; ")}`;
}

/**
 * Threshold: 5% element-count drift before flagging. Single-element drift on
 * small fixtures is noise; large additions/removals are usually a real
 * DOM edit.
 */
const ELEMENT_COUNT_DRIFT_THRESHOLD = 0.05;

/**
 * Verify structural DOM equivalence between two captured fingerprints.
 *
 * @since 0.5.0 — replaces `evaluateDomEquivalence`.
 */
export function verifyDomEquivalence(
  baseline: DomFingerprint,
  variant: DomFingerprint,
): DomEquivalenceResult {
  const warnings: DomEquivalenceWarning[] = [];

  const headingDiff = diffSequence(baseline.headingTexts, variant.headingTexts);
  if (headingDiff.added.length > 0 || headingDiff.removed.length > 0 || headingDiff.reordered) {
    warnings.push({
      code: "heading-mismatch",
      message: makeMismatchMessage("headings", headingDiff),
      baseline: baseline.headingTexts,
      variant: variant.headingTexts,
    });
  }

  const buttonDiff = diffSequence(baseline.buttonTexts, variant.buttonTexts);
  if (buttonDiff.added.length > 0 || buttonDiff.removed.length > 0 || buttonDiff.reordered) {
    warnings.push({
      code: "button-mismatch",
      message: makeMismatchMessage("buttons", buttonDiff),
      baseline: baseline.buttonTexts,
      variant: variant.buttonTexts,
    });
  }

  const inputDiff = diffSequence(baseline.inputValues, variant.inputValues);
  if (inputDiff.added.length > 0 || inputDiff.removed.length > 0 || inputDiff.reordered) {
    warnings.push({
      code: "input-mismatch",
      message: makeMismatchMessage("inputs", inputDiff),
      baseline: baseline.inputValues,
      variant: variant.inputValues,
    });
  }

  const drift = baseline.elementCount === 0
    ? 0
    : Math.abs(baseline.elementCount - variant.elementCount) / baseline.elementCount;
  if (drift > ELEMENT_COUNT_DRIFT_THRESHOLD) {
    warnings.push({
      code: "element-count-mismatch",
      message: `total element count differs by ${(drift * 100).toFixed(1)}% ` +
        `(baseline: ${baseline.elementCount}, variant: ${variant.elementCount})`,
      baseline: [String(baseline.elementCount)],
      variant: [String(variant.elementCount)],
    });
  }

  return { ok: warnings.length === 0, warnings };
}

/**
 * Browser-side capture script. Designed to be passed verbatim to
 * `page.evaluate()`; produces a {@link DomFingerprint}.
 */
export const DOM_FINGERPRINT_BROWSER_SCRIPT = `(() => {
  const norm = (s) => (s || "").replace(/\\s+/g, " ").trim();
  const headingTexts = Array.from(document.querySelectorAll("h1, h2, h3, h4, h5, h6")).map((el) => norm(el.textContent));
  const buttonTexts = Array.from(document.querySelectorAll("button")).map((el) => norm(el.textContent));
  const inputValues = Array.from(document.querySelectorAll("input, textarea, select")).map((el) => {
    const v = el.value != null ? el.value : el.getAttribute("value") || "";
    return norm(v);
  });
  const elementCount = document.querySelectorAll("*").length;
  return { headingTexts, buttonTexts, inputValues, elementCount };
})()`;

/**
 * @deprecated since 0.5.0 — use `verifyDomEquivalence` instead. Removed in 1.0.0.
 */
export const evaluateDomEquivalence = verifyDomEquivalence;
