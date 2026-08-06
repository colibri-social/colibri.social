---
"@colibri-social/client": minor
---

Add screen share quality settings and screen audio

Screen sharing now has a pre-share dialog for picking resolution (720p, 1080p, 1440p or source) and frame rate (15, 30 or 60), plus a dropdown next to the share button for changing quality while already streaming. Streams can now carry sound from the captured tab or screen where the browser engine supports it, with its own per-participant volume slider separate from the person's voice. Quality choices map to capture constraints, a content hint, a bitrate ceiling and a degradation preference, so a low frame rate now genuinely favours a sharp picture.

Cancelling the system picker no longer reports an error, real capture failures now surface a message instead of failing silently, and the share button hides itself on platforms with no screen capture support.

<!-- whatsnew
title: Screen Share Quality and Sound
icon: monitor-play-fill
body: Choose the resolution and frame rate before you share your screen, change it mid-stream from the dropdown next to the share button, and share sound from the tab or screen you picked.
kind: feature
-->
