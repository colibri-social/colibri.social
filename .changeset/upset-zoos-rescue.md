---
"@colibri-social/app": patch
"@colibri-social/ui": patch
---

Opening a channel while the window is in the background no longer marks its notifications as seen. They clear once you return to the window.

Media previews, the Inbox popover, Space rail tooltips, call controls and the screen share picker no longer create reactive work that is never cleaned up when their values are read from event handlers.
