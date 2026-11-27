---
"@colibri-social/app": patch
"@colibri-social/ui": patch
---

Fix several issues from tester feedback:

- Dragging an image in the lightbox with a mouse drags the image itself, so you can drop it into another app. Mouse drags no longer switch to the next or previous image.
- The "Jump to bottom" card shows up once you're more than five screens from the bottom and hides once you're within one and a half. On mobile it's as wide as the message box, keeps the same gap to the screen edges and the message box, and wraps its text to two lines.
- Notification settings have a separate volume for the notification ping, join and leave sounds, mute and deafen sounds, and camera and screen share sounds. The ping starts at 50% and the others at 100%, or at your earlier sound effects volume if you changed it.
- A Space no longer shows as unread because of a channel you muted.
- Mentions in the channel you're looking at clear right away, and reading a channel clears its mention count and notifications.
- The emoji and GIF panel opens at full height on mobile browsers.
- Your own camera and screen share always show the local preview.
