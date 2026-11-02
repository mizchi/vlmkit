# Overview: the stat tiles

`page.html` is a dashboard overview with four stat tiles in a row (Visitors,
Sign-ups, Revenue, Churn). On load they lift in like a wave travelling across
the row in reading order: Visitors first, at 240ms, then each neighbour to its
right a beat later — 60ms after the one before it. Each lift takes 300ms and
decelerates. After that they stay put.

A reviewer says: "The wave goes the wrong way. It starts from Churn."

Fix it without changing how the tiles look once loaded. The viewport is
1280x800.
