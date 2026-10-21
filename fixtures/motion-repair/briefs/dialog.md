# Project settings: the "Delete project" confirmation

`page.html` is a project settings page. Clicking "Delete project" dims the page
and opens a confirmation dialog in the middle of the screen. The dialog arrives
over 200ms, fading in while it grows a touch from 96% to its full size, and it
stays dead centre the whole time: only its size and its opacity change.

A reviewer says: "The dialog shows up off to the lower right, then jumps into
the middle when the animation finishes."

Fix it without changing where the dialog sits or how it looks once it is open.
The viewport is 1280x800.
