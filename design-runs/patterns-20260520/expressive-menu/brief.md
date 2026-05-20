# Expressive menu dogfood brief

## Pattern

Original red / black / white poster-like menu. The visual surface can use
diagonal panels, overlapping stickers, and sharp cutouts, but it must not copy
an existing game logo, character art, iconography, or exact typography.

## Contract

- Viewport: 1440x900, DPR 1.
- Source of truth: semantic DOM plus composition metadata.
- Header, primary navigation, main task panel, and status region remain real
  landmarks / labelled regions.
- Menu items are real buttons with visible text.
- Selected and focus-visible states must be explicit.
- UI Contract `requiredStates` must include selected, hover, and focus-visible.
- Decorative slash panels, stickers, and cutouts live in a composition layer,
  separate from layout and content.
- High-contrast red / black / white palette is required.
- Contrast evidence should prefer rendered screenshot pixel sampling when text
  is painted over non-ancestor composition layers.

## Expected signal

`--goal expressive-menu --states hover focus-visible` should accept broad
landscape similarity while checking whether the current markup still has
semantic menu text, selected state, visible hover/focus changes, composition
markers, diagonal/layered evidence, and pixel-sampled high contrast.
