---
"@colibri-social/wrapper": patch
---

Sharing a single window sends only that app's sound. On Linux Wayland, a window share sends the sound of the app you pick from the audio list, and no sound when you don't pick one. A window picked from the whole screen option no longer sends every app's sound. On macOS, a window share captures audio from the app that owns the window.
