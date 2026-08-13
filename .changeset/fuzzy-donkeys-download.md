---
"@colibri-social/client": patch
---

File attachments now download instead of opening in your browser. A text file, a JSON file or an SVG used to be handed straight to the browser, which rendered it inline rather than saving it, and in the desktop and mobile apps it opened in an external browser tab instead. Every download button now saves the file under the name it was uploaded with, on web, desktop and mobile alike.

Images gained download buttons where there were none. Previously only a single attached image had one, so an image posted as part of a set of several could not be saved at all. Every image in a gallery now reveals its own download button on hover, and the fullscreen viewer has one too, which is the way to save an image on a touch screen.

<!-- whatsnew
title: Attachments actually download
icon: download-simple-fill
body: Text files, documents and images now save to your device under their original filename instead of opening in a browser tab.
platforms: all
kind: fix
-->
