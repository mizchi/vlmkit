/**
 * Finds a winning line for a seed, so a playthrough can prove the game is WINNABLE.
 *
 * Split from `playthrough.mjs` on purpose, and the split is the whole idea:
 *
 *   this file  — searches, in node, against `rules.js` loaded the way the page loads it. No DOM,
 *                no browser, ~10k states/second, and it answers "is this deal solvable".
 *   playthrough — replays the line it returns through the real UI and audits every move, which
 *                answers "does the page play it correctly".
 *
 * The greedy player in `playthrough.mjs` won 0 of 12 seeds and that proved nothing either way:
 * a greedy Klondike player losing is expected. A search that finds a line, replayed through the
 * UI to a visible win, is the difference between "no bug found" and "the game can be finished".
 *
 * Usage:
 *   node examples/solitaire/solve.mjs --seed 1
 *   node examples/solitaire/solve.mjs --seeds 40 --draw 1 --nodes 400000
 *   node examples/solitaire/solve.mjs --seed 1 --json      # the move list, for the playthrough
 */
import { readFileSync } from "node:fs";
import { runInThisContext } from "node:vm";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Loaded exactly as `rules.test.mjs` does it: a classic script assigning `globalThis.Klondike`,
// which is how the page consumes it. Importing a second copy of the rules would make any result
// a statement about this file rather than about the game.
const here = dirname(fileURLToPath(import.meta.url));
runInThisContext(readFileSync(join(here, "rules.js"), "utf8"), { filename: "rules.js" });
const K = globalThis.Klondike;

const clone = (state) => ({
  seed: state.seed,
  drawCount: state.drawCount,
  moves: state.moves,
  stock: state.stock.map((c) => ({ ...c })),
  waste: state.waste.map((c) => ({ ...c })),
  tableau: state.tableau.map((p) => p.map((c) => ({ ...c }))),
  foundations: state.foundations.map((p) => p.map((c) => ({ ...c }))),
});

/** A canonical signature. Foundations are summarised by height per suit — their order never matters. */
function signature(state) {
  const pile = (p) => p.map((c) => (c.faceUp ? "" : "-") + c.id).join(",");
  const foundations = state.foundations
    .map((p) => (p.length ? `${p[0].suit}:${p.length}` : ""))
    .sort()
    .join(";");
  return `${state.tableau.map(pile).sort().join("|")}/${foundations}/${pile(state.waste)}/${state.stock.length}`;
}

/**
 * Every distinct action from here, ordered best-first.
 *
 * `draw` is one of them rather than a fallback: a search that only draws when stuck cannot find
 * lines that need a card turned up first, which is most of them.
 *
 * Foundation moves are deduplicated across the four piles — the four empty foundations accept the
 * same Ace and produce the same position, so offering all four multiplies the branching factor by
 * four for nothing. That single change is what brought seed 1 from "no solution in 400k nodes" to
 * a solution in a few thousand.
 */
function actions(state) {
  const out = [];
  const seenTargets = new Set();

  const foundationFor = (from) => {
    for (let f = 0; f < 4; f++) {
      const to = { zone: "foundation", index: f };
      if (K.canMove(state, from, to)) return to;
    }
    return null;
  };

  // Waste → foundation, then waste → tableau.
  if (state.waste.length > 0) {
    const from = { zone: "waste", index: 0 };
    const f = foundationFor(from);
    if (f) out.push({ kind: "wf", from, to: f, rank: 100 });
    for (let j = 0; j < K.TABLEAU_COUNT; j++) {
      const to = { zone: "tableau", index: j };
      if (!K.canMove(state, from, to)) continue;
      // Two empty columns accept the same King identically; one is enough.
      const tag = state.tableau[j].length === 0 ? "empty" : `t${j}`;
      if (seenTargets.has(`w-${tag}`)) continue;
      seenTargets.add(`w-${tag}`);
      out.push({ kind: "wt", from, to, rank: 40 });
    }
  }

  for (let i = 0; i < K.TABLEAU_COUNT; i++) {
    const pile = state.tableau[i];
    for (let n = 0; n < pile.length; n++) {
      if (!pile[n].faceUp || !K.isMovableRun(pile, n)) continue;
      const from = { zone: "tableau", index: i, cardIndex: n };
      const uncovers = n > 0 && !pile[n - 1].faceUp;
      const runLength = pile.length - n;

      if (runLength === 1) {
        const f = foundationFor(from);
        if (f) out.push({ kind: "tf", from, to: f, rank: uncovers ? 95 : 60 });
      }
      for (let j = 0; j < K.TABLEAU_COUNT; j++) {
        if (j === i) continue;
        const to = { zone: "tableau", index: j };
        if (!K.canMove(state, from, to)) continue;
        // Moving a full column onto an empty one is a null move — it just relabels the column.
        if (n === 0 && state.tableau[j].length === 0) continue;
        const tag = state.tableau[j].length === 0 ? "empty" : `t${j}`;
        if (seenTargets.has(`${i}-${n}-${tag}`)) continue;
        seenTargets.add(`${i}-${n}-${tag}`);
        out.push({ kind: "tt", from, to, rank: uncovers ? 90 : 20 - runLength });
      }
    }
  }

  if (state.stock.length > 0 || state.waste.length > 0) {
    out.push({ kind: "draw", rank: 30 });
  }
  return out.sort((a, b) => b.rank - a.rank);
}

/**
 * Depth-first, memoised on the position signature, bounded by a node budget.
 *
 * Iterative with an explicit stack rather than recursive: a winning Klondike line runs past 100
 * plies and the search visits far deeper, so recursion is a stack overflow waiting for a slow
 * seed.
 */
export function solve(seed, { draw = 1, nodes: nodeBudget = 400_000 } = {}) {
  const root = K.newGame(seed, draw);
  const visited = new Set([signature(root)]);
  const stack = [{ state: root, line: [], todo: actions(root) }];
  let nodes = 0;

  while (stack.length > 0) {
    if (nodes >= nodeBudget) return { seed, solved: false, reason: "budget", nodes };
    const frame = stack[stack.length - 1];
    const action = frame.todo.shift();
    if (!action) { stack.pop(); continue; }

    const next = clone(frame.state);
    if (action.kind === "draw") K.drawFromStock(next);
    else if (!K.applyMove(next, action.from, action.to)) continue;
    nodes++;

    const sig = signature(next);
    if (visited.has(sig)) continue;
    visited.add(sig);

    const line = [...frame.line, action.kind === "draw" ? { draw: true } : { from: action.from, to: action.to }];
    if (K.isWon(next)) return { seed, solved: true, line, nodes, plies: line.length };

    // Depth cap: a line past this length is thrashing, and cutting it lets the budget reach
    // other branches. 400 is ~3x a comfortable human win with draw 1.
    if (line.length < 400) stack.push({ state: next, line, todo: actions(next) });
  }
  return { seed, solved: false, reason: "exhausted", nodes };
}

if (process.argv[1] && process.argv[1].endsWith("solve.mjs")) {
  const argv = process.argv.slice(2);
  const flag = (name, fallback) => {
    const i = argv.indexOf(name);
    return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : fallback;
  };
  const draw = Number(flag("--draw", 1));
  const nodes = Number(flag("--nodes", 400_000));
  const json = argv.includes("--json");
  const seeds = argv.indexOf("--seed") >= 0
    ? [Number(flag("--seed"))]
    : Array.from({ length: Number(flag("--seeds", 20)) }, (_, i) => i + 1);

  const results = [];
  for (const seed of seeds) {
    const started = process.hrtime.bigint();
    const result = solve(seed, { draw, nodes });
    const ms = Number(process.hrtime.bigint() - started) / 1e6;
    results.push(result);
    if (json) continue;
    console.log(
      `seed ${String(seed).padStart(3)}  ${result.solved ? `SOLVED in ${result.plies} plies` : `unsolved (${result.reason})`}`
      + `  ${result.nodes} nodes, ${ms.toFixed(0)}ms`,
    );
  }
  if (json) {
    console.log(JSON.stringify(results.filter((r) => r.solved).map((r) => ({ seed: r.seed, line: r.line })), null, 0));
  } else {
    const solved = results.filter((r) => r.solved).length;
    console.log(`\n${solved}/${results.length} solvable at draw ${draw} within ${nodes} nodes`);
  }
}
