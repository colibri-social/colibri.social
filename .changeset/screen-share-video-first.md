---
"@colibri-social/wrapper": patch
---

Screen sharing on Linux Wayland now starts the video before the shared audio, so a slow or failing audio capture can't delay or stop the picture. Screen sharing also writes short diagnostics to the app's log to help track down black screens.
