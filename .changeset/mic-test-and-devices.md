---
"@colibri-social/ui": patch
"@colibri-social/app": patch
---

Fix the microphone test flickering between loading and active, and make calls use the microphone and camera you picked. If a picked device is unplugged, calls fall back to the system default. Picking a microphone during a call you joined without one now turns it on. Call and notification sounds now play on the speaker you picked.
