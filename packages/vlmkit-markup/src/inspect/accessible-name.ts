/**
 * One accessible-name approximation for the browser scripts that print a control's name.
 *
 * `check interactions` and `check grounding` each wrote their own, and neither read `<label>`:
 * a radio inside its label came out as its `value` (`[radio] "2p3m"`, `t1 radio "seiji"` for a
 * swatch labelled 青磁), a field named by `<label for>` as `[textbox] ""`, and a `<select>` as the
 * text of every option it holds (`'Select a day Monday Tuesday…'`). Three agents building three
 * demo sites reported it in one round (2026-09-23), each checking Chromium's own accessibility
 * tree, which named every one of those controls correctly.
 *
 * This is the accname computation's answer for the markup pages actually use, in its order —
 * `aria-labelledby`, `aria-label`, an image input's `alt`, the control's `<label>`s, a button
 * input's value, the element's own text (never for a control whose text IS its value), then
 * `title` and `placeholder` — not the full algorithm. It is spliced into a host script as source,
 * so it must hold no backtick and no `${` (`accessible-name.test.ts` asserts both). It defines
 * `accessibleName(el)`.
 */
export const ACCESSIBLE_NAME_JS = `
  const accessibleName = (el) => {
    // A block boundary inside a label becomes a space, which must not land before punctuation that
    // follows it ("3 meals a week , 6 servings").
    const squash = (s) => String(s || "").replace(/\\s+/g, " ").replace(/ ([,.;:!?、。）」])/g, "$1").trim();
    const hidden = (n) => {
      if (n.getAttribute && n.getAttribute("aria-hidden") === "true") return true;
      const s = getComputedStyle(n);
      return s.display === "none" || s.visibility === "hidden";
    };
    // A label's own words. An embedded control contributes nothing here: a wrapping label holds
    // its radio, and a select inside a label would otherwise add every option's text.
    const labelText = (label) => {
      let out = "";
      const walk = (node) => {
        if (node.nodeType === 3) { out += node.textContent; return; }
        if (node.nodeType !== 1 || hidden(node)) return;
        const tag = node.tagName;
        if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA" || tag === "BUTTON") return;
        for (const child of node.childNodes) walk(child);
        if (getComputedStyle(node).display !== "inline") out += " ";
      };
      for (const child of label.childNodes) walk(child);
      return out;
    };
    const ids = squash(el.getAttribute("aria-labelledby")).split(" ").filter(Boolean);
    if (ids.length) {
      const named = squash(ids.map((id) => {
        const n = document.getElementById(id);
        return n ? (n.innerText !== undefined ? n.innerText : n.textContent) : "";
      }).join(" "));
      if (named) return named;
    }
    const aria = squash(el.getAttribute("aria-label"));
    if (aria) return aria;
    const tag = el.tagName;
    const type = tag === "INPUT" ? (el.getAttribute("type") || "text").toLowerCase() : "";
    if (type === "image") {
      const alt = squash(el.getAttribute("alt"));
      if (alt) return alt;
    }
    if (el.labels && el.labels.length) {
      const named = squash([...el.labels].map(labelText).join(" "));
      if (named) return named;
    }
    if (type === "button" || type === "submit" || type === "reset") {
      const value = squash(el.value);
      if (value) return value;
      if (type !== "button") return type === "submit" ? "Submit" : "Reset";
    }
    // Name from content — but a field's text is its value, and a select's is its options.
    if (tag !== "INPUT" && tag !== "SELECT" && tag !== "TEXTAREA") {
      const own = squash(el.innerText !== undefined ? el.innerText : el.textContent);
      if (own) return own;
      const img = el.querySelector("img[alt], [role='img'][aria-label], svg[aria-label]");
      if (img) {
        const alt = squash(img.getAttribute("alt") || img.getAttribute("aria-label"));
        if (alt) return alt;
      }
    }
    return squash(el.getAttribute("title")) || squash(el.getAttribute("placeholder"));
  };
`;
