# A confirm dialog

A project page with a red `button.delete` labelled "Delete project", 40px from the left and 40px
from the top. Clicking it asks for confirmation:

- `div.backdrop`, covering the whole viewport, fades from transparent to 50% opacity black over
  200ms at a constant rate, starting at the click.
- `div.dialog`, 400x220, white, centred in the viewport, with a short question and a
  `button.cancel`, appears 50ms after the click: over 250ms it rises into its place from 24px
  below it and grows from 95% of its size to its full size while it fades in, slowing as it
  arrives (ease-out).

Clicking Cancel closes it: the dialog and the backdrop fade out together over 150ms. Once closed,
nothing of them is on screen and the Delete button can be clicked again: nothing invisible is left
over it. Only transform and opacity animate. Nothing else on the page moves.

Write the whole page yourself as one file, `page.html` (CSS in a `<style>`; script only where this brief needs one). The viewport is 1280x800. Use the class names given here exactly: the page is checked through them. Animate with CSS transitions or animations (or the Web Animations API), never a `requestAnimationFrame` loop or a timer that moves things, and a delay is an animation or transition delay, not a timer.
