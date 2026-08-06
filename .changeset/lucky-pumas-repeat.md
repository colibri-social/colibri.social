---
"@colibri-social/client": patch
---

Enable media capture on Linux and explain when voice cannot run

WebKitGTK denies camera, microphone and screen capture unless the app turns on its media settings and answers the permission request, and neither was happening. The webview now does both, so capture works where the engine supports it.

Whether calls connect is decided by the system's WebKitGTK build. WebRTC is an experimental build option in the GTK port and several distributions, including Ubuntu 24.04, ship without it. On those systems `RTCPeerConnection` does not exist and no application setting can bring it back, so joining a voice channel now explains that plainly instead of failing with an internal error.

The Linux desktop entry also lost the callback from a sign-in. It declared itself the handler for the `social.colibri` scheme but had no `%u` placeholder, so the system launched the app with no arguments and the URL was dropped.

<!-- whatsnew
title: Linux Sign-in and Media Fixes
icon: linux-logo-fill
body: Signing in on Linux now returns to the app instead of stalling in the browser, camera and microphone access work, and voice explains itself on systems whose web engine was built without WebRTC.
kind: fix
-->
