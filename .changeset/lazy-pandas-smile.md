---
"@colibri-social/client": patch
---

Makes GIF favorites reachable on touch devices. The star on a GIF was only ever drawn on hover, so on a phone it never appeared and the Favorites tab could only be filled from a desktop. In the picker the star is now always visible on touch, with a tap target sized for a thumb, and pressing and holding a GIF toggles the favorite without sending it. GIFs already posted in a chat pick up a "Save GIF" entry in the message long-press menu, which avoids stacking a second hidden gesture onto the message row.

<!-- whatsnew
title: Save GIFs from your phone
icon: star-fill
body: The star on a GIF now shows up on touch, so you can build your favorites list without reaching for a desktop. Press and hold a GIF in the picker to save it, or use Save GIF in the message menu for one someone already posted.
kind: fix
-->
