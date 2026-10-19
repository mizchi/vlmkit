# Files: the folder drawer

`page.html` is a file browser. On load the whole page fades in over 300ms, and
then, starting 400ms after load, the dark folder drawer on the left slides in
from off-screen over 380ms, decelerating (ease-out). After that the drawer and
the file list stay on screen.

A reviewer says: "I get a completely blank page. Nothing ever shows up."

Fix the page so it does what is described, without changing its look once it
has loaded. The viewport is 1280x800.
