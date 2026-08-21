---
"@colibri-social/client": patch
---

An expired session now takes you straight to the sign-in screen instead of parking you on a dead-end panel with a button.
A dead session is difficult to reproduce, so every build now installs `window.__colibriSession` with `expire()`, `fail()`, `signOut()` and `state()` for driving the flow from the devtools console.

<!-- whatsnew
title: Straight back to sign-in
icon: sign-in-fill
platforms: all
kind: fix
body: When your session runs out you now land on the sign-in screen right away, instead of on a screen asking you to press a button first.
-->
