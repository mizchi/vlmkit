# Responsive stretch dogfood brief

## Pattern

Responsive stretch stress: a content-heavy marketing/product screen that must
look intentional from mobile to very wide desktop.

## Contract

- Viewports: 390x844, 768x900, 1440x900, 1920x1080, DPR 1.
- Source of truth: fluid bounds, readable measure, card sizing, media aspect,
  and absence of accidental horizontal scroll.
- Main container should stay bounded on wide screens instead of stretching to
  the viewport edge.
- Hero copy should keep a readable line length.
- Cards should wrap into useful columns and not become oversized tiles.
- Media region should preserve aspect ratio.
- Mobile should stack content without overflow.

## Expected signal

The scenario is not about pixel-perfect reproduction. It checks whether a
layout remains visually sane when stretched across widths. A pass means the
implementation preserves min/max width intent, stable aspect ratios, and
semantic order across responsive breakpoints.
