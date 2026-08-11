---
"@colibri-social/client": patch
---

Stops reporting expected outcomes as errors. A link preview whose site is down, a community that was deleted while it was still the last one you visited, a handle typed into the sign-in field that does not resolve, a declined microphone prompt, a camera another app is already using and a dropped connection were all being sent to error tracking as faults. Each of those still surfaces in the UI, but none of them is a bug in the app, and together they buried the failures that are. Joining a voice channel now also refuses up front on systems whose web engine was built without WebRTC, instead of failing partway through setup.
