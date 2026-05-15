/**
 * Static-DOM a11y checks — non-visual, non-interactive. Catches the
 * "I forgot the alt text" / "two h1s on this page" / "input has no
 * label" class of bug that contrast/touch/focus-order miss.
 *
 * Three checks share one sample script for browser efficiency:
 *
 *   - heading-hierarchy: at most one h1; no skipped levels in a
 *     subtree (e.g. h2 → h4 without an intermediate h3).
 *   - form-label: every focusable input/select/textarea has either a
 *     <label for=...>, a wrapping <label>, an aria-label, or an
 *     aria-labelledby pointing at a non-empty element.
 *   - image-alt: every <img> has an `alt` attribute (empty alt is
 *     fine — that's the "decorative" convention) OR
 *     `aria-hidden="true"` OR `role="presentation"`.
 *
 * Pure post-process — works on samples captured from any Playwright
 * Page via the on-page helper.
 *
 * Out of scope (would need a real a11y tree): role conflicts,
 * landmark coverage, ARIA-attribute validity. Add when the existing
 * `a11y-semantic.ts` (Playwright's accessibility API) is folded into
 * the same pipeline — separate ticket.
 */

export interface A11ySemanticRawSample {
  headings: Array<{
    level: number;
    path: string;
    text: string;
  }>;
  formControls: Array<{
    path: string;
    tag: string;
    type: string;
    hasAssociatedLabel: boolean;
    hasAriaLabel: boolean;
    hasAriaLabelledby: boolean;
    ariaLabelledbyTargetText: string;
    placeholder: string;
  }>;
  images: Array<{
    path: string;
    src: string;
    hasAlt: boolean;
    hasEmptyAlt: boolean;
    ariaHidden: boolean;
    role: string;
  }>;
}

export interface SemanticFinding {
  kind: "heading-hierarchy" | "form-label" | "image-alt";
  path: string;
  message: string;
}

export const A11Y_SEMANTIC_SAMPLE_SCRIPT = `
(function semantic() {
  function shortPath(el) {
    const parts = [];
    let cur = el;
    while (cur && cur !== document.body && parts.length < 5) {
      let p = cur.tagName.toLowerCase();
      if (cur.id) p += "#" + cur.id;
      else if (cur.className && typeof cur.className === "string") {
        const cls = cur.className.trim().split(/\\s+/).slice(0, 2).join(".");
        if (cls) p += "." + cls;
      }
      parts.unshift(p);
      cur = cur.parentElement;
    }
    return parts.join(">");
  }
  // Headings
  const headings = [];
  for (const h of document.querySelectorAll("h1,h2,h3,h4,h5,h6")) {
    const cs = getComputedStyle(h);
    if (cs.visibility === "hidden" || cs.display === "none") continue;
    headings.push({
      level: parseInt(h.tagName.slice(1), 10),
      path: shortPath(h),
      text: (h.textContent || "").trim().slice(0, 60),
    });
  }
  // Form controls
  const formControls = [];
  for (const el of document.querySelectorAll("input:not([type='hidden']), select, textarea")) {
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none") continue;
    if (el.hasAttribute("disabled")) continue;
    const id = el.getAttribute("id") || "";
    const labelFor = id ? document.querySelector('label[for="' + id.replace(/"/g, '\\\\"') + '"]') : null;
    const wrappingLabel = el.closest("label");
    const hasAssociatedLabel = !!(labelFor || wrappingLabel);
    const ariaLabel = el.getAttribute("aria-label");
    const ariaLabelledby = el.getAttribute("aria-labelledby");
    let ariaLabelledbyTargetText = "";
    if (ariaLabelledby) {
      const target = document.getElementById(ariaLabelledby);
      if (target) ariaLabelledbyTargetText = (target.textContent || "").trim();
    }
    formControls.push({
      path: shortPath(el),
      tag: el.tagName.toLowerCase(),
      type: el.getAttribute("type") || "",
      hasAssociatedLabel,
      hasAriaLabel: !!ariaLabel && ariaLabel.trim().length > 0,
      hasAriaLabelledby: !!ariaLabelledby,
      ariaLabelledbyTargetText,
      placeholder: el.getAttribute("placeholder") || "",
    });
  }
  // Images
  const images = [];
  for (const img of document.querySelectorAll("img")) {
    const cs = getComputedStyle(img);
    if (cs.visibility === "hidden" || cs.display === "none") continue;
    const alt = img.getAttribute("alt");
    const ariaHidden = img.getAttribute("aria-hidden") === "true";
    images.push({
      path: shortPath(img),
      src: (img.getAttribute("src") || "").slice(0, 80),
      hasAlt: alt !== null,
      hasEmptyAlt: alt === "",
      ariaHidden,
      role: img.getAttribute("role") || "",
    });
  }
  return { headings, formControls, images };
})()
`;

export function analyzeA11ySemanticSamples(s: A11ySemanticRawSample): SemanticFinding[] {
  const out: SemanticFinding[] = [];

  // heading-hierarchy: at most one h1; no level skips beyond the
  // first heading. (A second h1 is a finding; a jump from h2 to h4
  // is a finding.)
  const h1s = s.headings.filter((h) => h.level === 1);
  if (h1s.length > 1) {
    for (const h of h1s.slice(1)) {
      out.push({
        kind: "heading-hierarchy",
        path: h.path,
        message: `Multiple <h1> on this page (${h1s.length} total). Only the first should be h1; demote the rest to h2.`,
      });
    }
  }
  let lastLevel = 0;
  for (const h of s.headings) {
    if (lastLevel > 0 && h.level > lastLevel + 1) {
      out.push({
        kind: "heading-hierarchy",
        path: h.path,
        message: `Heading level jumped from h${lastLevel} to h${h.level}, skipping h${lastLevel + 1}. Screen-reader users navigating by heading will lose context.`,
      });
    }
    lastLevel = h.level;
  }

  // form-label: a control must have a real associated label OR a
  // non-empty aria-label OR an aria-labelledby targeting non-empty
  // text. Placeholder is NOT an accessible name.
  for (const c of s.formControls) {
    if (c.type === "submit" || c.type === "reset" || c.type === "button") continue;
    if (c.hasAssociatedLabel) continue;
    if (c.hasAriaLabel) continue;
    if (c.hasAriaLabelledby && c.ariaLabelledbyTargetText.length > 0) continue;
    const hint = c.placeholder ? ` (placeholder "${c.placeholder}" is not an accessible name)` : "";
    out.push({
      kind: "form-label",
      path: c.path,
      message: `<${c.tag}${c.type ? ` type="${c.type}"` : ""}> has no associated <label>, aria-label, or non-empty aria-labelledby${hint}.`,
    });
  }

  // image-alt: every img needs an alt attribute (empty alt is fine —
  // decorative) OR aria-hidden="true" OR role="presentation"/"none".
  for (const img of s.images) {
    if (img.hasAlt) continue; // empty-alt also passes
    if (img.ariaHidden) continue;
    if (img.role === "presentation" || img.role === "none") continue;
    out.push({
      kind: "image-alt",
      path: img.path,
      message: `<img src="${img.src}"> has no alt attribute. Use alt="..." for content images, alt="" for decorative ones, or aria-hidden="true".`,
    });
  }

  return out;
}
