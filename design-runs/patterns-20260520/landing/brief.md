# Landing dogfood brief

## Pattern

Landing page: first viewport offer, primary CTA, product media slot, and a
visible hint of the next section.

## Contract

- Viewport: 1440x960, DPR 1.
- Source of truth: hero hierarchy and CTA visibility, not exact media texture.
- H1: product/category name.
- Primary CTA must be visible in first viewport.
- Next section must be visible before the fold.
- Media slot must be replaceable by a real screenshot or generated bitmap.
- Use semantic HTML and CSS grid/flex only.

## Expected signal

`--goal app` should be useful, but the report also needs future CTA/hero gates.

