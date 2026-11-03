# Search: results coming in

`page.html` is a results page. When it loads, the four results come in one
after another, from the top. Each one fades in while rising 16px into its place
over 400ms, slowing at the end, and each next one starts 80ms after the one
above. About two thirds of a second after load every result is in place and fully shown.

The page uses a shared boot utility. It holds every animation until the web
fonts are loaded, so that nothing animates in a fallback face, and then
releases them. That behaviour has to stay.

A reviewer says: "The results never show up. The page is blank under the
heading."

The viewport is 1280x800.
