---
"@colibri-social/client": minor
---

Add screen share quality settings and screen audio

Screen sharing now has a pre-share dialog for picking resolution (720p, 1080p, 1440p or source) and frame rate (15, 30 or 60), plus a dropdown next to the share button for changing quality while already streaming. Streams can now carry sound from the captured tab or screen where the browser engine supports it, with its own per-participant volume slider separate from the person's voice. Quality choices map to capture constraints, a content hint, a bitrate ceiling and a degradation preference, so a low frame rate now favours a sharp picture.

On Windows and MacOS, the app also displays a proper Application/Window/Screen picker.

<!-- whatsnew
title: Screen Share Improvements
icon: monitor-play-fill
body: The Windows and MacOS apps have gained an app/window/screen picker, plus you're able to share stream audio and change the stream's quality on any device.
kind: feature
-->
