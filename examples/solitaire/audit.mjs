/**
 * The table audit, as a browser-script string, in ONE place.
 *
 * Imported by `game.test.mjs` (which runs it after every ply of a searched winning line) and by
 * `playthrough.mjs` (which runs it after every move of a greedy game). It started life inside
 * the harness; a copy in the test would be two definitions of "the table is consistent", and the
 * one that drifts is always the one CI is not running.
 *
 * A string rather than a function because it is evaluated in the PAGE, where a bundler-scoped
 * import cannot reach. No backticks and no `${` inside it — both end the template literal.
 */
/**
 * The audit itself, run in the page after every move.
 *
 * Returns a list of strings; empty means the table is consistent. Deliberately checks the DOM
 * against the state rather than the state against itself — the state alone can be perfectly
 * coherent while the screen shows something else, which is the bug a player would report as
 * "it stopped working" and which no unit test sees.
 */
export const AUDIT = `(() => {
  const s = window.solitaire.state;
  const problems = [];
  const zones = [
    ["stock", [s.stock]],
    ["waste", [s.waste]],
    ["tableau", s.tableau],
    ["foundations", s.foundations],
  ];

  // 1. Every card exactly once.
  const seen = new Map();
  for (const [zone, piles] of zones) {
    piles.forEach((pile, index) => {
      for (const card of pile) {
        if (seen.has(card.id)) problems.push("card " + card.id + " is in two places: " + seen.get(card.id) + " and " + zone + "[" + index + "]");
        seen.set(card.id, zone + "[" + index + "]");
      }
    });
  }
  if (seen.size !== 52) problems.push("the table holds " + seen.size + " distinct cards, not 52");

  // 2. Foundations ascend from the Ace within one suit.
  s.foundations.forEach((pile, i) => {
    pile.forEach((card, r) => {
      if (card.rank !== r + 1) problems.push("foundation " + i + " has " + card.id + " at position " + r);
      if (card.suit !== pile[0].suit) problems.push("foundation " + i + " mixes " + pile[0].suit + " and " + card.suit);
    });
  });

  // 3. Consecutive face-up tableau cards form a descending alternating run. Only legal moves put
  //    a card on the tableau, so this holds for the whole game; a break means a move was applied
  //    that canStackOnTableau would have refused.
  s.tableau.forEach((pile, i) => {
    for (let n = 1; n < pile.length; n++) {
      const under = pile[n - 1], over = pile[n];
      if (!under.faceUp || !over.faceUp) continue;
      if (under.rank !== over.rank + 1 || under.red === over.red) {
        problems.push("tableau " + i + " stacks " + over.id + " on " + under.id + ", which is not a descending alternating run");
      }
    }
    // A face-down card above a face-up one cannot happen: uncovering only ever turns cards up.
    let sawFaceUp = false;
    for (const card of pile) {
      if (card.faceUp) sawFaceUp = true;
      else if (sawFaceUp) problems.push("tableau " + i + " has face-down " + card.id + " above a face-up card");
    }
  });

  // 4. The DOM against the state, per pile. The stock deliberately renders ONE back for any
  //    number of cards, so it is compared against 0-or-1 rather than against its length.
  const domCount = (el) => el.querySelectorAll(".card").length;
  s.tableau.forEach((pile, i) => {
    const n = domCount(document.querySelectorAll("#tableau .slot")[i]);
    if (n !== pile.length) problems.push("tableau " + i + " holds " + pile.length + " cards and renders " + n);
  });
  s.foundations.forEach((pile, i) => {
    const n = domCount(document.querySelectorAll("#foundations .slot")[i]);
    if (n !== pile.length) problems.push("foundation " + i + " holds " + pile.length + " cards and renders " + n);
  });
  const wasteDom = domCount(document.getElementById("waste"));
  if (wasteDom !== s.waste.length) problems.push("waste holds " + s.waste.length + " cards and renders " + wasteDom);
  const stockDom = domCount(document.getElementById("stock"));
  if (stockDom !== (s.stock.length > 0 ? 1 : 0)) problems.push("stock has " + s.stock.length + " cards and renders " + stockDom + " backs");

  // 5. The counters, which are what a player reads.
  const placed = s.foundations.reduce((n, p) => n + p.length, 0);
  const shown = Number(document.getElementById("remaining").textContent);
  if (shown !== placed) problems.push("the status says " + shown + " on the foundations, the state says " + placed);
  if (Number(document.getElementById("moves").textContent) !== s.moves) problems.push("the move counter disagrees with the state");

  return problems;
})()`;
