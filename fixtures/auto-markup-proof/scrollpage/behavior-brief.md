# Behavior brief — Atlas field guides page

- The top bar sticks to the top of the viewport while the page scrolls
  (`position: sticky`, offset 0). It must still be fully visible after
  scrolling to the article section.
- The "Latest guides" rail scrolls horizontally with **mandatory
  x-axis scroll snapping**; each card snaps to the rail's left edge
  (snap-align start). Cards are 380px wide, so the rail overflows at
  the 1280px design width — that overflow is intentional and is the
  scrollport.
- The circular "↑" button is **fixed** to the bottom-right corner
  (26px margins) and must not move while the page scrolls.
- No CSS animations anywhere on the page. No vertical scroll
  containers other than the page itself.
