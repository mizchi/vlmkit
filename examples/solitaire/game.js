/**
 * Klondike solitaire — the view: DOM, drag and drop, keyboard, animation.
 *
 * The rules live in `rules.js` and this file never re-derives them. Every "can this card go
 * here" question — including the one `dragover` has to answer in a fraction of a frame — calls
 * `Klondike.canMove`. A drop target that highlights for a move the rules will reject is a lie
 * the player acts on, and the only way to be sure it cannot happen is to have one answer.
 *
 * A classic script (see `rules.js` for why: `type="module"` is CORS-blocked on `file://`).
 *
 * ## Drag and drop
 *
 * HTML5 drag and drop, wired the way the spec actually requires rather than the way that
 * usually half-works:
 *
 *   dragstart   only fires on an element that IS `draggable`, so `draggable` is set per card
 *               from the rules — a face-down card and the middle of a broken run are not
 *               draggable, and their cursor says so
 *   dragover    `preventDefault()` ONLY when the move is legal. This is the whole mechanism:
 *               without preventDefault the browser refuses the drop, and a handler that always
 *               prevents makes every pile look droppable
 *   drop        `preventDefault()` (stops the browser navigating to the payload) then applies
 *   dragend     always clears the drag state, including when the drop never happened
 *
 * A run is dragged as one unit with a custom `setDragImage`, because the default image is a
 * snapshot of the source element alone and dragging five cards while seeing one is
 * disorienting.
 *
 * ## Keyboard
 *
 * Everything playable without a pointer, which is a correctness requirement and not a nicety:
 * a drag-only game is unusable without a mouse, and `scan handlers` reports exactly that as
 * `drag-without-keyboard-alternative`. Tab reaches every card and pile; Enter or Space lifts a
 * card and places it; Escape puts it down; double-click (or Enter on an already-lifted card's
 * own pile) sends to a foundation.
 *
 * ## Determinism, for the gates
 *
 * `?seed=N` fixes the deal. `?draw=1|3` picks the stock rule. `?animate=0` skips every
 * animation, and `document.body.dataset.dealComplete` flips to `"true"` when the opening deal
 * has finished — the deal runs for ~960ms (28 tableau cards staggered 26ms apart, `check
 * animation` measures `settle: 962ms`), and a screenshot taken during it differs every run, so
 * a VRT baseline of this page needs one or the other.
 */
(function () {
  "use strict";

  const K = globalThis.Klondike;
  const SUIT_GLYPH = { spades: "\u2660", hearts: "\u2665", diamonds: "\u2666", clubs: "\u2663" };
  const SUIT_NAME = { spades: "spades", hearts: "hearts", diamonds: "diamonds", clubs: "clubs" };
  const DEAL_STAGGER_MS = 26;

  const params = new URLSearchParams(globalThis.location.search);
  const readInt = (name, fallback) => {
    const raw = params.get(name);
    const value = raw === null ? NaN : Number.parseInt(raw, 10);
    return Number.isFinite(value) ? value : fallback;
  };

  /**
   * Animation off has three sources, and any one of them wins.
   *
   * `?animate=0` for a gate that wants a still page; the OS-level reduced-motion preference,
   * which must be honoured in script as well as CSS because the JS-driven parts (the deal
   * stagger, the bounce delays) are not reachable from a media query; and the "Animations"
   * toggle in the toolbar, for a player who just wants to get on with it.
   */
  const prefersReducedMotion = () =>
    globalThis.matchMedia && globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const settings = {
    animate: params.get("animate") !== "0" && !prefersReducedMotion(),
  };

  let state = K.newGame(readInt("seed", 1), readInt("draw", 1));
  /** The card the keyboard is holding, as a `from` ref, or null. */
  let lifted = null;
  let dragging = null;
  let dealing = false;

  const el = {
    table: document.getElementById("table"),
    foundations: document.getElementById("foundations"),
    tableau: document.getElementById("tableau"),
    stock: document.getElementById("stock"),
    waste: document.getElementById("waste"),
    moves: document.getElementById("moves"),
    remaining: document.getElementById("remaining"),
    announcer: document.getElementById("announcer"),
    banner: document.getElementById("win-banner"),
  };

  const cardLabel = (card) =>
    card.faceUp
      ? `${K.RANK_LABELS[card.rank]} of ${SUIT_NAME[card.suit]}`
      : "face-down card";

  const announce = (message) => {
    // One live region, replaced rather than appended: a screen reader should hear the last
    // move, not the whole game's history.
    if (el.announcer) el.announcer.textContent = message;
  };

  /** A `from`/`to` reference encoded for `dataTransfer`, which carries strings only. */
  const encodeRef = (ref) => JSON.stringify(ref);
  const decodeRef = (raw) => {
    try {
      const ref = JSON.parse(raw);
      return ref && typeof ref.zone === "string" ? ref : null;
    } catch {
      return null;
    }
  };

  function buildCard(card, ref, options) {
    const node = document.createElement("div");
    node.className = `card ${card.faceUp ? "face-up" : "face-down"}${card.red ? " red" : ""}`;
    node.dataset.cardId = card.id;
    node.dataset.ref = encodeRef(ref);
    node.style.top = `${options.offset}px`;
    node.style.zIndex = String(options.z);

    // Draggable strictly per the rules. `dragstart` cannot fire on a non-draggable element, so
    // this is also what stops a face-down card or a broken run from being picked up at all.
    const canLift = card.faceUp && K.isMovableRun(options.pile, options.cardIndex);
    if (canLift) node.draggable = true;

    // Focusable only when it can be acted on, so Tab walks the cards a player can use instead
    // of all 52. A face-down card is not a control.
    if (canLift) {
      node.tabIndex = 0;
      node.setAttribute("role", "button");
      const runLength = options.pile.length - options.cardIndex;
      node.setAttribute(
        "aria-label",
        runLength > 1
          ? `${cardLabel(card)}, with ${runLength - 1} card${runLength === 2 ? "" : "s"} on top`
          : cardLabel(card),
      );
      node.setAttribute("aria-grabbed", lifted && lifted.cardKey === options.cardKey ? "true" : "false");
    } else {
      node.setAttribute("aria-hidden", card.faceUp ? "false" : "true");
      if (card.faceUp) node.setAttribute("aria-label", cardLabel(card));
    }

    if (card.faceUp) {
      const glyph = SUIT_GLYPH[card.suit];
      const rank = K.RANK_LABELS[card.rank];
      node.innerHTML =
        `<span class="corner corner-tl">${rank}<span class="pip">${glyph}</span></span>`
        + `<span class="center-pip" aria-hidden="true">${glyph}</span>`
        + `<span class="corner corner-br">${rank}<span class="pip">${glyph}</span></span>`;
    }
    if (lifted && lifted.cardKey === options.cardKey) node.classList.add("lifted");
    return node;
  }

  /** A stable key for "this card in this position", used to re-find a node across a render. */
  const cardKeyFor = (card) => card.id;

  function renderPile(slot, pile, zone, index) {
    slot.textContent = "";
    slot.dataset.ref = encodeRef({ zone, index });
    let offset = 0;
    pile.forEach((card, cardIndex) => {
      const node = buildCard(card, { zone, index, cardIndex }, {
        offset,
        z: cardIndex + 1,
        pile,
        cardIndex,
        cardKey: cardKeyFor(card),
      });
      slot.append(node);
      if (zone === "tableau") {
        // Face-up cards fan wider than face-down ones — the taper that makes a Klondike column
        // readable. The last card never adds an offset for a card after it.
        offset += card.faceUp ? remToPx("--fan-up") : remToPx("--fan-down");
      }
    });
  }

  const remToPx = (varName) => {
    const raw = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
    if (raw.endsWith("rem")) return Number.parseFloat(raw) * 16;
    if (raw.endsWith("px")) return Number.parseFloat(raw);
    return Number.parseFloat(raw) || 0;
  };

  function render() {
    for (let i = 0; i < 4; i++) {
      renderPile(el.foundations.children[i], state.foundations[i], "foundation", i);
    }
    for (let i = 0; i < K.TABLEAU_COUNT; i++) {
      renderPile(el.tableau.children[i], state.tableau[i], "tableau", i);
    }
    // The stock shows a single back, not 24 stacked nodes: they are indistinguishable and 24
    // focusable duplicates would make Tab useless.
    el.stock.textContent = "";
    el.stock.dataset.ref = encodeRef({ zone: "stock", index: 0 });
    if (state.stock.length > 0) {
      const back = document.createElement("div");
      back.className = "card face-down";
      back.setAttribute("aria-hidden", "true");
      el.stock.append(back);
    }
    renderPile(el.waste, state.waste, "waste", 0);

    el.moves.textContent = String(state.moves);
    el.remaining.textContent = String(52 - state.foundations.reduce((n, p) => n + p.length, 0));
    el.stock.setAttribute(
      "aria-label",
      state.stock.length > 0
        ? `Stock, ${state.stock.length} card${state.stock.length === 1 ? "" : "s"} — deal ${state.drawCount}`
        : state.waste.length > 0
          ? "Stock empty — turn the waste over"
          : "Stock and waste both empty",
    );
  }

  /** Every card node currently on the table, by card id, for measuring a FLIP animation. */
  function measureCards() {
    const boxes = new Map();
    for (const node of el.table.querySelectorAll(".card[data-card-id]")) {
      boxes.set(node.dataset.cardId, node.getBoundingClientRect());
    }
    return boxes;
  }

  /**
   * Animate cards from where they were to where they now are.
   *
   * A FLIP: the DOM is already in its final state, and each moved card is animated from its
   * previous box. Doing it the other way — animating to the destination and then re-rendering —
   * flashes, because the render lands before the animation ends.
   */
  function playSettle(before, ids) {
    if (!settings.animate) return;
    const after = measureCards();
    for (const id of ids) {
      const from = before.get(id);
      const to = after.get(id);
      if (!from || !to) continue;
      const dx = from.left - to.left;
      const dy = from.top - to.top;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue;
      const node = el.table.querySelector(`.card[data-card-id="${cssEscape(id)}"]`);
      if (!node) continue;
      node.style.setProperty("--settle-x", `${dx}px`);
      node.style.setProperty("--settle-y", `${dy}px`);
      node.classList.add("settling");
      node.addEventListener("animationend", () => node.classList.remove("settling"), { once: true });
    }
  }

  const cssEscape = (value) =>
    globalThis.CSS && CSS.escape ? CSS.escape(value) : String(value).replace(/["\\]/g, "\\$&");

  function playFlip(card) {
    if (!settings.animate || !card) return;
    const node = el.table.querySelector(`.card[data-card-id="${cssEscape(card.id)}"]`);
    if (!node) return;
    node.classList.add("flipping");
    node.addEventListener("animationend", () => node.classList.remove("flipping"), { once: true });
  }

  /**
   * Commit a move and animate the result. The single path every move goes through — drag,
   * keyboard and double-click all end up here, so there is one place where the state, the
   * render, the animation and the announcement stay in step.
   */
  function commit(from, to) {
    const before = measureCards();
    const result = K.applyMove(state, from, to);
    if (!result) return false;
    render();
    playSettle(before, result.moved.map((c) => c.id));
    playFlip(result.revealed);
    const what = result.moved.length > 1
      ? `${result.moved.length} cards from ${cardLabel(result.moved[0])}`
      : cardLabel(result.moved[0]);
    announce(`Moved ${what} to ${to.zone === "foundation" ? "a foundation" : `tableau ${to.index + 1}`}.`);
    if (K.isWon(state)) celebrate();
    return true;
  }

  // ── Drag and drop ─────────────────────────────────────────────────────────────────────

  el.table.addEventListener("dragstart", (event) => {
    const node = event.target.closest(".card[draggable=\"true\"]");
    if (!node) return;
    const ref = decodeRef(node.dataset.ref);
    if (!ref) return;
    dragging = ref;
    node.classList.add("dragging");
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", encodeRef(ref));
    // A run is dragged as a run. The default drag image is this element alone, so five cards
    // would travel as one and the player could not see what they were holding.
    const run = runNodesFrom(node);
    if (run.length > 1) {
      const ghost = buildDragGhost(run);
      event.dataTransfer.setDragImage(ghost, 20, 20);
      // Removed after the browser has taken its snapshot; removing it synchronously leaves an
      // empty drag image in Chromium.
      globalThis.setTimeout(() => ghost.remove(), 0);
    }
  });

  function runNodesFrom(node) {
    const nodes = [node];
    let next = node.nextElementSibling;
    while (next && next.classList.contains("card")) {
      nodes.push(next);
      next = next.nextElementSibling;
    }
    return nodes;
  }

  function buildDragGhost(nodes) {
    const ghost = document.createElement("div");
    ghost.style.cssText = "position:absolute;top:-1000px;left:-1000px;width:120px;";
    for (const [i, source] of nodes.entries()) {
      const copy = source.cloneNode(true);
      copy.classList.remove("dragging", "lifted");
      copy.style.top = `${i * 24}px`;
      ghost.append(copy);
    }
    document.body.append(ghost);
    return ghost;
  }

  el.table.addEventListener("dragover", (event) => {
    const slot = event.target.closest(".slot");
    if (!slot || !dragging) return;
    const to = decodeRef(slot.dataset.ref);
    if (!to) return;
    if (K.canMove(state, dragging, to)) {
      // THE mechanism. Without preventDefault the browser rejects the drop, whatever the drop
      // handler says; with an unconditional preventDefault every pile claims to accept.
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      slot.classList.add("drop-ok");
      slot.classList.remove("drop-no");
    } else {
      slot.classList.add("drop-no");
      slot.classList.remove("drop-ok");
    }
  });

  el.table.addEventListener("dragleave", (event) => {
    const slot = event.target.closest(".slot");
    if (slot) slot.classList.remove("drop-ok", "drop-no");
  });

  el.table.addEventListener("drop", (event) => {
    const slot = event.target.closest(".slot");
    if (!slot) return;
    event.preventDefault();
    slot.classList.remove("drop-ok", "drop-no");
    const to = decodeRef(slot.dataset.ref);
    const from = dragging ?? decodeRef(event.dataTransfer.getData("text/plain"));
    dragging = null;
    if (from && to) commit(from, to);
  });

  el.table.addEventListener("dragend", () => {
    // Always, including a drop that never landed — otherwise the source card keeps its
    // half-transparent dragging style and the next gesture starts from a lie.
    dragging = null;
    for (const node of el.table.querySelectorAll(".dragging")) node.classList.remove("dragging");
    for (const slot of el.table.querySelectorAll(".drop-ok, .drop-no")) {
      slot.classList.remove("drop-ok", "drop-no");
    }
  });

  // ── Pointer clicks ────────────────────────────────────────────────────────────────────

  el.stock.addEventListener("click", () => {
    const result = K.drawFromStock(state);
    render();
    if (result.recycled) announce("Waste turned back into the stock.");
    else if (result.drawn.length > 0) announce(`Dealt ${result.drawn.map(cardLabel).join(", ")}.`);
    else announce("Stock and waste are both empty.");
  });

  el.table.addEventListener("dblclick", (event) => {
    const node = event.target.closest(".card[data-ref]");
    if (!node) return;
    const from = decodeRef(node.dataset.ref);
    if (!from) return;
    const to = K.autoMoveTarget(state, from);
    if (to) commit(from, to);
    else announce("No foundation accepts that card.");
  });

  // ── Keyboard ──────────────────────────────────────────────────────────────────────────

  el.table.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (lifted) {
        lifted = null;
        render();
        announce("Put the card back.");
      }
      return;
    }
    if (event.key !== "Enter" && event.key !== " ") return;
    const target = event.target.closest(".card[data-ref], .slot");
    if (!target) return;
    const ref = decodeRef(target.dataset.ref);
    if (!ref) return;
    // Never swallow a real button's own activation. The stock is a `<button>` inside this
    // container, so an unconditional preventDefault here stopped Enter from clicking it — the
    // keyboard could pick cards up but could not deal. A native control's default IS the
    // interaction; only the card/pile handling below is ours to take over.
    if (event.target.closest("button") && !lifted) return;
    event.preventDefault();

    if (!lifted) {
      if (!target.classList.contains("card")) return;
      lifted = Object.assign({}, ref, { cardKey: target.dataset.cardId });
      render();
      const held = el.table.querySelector(`.card[data-card-id="${cssEscape(lifted.cardKey)}"]`);
      if (held) held.focus();
      announce("Picked up. Tab to a pile and press Enter to place, Escape to put it back.");
      return;
    }

    const to = target.classList.contains("slot")
      ? decodeRef(target.dataset.ref)
      : { zone: ref.zone, index: ref.index };
    const from = lifted;
    lifted = null;
    if (!commit(from, to)) {
      render();
      announce("That move is not legal.");
    }
  });

  // ── The deal, and the victory cascade ─────────────────────────────────────────────────

  /**
   * Deal a new game, flying each card in from the stock corner.
   *
   * `dealComplete` is a DOM signal rather than a promise, because the consumers that need it
   * are outside the page: a VRT gate has to know when the table is still. It is set to
   * `"false"` first so a screenshot taken mid-deal cannot read a stale `"true"`.
   */
  function deal(seed, drawCount, reason) {
    state = K.newGame(seed, drawCount);
    lifted = null;
    el.banner.hidden = true;
    render();
    document.body.dataset.dealComplete = "false";
    // The reason is part of the announcement because restarting the opening position renders
    // IDENTICALLY — same seed, no moves made — so without distinct wording the live region does
    // not change either and the button has no observable effect at all. `check interactions`
    // reported exactly that as `inert-control`, and it was right.
    announce(`${reason ?? "New game"}: seed ${state.seed}, deal ${state.drawCount}.`);

    if (!settings.animate) {
      document.body.dataset.dealComplete = "true";
      return;
    }
    const stockBox = el.stock.getBoundingClientRect();
    const cards = [...el.tableau.querySelectorAll(".card")];
    dealing = true;
    cards.forEach((node, i) => {
      const box = node.getBoundingClientRect();
      node.style.setProperty("--deal-from-x", `${stockBox.left - box.left}px`);
      node.style.setProperty("--deal-from-y", `${stockBox.top - box.top}px`);
      node.style.setProperty("--deal-delay", `${i * DEAL_STAGGER_MS}ms`);
      node.classList.add("dealing");
    });
    const last = cards[cards.length - 1];
    if (!last) {
      document.body.dataset.dealComplete = "true";
      return;
    }
    last.addEventListener("animationend", () => {
      dealing = false;
      for (const node of cards) node.classList.remove("dealing");
      document.body.dataset.dealComplete = "true";
    }, { once: true });
  }

  /**
   * The bouncing cascade.
   *
   * Windows drew this on a canvas and never cleared it, so the cards smeared into a trail.
   * These are the real card elements, animated with a transform: they stay in the DOM, keep
   * their labels, and cost nothing to compose. Each gets its own drift, fall and duration so
   * the cascade does not look like one rigid sheet.
   */
  function celebrate() {
    el.banner.hidden = false;
    announce("You win.");
    if (!settings.animate) return;
    // Seeded, so a won game's cascade is the same cascade twice — the same reason the deal is
    // seeded. A random victory animation cannot be screenshotted.
    const rng = K.mulberry32(state.seed);
    // Reversed: the top card of the last foundation goes first, so the piles come apart from
    // the top down instead of the bottom card tearing out from under the rest.
    const cards = [...el.foundations.querySelectorAll(".card")].reverse();
    const viewportBottom = globalThis.innerHeight;
    cards.forEach((node, i) => {
      // Each card's OWN distance to the floor, so they do not all bounce at one height.
      const box = node.getBoundingClientRect();
      node.style.setProperty("--bounce-floor", `${Math.max(0, viewportBottom - box.bottom)}px`);
      node.style.setProperty("--bounce-x", `${(rng() - 0.5) * 2 * 60}vw`);
      node.style.setProperty("--bounce-rot", `${Math.round((rng() - 0.5) * 720)}deg`);
      node.style.setProperty("--bounce-ms", `${2000 + Math.round(rng() * 1200)}ms`);
      node.style.setProperty("--bounce-delay", `${i * 28}ms`);
      node.classList.add("bouncing");
    });
  }

  // ── Toolbar ───────────────────────────────────────────────────────────────────────────

  document.getElementById("new-game").addEventListener("click", () => {
    // A new seed, not a reshuffle of the same one — and it goes in the URL so the deal a player
    // just lost can be linked to, replayed, or handed to a bug report.
    const seed = Math.floor(Math.random() * 1e6);
    const next = new URL(globalThis.location.href);
    next.searchParams.set("seed", String(seed));
    history.replaceState(null, "", next);
    deal(seed, state.drawCount, "New game");
  });

  document.getElementById("restart").addEventListener("click", () => {
    deal(state.seed, state.drawCount, `Restarted deal ${state.seed}`);
  });

  document.getElementById("draw-count").addEventListener("change", (event) => {
    const count = Number.parseInt(event.target.value, 10) === 3 ? 3 : 1;
    const next = new URL(globalThis.location.href);
    next.searchParams.set("draw", String(count));
    history.replaceState(null, "", next);
    deal(state.seed, count, `Deal ${count}`);
  });

  document.getElementById("toggle-animation").addEventListener("click", (event) => {
    settings.animate = !settings.animate;
    event.target.setAttribute("aria-pressed", String(settings.animate));
    event.target.textContent = settings.animate ? "Animations: on" : "Animations: off";
    announce(settings.animate ? "Animations on." : "Animations off.");
  });

  /**
   * Auto-finish: play every available foundation move, one round at a time.
   *
   * Rounds rather than a single sweep, because a card freed by this round's moves may become
   * playable in the next — and each move animates, so the loop waits a frame between them
   * instead of finishing instantly with nothing to see.
   */
  document.getElementById("auto-finish").addEventListener("click", async () => {
    for (let round = 0; round < 60; round++) {
      const moves = K.availableFoundationMoves(state);
      if (moves.length === 0) break;
      for (const move of moves) {
        commit(move.from, move.to);
        if (settings.animate) await new Promise((r) => globalThis.setTimeout(r, 130));
      }
    }
    if (!K.isWon(state)) announce("No more foundation moves available.");
  });

  document.getElementById("draw-count").value = String(state.drawCount);
  const animationToggle = document.getElementById("toggle-animation");
  animationToggle.setAttribute("aria-pressed", String(settings.animate));
  animationToggle.textContent = settings.animate ? "Animations: on" : "Animations: off";

  deal(state.seed, state.drawCount, "New game");

  // For the smoke test and for anyone poking at it from the console. Not the play interface —
  // the play interface is the DOM.
  globalThis.solitaire = {
    get state() { return state; },
    deal,
    commit,
    isWon: () => K.isWon(state),
    get dealing() { return dealing; },
  };
})();
