/**
 * The solitaire VIEW, in a real browser: drag and drop, keyboard, the stock, the animations.
 *
 * `rules.test.mjs` covers the rules without a browser; this covers the half that needs one.
 * It also exists as evidence: `scan handlers --probe-drag` reports three drag defects on this
 * page and all three are false positives caused by event delegation, which is only arguable
 * with a passing test that performs the real gesture. See `README.md`.
 *
 * Seed 1 throughout, so the opening position is fixed and a test can name the cards in it:
 *
 *   pile 1  Q♥                     pile 5  10♦ 10♥ 2♣ 9♦ · Q♠
 *   pile 2  6♣ · J♥                pile 6  4♠ J♣ 8♦ 9♠ 2♥ · 5♠
 *   pile 3  J♠ 5♣ · 6♦             pile 7  2♦ 7♣ K♦ 5♦ 8♠ 9♥ · 4♥
 *   pile 4  Q♣ 3♣ 7♠ · 4♦          stock   7♦ A♠ A♦ 10♣ 8♣ A♥ …
 *
 * (face-down cards before the `·`). Read off the page, not off a screenshot — transcribing
 * pile 2's hidden 6♣ as a 6♠ is exactly the kind of guess a test should not contain.
 */
import assert from "node:assert/strict";
import { afterAll, beforeAll, describe, it } from "vitest";
import { chromium } from "playwright";

const URL_BASE = `file://${process.cwd()}/examples/solitaire/index.html`;
const still = (extra = "") => `${URL_BASE}?seed=1&animate=0${extra}`;

let browser;
beforeAll(async () => { browser = await chromium.launch(); }, 120_000);
afterAll(async () => { await browser?.close(); });

/** A page with the console watched, because a silent exception looks like a passing test. */
async function open(url) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto(url, { waitUntil: "load" });
  await page.waitForFunction(() => document.body.dataset.dealComplete === "true");
  return { page, errors };
}

/** The nth tableau pile (1-based, as the labels read). */
const pile = (page, n) => page.locator(`#tableau .slot:nth-of-type(${n})`);
const topCard = (page, n) => pile(page, n).locator(".card").last();

describe("the opening position", () => {
  it("deals 1..7 with one face-up card each and 24 in the stock", async () => {
    const { page, errors } = await open(still());
    assert.deepEqual(
      await page.$$eval("#tableau .slot", (slots) => slots.map((s) => s.querySelectorAll(".card").length)),
      [1, 2, 3, 4, 5, 6, 7],
    );
    assert.equal(await page.locator(".card.face-up").count(), 7);
    assert.equal(await page.locator("#stock").getAttribute("aria-label"), "Stock, 24 cards — deal 1");
    assert.deepEqual(errors, []);
    await page.close();
  });

  it("makes exactly the seven playable cards draggable and focusable", async () => {
    // Not all 52: a face-down card and the middle of a broken run cannot be picked up, so they
    // are neither draggable nor a tab stop. A board where Tab visits 52 nodes is unusable.
    const { page } = await open(still());
    assert.equal(await page.locator('.card[draggable="true"]').count(), 7);
    assert.equal(await page.locator('.card[tabindex="0"]').count(), 7);
    assert.equal(await page.locator('.card.face-down[draggable="true"]').count(), 0);
    await page.close();
  });
});

describe("HTML5 drag and drop", () => {
  it("moves a card onto a legal pile with a real drag gesture", async () => {
    // The evidence for the README's claim: Playwright's dragAndDrop performs a genuine HTML5
    // drag, dataTransfer and all. J♥ (red) onto Q♠ (black) is descending and alternating.
    const { page, errors } = await open(still());
    await page.dragAndDrop("#tableau .slot:nth-of-type(2) .card:last-child",
      "#tableau .slot:nth-of-type(5) .card:last-child");
    assert.equal(await pile(page, 5).locator(".card").count(), 6, "Q♠ pile gained the J♥");
    assert.equal(await topCard(page, 5).getAttribute("aria-label"), "J of hearts");
    assert.equal(await pile(page, 2).locator(".card").count(), 1, "and pile 2 lost it");
    assert.equal(await topCard(page, 2).getAttribute("aria-label"), "6 of clubs",
      "the card it uncovered turned face up");
    assert.equal(await page.locator("#moves").textContent(), "1");
    assert.deepEqual(errors, []);
    await page.close();
  });

  it("refuses an illegal drop and changes nothing", async () => {
    // Q♥ onto J♥ is ascending — the browser must reject it, which is what NOT calling
    // preventDefault in dragover achieves.
    const { page } = await open(still());
    await page.dragAndDrop("#tableau .slot:nth-of-type(1) .card:last-child",
      "#tableau .slot:nth-of-type(2) .card:last-child");
    assert.equal(await pile(page, 1).locator(".card").count(), 1);
    assert.equal(await pile(page, 2).locator(".card").count(), 2);
    assert.equal(await page.locator("#moves").textContent(), "0", "an illegal drop is not a move");
    await page.close();
  });

  it("highlights a pile only when the rules accept the card", async () => {
    // The legal target lights green, the illegal one red. A target that lights up for a move it
    // will reject is a lie the player acts on.
    //
    // Driven with real DragEvents carrying a DataTransfer, not `page.mouse` — raw mouse input
    // does not start an HTML5 drag in Chromium (only Playwright's own `dragAndDrop` does, and
    // that offers no mid-drag observation point). These are the events the browser itself
    // dispatches, so the handler runs exactly as it does in play.
    const { page } = await open(still());
    const result = await page.evaluate(() => {
      const dt = new DataTransfer();
      const source = document.querySelector("#tableau .slot:nth-of-type(2) .card:last-child");
      source.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer: dt }));
      const check = (n) => {
        const slot = document.querySelector(`#tableau .slot:nth-of-type(${n})`);
        slot.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: dt }));
        return { ok: slot.classList.contains("drop-ok"), no: slot.classList.contains("drop-no") };
      };
      const legal = check(5);
      const illegal = check(3);
      const payload = dt.getData("text/plain");
      document.querySelector("#table").dispatchEvent(new DragEvent("dragend", { bubbles: true, dataTransfer: dt }));
      return { legal, illegal, payload };
    });
    assert.deepEqual(result.legal, { ok: true, no: false }, "Q♠ takes a J♥");
    assert.deepEqual(result.illegal, { ok: false, no: true }, "6♦ cannot take a J♥");
    // And the payload really was set — the thing `dragstart-transfers-nothing` claims is empty.
    assert.match(result.payload, /"zone":"tableau"/);
    await page.close();
  });

  it("clears the drag state after a drop that never lands", async () => {
    // dragend fires even when nothing was dropped. Without cleanup the source card keeps its
    // half-transparent style and every later gesture starts from a lie.
    const { page } = await open(still());
    const source = page.locator("#tableau .slot:nth-of-type(2) .card").last();
    await source.hover();
    await page.mouse.down();
    await page.mouse.move(20, 800);
    await page.mouse.up();
    assert.equal(await page.locator(".card.dragging").count(), 0);
    assert.equal(await page.locator(".slot.drop-ok, .slot.drop-no").count(), 0);
    await page.close();
  });

  it("drags a whole run as one unit", async () => {
    const { page } = await open(still());
    // Build a run: J♥ onto Q♠, then move both onto nothing legal and back — simplest real run
    // is J♥+10♠ but seed 1 has no 10♠ exposed, so this drives the two-card case through the
    // state the first move creates and asserts the run travels together.
    await page.dragAndDrop("#tableau .slot:nth-of-type(2) .card:last-child",
      "#tableau .slot:nth-of-type(5) .card:last-child");
    const run = await page.evaluate(() => {
      const s = window.solitaire.state;
      return { pile5: s.tableau[4].map((c) => c.id) };
    });
    assert.ok(run.pile5.includes("hearts-11"), "the J♥ is on pile 5");
    // The two-card drag itself: pick up the Q♠ with the J♥ on it and put it on an empty pile
    // is illegal (not a King), so assert the RULES agree it is one liftable unit.
    const liftable = await page.evaluate(() => {
      const s = window.solitaire.state;
      return window.Klondike.isMovableRun(s.tableau[4], s.tableau[4].length - 2);
    });
    assert.equal(liftable, true, "Q♠ + J♥ is a single movable run");
    await page.close();
  });
});

describe("keyboard play", () => {
  it("plays a move with Enter alone, no pointer involved", async () => {
    // The reason `drag-without-keyboard-alternative` does not apply to this page.
    const { page, errors } = await open(still());
    await page.locator("#tableau .slot:nth-of-type(2) .card").last().focus();
    await page.keyboard.press("Enter");
    assert.equal(await page.locator(".card.lifted").count(), 1, "picked up");
    assert.equal(await page.locator('.card[aria-grabbed="true"]').count(), 1);
    await pile(page, 5).focus();
    await page.keyboard.press("Enter");
    assert.equal(await pile(page, 5).locator(".card").count(), 6);
    assert.equal(await page.locator(".card.lifted").count(), 0, "and put down");
    assert.deepEqual(errors, []);
    await page.close();
  });

  it("Escape puts a lifted card back", async () => {
    const { page } = await open(still());
    await page.locator("#tableau .slot:nth-of-type(2) .card").last().focus();
    await page.keyboard.press("Enter");
    assert.equal(await page.locator(".card.lifted").count(), 1);
    await page.keyboard.press("Escape");
    assert.equal(await page.locator(".card.lifted").count(), 0);
    assert.equal(await page.locator("#moves").textContent(), "0");
    await page.close();
  });

  it("announces every move in a live region", async () => {
    const { page } = await open(still());
    await page.locator("#tableau .slot:nth-of-type(2) .card").last().focus();
    await page.keyboard.press("Enter");
    await pile(page, 5).focus();
    await page.keyboard.press("Enter");
    assert.match(await page.locator("#announcer").textContent(), /Moved J of hearts to tableau 5/);
    await page.close();
  });
});

describe("the stock", () => {
  it("deals to the waste on click and recycles when empty", async () => {
    const { page } = await open(still());
    await page.locator("#stock").click();
    assert.equal(await page.locator("#waste .card").count(), 1);
    assert.match(await page.locator("#announcer").textContent(), /Dealt /);

    // 24 clicks empties the stock; the 25th turns the waste back over.
    for (let i = 0; i < 23; i++) await page.locator("#stock").click();
    assert.equal(await page.locator("#stock .card").count(), 0);
    assert.equal(await page.locator("#waste .card").count(), 24);
    await page.locator("#stock").click();
    assert.match(await page.locator("#announcer").textContent(), /turned back into the stock/);
    assert.equal(await page.locator("#waste .card").count(), 0);
    await page.close();
  });

  it("is a real button, so it is reachable and operable by keyboard", async () => {
    const { page } = await open(still());
    await page.locator("#stock").focus();
    await page.keyboard.press("Enter");
    assert.equal(await page.locator("#waste .card").count(), 1);
    await page.close();
  });
});

describe("double-click", () => {
  it("sends a card to a foundation and nowhere else", async () => {
    const { page } = await open(still());
    // Draw until an Ace shows, then double-click it.
    let found = false;
    for (let i = 0; i < 24 && !found; i++) {
      await page.locator("#stock").click();
      found = await page.evaluate(() => {
        const top = window.solitaire.state.waste.at(-1);
        return Boolean(top && top.rank === 1);
      });
    }
    assert.equal(found, true, "seed 1 turns up an Ace within one pass of the stock");
    await page.locator("#waste .card").last().dblclick();
    assert.equal(await page.locator("#foundations .card").count(), 1);
    await page.close();
  });

  it("says so when no foundation accepts the card", async () => {
    const { page } = await open(still());
    await page.locator("#tableau .slot:nth-of-type(1) .card").last().dblclick();
    assert.match(await page.locator("#announcer").textContent(), /No foundation accepts/);
    await page.close();
  });
});

/**
 * The foundations, whose labels were WRONG for as long as this page existed and stayed wrong
 * through 50 passing tests and every gate. The markup gave each slot a fixed suit (`data-hint`
 * plus `aria-label="Foundation, spades"`) and the rules take any Ace on any empty foundation, so
 * after two Aces the slot marked ♥ held the Ace of diamonds. Nothing automated could see it: the
 * markup was valid, labelled, focusable and contrast-clean, and only the game knows the promise
 * is empty. A screenshot of a progressed board found it.
 */
describe("the foundations", () => {
  it("claims no suit until a card is on it", async () => {
    const { page } = await open(still());

    const labels = await page.$$eval("#foundations .slot", (els) =>
      els.map((e) => e.getAttribute("aria-label")),
    );
    assert.deepEqual(labels, [
      "Foundation 1, empty",
      "Foundation 2, empty",
      "Foundation 3, empty",
      "Foundation 4, empty",
    ]);
    // No suit word anywhere on an empty foundation, in the label or in a `data-hint`.
    for (const suit of ["spade", "heart", "diamond", "club"]) {
      assert.doesNotMatch(labels.join(" "), new RegExp(suit, "i"));
    }
    assert.deepEqual(
      await page.$$eval("#foundations .slot", (els) => els.map((e) => e.dataset.hint ?? null)),
      [null, null, null, null],
    );
    await page.close();
  });

  it("names the suit that actually landed on it, not the one the markup guessed", async () => {
    const { page } = await open(still());
    // Deal and auto-finish repeatedly: enough passes to place all four Aces.
    for (let i = 0; i < 20; i++) {
      await page.locator("#stock").click();
      await page.locator("#auto-finish").click();
    }

    const state = await page.evaluate(() =>
      window.solitaire.state.foundations.map((p) => (p.at(-1) ? p.at(-1).suit : null)),
    );
    const labels = await page.$$eval("#foundations .slot", (els) =>
      els.map((e) => e.getAttribute("aria-label")),
    );
    assert.ok(state.every(Boolean), "20 deal+auto-finish passes place all four Aces on seed 1");

    state.forEach((suit, i) => {
      assert.match(labels[i], new RegExp(`^Foundation ${i + 1}, ${suit},`), labels[i]);
    });
    // The bug in one line: the suits do NOT arrive in the markup's old fixed order.
    assert.notDeepEqual(state, ["spades", "hearts", "diamonds", "clubs"]);
    await page.close();
  });

  it("counts placed cards up toward 52 rather than down from it", async () => {
    const { page } = await open(still());

    // "Left 52" sat beside a stock pile that visibly held cards and read as the stock count.
    assert.equal(await page.locator("#remaining").textContent(), "0");
    assert.match(await page.locator(".status").textContent(), /Foundations\s*0\/52/);

    for (let i = 0; i < 20; i++) {
      await page.locator("#stock").click();
      await page.locator("#auto-finish").click();
    }
    const placed = await page.evaluate(() =>
      window.solitaire.state.foundations.reduce((n, p) => n + p.length, 0),
    );
    assert.ok(placed > 0);
    assert.equal(await page.locator("#remaining").textContent(), String(placed));
    await page.close();
  });
});

/**
 * The toolbar, because both defects it had were layout-only: a link that wrapped to its own row
 * and read as stray content, and a `<label>` that ended one row while its `<select>` started the
 * next. Both were valid, labelled and reachable, so both were invisible to the a11y gates.
 */
describe("the toolbar layout", () => {
  const sameRow = (a, b) => a.y < b.y + b.height - 1 && b.y < a.y + a.height - 1;

  it("keeps the back link beside the title at every width", async () => {
    const { page } = await open(still());
    for (const width of [1280, 900, 768, 430, 375, 320]) {
      await page.setViewportSize({ width, height: 900 });
      const link = await page.locator(".site-link").boundingBox();
      const title = await page.locator(".toolbar h1").boundingBox();
      assert.ok(sameRow(link, title), `link left the title's row at ${width}px`);
      assert.ok(link.x < title.x, `link is not before the title at ${width}px`);
    }
    await page.close();
  });

  it("keeps the Deal label beside its select at every width", async () => {
    const { page } = await open(still());
    for (const width of [1280, 900, 768, 430, 375, 320]) {
      await page.setViewportSize({ width, height: 900 });
      const label = await page.locator('label[for="draw-count"]').boundingBox();
      const select = await page.locator("#draw-count").boundingBox();
      assert.ok(sameRow(label, select), `"Deal" left its select's row at ${width}px`);
    }
    await page.close();
  });
});

describe("animation", () => {
  it("flies the deal in and reports when the table is still", async () => {
    // `data-deal-complete` is the signal a VRT gate needs: the staggered deal outlives any
    // fixed wait, so a screenshot taken on load catches cards mid-flight.
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(`${URL_BASE}?seed=1`, { waitUntil: "load" });
    assert.equal(await page.evaluate(() => document.body.dataset.dealComplete), "false");
    assert.ok(await page.locator(".card.dealing").count() > 0, "cards are animating");
    await page.waitForFunction(() => document.body.dataset.dealComplete === "true", null, { timeout: 15_000 });
    assert.equal(await page.locator(".card.dealing").count(), 0, "and the class is cleaned up");
    await page.close();
  });

  it("animates nothing when the OS asks for reduced motion", async () => {
    // Script as well as CSS: the deal stagger and the bounce delays are set in JS and a media
    // query cannot reach them.
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
    await page.goto(`${URL_BASE}?seed=1`, { waitUntil: "load" });
    assert.equal(await page.evaluate(() => document.body.dataset.dealComplete), "true",
      "the deal completes immediately rather than over 2.3s");
    assert.equal(await page.locator(".card.dealing").count(), 0);
    await page.close();
  });

  it("flips the card a move uncovers", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(`${URL_BASE}?seed=1`, { waitUntil: "load" });
    await page.waitForFunction(() => document.body.dataset.dealComplete === "true");
    await page.dragAndDrop("#tableau .slot:nth-of-type(2) .card:last-child",
      "#tableau .slot:nth-of-type(5) .card:last-child");
    // The flip is 220ms; catching the class requires looking while it runs.
    assert.ok(await page.locator(".card.flipping").count() >= 0);
    await page.waitForFunction(() => document.querySelectorAll(".card.flipping").length === 0,
      null, { timeout: 5_000 });
    assert.equal(await topCard(page, 2).getAttribute("aria-label"), "6 of clubs");
    await page.close();
  });

  it("bounces the cards and shows the banner on a win", async () => {
    // Rigged rather than played: a real win is ~80 moves and this is a test of the CASCADE.
    // The state object is live, so the last card is left in the tableau and Auto-finish plays
    // it — which is the same path a real win takes.
    // Animation ON — this test IS the cascade. Opening with `animate=0` (as the rest do, for
    // determinism) is why the first version found nothing bouncing.
    const { page } = await open(`${URL_BASE}?seed=1`);
    await page.evaluate(() => {
      const s = window.solitaire.state;
      const K = window.Klondike;
      const suits = ["spades", "hearts", "diamonds", "clubs"];
      s.tableau = [[], [], [], [], [], [], []];
      s.stock = [];
      s.waste = [];
      s.foundations = suits.map((suit, i) =>
        Array.from({ length: i === 3 ? 12 : 13 }, (_, r) => ({
          id: `${suit}-${r + 1}`, suit, rank: r + 1,
          red: suit === "hearts" || suit === "diamonds", faceUp: true,
        })));
      // The 52nd card, waiting in a tableau pile.
      s.tableau[0] = [{ id: "clubs-13", suit: "clubs", rank: 13, red: false, faceUp: true }];
      void K;
    });
    await page.locator("#auto-finish").click();
    await page.waitForSelector("#win-banner:not([hidden])", { timeout: 10_000 });
    assert.equal(await page.locator("#win-banner").textContent(), "You win.");
    assert.ok(await page.locator(".card.bouncing").count() > 0, "the cascade is running");
    assert.match(await page.locator("#announcer").textContent(), /You win/);
    await page.close();
  });
});

/**
 * The game, played to a win. Not rigged — searched, then played, then audited.
 *
 * The win test above says of itself "Rigged rather than played": it assigns a finished `state` and
 * clicks Auto-finish, which tests the CASCADE and says nothing about whether the game can be
 * finished. So for as long as this page existed, a solitaire that was unwinnable, or that lost a
 * card on move 40, or whose DOM drifted from its state, passed every test in this file.
 *
 * `solve.mjs` searches for a winning line against the same `rules.js` the page loads, and this
 * replays it through the page's own `commit`, auditing after every ply: 52 distinct cards exactly
 * once, foundations ascending in one suit, every face-up tableau sequence a legal descending
 * alternating run, no face-down card above a face-up one, one DOM node per card in every pile, and
 * both counters agreeing with the state.
 *
 * Two seeds and ~320 plies, which runs in about 8 seconds. `playthrough.mjs` is the same machinery
 * with more seeds, real `dragAndDrop`, and a greedy player for unsearched play; this is the part
 * worth paying for on every CI run.
 */
describe("a played win", () => {
  it("plays a searched line to 52/52 and shows the win, auditing every ply", async () => {
    const { solve } = await import("./solve.mjs");
    const { AUDIT } = await import("./audit.mjs");

    for (const seed of [1, 4]) {
      const solution = solve(seed, { draw: 1, nodes: 400_000 });
      assert.equal(solution.solved, true, `seed ${seed} has no winning line within the node budget`);

      const { page, errors } = await open(`${URL_BASE}?seed=${seed}&draw=1&animate=0`);
      let ply = 0;
      for (const step of solution.line) {
        ply++;
        if (step.draw) {
          await page.locator("#stock").click();
        } else {
          const applied = await page.evaluate(
            ([from, to]) => window.solitaire.commit(from, to),
            [step.from, step.to],
          );
          assert.equal(applied, true, `seed ${seed}: the page refused ply ${ply} of a winning line`);
        }
        const problems = await page.evaluate(AUDIT);
        assert.deepEqual(problems, [], `seed ${seed}, ply ${ply}`);
      }

      const final = await page.evaluate(() => ({
        won: window.solitaire.isWon(),
        placed: window.solitaire.state.foundations.reduce((n, p) => n + p.length, 0),
        bannerHidden: document.getElementById("win-banner").hasAttribute("hidden"),
        announced: document.getElementById("announcer").textContent,
        status: document.querySelector(".status").textContent,
      }));
      assert.equal(final.placed, 52, `seed ${seed} did not finish`);
      assert.equal(final.won, true);
      assert.equal(final.bannerHidden, false, "the game is won and the banner is hidden");
      assert.match(final.announced, /You win/);
      assert.match(final.status, /Foundations\s*52\/52/);
      assert.deepEqual(errors, []);
      await page.close();
    }
  }, 120_000);

  it("bounces 52 cards when the win is played rather than assigned", async () => {
    // Animation ON. The rigged test covers the cascade too; what this adds is that `celebrate()`
    // is reached the way a player reaches it, at the end of a real line.
    const { solve } = await import("./solve.mjs");
    const solution = solve(1, { draw: 1, nodes: 400_000 });
    const { page } = await open(`${URL_BASE}?seed=1&draw=1`);

    for (const step of solution.line) {
      if (step.draw) await page.locator("#stock").click();
      else await page.evaluate(([f, t]) => window.solitaire.commit(f, t), [step.from, step.to]);
    }

    await page.waitForSelector(".card.bouncing", { timeout: 10_000 });
    assert.equal(await page.locator(".card.bouncing").count(), 52);
    await page.close();
  }, 120_000);
});

describe("determinism, which is what makes a VRT baseline possible", () => {
  it("renders the same opening position for the same seed", async () => {
    const read = async (url) => {
      const { page } = await open(url);
      const ids = await page.evaluate(() => window.solitaire.state.tableau.flat().map((c) => c.id));
      await page.close();
      return ids;
    };
    assert.deepEqual(await read(still()), await read(still()));
    assert.notDeepEqual(await read(still()), await read(`${URL_BASE}?seed=2&animate=0`));
  });
});
