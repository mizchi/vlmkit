import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { chromium } from "playwright";
import { ACCESSIBLE_NAME_JS } from "./accessible-name.ts";

describe("ACCESSIBLE_NAME_JS", () => {
  it("interpolates into a template literal without escaping", () => {
    assert.equal(ACCESSIBLE_NAME_JS.includes("`"), false, "no backticks");
    assert.equal(ACCESSIBLE_NAME_JS.includes("${"), false, "no interpolation");
    assert.match(ACCESSIBLE_NAME_JS, /replace\(\/\\s\+\/g/, "the whitespace regex survives the host literal");
  });

  /**
   * The controls the demo-site agents found misnamed, each next to the name Chromium's own
   * accessibility tree gives it — the answer this fragment has to agree with.
   */
  it("names controls the way the browser's accessibility tree does", async () => {
    const page = `<!doctype html><meta charset="utf-8"><title>t</title>
      <label><input type="radio" name="plan" id="plan" value="2p3m"> 2 people · 3 meals a week <span>$59.94</span></label>
      <label for="email">Email</label><input id="email" type="email" value="a@b.c" placeholder="you@example.com">
      <label for="day">Delivery day</label><select id="day"><option>Select a day</option><option>Monday</option></select>
      <label>Notes <textarea id="notes">typed text</textarea></label>
      <label><input type="radio" name="glaze" id="glaze" value="seiji"><span>青</span><span>磁</span></label>
      <input id="bare" type="text" placeholder="Search">
      <input id="send" type="submit" value="Send order">
      <input id="submit" type="submit">
      <button id="icon" aria-label="Close"><svg width="10" height="10"></svg></button>
      <span id="lbl">Card number</span><input id="card" aria-labelledby="lbl">
      <button id="copy">Copy <span style="display:none">hidden</span></button>
      <a id="logo" href="#"><img src="data:," alt="Pantry Club home"></a>
      <button id="titled" title="More options"></button>`;
    const browser = await chromium.launch();
    try {
      const tab = await browser.newPage();
      await tab.setContent(page);
      const ids = ["plan", "email", "day", "notes", "glaze", "bare", "send", "submit", "icon", "card", "copy", "logo", "titled"];
      const ours = await tab.evaluate(`(() => {
        ${ACCESSIBLE_NAME_JS}
        return Object.fromEntries(${JSON.stringify(ids)}.map((id) => [id, accessibleName(document.getElementById(id))]));
      })()`) as Record<string, string>;

      assert.deepEqual(ours, {
        plan: "2 people · 3 meals a week $59.94",
        email: "Email",
        day: "Delivery day",
        notes: "Notes",
        glaze: "青磁",
        bare: "Search",
        send: "Send order",
        submit: "Submit",
        icon: "Close",
        card: "Card number",
        copy: "Copy",
        logo: "Pantry Club home",
        titled: "More options",
      });

      // Hold the fragment to the browser's own computation where the two can be compared.
      const snapshot = await tab.locator("body").ariaSnapshot();
      for (const name of ["Email", "Delivery day", "Card number", "Send order", "Close", "Pantry Club home"]) {
        assert.ok(snapshot.includes(`"${name}"`), `Chromium also names a control "${name}"\n${snapshot}`);
      }
    } finally {
      await browser.close();
    }
  }, 60_000);
});
