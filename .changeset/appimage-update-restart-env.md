---
"@colibri-social/wrapper": patch
---

Fix screen sharing and other features that could break on Linux after the AppImage installed an update and restarted itself. The restarted version now starts with a clean environment and loads only its own libraries.
