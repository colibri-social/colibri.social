---
"@colibri-social/client": patch
---

Fixes voice calls silently breaking when something unrelated happened elsewhere in the app, e.g. switching to another app or device while on a call could make you vanish from the participant list and go unheard by everyone else, even though your own screen still showed you connected. Voice channel membership is now tracked from the actual voice connection instead of the general app connection, so it can no longer be knocked out by unrelated reconnects. Testing your microphone in Settings also no longer disconnects an active call on another device.

<!-- whatsnew
title: More reliable voice calls
icon: speaker-high-fill
body: Fixed a bug where activity elsewhere (like opening another device) could silently break your voice call without disconnecting you.
kind: fix
-->
