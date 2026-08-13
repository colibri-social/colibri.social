---
"@colibri-social/client": patch
---

Makes the channel sidebar resizable on desktop. Its right edge is now a drag handle that resizes the sidebar between 200px and 360px, and the chat area next to it follows along. The chosen width is remembered across sessions and applies to every community. The handle shows nothing until the pointer rests on the edge for a moment, at which point the border thickens to signal it can be dragged, and double-clicking it restores the default width. It can also be moved with the arrow keys once focused.

Also fixes the community name in the sidebar header never reflowing. It was sized to its own text with no overflow handling, so a long name pushed past the sidebar instead of truncating. It now grows and shrinks with the sidebar and ends in an ellipsis when there is not enough room.

<!-- whatsnew
title: Resizable channel sidebar
icon: sidebar-fill
body: Drag the right edge of the channel sidebar to make it wider or narrower. Double-click the edge to put it back.
platforms: desktop
kind: feature
-->
