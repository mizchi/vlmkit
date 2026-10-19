# Activity: the feed entrance

`page.html` is an activity feed with four entries. On load the entries rise
16px and fade in, each over 320ms, easing out — ONE AFTER ANOTHER: the first
starts 200ms after load and each next one starts 80ms after the previous
(200, 280, 360, 440ms). After that they stay.

A reviewer says: "They all pop in together, like one block. It should cascade."

Fix it without changing the look of the feed at rest. The viewport is 1280x800.
