---
"@colibri-social/client": patch
---

Fix voice channels failing to connect in the macOS app. When voice setup does fail, the app now clears the "Connecting" state and shows an error instead of spinning forever, and reports the failure so it can be diagnosed.

<!-- whatsnew
title: MacOS voice channel issues
icon: speaker-high-fill
body: MacOS users rejoice! You can finally join voice channels again.
kind: fix
-->
