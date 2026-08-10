---
"@colibri-social/client": patch
---

Fades the top safe area to the darker pane color when the channel list is off screen on mobile. The shell painted that strip with the same color as the community rail at all times, so opening a channel left a light band across the top of an otherwise dark view. The strip now tracks the pane carousel, crossfading in step with the rail as you swipe.

<!-- whatsnew
title: Mind the gap
icon: device-mobile-fill
body: The area around the notch now matches whichever view you are on, so there is no light band left over the top of a channel.
kind: fix
-->
