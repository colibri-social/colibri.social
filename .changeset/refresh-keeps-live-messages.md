---
"@colibri-social/app": patch
---

Keep messages that arrive live while a channel refreshes in the background. A message from someone whose clock runs behind yours could vanish from the list until the app restarted.

Load the full message after a notification brings in one the channel missed. The channel shows the notification's copy first, then swaps in the server's version, so videos and other attachments appear without a restart.
