# Orders: the Filters menu

`page.html` is an orders list. Clicking "Filters" unfolds the menu downwards
from under the button (300ms, slowing at the end, fading in as it goes), and
clicking it again folds it back up the same way.

People click twice quickly, so the menu must cope with a change of mind: if
"Filters" is clicked again while the menu is still unfolding, the menu folds
back up from wherever it has got to. It never first jumps to fully open.

A reviewer says: "If I click Filters twice fast, the menu flashes fully open
and then closes."

Fix it without changing how the menu looks fully open or fully closed. The
viewport is 1280x800.
