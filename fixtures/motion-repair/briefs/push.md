# The Ledger: the subscription notice

`page.html` is an article page. As it loads, a yellow notice slides down from
behind the dark top bar (300ms, slowing at the end) and stays there, pinned
just under the top bar and lying over the top of the article. The article
itself never moves: not while the notice arrives, and not after.

A reviewer says: "When the page opens the whole article lurches down. It
should slide in over the text, not shove it."

Fix it without changing how the top bar, the notice or the article look once
everything is still. The viewport is 1280x800.
