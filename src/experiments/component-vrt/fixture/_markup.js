/**
 * The component markup, shared by both hosts.
 *
 * One definition per component, used by page.html to build a page and by
 * gallery.html to mount a story. Sharing it is the same fairness argument as
 * sharing components.css: the two arms must render the same components, or the
 * experiment compares two different things.
 */
globalThis.COMPONENTS = {
  Button: (p = {}) => `<button class="c-button">${p.title ?? "Submit"}</button>`,
  Badge: (p = {}) => `<span class="c-badge">${p.label ?? "New"}</span>`,
  Avatar: (p = {}) => `<span class="c-avatar">${p.initials ?? "KM"}</span>`,
  Card: (p = {}) =>
    `<div class="c-card"><h3 class="c-card__title">${p.title ?? "Card title"}</h3>`
    + `<p class="c-card__body">${p.body ?? "Supporting copy that wraps onto a second line."}</p></div>`,
  Alert: (p = {}) =>
    `<div class="c-alert">${p.text ?? "Your trial ends in three days. Add a payment method to keep access."}</div>`,
  Toolbar: () =>
    `<div class="c-toolbar">${globalThis.COMPONENTS.Avatar({})}`
    + `${globalThis.COMPONENTS.Badge({ label: "Pro" })}`
    + `${globalThis.COMPONENTS.Button({ title: "Share" })}</div>`,
  Hero: (p = {}) =>
    `<div class="c-hero"><h1 class="c-hero__title">${p.title ?? "Ship the interface you designed"}</h1>`
    + `<p class="c-hero__sub">${p.sub ?? "Deterministic checks for the parts a screenshot cannot tell you."}</p></div>`,
  DataTable: (p = {}) => {
    const rows = (p.rows ?? 6);
    const body = Array.from({ length: rows }, (_, i) =>
      `<tr><td>row-${i + 1}</td><td>${(i * 37) % 100}</td><td>${i % 2 ? "active" : "idle"}</td></tr>`).join("");
    return `<table class="c-table"><thead><tr><th>Name</th><th>Score</th><th>State</th></tr></thead>`
      + `<tbody>${body}</tbody></table>`;
  },
};
