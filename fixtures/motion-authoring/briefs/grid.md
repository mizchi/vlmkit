# Tiles that appear from the centre

A gallery of nine square tiles, `div.tile`, each 120x120, in a 3x3 grid with 16px between them, the
grid's top left corner 40px from the left and 40px from the top. Give the tiles different colours.
In the document they come row by row, left to right.

When the page opens the tiles appear from the centre outwards. Each tile fades in and grows from
80% to its full size over 300ms, slowing as it finishes (ease-out), growing about its own centre so
it never leaves its place in the grid. The centre tile begins at once; the four tiles beside it
(above, below, left and right) begin 100ms after the page opens; the four corner tiles begin at
200ms. Until it begins, a tile is not seen. Once all have appeared, every tile is fully shown,
full size, in its grid place.

Write the whole page yourself as one file, `page.html` (CSS in a `<style>`; script only where this brief needs one). The viewport is 1280x800. Use the class names given here exactly: the page is checked through them. Animate with CSS transitions or animations (or the Web Animations API), never a `requestAnimationFrame` loop or a timer that moves things, and a delay is an animation or transition delay, not a timer.
