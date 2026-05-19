# Game canvas dogfood brief

## Pattern

Canvas game: the screenshot is art direction, not the full contract.

## Contract

- Viewport: 1280x720, DPR 1.
- Source of truth: canvas frame, HUD readability, input response, and frame delta.
- DOM landmarks describe only the outer shell.
- The game state should expose a testable `window.__gameState`.
- Arrow keys should change player state.

## Expected signal

`build component` can compare the initial frame but cannot prove interaction.
The dogfood script checks canvas nonblank, frame delta, and input response.

