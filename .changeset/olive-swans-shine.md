---
"@colibri-social/client": patch
---

Fixes phantom ping badges. Opening a channel that only had unread messages turned the white unread dot into a red ping badge, and marking the channel as read could not clear it. The client now only applies ping arithmetic to mention and reply notifications instead of every unseen message, and never increments a count it did not decrement. Marking a channel, category, or community as read also resyncs the badge from the server, so a stale count can always be cleared without reloading. The "message that caused this ping has been deleted" banner no longer appears for ordinary unread messages.

<!-- whatsnew
title: Ping Badge Fixes
icon: bell-ringing-fill
body: Channels no longer show a red ping badge for ordinary unread messages, and marking a channel as read reliably clears it.
kind: fix
-->
