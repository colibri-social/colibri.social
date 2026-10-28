---
"@colibri-social/wrapper": patch
---

Sharing a single window sends only that app's sound. On Linux, the audio follows what you picked in the system dialog. A window picked from the whole screen option no longer sends every app's sound. On GNOME and KDE Plasma, Colibri finds the window's app when the system dialog shares that detail, and otherwise sends no sound unless you pick an app. On macOS, a window share captures audio from the app that owns the window.
