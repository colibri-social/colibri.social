---
"@colibri-social/app": patch
---

The code highlighter no longer writes its loading messages to the browser console, and its warnings go through the app's logger. User badges, the profile popover and several menus, reorder and long-press handlers no longer create reactive work that is never cleaned up when they're read from an event handler.
