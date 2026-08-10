---
"@colibri-social/client": patch
---

Fixes pasted images being attached twice. The browser exposes a clipboard image through two clipboard APIs at once, and the composer collected it from both, so a single paste produced two identical attachment chips. The extractor now recognizes the second copy and keeps only one file per pasted image.

<!-- whatsnew
title: Pasted images attach once
icon: image-fill
body: Pasting a screenshot or copied image into the message box added it twice. Now it lands as a single attachment, the way you would expect.
kind: fix
-->
