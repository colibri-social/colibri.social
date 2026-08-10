---
"@colibri-social/client": patch
---

Resizes the sign-in screen when the on-screen keyboard opens on phones. The screen lives outside the app shell, so it never picked up the shell's keyboard handling and the handle input ended up behind the keyboard. It now tracks the same visual viewport height and the same keyboard spring as the rest of the app.

<!-- whatsnew
title: This you?
icon: keyboard-fill
body: The sign-in screen now moves out of the way when the on-screen keyboard opens, so the handle field stays visible while you type.
kind: fix
-->
