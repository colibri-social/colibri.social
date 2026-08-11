---
"@colibri-social/client": patch
---

Fixes the sign-in screen not resizing with the on-screen keyboard on Android. The viewport height accessor only subscribed to the visual viewport, which Android never resizes for the keyboard because the window is edge to edge. Consumers now also track the native keyboard inset, so the sign-in screen, the handle typeahead and the channel scroll anchor follow the keyboard on Android the same way they already did on iOS.

<!-- whatsnew
title: Keyboards on Android
icon: keyboard-fill
body: The sign-in screen now moves out of the way when the keyboard opens, for real this time.
kind: fix
-->
