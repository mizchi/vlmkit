# Creative brief — "Ember Spire" card-battle screen (S19, zero-shot, game UI)

There is NO reference design. Layout, palette, and typography are
yours — but the page must satisfy every requirement below and pass
the deterministic gates. All copy is quoted verbatim;
`s19-copy-manifest.txt` carries the same lines for
`check copy --manifest`. This scenario is a GAME screen: a
deck-builder battle in the genre of roguelike card games. Do not
imitate any existing game's art or text — the copy below is the spec.

The screen is an app shell: it fills the viewport and the page never
scrolls. All game state shown below is the INITIAL state; the
behaviors section defines how it changes. Real game logic is required
— the flow gate clicks through a scripted turn and asserts every
intermediate state.

## Screen layout (desktop, ≥900px)

1. **Top HUD bar**: hero name "The Wanderer", then "HP 70/80",
   "Gold 148", "Floor 3".
2. **Battlefield** (middle of the screen):
   - Left: the player — a simple CSS figure/silhouette (no external
     images), with a visible "Block 0" readout
     (`data-testid="block"`) and the player HP
     (`data-testid="player-hp"`, shows "70/80"; keep the top-bar HP
     in sync with it).
   - Right: the enemy "Gloom Warden" (`data-testid="enemy"`) — a
     distinct CSS figure, its HP bar with the text "44/44"
     (`data-testid="enemy-hp"`), and an intent line reading exactly
     "Attacks for 8".
3. **Energy orb** (left side above the hand): shows "Energy 3/3"
   (`data-testid="energy"`).
4. **Hand of 5 cards**, fanned along the bottom edge (slight rotation
   and overlap like a held hand of cards). Each card is a real
   `<button>` showing its name, its energy cost, and its rules text:
   | data-testid | name | cost | rules text |
   |---|---|---|---|
   | `card-cinder-strike` | Cinder Strike | 1 | Deal 6 damage. |
   | `card-ashen-guard` | Ashen Guard | 1 | Gain 5 Block. |
   | `card-kindle` | Kindle | 0 | Draw 1 card. |
   | `card-emberfall` | Emberfall | 2 | Deal 11 damage. |
   | `card-second-wind` | Second Wind | 1 | Heal 4 HP. |
   Despite the fan overlap, every card's name and rules text must be
   readable in the default state (no text sitting on top of a
   neighbouring card's text).
5. **Piles**: "Draw 12" and "Discard 4" (`data-testid="discard-count"`
   on the discard readout) in the lower corners.
6. **"End Turn" button** (`data-testid="end-turn"`), lower right.

Below 900px the layout may simplify (smaller cards, stacked HUD), but
integrity must stay clean at 768 and 375px — no overflow, no
collisions, nothing unreadable.

## Required game logic (this exact sequence is flow-gated)

- **Attack cards target the enemy**: clicking an attack card selects
  it (`aria-pressed="true"` on the card); clicking the enemy then
  plays it — enemy HP drops by the damage, energy drops by the cost,
  the card leaves the hand, and the discard count increments.
- **Skill cards play immediately on click** (no target): their effect
  applies, energy drops by the cost, the card leaves the hand, the
  discard count increments.
- **Energy gating**: a card whose cost exceeds current energy is
  unplayable — it carries `aria-disabled="true"` and clicking it
  changes nothing. This state must update live as energy changes.
- **End Turn**: the enemy attacks for its stated intent (8). Block
  absorbs damage first, then HP (Block 5 vs 8 ⇒ 3 damage). Block
  resets to 0 after the attack, energy refills to 3/3, and the hand
  refills to the same 5 cards. HP readouts update everywhere they
  appear.

Worked sequence the flow gate will run at 1280×800 (all numbers must
come out exactly like this):

1. Click Cinder Strike → card `aria-pressed="true"`.
2. Click the enemy → enemy HP "38/44", energy "2/3", discard "5".
3. Click Ashen Guard → Block "5", energy "1/3", discard "6", and
   Emberfall (cost 2 > energy 1) now `aria-disabled="true"`.
4. Click End Turn → player HP "67/80" (8 − 5 Block = 3 damage),
   Block "0", energy "3/3".

## Hard requirements

- Self-contained single HTML file (inline CSS/JS, no external
  requests, no images). JS runs without errors.
- No page-level scrolling at 1280, 768, or 375px — the game fits the
  viewport (a hand/log area may scroll internally if you need it).
- Use every copy line EXACTLY as written (casing, "HP 70/80" format,
  "Attacks for 8", card names and rules text, "End Turn").
- Every interactive element (cards, enemy target, End Turn) is a real
  `<button>` or has full keyboard operability — no clickable `<div>`s.
- Keep all `data-testid` attributes exactly as specified.

## Done condition (deterministic)

- `check integrity <attempt.html>` → verdict CLEAN (default 3
  viewports).
- `check copy <attempt.html> --manifest s19-copy-manifest.txt` →
  0 missing, 0 placeholders.
- `scan scroll <attempt.html>` → no `page-overflow-x` suspect.
- `scan handlers <attempt.html>` → no pointer-only-control suspects.
- `check interactions <attempt.html>` → no suspect issues.
- `verify flow <attempt.html> --flow s19-battle-flow.json` → PASS
  (every step green).
