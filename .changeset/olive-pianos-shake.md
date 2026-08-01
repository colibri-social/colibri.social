---
"@colibri-social/client": patch
---

Fixes channels showing stale messages when you open the app. Busy channels never saved their history at all, so reopening one could show a conversation from days ago until the network caught up, and a message someone deleted while you were reading elsewhere would come back from the dead. Saved history is now kept current in the background for every channel, not just the one you have open, and anything older than a day is no longer shown as if it were current.

<!-- whatsnew
title: Faster, fresher messages
icon: rewind-fill
body: Channels now load up-to-date messages much sooner, and no longer show conversations that have fallen behind.
kind: fix
-->
