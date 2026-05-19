# Blog design brief

## Content

- Blog name: Memory Atlas
- Purpose: personal technical blog for long-form engineering notes
- Audience: developers who scan archives and read detailed posts
- Required sections:
  - header with blog name and simple nav
  - intro / editorial hero
  - featured article
  - recent article list
  - topic filters or archive rail
  - newsletter / RSS subscription

## Visual constraints

- Build an actual usable blog homepage, not a marketing landing page.
- Prioritize reading, scanning, archive navigation, and calm hierarchy.
- Support Japanese and English typography.
- Cards are allowed only for repeated article items or the featured article.
- Avoid decorative gradient blobs, fake browser chrome, and oversized hero imagery.
- Use restrained colors, strong typography, and clear spacing.

## Typography feasibility

- Use web-standard typography that can be approximated with Georgia/system serif
  and system-ui/Inter-like sans.
- Do not require custom display fonts, rasterized logo text, hand lettering, or
  font weights that are unavailable in normal CSS.
- Keep heading/body/meta scale plausible across desktop and mobile so real HTML
  text wraps into similar card heights.

## Implementation feasibility

- Every visible region should map to semantic HTML landmarks and CSS grid/flex.
- Use explicit min/max width constraints for liquid regions.
- Treat illustration/detail areas as simple SVG or replaceable media slots.
- Avoid visual effects that depend on image-only text, complex textures, or
  nonstandard browser features.

## Deliverables

- Desktop mock target: landscape
- Mobile mock target: portrait
- Final implementation: semantic HTML + responsive CSS
