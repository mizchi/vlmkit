/**
 * The Klondike rules, checked without a browser.
 *
 * Every case here is a rule a home-made solitaire commonly gets wrong, and each one is
 * invisible from a screenshot: an empty tableau that accepts any card, a recycle that
 * reshuffles, a run that lifts across a colour break. The DnD and animation work in
 * `game.js` is what the browser is needed for; this is not.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInThisContext } from "node:vm";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "vitest";

/**
 * Loaded the way the BROWSER loads it: source read, evaluated as a classic script.
 *
 * Not `import` and not `require`. This repo is `"type": "module"`, so `rules.js` is ESM to
 * Node — an earlier UMD wrapper here exported nothing at all and every test in this file
 * failed with "newGame is not a function" while the page itself was fine. Evaluating it as a
 * script matches the `<script src="rules.js">` the page uses, so this also fails if the file
 * ever gains syntax that only Node would accept.
 *
 * `runInThisContext`, not a fresh `vm` context: a new context is a new realm, so objects the
 * rules build there have a different `Object.prototype` and `assert.deepEqual` rejects them as
 * "same structure but not reference-equal" — six tests failed on the harness rather than on
 * the rules. Same realm also matches the browser, where the script shares the page's globals.
 */
const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "rules.js"), "utf8");
runInThisContext(source, { filename: "rules.js" });
const K = globalThis.Klondike;

describe("loading", () => {
  it("assigns globalThis.Klondike when evaluated as a classic script", () => {
    // Guards the harness above: without this, a load failure shows up as 28 confusing
    // "not a function" errors instead of one clear one.
    assert.equal(typeof K, "object");
    assert.equal(typeof K.newGame, "function");
  });
});

/** A card by suit and rank, face up unless told otherwise. */
const card = (suit, rank, faceUp = true) => ({
  id: `${suit}-${rank}`,
  suit,
  rank,
  red: suit === "hearts" || suit === "diamonds",
  faceUp,
});

/** A bare state, so each test states only the piles it is about. */
function state(overrides = {}) {
  return Object.assign(
    {
      seed: 1,
      drawCount: 1,
      tableau: [[], [], [], [], [], [], []],
      foundations: [[], [], [], []],
      stock: [],
      waste: [],
      moves: 0,
    },
    overrides,
  );
}

describe("the deal", () => {
  it("puts 28 cards in the tableau as 1..7, one face up per pile", () => {
    const s = K.newGame(1);
    assert.deepEqual(s.tableau.map((p) => p.length), [1, 2, 3, 4, 5, 6, 7]);
    for (const pile of s.tableau) {
      assert.equal(pile.filter((c) => c.faceUp).length, 1, "exactly one face-up card");
      assert.equal(pile[pile.length - 1].faceUp, true, "and it is the last one");
    }
    assert.equal(s.stock.length, 24, "52 - 28");
    assert.equal(s.stock.every((c) => !c.faceUp), true);
  });

  it("uses all 52 cards exactly once", () => {
    // The check that catches an off-by-one in the deal loop, which otherwise shows up as a
    // game that cannot be won for reasons nobody can see.
    const s = K.newGame(7);
    const ids = [...s.tableau.flat(), ...s.stock].map((c) => c.id);
    assert.equal(ids.length, 52);
    assert.equal(new Set(ids).size, 52);
  });

  it("is a function of the seed, which is what makes a screenshot reproducible", () => {
    const a = K.newGame(42).tableau.flat().map((c) => c.id);
    const b = K.newGame(42).tableau.flat().map((c) => c.id);
    const c = K.newGame(43).tableau.flat().map((c) => c.id);
    assert.deepEqual(a, b, "same seed, same deal");
    assert.notDeepEqual(a, c, "different seed, different deal");
  });

  it("defaults to draw-one and accepts draw-three, ignoring anything else", () => {
    assert.equal(K.newGame(1).drawCount, 1);
    assert.equal(K.newGame(1, 3).drawCount, 3);
    assert.equal(K.newGame(1, 5).drawCount, 1, "an unknown count falls back rather than dealing 5");
  });
});

describe("tableau stacking", () => {
  it("takes a descending card of the opposite colour", () => {
    assert.equal(K.canStackOnTableau(card("hearts", 9), [card("spades", 10)]), true);
    assert.equal(K.canStackOnTableau(card("diamonds", 9), [card("clubs", 10)]), true);
  });

  it("refuses the same colour, the wrong rank, and a face-down top", () => {
    assert.equal(K.canStackOnTableau(card("hearts", 9), [card("diamonds", 10)]), false, "same colour");
    assert.equal(K.canStackOnTableau(card("hearts", 8), [card("spades", 10)]), false, "gap");
    assert.equal(K.canStackOnTableau(card("hearts", 11), [card("spades", 10)]), false, "ascending");
    assert.equal(K.canStackOnTableau(card("hearts", 9), [card("spades", 10, false)]), false, "face down");
  });

  it("takes ONLY a King on an empty pile", () => {
    // The clause casual implementations drop. Without it, an empty column is free parking and
    // the hardest part of the game disappears.
    assert.equal(K.canStackOnTableau(card("spades", 13), []), true);
    assert.equal(K.canStackOnTableau(card("spades", 12), []), false);
    assert.equal(K.canStackOnTableau(card("hearts", 1), []), false);
  });
});

describe("foundations", () => {
  it("start at the Ace and build up in suit", () => {
    assert.equal(K.canPlaceOnFoundation(card("spades", 1), []), true);
    assert.equal(K.canPlaceOnFoundation(card("spades", 2), [card("spades", 1)]), true);
  });

  it("refuse a non-Ace opener, a rank skip, and a foreign suit", () => {
    assert.equal(K.canPlaceOnFoundation(card("spades", 2), []), false);
    assert.equal(K.canPlaceOnFoundation(card("spades", 3), [card("spades", 1)]), false);
    assert.equal(K.canPlaceOnFoundation(card("hearts", 2), [card("spades", 1)]), false);
  });
});

describe("movable runs", () => {
  it("lifts a descending alternating sequence as one unit", () => {
    const pile = [card("spades", 10), card("hearts", 9), card("clubs", 8)];
    assert.equal(K.isMovableRun(pile, 0), true);
    assert.equal(K.isMovableRun(pile, 1), true);
  });

  it("refuses a run broken by colour or rank", () => {
    assert.equal(K.isMovableRun([card("spades", 10), card("clubs", 9)], 0), false, "same colour");
    assert.equal(K.isMovableRun([card("spades", 10), card("hearts", 8)], 0), false, "rank gap");
  });

  it("refuses a run containing a face-down card", () => {
    const pile = [card("spades", 10, false), card("hearts", 9)];
    assert.equal(K.isMovableRun(pile, 0), false);
    assert.equal(K.isMovableRun(pile, 1), true, "but the face-up tail alone is fine");
  });
});

describe("applyMove", () => {
  it("moves a run and flips the card it uncovers", () => {
    const s = state({
      tableau: [
        [card("diamonds", 5, false), card("spades", 10), card("hearts", 9)],
        [card("hearts", 11)],
        [], [], [], [], [],
      ],
    });
    const result = K.applyMove(s, { zone: "tableau", index: 0, cardIndex: 1 }, { zone: "tableau", index: 1 });
    assert.ok(result);
    assert.deepEqual(result.moved.map((c) => c.id), ["spades-10", "hearts-9"]);
    assert.equal(result.revealed.id, "diamonds-5", "the uncovered card turns over");
    assert.equal(s.tableau[0].length, 1);
    assert.equal(s.tableau[0][0].faceUp, true);
    assert.equal(s.tableau[1].length, 3);
    assert.equal(s.moves, 1);
  });

  it("reports no reveal when the uncovered card was already face up", () => {
    const s = state({
      tableau: [[card("spades", 10), card("hearts", 9)], [card("clubs", 10)], [], [], [], [], []],
    });
    const result = K.applyMove(s, { zone: "tableau", index: 0, cardIndex: 1 }, { zone: "tableau", index: 1 });
    assert.equal(result.revealed, null);
  });

  it("returns null for an illegal move and leaves the state untouched", () => {
    // An illegal drop is an ordinary outcome — the user let go over the wrong pile — so it is
    // a null, not a throw. What matters is that nothing moved.
    const s = state({ tableau: [[card("hearts", 9)], [card("diamonds", 10)], [], [], [], [], []] });
    const before = JSON.stringify(s);
    assert.equal(K.applyMove(s, { zone: "tableau", index: 0, cardIndex: 0 }, { zone: "tableau", index: 1 }), null);
    assert.equal(JSON.stringify(s), before);
  });

  it("sends only one card to a foundation, even when a legal run sits on it", () => {
    const s = state({
      tableau: [[card("spades", 1), card("hearts", 13)], [], [], [], [], [], []],
      foundations: [[], [], [], []],
    });
    // The Ace is at index 0 with a King on top: as a tableau run that is not liftable, and a
    // foundation takes one card regardless.
    assert.equal(K.applyMove(s, { zone: "tableau", index: 0, cardIndex: 0 }, { zone: "foundation", index: 0 }), null);
  });

  it("moves from the waste, one card at a time", () => {
    const s = state({ waste: [card("clubs", 3), card("spades", 1)] });
    const result = K.applyMove(s, { zone: "waste", index: 0 }, { zone: "foundation", index: 0 });
    assert.ok(result);
    assert.deepEqual(result.moved.map((c) => c.id), ["spades-1"]);
    assert.equal(s.waste.length, 1);
  });

  it("refuses a move onto the stock or the waste", () => {
    const s = state({ tableau: [[card("spades", 13)], [], [], [], [], [], []], waste: [card("hearts", 5)] });
    assert.equal(K.applyMove(s, { zone: "tableau", index: 0, cardIndex: 0 }, { zone: "waste", index: 0 }), null);
    assert.equal(K.applyMove(s, { zone: "tableau", index: 0, cardIndex: 0 }, { zone: "stock", index: 0 }), null);
  });
});

describe("the stock", () => {
  it("turns drawCount cards face up onto the waste", () => {
    const s = state({ drawCount: 3, stock: [card("spades", 2, false), card("hearts", 3, false), card("clubs", 4, false), card("spades", 5, false)] });
    const result = K.drawFromStock(s);
    assert.equal(result.drawn.length, 3);
    assert.equal(s.waste.length, 3);
    assert.equal(s.waste.every((c) => c.faceUp), true);
    assert.equal(s.stock.length, 1);
  });

  it("draws what is left when fewer than drawCount remain", () => {
    const s = state({ drawCount: 3, stock: [card("spades", 2, false)] });
    assert.equal(K.drawFromStock(s).drawn.length, 1);
    assert.equal(s.stock.length, 0);
  });

  it("recycles the waste in order, face down — it does NOT reshuffle", () => {
    // The bug that makes a home-made Klondike unlosable. The waste is turned over as a block,
    // so the order the player saw is the order they get again.
    const s = state({ waste: [card("spades", 2), card("hearts", 3), card("clubs", 4)] });
    const result = K.drawFromStock(s);
    assert.equal(result.recycled, true);
    assert.equal(s.waste.length, 0);
    assert.deepEqual(s.stock.map((c) => c.id), ["clubs-4", "hearts-3", "spades-2"]);
    assert.equal(s.stock.every((c) => !c.faceUp), true);
    // Drawing again deals them back in the original order.
    K.drawFromStock(s);
    assert.equal(K.topOf(s.waste).id, "spades-2");
  });

  it("does nothing when both stock and waste are empty", () => {
    const s = state();
    const result = K.drawFromStock(s);
    assert.deepEqual(result, { drawn: [], recycled: false });
    assert.equal(s.moves, 0, "a no-op is not a move");
  });
});

describe("autoMoveTarget", () => {
  it("prefers a foundation over a tableau pile", () => {
    const s = state({
      tableau: [[card("spades", 1)], [card("hearts", 2)], [], [], [], [], []],
      foundations: [[], [], [], []],
    });
    assert.deepEqual(K.autoMoveTarget(s, { zone: "tableau", index: 0, cardIndex: 0 }), { zone: "foundation", index: 0 });
  });

  it("never offers a tableau destination, even a legal one", () => {
    // Windows' double-click sends to a foundation or does nothing, and the faithful behaviour
    // is the correct one. An earlier "leftmost legal tableau pile" fallback invited a lone King
    // on pile 0 to pile 1 — another empty column. Legal, useless, and it counted a move. No
    // rule separates a useful tableau destination from a useless one, so there is no version of
    // that fallback to keep.
    const kingAlone = state({ tableau: [[card("spades", 13)], [], [], [], [], [], []] });
    assert.equal(K.autoMoveTarget(kingAlone, { zone: "tableau", index: 0, cardIndex: 0 }), null);

    const stackable = state({ tableau: [[card("hearts", 9)], [], [card("spades", 10)], [], [], [], []] });
    assert.equal(
      K.autoMoveTarget(stackable, { zone: "tableau", index: 0, cardIndex: 0 }),
      null,
      "the 9 on the 10 is a legal tableau move, and still not this function's business",
    );
  });

  it("returns null when no foundation accepts the card", () => {
    const s = state({ tableau: [[card("hearts", 9)], [card("diamonds", 10)], [], [], [], [], []] });
    assert.equal(K.autoMoveTarget(s, { zone: "tableau", index: 0, cardIndex: 0 }), null);
  });
});

describe("winning", () => {
  it("is 52 cards on the foundations, and not 51", () => {
    const full = (suit) => Array.from({ length: 13 }, (_, i) => card(suit, i + 1));
    const s = state({ foundations: [full("spades"), full("hearts"), full("diamonds"), full("clubs")] });
    assert.equal(K.isWon(s), true);
    s.foundations[3].pop();
    assert.equal(K.isWon(s), false);
  });

  it("availableFoundationMoves finds one round of moves, not the whole finish", () => {
    // One round on purpose: the view plays each move as an animation, so a function that
    // finished the game internally would leave the animation with nothing to show.
    const s = state({
      tableau: [[card("spades", 1)], [card("hearts", 1)], [], [], [], [], []],
      waste: [card("diamonds", 1)],
    });
    const moves = K.availableFoundationMoves(s);
    assert.equal(moves.length, 3, "two tableau aces and the waste ace");
    assert.equal(moves.every((m) => m.to.zone === "foundation"), true);
    // Distinct foundations, so the round is applicable IN ORDER. The first version asked
    // `canMove` per source against the live state, so all three Aces came back pointing at
    // foundation 0 and the view silently dropped two of them.
    assert.equal(new Set(moves.map((m) => m.to.index)).size, 3);
    // And the round really does apply end to end.
    for (const move of moves) assert.ok(K.applyMove(s, move.from, move.to), "every move in the round is live");
    assert.equal(s.foundations.filter((f) => f.length === 1).length, 3);
  });

  it("lets a 2 follow its own Ace inside one round", () => {
    // The shadow-claim's other job: after the Ace is claimed onto a foundation, the 2 of the
    // same suit must see it there. Checking against the live state would have refused.
    const s = state({
      tableau: [[card("spades", 1)], [card("spades", 2)], [], [], [], [], []],
    });
    const moves = K.availableFoundationMoves(s);
    assert.equal(moves.length, 2);
    assert.equal(moves[0].to.index, moves[1].to.index, "both onto the same spades foundation");
    for (const move of moves) assert.ok(K.applyMove(s, move.from, move.to));
    assert.deepEqual(s.foundations[moves[0].to.index].map((c) => c.id), ["spades-1", "spades-2"]);
  });

  it("ignores a face-down tableau top", () => {
    const s = state({ tableau: [[card("spades", 1, false)], [], [], [], [], [], []] });
    assert.deepEqual(K.availableFoundationMoves(s), []);
  });
});

describe("a full seeded game is playable to a real position", () => {
  it("plays 40 auto-moves without ever reaching an illegal state", () => {
    // A cheap property test over the whole engine: repeatedly take any legal foundation move,
    // otherwise draw. It does not try to WIN — it asserts the invariants hold move after move,
    // which is what a rules bug breaks.
    const s = K.newGame(11, 1);
    for (let step = 0; step < 40; step++) {
      const moves = K.availableFoundationMoves(s);
      if (moves.length > 0) K.applyMove(s, moves[0].from, moves[0].to);
      else K.drawFromStock(s);

      const all = [...s.tableau.flat(), ...s.foundations.flat(), ...s.stock, ...s.waste];
      assert.equal(all.length, 52, `step ${step}: cards must not be created or lost`);
      assert.equal(new Set(all.map((c) => c.id)).size, 52, `step ${step}: no duplicates`);
      for (const f of s.foundations) {
        f.forEach((c, i) => {
          assert.equal(c.rank, i + 1, "a foundation is A,2,3,… by construction");
          assert.equal(c.suit, f[0].suit, "and one suit throughout");
        });
      }
      assert.equal(s.waste.every((c) => c.faceUp), true, `step ${step}: the waste is face up`);
      assert.equal(s.stock.every((c) => !c.faceUp), true, `step ${step}: the stock is face down`);
    }
  });
});
