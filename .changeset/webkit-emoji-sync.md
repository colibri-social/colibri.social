---
"@colibri-social/ui": patch
---

Keep animated GIF and APNG custom emoji in sync on WebKit by decoding them with `gifuct-js` and `upng-js` when `ImageDecoder` is missing, and log emoji fetch and decode failures
