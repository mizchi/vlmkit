/**
 * Klondike solitaire rules — pure state, no DOM.
 *
 * Separated from `game.js` because this is the half where correctness is checkable without a
 * browser: `rules.test.mjs` drives it directly, so a rules bug fails in milliseconds instead
 * of being something you notice three moves into a manual play-through.
 *
 * A CLASSIC script, not an ES module: a `type="module"` script is blocked by CORS on
 * `file://`, and every vlmkit gate in this repo's examples is expected to run straight off the
 * filesystem (`vlmkit check integrity examples/solitaire/index.html`). So this assigns
 * `globalThis.Klondike` and nothing else.
 *
 * `rules.test.mjs` therefore loads it the way the browser does — reading the source and
 * evaluating it in a fresh `node:vm` context — rather than importing it. That is deliberate:
 * the repo is `"type": "module"`, so a `.js` file here is ESM to Node and a UMD wrapper was
 * silently exporting nothing. Evaluating it as a script both fixes that and means the test
 * exercises the same loading mode the page uses, including catching any Node-only syntax that
 * would not run in a browser.
 *
 * ## The deal, and why the shuffle is seeded
 *
 * A fresh shuffle every load makes visual regression testing impossible: the screenshot is
 * different every run, so a diff means nothing. `newGame(seed)` takes a seed and
 * `mulberry32` is a fixed 32-bit PRNG, so `?seed=1` is the same deal on every machine and
 * every browser. That is what lets `vlmkit check story` / `snapshot` hold a baseline of this
 * page at all.
 */
globalThis.Klondike = (function () {
  "use strict";

  const SUITS = ["spades", "hearts", "diamonds", "clubs"];
  const RED = new Set(["hearts", "diamonds"]);
  /** Index 0 is unused so `RANK_LABELS[1] === "A"` reads as the rank it is. */
  const RANK_LABELS = [null, "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
  const TABLEAU_COUNT = 7;
  const KING = 13;
  const ACE = 1;

  /**
   * A 32-bit PRNG with a stated period, rather than `Math.random`.
   *
   * The point is reproducibility, so the generator has to be part of the page instead of the
   * platform's: `Math.random` cannot be seeded, and a deal nobody can reproduce is a deal
   * nobody can screenshot twice.
   */
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function next() {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function makeDeck() {
    const deck = [];
    for (const suit of SUITS) {
      for (let rank = ACE; rank <= KING; rank++) {
        deck.push({ id: `${suit}-${rank}`, suit, rank, red: RED.has(suit), faceUp: false });
      }
    }
    return deck;
  }

  /** Fisher-Yates, driven by the seeded generator so the result is a function of the seed. */
  function shuffle(deck, rng) {
    const out = deck.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = out[i];
      out[i] = out[j];
      out[j] = tmp;
    }
    return out;
  }

  /**
   * A fresh game.
   *
   * `drawCount` is 1 or 3 — Windows offers both as "Draw one" / "Draw three", and the rules
   * are otherwise identical, so it is a number here rather than two code paths.
   */
  function newGame(seed, drawCount) {
    const rng = mulberry32(typeof seed === "number" ? seed : 1);
    const deck = shuffle(makeDeck(), rng);
    const tableau = [];
    let at = 0;
    for (let pile = 0; pile < TABLEAU_COUNT; pile++) {
      const cards = [];
      for (let n = 0; n <= pile; n++) {
        const card = Object.assign({}, deck[at++]);
        // Only the last card of each pile starts face up. This is the whole shape of the
        // opening position, and getting it wrong makes every early game trivially winnable.
        card.faceUp = n === pile;
        cards.push(card);
      }
      tableau.push(cards);
    }
    return {
      seed: typeof seed === "number" ? seed : 1,
      drawCount: drawCount === 3 ? 3 : 1,
      tableau,
      foundations: [[], [], [], []],
      stock: deck.slice(at).map((card) => Object.assign({}, card, { faceUp: false })),
      waste: [],
      moves: 0,
    };
  }

  const topOf = (pile) => (pile.length > 0 ? pile[pile.length - 1] : null);

  /**
   * May `card` sit on a tableau pile?
   *
   * Descending rank, alternating colour; an EMPTY pile takes a King and nothing else. That
   * last clause is the one casual implementations drop, and dropping it turns the hardest
   * part of the game into a free parking space.
   */
  function canStackOnTableau(card, pile) {
    const top = topOf(pile);
    if (!top) return card.rank === KING;
    if (!top.faceUp) return false;
    return top.rank === card.rank + 1 && top.red !== card.red;
  }

  /** Foundations build up from the Ace in one suit. */
  function canPlaceOnFoundation(card, foundation) {
    const top = topOf(foundation);
    if (!top) return card.rank === ACE;
    return top.suit === card.suit && top.rank === card.rank - 1;
  }

  /**
   * Is the run starting at `index` liftable as one unit?
   *
   * A face-up descending, alternating-colour sequence moves together — that is what makes
   * Klondike a game rather than a card-at-a-time shuffle. Any face-down card in the range
   * disqualifies it, and so does a break in the sequence.
   */
  function isMovableRun(pile, index) {
    if (index < 0 || index >= pile.length) return false;
    for (let i = index; i < pile.length; i++) {
      if (!pile[i].faceUp) return false;
      if (i > index) {
        const above = pile[i - 1];
        const card = pile[i];
        if (above.rank !== card.rank + 1 || above.red === card.red) return false;
      }
    }
    return true;
  }

  /** The pile a `from` reference points at. `null` for an unknown reference. */
  function pileFor(state, ref) {
    if (!ref) return null;
    if (ref.zone === "tableau") return state.tableau[ref.index] ?? null;
    if (ref.zone === "foundation") return state.foundations[ref.index] ?? null;
    if (ref.zone === "waste") return state.waste;
    if (ref.zone === "stock") return state.stock;
    return null;
  }

  /**
   * Whether a move is legal, without performing it.
   *
   * Exported because the DOM layer needs the answer during `dragover` — a drop target that
   * cannot accept the card must not say it can, and the only honest way to know is to ask the
   * rules rather than re-derive them next to the styling.
   */
  function canMove(state, from, to) {
    const source = pileFor(state, from);
    const target = pileFor(state, to);
    if (!source || !target || source === target) return false;
    if (to.zone === "stock" || to.zone === "waste") return false;

    const index = from.zone === "tableau" ? from.cardIndex : source.length - 1;
    if (index === undefined || index < 0 || index >= source.length) return false;
    const moving = source.slice(index);
    if (moving.length === 0) return false;
    if (from.zone === "tableau" && !isMovableRun(source, index)) return false;
    if (from.zone !== "tableau" && moving.length !== 1) return false;
    if (!moving[0].faceUp) return false;

    if (to.zone === "foundation") {
      // Only ever one card: a foundation is built card by card even when a legal run sits on
      // top of the one you want.
      if (moving.length !== 1) return false;
      return canPlaceOnFoundation(moving[0], target);
    }
    return canStackOnTableau(moving[0], target);
  }

  /**
   * Perform a move, returning the cards that moved and whether a card was revealed.
   *
   * Mutates `state` — the DOM layer renders from it after every move, and a copy-on-write
   * model would mean either re-rendering everything or diffing two trees to find the two
   * piles that changed. Returns `null` for an illegal move rather than throwing, because
   * "the user dropped a card somewhere it cannot go" is an ordinary outcome, not an error.
   */
  function applyMove(state, from, to) {
    if (!canMove(state, from, to)) return null;
    const source = pileFor(state, from);
    const target = pileFor(state, to);
    const index = from.zone === "tableau" ? from.cardIndex : source.length - 1;
    const moving = source.splice(index);
    for (const card of moving) target.push(card);
    state.moves += 1;

    // Uncovering a face-down card flips it. Reported rather than silently done, so the view
    // can animate exactly the card that turned.
    let revealed = null;
    if (from.zone === "tableau") {
      const exposed = topOf(source);
      if (exposed && !exposed.faceUp) {
        exposed.faceUp = true;
        revealed = exposed;
      }
    }
    return { moved: moving, revealed, from, to };
  }

  /**
   * Stock -> waste, or waste -> stock when the stock runs out.
   *
   * The recycle is what keeps the game going, and it preserves order: the waste is turned
   * over as a block, not reshuffled. Reshuffling here would make the game unlosable and is
   * the most common rules bug in a home-made Klondike.
   */
  function drawFromStock(state) {
    if (state.stock.length === 0) {
      if (state.waste.length === 0) return { drawn: [], recycled: false };
      const returning = state.waste.splice(0, state.waste.length).reverse();
      for (const card of returning) {
        card.faceUp = false;
        state.stock.push(card);
      }
      state.moves += 1;
      return { drawn: [], recycled: true };
    }
    const drawn = [];
    for (let n = 0; n < state.drawCount && state.stock.length > 0; n++) {
      const card = state.stock.pop();
      card.faceUp = true;
      state.waste.push(card);
      drawn.push(card);
    }
    state.moves += 1;
    return { drawn, recycled: false };
  }

  /**
   * Where a double-clicked card should go, or `null`. **Foundations only.**
   *
   * Faithful to Windows, where a double-click sends a card to its foundation and otherwise
   * does nothing — and the faithful behaviour is also the correct one. An earlier version fell
   * back to "the leftmost legal tableau pile", which a test caught offering a pointless move:
   * a lone King on pile 0 was invited to pile 1, another empty column. Legal, useless, and it
   * counts a move. There is no rule that distinguishes a useful tableau destination from a
   * useless one, so the fallback cannot be repaired — only removed.
   *
   * Tableau moves without a pointer are a KEYBOARD interface (pick a card up, choose a
   * destination), which `game.js` provides; they are not a guess this function can make.
   */
  function autoMoveTarget(state, from) {
    for (let i = 0; i < state.foundations.length; i++) {
      const to = { zone: "foundation", index: i };
      if (canMove(state, from, to)) return to;
    }
    return null;
  }

  const isWon = (state) => state.foundations.reduce((n, pile) => n + pile.length, 0) === 52;

  /**
   * Every foundation move available right now, for the "auto-finish" button.
   *
   * Returns one round rather than looping to completion: the view plays them as a sequence of
   * animations, and a function that finished the game internally would leave the animation
   * with nothing to show.
   *
   * The moves must be applicable IN ORDER, which is the part the first version got wrong. It
   * asked `canMove` against the live state for each source independently, so with four empty
   * foundations three different Aces all came back targeting foundation 0 — legal one at a
   * time, and the 2nd and 3rd silently dropped by `applyMove` when the view played them. So
   * this walks a shadow copy of the foundations and claims one per move, which also lets a 2
   * follow its own Ace inside the same round.
   */
  function availableFoundationMoves(state) {
    const moves = [];
    const claimed = state.foundations.map((pile) => pile.slice());
    const consider = (from, card) => {
      for (let i = 0; i < claimed.length; i++) {
        if (!canPlaceOnFoundation(card, claimed[i])) continue;
        moves.push({ from, to: { zone: "foundation", index: i } });
        claimed[i].push(card);
        return;
      }
    };
    for (let i = 0; i < state.tableau.length; i++) {
      const pile = state.tableau[i];
      const card = topOf(pile);
      if (card && card.faceUp) consider({ zone: "tableau", index: i, cardIndex: pile.length - 1 }, card);
    }
    const wasteTop = topOf(state.waste);
    if (wasteTop) consider({ zone: "waste", index: 0 }, wasteTop);
    return moves;
  }

  return {
    SUITS,
    RANK_LABELS,
    TABLEAU_COUNT,
    KING,
    ACE,
    mulberry32,
    makeDeck,
    shuffle,
    newGame,
    canStackOnTableau,
    canPlaceOnFoundation,
    isMovableRun,
    canMove,
    applyMove,
    drawFromStock,
    autoMoveTarget,
    availableFoundationMoves,
    isWon,
    topOf,
  };
})();
