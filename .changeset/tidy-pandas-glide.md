---
"@colibri-social/client": patch
"@colibri-social/wrapper": patch
---

Take the work out of the mobile pane swipe. The drag no longer reads `window.innerWidth` in between the inline style writes it makes on four elements, so it stops forcing a layout flush every frame. Pointer moves are coalesced to one delivery per animation frame instead of one per event, which also covers swipe-to-reply, since every message row runs the same recognizer. The panes translate by pixels rather than a mixed-unit `calc()`, and animate `transform` through `translate3d` rather than the individual `translate` property, which keeps their layer geometry independent of layout mid-drag.

Also fixes three things found alongside it: a swipe that starts over a category header no longer fires the collapse toggle (which persisted to local storage, so the channels stayed hidden afterwards), members without the manage permission can no longer start a category drag that freezes sidebar scrolling and then does nothing, and a touch drag now always requires a deliberate hold before a channel enters drag mode instead of depending on how the device reports its primary pointer.

<!-- whatsnew
title: Smoother channel swipes
icon: hand-swipe-right-fill
body: Swiping between the channel list, a channel and the member list should be less laggy.
platforms: mobile
kind: fix
-->
