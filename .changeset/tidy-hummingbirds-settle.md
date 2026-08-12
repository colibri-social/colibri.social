---
"@colibri-social/client": patch
---

Opening a community you have already visited no longer replays the loading screen. The app now keeps the last few communities in memory and shows them straight away while it checks for anything new, so switching in from the home screen is instant instead of flashing the startup animation for half a second.

Losing your connection while reading a community also no longer throws you out. A failed refresh used to replace the whole view with an error screen, even though the messages and member list on screen were still perfectly good. Now you stay where you are, a note tells you that you are looking at saved data, and the app quietly keeps retrying in the background until it gets through. Communities that have genuinely been deleted or that you no longer have access to still close as before.

<!-- whatsnew
title: Communities open instantly
icon: lightning-fill
body: Switching into a community you have already visited no longer replays the loading screen, and a dropped connection keeps you where you are instead of dumping you on an error screen.
kind: fix
-->
