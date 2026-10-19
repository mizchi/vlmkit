# Settings: the "Settings saved" toast

`page.html` is a settings form. On load a green "Settings saved" toast should:

1. 300ms after load, slide in from off-screen right to its place at the
   bottom-right corner over 360ms, DECELERATING (ease-out: fast at first,
   settling gently);
2. stay fully visible in place until 2660ms;
3. then fade out over 300ms and stay gone.

A reviewer says: "It flies in and then vanishes straight away, and the slide
feels like it's accelerating into a wall."

Fix the page so the toast does exactly what is listed. Keep its look (colour,
size, corner position). The viewport is 1280x800.
