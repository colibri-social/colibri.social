---
"@colibri-social/client": patch
"@colibri-social/wrapper": patch
---

Colibri on macOS, Windows and Linux now draws its own window title bar instead of using the plain system one, so the desktop app has the same branded header as the web app. The bar shows the community and channel you're in, and that same name is now what you see in the taskbar, in Alt-Tab and in Mission Control.
There's a new "Use system window controls" switch in Settings under Preferences to go back to native controls.

Also fixes the video viewer on desktop, which used a stand-in fullscreen mode that ignored Escape, and stops a trackpad pinch-zoom from shifting the whole app down.

<!-- whatsnew
title: A window title bar of our own
icon: browser-fill
body: The desktop app now has the same branded header as the web app, with the channel you're in shown in the title bar and the taskbar.
kind: feature
-->
