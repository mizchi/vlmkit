/**
 * Plays the game. All the way, through the real UI, with the table audited after every move.
 *
 * This exists because nothing else proved the game WORKS. `rules.test.mjs` proves each rule in
 * isolation, `game.test.mjs` proves each gesture in isolation, and its win test says so out loud:
 * "Rigged rather than played" — it assigns a finished `state` and clicks Auto-finish, because a
 * real win is ~80 moves. So a solitaire that is unwinnable, or that desynchronises its DOM from
 * its state on move 40, or that loses a card, passed all 55 tests.
 *
 * What it does per move:
 *   1. asks the page for the legal moves (the page's own rules, not a second copy here),
 *   2. picks one with a documented heuristic,
 *   3. plays it through `commit`/`drawFromStock` — the same functions the drag, keyboard and
 *      double-click handlers call, so the render path is the real one,
 *   4. AUDITS: 52 distinct cards exactly once across all zones, every face-up tableau sequence a
 *      legal descending alternating run, every foundation ascending in one suit, and one `.card`
 *      node per card in each pile — the DOM against the state, which is the desync class of bug.
 *
 * Usage:
 *   node examples/solitaire/playthrough.mjs                 # 25 seeds, draw 1
 *   node examples/solitaire/playthrough.mjs --seeds 100 --draw 3 --verbose
 *   node examples/solitaire/playthrough.mjs --seed 7 --gestures   # play seed 7 by real gestures
 *
 * `--gestures` swaps step 3 for an actual `page.dragAndDrop` per move: it proves the drag handlers
 * reach `commit`, not just that `commit` works. Measured on seed 1 — a full 144-ply win takes 14s
 * with real drags against 8s without, so there is no reason to prefer the cheap path. Dragging
 * only; the double-click and keyboard paths have their own cases in `game.test.mjs`.
 */
import { chromium } from "playwright";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { solve } from "./solve.mjs";
import { AUDIT } from "./audit.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const PAGE_URL = `file://${resolve(here, "index.html")}`;

function parseArgs(argv) {
  const flag = (name, fallback) => {
    const i = argv.indexOf(name);
    return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : fallback;
  };
  const single = argv.indexOf("--seed") >= 0 ? Number(flag("--seed")) : null;
  return {
    seeds: single !== null ? [single] : Array.from({ length: Number(flag("--seeds", 25)) }, (_, i) => i + 1),
    draw: Number(flag("--draw", 1)),
    maxMoves: Number(flag("--max-moves", 600)),
    nodes: Number(flag("--nodes", 400000)),
    verbose: argv.includes("--verbose"),
    trace: argv.includes("--trace"),
    solve: argv.includes("--solve"),
    animate: argv.includes("--animate"),
    gestures: argv.includes("--gestures"),
  };
}


/**
 * The legal moves available right now, asked of the PAGE's rules so this file holds no second
 * copy of them — a solver with its own idea of the rules proves nothing about the game.
 *
 * Each move carries the facts the heuristic needs, so the ranking below is plain data handling.
 */
const LEGAL_MOVES = `(() => {
  const s = window.solitaire.state;
  const K = window.Klondike;
  const moves = [];
  const topOf = (p) => p[p.length - 1];

  const add = (from, to, extra) => moves.push(Object.assign({ from, to }, extra));

  // Tableau → foundation / tableau, for every liftable run.
  s.tableau.forEach((pile, i) => {
    for (let n = 0; n < pile.length; n++) {
      if (!pile[n].faceUp || !K.isMovableRun(pile, n)) continue;
      const from = { zone: "tableau", index: i, cardIndex: n };
      const runLength = pile.length - n;
      // Uncovering matters: it is the only way to make progress on a blocked column.
      const uncovers = n > 0 && !pile[n - 1].faceUp;
      const emptiesColumn = n === 0;
      for (let f = 0; f < 4; f++) {
        if (runLength === 1 && K.canMove(s, from, { zone: "foundation", index: f })) {
          add(from, { zone: "foundation", index: f }, { kind: "toFoundation", uncovers, emptiesColumn, runLength, rank: pile[n].rank });
        }
      }
      s.tableau.forEach((_, j) => {
        if (j === i) return;
        if (K.canMove(s, from, { zone: "tableau", index: j })) {
          add(from, { zone: "tableau", index: j }, {
            kind: "tableauToTableau", uncovers, emptiesColumn, runLength,
            rank: pile[n].rank, toEmpty: s.tableau[j].length === 0,
          });
        }
      });
    }
  });

  // Waste → anywhere.
  if (s.waste.length > 0) {
    const from = { zone: "waste", index: 0 };
    const card = topOf(s.waste);
    for (let f = 0; f < 4; f++) {
      if (K.canMove(s, from, { zone: "foundation", index: f })) {
        add(from, { zone: "foundation", index: f }, { kind: "wasteToFoundation", uncovers: false, emptiesColumn: false, runLength: 1, rank: card.rank });
      }
    }
    s.tableau.forEach((_, j) => {
      if (K.canMove(s, from, { zone: "tableau", index: j })) {
        add(from, { zone: "tableau", index: j }, {
          kind: "wasteToTableau", uncovers: false, emptiesColumn: false, runLength: 1,
          rank: card.rank, toEmpty: s.tableau[j].length === 0,
        });
      }
    });
  }

  return {
    moves,
    canDraw: s.stock.length > 0 || s.waste.length > 0,
    stock: s.stock.length,
    waste: s.waste.length,
    placed: s.foundations.reduce((n, p) => n + p.length, 0),
    faceDown: s.tableau.reduce((n, p) => n + p.filter((c) => !c.faceUp).length, 0),
  };
})()`;

/**
 * Which move to play. Ordinary Klondike heuristics, in the order a decent human uses them.
 *
 * Not a solver: it does not search, so it loses games a search would win. That is fine for the
 * question being asked — "can this game be played and won at all" — and the win rate it reports
 * is a floor, not the game's difficulty.
 */
function scoreMove(m) {
  let s = 0;
  if (m.uncovers) s += 100;                        // turning a card up is the scarce resource
  if (m.kind === "toFoundation" || m.kind === "wasteToFoundation") s += 40;
  if (m.kind === "wasteToTableau") s += 25;        // drains the waste, which otherwise clogs
  if (m.toEmpty && m.rank === 13) s += 30;         // a King into a hole is real progress
  if (m.emptiesColumn && !m.toEmpty) s -= 60;      // moving a whole column off its slot rarely helps
  s += m.runLength;                                // bigger runs first, tie-break
  return s;
}

/**
 * Is this move worth playing at all?
 *
 * Tableau→tableau moves that neither uncover a card nor fill an empty column with a King are the
 * fuel a loop runs on: legal, reversible, and endless. The first version of this harness played
 * them and spent 116 moves oscillating with 9 cards placed. Excluding them is what a human does
 * without thinking about it.
 */
function isProductive(m) {
  if (m.kind !== "tableauToTableau") return true;
  if (m.uncovers) return true;
  if (m.toEmpty) return m.rank === 13;
  return false;
}

function pickMove(moves) {
  const useful = moves.filter(isProductive);
  if (useful.length === 0) return null;
  return useful.slice().sort((a, b) => scoreMove(b) - scoreMove(a))[0];
}

const moveKey = (m) =>
  `${m.from.zone}${m.from.index}:${m.from.cardIndex ?? ""}->${m.to.zone}${m.to.index}`;

/** A signature of the whole table, to detect a loop of legal-but-pointless moves. */
const STATE_KEY = `(() => {
  const s = window.solitaire.state;
  const pile = (p) => p.map((c) => (c.faceUp ? "" : "-") + c.id).join(",");
  return [s.tableau.map(pile).join("|"), s.foundations.map(pile).join("|"), pile(s.waste), s.stock.length].join("/");
})()`;

/**
 * Replays a searched winning line through the real UI, and requires the page to SHOW the win.
 *
 * This is the mode that answers "does the game work" without qualification. The greedy player
 * below cannot win — greedy Klondike players do not — so on its own it can only ever report "no
 * bug found", which is not the same statement. A searched line played through `commit` and the
 * stock button, audited after every one of ~150 plies, ending with the banner visible and the
 * cascade running, is the difference.
 *
 * The line comes from `solve.mjs`, which searches against the same `rules.js` the page loads. So
 * a disagreement between the two is itself a finding: the search said this line wins and the page
 * refused a move in it, or played it all and did not call it a win.
 */
async function replaySolvedLine(browser, seed, options) {
  const solution = solve(seed, { draw: options.draw, nodes: options.nodes });
  if (!solution.solved) return { seed, outcome: "UNSOLVED", reason: solution.reason, nodes: solution.nodes };

  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

  /*
   * `animate=0` by default so ~150 plies do not each wait out a 200ms tween, and `--animate` to
   * play the same line with motion on. The distinction matters at exactly one point: the victory
   * cascade only exists with animation, and `game.test.mjs` learned that the hard way — its first
   * version opened with `animate=0` like every other test and found nothing bouncing.
   */
  const animate = options.animate ? "" : "&animate=0";
  await page.goto(`${PAGE_URL}?seed=${seed}&draw=${options.draw}${animate}`);
  await page.waitForFunction(() => document.body.dataset.dealComplete === "true");

  let ply = 0;
  for (const step of solution.line) {
    ply++;
    if (step.draw) {
      await page.click("#stock");
    } else {
      const ok = options.gestures
        ? await playByGesture(page, step)
        : await page.evaluate(
            ([from, to]) => window.solitaire.commit(from, to),
            [step.from, step.to],
          );
      if (!ok) {
        await page.close();
        return {
          seed, outcome: "BROKEN", at: `ply ${ply} of a solved line`, errors,
          problems: [
          `the search played ${step.from.zone}${step.from.index}:${step.from.cardIndex ?? ""}`
          + ` -> ${step.to.zone}${step.to.index} and the page`
          + `${options.gestures ? " did not apply it from a real drag" : " refused it"}`,
        ],
        };
      }
    }
    const problems = await page.evaluate(AUDIT);
    if (problems.length > 0) {
      await page.close();
      return { seed, outcome: "BROKEN", at: `ply ${ply} of a solved line`, problems, errors };
    }
  }

  const final = await page.evaluate(() => ({
    won: window.solitaire.isWon(),
    placed: window.solitaire.state.foundations.reduce((n, p) => n + p.length, 0),
    moves: window.solitaire.state.moves,
    bannerHidden: document.getElementById("win-banner").hasAttribute("hidden"),
    bannerText: document.getElementById("win-banner").textContent,
    announced: document.getElementById("announcer").textContent,
  }));

  const problems = [];
  if (!final.won) problems.push(`the search's line ended and isWon() is false at ${final.placed}/52`);
  if (final.bannerHidden) problems.push("the game is won and the win banner is still hidden");
  if (final.bannerText.trim() !== "You win.") problems.push(`the banner reads "${final.bannerText}"`);
  if (!/You win/.test(final.announced)) problems.push(`the win was not announced (live region says "${final.announced}")`);
  // The cascade, only when it can exist. The rigged win test asserts this too; the point of
  // asserting it here is that this win was PLAYED, so the celebrate() path was reached the way a
  // player reaches it rather than by assigning a finished state.
  if (options.animate) {
    const bouncing = await page.locator(".card.bouncing").count();
    if (bouncing === 0) problems.push("the game was won with animation on and no card is bouncing");
  }
  if (problems.length > 0) {
    await page.close();
    return { seed, outcome: "BROKEN", at: "the win", problems, errors };
  }

  await page.close();
  return { seed, outcome: "WON", placed: final.placed, moves: final.moves, plies: solution.line.length, nodes: solution.nodes, errors };
}

async function playSeed(browser, seed, options) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

  await page.goto(`${PAGE_URL}?seed=${seed}&draw=${options.draw}&animate=0`);
  await page.waitForFunction(() => document.body.dataset.dealComplete === "true");

  const audit = async (label) => {
    const problems = await page.evaluate(AUDIT);
    if (problems.length > 0) {
      return { seed, outcome: "BROKEN", at: label, problems, errors };
    }
    return null;
  };

  const first = await audit("the opening deal");
  if (first) { await page.close(); return first; }

  /*
   * `tried` holds "this exact move, from this exact table" — not just visited states.
   *
   * Banning a repeated STATE was the first attempt and it deadlocks: a state recurs legitimately
   * after a lap of the stock, and refusing to act there throws away the only productive move.
   * Banning a repeated (state, move) pair kills the 2-cycles and most longer ones while leaving
   * every state playable by some other move.
   */
  const tried = new Set();
  let moves = 0;
  let sinceProgress = 0;
  // `-Infinity`, not 0 or -1: progress starts at `placed - faceDown`, which on a fresh deal is
  // 0 - 21 = -21. Seeded at -1 the first comparison never fired, so the "no progress" counter ran
  // from move 1 and every game reported STUCK at exactly 81 moves. A sentinel that happens to be
  // inside the value's real range is not a sentinel.
  let bestProgress = -Infinity;

  while (moves < options.maxMoves) {
    const { moves: legal, canDraw, placed, faceDown } = await page.evaluate(LEGAL_MOVES);
    if (placed === 52) break;

    // Progress is cards placed AND cards turned up: a run of moves that uncovers the tableau
    // without placing anything is progress, and the first version bailed on it.
    const progress = placed - faceDown;
    if (progress > bestProgress) { bestProgress = progress; sinceProgress = 0; }
    else if (sinceProgress++ > 80) break;

    const key = await page.evaluate(STATE_KEY);
    const fresh = legal.filter((m) => !tried.has(`${key}|${moveKey(m)}`));
    const choice = pickMove(fresh);
    if (choice) tried.add(`${key}|${moveKey(choice)}`);

    if (choice) {
      const ok = options.gestures
        ? await playByGesture(page, choice)
        : await page.evaluate(
            ([from, to]) => window.solitaire.commit(from, to),
            [choice.from, choice.to],
          );
      if (options.trace) {
        console.log(`    ${String(moves + 1).padStart(3)} ${choice.kind} ${moveKey(choice)}`
          + `${choice.uncovers ? " (uncovers)" : ""} placed=${placed} faceDown=${faceDown}`);
      }
      if (!ok) {
        await page.close();
        return {
          seed, outcome: "BROKEN", at: `move ${moves + 1}`, errors,
          problems: [`the page listed ${moveKey(choice)} as legal and then refused it`],
        };
      }
      moves++;
    } else if (canDraw) {
      /*
       * Nothing to play (or a loop): turn the stock over, BY CLICKING THE STOCK.
       *
       * Not `window.solitaire.deal()`. That name cost a debugging session: `deal(seed, drawCount)`
       * starts a NEW GAME — it is what the "New game" button calls — so this branch silently reset
       * the table on every pass, the move counter kept reading 0, and the harness reported eight
       * seeds "STUCK at 0/52 in 0 moves". The debug surface exposes no draw at all, so the click
       * is the only route, and it is the better one anyway: it exercises the real handler.
       * The export is `newGame` now, for the next person holding this end of it.
       */
      await page.click("#stock");
      if (options.trace) {
        const w = await page.evaluate(() => window.solitaire.state.waste.at(-1)?.id ?? "(recycled)");
        console.log(`    ${String(moves + 1).padStart(3)} draw -> ${w}  placed=${placed} faceDown=${faceDown} legal=${legal.length} fresh=${fresh.length}`);
      }
      moves++;
    } else {
      break;
    }

    const problem = await audit(`move ${moves}`);
    if (problem) { await page.close(); return problem; }
  }

  const final = await page.evaluate(() => ({
    won: window.solitaire.isWon(),
    placed: window.solitaire.state.foundations.reduce((n, p) => n + p.length, 0),
    moves: window.solitaire.state.moves,
    bannerHidden: document.getElementById("win-banner").hasAttribute("hidden"),
    announced: document.getElementById("announcer").textContent,
  }));

  // A win must SHOW as a win. `isWon()` true with the banner still hidden is the exact defect
  // this harness exists to catch: the model finished and the screen did not say so.
  if (final.won && final.bannerHidden) {
    await page.close();
    return {
      seed, outcome: "BROKEN", at: "the win", errors,
      problems: ["every card is on a foundation and the win banner is still hidden"],
    };
  }

  await page.close();
  return {
    seed,
    outcome: final.won ? "WON" : "STUCK",
    placed: final.placed,
    moves: final.moves,
    errors,
  };
}

/**
 * Plays one move through a real drag rather than through `commit`.
 *
 * The point is the handlers: a `dragAndDrop` that never reaches `commit` is a broken game that a
 * `commit`-driven playthrough would call healthy.
 *
 * **Grab the exposed strip, not the middle of the card.** A fanned tableau card shows only its
 * top `--fan-up` (1.55rem); the rest is under the next card, which has a higher z-index. Dragging
 * at the element's centre — Playwright's default — presses whatever is lying ON it, so the drag
 * starts from the wrong card and the move that lands is not the move that was asked for. The first
 * version of this function did exactly that and reported the PAGE as broken on move 3: "listed
 * tableau5:5->tableau2 as legal and then refused it". The page was right and the harness was
 * clicking through a card. A player aims at the strip they can see, and so does this.
 */
async function playByGesture(page, choice) {
  const before = await page.evaluate(() => window.solitaire.state.moves);
  const source = await page.evaluate(([from]) => {
    const node = from.zone === "waste"
      ? document.querySelectorAll("#waste .card")[document.querySelectorAll("#waste .card").length - 1]
      : document.querySelectorAll("#tableau .slot")[from.index]?.querySelectorAll(".card")[from.cardIndex];
    if (!node) return null;
    node.setAttribute("data-play-source", "1");
    const box = node.getBoundingClientRect();
    // The strip this card actually exposes: from its own top down to the next card's top, or its
    // full height when nothing covers it.
    const next = node.nextElementSibling;
    const covered = next ? next.getBoundingClientRect().top - box.top : box.height;
    return { width: box.width, exposed: Math.max(6, Math.min(covered, box.height)) };
  }, [choice.from]);
  if (!source) return false;

  const targetSelector = choice.to.zone === "foundation"
    ? `#foundations .slot:nth-of-type(${choice.to.index + 1})`
    : `#tableau .slot:nth-of-type(${choice.to.index + 1})`;

  await page.dragAndDrop("[data-play-source]", targetSelector, {
    // Half way down the exposed strip, horizontally centred — where a thumb would land.
    sourcePosition: { x: Math.round(source.width / 2), y: Math.round(source.exposed / 2) },
    // The top of the target pile: a tableau slot is as tall as a seven-card fan, and its centre
    // is empty felt below the cards. That still hits the slot, but aiming at the card the run is
    // being stacked on is what a player does and what the highlight follows.
    targetPosition: { x: 26, y: 14 },
  }).catch(() => {});
  await page.evaluate(() => {
    document.querySelectorAll("[data-play-source]").forEach((n) => n.removeAttribute("data-play-source"));
  });
  return (await page.evaluate(() => window.solitaire.state.moves)) > before;
}

const options = parseArgs(process.argv.slice(2));
const browser = await chromium.launch();
const results = [];
for (const seed of options.seeds) {
  const result = options.solve
    ? await replaySolvedLine(browser, seed, options)
    : await playSeed(browser, seed, options);
  results.push(result);
  if (options.verbose || result.outcome === "BROKEN") {
    const detail = result.outcome === "BROKEN"
      ? `at ${result.at}\n      ${result.problems.join("\n      ")}`
      : result.outcome === "UNSOLVED"
        ? `no line found (${result.reason}, ${result.nodes} nodes)`
        : `${result.placed}/52 in ${result.moves} moves`
          + (result.plies ? ` (searched line: ${result.plies} plies, ${result.nodes} nodes)` : "");
    console.log(`  seed ${String(seed).padStart(3)}  ${result.outcome.padEnd(6)} ${detail}`);
  }
  if (result.errors?.length) console.log(`  seed ${seed} console errors: ${result.errors.join(" | ")}`);
}
await browser.close();

const count = (outcome) => results.filter((r) => r.outcome === outcome).length;
const won = count("WON");
const broken = results.filter((r) => r.outcome === "BROKEN");
const placedAvg = results.filter((r) => r.placed !== undefined)
  .reduce((s, r, _, a) => s + r.placed / a.length, 0);

console.log(`\n${results.length} seed(s), draw ${options.draw}${options.gestures ? ", real gestures" : ""}`);
console.log(`  won    ${won}`);
console.log(`  stuck  ${count("STUCK")}   (average ${placedAvg.toFixed(1)}/52 placed)`);
console.log(`  broken ${broken.length}`);
if (broken.length > 0) {
  console.log(`\nThe game is broken on seed(s): ${broken.map((r) => r.seed).join(", ")}`);
  process.exit(1);
}
const unsolved = results.filter((r) => r.outcome === "UNSOLVED");
if (options.solve && unsolved.length === results.length) {
  /*
   * Every seed unsolved is a different statement from "played and lost", and conflating them
   * misreports the cause. Found by injecting bugs: breaking `canStackOnTableau` in `rules.js`
   * made the SEARCH fail too — it loads the same rules — so no line was ever played and the old
   * message claimed "a searched winning line did not reach a win", which was not what happened.
   * A rules-level bug shows up here; the audit catches it in greedy mode, where no search is
   * involved and the moves get played.
   */
  console.log(`\nNo winning line was found for any seed. Either the node budget is too small`);
  console.log(`(raise --nodes) or the rules themselves are broken — run without --solve, where the`);
  console.log(`audit plays real moves and reports what is actually wrong.`);
  process.exit(1);
}
if (won === 0 && options.solve) {
  // A searched line that the page did not finish IS a page defect.
  console.log(`\nA searched winning line did not reach a win in the page. That is a real defect.`);
  process.exit(1);
}
if (won === 0) {
  // In greedy mode it is not. A greedy Klondike player loses most deals — that is the game, not a
  // bug — so the exit code reflects the audit, which is what this mode actually tests. An earlier
  // version exited 1 here and made a working harness read as a broken game.
  console.log(`\nNo win, which is expected: the greedy player does not search. What this mode proves is`);
  console.log(`the audit — ${results.reduce((n, r) => n + (r.moves ?? 0), 0)} moves with no lost card, no illegal stack, and no`);
  console.log(`DOM/state disagreement. For winnability, use --solve.`);
}
