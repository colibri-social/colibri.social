---
"@colibri-social/client": minor
---

Add a native screen picker with previews on macOS

On the macOS desktop app, sharing your screen now opens Colibri's own picker instead of the system one. It has three tabs for applications, windows and screens, each showing a live preview of what you would be sharing, with the resolution and frame rate controls in the same dialog.

Sound comes along too. Turn on Share sound and the audio from whatever you picked is captured with the video, with Colibri's own output left out so nobody hears themselves back, and it lands on the same per-participant stream volume as before.

Capture runs natively through ScreenCaptureKit and is hardware encoded with VideoToolbox, then bridged into the existing voice connection, so the picked source reaches the channel at the quality you chose without a second connection or any change to the voice server.

Web, Windows and Linux are unaffected and keep using their own system picker, which already shows previews on Windows and macOS.

<!-- whatsnew
title: Pick What You Share
icon: selection-background-fill
body: On macOS, sharing your screen now opens Colibri's own picker with previews of every app, window and screen, plus the quality controls and a sound toggle right beside them.
kind: feature
-->
