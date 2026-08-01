---
"@colibri-social/client": patch
---

Fixes channels showing stale messages when you open the app. Busy channels never saved their history at all, so reopening one could show a conversation from days ago until the network caught up, and a message someone deleted while you were reading elsewhere would come back from the dead. Saved history is now kept current in the background for every channel, not just the one you have open, and anything older than a day is no longer shown as if it were current. Messages also arrive much sooner after a reload: the first page is now requested as soon as you're signed in rather than after your profile and community have both finished loading, and anything posted while the app was still starting up no longer stays hidden until you click back into the window. A message you sent while a channel was still loading is no longer dropped from the list.

<!-- whatsnew
title: Faster, fresher messages
icon: rewind-fill
body: Channels now load up-to-date messages much sooner, and no longer show conversations that have fallen behind.
kind: fix
-->
