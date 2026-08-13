---
"@colibri-social/client": patch
---

The "Jump to latest" button now appears whenever you are scrolled away from the newest message, instead of only when you scroll up past a fixed point in the list. Opening a channel that lands you on an older message, whether from an unread marker, a notification, or a reply you followed, now shows the button straight away rather than leaving you to find your own way back down.

It also shows up in two places it never used to: when you are only a few messages from the end but still not at the bottom, and in short channels where a handful of tall messages with images can already fill more than a screen. Tapping it now clears the "New messages" divider in the same step, so it no longer lingers above you after the jump.

<!-- whatsnew
title: Jump to latest always finds you
icon: arrow-line-down-fill
body: The button now appears whenever you are scrolled away from the newest message, including when a channel opens on an older message from an unread marker or a notification.
platforms: all
kind: fix
-->
